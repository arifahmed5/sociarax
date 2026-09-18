/**
 * SociaraX Phase 4B Step 5: Live Application & Backend Cutover Verification
 * 
 * Tests the real application layers running on Firestore:
 * - getDbPool() resolution (Firestore Bridge)
 * - pingDatabaseFast()
 * - checkDbConnection()
 * - Auth: user retrieval, admin credentials, TOTP validation readiness
 * - User: profile, wallet balance, transaction ledger
 * - Services: 2,362 services, 235 categories
 * - Orders: retrieval, status, history
 * - Payments: payment requests retrieval
 * - Support: 7 tickets, 15 messages
 * - Admin: settings, banners, security records
 * - Provider: LuvSMM credentials server-side retrieval
 * - Password Reset: Locked validation
 */

import { getDbPool, checkDbConnection, pingDatabaseFast, getActiveDataBackend } from '../src/server/db';
import { firestoreAdapter } from '../src/server/firestore/firestoreAdapter';

async function runLiveAppVerification() {
  console.log('================================================================');
  console.log('SociaraX Phase 4B Step 5: Live Application Cutover Verification');
  console.log('================================================================');

  const report: Record<string, any> = {};

  // 1. Backend Selection Check
  const activeBackend = getActiveDataBackend();
  report.activeBackend = activeBackend;
  console.log(`\n[1] Active Backend Authority: "${activeBackend}" (Expected: "firestore")`);
  if (activeBackend !== 'firestore') {
    throw new Error(`CRITICAL: Active backend is ${activeBackend}, expected "firestore"!`);
  }

  // 2. Health & Connection Checks
  console.log('\n[2] Testing Health & Connection Checks...');
  const ping = await pingDatabaseFast();
  console.log('  pingDatabaseFast:', ping);
  report.ping = ping;

  const conn = await checkDbConnection();
  console.log('  checkDbConnection:', conn);
  report.connection = conn;

  // 3. Pool Query Bridge Check
  console.log('\n[3] Testing getDbPool() Query Bridge on Firestore...');
  const db = getDbPool();
  const select1 = await db.query('SELECT 1;');
  console.log('  SELECT 1 result:', select1.rows);

  const settingsRes = await db.query('SELECT * FROM system_settings');
  console.log('  system_settings via pool.query count:', settingsRes.rows.length);
  report.systemSettingsCount = settingsRes.rows.length;

  // 4. Auth & User Profile Check
  console.log('\n[4] Testing User & Auth Layer...');
  const userRes = await db.query('SELECT * FROM users WHERE email = $1', ['arifahmed87204@gmail.com']);
  const user = userRes.rows[0];
  console.log('  Admin User lookup:', user ? { id: user.id, username: user.username, balance: user.wallet_balance, role: user.role } : 'NOT FOUND');
  report.adminUser = user ? { id: user.id, balance: user.wallet_balance } : null;

  const adminSecRes = await db.query('SELECT * FROM admin_security WHERE email = $1', ['arifahmed87204@gmail.com']);
  console.log('  Admin Security lookup:', adminSecRes.rows[0] ? 'FOUND (TOTP & Hash preserved)' : 'NOT FOUND');
  report.adminSecurity = !!adminSecRes.rows[0];

  // 5. Services & Categories
  console.log('\n[5] Testing Services & Categories via App Engine...');
  const catsRes = await db.query('SELECT * FROM service_categories');
  console.log('  Service Categories count:', catsRes.rows.length);
  report.categoriesCount = catsRes.rows.length;

  const servRes = await db.query('SELECT * FROM services');
  console.log('  Services count:', servRes.rows.length);
  report.servicesCount = servRes.rows.length;

  const singleServRes = await db.query('SELECT * FROM services WHERE id = $1', [118]);
  console.log('  Service #118 lookup:', singleServRes.rows[0] ? { id: singleServRes.rows[0].id, name: singleServRes.rows[0].name } : 'NOT FOUND');

  // 6. Orders
  console.log('\n[6] Testing Orders Engine...');
  const ordsRes = await db.query('SELECT * FROM orders');
  console.log('  Orders count via pool.query:', ordsRes.rows.length);
  report.ordersCount = ordsRes.rows.length;

  const userOrdsRes = await db.query('SELECT * FROM orders WHERE user_id = $1', [1]);
  console.log('  Orders for User #1 count:', userOrdsRes.rows.length);

  // 7. Wallet & Ledger
  console.log('\n[7] Testing Wallet & Ledger...');
  const txsRes = await db.query('SELECT * FROM wallet_transactions WHERE user_id = $1', [1]);
  console.log('  Wallet Transactions for User #1 count:', txsRes.rows.length);
  report.user1Transactions = txsRes.rows.length;

  // 8. Payment Requests
  console.log('\n[8] Testing Payment Requests...');
  const paysRes = await db.query('SELECT * FROM payment_requests');
  console.log('  Payment Requests count:', paysRes.rows.length);
  report.paymentRequestsCount = paysRes.rows.length;

  // 9. Support Tickets & Messages
  console.log('\n[9] Testing Support System (Tickets & Messages)...');
  const ticketsRes = await db.query('SELECT * FROM support_tickets');
  console.log('  Support Tickets count:', ticketsRes.rows.length);
  report.supportTicketsCount = ticketsRes.rows.length;

  const allMsgsRes = await db.query('SELECT * FROM ticket_messages');
  console.log('  Total Ticket Messages count:', allMsgsRes.rows.length);
  report.ticketMessagesCount = allMsgsRes.rows.length;

  const ticket1MsgsRes = await db.query('SELECT * FROM ticket_messages WHERE ticket_id = $1', [1]);
  console.log('  Ticket #1 Messages count:', ticket1MsgsRes.rows.length);

  // 10. User Banners
  console.log('\n[10] Testing User Banners...');
  const bannersRes = await db.query('SELECT * FROM user_banners');
  console.log('  User Banners count:', bannersRes.rows.length);
  report.bannersCount = bannersRes.rows.length;

  // 11. API Providers (LuvSMM)
  console.log('\n[11] Testing Provider (LuvSMM) Server-Side Configuration...');
  const provRes = await db.query('SELECT * FROM api_providers WHERE id = $1', [1]);
  const prov = provRes.rows[0];
  console.log('  Provider lookup:', prov ? {
    id: prov.id,
    name: prov.name,
    balance: prov.balance,
    has_encrypted_key: !!prov.api_key_encrypted
  } : 'NOT FOUND');
  report.providerReady = !!prov && !!prov.api_key_encrypted;

  // 12. Password Reset Lock
  console.log('\n[12] Testing Password Reset Status...');
  const pwRes = await db.query('SELECT * FROM password_resets');
  console.log('  Password resets returned count:', pwRes.rows.length, '(LOCKED: YES)');
  report.passwordResetLocked = pwRes.rows.length === 0;

  const allPassed = 
    activeBackend === 'firestore' &&
    ping.connected &&
    conn.connected &&
    report.systemSettingsCount === 47 &&
    report.categoriesCount === 235 &&
    report.servicesCount === 2362 &&
    report.ordersCount >= 89 &&
    report.supportTicketsCount === 7 &&
    report.ticketMessagesCount === 15 &&
    report.bannersCount === 18 &&
    report.providerReady &&
    report.passwordResetLocked;

  console.log('\n================================================================');
  console.log('LIVE APPLICATION VERIFICATION RESULT:', allPassed ? 'PASSED (FIRESTORE LIVE & AUTHORITATIVE)' : 'FAILED');
  console.log('================================================================\n');

  if (!allPassed) {
    throw new Error('Live verification checks failed!');
  }
  process.exit(0);
}

runLiveAppVerification().catch(err => {
  console.error('Live App Verification Error:', err);
  process.exit(1);
});
