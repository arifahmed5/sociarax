import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireUserAuth, requireAdminAuth } from '../auth';

export const referralRouter = Router();

/**
 * GET /api/referrals/stats
 * Get logged-in user's referral code, link, statistics, and rewards history
 */
referralRouter.get('/stats', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const db = getDbPool();

  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // 1. Fetch user referral code (generate if missing)
    const userRes = await db.query(
      'SELECT id, username, email, referral_code FROM users WHERE id = $1',
      [user.id]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    let referralCode = userRes.rows[0].referral_code;
    if (!referralCode) {
      referralCode = 'SOCX' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [referralCode, user.id]);
    }

    // 2. Fetch system referral settings
    const settingsRes = await db.query(
      "SELECT key, value FROM system_settings WHERE key IN ('referral_enabled', 'referral_bonus_amount', 'referral_min_deposit', 'referral_required_count', 'referral_terms')"
    );

    const settings: Record<string, string> = {};
    for (const r of settingsRes.rows) {
      settings[r.key] = r.value;
    }

    const referralEnabled = settings.referral_enabled !== 'false';
    const referralBonusAmount = parseFloat(settings.referral_bonus_amount || '25.0');
    const referralMinDeposit = parseFloat(settings.referral_min_deposit || '100.0');
    const referralTerms = settings.referral_terms || 'Refer friends to SociaraX. When they make their first verified deposit of ₹100 or more, you both receive an instant wallet reward!';

    // 3. Count total referred users
    const referredUsersRes = await db.query(
      'SELECT id, username, email, wallet_balance, created_at FROM users WHERE referred_by_id = $1 ORDER BY id DESC',
      [user.id]
    );
    const totalReferrals = referredUsersRes.rowCount || 0;

    // 4. Fetch reward history
    const rewardsRes = await db.query(`
      SELECT 
        r.id,
        r.referrer_id,
        r.referred_user_id,
        u.username as referred_username,
        u.email as referred_email,
        r.bonus_amount,
        r.currency,
        r.status,
        r.created_at
      FROM referral_rewards r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_id = $1
      ORDER BY r.id DESC
    `, [user.id]);

    const rewards = rewardsRes.rows.map(row => ({
      id: row.id,
      referrerId: row.referrer_id,
      referredUserId: row.referred_user_id,
      referredUsername: row.referred_username,
      referredEmail: row.referred_email ? (row.referred_email.substring(0, 3) + '***@' + row.referred_email.split('@')[1]) : 'User',
      bonusAmount: parseFloat(row.bonus_amount) || 0,
      currency: row.currency || 'INR',
      status: row.status,
      createdAt: row.created_at
    }));

    const totalEarned = rewards.reduce((sum, r) => sum + r.bonusAmount, 0);
    const activeReferrals = rewards.length;

    // Generate referral link based on origin or default host
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const referralLink = `${origin}/#register?ref=${referralCode}`;

    res.json({
      success: true,
      stats: {
        referralCode,
        referralLink,
        totalReferrals,
        activeReferrals,
        totalEarned,
        referralBonusAmount,
        referralMinDeposit,
        referralTerms,
        referralEnabled,
        rewards
      }
    });
  } catch (err: any) {
    console.error('[REFERRAL STATS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve referral statistics' });
  }
});

/**
 * GET /api/admin/referrals/overview and /api/referrals/admin/overview
 * Admin overview of all referral rewards and settings
 */
const getAdminOverviewHandler = async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // 1. Settings
    const settingsRes = await db.query(
      "SELECT key, value FROM system_settings WHERE key IN ('referral_enabled', 'referral_bonus_amount', 'referral_min_deposit', 'referral_required_count', 'referral_terms')"
    );
    const settings: Record<string, string> = {
      referral_enabled: 'true',
      referral_bonus_amount: '25.0',
      referral_min_deposit: '100.0',
      referral_required_count: '1',
      referral_terms: 'Refer your friends to SociaraX. When they make their first verified deposit of ₹100 or more, you both receive an instant ₹25 wallet reward!'
    };
    for (const r of settingsRes.rows) {
      settings[r.key] = r.value;
    }

    // 2. Metrics
    const rewardsMetrics = await db.query(`
      SELECT 
        COUNT(*) as total_rewards_count,
        COALESCE(SUM(bonus_amount), 0) as total_bonus_disbursed
      FROM referral_rewards
    `);

    const usersWithReferrals = await db.query(`
      SELECT COUNT(DISTINCT referred_by_id) as active_referrers_count,
             COUNT(*) FILTER (WHERE referred_by_id IS NOT NULL) as total_referred_signups
      FROM users
    `);

    // 3. Recent 50 Referral Rewards
    const recentRewardsRes = await db.query(`
      SELECT 
        r.id,
        r.referrer_id,
        r.referred_user_id,
        ref.username as referrer_username,
        ref.email as referrer_email,
        u.username as referred_username,
        u.email as referred_email,
        r.bonus_amount,
        r.currency,
        r.status,
        r.created_at
      FROM referral_rewards r
      JOIN users ref ON r.referrer_id = ref.id
      JOIN users u ON r.referred_user_id = u.id
      ORDER BY r.id DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      settings,
      metrics: {
        totalRewardsCount: parseInt(rewardsMetrics.rows[0]?.total_rewards_count || '0', 10),
        totalBonusDisbursed: parseFloat(rewardsMetrics.rows[0]?.total_bonus_disbursed || '0'),
        activeReferrersCount: parseInt(usersWithReferrals.rows[0]?.active_referrers_count || '0', 10),
        totalReferredSignups: parseInt(usersWithReferrals.rows[0]?.total_referred_signups || '0', 10)
      },
      rewards: recentRewardsRes.rows.map(row => ({
        id: row.id,
        referrerId: row.referrer_id,
        referrerUsername: row.referrer_username,
        referrerEmail: row.referrer_email,
        referredUserId: row.referred_user_id,
        referredUsername: row.referred_username,
        referredEmail: row.referred_email,
        bonusAmount: parseFloat(row.bonus_amount) || 0,
        currency: row.currency,
        status: row.status,
        createdAt: row.created_at
      }))
    });
  } catch (err: any) {
    console.error('[ADMIN REFERRAL OVERVIEW ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve referral overview' });
  }
};

referralRouter.get('/overview', requireAdminAuth, getAdminOverviewHandler);
referralRouter.get('/admin/overview', requireAdminAuth, getAdminOverviewHandler);

/**
 * POST /api/admin/referrals/settings and /api/referrals/admin/settings
 * Admin updates referral system rules & bonus amounts
 */
const postAdminSettingsHandler = async (req: Request, res: Response): Promise<void> => {
  const { referral_enabled, referral_bonus_amount, referral_min_deposit, referral_required_count, referral_terms } = req.body;
  const db = getDbPool();

  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const updateKeys: Record<string, string> = {};
    if (referral_enabled !== undefined) updateKeys['referral_enabled'] = String(referral_enabled);
    if (referral_bonus_amount !== undefined) updateKeys['referral_bonus_amount'] = String(referral_bonus_amount);
    if (referral_min_deposit !== undefined) updateKeys['referral_min_deposit'] = String(referral_min_deposit);
    if (referral_required_count !== undefined) updateKeys['referral_required_count'] = String(referral_required_count);
    if (referral_terms !== undefined) updateKeys['referral_terms'] = String(referral_terms);

    for (const [k, v] of Object.entries(updateKeys)) {
      await client.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
      `, [k, v]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Referral program settings saved successfully!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[ADMIN REFERRAL SETTINGS SAVE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to save referral settings' });
  } finally {
    client.release();
  }
};

referralRouter.post('/settings', requireAdminAuth, postAdminSettingsHandler);
referralRouter.post('/admin/settings', requireAdminAuth, postAdminSettingsHandler);
