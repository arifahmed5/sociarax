const pg = require('pg');

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('1. Checking source table "Service"...');
    const sourceCount = await client.query('SELECT COUNT(*) as c FROM "Service"');
    console.log('Source count in "Service":', sourceCount.rows[0].c);

    console.log('2. Truncating both tables...');
    await client.query('TRUNCATE TABLE service_categories, services RESTART IDENTITY CASCADE');

    console.log('3. Inserting services from "Service"...');
    const insertServices = await client.query(`
      INSERT INTO services (
        name,
        category_name,
        platform,
        description,
        type,
        min_quantity,
        max_quantity,
        provider_id,
        provider_service_id,
        provider_rate,
        rate_per_1000,
        markup_percentage,
        markup_fixed,
        refill_available,
        cancel_available,
        dripfeed_available,
        average_time,
        status,
        display_order
      )
      SELECT
        s.name,
        COALESCE(c.name, 'General') as category_name,
        CASE
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%instagram%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%ig %' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%threads%' THEN 'instagram'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%youtube%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%yt %' THEN 'youtube'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%telegram%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tg %' THEN 'telegram'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%spotify%' THEN 'spotify'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tiktok%' THEN 'tiktok'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%facebook%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%fb %' THEN 'facebook'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%twitter%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tweet%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '% x %' THEN 'twitter'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%snapchat%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%snap %' THEN 'snapchat'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%discord%' THEN 'discord'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%linkedin%' THEN 'linkedin'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%pinterest%' THEN 'pinterest'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%twitch%' THEN 'twitch'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%traffic%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%website%' THEN 'traffic'
          WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%google%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%reviews%' THEN 'google'
          ELSE 'other'
        END as platform,
        COALESCE(s.description, '') as description,
        'Default' as type,
        COALESCE(s."minQuantity", 10) as min_quantity,
        COALESCE(s."maxQuantity", 100000) as max_quantity,
        (SELECT id FROM api_providers LIMIT 1) as provider_id,
        CAST(s."providerId" AS VARCHAR) as provider_service_id,
        COALESCE(s.price * 0.75, 0) as provider_rate,
        COALESCE(s.price, 50) as rate_per_1000,
        35.00 as markup_percentage,
        0 as markup_fixed,
        (LOWER(s.name) LIKE '%refill%' OR s.name LIKE '%♻️%') as refill_available,
        false as cancel_available,
        false as dripfeed_available,
        COALESCE(s."avgTime", 'Instant - 1 hour') as average_time,
        CASE WHEN s.active = false THEN 'inactive' ELSE 'active' END as status,
        ROW_NUMBER() OVER (ORDER BY s.id ASC) as display_order
      FROM "Service" s
      LEFT JOIN "Category" c ON s."categoryId" = c.id
      ORDER BY s.id ASC
    `);
    console.log('Inserted services count:', insertServices.rowCount);

    console.log('4. Populating service_categories table...');
    const insertCategories = await client.query(`
      INSERT INTO service_categories (name, platform, display_order, status)
      SELECT 
        category_name as name,
        MAX(platform) as platform,
        ROW_NUMBER() OVER (ORDER BY category_name ASC) as display_order,
        'active' as status
      FROM services
      GROUP BY category_name
      ORDER BY category_name ASC
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('Inserted categories count:', insertCategories.rowCount);

    const sCheck = await client.query('SELECT COUNT(*) as c FROM services');
    const cCheck = await client.query('SELECT COUNT(*) as c FROM service_categories');
    console.log('FINAL VERIFICATION: services in DB =', sCheck.rows[0].c, '| categories in DB =', cCheck.rows[0].c);

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
