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

async function syncAllLuvsmmServices() {
  const c = await pool.connect();
  try {
    const provRes = await c.query('SELECT * FROM api_providers WHERE id = 1');
    const prov = provRes.rows[0];
    const apiKey = decryptSecret(prov.api_key_encrypted);

    const USD_TO_INR = 88.0;
    const MARKUP_PCT = 35.0;

    console.log('[SYNC] Fetching live services from LuvSMM API...');
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('action', 'services');
    const r = await fetch(prov.api_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const services = await r.json();
    console.log(`[SYNC] Fetched ${services.length} services from LuvSMM.`);

    await c.query('BEGIN');
    
    // Set system setting for usd_to_inr_rate
    await c.query("INSERT INTO system_settings (key, value, updated_at) VALUES ('usd_to_inr_rate', '88.0', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = '88.0'");
    await c.query("INSERT INTO system_settings (key, value, updated_at) VALUES ('default_markup_percentage', '35.0', CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = '35.0'");

    let updated = 0;
    let inserted = 0;

    for (const item of services) {
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

      const existing = await c.query(
        'SELECT id FROM services WHERE provider_id = $1 AND provider_service_id = $2',
        [prov.id, provServiceId]
      );

      if (existing.rowCount > 0) {
        await c.query(`
          UPDATE services
          SET
            name = $1,
            category_name = $2,
            platform = $3,
            provider_rate = $4,
            rate_per_1000 = $5,
            markup_percentage = $6,
            min_quantity = $7,
            max_quantity = $8,
            refill_available = $9,
            cancel_available = $10,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $11
        `, [
          item.name,
          categoryName,
          platform,
          provRateInr,
          sellingPriceInr,
          MARKUP_PCT,
          parseInt(String(item.min), 10) || 10,
          parseInt(String(item.max), 10) || 100000,
          Boolean(item.refill),
          Boolean(item.cancel),
          existing.rows[0].id
        ]);
        updated++;
      } else {
        await c.query(`
          INSERT INTO services (
            category_name, platform, name, description, type,
            min_quantity, max_quantity, provider_id, provider_service_id,
            provider_rate, rate_per_1000, markup_percentage,
            refill_available, cancel_available, average_time, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')
        `, [
          categoryName,
          platform,
          item.name,
          item.description || item.desc || '',
          item.type || 'Default',
          parseInt(String(item.min), 10) || 10,
          parseInt(String(item.max), 10) || 100000,
          prov.id,
          provServiceId,
          provRateInr,
          sellingPriceInr,
          MARKUP_PCT,
          Boolean(item.refill),
          Boolean(item.cancel),
          'Instant - 1 Hour'
        ]);
        inserted++;
      }
    }

    await c.query('COMMIT');
    console.log(`[SYNC] SUCCESS! Updated: ${updated}, Inserted: ${inserted}`);

    const sample = await c.query("SELECT id, name, provider_service_id, provider_rate, rate_per_1000, markup_percentage FROM services WHERE provider_service_id = '1526'");
    console.log('[SYNC] Sample verified service #1526:', sample.rows[0]);
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('[SYNC ERROR]:', err);
  } finally {
    c.release();
    await pool.end();
  }
}

syncAllLuvsmmServices();
