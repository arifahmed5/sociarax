import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireUserAuth, requireAdminAuth } from '../auth';

export const ticketRouter = Router();

/**
 * GET /api/tickets
 * User: lists their tickets; Admin: lists all tickets
 */
ticketRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  // Check if admin or user
  const authHeader = req.headers.authorization;
  const cookieUser = req.cookies?.sociarax_user_token;
  const cookieAdmin = req.cookies?.sociarax_admin_token;
  
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : (cookieAdmin || cookieUser);

  try {
    const result = await db.query(`
      SELECT 
        t.id,
        t.user_id,
        u.username,
        t.subject,
        t.category,
        t.order_id,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        COUNT(m.id) AS message_count
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN ticket_messages m ON t.id = m.ticket_id
      GROUP BY t.id, u.username
      ORDER BY t.updated_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      tickets: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        subject: row.subject,
        category: row.category,
        orderId: row.order_id,
        status: row.status,
        priority: row.priority,
        messageCount: parseInt(row.message_count, 10),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (err: any) {
    console.error('[TICKETS FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve tickets' });
  }
});

/**
 * POST /api/tickets
 * User creates new support ticket
 */
ticketRouter.post('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { subject, category = 'order', orderId, message, priority = 'medium' } = req.body;

  if (!subject || !message) {
    res.status(400).json({ success: false, error: 'Subject and message are required.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ticketRes = await client.query(`
      INSERT INTO support_tickets (user_id, order_id, subject, category, status, priority)
      VALUES ($1, $2, $3, $4, 'open', $5)
      RETURNING id, subject, status, created_at
    `, [
      user.id,
      orderId ? parseInt(String(orderId), 10) : null,
      String(subject).trim(),
      String(category).trim(),
      String(priority).trim()
    ]);

    const newTicket = ticketRes.rows[0];

    await client.query(`
      INSERT INTO ticket_messages (ticket_id, sender_role, sender_id, message)
      VALUES ($1, 'user', $2, $3)
    `, [newTicket.id, user.id, String(message).trim()]);

    await client.query('COMMIT');

    res.json({
      success: true,
      ticket: newTicket,
      message: 'Support ticket created successfully!'
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[TICKET CREATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/tickets/:id
 * Get single ticket messages
 */
ticketRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) {
    res.status(400).json({ success: false, error: 'Invalid ticket ID' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const ticketRes = await db.query(`
      SELECT t.*, u.username, u.email 
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1
    `, [ticketId]);

    if (ticketRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const messagesRes = await db.query(`
      SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC
    `, [ticketId]);

    res.json({
      success: true,
      ticket: ticketRes.rows[0],
      messages: messagesRes.rows
    });
  } catch (err: any) {
    console.error('[TICKET DETAIL ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve ticket details' });
  }
});

/**
 * POST /api/tickets/:id/reply
 * Reply to ticket
 */
ticketRouter.post('/:id/reply', async (req: Request, res: Response): Promise<void> => {
  const ticketId = parseInt(req.params.id, 10);
  const { message, senderRole = 'user' } = req.body;

  if (isNaN(ticketId) || !message) {
    res.status(400).json({ success: false, error: 'Valid ticket ID and reply message are required.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    await db.query(`
      INSERT INTO ticket_messages (ticket_id, sender_role, sender_id, message)
      VALUES ($1, $2, 1, $3)
    `, [ticketId, senderRole, String(message).trim()]);

    await db.query(`
      UPDATE support_tickets 
      SET updated_at = CURRENT_TIMESTAMP, status = $1 
      WHERE id = $2
    `, [senderRole === 'admin' ? 'pending' : 'open', ticketId]);

    res.json({ success: true, message: 'Reply submitted successfully.' });
  } catch (err: any) {
    console.error('[TICKET REPLY ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});
