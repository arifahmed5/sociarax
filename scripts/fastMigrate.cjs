const pg = require('pg');

async function fastMigrate() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('Starting fast migration directly in PostgreSQL...');

    await client.query('BEGIN');
    
    // 1. Truncate services
    await client.query('TRUNCATE TABLE services RESTART IDENTITY CASCADE');

    // 2. Direct SQL migration from "Service" and "Category" into "services"
    const insertResult = await client.query(`
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

    console.log(`Inserted ${insertResult.rowCount} services into services table!`);

    // 3. Populate service_categories
    await client.query('TRUNCATE TABLE service_categories RESTART IDENTITY CASCADE');
    const catResult = await client.query(`
      INSERT INTO service_categories (name, platform, display_order, status)
      SELECT 
        category_name as name,
        platform,
        ROW_NUMBER() OVER (ORDER BY category_name ASC) as display_order,
        'active' as status
      FROM (
        SELECT DISTINCT category_name, platform
        FROM services
      ) distinct_cats
      ORDER BY category_name ASC
    `);

    console.log(`Inserted ${catResult.rowCount} categories into service_categories table!`);

    await client.query('COMMIT');
    console.log('SUCCESSFUL DIRECT SQL MIGRATION!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration error:', e);
  } finally {
    client.release();
    pool.end();
  }
}

fastMigrate();
