import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';
import { providerRegistry } from '../providers/providerRegistry';

export const serviceRouter = Router();

// ==========================================
// CUSTOMER-FACING SERVICES (SANITIZED)
// ==========================================

/**
 * GET /api/services
 * Public / User service catalog.
 * ONLY exposes SociaraX customer fields. Provider cost and IDs are strictly hidden.
 */
serviceRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const { platform, category, search } = req.query;

    let query = `
      SELECT 
        id, 
        name, 
        category_name, 
        platform, 
        description, 
        type,
        min_quantity, 
        max_quantity, 
        rate_per_1000, 
        refill_available, 
        cancel_available, 
        dripfeed_available,
        average_time,
        status,
        display_order
      FROM services
      WHERE status = 'active'
    `;
    const params: any[] = [];

    if (platform && platform !== 'all') {
      params.push(String(platform).toLowerCase());
      query += ` AND LOWER(platform) = $${params.length}`;
    }

    if (category && category !== 'all') {
      params.push(String(category));
      query += ` AND category_name = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length} OR category_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY display_order ASC, category_name ASC, id ASC';

    const result = await db.query(query, params);

    // Derive unique categories and platforms from rows in memory (zero DB latency)
    // If filtered, fetch full distinct active categories/platforms in parallel
    let categories: string[];
    let platforms: string[];

    if (!platform && !category && !search) {
      categories = Array.from(new Set<string>(result.rows.map(r => String(r.category_name || '')))).filter(Boolean).sort();
      platforms = Array.from(new Set<string>(result.rows.map(r => String(r.platform || '')))).filter(Boolean).sort();
    } else {
      const catResult = await db.query(`
        SELECT DISTINCT category_name, platform 
        FROM services 
        WHERE status = 'active' 
        ORDER BY category_name ASC
      `);
      categories = Array.from(new Set<string>(catResult.rows.map(r => String(r.category_name || '')))).filter(Boolean);
      platforms = Array.from(new Set<string>(catResult.rows.map(r => String(r.platform || '')))).filter(Boolean);
    }

    res.json({
      success: true,
      services: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category_name,
        platform: row.platform,
        description: row.description || '',
        type: row.type || 'Default',
        min: parseInt(row.min_quantity, 10),
        max: parseInt(row.max_quantity, 10),
        rate: parseFloat(row.rate_per_1000), // SociaraX customer rate per 1000
        refill: Boolean(row.refill_available),
        cancel: Boolean(row.cancel_available),
        dripfeed: Boolean(row.dripfeed_available),
        averageTime: row.average_time || 'Instant - 1 Hour'
      })),
      categories,
      platforms
    });
  } catch (err: any) {
    console.error('[SERVICES FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to load services' });
  }
});

// ==========================================
// ADMIN SERVICES MANAGEMENT
// ==========================================

/**
 * GET /api/admin/services
 * Admin catalog with provider cost, markup, profit calculation, and provider mapping.
 */
serviceRouter.get('/admin', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const { platform, category, status, search, providerId } = req.query;

    let query = `
      SELECT 
        s.id, 
        s.name, 
        s.category_name, 
        s.platform, 
        s.description, 
        s.type,
        s.min_quantity, 
        s.max_quantity, 
        s.provider_id,
        s.provider_service_id,
        s.provider_rate,
        COALESCE(s.provider_rate_usd, 0) AS provider_rate_usd,
        s.rate_per_1000, 
        s.markup_percentage,
        s.markup_fixed,
        s.refill_available, 
        s.cancel_available, 
        s.dripfeed_available,
        s.average_time,
        s.status,
        s.display_order,
        s.created_at,
        p.name AS provider_name
      FROM services s
      LEFT JOIN api_providers p ON s.provider_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (platform && platform !== 'all') {
      params.push(String(platform).toLowerCase());
      query += ` AND LOWER(s.platform) = $${params.length}`;
    }

    if (category && category !== 'all') {
      params.push(String(category));
      query += ` AND s.category_name = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(String(status));
      query += ` AND s.status = $${params.length}`;
    }

    if (providerId && providerId !== 'all') {
      params.push(parseInt(String(providerId), 10));
      query += ` AND s.provider_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (s.name ILIKE $${params.length} OR s.provider_service_id ILIKE $${params.length} OR s.category_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY s.display_order ASC, s.id ASC';

    const result = await db.query(query, params);

    const services = result.rows.map(row => {
      const providerRate = parseFloat(row.provider_rate) || 0;
      const providerRateUsd = parseFloat(row.provider_rate_usd) || 0;
      const sellingRate = parseFloat(row.rate_per_1000) || 0;
      const profitPer1000 = Math.max(0, sellingRate - providerRate);
      const profitMarginPct = sellingRate > 0 ? ((profitPer1000 / sellingRate) * 100).toFixed(1) : '0';

      return {
        id: row.id,
        name: row.name,
        category: row.category_name,
        platform: row.platform,
        description: row.description || '',
        type: row.type || 'Default',
        min: parseInt(row.min_quantity, 10),
        max: parseInt(row.max_quantity, 10),
        providerId: row.provider_id,
        providerName: row.provider_name || 'Manual / None',
        providerServiceId: row.provider_service_id || '',
        providerRate,
        providerRateUsd,
        sellingRate,
        markupPercentage: parseFloat(row.markup_percentage) || 0,
        markupFixed: parseFloat(row.markup_fixed) || 0,
        profitPer1000,
        profitMarginPct,
        refill: Boolean(row.refill_available),
        cancel: Boolean(row.cancel_available),
        dripfeed: Boolean(row.dripfeed_available),
        averageTime: row.average_time || 'Instant',
        status: row.status,
        displayOrder: row.display_order,
        createdAt: row.created_at
      };
    });

    res.json({ success: true, services });
  } catch (err: any) {
    console.error('[ADMIN SERVICES ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to load admin services' });
  }
});

/**
 * POST /api/admin/services
 * Create new service in SociaraX
 */
serviceRouter.post('/admin', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const {
      name,
      category,
      platform,
      description,
      minQuantity = 10,
      maxQuantity = 100000,
      providerId,
      providerServiceId,
      providerRate = 0,
      sellingRate,
      markupPercentage = 30,
      refill = false,
      cancel = false,
      averageTime = 'Instant - 1 Hour',
      status = 'active'
    } = req.body;

    if (!name || !category || !platform || sellingRate === undefined) {
      res.status(400).json({ success: false, error: 'Service name, category, platform, and selling rate are required.' });
      return;
    }

    const cleanSellingRate = parseFloat(sellingRate);
    const cleanProviderRate = parseFloat(providerRate) || 0;

    const insertRes = await db.query(`
      INSERT INTO services (
        name, category_name, platform, description, min_quantity, max_quantity,
        provider_id, provider_service_id, provider_rate, rate_per_1000, markup_percentage,
        refill_available, cancel_available, average_time, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, name, category_name, platform, rate_per_1000, status
    `, [
      name.trim(),
      category.trim(),
      platform.trim().toLowerCase(),
      description || '',
      parseInt(minQuantity, 10),
      parseInt(maxQuantity, 10),
      providerId ? parseInt(providerId, 10) : null,
      providerServiceId ? String(providerServiceId).trim() : null,
      cleanProviderRate,
      cleanSellingRate,
      parseFloat(markupPercentage) || 0,
      Boolean(refill),
      Boolean(cancel),
      averageTime || 'Instant',
      status || 'active'
    ]);

    res.json({ success: true, service: insertRes.rows[0], message: 'Service created successfully' });
  } catch (err: any) {
    console.error('[SERVICE CREATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to create service' });
  }
});

/**
 * PUT /api/admin/services/:id
 * Update existing service pricing, description, provider mapping, or status
 */
serviceRouter.put('/admin/:id', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ success: false, error: 'Invalid service ID' });
    return;
  }

  try {
    const {
      name,
      category,
      platform,
      description,
      minQuantity,
      maxQuantity,
      providerId,
      providerServiceId,
      providerRate,
      sellingRate,
      markupPercentage,
      refill,
      cancel,
      averageTime,
      status
    } = req.body;

    const currentRes = await db.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    if (currentRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    const current = currentRes.rows[0];

    const updated = await db.query(`
      UPDATE services
      SET 
        name = COALESCE($1, name),
        category_name = COALESCE($2, category_name),
        platform = COALESCE($3, platform),
        description = COALESCE($4, description),
        min_quantity = COALESCE($5, min_quantity),
        max_quantity = COALESCE($6, max_quantity),
        provider_id = $7,
        provider_service_id = $8,
        provider_rate = COALESCE($9, provider_rate),
        rate_per_1000 = COALESCE($10, rate_per_1000),
        markup_percentage = COALESCE($11, markup_percentage),
        refill_available = COALESCE($12, refill_available),
        cancel_available = COALESCE($13, cancel_available),
        average_time = COALESCE($14, average_time),
        status = COALESCE($15, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *
    `, [
      name !== undefined ? name.trim() : null,
      category !== undefined ? category.trim() : null,
      platform !== undefined ? platform.trim().toLowerCase() : null,
      description !== undefined ? description : null,
      minQuantity !== undefined ? parseInt(minQuantity, 10) : null,
      maxQuantity !== undefined ? parseInt(maxQuantity, 10) : null,
      providerId !== undefined ? (providerId ? parseInt(providerId, 10) : null) : current.provider_id,
      providerServiceId !== undefined ? (providerServiceId ? String(providerServiceId).trim() : null) : current.provider_service_id,
      providerRate !== undefined ? parseFloat(providerRate) : null,
      sellingRate !== undefined ? parseFloat(sellingRate) : null,
      markupPercentage !== undefined ? parseFloat(markupPercentage) : null,
      refill !== undefined ? Boolean(refill) : null,
      cancel !== undefined ? Boolean(cancel) : null,
      averageTime !== undefined ? averageTime : null,
      status !== undefined ? status : null,
      serviceId
    ]);

    res.json({ success: true, service: updated.rows[0], message: 'Service updated successfully' });
  } catch (err: any) {
    console.error('[SERVICE UPDATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

/**
 * DELETE /api/admin/services/:id
 * Remove a service from the database (Admin only)
 */
serviceRouter.delete('/admin/:id', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ success: false, error: 'Invalid service ID' });
    return;
  }

  try {
    const result = await db.query('DELETE FROM services WHERE id = $1 RETURNING id, name', [serviceId]);
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Service not found or already deleted' });
      return;
    }

    res.json({ 
      success: true, 
      message: `Service #${serviceId} (${result.rows[0].name}) was removed successfully.`,
      deletedId: serviceId
    });
  } catch (err: any) {
    console.error('[SERVICE DELETE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to delete service. It may be linked to existing orders.' });
  }
});

/**
 * PATCH /api/admin/services/:id/toggle-status
 * Toggle service active/inactive status (Admin only)
 */
serviceRouter.patch('/admin/:id/toggle-status', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const serviceId = parseInt(req.params.id, 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ success: false, error: 'Invalid service ID' });
    return;
  }

  try {
    const current = await db.query('SELECT id, status, name FROM services WHERE id = $1', [serviceId]);
    if (current.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    const newStatus = current.rows[0].status === 'active' ? 'inactive' : 'active';
    await db.query('UPDATE services SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, serviceId]);

    res.json({
      success: true,
      message: `Service #${serviceId} status changed to ${newStatus}.`,
      status: newStatus
    });
  } catch (err: any) {
    console.error('[SERVICE STATUS TOGGLE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle service status' });
  }
});

/**
 * POST /api/admin/services/sync
 * Admin: Synchronize services from provider API to Neon database
 * Checks existing IDs, updates rates/mappings, adds new services safely. NEVER drops or deletes.
 */
serviceRouter.post('/admin/sync', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

    const { providerId, defaultMarkupPct = 35, usdToInrRate } = req.body;

  try {
    const providerInfo = await providerRegistry.getActiveProvider(providerId ? parseInt(providerId, 10) : undefined);
    if (!providerInfo) {
      res.status(400).json({ 
        success: false, 
        error: 'No active provider configured. Please add an API Provider or check LUVSMM_API_KEY in environment.' 
      });
      return;
    }

    if (!providerInfo.apiKey) {
      res.status(400).json({
        success: false,
        error: `Provider "${providerInfo.name}" is missing an API Key. Please update it in API Providers.`
      });
      return;
    }

    // Get current USD to INR exchange rate from settings
    let usdRate = 88.0;
    if (usdToInrRate && !isNaN(parseFloat(usdToInrRate))) {
      usdRate = parseFloat(usdToInrRate);
    } else {
      const settingRes = await db.query("SELECT value FROM system_settings WHERE key = 'usd_to_inr_rate'");
      if (settingRes.rowCount && settingRes.rowCount > 0) {
        usdRate = parseFloat(settingRes.rows[0].value) || 88.0;
      }
    }

    console.log(`[SERVICE SYNC] Starting sync for provider "${providerInfo.name}" (${providerInfo.apiUrl}) with USD/INR rate = ₹${usdRate}...`);
    const providerResult = await providerInfo.adapter.getServices(providerInfo.apiUrl, providerInfo.apiKey);

    if (!providerResult.success || !providerResult.services || providerResult.services.length === 0) {
      res.status(400).json({
        success: false,
        error: providerResult.error || 'Failed to fetch services from provider'
      });
      return;
    }

    const fetchedServices = providerResult.services;
    const markupPct = Math.max(0, parseFloat(defaultMarkupPct) || 35);

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create temporary staging table for bulk operations
      await client.query(`
        CREATE TEMP TABLE tmp_services (
          provider_service_id text,
          name text,
          category_name text,
          platform text,
          description text,
          type text,
          min_quantity int,
          max_quantity int,
          provider_rate numeric,
          provider_rate_usd numeric,
          rate_per_1000 numeric,
          markup_percentage numeric,
          refill_available boolean,
          cancel_available boolean
        ) ON COMMIT DROP;
      `);

      // Prepare unnest arrays
      const provServiceIds: string[] = [];
      const names: string[] = [];
      const categories: string[] = [];
      const platforms: string[] = [];
      const descriptions: string[] = [];
      const types: string[] = [];
      const mins: number[] = [];
      const maxs: number[] = [];
      const provRates: number[] = [];
      const provRatesUsd: number[] = [];
      const sellingPrices: number[] = [];
      const markupPcts: number[] = [];
      const refills: boolean[] = [];
      const cancels: boolean[] = [];

      for (const item of fetchedServices) {
        const provServiceId = String(item.service).trim();
        const provRateUsd = parseFloat(String(item.rate)) || 0;
        const provRateInr = Number((provRateUsd * usdRate).toFixed(4));
        const sellingPrice = provRateInr > 0 ? Number((provRateInr * (1 + markupPct / 100)).toFixed(4)) : 10;
        const categoryName = item.category || 'General Services';

        // Detect platform from category or service name with exhaustive aliases
        const lowerName = `${item.name} ${categoryName}`.toLowerCase();
        let platform = 'other';
        if (lowerName.includes('instagram') || lowerName.includes('ig ') || lowerName.includes('ig_') || lowerName.includes('insta') || lowerName.includes('threads')) platform = 'instagram';
        else if (lowerName.includes('youtube') || lowerName.includes('yt ') || lowerName.includes('yt_') || lowerName.includes('shorts')) platform = 'youtube';
        else if (lowerName.includes('facebook') || lowerName.includes('fb ') || lowerName.includes('fb_')) platform = 'facebook';
        else if (lowerName.includes('telegram') || lowerName.includes('tg ') || lowerName.includes('tg_')) platform = 'telegram';
        else if (lowerName.includes('tiktok') || lowerName.includes('tik tok') || lowerName.includes('tt ')) platform = 'tiktok';
        else if (lowerName.includes('twitter') || lowerName.includes('tweet') || lowerName.includes('x.com') || lowerName.includes(' x ') || lowerName.includes('x post') || lowerName.includes('x follower')) platform = 'twitter';
        else if (lowerName.includes('snapchat') || lowerName.includes('snap ') || lowerName.includes('snap score') || lowerName.includes('spotlight')) platform = 'snapchat';
        else if (lowerName.includes('spotify') || lowerName.includes('podcast')) platform = 'spotify';
        else if (lowerName.includes('discord')) platform = 'discord';
        else if (lowerName.includes('linkedin')) platform = 'linkedin';
        else if (lowerName.includes('pinterest')) platform = 'pinterest';
        else if (lowerName.includes('twitch')) platform = 'twitch';
        else if (lowerName.includes('traffic') || lowerName.includes('website visitor')) platform = 'traffic';
        else if (lowerName.includes('google') || lowerName.includes('review') || lowerName.includes('play store')) platform = 'google';

        provServiceIds.push(provServiceId);
        names.push(item.name || '');
        categories.push(categoryName);
        platforms.push(platform);
        descriptions.push(item.description || (item as any).desc || '');
        types.push(item.type || 'Default');
        mins.push(parseInt(String(item.min), 10) || 10);
        maxs.push(parseInt(String(item.max), 10) || 100000);
        provRates.push(provRateInr);
        provRatesUsd.push(provRateUsd);
        sellingPrices.push(sellingPrice);
        markupPcts.push(markupPct);
        refills.push(Boolean(item.refill));
        cancels.push(Boolean(item.cancel));
      }

      // Populate temporary staging table in a single bulk unnest call
      await client.query(`
        INSERT INTO tmp_services (
          provider_service_id, name, category_name, platform, description,
          type, min_quantity, max_quantity, provider_rate, provider_rate_usd,
          rate_per_1000, markup_percentage, refill_available, cancel_available
        )
        SELECT * FROM UNNEST(
          $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
          $6::text[], $7::int[], $8::int[], $9::numeric[], $10::numeric[],
          $11::numeric[], $12::numeric[], $13::boolean[], $14::boolean[]
        );
      `, [
        provServiceIds, names, categories, platforms, descriptions,
        types, mins, maxs, provRates, provRatesUsd,
        sellingPrices, markupPcts, refills, cancels
      ]);

      // 1. Insert new services from upstream provider
      const insRes = await client.query(`
        INSERT INTO services (
          provider_id, provider_service_id, name, category_name, platform, description,
          type, min_quantity, max_quantity, provider_rate, provider_rate_usd,
          rate_per_1000, markup_percentage, refill_available, cancel_available, average_time, status
        )
        SELECT 
          $1, t.provider_service_id, t.name, t.category_name, t.platform, t.description,
          t.type, t.min_quantity, t.max_quantity, t.provider_rate, t.provider_rate_usd,
          t.rate_per_1000, t.markup_percentage, t.refill_available, t.cancel_available, 'Instant - 1 Hour', 'active'
        FROM tmp_services t
        WHERE NOT EXISTS (
          SELECT 1 FROM services s 
          WHERE s.provider_id = $1 AND s.provider_service_id = t.provider_service_id
        );
      `, [providerInfo.id]);

      // 2. Bulk update existing services with fresh rates, limits and details
      const updRes = await client.query(`
        UPDATE services s
        SET 
          name = t.name,
          category_name = t.category_name,
          platform = t.platform,
          description = t.description,
          type = t.type,
          min_quantity = t.min_quantity,
          max_quantity = t.max_quantity,
          provider_rate = t.provider_rate,
          provider_rate_usd = t.provider_rate_usd,
          rate_per_1000 = t.rate_per_1000,
          markup_percentage = t.markup_percentage,
          refill_available = t.refill_available,
          cancel_available = t.cancel_available,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        FROM tmp_services t
        WHERE s.provider_id = $1 AND s.provider_service_id = t.provider_service_id;
      `, [providerInfo.id]);

      // 3. Delete stale services that upstream removed and have no user orders
      const delRes = await client.query(`
        DELETE FROM services s
        WHERE s.provider_id = $1
          AND NOT EXISTS (SELECT 1 FROM tmp_services t WHERE t.provider_service_id = s.provider_service_id)
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.service_id = s.id);
      `, [providerInfo.id]);

      // 4. Deactivate stale services that upstream removed and have existing user orders (preserves FK constraints)
      const deactRes = await client.query(`
        UPDATE services s
        SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
        WHERE s.provider_id = $1
          AND NOT EXISTS (SELECT 1 FROM tmp_services t WHERE t.provider_service_id = s.provider_service_id)
          AND EXISTS (SELECT 1 FROM orders o WHERE o.service_id = s.id);
      `, [providerInfo.id]);

      // 5. Update provider last checked timestamp
      await client.query('UPDATE api_providers SET last_checked_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = $1', [providerInfo.id]);

      await client.query('COMMIT');

      const addedCount = insRes.rowCount || 0;
      const updatedCount = updRes.rowCount || 0;
      const deletedCount = delRes.rowCount || 0;
      const deactivatedCount = deactRes.rowCount || 0;

      const removalText = (deletedCount > 0 || deactivatedCount > 0)
        ? ` (${deletedCount} deleted upstream services removed, ${deactivatedCount} archived)`
        : '';

      res.json({
        success: true,
        message: `Sync completed: ${addedCount} new added, ${updatedCount} updated${removalText}. Current upstream total: ${fetchedServices.length}.`,
        stats: {
          totalFetched: fetchedServices.length,
          added: addedCount,
          updated: updatedCount,
          deleted: deletedCount,
          deactivated: deactivatedCount,
          usdToInrRate: usdRate,
          markupPct
        }
      });
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[SERVICE SYNC ERROR]:', err);
    res.status(500).json({ success: false, error: `Sync failed: ${err.message}` });
  }
});
