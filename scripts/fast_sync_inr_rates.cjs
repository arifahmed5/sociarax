const pg = require('pg');
const crypto = require('crypto');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

const ENCRYPTION_SECRET = process.env.TOTP_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'sociarax_default_master_encryption_key_2026';

function decryptSecret(encryptedPayload) {
  if (!encryptedPayload) return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return encryptedPayload;
    const [ivHex, authTagHex, encryptedText] = parts;
    const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '';
  }
}

async function fastSyncAll() {
  const c = await pool.connect();
  try {
    const provRes = await c.query('SELECT * FROM api_providers WHERE id = 1');
    const prov = provRes.rows[0];
    const apiKey = decryptSecret(prov.api_key_encrypted);

    const USD_TO_INR = 88.0;
    const MARKUP_PCT = 35.0;

    console.log('[FAST-SYNC] Fetching live services from LuvSMM API...');
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('action', 'services');
    const r = await fetch(prov.api_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const services = await r.json();
    console.log(`[FAST-SYNC] Fetched ${services.length} services from LuvSMM.`);

    await c.query('BEGIN');

    // Create temporary table
    await c.query(`
      CREATE TEMP TABLE tmp_luvsmm_sync (
        prov_service_id VARCHAR(50),
        name VARCHAR(500),
        category_name VARCHAR(255),
        platform VARCHAR(50),
        description TEXT,
        type VARCHAR(50),
        min_qty INT,
        max_qty INT,
        prov_rate_inr NUMERIC(14, 4),
        sell_rate_inr NUMERIC(14, 4),
        markup_pct NUMERIC(6, 2),
        refill BOOLEAN,
        cancel BOOLEAN
      ) ON COMMIT DROP;
    `);

    // Prepare rows for bulk insert into temp table
    const batchSize = 250;
    for (let i = 0; i < services.length; i += batchSize) {
      const chunk = services.slice(i, i + batchSize);
      const valueRows = [];
      const params = [];
      let pIdx = 1;

      for (const item of chunk) {
        const provServiceId = String(item.service);
        const provRateUsd = parseFloat(String(item.rate)) || 0;
        const provRateInr = Number((provRateUsd * USD_TO_INR).toFixed(4));
        const sellingPriceInr = Number((provRateInr * (1 + MARKUP_PCT / 100)).toFixed(4));
        const categoryName = item.category || 'General Services';

        const lowerName = `${item.name} ${categoryName}`.toLowerCase();
        let platform = 'other';
        if (lowerName.includes('instagram') || lowerName.includes('ig')) platform = 'instagram';
        else if (lowerName.includes('youtube') || lowerName.includes('yt')) platform = 'youtube';
        else if (lowerName.includes('facebook') || lowerName.includes('fb')) platform = 'facebook';
        else if (lowerName.includes('telegram') || lowerName.includes('tg')) platform = 'telegram';
        else if (lowerName.includes('tiktok') || lowerName.includes('tt')) platform = 'tiktok';
        else if (lowerName.includes('twitter') || lowerName.includes('x.com')) platform = 'twitter';
        else if (lowerName.includes('spotify')) platform = 'spotify';
        else if (lowerName.includes('discord')) platform = 'discord';
        else if (lowerName.includes('threads')) platform = 'threads';
        else if (lowerName.includes('linkedin')) platform = 'linkedin';

        valueRows.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12})`);
        params.push(
          provServiceId,
          item.name,
          categoryName,
          platform,
          item.description || item.desc || '',
          item.type || 'Default',
          parseInt(String(item.min), 10) || 10,
          parseInt(String(item.max), 10) || 100000,
          provRateInr,
          sellingPriceInr,
          MARKUP_PCT,
          Boolean(item.refill),
          Boolean(item.cancel)
        );
        pIdx += 13;
      }

      await c.query(`
        INSERT INTO tmp_luvsmm_sync (
          prov_service_id, name, category_name, platform, description, type,
          min_qty, max_qty, prov_rate_inr, sell_rate_inr, markup_pct, refill, cancel
        ) VALUES ${valueRows.join(', ')}
      `, params);
    }

    // 1. Bulk Update existing services matched by provider_service_id
    const updateResult = await c.query(`
      UPDATE services s
      SET
        name = t.name,
        category_name = t.category_name,
        platform = t.platform,
        provider_rate = t.prov_rate_inr,
        rate_per_1000 = t.sell_rate_inr,
        markup_percentage = t.markup_pct,
        min_quantity = t.min_qty,
        max_quantity = t.max_qty,
        refill_available = t.refill,
        cancel_available = t.cancel,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      FROM tmp_luvsmm_sync t
      WHERE s.provider_id = 1 AND s.provider_service_id = t.prov_service_id
    `);

    // 2. Bulk Insert any new services
    const insertResult = await c.query(`
      INSERT INTO services (
        category_name, platform, name, description, type,
        min_quantity, max_quantity, provider_id, provider_service_id,
        provider_rate, rate_per_1000, markup_percentage,
        refill_available, cancel_available, average_time, status
      )
      SELECT 
        t.category_name, t.platform, t.name, t.description, t.type,
        t.min_qty, t.max_qty, 1, t.prov_service_id,
        t.prov_rate_inr, t.sell_rate_inr, t.markup_pct,
        t.refill, t.cancel, 'Instant - 1 Hour', 'active'
      FROM tmp_luvsmm_sync t
      WHERE NOT EXISTS (
        SELECT 1 FROM services s WHERE s.provider_id = 1 AND s.provider_service_id = t.prov_service_id
      )
    `);

    // Update system settings
    await c.query("INSERT INTO system_settings (key, value, updated_at) VALUES ('usd_to_inr_rate', '88.0', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = '88.0'");
    await c.query("INSERT INTO system_settings (key, value, updated_at) VALUES ('default_markup_percentage', '35.0', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = '35.0'");

    await c.query('COMMIT');

    console.log(`[FAST-SYNC SUCCESS] Updated: ${updateResult.rowCount}, Inserted: ${insertResult.rowCount}`);

    const check = await c.query("SELECT id, name, provider_service_id, provider_rate, rate_per_1000, markup_percentage FROM services WHERE provider_service_id = '1526'");
    console.log('[FAST-SYNC] Sample updated #1526:', check.rows[0]);

  } catch (err) {
    await c.query('ROLLBACK');
    console.error('[FAST-SYNC ERROR]:', err);
  } finally {
    c.release();
    await pool.end();
  }
}

fastSyncAll();
