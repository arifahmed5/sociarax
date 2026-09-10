import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';
import { encryptSecret, decryptSecret } from '../totp';
import { providerRegistry } from '../providers/providerRegistry';
import { getLiveUsdToInrRate } from '../services/liveExchangeRate';

export const providerRouter = Router();

/**
 * GET /api/admin/providers/live-balance
 * Live-checks balance directly from upstream providers (e.g. LuvSMM) and converts to INR based on current live exchange rate
 */
providerRouter.get('/live-balance', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // 1. Get current live USD to INR exchange rate from live exchange-rate API
    const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'usd_to_inr_rate'");
    const fallbackRate = settingsRes.rowCount && settingsRes.rows[0].value ? parseFloat(settingsRes.rows[0].value) : 89.5;
    const liveRateObj = await getLiveUsdToInrRate(fallbackRate);
    const liveExchangeRate = liveRateObj.rate;

    // 2. Fetch active providers
    const provRes = await db.query('SELECT * FROM api_providers WHERE status = $1 ORDER BY priority ASC, id ASC', ['active']);
    if (provRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'No active API provider configured' });
      return;
    }

    const providerList: any[] = [];
    let primarySuccessResult: any = null;
    let primaryError: string | null = null;
    let totalInr = 0;

    for (const prov of provRes.rows) {
      try {
        const apiKey = decryptSecret(prov.api_key_encrypted);
        if (!apiKey) {
          throw new Error('API key could not be decrypted or is missing');
        }

        const adapter = providerRegistry.getAdapter(prov.adapter_type);
        if (!adapter) {
          throw new Error(`No adapter found for provider type: ${prov.adapter_type}`);
        }

        // Live call to LuvSMM API: action = "balance"
        const balResult = await adapter.getBalance(prov.api_url, apiKey);

        if (!balResult.success || balResult.balance === undefined || !Number.isFinite(balResult.balance) || balResult.balance < 0) {
          const errMsg = balResult.error || 'Invalid or malformed balance data returned by provider';
          await db.query(`
            UPDATE api_providers 
            SET last_checked_at = CURRENT_TIMESTAMP, last_error = $1 
            WHERE id = $2
          `, [errMsg, prov.id]);

          if (!primaryError) primaryError = errMsg;

          providerList.push({
            id: prov.id,
            name: prov.name,
            adapterType: prov.adapter_type,
            apiUrl: prov.api_url,
            maskedKey: prov.masked_key,
            status: prov.status,
            rawBalance: null,
            rawBalanceString: null,
            currency: prov.currency || 'USD',
            inrEquivalent: null,
            lastCheckedAt: prov.last_checked_at,
            fetchSuccess: false,
            lastError: errMsg
          });
          continue;
        }

        // Exact values from LuvSMM API
        const rawBalance = balResult.balance;
        const rawBalanceString = balResult.rawBalanceString || String(rawBalance);
        const providerCurrency = (balResult.currency || 'USD').toUpperCase();

        // Calculate converted INR display value using LIVE exchange rate
        const isUsd = providerCurrency === 'USD' || providerCurrency === '$';
        const inrEquivalent = isUsd ? (rawBalance * liveExchangeRate) : rawBalance;
        totalInr += inrEquivalent;

        // Persist the real live balance and currency in DB for records
        await db.query(`
          UPDATE api_providers 
          SET balance = $1, currency = $2, last_checked_at = CURRENT_TIMESTAMP, last_error = NULL 
          WHERE id = $3
        `, [rawBalanceString, providerCurrency, prov.id]);

        const provItem = {
          id: prov.id,
          name: prov.name,
          adapterType: prov.adapter_type,
          apiUrl: prov.api_url,
          maskedKey: prov.masked_key,
          status: prov.status,
          rawBalance,
          rawBalanceString,
          currency: providerCurrency,
          inrEquivalent,
          lastCheckedAt: new Date().toISOString(),
          fetchSuccess: true
        };

        providerList.push(provItem);
        if (!primarySuccessResult) {
          primarySuccessResult = provItem;
        }
      } catch (pErr: any) {
        console.warn(`[PROVIDER LIVE BALANCE FETCH ERROR for ${prov.name}]:`, pErr.message);
        await db.query(`
          UPDATE api_providers 
          SET last_checked_at = CURRENT_TIMESTAMP, last_error = $1 
          WHERE id = $2
        `, [pErr.message, prov.id]);

        if (!primaryError) primaryError = pErr.message;

        providerList.push({
          id: prov.id,
          name: prov.name,
          adapterType: prov.adapter_type,
          apiUrl: prov.api_url,
          maskedKey: prov.masked_key,
          status: prov.status,
          rawBalance: null,
          rawBalanceString: null,
          currency: prov.currency || 'USD',
          inrEquivalent: null,
          lastCheckedAt: prov.last_checked_at,
          fetchSuccess: false,
          lastError: pErr.message
        });
      }
    }

    if (!primarySuccessResult) {
      res.status(502).json({
        success: false,
        fetchSuccess: false,
        error: `Unable to fetch live LuvSMM balance: ${primaryError || 'Provider API unreachable'}`,
        lastCheckedAt: provRes.rows[0]?.last_checked_at || null,
        providers: providerList
      });
      return;
    }

    res.json({
      success: true,
      fetchSuccess: true,
      providerName: primarySuccessResult.name,
      rawBalance: primarySuccessResult.rawBalance,
      rawBalanceString: primarySuccessResult.rawBalanceString,
      rawPrimaryBalance: primarySuccessResult.rawBalance,
      rawPrimaryBalanceString: primarySuccessResult.rawBalanceString,
      currency: primarySuccessResult.currency,
      rawPrimaryCurrency: primarySuccessResult.currency,
      inrEquivalent: primarySuccessResult.inrEquivalent,
      totalInrBalance: totalInr,
      totalLiveBalanceInr: totalInr,
      totalInrString: primarySuccessResult.rawBalanceString,
      totalLiveBalanceUsd: primarySuccessResult.currency === 'USD' ? primarySuccessResult.rawBalance : (totalInr / liveExchangeRate),
      usdToInrRate: liveExchangeRate,
      exchangeRate: liveExchangeRate,
      rateSource: liveRateObj.source,
      rateFetchedAt: liveRateObj.fetchedAt,
      isLiveRate: liveRateObj.isLive,
      lastCheckedAt: primarySuccessResult.lastCheckedAt,
      primaryProvider: primarySuccessResult,
      providers: providerList
    });
  } catch (err: any) {
    console.error('[LIVE PROVIDER BALANCE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve live provider balance: ' + err.message });
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
    const liveRateObj = await getLiveUsdToInrRate();
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
      liveExchangeRate: liveRateObj.rate,
      rateSource: liveRateObj.source,
      providers: result.rows.map(row => {
        const rawBal = parseFloat(row.balance || '0');
        const curr = (row.currency || 'USD').toUpperCase();
        const inrEquiv = curr === 'USD' ? (rawBal * liveRateObj.rate) : rawBal;
        return {
          id: row.id,
          name: row.name,
          adapterType: row.adapter_type,
          apiUrl: row.api_url,
          maskedKey: row.masked_key,
          status: row.status,
          balance: rawBal,
          rawBalanceString: row.balance !== null && row.balance !== undefined ? String(row.balance) : '0',
          currency: curr,
          inrEquivalent: inrEquiv,
          priority: row.priority,
          lastCheckedAt: row.last_checked_at,
          lastError: row.last_error,
          createdAt: row.created_at
        };
      })
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
  const { name, adapterType = 'luvsmm', apiUrl, apiKey, priority = 1, currency = 'INR' } = req.body;

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
        name, adapter_type, api_url, api_key_encrypted, masked_key, status, priority, currency
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      RETURNING id, name, adapter_type, api_url, masked_key, status, priority, currency, balance, created_at
    `, [
      name.trim(),
      adapterType.trim().toLowerCase(),
      apiUrl.trim(),
      encrypted,
      masked,
      parseInt(String(priority), 10) || 1,
      String(currency).trim().toUpperCase() === 'USD' ? 'USD' : 'INR'
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

  const { name, adapterType, apiUrl, apiKey, status, priority, currency } = req.body;

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
    if (currency) {
      params.push(String(currency).trim().toUpperCase() === 'USD' ? 'USD' : 'INR');
      updateKeyClause += `, currency = $${params.length}`;
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
      RETURNING id, name, adapter_type, api_url, masked_key, status, priority, currency, balance
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

    if (testResult.success && testResult.balance !== undefined && Number.isFinite(testResult.balance)) {
      const balToStore = testResult.rawBalanceString || String(testResult.balance);
      const provCurrency = (testResult.currency || 'USD').toUpperCase();

      await db.query(`
        UPDATE api_providers 
        SET 
          balance = $1::NUMERIC,
          currency = $2,
          last_checked_at = CURRENT_TIMESTAMP,
          last_error = NULL
        WHERE id = $3
      `, [balToStore, provCurrency, providerId]);

      const liveRateObj = await getLiveUsdToInrRate();
      const inrEquiv = provCurrency === 'USD' ? (testResult.balance * liveRateObj.rate) : testResult.balance;
      const curSymbol = provCurrency === 'USD' ? '$' : '₹';
      const balDisplay = testResult.rawBalanceString || String(testResult.balance);
      const customMessage = `Connection successful! Provider balance: ${curSymbol}${balDisplay} ${provCurrency} (≈ ₹${inrEquiv.toFixed(2)} INR at live rate ₹${liveRateObj.rate.toFixed(2)}/$)`;

      res.json({
        success: true,
        message: customMessage,
        balance: testResult.balance,
        rawBalanceString: testResult.rawBalanceString,
        currency: provCurrency,
        inrEquivalent: inrEquiv,
        liveExchangeRate: liveRateObj.rate
      });
    } else {
      const errMsg = testResult.message || 'Connection test failed with provider';
      await db.query(`
        UPDATE api_providers 
        SET 
          last_checked_at = CURRENT_TIMESTAMP,
          last_error = $1
        WHERE id = $2
      `, [errMsg, providerId]);

      res.status(400).json({
        success: false,
        error: errMsg
      });
    }
  } catch (err: any) {
    console.error('[TEST PROVIDER ERROR]:', err);
    res.status(500).json({ success: false, error: `Connection test failed: ${err.message}` });
  }
});
