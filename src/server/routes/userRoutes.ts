import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';

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
