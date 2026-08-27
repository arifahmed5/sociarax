const pg = require('pg');
const https = require('https');

function detectPlatform(categoryName, serviceName) {
  const text = ((categoryName || '') + ' ' + (serviceName || '')).toLowerCase();
  if (text.includes('instagram') || text.includes('ig ') || text.includes('threads')) return 'instagram';
  if (text.includes('youtube') || text.includes('yt ')) return 'youtube';
  if (text.includes('telegram') || text.includes('tg ')) return 'telegram';
  if (text.includes('spotify')) return 'spotify';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('facebook') || text.includes('fb ')) return 'facebook';
  if (text.includes('twitter') || text.includes(' x ') || text.includes('tweet') || text.includes('(x)')) return 'twitter';
  if (text.includes('snapchat') || text.includes('snap ')) return 'snapchat';
  if (text.includes('discord')) return 'discord';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('pinterest')) return 'pinterest';
  if (text.includes('twitch')) return 'twitch';
  if (text.includes('traffic') || text.includes('website') || text.includes('visitor')) return 'traffic';
  if (text.includes('google') || text.includes('reviews') || text.includes('maps')) return 'google';
  return 'other';
}

async function fetchLuvsmmServices() {
  const url = process.env.LUVSMM_API_URL || 'https://luvsmm.com/api/v2';
  const key = process.env.LUVSMM_API_KEY;
  if (!key) return [];
  const body = new URLSearchParams({ key, action: 'services' }).toString();
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { 
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch(e) { 
          resolve([]); 
        }
      });
    });
    req.on('error', () => resolve([]));
    req.write(body);
    req.end();
  });
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found.');
    return;
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('[MIGRATION] Fetching provider services from LUVSMM API...');
    const luvServices = await fetchLuvsmmServices();
    console.log(`[MIGRATION] Received ${luvServices.length} services from LUVSMM API.`);

    const luvMap = new Map();
    for (const ls of luvServices) {
      luvMap.set(String(ls.name).trim().toLowerCase(), ls);
      luvMap.set(String(ls.service), ls);
    }

    // Get provider ID
    const provRes = await client.query('SELECT id FROM api_providers LIMIT 1');
    const providerId = provRes.rows.length > 0 ? provRes.rows[0].id : 1;

    // Fetch raw services from "Service" table (Neon source)
    const rawServicesRes = await client.query(`
      SELECT s.id as old_id, s.name, s.description, s."minQuantity", s."maxQuantity", s.price, s."avgTime", s.active, s."providerId", c.name as category_name
      FROM "Service" s
      LEFT JOIN "Category" c ON s."categoryId" = c.id
      ORDER BY s.id ASC
    `);

    const rawServices = rawServicesRes.rows;
    console.log(`[MIGRATION] Found ${rawServices.length} raw services in "Service" table.`);

    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE services RESTART IDENTITY CASCADE');

    for (let i = 0; i < rawServices.length; i++) {
      const s = rawServices[i];
      const categoryName = s.category_name || 'General';
      const platform = detectPlatform(categoryName, s.name);
      const normName = String(s.name || '').trim().toLowerCase();
      const luv = luvMap.get(normName);

      const providerServiceId = luv ? String(luv.service) : (s.providerId ? String(s.providerId) : null);
      const providerRateUSD = luv ? parseFloat(luv.rate) || 0 : 0;
      const providerRate = providerRateUSD > 0 ? parseFloat((providerRateUSD * 86).toFixed(4)) : 0;
      const sellingRate = s.price && s.price > 0 ? parseFloat(s.price) : (providerRate > 0 ? parseFloat((providerRate * 1.35).toFixed(4)) : 50);
      const markupPercentage = providerRate > 0 ? parseFloat((((sellingRate - providerRate) / providerRate) * 100).toFixed(2)) : 35.00;
      
      const minQty = s.minQuantity || (luv ? parseInt(luv.min, 10) : 10);
      const maxQty = s.maxQuantity || (luv ? parseInt(luv.max, 10) : 100000);
      const refillAvailable = luv ? Boolean(luv.refill) : (normName.includes('refill') || normName.includes('♻️'));
      const cancelAvailable = luv ? Boolean(luv.cancel) : false;
      const dripfeedAvailable = luv ? Boolean(luv.dripfeed) : false;
      const avgTime = s.avgTime || 'Instant - 1 hour';
      const status = s.active !== false ? 'active' : 'inactive';
      const serviceType = luv ? luv.type : 'Default';

      await client.query(`
        INSERT INTO services (
          name, category_name, platform, description, type,
          min_quantity, max_quantity, provider_id, provider_service_id,
          provider_rate, rate_per_1000, markup_percentage, markup_fixed,
          refill_available, cancel_available, dripfeed_available,
          average_time, status, display_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, $14, $15, $16, $17, $18
        )
      `, [
        s.name, categoryName, platform, s.description || '', serviceType,
        minQty, maxQty, providerId, providerServiceId,
        providerRate, sellingRate, markupPercentage,
        refillAvailable, cancelAvailable, dripfeedAvailable,
        avgTime, status, i + 1
      ]);
    }

    // Populate service_categories
    await client.query('TRUNCATE TABLE service_categories RESTART IDENTITY CASCADE');
    const distinctCats = await client.query(`
      SELECT DISTINCT category_name, platform 
      FROM services 
      ORDER BY category_name ASC
    `);

    for (let i = 0; i < distinctCats.rows.length; i++) {
      const c = distinctCats.rows[i];
      await client.query(`
        INSERT INTO service_categories (name, platform, display_order, status)
        VALUES ($1, $2, $3, 'active')
      `, [c.category_name, c.platform, i + 1]);
    }

    await client.query('COMMIT');
    console.log(`[MIGRATION COMPLETE] Successfully migrated ${rawServices.length} services and ${distinctCats.rows.length} categories.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[MIGRATION ERROR]:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
