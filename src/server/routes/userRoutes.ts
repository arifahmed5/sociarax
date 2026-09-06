import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';
import { sendCustomerReminderEmail } from '../emailService';

export const userRouter = Router();

/**
 * GET /api/admin/users
 * List all registered users, wallet balances, total orders, spent amounts
 */
userRouter.get('/', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const { search, status } = req.query;

    let query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.wallet_balance,
        u.currency,
        u.status,
        u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.charge), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(String(status).toLowerCase());
      query += ` AND u.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR CAST(u.id AS TEXT) ILIKE $${params.length})`;
    }

    query += ' GROUP BY u.id ORDER BY u.id DESC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      users: result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        walletBalance: parseFloat(row.wallet_balance),
        currency: row.currency,
        status: row.status,
        totalOrders: parseInt(row.total_orders, 10),
        totalSpent: parseFloat(row.total_spent),
        createdAt: row.created_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN USERS FETCH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve users' });
  }
});

/**
 * POST /api/admin/users/:id/status
 * Suspend or activate user account
 */
userRouter.post('/:id/status', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(userId) || !['active', 'suspended'].includes(status)) {
    res.status(400).json({ success: false, error: 'Valid user ID and status (active/suspended) required' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, status',
      [status, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, message: `User account has been ${status}.`, user: result.rows[0] });
  } catch (err: any) {
    console.error('[UPDATE USER STATUS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update user status' });
  }
});

/**
 * POST /api/admin/users/:id/send-reminder
 * Optional manual customer reminder triggered strictly by admin.
 * Sent only to the selected user's registered email.
 * Rate-limited to prevent spam or repeated messages.
 */
userRouter.post('/:id/send-reminder', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).admin;
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId)) {
    res.status(400).json({ success: false, error: 'Valid user ID required' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const userRes = await db.query(
      'SELECT id, username, email, status, last_reminder_sent_at FROM users WHERE id = $1',
      [userId]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.status === 'suspended') {
      res.status(400).json({
        success: false,
        error: 'Cannot send re-order reminder to a suspended account.'
      });
      return;
    }

    // Rate-limiting check: minimum 6 hours between reminders to avoid spam
    if (targetUser.last_reminder_sent_at) {
      const lastSent = new Date(targetUser.last_reminder_sent_at).getTime();
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      if (now - lastSent < sixHours) {
        const remainingHours = Math.ceil((sixHours - (now - lastSent)) / (60 * 60 * 1000));
        res.status(429).json({
          success: false,
          error: `A reminder was recently sent to this user. Please wait ${remainingHours} hour(s) to avoid repeated messaging.`
        });
        return;
      }
    }

    const emailResult = await sendCustomerReminderEmail({
      to: targetUser.email,
      username: targetUser.username,
      req
    });

    if (!emailResult.success) {
      res.status(500).json({
        success: false,
        error: emailResult.error || 'Failed to dispatch reminder email'
      });
      return;
    }

    // Update last reminder timestamp
    try {
      await db.query(
        'UPDATE users SET last_reminder_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    } catch {
      // Non-blocking
    }

    // Audit log entry
    try {
      await db.query(`
        INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'admin',
        admin.id,
        'manual_customer_reminder_sent',
        'user',
        String(userId),
        JSON.stringify({
          userId,
          userEmail: targetUser.email,
          adminId: admin.id,
          adminEmail: admin.email,
          timestamp: new Date().toISOString()
        }),
        req.ip || null
      ]);
    } catch {
      // Non-blocking
    }

    res.json({
      success: true,
      message: `Account active reminder successfully sent to ${targetUser.email}.`
    });
  } catch (err: any) {
    console.error('[SEND REMINDER ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to send customer reminder' });
  }
});
