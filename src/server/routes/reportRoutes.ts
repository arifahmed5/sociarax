import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';

export const reportRouter = Router();

/**
 * GET /api/admin/reports
 * Aggregates real metrics from database tables (orders, payment_requests, users)
 * Never returns fake numbers.
 */
reportRouter.get('/', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Run all independent aggregation queries concurrently in parallel
    const [
      orderStatsRes,
      userStatsRes,
      payStatsRes,
      platformBreakdownRes,
      recentTrendRes
    ] = await Promise.all([
      // 1. Order stats
      db.query(`
        SELECT 
          COUNT(*) AS total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_orders,
          COUNT(CASE WHEN status = 'processing' OR status = 'in_progress' THEN 1 END) AS processing_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_orders,
          COUNT(CASE WHEN status = 'cancelled' OR status = 'failed' THEN 1 END) AS cancelled_orders,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) AS refunded_orders,
          COALESCE(SUM(charge), 0) AS total_revenue,
          COALESCE(SUM(provider_cost), 0) AS total_provider_cost,
          COALESCE(SUM(profit), 0) AS total_profit
        FROM orders
      `),
      // 2. User stats
      db.query(`
        SELECT 
          COUNT(*) AS total_users,
          COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_users,
          COALESCE(SUM(wallet_balance), 0) AS total_user_wallet_balance
        FROM users
      `),
      // 3. Payment stats
      db.query(`
        SELECT 
          COUNT(*) AS total_payment_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_deposits_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_deposits_amount,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_deposits_count,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved_deposits
        FROM payment_requests
      `),
      // 4. Platform breakdown
      db.query(`
        SELECT 
          platform,
          COUNT(*) AS order_count,
          COALESCE(SUM(charge), 0) AS total_revenue,
          COALESCE(SUM(profit), 0) AS total_profit
        FROM orders
        GROUP BY platform
        ORDER BY total_revenue DESC
      `),
      // 5. Recent 7 Days Revenue Trend
      db.query(`
        SELECT 
          DATE(created_at) AS order_date,
          COUNT(*) AS daily_orders,
          COALESCE(SUM(charge), 0) AS daily_revenue,
          COALESCE(SUM(profit), 0) AS daily_profit
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY order_date ASC
      `)
    ]);

    const orderStats = orderStatsRes.rows[0];
    const userStats = userStatsRes.rows[0];
    const payStats = payStatsRes.rows[0];

    res.json({
      success: true,
      metrics: {
        totalRevenue: parseFloat(orderStats.total_revenue),
        totalProviderCost: parseFloat(orderStats.total_provider_cost),
        totalProfit: parseFloat(orderStats.total_profit),
        profitMarginPct: parseFloat(orderStats.total_revenue) > 0 
          ? ((parseFloat(orderStats.total_profit) / parseFloat(orderStats.total_revenue)) * 100).toFixed(1) 
          : '0.0',
        totalOrders: parseInt(orderStats.total_orders, 10),
        pendingOrders: parseInt(orderStats.pending_orders, 10),
        processingOrders: parseInt(orderStats.processing_orders, 10),
        completedOrders: parseInt(orderStats.completed_orders, 10),
        cancelledOrders: parseInt(orderStats.cancelled_orders, 10),
        refundedOrders: parseInt(orderStats.refunded_orders, 10),
        
        totalUsers: parseInt(userStats.total_users, 10),
        activeUsers: parseInt(userStats.active_users, 10),
        totalUserWalletBalance: parseFloat(userStats.total_user_wallet_balance),
        
        totalDeposits: parseFloat(payStats.total_approved_deposits),
        pendingDepositsCount: parseInt(payStats.pending_deposits_count, 10),
        pendingDepositsAmount: parseFloat(payStats.pending_deposits_amount),
        approvedDepositsCount: parseInt(payStats.approved_deposits_count, 10)
      },
      platformBreakdown: platformBreakdownRes.rows.map(r => ({
        platform: r.platform,
        orderCount: parseInt(r.order_count, 10),
        revenue: parseFloat(r.total_revenue),
        profit: parseFloat(r.total_profit)
      })),
      dailyTrend: recentTrendRes.rows.map(r => ({
        date: r.order_date,
        orders: parseInt(r.daily_orders, 10),
        revenue: parseFloat(r.daily_revenue),
        profit: parseFloat(r.daily_profit)
      }))
    });
  } catch (err: any) {
    console.error('[REPORTS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to generate financial reports' });
  }
});
