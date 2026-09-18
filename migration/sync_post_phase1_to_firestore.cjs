/**
 * Synchronize post-Phase-1 changes from Live Neon to Firestore
 * 
 * 1. ticket_messages #14 and #15
 * 2. support_tickets #6 and #7 status ('resolved')
 * 3. orders #88 and #89 status ('completed')
 * 4. api_providers #1 updated balance, timestamp, and encrypted API key
 */

const pg = require('pg');
const { initializeFirestore } = require('./migrate_neon_to_firestore.cjs');

async function syncPostPhase1() {
  console.log('===========================================================');
  console.log('Synchronizing Live Post-Phase-1 Neon Changes to Firestore');
  console.log('===========================================================');

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  const { db } = await initializeFirestore();

  try {
    // 1. Sync ticket_messages #14 and #15
    console.log('\n[1] Syncing ticket_messages #14 and #15...');
    const tmRes = await client.query('SELECT * FROM ticket_messages WHERE id IN (14, 15) ORDER BY id ASC');
    for (const msg of tmRes.rows) {
      const docRef = db.collection('ticket_messages').doc(String(msg.id));
      const msgData = {
        id: Number(msg.id),
        ticket_id: Number(msg.ticket_id),
        sender_id: Number(msg.user_id),
        sender_type: 'admin',
        message: String(msg.message),
        attachments: msg.attachments ? (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments) : [],
        created_at: new Date(msg.created_at).toISOString()
      };
      await docRef.set(msgData);
      console.log(`  ✓ Synced ticket_message #${msg.id} (Ticket #${msg.ticket_id})`);
    }

    // Update _counters for ticket_messages
    const counterRef = db.collection('_counters').doc('ticket_messages');
    await counterRef.set({ last_id: 15 }, { merge: true });
    console.log('  ✓ Updated _counters.ticket_messages to 15');

    // 2. Sync support_tickets status for #6 and #7
    console.log('\n[2] Syncing support_tickets #6 and #7 status...');
    const stRes = await client.query('SELECT * FROM support_tickets WHERE id IN (6, 7) ORDER BY id ASC');
    for (const ticket of stRes.rows) {
      const tDocRef = db.collection('support_tickets').doc(String(ticket.id));
      await tDocRef.update({
        status: ticket.status,
        updated_at: new Date(ticket.updated_at).toISOString()
      });
      console.log(`  ✓ Updated support_ticket #${ticket.id} status to "${ticket.status}"`);
    }

    // 3. Sync orders status for #88 and #89
    console.log('\n[3] Syncing orders #88 and #89 status...');
    const ordRes = await client.query('SELECT * FROM orders WHERE id IN (88, 89) ORDER BY id ASC');
    for (const ord of ordRes.rows) {
      const oDocRef = db.collection('orders').doc(String(ord.id));
      await oDocRef.update({
        status: ord.status,
        updated_at: new Date(ord.updated_at || ord.created_at).toISOString()
      });
      console.log(`  ✓ Updated order #${ord.id} status to "${ord.status}"`);
    }

    // 4. Sync api_providers #1
    console.log('\n[4] Syncing api_providers #1 latest live state...');
    const apRes = await client.query('SELECT * FROM api_providers WHERE id = 1');
    if (apRes.rows[0]) {
      const prov = apRes.rows[0];
      const pDocRef = db.collection('api_providers').doc('1');
      await pDocRef.update({
        api_key_encrypted: prov.api_key_encrypted,
        balance: prov.balance ? String(prov.balance) : '0.00000000',
        last_checked_at: prov.last_checked_at ? new Date(prov.last_checked_at).toISOString() : null,
        last_error: prov.last_error || null,
        updated_at: new Date(prov.updated_at).toISOString()
      });
      console.log(`  ✓ Updated api_provider #1 (balance: ${prov.balance}, last_error: ${prov.last_error})`);
    }

    console.log('\n===========================================================');
    console.log('Post-Phase-1 Sync to Firestore COMPLETED SUCCESSFULLY');
    console.log('===========================================================');

  } finally {
    client.release();
    await pool.end();
  }
}

syncPostPhase1().catch(console.error);
