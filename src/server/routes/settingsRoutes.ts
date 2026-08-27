import { Router, Request, Response } from 'express';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';

export const settingsRouter = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'SociaraX',
  site_title: 'SociaraX - Premium SMM Provider Panel',
  currency: 'INR',
  currency_symbol: '₹',
  usd_to_inr_rate: '88.0',
  default_markup_percentage: '35.0',
  min_deposit: '10',
  upi_id: '6001768808@axisbank',
  upi_secondary_id: '6001768808@ybl',
  upi_merchant_name: 'ARIF UDDIN AHMED',
  custom_qr_image_url: '',
  qr_code_url: '',
  bank_transfer_enabled: 'true',
  bank_name: 'State Bank of India / Axis Bank',
  bank_account_number: '6001768808',
  bank_account_holder: 'ARIF UDDIN AHMED',
  bank_ifsc_code: 'UTIB0000123',
  bank_branch: 'Guwahati Branch (Current A/c)',
  bank_instructions: 'Transfer amount via IMPS / NEFT / RTGS and submit the UTR / Transaction Ref number below.',
  usdt_enabled: 'true',
  usdt_network: 'TRC20',
  usdt_wallet_address: 'TY2D3vWaQkG98bA7K1xVq99mZ21LuvSMM99',
  usdt_qr_image_url: '',
  usdt_to_inr_rate: '92.0',
  usdt_instructions: 'Send exact USDT on the TRC20 network. Copy and paste the Transaction Hash (TXID) below.',
  support_email: 'arifahmed87204@gmail.com',
  telegram_support: '@arifahmed5_6',
  whatsapp_support: '@arifahmed56',
  announcement: 'Welcome to SociaraX! Automated instant delivery active across Instagram, YouTube, Telegram, Snapchat, Facebook & X with 100% Non-Drop Refill Guarantee.'
};

/**
 * GET /api/settings
 * Public application settings
 */
settingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.json({ success: true, settings: DEFAULT_SETTINGS });
    return;
  }

  try {
    const result = await db.query('SELECT key, value FROM system_settings');
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json({
      success: true,
      settings
    });
  } catch (err: any) {
    console.error('[SETTINGS GET ERROR]:', err);
    res.json({ success: true, settings: DEFAULT_SETTINGS });
  }
});

/**
 * POST /api/admin/settings
 * Update system settings (Admin only)
 */
settingsRouter.post('/', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ success: false, error: 'Invalid settings payload' });
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

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && value !== null) {
        await client.query(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, String(value)]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[SETTINGS SAVE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  } finally {
    client.release();
  }
});
