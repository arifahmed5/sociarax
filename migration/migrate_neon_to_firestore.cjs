/**
 * SociaraX Neon -> Firestore Migration Script
 * 
 * Safety:
 * - Read-only source: reads from ./migration/exports/neon_backup_export.json
 * - Neon database is NOT touched or modified in any way
 * - Batched writes (max 400 docs per batch)
 * - Retries transient failures
 * - Preserves numeric IDs as string document keys and typed fields
 * - Preserves sensitive data without plaintext exposure
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const BACKUP_PATH = path.join(__dirname, 'exports', 'neon_backup_export.json');
const CONFIG_PATH = path.join(__dirname, '..', 'firebase-applet-config.json');

// Dependency tiers for strict topological order
const TIERS = [
  // Tier 1: Standalone configuration and foundation
  ['system_settings', 'service_categories', 'api_providers', 'admin_security'],
  // Tier 2: Core entities
  ['users', 'services', 'user_banners'],
  // Tier 3: Financial & order processing
  ['orders', 'payment_requests', 'wallet_transactions', 'referral_rewards'],
  // Tier 4: Support & engagement
  ['support_tickets', 'ticket_messages', 'notifications', 'password_resets'],
  // Tier 5: Audit & fraud records
  ['audit_logs', 'fraud_rejection_audits']
];

async function initializeFirestore() {
  const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const projectId = rawConfig.projectId;
  const databaseId = rawConfig.firestoreDatabaseId;

  const appName = 'migration-runner-app';
  let app = getApps().find(a => a.name === appName);
  if (!app) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch {
        serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
      }
      app = initializeApp({ credential: cert(serviceAccount), projectId }, appName);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const serviceAccount = require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
      app = initializeApp({ credential: cert(serviceAccount), projectId }, appName);
    } else {
      app = initializeApp({ projectId }, appName);
    }
  }

  const db = getFirestore(app, databaseId);
  return { db, projectId, databaseId };
}

async function commitBatchWithRetry(batch, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Batch commit failed (attempt ${attempt}/${retries}): ${err.message}. Retrying in 1s...`);
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
}

async function runMigration() {
  console.log('====================================================');
  console.log('SociaraX Neon -> Firestore Data Migration');
  console.log('====================================================');

  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file not found at ${BACKUP_PATH}`);
  }

  const backupData = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  console.log(`Loaded backup exported at: ${backupData.exportedAt}`);

  const { db, projectId, databaseId } = await initializeFirestore();
  console.log(`Connected to Firestore (Project: ${projectId}, Database: ${databaseId})`);

  const results = {};
  let totalDocsWritten = 0;

  for (let tierIdx = 0; tierIdx < TIERS.length; tierIdx++) {
    const tier = TIERS[tierIdx];
    console.log(`\n--- Executing Migration Tier ${tierIdx + 1}/${TIERS.length}: [${tier.join(', ')}] ---`);

    for (const tableName of tier) {
      const tableData = backupData.tables[tableName];
      if (!tableData) {
        console.warn(`Table ${tableName} not present in backup data. Skipping.`);
        results[tableName] = { sourceCount: 0, writtenCount: 0, status: 'SKIPPED' };
        continue;
      }

      const rows = tableData.rows || [];
      const sourceCount = rows.length;
      console.log(`Migrating collection '${tableName}' (${sourceCount} records)...`);

      if (sourceCount === 0) {
        results[tableName] = { sourceCount: 0, writtenCount: 0, status: 'SUCCESS_EMPTY' };
        console.log(`  -> 0 records to migrate for ${tableName}`);
        continue;
      }

      let writtenForTable = 0;
      let batch = db.batch();
      let opCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Document ID strategy: 'key' for system_settings, otherwise 'id'
        const docId = tableName === 'system_settings' ? String(row.key) : String(row.id);
        const docRef = db.collection(tableName).doc(docId);

        // Clean document object
        const docData = { ...row };

        // Ensure numeric fields are preserved as numbers
        if (typeof docData.id === 'string' && !isNaN(Number(docData.id))) {
          docData.id = Number(docData.id);
        }

        // Remove undefined keys to adhere strictly to Firestore schema
        for (const k of Object.keys(docData)) {
          if (docData[k] === undefined) {
            delete docData[k];
          }
        }

        batch.set(docRef, docData);
        opCount++;
        writtenForTable++;

        if (opCount >= 400) {
          await commitBatchWithRetry(batch);
          console.log(`  Committed batch (${writtenForTable}/${sourceCount}) for ${tableName}`);
          batch = db.batch();
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await commitBatchWithRetry(batch);
        console.log(`  Committed final batch (${writtenForTable}/${sourceCount}) for ${tableName}`);
      }

      totalDocsWritten += writtenForTable;
      results[tableName] = {
        sourceCount,
        writtenCount: writtenForTable,
        status: sourceCount === writtenForTable ? 'SUCCESS' : 'MISMATCH'
      };
    }
  }

  console.log('\n====================================================');
  console.log(`Migration Complete! Total Documents Written: ${totalDocsWritten}`);
  console.log('====================================================');
  console.table(results);

  fs.writeFileSync(
    path.join(__dirname, 'migration_run_results.json'),
    JSON.stringify({ completedAt: new Date().toISOString(), totalDocsWritten, results }, null, 2)
  );

  return results;
}

if (require.main === module) {
  runMigration().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
  });
}

module.exports = { runMigration, initializeFirestore };
