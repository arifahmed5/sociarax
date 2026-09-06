import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireUserAuth, verifySessionToken } from '../auth';

export const ticketRouter = Router();

/**
 * Helper to check if a token payload belongs to Admin / Owner
 */
function isUserAdmin(payload: any): boolean {
  if (!payload) return false;
  return Boolean(
    payload.adminId ||
    payload.role === 'admin' ||
    payload.email?.toLowerCase() === 'admin@sociarax.com' ||
    payload.email?.toLowerCase() === 'arifahmed87204@gmail.com' ||
    payload.username?.toLowerCase() === 'arifahmed56'
  );
}

/**
 * GET /api/tickets
 * Admin: lists all tickets across all users
 * User: lists only their own tickets
 */
ticketRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const authHeader = req.headers.authorization;
  const cookieUser = req.cookies?.sociarax_user_token;
  const cookieAdmin = req.cookies?.sociarax_admin_token;
  
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : (cookieAdmin || cookieUser);
  const payload = token ? verifySessionToken<any>(token) : null;
  const isAdmin = isUserAdmin(payload);

  try {
    let queryText = `
      SELECT 
        t.id,
        t.user_id,
        u.username,
        u.email,
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
    `;

    const queryParams: any[] = [];

    // If regular authenticated user (not admin), only fetch their own tickets
    if (!isAdmin && payload?.userId) {
      queryText += ` WHERE t.user_id = $1 `;
      queryParams.push(payload.userId);
    }

    queryText += `
      GROUP BY t.id, u.username, u.email
      ORDER BY t.updated_at DESC
      LIMIT 150
    `;

    const result = await db.query(queryText, queryParams);

    res.json({
      success: true,
      tickets: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        email: row.email,
        subject: row.subject,
        category: row.category,
        orderId: row.order_id,
        status: row.status,
        priority: row.priority,
        messageCount: parseInt(row.message_count, 10) || 0,
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

    // Safe Order ID resolution: verify order exists in DB to prevent foreign key constraint violations
    let validOrderId: number | null = null;
    let finalSubject = String(subject).trim();

    if (orderId) {
      const parsed = parseInt(String(orderId).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        try {
          const orderCheck = await client.query('SELECT id FROM orders WHERE id = $1', [parsed]);
          if (orderCheck.rowCount && orderCheck.rowCount > 0) {
            validOrderId = parsed;
          } else {
            // Order ID is user-referenced (e.g. from upstream or external); annotate in subject so admin sees it
            if (!finalSubject.toLowerCase().includes(`order #${parsed}`)) {
              finalSubject = `[Order #${parsed}] ${finalSubject}`;
            }
          }
        } catch {
          validOrderId = null;
        }
      }
    }

    const ticketRes = await client.query(`
      INSERT INTO support_tickets (user_id, order_id, subject, category, status, priority)
      VALUES ($1, $2, $3, $4, 'open', $5)
      RETURNING id, subject, status, created_at, updated_at
    `, [
      user.id,
      validOrderId,
      finalSubject,
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
      ticket: {
        id: newTicket.id,
        userId: user.id,
        username: user.username,
        email: user.email,
        subject: newTicket.subject,
        category: String(category).trim(),
        orderId: validOrderId,
        status: newTicket.status,
        priority: String(priority).trim(),
        messageCount: 1,
        createdAt: newTicket.created_at,
        updatedAt: newTicket.updated_at || newTicket.created_at
      },
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
 * Get single ticket details and chronological message thread
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

    const t = ticketRes.rows[0];

    const messagesRes = await db.query(`
      SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC
    `, [ticketId]);

    res.json({
      success: true,
      ticket: {
        id: t.id,
        userId: t.user_id,
        username: t.username,
        email: t.email,
        subject: t.subject,
        category: t.category,
        orderId: t.order_id,
        status: t.status,
        priority: t.priority,
        messageCount: messagesRes.rowCount || 0,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      },
      messages: messagesRes.rows.map(m => ({
        id: m.id,
        ticketId: m.ticket_id || m.ticketId,
        senderRole: m.sender_role || m.senderRole,
        senderId: m.sender_id || m.senderId,
        message: m.message,
        createdAt: m.created_at || m.createdAt
      }))
    });
  } catch (err: any) {
    console.error('[TICKET DETAIL ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve ticket details' });
  }
});

/**
 * POST /api/tickets/:id/reply
 * Reply to ticket (Admin or User)
 */
ticketRouter.post('/:id/reply', async (req: Request, res: Response): Promise<void> => {
  const ticketId = parseInt(req.params.id, 10);
  const { message, senderRole } = req.body;

  if (isNaN(ticketId) || !message || !String(message).trim()) {
    res.status(400).json({ success: false, error: 'Valid ticket ID and reply message are required.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  // Detect role from auth header or body
  const authHeader = req.headers.authorization;
  const cookieUser = req.cookies?.sociarax_user_token;
  const cookieAdmin = req.cookies?.sociarax_admin_token;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : (cookieAdmin || cookieUser);
  const payload = token ? verifySessionToken<any>(token) : null;
  const isAdmin = isUserAdmin(payload) || senderRole === 'admin';

  const role = isAdmin ? 'admin' : 'user';
  const senderId = isAdmin ? (payload?.adminId || 1) : (payload?.userId || 1);

  try {
    await db.query(`
      INSERT INTO ticket_messages (ticket_id, sender_role, sender_id, message)
      VALUES ($1, $2, $3, $4)
    `, [ticketId, role, senderId, String(message).trim()]);

    // If admin replies, status moves to 'pending' (waiting on user), or if user replies, moves to 'open'
    const newStatus = role === 'admin' ? 'pending' : 'open';
    await db.query(`
      UPDATE support_tickets 
      SET updated_at = CURRENT_TIMESTAMP, status = $1 
      WHERE id = $2
    `, [newStatus, ticketId]);

    res.json({ 
      success: true, 
      status: newStatus,
      message: 'Reply submitted successfully.' 
    });
  } catch (err: any) {
    console.error('[TICKET REPLY ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Update ticket status (open, pending, resolved, closed)
 */
ticketRouter.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const ticketId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(ticketId) || !['open', 'pending', 'resolved', 'closed'].includes(status)) {
    res.status(400).json({ 
      success: false, 
      error: 'Valid ticket ID and status (open, pending, resolved, closed) are required.' 
    });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    await db.query(`
      UPDATE support_tickets
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [status, ticketId]);

    res.json({ 
      success: true, 
      status,
      message: `Ticket #${ticketId} marked as ${status}.` 
    });
  } catch (err: any) {
    console.error('[TICKET STATUS UPDATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update ticket status' });
  }
});

