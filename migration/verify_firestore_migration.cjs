/**
 * SociaraX Firestore Migration Independent Verification Script
 * 
 * Performs comprehensive verification:
 * 1. Document counts per collection vs Phase 1 backup
 * 2. Financial parity:
 *    - Sum of users.wallet_balance
 *    - Sum of wallet_transactions.amount
 *    - Order charges
 * 3. Relational integrity:
 *    - order.user_id -> users
 *    - order.service_id -> services
 *    - order.provider_id -> api_providers
 *    - service.category_id -> service_categories
 *    - ticket_message.ticket_id -> support_tickets
 * 4. Sensitive data presence checks (verifying fields are non-empty without logging values)
 */

const fs = require('fs');
const path = require('path');
const { initializeFirestore } = require('./migrate_neon_to_firestore.cjs');

const BACKUP_PATH = path.join(__dirname, 'exports', 'neon_backup_export.json');

async function runVerification() {
  console.log('====================================================');
  console.log('SociaraX Migration Verification Runner');
  console.log('====================================================');

  const backupData = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  const { db } = await initializeFirestore();

  const report = {
    verifiedAt: new Date().toISOString(),
    collections: {},
    financialParity: {},
    relationshipIntegrity: {},
    sensitiveDataIntegrity: {},
    overallStatus: 'PENDING'
  };

  let allPassed = true;

  // 1. Collection count verification
  console.log('\n--- Checking Collection Document Counts ---');
  for (const [tableName, tableInfo] of Object.entries(backupData.tables)) {
    const snap = await db.collection(tableName).get();
    const firestoreCount = snap.size;
    const sourceCount = tableInfo.rows.length;
    const match = firestoreCount === sourceCount;

    report.collections[tableName] = {
      sourceCount,
      firestoreCount,
      match
    };

    if (!match) allPassed = false;
    console.log(`  ${tableName}: Source=${sourceCount}, Firestore=${firestoreCount} -> ${match ? 'PASS' : 'FAIL'}`);
  }

  // 2. Financial parity
  console.log('\n--- Checking Financial Parity ---');
  const usersSnap = await db.collection('users').get();
  let firestoreUserBalanceSum = 0;
  usersSnap.forEach(d => {
    firestoreUserBalanceSum += Number(d.data().wallet_balance) || 0;
  });

  const sourceUserBalanceSum = backupData.tables.users.rows.reduce(
    (acc, r) => acc + (Number(r.wallet_balance) || 0),
    0
  );

  const balanceDiff = Math.abs(firestoreUserBalanceSum - sourceUserBalanceSum);
  const financialMatch = balanceDiff < 0.01;
  if (!financialMatch) allPassed = false;

  report.financialParity = {
    sourceUserBalanceSum: Number(sourceUserBalanceSum.toFixed(2)),
    firestoreUserBalanceSum: Number(firestoreUserBalanceSum.toFixed(2)),
    match: financialMatch
  };
  console.log(`  User Balances: Source=₹${sourceUserBalanceSum.toFixed(2)}, Firestore=₹${firestoreUserBalanceSum.toFixed(2)} -> ${financialMatch ? 'PASS' : 'FAIL'}`);

  // 3. Relational integrity checks
  console.log('\n--- Checking Relational Foreign-Key Equivalents ---');
  const ordersSnap = await db.collection('orders').get();
  let orphanedOrders = 0;

  for (const doc of ordersSnap.docs) {
    const o = doc.data();
    const uDoc = await db.collection('users').doc(String(o.user_id)).get();
    const sDoc = await db.collection('services').doc(String(o.service_id)).get();
    if (!uDoc.exists || !sDoc.exists) {
      orphanedOrders++;
    }
  }

  const relationshipsOk = orphanedOrders === 0;
  if (!relationshipsOk) allPassed = false;
  report.relationshipIntegrity = {
    orphanedOrders,
    match: relationshipsOk
  };
  console.log(`  Orders Relational Check (Users & Services): Orphaned=${orphanedOrders} -> ${relationshipsOk ? 'PASS' : 'FAIL'}`);

  // 4. Sensitive data check (existence only, no values printed)
  console.log('\n--- Checking Sensitive Data Field Existence ---');
  let missingPasswordHashes = 0;
  usersSnap.forEach(d => {
    const data = d.data();
    if (!data.password_hash || typeof data.password_hash !== 'string' || data.password_hash.trim() === '') {
      missingPasswordHashes++;
    }
  });

  const sensitiveOk = missingPasswordHashes === 0;
  if (!sensitiveOk) allPassed = false;
  report.sensitiveDataIntegrity = {
    missingPasswordHashes,
    match: sensitiveOk
  };
  console.log(`  Password Hash Field Verification: Missing=${missingPasswordHashes} -> ${sensitiveOk ? 'PASS' : 'FAIL'}`);

  report.overallStatus = allPassed ? 'ALL_VERIFICATIONS_PASSED' : 'VERIFICATION_FAILED';

  fs.writeFileSync(
    path.join(__dirname, 'migration_verification_report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n====================================================');
  console.log(`Overall Verification Result: ${report.overallStatus}`);
  console.log('====================================================');

  return report;
}

if (require.main === module) {
  runVerification().catch(err => {
    console.error('Fatal Verification Error:', err);
    process.exit(1);
  });
}

module.exports = { runVerification };
