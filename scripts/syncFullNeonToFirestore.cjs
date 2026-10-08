/**
 * Full Neon to Firestore Sync & Parity Script
 * 
 * Synchronizes 100% real data from Neon PostgreSQL into Firestore:
 * - Reads all rows directly from Neon PostgreSQL
 * - Never invents, generates, or fabricates any fake users, fake balances, fake IDs, or fake data
 * - Transfers exact records, IDs, timestamps, balances, and states into Firestore
 * - Updates user balances to the exact live Neon balances
 * - Sets _counters collection monotonically to prevent ID collisions on subsequent writes
 */

const fs = require('fs');
const path = require('path');
const pg = require('pg');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

require('dotenv').config();

const CONFIG_PATH = path.join(__dirname, '..', 'firebase-applet-config.json');

async function initializeFirestore() {
  const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const projectId = rawConfig.projectId;
  const databaseId = rawConfig.firestoreDatabaseId;

  const appName = 'full-neon-sync-app';
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

function normalizeRecord(table, row) {
  const norm = { ...row };

  // Convert dates to ISO strings
  for (const [k, v] of Object.entries(norm)) {
    if (v instanceof Date) {
      norm[k] = v.toISOString();
    }
  }

  // Handle specific fields
  if (norm.id !== undefined && norm.id !== null) {
    norm.id = Number(norm.id);
  }

  if (table === 'users') {
    norm.id = Number(norm.id);
    norm.wallet_balance = norm.wallet_balance ? String(norm.wallet_balance) : '0.0000';
    norm.total_spent = norm.total_spent ? String(norm.total_spent) : '0.0000';
    norm.spent_balance = norm.spent_balance ? String(norm.spent_balance) : '0.0000';
    norm.total_deposited = norm.total_deposited ? String(norm.total_deposited) : '0.0000';
  } else if (table === 'wallet_transactions') {
    norm.id = Number(norm.id);
    norm.user_id = Number(norm.user_id);
    norm.amount = norm.amount ? String(norm.amount) : '0.0000';
    norm.balance_before = norm.balance_before ? String(norm.balance_before) : '0.0000';
    norm.balance_after = norm.balance_after ? String(norm.balance_after) : '0.0000';
  } else if (table === 'payment_requests') {
    norm.id = Number(norm.id);
    norm.user_id = Number(norm.user_id);
    norm.amount = norm.amount ? String(norm.amount) : '0.0000';
    if (norm.approved_by_admin_id) norm.approved_by_admin_id = Number(norm.approved_by_admin_id);
  } else if (table === 'orders') {
    norm.id = Number(norm.id);
    norm.user_id = Number(norm.user_id);
    norm.service_id = Number(norm.service_id);
    norm.quantity = Number(norm.quantity);
    norm.charge = norm.charge ? String(norm.charge) : '0.0000';
    norm.start_count = norm.start_count !== null && norm.start_count !== undefined ? Number(norm.start_count) : null;
    norm.remains = norm.remains !== null && norm.remains !== undefined ? Number(norm.remains) : null;
  } else if (table === 'support_tickets') {
    norm.id = Number(norm.id);
    norm.user_id = Number(norm.user_id);
  } else if (table === 'ticket_messages') {
    norm.id = Number(norm.id);
    norm.ticket_id = Number(norm.ticket_id);
    norm.sender_id = Number(norm.sender_id || norm.user_id || 0);
    norm.sender_type = norm.sender_type || (norm.is_admin ? 'admin' : 'user');
    if (norm.attachments && typeof norm.attachments === 'string') {
      try { norm.attachments = JSON.parse(norm.attachments); } catch {}
    }
  } else if (table === 'api_providers') {
    norm.id = Number(norm.id);
    norm.balance = norm.balance ? String(norm.balance) : '0.00000000';
  }

  return norm;
}

async function runFullSync() {
  console.log('===============================================================');
  console.log('SYNCHRONIZING 100% REAL LIVE NEON DATABASE INTO FIREBASE');
  console.log('===============================================================');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const { db, projectId, databaseId } = await initializeFirestore();
  console.log(`Connected to Firestore: project=${projectId}, db=${databaseId}`);

  const tablesToSync = [
    'system_settings',
    'users',
    'admin_security',
    'api_providers',
    'service_categories',
    'services',
    'orders',
    'wallet_transactions',
    'payment_requests',
    'support_tickets',
    'ticket_messages',
    'user_banners'
  ];

  const maxIds = {};

  try {
    for (const table of tablesToSync) {
      console.log(`\nFetching real data from Neon table "${table}"...`);
      const keyCol = table === 'system_settings' ? 'key' : 'id';
      const neonRes = await pool.query(`SELECT * FROM "${table}" ORDER BY ${keyCol} ASC`);
      const rows = neonRes.rows;
      console.log(`Neon "${table}" returned ${rows.length} real rows.`);

      if (rows.length === 0) continue;

      let maxId = 0;
      let writeCount = 0;

      // Batch in chunks of 300
      const CHUNK_SIZE = 300;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        for (const rawRow of chunk) {
          const docId = String(table === 'system_settings' ? rawRow.key : rawRow.id);
          const docData = normalizeRecord(table, rawRow);
          const docRef = db.collection(table).doc(docId);
          batch.set(docRef, docData, { merge: true });
          writeCount++;

          if (table !== 'system_settings') {
            const numId = Number(rawRow.id);
            if (!isNaN(numId) && numId > maxId) {
              maxId = numId;
            }
          }
        }

        await batch.commit();
        process.stdout.write(`  Committed batch: ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}\r`);
      }

      console.log(`\n✓ Successfully synced ${writeCount} documents into Firestore collection "${table}".`);

      if (table !== 'system_settings' && maxId > 0) {
        maxIds[table] = maxId;
        // Update _counters for atomic auto-increment allocations
        await db.collection('_counters').doc(table).set({
          currentId: maxId,
          last_id: maxId,
          updated_at: new Date().toISOString()
        }, { merge: true });
        console.log(`  _counters.${table} updated to ${maxId}`);
      }
    }

    console.log('\n===============================================================');
    console.log('ALL NEON TABLES SUCCESSFULLY SYNCED INTO FIREBASE FIRESTORE');
    console.log('Summary of monotonic counters:');
    console.log(JSON.stringify(maxIds, null, 2));
    console.log('===============================================================');

  } finally {
    await pool.end();
  }
}

runFullSync().catch(err => {
  console.error('[FATAL SYNC ERROR]:', err);
  process.exit(1);
});
