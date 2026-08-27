import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireUserAuth, requireAdminAuth } from '../auth';

export const walletRouter = Router();

// ==========================================
// USER WALLET & DEPOSIT REQUESTS
// ==========================================

/**
 * GET /api/wallet/transactions
 * User view of their own wallet ledger
 */
walletRouter.get('/transactions', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(`
      SELECT 
        id, 
        type, 
        amount, 
        balance_before, 
        balance_after, 
        currency, 
        reference_type, 
        reference_id, 
        description, 
        created_at
      FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 100
    `, [user.id]);

    const depositRequests = await db.query(`
      SELECT 
        id, 
        amount, 
        payment_method, 
        utr_number, 
        status, 
        rejection_reason, 
        created_at, 
        approved_at
      FROM payment_requests
      WHERE user_id = $1
      ORDER BY id DESC
      LIMIT 50
    `, [user.id]);

    res.json({
      success: true,
      currentBalance: user.walletBalance,
      transactions: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        amount: parseFloat(row.amount),
        balanceBefore: parseFloat(row.balance_before),
        balanceAfter: parseFloat(row.balance_after),
        currency: row.currency,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        description: row.description,
        createdAt: row.created_at
      })),
      depositRequests: depositRequests.rows.map(row => ({
        id: row.id,
        amount: parseFloat(row.amount),
        method: row.payment_method,
        utr: row.utr_number,
        status: row.status,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        approvedAt: row.approved_at
      }))
    });
  } catch (err: any) {
    console.error('[WALLET TRANSACTIONS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve transactions' });
  }
});

/**
 * POST /api/wallet/deposit
 * User submits a manual deposit / UTR verification request.
 * Wallet balance remains UNCHANGED (status = 'pending').
 */
walletRouter.post('/deposit', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { amount, paymentMethod, utrNumber, payerDetails } = req.body;

  if (!amount || !paymentMethod || !utrNumber) {
    res.status(400).json({ success: false, error: 'Amount, payment method, and UTR/Transaction ID are required.' });
    return;
  }

  const cleanAmount = parseFloat(String(amount));
  const cleanUtr = String(utrNumber).trim().toUpperCase();
  const cleanMethod = String(paymentMethod).trim();

  if (isNaN(cleanAmount) || cleanAmount < 10) {
    res.status(400).json({ success: false, error: 'Minimum deposit amount is ₹10.' });
    return;
  }

  if (cleanUtr.length < 6 || cleanUtr.length > 50) {
    res.status(400).json({ success: false, error: 'Please enter a valid 12-digit UPI UTR or Transaction reference number.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Check if UTR was already submitted
    const existingUtr = await db.query(
      'SELECT id, status, created_at FROM payment_requests WHERE utr_number = $1',
      [cleanUtr]
    );

    if (existingUtr.rowCount && existingUtr.rowCount > 0) {
      res.status(400).json({ 
        success: false, 
        error: 'This UTR / Transaction ID has already been submitted. If you believe this is an error, please contact support.' 
      });
      return;
    }

    const insertRes = await db.query(`
      INSERT INTO payment_requests (
        user_id, amount, currency, payment_method, utr_number, payer_vpa_or_account, status
      )
      VALUES ($1, $2, 'INR', $3, $4, $5, 'pending')
      RETURNING id, amount, payment_method, utr_number, status, created_at
    `, [
      user.id,
      cleanAmount,
      cleanMethod,
      cleanUtr,
      payerDetails ? String(payerDetails).trim() : null
    ]);

    res.json({
      success: true,
      message: 'Deposit request submitted successfully! Funds will be credited once verified by our banking gateway.',
      request: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('[DEPOSIT SUBMISSION ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to submit payment request' });
  }
});

// ==========================================
// ADMIN PAYMENT VERIFICATION & WALLET ADJUSTMENT
// ==========================================

/**
 * GET /api/admin/payments/pending
 * List all pending payment requests awaiting admin approval
 */
walletRouter.get('/admin/pending', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.user_id,
        u.username,
        u.email,
        u.wallet_balance AS current_user_balance,
        p.amount,
        p.currency,
        p.payment_method,
        p.utr_number,
        p.payer_vpa_or_account,
        p.status,
        p.created_at
      FROM payment_requests p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'pending'
      ORDER BY p.id ASC
    `);

    res.json({
      success: true,
      pendingPayments: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        email: row.email,
        currentUserBalance: parseFloat(row.current_user_balance),
        amount: parseFloat(row.amount),
        currency: row.currency,
        method: row.payment_method,
        utr: row.utr_number,
        payerDetails: row.payer_vpa_or_account,
        status: row.status,
        createdAt: row.created_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN PENDING PAYMENTS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve pending payments' });
  }
});

/**
 * GET /api/admin/payments/history
 * Complete payment approval / rejection history
 */
walletRouter.get('/admin/history', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const { status, search } = req.query;

    let query = `
      SELECT 
        p.id,
        p.user_id,
        u.username,
        u.email,
        p.amount,
        p.currency,
        p.payment_method,
        p.utr_number,
        p.payer_vpa_or_account,
        p.status,
        p.rejection_reason,
        p.approved_by_admin_id,
        p.approved_at,
        p.created_at
      FROM payment_requests p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(String(status).toLowerCase());
      query += ` AND LOWER(p.status) = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (p.utr_number ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    query += ' ORDER BY p.id DESC LIMIT 200';

    const result = await db.query(query, params);

    res.json({
      success: true,
      history: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        email: row.email,
        amount: parseFloat(row.amount),
        currency: row.currency,
        method: row.payment_method,
        utr: row.utr_number,
        payerDetails: row.payer_vpa_or_account,
        status: row.status,
        rejectionReason: row.rejection_reason,
        approvedByAdminId: row.approved_by_admin_id,
        approvedAt: row.approved_at,
        createdAt: row.created_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN PAYMENT HISTORY ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve payment history' });
  }
});

/**
 * POST /api/admin/payments/:id/approve
 * Admin approves pending payment.
 * ATOMIC TRANSACTION:
 * - Checks status is 'pending'
 * - Updates status to 'approved'
 * - Credits user wallet
 * - Creates wallet transaction ledger record
 * - Idempotent: Can never double-credit.
 */
walletRouter.post('/admin/:id/approve', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).admin;
  const paymentId = parseInt(req.params.id, 10);

  if (isNaN(paymentId)) {
    res.status(400).json({ success: false, error: 'Invalid payment ID' });
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

    // 1. Lock payment request row
    const payRes = await client.query(
      'SELECT id, user_id, amount, currency, utr_number, payment_method, status FROM payment_requests WHERE id = $1 FOR UPDATE',
      [paymentId]
    );

    if (payRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Payment request not found.' });
      return;
    }

    const payment = payRes.rows[0];

    if (payment.status !== 'pending') {
      await client.query('ROLLBACK');
      res.status(400).json({ 
        success: false, 
        error: `Payment has already been processed with status: ${payment.status.toUpperCase()}. Cannot approve again.` 
      });
      return;
    }

    const depositAmount = parseFloat(payment.amount);

    // 2. Lock user row and fetch balance
    const userRes = await client.query(
      'SELECT id, username, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
      [payment.user_id]
    );

    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Associated user account not found.' });
      return;
    }

    const user = userRes.rows[0];
    const balanceBefore = parseFloat(user.wallet_balance);
    const balanceAfter = parseFloat((balanceBefore + depositAmount).toFixed(4));

    // 3. Update User Wallet
    await client.query(
      'UPDATE users SET wallet_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [balanceAfter, user.id]
    );

    // 4. Update Payment Request status
    await client.query(`
      UPDATE payment_requests 
      SET 
        status = 'approved',
        approved_by_admin_id = $1,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [admin.id, paymentId]);

    // 5. Create Wallet Transaction Ledger Entry
    await client.query(`
      INSERT INTO wallet_transactions (
        user_id, type, amount, balance_before, balance_after, currency,
        reference_type, reference_id, description, admin_id
      )
      VALUES ($1, 'DEPOSIT_APPROVED', $2, $3, $4, 'INR', 'payment_request', $5, $6, $7)
    `, [
      user.id,
      depositAmount,
      balanceBefore,
      balanceAfter,
      String(paymentId),
      `Deposit Approved - ${payment.payment_method} (UTR: ${payment.utr_number})`,
      admin.id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Successfully approved ₹${depositAmount.toFixed(2)} deposit for ${user.username}. New balance: ₹${balanceAfter.toFixed(2)}`,
      paymentId,
      newBalance: balanceAfter
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[PAYMENT APPROVAL ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to approve payment' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/payments/:id/reject
 * Admin rejects payment request. Wallet remains unchanged.
 */
walletRouter.post('/admin/:id/reject', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).admin;
  const paymentId = parseInt(req.params.id, 10);
  const { reason = 'Invalid UTR or payment not received in bank account' } = req.body;

  if (isNaN(paymentId)) {
    res.status(400).json({ success: false, error: 'Invalid payment ID' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const payRes = await db.query('SELECT status FROM payment_requests WHERE id = $1', [paymentId]);
    if (payRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Payment request not found.' });
      return;
    }

    if (payRes.rows[0].status !== 'pending') {
      res.status(400).json({ success: false, error: `Payment is already ${payRes.rows[0].status}.` });
      return;
    }

    await db.query(`
      UPDATE payment_requests 
      SET 
        status = 'rejected',
        rejection_reason = $1,
        approved_by_admin_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [reason, admin.id, paymentId]);

    res.json({
      success: true,
      message: 'Payment request rejected.',
      paymentId
    });
  } catch (err: any) {
    console.error('[PAYMENT REJECTION ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to reject payment' });
  }
});

/**
 * POST /api/admin/wallet/adjust
 * Admin manual wallet balance adjustment (Credit or Debit)
 * Requires explicit reason and logs full audit trail
 */
walletRouter.post('/admin/adjust', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).admin;
  const { userId, amount, reason } = req.body;

  if (!userId || amount === undefined || !reason) {
    res.status(400).json({ success: false, error: 'User ID, adjustment amount, and reason are required.' });
    return;
  }

  const cleanUserId = parseInt(String(userId), 10);
  const cleanAmount = parseFloat(String(amount));

  if (isNaN(cleanUserId) || isNaN(cleanAmount) || cleanAmount === 0) {
    res.status(400).json({ success: false, error: 'Invalid adjustment amount.' });
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

    const userRes = await client.query('SELECT id, username, wallet_balance FROM users WHERE id = $1 FOR UPDATE', [cleanUserId]);
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userRes.rows[0];
    const balanceBefore = parseFloat(user.wallet_balance);
    const balanceAfter = parseFloat((balanceBefore + cleanAmount).toFixed(4));

    if (balanceAfter < 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, error: `Adjustment would result in negative balance: ₹${balanceAfter.toFixed(2)}` });
      return;
    }

    await client.query('UPDATE users SET wallet_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [balanceAfter, cleanUserId]);

    await client.query(`
      INSERT INTO wallet_transactions (
        user_id, type, amount, balance_before, balance_after, currency,
        reference_type, reference_id, description, admin_id
      )
      VALUES ($1, 'ADMIN_ADJUSTMENT', $2, $3, $4, 'INR', 'manual_adjustment', $5, $6, $7)
    `, [
      cleanUserId,
      cleanAmount,
      balanceBefore,
      balanceAfter,
      `admin_${admin.id}`,
      `Admin adjustment: ${reason}`,
      admin.id
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Wallet for ${user.username} adjusted by ₹${cleanAmount > 0 ? '+' : ''}${cleanAmount.toFixed(2)}. New balance: ₹${balanceAfter.toFixed(2)}`,
      newBalance: balanceAfter
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[ADMIN WALLET ADJUST ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to adjust wallet' });
  } finally {
    client.release();
  }
});
