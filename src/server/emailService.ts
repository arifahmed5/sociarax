import nodemailer from 'nodemailer';
import { Request } from 'express';
import { getDbPool } from './db';

export interface SendPasswordResetOptions {
  to: string;
  username: string;
  resetToken: string;
  otpCode: string;
  req?: Request;
  expiresInMinutes?: number;
}

export interface DynamicEmailSettings {
  app_url?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
  email_from?: string;
  email_from_name?: string;
  smtp_secure?: string;
}

export const DEFAULT_PRODUCTION_URL = 'https://sociarax.onrender.com';

// In-memory cache for dynamic email settings (15-second TTL to avoid frequent DB queries)
let cachedSettings: DynamicEmailSettings | null = null;
let cachedSettingsTimestamp = 0;
const SETTINGS_CACHE_TTL_MS = 15000;

/**
 * Clear cached email settings so admin updates take effect immediately
 */
export function invalidateEmailSettingsCache(): void {
  cachedSettings = null;
  cachedSettingsTimestamp = 0;
}

/**
 * Retrieve dynamic email and domain settings from PostgreSQL system_settings table,
 * falling back to environment variables.
 */
export async function getDynamicEmailSettings(): Promise<DynamicEmailSettings> {
  const now = Date.now();
  if (cachedSettings && (now - cachedSettingsTimestamp < SETTINGS_CACHE_TTL_MS)) {
    return cachedSettings;
  }

  const resolved: DynamicEmailSettings = {
    app_url: process.env.APP_URL?.trim() || undefined,
    smtp_host: process.env.SMTP_HOST?.trim() || undefined,
    smtp_port: process.env.SMTP_PORT?.trim() || undefined,
    smtp_user: process.env.SMTP_USER?.trim() || undefined,
    smtp_password: process.env.SMTP_PASSWORD?.trim() || undefined,
    email_from: process.env.EMAIL_FROM?.trim() || undefined,
    email_from_name: process.env.EMAIL_FROM_NAME?.trim() || undefined,
    smtp_secure: process.env.SMTP_SECURE?.trim() || undefined
  };

  try {
    const db = getDbPool();
    if (db) {
      const res = await db.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('app_url', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'email_from', 'email_from_name', 'smtp_secure')
      `);
      for (const row of res.rows) {
        if (row.value && typeof row.value === 'string' && row.value.trim() !== '') {
          (resolved as any)[row.key] = row.value.trim();
        }
      }
    }
  } catch (err: any) {
    console.warn('[EMAIL SERVICE] Could not read system_settings from DB, using fallback/env:', err?.message || err);
  }

  cachedSettings = resolved;
  cachedSettingsTimestamp = now;
  return resolved;
}

/**
 * Resolves the public production base URL for SociaraX.
 * Hierarchy:
 * 1. Explicit override passed in argument
 * 2. Dynamic app_url configured by admin in system_settings table
 * 3. Environment variable APP_URL
 * 4. Render production domain RENDER_EXTERNAL_URL
 * 5. Incoming request reverse proxy host headers (Cloud Run, Render, Cloudflare)
 * 6. Official SociaraX Render production URL fallback (https://sociarax.onrender.com)
 */
export function getAppBaseUrl(req?: Request, overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim().replace(/\/+$/, '');
  }

  if (cachedSettings?.app_url && cachedSettings.app_url.trim()) {
    return cachedSettings.app_url.trim().replace(/\/+$/, '');
  }

  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  if (process.env.RENDER_EXTERNAL_URL && process.env.RENDER_EXTERNAL_URL.trim()) {
    return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
  }

  if (req) {
    // Respect reverse proxy headers (Render, Cloud Run, Nginx, Cloudflare)
    const forwardedProto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const forwardedHost = req.get('x-forwarded-host') || req.get('host');
    if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }
  }

  // Default to the official SociaraX Render production domain
  return DEFAULT_PRODUCTION_URL;
}

/**
 * Mask email address for safe logging and UI display (e.g. j***e@example.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart.slice(0, 1)}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

/**
 * Generates high-conversion, professional HTML email matching SociaraX dark/indigo branding.
 */
export function generatePasswordResetEmailHtml({
  username,
  resetUrl,
  otpCode,
  expiresInMinutes = 15
}: {
  username: string;
  resetUrl: string;
  otpCode: string;
  expiresInMinutes?: number;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your SociaraX Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #030712;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #030712;
      padding: 40px 12px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #0b0f19;
      border: 1px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 32px 24px;
      text-align: center;
      background: linear-gradient(180deg, #111827 0%, #0b0f19 100%);
      border-bottom: 1px solid #1f293d;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #182235;
      border: 1px solid #312e81;
      padding: 8px 18px;
      border-radius: 9999px;
      color: #ffffff;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.02em;
      text-decoration: none;
    }
    .brand-icon {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 6px;
      font-size: 13px;
      margin-right: 6px;
    }
    .content {
      padding: 32px;
    }
    h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .reset-btn {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 34px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.02em;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
    }
    .otp-box {
      background: #060911;
      border: 1px dashed #334155;
      border-radius: 14px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-label {
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #38bdf8;
      margin: 0;
    }
    .link-fallback {
      background: #080c16;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 14px;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
      margin: 24px 0 16px;
    }
    .link-fallback a {
      color: #818cf8;
      text-decoration: none;
    }
    .notice {
      background: #0f172a;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #cbd5e1;
      margin: 20px 0;
    }
    .footer {
      padding: 24px 32px;
      background: #080c14;
      border-top: 1px solid #172033;
      text-align: center;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="brand-badge">
          <span class="brand-icon">&#x26A1;</span>SociaraX
        </div>
      </div>

      <div class="content">
        <h1>Password Reset Request</h1>
        <p>Hello <strong>${username || 'Valued User'}</strong>,</p>
        <p>We received a request to reset your password for your <strong>SociaraX</strong> account. Click the button below to set a new password:</p>

        <div class="btn-container">
          <a href="${resetUrl}" class="reset-btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
        </div>

        <div class="otp-box">
          <div class="otp-label">Or enter this 6-digit verification code in the app</div>
          <div class="otp-code">${otpCode}</div>
        </div>

        <div class="notice">
          <strong>&#x23F1; Expiration Notice:</strong> This password reset link and 6-digit verification code will expire in <strong>${expiresInMinutes} minutes</strong> for your security. Single-use only.
        </div>

        <div class="link-fallback">
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          &#x1F512; <strong>Security Notice:</strong> If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
        </p>
      </div>

      <div class="footer">
        &copy; ${new Date().getFullYear()} SociaraX Enterprise SMM Infrastructure.<br/>
        This is an automated security transmission. Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Server-side email delivery via Nodemailer with real SMTP support.
 * Reads dynamic configuration from system_settings table (configured via Admin Panel)
 * with graceful fallback to environment variables.
 */
export async function sendPasswordResetEmail({
  to,
  username,
  resetToken,
  otpCode,
  req,
  expiresInMinutes = 15
}: SendPasswordResetOptions): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }> {
  // Read dynamic settings configured in Admin Panel
  const dyn = await getDynamicEmailSettings();

  const baseUrl = getAppBaseUrl(req, dyn.app_url);
  // Support both hash route and query param for maximum compatibility across SPAs and browser configurations
  const resetUrl = `${baseUrl}/#reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}`;

  const smtpHost = dyn.smtp_host || process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(dyn.smtp_port || process.env.SMTP_PORT?.trim() || '587', 10);
  const smtpUser = dyn.smtp_user || process.env.SMTP_USER?.trim();
  const smtpPass = dyn.smtp_password || process.env.SMTP_PASSWORD?.trim();
  const fromName = dyn.email_from_name || process.env.EMAIL_FROM_NAME?.trim() || 'SociaraX';
  const fromEmail = dyn.email_from || process.env.EMAIL_FROM?.trim() || smtpUser || 'noreply@sociarax.com';

  const fromHeader = `"${fromName}" <${fromEmail}>`;
  const subject = `SociaraX - Reset Your Password`;

  const html = generatePasswordResetEmailHtml({
    username,
    resetUrl,
    otpCode,
    expiresInMinutes
  });

  const text = `Hello ${username || 'Valued User'},

We received a request to reset your password for your SociaraX account.

To reset your password, visit the link below:
${resetUrl}

Alternatively, if you have the verification dialog open, enter this 6-digit code:
${otpCode}

This link and code will expire in ${expiresInMinutes} minutes.

Security Notice: If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.

--
SociaraX Enterprise SMM
${baseUrl}
`;

  // Check if SMTP is configured
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      `[EMAIL SERVICE] Notice: SMTP credentials are not configured in system_settings or environment. ` +
      `Email to ${maskEmail(to)} could not be sent over SMTP. ` +
      `Configure SMTP settings in Admin Panel > Settings or set environment variables.`
    );
    return {
      success: true,
      simulated: true,
      error: 'SMTP not configured (simulated delivery)'
    };
  }

  try {
    const isSecure = dyn.smtp_secure === 'true' || process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' && process.env.SMTP_IGNORE_TLS !== 'true'
      }
    });

    const info = await transporter.sendMail({
      from: fromHeader,
      to,
      subject,
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': `sociarax-pw-reset-${Date.now()}`
      }
    });

    console.log(`[EMAIL SERVICE] Password reset email successfully dispatched to ${maskEmail(to)}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      simulated: false
    };
  } catch (err: any) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${maskEmail(to)}:`, err.message || err);
    return {
      success: false,
      error: err.message || 'Failed to dispatch email via SMTP transporter.'
    };
  }
}

/**
 * Dispatch an instant test email directly from Admin Panel Settings
 * to verify SMTP credentials and domain resolution.
 */
export async function sendTestEmail({
  to,
  customSettings
}: {
  to: string;
  customSettings?: DynamicEmailSettings;
}): Promise<{ success: boolean; messageId?: string; message?: string; error?: string }> {
  const dyn = await getDynamicEmailSettings();
  const effective: DynamicEmailSettings = {
    ...dyn,
    ...(customSettings || {})
  };

  const baseUrl = getAppBaseUrl(undefined, effective.app_url);
  const smtpHost = effective.smtp_host || process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(effective.smtp_port || process.env.SMTP_PORT?.trim() || '587', 10);
  const smtpUser = effective.smtp_user || process.env.SMTP_USER?.trim();
  const smtpPass = effective.smtp_password || process.env.SMTP_PASSWORD?.trim();
  const fromName = effective.email_from_name || process.env.EMAIL_FROM_NAME?.trim() || 'SociaraX';
  const fromEmail = effective.email_from || process.env.EMAIL_FROM?.trim() || smtpUser || 'noreply@sociarax.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      success: false,
      error: 'SMTP host, username/email, and password must be provided to test email delivery.'
    };
  }

  const isSecure = effective.smtp_secure === 'true' || process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' && process.env.SMTP_IGNORE_TLS !== 'true'
      }
    });

    // Verify SMTP connection handshake
    await transporter.verify();

    const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SociaraX Email Test</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #e2e8f0;">
  <div style="max-width: 560px; margin: 30px auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="background: #182235; border: 1px solid #312e81; color: #818cf8; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold;">
        SociaraX Email Delivery Test
      </span>
      <h2 style="color: #ffffff; margin-top: 16px; margin-bottom: 8px; font-size: 20px;">SMTP Connection Verified</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Your email configuration and domain are active and working smoothly.</p>
    </div>

    <div style="background-color: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 20px; font-size: 13px; line-height: 1.8;">
      <div style="color: #cbd5e1;"><strong>Configured Domain:</strong> <a href="${baseUrl}" style="color: #60a5fa; text-decoration: none;">${baseUrl}</a></div>
      <div style="color: #cbd5e1;"><strong>Sender:</strong> "${fromName}" &lt;${fromEmail}&gt;</div>
      <div style="color: #cbd5e1;"><strong>SMTP Server:</strong> ${smtpHost}:${smtpPort} (TLS/SSL: ${isSecure ? 'Active' : 'STARTTLS'})</div>
      <div style="color: #cbd5e1;"><strong>Timestamp:</strong> ${new Date().toUTCString()}</div>
      <div style="color: #cbd5e1;"><strong>Status:</strong> <span style="color: #34d399; font-weight: bold;">Active &amp; Ready</span></div>
    </div>

    <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
      SociaraX SMM Cloud Management System &bull; Automated notification test
    </p>
  </div>
</body>
</html>`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `[SociaraX Test] SMTP Connection & Domain Verified Successfully`,
      text: `SociaraX Email Test: Your SMTP configuration (${smtpHost}:${smtpPort}) and domain (${baseUrl}) are operational. Sent at ${new Date().toISOString()}.`,
      html: testHtml
    });

    return {
      success: true,
      messageId: info.messageId,
      message: `Test email successfully delivered to ${to}. SMTP connection and authentication verified.`
    };
  } catch (err: any) {
    console.error('[EMAIL TEST ERROR]:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to authenticate with SMTP server. Please check your host, port, user, and password.'
    };
  }
}
