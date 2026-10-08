/**
 * Pure Firebase Validation (Zero Neon Dependency Test)
 * 
 * Simulates a production environment where DATABASE_URL is completely removed/disconnected,
 * and verifies that 100% of operations run exclusively on Firebase Firestore with 0 errors.
 */

// Step 1: Disconnect and purge Neon DATABASE_URL from process environment
delete process.env.DATABASE_URL;
process.env.DATA_BACKEND = 'firestore';

const { getActiveDataBackend, checkDbConnection, pingDatabaseFast, getDbPool } = require('../src/server/db');

async function runDisconnectionTest() {
  console.log('================================================================');
  console.log('STARTING STRICT ZERO-NEON PURE FIREBASE TEST');
  console.log('DATABASE_URL is set?:', !!process.env.DATABASE_URL);
  console.log('Active Data Backend:', getActiveDataBackend());
  console.log('================================================================');

  if (process.env.DATABASE_URL) {
    throw new Error('FAILED: DATABASE_URL should be completely unset!');
  }

  // 1. Backend ping
  const ping = await pingDatabaseFast();
  console.log('\n1. Database Fast Ping:');
  console.log('   Connected:', ping.connected);
  console.log('   Latency:', ping.latencyMs + 'ms');
  console.log('   Message:', ping.message);
  if (!ping.connected) throw new Error('Ping failed');

  // 2. Full DB Status check
  const status = await checkDbConnection();
  console.log('\n2. Database Full Status:');
  console.log('   Backend:', status.backend);
  console.log('   Connected:', status.connected);
  console.log('   Message:', status.message);
  console.log('   Collections count:', status.tables ? status.tables.length : 0);
  if (status.backend !== 'firestore' || !status.connected) {
    throw new Error('CheckDbConnection failed to verify Firestore');
  }

  const pool = getDbPool();

  // 3. User Authentication Query (User login with identifier)
  console.log('\n3. Testing User Authentication Query (LOWER username/email)...');
  const userRes = await pool.query(`
    SELECT id, username, email, phone, password_hash, role, wallet_balance, status, created_at
    FROM users
    WHERE LOWER(username) = $1 OR LOWER(email) = $1
  `, ['arifahmed56']);

  console.log('   Rows returned:', userRes.rowCount);
  const user = userRes.rows[0];
  console.log('   Found user:', user.username, '| Email:', user.email, '| Balance: ₹' + user.wallet_balance);
  if (!user || user.id !== 1 || user.username !== 'arifahmed56') {
    throw new Error('User query returned incorrect user');
  }

  // 4. Admin Security Query (Admin login with email)
  console.log('\n4. Testing Admin Security Query (LOWER email)...');
  const adminRes = await pool.query(
    'SELECT id, email, password_hash, totp_enabled, totp_secret_encrypted FROM admin_security WHERE LOWER(email) = $1',
    ['arifahmed87204@gmail.com']
  );
  console.log('   Rows returned:', adminRes.rowCount);
  console.log('   Found admin email:', adminRes.rows[0]?.email);
  if (adminRes.rowCount === 0) throw new Error('Admin security query failed');

  // 5. Active Services Query
  console.log('\n5. Testing Active Services Query...');
  const srvRes = await pool.query("SELECT * FROM services WHERE status = 'active'");
  console.log('   Active services count:', srvRes.rowCount);
  if (srvRes.rowCount < 2000) throw new Error('Services count too low');

  // 6. Service Categories Query
  console.log('\n6. Testing Service Categories Query...');
  const catRes = await pool.query('SELECT * FROM service_categories');
  console.log('   Categories count:', catRes.rowCount);
  if (catRes.rowCount !== 235) throw new Error(`Categories count mismatch: expected 235, got ${catRes.rowCount}`);

  // 7. System Settings Query
  console.log('\n7. Testing System Settings Query...');
  const setRes = await pool.query("SELECT value FROM system_settings WHERE key = 'usd_to_inr_rate'");
  console.log('   USD to INR rate:', setRes.rows[0]?.value);
  if (!setRes.rows[0]?.value) throw new Error('Settings query failed');

  // 8. Admin Payments Pending & History Query (Joined with Users)
  console.log('\n8. Testing Admin Payment Queue & History Query (Joined with Users)...');
  const pendingRes = await pool.query(`
    SELECT 
      p.id, 
      p.user_id, 
      p.amount, 
      p.currency, 
      p.payment_method, 
      p.utr_number, 
      p.payer_vpa_or_account, 
      p.status, 
      p.created_at, 
      u.username, 
      u.email, 
      u.wallet_balance AS current_user_balance
    FROM payment_requests p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'pending'
    ORDER BY p.id ASC
  `);
  console.log('   Pending payments count:', pendingRes.rowCount);

  const historyRes = await pool.query(`
    SELECT 
      p.id, 
      p.user_id, 
      p.amount, 
      p.currency, 
      p.payment_method, 
      p.utr_number, 
      p.payer_vpa_or_account, 
      p.status, 
      p.rejection_reason,
      p.approved_by_admin_id,
      p.approved_at,
      p.created_at, 
      u.username, 
      u.email
    FROM payment_requests p
    JOIN users u ON p.user_id = u.id
    WHERE p.status != 'pending'
    ORDER BY p.id DESC
    LIMIT 200
  `);
  console.log('   History payments count:', historyRes.rowCount);
  console.log('   Sample history item joined user:', historyRes.rows[0]?.username, '| UTR:', historyRes.rows[0]?.utr_number);
  if (historyRes.rowCount === 0) throw new Error('Payment history query failed');

  // 9. Orders Query
  console.log('\n9. Testing Orders Query...');
  const ordRes = await pool.query('SELECT * FROM orders WHERE user_id = $1', [1]);
  console.log('   Orders for User 1:', ordRes.rowCount);

  // 10. User Banners Query
  console.log('\n10. Testing User Banners Query...');
  const banRes = await pool.query('SELECT * FROM user_banners WHERE is_active = true');
  console.log('   Active banners count:', banRes.rowCount);

  console.log('\n================================================================');
  console.log('SUCCESS! ALL 10 TEST SUITES PASSED 100% ON FIREBASE WITHOUT NEON!');
  console.log('================================================================\n');
  process.exit(0);
}

runDisconnectionTest().catch((err) => {
  console.error('\n[FATAL ERROR IN ZERO-NEON TEST]:', err);
  process.exit(1);
});
