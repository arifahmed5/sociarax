import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';
import { encryptSecret, decryptSecret } from '../totp';
import { providerRegistry } from '../providers/providerRegistry';

export const providerRouter = Router();

/**
 * GET /api/admin/providers/live-balance
 * Live-checks balance directly from upstream providers (e.g. LuvSMM) and converts to INR based on usd_to_inr_rate
 */
providerRouter.get('/live-balance', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Get exchange rate from system_settings
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'usd_to_inr_rate'");
    const usdToInrRate = settingsRes.rowCount && settingsRes.rows[0].value ? parseFloat(settingsRes.rows[0].value) : 88.0;

    const provRes = await db.query('SELECT * FROM api_providers WHERE status = $1 ORDER BY priority ASC, id ASC', ['active']);
    const providerList: any[] = [];
    let totalInr = 0;

    for (const prov of provRes.rows) {
      try {
        const apiKey = decryptSecret(prov.api_key_encrypted);
        const adapter = providerRegistry.getAdapter(prov.adapter_type);
        const balResult = await adapter.getBalance(prov.api_url, apiKey);
        
        let liveBalance = parseFloat(prov.balance || '0');
        let currency = prov.currency || 'USD';

        if (balResult.success && balResult.balance !== undefined) {
          liveBalance = balResult.balance;
          currency = balResult.currency || 'USD';

          await db.query(`
            UPDATE api_providers 
            SET balance = $1, currency = $2, last_checked_at = CURRENT_TIMESTAMP, last_error = NULL 
            WHERE id = $3
          `, [liveBalance, currency, prov.id]);
        }

        const isUsd = currency.toUpperCase() === 'USD' || currency === '$';
        const inrEquivalent = isUsd ? parseFloat((liveBalance * usdToInrRate).toFixed(2)) : liveBalance;
        totalInr += inrEquivalent;

        providerList.push({
          id: prov.id,
          name: prov.name,
          adapterType: prov.adapter_type,
          apiUrl: prov.api_url,
          maskedKey: prov.masked_key,
          status: prov.status,
          rawBalance: liveBalance,
          currency: currency.toUpperCase(),
          inrEquivalent,
          lastCheckedAt: new Date().toISOString()
        });
      } catch (pErr: any) {
        console.warn(`[PROVIDER LIVE BALANCE FETCH ERROR for ${prov.name}]:`, pErr.message);
        const liveBalance = parseFloat(prov.balance || '0');
        const currency = prov.currency || 'USD';
        const isUsd = currency.toUpperCase() === 'USD' || currency === '$';
        const inrEquivalent = isUsd ? parseFloat((liveBalance * usdToInrRate).toFixed(2)) : liveBalance;
        totalInr += inrEquivalent;

        providerList.push({
          id: prov.id,
          name: prov.name,
          adapterType: prov.adapter_type,
          apiUrl: prov.api_url,
          maskedKey: prov.masked_key,
          status: prov.status,
          rawBalance: liveBalance,
          currency: currency.toUpperCase(),
          inrEquivalent,
          lastCheckedAt: prov.last_checked_at,
          lastError: pErr.message
        });
      }
    }

    const primaryProv = providerList[0] || null;
    const primaryRawBal = primaryProv ? (primaryProv.rawBalance || 0) : 0;
    const primaryCurrency = primaryProv ? (primaryProv.currency || 'USD') : 'USD';
    const totalUsd = primaryCurrency === 'USD' ? primaryRawBal : (totalInr / usdToInrRate);

    res.json({
      success: true,
      providers: providerList,
      totalInrBalance: parseFloat(totalInr.toFixed(2)),
      totalLiveBalanceInr: parseFloat(totalInr.toFixed(2)),
      totalLiveBalanceUsd: parseFloat(totalUsd.toFixed(2)),
      rawPrimaryBalance: primaryRawBal,
      rawPrimaryCurrency: primaryCurrency,
      usdToInrRate,
      primaryProvider: primaryProv
    });
  } catch (err: any) {
    console.error('[LIVE PROVIDER BALANCE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve live provider balance' });
  }
});

/**
 * GET /api/admin/providers
 * List all configured API providers with masked keys (e.g. ••••••••••••1234)
 */
providerRouter.get('/', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(`
      SELECT 
        id, 
        name, 
        adapter_type, 
        api_url, 
        masked_key, 
        status, 
        balance, 
        currency, 
        priority, 
        last_checked_at, 
        last_error, 
        created_at
      FROM api_providers
      ORDER BY priority ASC, id ASC
    `);

    res.json({
      success: true,
      providers: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        adapterType: row.adapter_type,
        apiUrl: row.api_url,
        maskedKey: row.masked_key,
        status: row.status,
        balance: parseFloat(row.balance || '0'),
        currency: row.currency || 'USD',
        priority: row.priority,
        lastCheckedAt: row.last_checked_at,
        lastError: row.last_error,
        createdAt: row.created_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN PROVIDERS FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve providers' });
  }
});

/**
 * POST /api/admin/providers
 * Add a new SMM API Provider (e.g. Luvsmm, SMM Provider B)
 */
providerRouter.post('/', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, adapterType = 'luvsmm', apiUrl, apiKey, priority = 1 } = req.body;

  if (!name || !apiUrl || !apiKey) {
    res.status(400).json({ success: false, error: 'Provider name, API URL, and API Key are required.' });
    return;
  }

  const cleanKey = String(apiKey).trim();
  const masked = cleanKey.length > 4 ? `••••••••••••${cleanKey.slice(-4)}` : '••••••••••••';
  const encrypted = encryptSecret(cleanKey);

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const insertRes = await db.query(`
      INSERT INTO api_providers (
        name, adapter_type, api_url, api_key_encrypted, masked_key, status, priority
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id, name, adapter_type, api_url, masked_key, status, priority, created_at
    `, [
      name.trim(),
      adapterType.trim().toLowerCase(),
      apiUrl.trim(),
      encrypted,
      masked,
      parseInt(String(priority), 10) || 1
    ]);

    res.json({
      success: true,
      provider: insertRes.rows[0],
      message: 'API Provider added successfully'
    });
  } catch (err: any) {
    console.error('[ADD PROVIDER ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to add provider' });
  }
});

/**
 * PUT /api/admin/providers/:id
 * Edit existing provider configuration
 */
providerRouter.put('/:id', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const providerId = parseInt(req.params.id, 10);
  if (isNaN(providerId)) {
    res.status(400).json({ success: false, error: 'Invalid provider ID' });
    return;
  }

  const { name, adapterType, apiUrl, apiKey, status, priority } = req.body;

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    let updateKeyClause = '';
    const params: any[] = [providerId];

    if (name) {
      params.push(name.trim());
      updateKeyClause += `, name = $${params.length}`;
    }
    if (adapterType) {
      params.push(adapterType.trim().toLowerCase());
      updateKeyClause += `, adapter_type = $${params.length}`;
    }
    if (apiUrl) {
      params.push(apiUrl.trim());
      updateKeyClause += `, api_url = $${params.length}`;
    }
    if (status) {
      params.push(status);
      updateKeyClause += `, status = $${params.length}`;
    }
    if (priority !== undefined) {
      params.push(parseInt(String(priority), 10) || 1);
      updateKeyClause += `, priority = $${params.length}`;
    }
    if (apiKey && String(apiKey).trim().length > 0 && !String(apiKey).includes('••••')) {
      const cleanKey = String(apiKey).trim();
      const masked = cleanKey.length > 4 ? `••••••••••••${cleanKey.slice(-4)}` : '••••••••••••';
      const encrypted = encryptSecret(cleanKey);

      params.push(encrypted);
      updateKeyClause += `, api_key_encrypted = $${params.length}`;

      params.push(masked);
      updateKeyClause += `, masked_key = $${params.length}`;
    }

    const query = `
      UPDATE api_providers
      SET updated_at = CURRENT_TIMESTAMP ${updateKeyClause}
      WHERE id = $1
      RETURNING id, name, adapter_type, api_url, masked_key, status, priority
    `;

    const result = await db.query(query, params);
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Provider not found' });
      return;
    }

    res.json({ success: true, provider: result.rows[0], message: 'Provider updated successfully' });
  } catch (err: any) {
    console.error('[UPDATE PROVIDER ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update provider' });
  }
});

/**
 * POST /api/admin/providers/:id/test
 * Test provider connection and update live balance
 */
providerRouter.post('/:id/test', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const providerId = parseInt(req.params.id, 10);
  if (isNaN(providerId)) {
    res.status(400).json({ success: false, error: 'Invalid provider ID' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const provRes = await db.query('SELECT * FROM api_providers WHERE id = $1', [providerId]);
    if (provRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Provider not found' });
      return;
    }

    const prov = provRes.rows[0];
    const apiKey = decryptSecret(prov.api_key_encrypted);
    const adapter = providerRegistry.getAdapter(prov.adapter_type);

    const testResult = await adapter.testConnection(prov.api_url, apiKey);

    if (testResult.success) {
      await db.query(`
        UPDATE api_providers 
        SET 
          balance = COALESCE($1, balance),
          last_checked_at = CURRENT_TIMESTAMP,
          last_error = NULL
        WHERE id = $2
      `, [testResult.balance !== undefined ? testResult.balance : null, providerId]);

      res.json({
        success: true,
        message: testResult.message,
        balance: testResult.balance
      });
    } else {
      await db.query(`
        UPDATE api_providers 
        SET 
          last_checked_at = CURRENT_TIMESTAMP,
          last_error = $1
        WHERE id = $2
      `, [testResult.message, providerId]);

      res.status(400).json({
        success: false,
        error: testResult.message
      });
    }
  } catch (err: any) {
    console.error('[TEST PROVIDER ERROR]:', err);
    res.status(500).json({ success: false, error: `Connection test failed: ${err.message}` });
  }
});
