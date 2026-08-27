import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireUserAuth, requireAdminAuth } from '../auth';
import { providerRegistry } from '../providers/providerRegistry';

export const orderRouter = Router();

// ==========================================
// USER ORDER CREATION & HISTORY
// ==========================================

/**
 * POST /api/orders
 * User places a new SMM order.
 * Strictly verifies price and wallet balance on the server inside an atomic transaction.
 * Calls provider adapter server-side only. Safely refunds if provider rejects.
 */
orderRouter.post('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { serviceId, link, quantity, idempotencyKey } = req.body;

  if (!serviceId || !link || !quantity) {
    res.status(400).json({ success: false, error: 'Service ID, link/URL, and quantity are required.' });
    return;
  }

  const cleanLink = String(link).trim();
  const cleanQty = parseInt(String(quantity), 10);
  const cleanServiceId = parseInt(String(serviceId), 10);

  if (isNaN(cleanQty) || cleanQty <= 0) {
    res.status(400).json({ success: false, error: 'Quantity must be a positive integer.' });
    return;
  }

  if (cleanLink.length < 3) {
    res.status(400).json({ success: false, error: 'Please enter a valid target link or username.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Service Details and lock row
    const serviceRes = await client.query(`
      SELECT 
        s.id, 
        s.name, 
        s.platform, 
        s.min_quantity, 
        s.max_quantity, 
        s.rate_per_1000, 
        s.provider_id, 
        s.provider_service_id, 
        s.provider_rate, 
        s.status
      FROM services s
      WHERE s.id = $1
    `, [cleanServiceId]);

    if (serviceRes.rowCount === 0 || serviceRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: 'Selected service is currently inactive or not found.' });
      return;
    }

    const service = serviceRes.rows[0];

    // 2. Validate quantity limits
    if (cleanQty < service.min_quantity) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: `Minimum quantity for this service is ${service.min_quantity}.` });
      return;
    }

    if (cleanQty > service.max_quantity) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: `Maximum quantity for this service is ${service.max_quantity}.` });
      return;
    }

    // 3. Server-side price calculation (Precise Decimal calculation)
    const sellingRate = parseFloat(service.rate_per_1000);
    const providerRate = parseFloat(service.provider_rate) || 0;
    const charge = parseFloat(((cleanQty / 1000) * sellingRate).toFixed(4));
    const providerCost = parseFloat(((cleanQty / 1000) * providerRate).toFixed(4));
    const profit = parseFloat((charge - providerCost).toFixed(4));

    // 4. Lock and check user wallet balance
    const userRes = await client.query(
      'SELECT id, wallet_balance, status FROM users WHERE id = $1 FOR UPDATE',
      [user.id]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      res.status(403).json({ success: false, error: 'User account is not active.' });
      return;
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance);
    if (currentBalance < charge) {
      await client.query('ROLLBACK');
      res.status(400).json({ 
        success: false, 
        error: `Insufficient wallet balance. Required: ₹${charge.toFixed(2)}, Available: ₹${currentBalance.toFixed(2)}. Please add funds.`,
        requiredAmount: charge,
        currentBalance
      });
      return;
    }

    // 5. Deduct wallet balance
    const newBalance = parseFloat((currentBalance - charge).toFixed(4));
    await client.query(
      'UPDATE users SET wallet_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, user.id]
    );

    // 6. Insert Order in SociaraX
    const orderRes = await client.query(`
      INSERT INTO orders (
        user_id, service_id, service_name, platform, link, quantity,
        charge, provider_cost, profit, currency,
        provider_id, provider_status, status, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'INR', $10, 'pending', 'pending', $11)
      RETURNING id, service_name, link, quantity, charge, status, created_at
    `, [
      user.id,
      service.id,
      service.name,
      service.platform,
      cleanLink,
      cleanQty,
      charge,
      providerCost,
      profit,
      service.provider_id,
      idempotencyKey || null
    ]);

    const createdOrder = orderRes.rows[0];

    // 7. Record Wallet Transaction Ledger
    await client.query(`
      INSERT INTO wallet_transactions (
        user_id, type, amount, balance_before, balance_after, currency,
        reference_type, reference_id, description
      )
      VALUES ($1, 'ORDER_PAYMENT', $2, $3, $4, 'INR', 'order', $5, $6)
    `, [
      user.id,
      -charge,
      currentBalance,
      newBalance,
      String(createdOrder.id),
      `Order #${createdOrder.id} - ${service.name} (${cleanQty} qty)`
    ]);

    await client.query('COMMIT');

    // 8. Call Provider Adapter Server-Side (Post-Commit / Async Resilience)
    let providerOrderId: string | number | null = null;
    let finalStatus = 'processing';
    let providerError: string | null = null;

    if (service.provider_id && service.provider_service_id) {
      try {
        const providerInfo = await providerRegistry.getActiveProvider(service.provider_id);
        if (providerInfo && providerInfo.apiKey) {
          const providerResult = await providerInfo.adapter.createOrder(
            providerInfo.apiUrl,
            providerInfo.apiKey,
            {
              service: service.provider_service_id,
              link: cleanLink,
              quantity: cleanQty
            }
          );

          if (providerResult.success && providerResult.orderId) {
            providerOrderId = providerResult.orderId;
            finalStatus = 'processing';
            
            await db.query(`
              UPDATE orders 
              SET provider_order_id = $1, provider_status = 'processing', status = 'processing', updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [String(providerOrderId), createdOrder.id]);
          } else {
            // Provider failed: Perform safe automatic rollback & refund
            providerError = providerResult.error || 'Provider rejected order';
            console.error(`[PROVIDER REJECTION on Order #${createdOrder.id}]:`, providerError);

            // Execute safe refund transaction
            const refundClient = await db.connect();
            try {
              await refundClient.query('BEGIN');
              
              const userRefRes = await refundClient.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [user.id]);
              const balBeforeRefund = parseFloat(userRefRes.rows[0].wallet_balance);
              const balAfterRefund = parseFloat((balBeforeRefund + charge).toFixed(4));

              await refundClient.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [balAfterRefund, user.id]);
              
              await refundClient.query(`
                UPDATE orders 
                SET status = 'failed', provider_error = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
              `, [providerError, createdOrder.id]);

              await refundClient.query(`
                INSERT INTO wallet_transactions (
                  user_id, type, amount, balance_before, balance_after, currency,
                  reference_type, reference_id, description
                )
                VALUES ($1, 'REFUND', $2, $3, $4, 'INR', 'order', $5, $6)
              `, [
                user.id,
                charge,
                balBeforeRefund,
                balAfterRefund,
                String(createdOrder.id),
                `Auto-refund for Order #${createdOrder.id} (Provider rejected order)`
              ]);

              await refundClient.query('COMMIT');
            } catch (refErr) {
              await refundClient.query('ROLLBACK');
              console.error('[REFUND ERROR]:', refErr);
            } finally {
              refundClient.release();
            }

            res.status(400).json({
              success: false,
              error: 'Order could not be fulfilled at this moment. Your wallet has been fully refunded.',
              orderId: createdOrder.id,
              refunded: true
            });
            return;
          }
        }
      } catch (provErr: any) {
        console.error('[PROVIDER COMMUNICATION ERROR]:', provErr);
        // Mark as provider_pending for admin review without crashing
        await db.query(`
          UPDATE orders 
          SET status = 'pending', provider_error = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [provErr.message, createdOrder.id]);
      }
    }

    res.json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        id: createdOrder.id,
        serviceName: createdOrder.service_name,
        link: createdOrder.link,
        quantity: createdOrder.quantity,
        charge: createdOrder.charge,
        status: finalStatus,
        createdAt: createdOrder.created_at
      },
      newBalance
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[ORDER CREATION ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to place order. Please try again.' });
  } finally {
    client.release();
  }
});

// Helper function to synchronize active orders from upstream providers
async function syncPendingOrdersHelper(db: any, filterUserId?: number): Promise<number> {
  try {
    let q = `
      SELECT id, provider_id, provider_order_id, user_id
      FROM orders
      WHERE status IN ('pending', 'processing', 'in_progress')
        AND provider_order_id IS NOT NULL
    `;
    const p: any[] = [];
    if (filterUserId) {
      p.push(filterUserId);
      q += ` AND user_id = $1`;
    }
    q += ' ORDER BY id DESC LIMIT 50';

    const activeRes = await db.query(q, p);
    if (activeRes.rowCount === 0) return 0;

    let updated = 0;
    for (const ord of activeRes.rows) {
      try {
        const prov = await providerRegistry.getActiveProvider(ord.provider_id);
        if (prov && prov.apiKey) {
          const statusRes = await prov.adapter.getOrderStatus(prov.apiUrl, prov.apiKey, ord.provider_order_id);
          if (statusRes.success && statusRes.status) {
            const rawStatus = String(statusRes.status).toLowerCase();
            let mappedStatus = 'processing';
            if (rawStatus.includes('complet') || rawStatus === 'done' || rawStatus === 'success') mappedStatus = 'completed';
            else if (rawStatus.includes('in progress') || rawStatus.includes('inprogress') || rawStatus.includes('in-progress')) mappedStatus = 'in_progress';
            else if (rawStatus.includes('process')) mappedStatus = 'processing';
            else if (rawStatus.includes('pend')) mappedStatus = 'pending';
            else if (rawStatus.includes('part')) mappedStatus = 'partial';
            else if (rawStatus.includes('cancel')) mappedStatus = 'cancelled';
            else if (rawStatus.includes('refund')) mappedStatus = 'refunded';
            else if (rawStatus.includes('fail')) mappedStatus = 'failed';

            await db.query(`
              UPDATE orders
              SET
                status = $1,
                provider_status = $2,
                start_count = COALESCE($3, start_count),
                remains = COALESCE($4, remains),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
            `, [
              mappedStatus,
              statusRes.status,
              statusRes.start_count ? parseInt(String(statusRes.start_count), 10) : null,
              statusRes.remains ? parseInt(String(statusRes.remains), 10) : null,
              ord.id
            ]);
            updated++;
          }
        }
      } catch (err) {
        // Continue quietly
      }
    }
    return updated;
  } catch (err) {
    console.warn('[SYNC HELPER ERROR]:', err);
    return 0;
  }
}

/**
 * GET /api/orders
 * User order history (Sanitized - customer sees only SociaraX order data)
 */
orderRouter.get('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Quick async sync for user's pending/processing orders from LuvSMM
    await Promise.race([
      syncPendingOrdersHelper(db, user.id),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    const { status, search, platform } = req.query;

    let query = `
      SELECT 
        o.id,
        o.service_name,
        o.platform,
        o.link,
        o.quantity,
        o.charge,
        o.status,
        o.start_count,
        o.remains,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.user_id = $1
    `;
    const params: any[] = [user.id];

    if (status && status !== 'all') {
      params.push(String(status).toLowerCase());
      query += ` AND LOWER(o.status) = $${params.length}`;
    }

    if (platform && platform !== 'all') {
      params.push(String(platform).toLowerCase());
      query += ` AND LOWER(o.platform) = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (o.service_name ILIKE $${params.length} OR o.link ILIKE $${params.length} OR CAST(o.id AS TEXT) ILIKE $${params.length})`;
    }

    query += ' ORDER BY o.id DESC LIMIT 200';

    const result = await db.query(query, params);

    res.json({
      success: true,
      orders: result.rows.map(row => ({
        id: row.id,
        serviceName: row.service_name,
        platform: row.platform,
        link: row.link,
        quantity: row.quantity,
        charge: parseFloat(row.charge),
        status: row.status,
        startCount: row.start_count,
        remains: row.remains,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (err: any) {
    console.error('[USER ORDERS FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
  }
});

// ==========================================
// ADMIN ORDER MANAGEMENT
// ==========================================

/**
 * GET /api/admin/orders
 * Admin comprehensive order list with profit calculation, provider order IDs, and user details.
 */
orderRouter.get('/admin', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Quick async sync for active orders from LuvSMM
    await Promise.race([
      syncPendingOrdersHelper(db),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    const { status, search, platform, userId } = req.query;

    let query = `
      SELECT 
        o.id,
        o.user_id,
        u.username,
        u.email,
        o.service_id,
        o.service_name,
        o.platform,
        o.link,
        o.quantity,
        o.charge,
        o.provider_cost,
        o.profit,
        o.provider_id,
        o.provider_order_id,
        o.provider_status,
        o.provider_error,
        o.status,
        o.start_count,
        o.remains,
        o.created_at,
        o.updated_at,
        p.name AS provider_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN api_providers p ON o.provider_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(String(status).toLowerCase());
      query += ` AND LOWER(o.status) = $${params.length}`;
    }

    if (platform && platform !== 'all') {
      params.push(String(platform).toLowerCase());
      query += ` AND LOWER(o.platform) = $${params.length}`;
    }

    if (userId && userId !== 'all') {
      params.push(parseInt(String(userId), 10));
      query += ` AND o.user_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (o.service_name ILIKE $${params.length} OR o.link ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR CAST(o.id AS TEXT) ILIKE $${params.length} OR o.provider_order_id ILIKE $${params.length})`;
    }

    query += ' ORDER BY o.id DESC LIMIT 300';

    const result = await db.query(query, params);

    res.json({
      success: true,
      orders: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        email: row.email,
        serviceId: row.service_id,
        serviceName: row.service_name,
        platform: row.platform,
        link: row.link,
        quantity: row.quantity,
        charge: parseFloat(row.charge),
        providerCost: parseFloat(row.provider_cost || '0'),
        profit: parseFloat(row.profit || '0'),
        providerId: row.provider_id,
        providerName: row.provider_name || 'None',
        providerOrderId: row.provider_order_id,
        providerStatus: row.provider_status,
        providerError: row.provider_error,
        status: row.status,
        startCount: row.start_count,
        remains: row.remains,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN ORDERS FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
  }
});

/**
 * POST /api/admin/orders/:id/status
 * Admin manual status override (e.g. Cancel & Refund, Mark Completed, Re-send)
 */
orderRouter.post('/admin/:id/status', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const orderId = parseInt(req.params.id, 10);
  const { newStatus, refund = false } = req.body;

  if (isNaN(orderId) || !newStatus) {
    res.status(400).json({ success: false, error: 'Order ID and new status are required.' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const order = orderRes.rows[0];
    const charge = parseFloat(order.charge);

    if (refund && (newStatus === 'cancelled' || newStatus === 'refunded') && order.status !== 'refunded') {
      // Credit user wallet
      const userRes = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [order.user_id]);
      const balBefore = parseFloat(userRes.rows[0].wallet_balance);
      const balAfter = parseFloat((balBefore + charge).toFixed(4));

      await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [balAfter, order.user_id]);
      
      await client.query(`
        INSERT INTO wallet_transactions (
          user_id, type, amount, balance_before, balance_after, currency,
          reference_type, reference_id, description
        )
        VALUES ($1, 'REFUND', $2, $3, $4, 'INR', 'order', $5, $6)
      `, [
        order.user_id,
        charge,
        balBefore,
        balAfter,
        String(order.id),
        `Admin refund for Order #${order.id}`
      ]);
    }

    await client.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, orderId]);

    await client.query('COMMIT');

    res.json({ success: true, message: `Order #${orderId} status changed to ${newStatus}` });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[ADMIN ORDER STATUS CHANGE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/orders/sync-status
 * Admin triggers order status sync from upstream provider for active/processing orders
 */
orderRouter.post('/admin/sync-status', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const activeOrdersRes = await db.query(`
      SELECT id, provider_id, provider_order_id 
      FROM orders 
      WHERE status IN ('pending', 'processing', 'in_progress') 
        AND provider_order_id IS NOT NULL 
      LIMIT 100
    `);

    if (activeOrdersRes.rowCount === 0) {
      res.json({ success: true, message: 'No active orders pending status sync.' });
      return;
    }

    let syncedCount = 0;

    for (const ord of activeOrdersRes.rows) {
      try {
        const prov = await providerRegistry.getActiveProvider(ord.provider_id);
        if (prov && prov.apiKey) {
          const statusRes = await prov.adapter.getOrderStatus(prov.apiUrl, prov.apiKey, ord.provider_order_id);
          if (statusRes.success && statusRes.status) {
            const rawStatus = statusRes.status.toLowerCase();
            let mappedStatus = 'processing';
            if (rawStatus.includes('completed') || rawStatus === 'done') mappedStatus = 'completed';
            else if (rawStatus.includes('partial')) mappedStatus = 'partial';
            else if (rawStatus.includes('cancel')) mappedStatus = 'cancelled';
            else if (rawStatus.includes('refund')) mappedStatus = 'refunded';
            else if (rawStatus.includes('in progress')) mappedStatus = 'in_progress';

            await db.query(`
              UPDATE orders 
              SET 
                status = $1, 
                provider_status = $2, 
                start_count = COALESCE($3, start_count),
                remains = COALESCE($4, remains),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
            `, [
              mappedStatus,
              statusRes.status,
              statusRes.start_count ? parseInt(String(statusRes.start_count), 10) : null,
              statusRes.remains ? parseInt(String(statusRes.remains), 10) : null,
              ord.id
            ]);
            syncedCount++;
          }
        }
      } catch (syncErr) {
        console.warn(`[STATUS SYNC FAILED for Order #${ord.id}]:`, syncErr);
      }
    }

    res.json({
      success: true,
      message: `Status synchronization complete. ${syncedCount} orders updated.`
    });
  } catch (err: any) {
    console.error('[STATUS SYNC ERROR]:', err);
    res.status(500).json({ success: false, error: 'Status sync failed' });
  }
});

/**
 * GET /api/orders/admin/:id/verify-provider
 * Admin real-time live check directly against upstream provider API
 */
orderRouter.get('/admin/:id/verify-provider', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    res.status(400).json({ success: false, error: 'Invalid order ID' });
    return;
  }

  try {
    const orderRes = await db.query(`
      SELECT o.*, p.name AS provider_name, p.api_url, p.api_key
      FROM orders o
      LEFT JOIN api_providers p ON o.provider_id = p.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const order = orderRes.rows[0];

    if (!order.provider_id || !order.provider_order_id) {
      res.json({
        success: true,
        orderId: order.id,
        hasProviderOrder: false,
        message: 'This order was not dispatched to an external provider (manual or unlinked service).',
        order
      });
      return;
    }

    const prov = await providerRegistry.getActiveProvider(order.provider_id);
    if (!prov || !prov.apiKey) {
      res.status(400).json({
        success: false,
        error: `Provider #${order.provider_id} (${order.provider_name || 'LuvSMM'}) credentials unavailable.`
      });
      return;
    }

    const statusRes = await prov.adapter.getOrderStatus(prov.apiUrl, prov.apiKey, order.provider_order_id);

    // If status returned from provider, update the database row
    if (statusRes.success && statusRes.status) {
      const rawStatus = String(statusRes.status).toLowerCase();
      let mappedStatus = order.status;
      if (rawStatus.includes('completed') || rawStatus === 'done') mappedStatus = 'completed';
      else if (rawStatus.includes('partial')) mappedStatus = 'partial';
      else if (rawStatus.includes('cancel')) mappedStatus = 'cancelled';
      else if (rawStatus.includes('refund')) mappedStatus = 'refunded';
      else if (rawStatus.includes('in progress')) mappedStatus = 'in_progress';
      else if (rawStatus.includes('processing')) mappedStatus = 'processing';

      await db.query(`
        UPDATE orders 
        SET 
          status = $1, 
          provider_status = $2, 
          start_count = COALESCE($3, start_count),
          remains = COALESCE($4, remains),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [
        mappedStatus,
        statusRes.status,
        statusRes.start_count ? parseInt(String(statusRes.start_count), 10) : null,
        statusRes.remains ? parseInt(String(statusRes.remains), 10) : null,
        order.id
      ]);
    }

    res.json({
      success: true,
      orderId: order.id,
      providerName: order.provider_name || 'LuvSMM',
      providerOrderId: order.provider_order_id,
      liveProviderResponse: statusRes,
      message: `Verified live with ${order.provider_name || 'LuvSMM'} API.`
    });
  } catch (err: any) {
    console.error('[VERIFY PROVIDER ERROR]:', err);
    res.status(500).json({ success: false, error: err.message || 'Error querying upstream provider API.' });
  }
});

