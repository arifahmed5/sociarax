import { Resend } from 'resend';
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

export interface SendVerificationEmailOptions {
  to: string;
  username: string;
  verificationCode: string;
  verificationUrl?: string;
  req?: Request;
  expiresInMinutes?: number;
}

export interface DynamicEmailSettings {
  app_url?: string;
  resend_api_key?: string;
  email_from?: string;
  email_from_name?: string;
  // Legacy fields kept for backward compatibility with existing system_settings rows
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_password?: string;
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
    resend_api_key: process.env.RESEND_API_KEY?.trim() || undefined,
    email_from: process.env.EMAIL_FROM?.trim() || undefined,
    email_from_name: process.env.EMAIL_FROM_NAME?.trim() || 'SociaraX',
    smtp_host: process.env.SMTP_HOST?.trim() || undefined,
    smtp_port: process.env.SMTP_PORT?.trim() || undefined,
    smtp_user: process.env.SMTP_USER?.trim() || undefined,
    smtp_password: process.env.SMTP_PASSWORD?.trim() || undefined,
    smtp_secure: process.env.SMTP_SECURE?.trim() || undefined,
  };

  try {
    const db = getDbPool();
    if (db) {
      const res = await db.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('app_url', 'resend_api_key', 'email_from', 'email_from_name', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure')
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
 * Lazy initializer for Resend client to avoid startup crashes if key is not yet set
 */
function getResendClient(apiKey?: string): Resend {
  const key = apiKey?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error('RESEND_API_KEY is not configured in server environment variables.');
  }
  return new Resend(key);
}

/**
 * Detects if an error from Resend is due to free sandbox / unverified domain restrictions
 * where Resend only allows sending to the registered account owner's email address.
 */
export function isResendSandboxRestriction(error: any): boolean {
  if (!error) return false;
  const target = error.error || error;
  const msg = (typeof target === 'string' ? target : target.message || JSON.stringify(target)).toLowerCase();
  const name = (target.name || error.name || '').toLowerCase();
  return (
    msg.includes('only send testing emails to your own email address') ||
    msg.includes('resend.com/domains') ||
    msg.includes('testing emails') ||
    (name === 'validation_error' && (msg.includes('testing') || msg.includes('domain') || msg.includes('own email')))
  );
}

/**
 * Safe wrapper around resend.emails.send that intercepts console.error from the Resend SDK
 * when sandbox/testing restrictions (e.g. unverified recipient/domain) occur, preventing noisy stderr logs.
 */
async function safeResendSend(
  resend: Resend,
  payload: any
): Promise<{ data: any; error: any }> {
  const origConsoleError = console.error;
  try {
    console.error = (...args: any[]) => {
      const str = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (
        str.includes('only send testing emails to your own email address') ||
        str.includes('resend.com/domains') ||
        (str.includes('validation_error') && str.includes('Resend API Error'))
      ) {
        // Silently consume expected sandbox validation warning from Resend SDK so it does not write to stderr
        return;
      }
      origConsoleError.apply(console, args);
    };

    return await resend.emails.send(payload);
  } finally {
    console.error = origConsoleError;
  }
}

/**
 * Format the standard RFC-compliant From header for Resend
 * Example: "SociaraX" <onboarding@resend.dev> or "SociaraX" <noreply@sociarax.com>
 */
function formatFromHeader(fromName: string, fromEmail: string): string {
  const cleanEmail = fromEmail.trim();
  const cleanName = fromName.trim().replace(/^["']|["']$/g, '');
  if (cleanEmail.includes('<') && cleanEmail.includes('>')) {
    return cleanEmail;
  }
  if (!cleanName) {
    return cleanEmail;
  }
  return `${cleanName} <${cleanEmail}>`;
}

/**
 * Detects if an email address belongs to a public webmail domain (like gmail, yahoo, outlook, hotmail)
 * which cannot be verified by DNS on Resend.
 */
export function isUnverifiedWebmailDomain(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const parts = email.split('@');
  const domain = parts[parts.length - 1].toLowerCase().trim().replace(/>$/, '');
  const publicWebmail = [
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'ymail.com',
    'rocketmail.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'aim.com',
    'zoho.com',
    'proton.me',
    'protonmail.com',
    'mail.com',
    'gmx.com',
    'yandex.com'
  ];
  return publicWebmail.includes(domain);
}

/**
 * Resolves a safe From header and optional Reply-To.
 * Resend strictly rejects sending from unverified public webmail domains like @gmail.com.
 * If such a domain is provided in EMAIL_FROM or settings, it safely routes From as onboarding@resend.dev
 * while preserving the original address as Reply-To.
 */
export function resolveSafeSender(
  requestedName?: string,
  requestedEmail?: string
): { fromHeader: string; fromEmail: string; fromName: string; replyTo?: string; usedFallback: boolean } {
  const fromName = requestedName?.trim() || process.env.EMAIL_FROM_NAME?.trim() || 'SociaraX';
  let rawEmail = requestedEmail?.trim() || process.env.EMAIL_FROM?.trim() || 'onboarding@resend.dev';
  let replyTo: string | undefined = undefined;
  let usedFallback = false;

  if (isUnverifiedWebmailDomain(rawEmail)) {
    console.warn(`[EMAIL SERVICE] "${rawEmail}" is a public webmail domain and cannot be verified as a sender on Resend. Auto-routing From via onboarding@resend.dev with reply-to ${rawEmail}.`);
    replyTo = rawEmail;
    rawEmail = 'onboarding@resend.dev';
    usedFallback = true;
  }

  const fromHeader = formatFromHeader(fromName, rawEmail);
  return {
    fromHeader,
    fromEmail: rawEmail,
    fromName,
    replyTo,
    usedFallback
  };
}

/**
 * Generates high-conversion, professional HTML email matching SociaraX dark/indigo branding.
 */
export function generatePasswordResetEmailHtml({
  username,
  resetUrl,
  otpCode,
  expiresInMinutes = 15,
  baseUrl,
  logoUrl
}: {
  username: string;
  resetUrl: string;
  otpCode: string;
  expiresInMinutes?: number;
  baseUrl?: string;
  logoUrl?: string;
}): string {
  const resolvedBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : DEFAULT_PRODUCTION_URL;
  const resolvedLogoUrl = logoUrl || `${resolvedBaseUrl}/sociarax-logo.png`;

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
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="${resolvedBaseUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
            <img src="${resolvedLogoUrl}" alt="SociaraX" width="190" style="display: block; margin: 0 auto; max-width: 190px; width: 190px; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic;" />
          </a>
        </div>
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
 * Generates email verification HTML matching SociaraX dark/indigo branding.
 */
export function generateVerificationEmailHtml({
  username,
  verificationCode,
  verificationUrl,
  expiresInMinutes = 30,
  baseUrl,
  logoUrl
}: {
  username: string;
  verificationCode: string;
  verificationUrl?: string;
  expiresInMinutes?: number;
  baseUrl?: string;
  logoUrl?: string;
}): string {
  const resolvedBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : DEFAULT_PRODUCTION_URL;
  const resolvedLogoUrl = logoUrl || `${resolvedBaseUrl}/sociarax-logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your SociaraX Email</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #030712;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
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
    }
    .content {
      padding: 32px;
    }
    h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px 0;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }
    .otp-box {
      background: #060911;
      border: 1px dashed #334155;
      border-radius: 14px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: monospace;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #38bdf8;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .verify-btn {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 34px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
    }
    .footer {
      padding: 24px 32px;
      background: #080c14;
      border-top: 1px solid #172033;
      text-align: center;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="${resolvedBaseUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
            <img src="${resolvedLogoUrl}" alt="SociaraX" width="190" style="display: block; margin: 0 auto; max-width: 190px; width: 190px; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic;" />
          </a>
        </div>
        <div class="brand-badge">⚡ SociaraX</div>
      </div>
      <div class="content">
        <h1>Verify Your Email Address</h1>
        <p>Hello <strong>${username || 'Valued User'}</strong>,</p>
        <p>Welcome to <strong>SociaraX</strong>! Please verify your email address to complete your account setup:</p>
        
        <div class="otp-box">
          <div style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Your Verification Code</div>
          <div class="otp-code">${verificationCode}</div>
        </div>

        ${verificationUrl ? `
        <div class="btn-container">
          <a href="${verificationUrl}" class="verify-btn" target="_blank" rel="noopener noreferrer">Verify Account Now</a>
        </div>` : ''}

        <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
          This code expires in <strong>${expiresInMinutes} minutes</strong>. If you did not register for SociaraX, please ignore this email.
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} SociaraX Enterprise SMM Infrastructure.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Server-side email delivery via Resend HTTPS API.
 * Uses RESEND_API_KEY environment variable (or dynamic settings in system_settings table).
 */
export async function sendPasswordResetEmail({
  to,
  username,
  resetToken,
  otpCode,
  req,
  expiresInMinutes = 15
}: SendPasswordResetOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  isSandboxMode?: boolean;
  otpCode?: string;
}> {
  const dyn = await getDynamicEmailSettings();

  const baseUrl = getAppBaseUrl(req, dyn.app_url);
  const resetUrl = `${baseUrl}/#reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}`;

  const resendApiKey = process.env.RESEND_API_KEY?.trim() || dyn.resend_api_key?.trim();
  const { fromHeader, fromEmail, fromName, replyTo } = resolveSafeSender(
    process.env.EMAIL_FROM_NAME?.trim() || dyn.email_from_name,
    process.env.EMAIL_FROM?.trim() || dyn.email_from
  );
  const subject = `SociaraX - Reset Your Password`;

  const html = generatePasswordResetEmailHtml({
    username,
    resetUrl,
    otpCode,
    expiresInMinutes,
    baseUrl,
    logoUrl: `${baseUrl}/sociarax-logo.png`
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

  // Check if Resend API key is configured
  if (!resendApiKey) {
    console.log(
      `[EMAIL SERVICE] RESEND_API_KEY is not configured in server environment variables or system_settings. ` +
      `Email to ${maskEmail(to)} cannot be dispatched via Resend HTTPS API. ` +
      `Please configure RESEND_API_KEY in your Render dashboard.`
    );
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server. Please add RESEND_API_KEY to your Render environment variables.'
    };
  }

  try {
    const resend = getResendClient(resendApiKey);

    let sendResult = await safeResendSend(resend, {
      from: fromHeader,
      to: [to],
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
      headers: {
        'X-Entity-Ref-ID': `sociarax-pw-reset-${Date.now()}`
      }
    });

    // Automatic fallback if custom domain is not yet verified on resend.com/domains
    if (
      sendResult.error &&
      fromEmail !== 'onboarding@resend.dev' &&
      (
        sendResult.error.message?.toLowerCase().includes('not verified') ||
        sendResult.error.message?.toLowerCase().includes('domain') ||
        (sendResult.error as any).name === 'validation_error'
      )
    ) {
      console.log(`[EMAIL SERVICE] Sender domain "${fromEmail}" is unverified on Resend. Auto-retrying password reset delivery via onboarding@resend.dev...`);
      const fallbackFromHeader = formatFromHeader(fromName, 'onboarding@resend.dev');
      sendResult = await safeResendSend(resend, {
        from: fallbackFromHeader,
        to: [to],
        subject,
        text,
        html,
        replyTo: fromEmail,
        headers: {
          'X-Entity-Ref-ID': `sociarax-pw-reset-${Date.now()}`
        }
      });
    }

    if (sendResult.error) {
      console.warn(`[EMAIL SERVICE] Resend rejected password reset email to ${maskEmail(to)}:`, sendResult.error.message || sendResult.error);
      return {
        success: false,
        error: 'locked 🔓'
      };
    }

    console.log(`[EMAIL SERVICE] Password reset email successfully dispatched via Resend HTTPS API to ${maskEmail(to)}. MessageId: ${sendResult.data?.id}`);
    return {
      success: true,
      messageId: sendResult.data?.id
    };
  } catch (err: any) {
    console.warn(`[EMAIL SERVICE] Failed to send email via Resend to ${maskEmail(to)}:`, err?.message || err);
    return {
      success: false,
      error: 'locked 🔓'
    };
  }
}

/**
 * Server-side verification email delivery via Resend HTTPS API.
 */
export async function sendVerificationEmail({
  to,
  username,
  verificationCode,
  verificationUrl,
  req,
  expiresInMinutes = 30
}: SendVerificationEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }> {
  const dyn = await getDynamicEmailSettings();

  const baseUrl = getAppBaseUrl(req, dyn.app_url);
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || dyn.resend_api_key?.trim();
  const { fromHeader, fromEmail, fromName, replyTo } = resolveSafeSender(
    process.env.EMAIL_FROM_NAME?.trim() || dyn.email_from_name,
    process.env.EMAIL_FROM?.trim() || dyn.email_from
  );
  const subject = `SociaraX - Verify Your Email Address`;

  const html = generateVerificationEmailHtml({
    username,
    verificationCode,
    verificationUrl,
    expiresInMinutes,
    baseUrl,
    logoUrl: `${baseUrl}/sociarax-logo.png`
  });

  const text = `Hello ${username || 'Valued User'},

Welcome to SociaraX! Please use the following 6-digit code to verify your email address:

${verificationCode}

${verificationUrl ? `Verification link: ${verificationUrl}\n\n` : ''}This code will expire in ${expiresInMinutes} minutes.

--
SociaraX Enterprise SMM
${baseUrl}
`;

  if (!resendApiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server. Please add RESEND_API_KEY to your Render environment variables.'
    };
  }

  try {
    const resend = getResendClient(resendApiKey);
    let sendResult = await safeResendSend(resend, {
      from: fromHeader,
      to: [to],
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {})
    });

    if (
      sendResult.error &&
      fromEmail !== 'onboarding@resend.dev' &&
      (
        sendResult.error.message?.toLowerCase().includes('not verified') ||
        sendResult.error.message?.toLowerCase().includes('domain') ||
        (sendResult.error as any).name === 'validation_error'
      )
    ) {
      console.log(`[EMAIL SERVICE] Sender domain "${fromEmail}" is unverified on Resend. Retrying verification email via onboarding@resend.dev...`);
      const fallbackFromHeader = formatFromHeader(fromName, 'onboarding@resend.dev');
      sendResult = await safeResendSend(resend, {
        from: fallbackFromHeader,
        to: [to],
        subject,
        text,
        html,
        replyTo: fromEmail
      });
    }

    if (sendResult.error) {
      if (isResendSandboxRestriction(sendResult.error)) {
        console.log(`[EMAIL SERVICE] Resend sandbox mode active: verification email delivery to ${maskEmail(to)} simulated.`);
        return {
          success: true,
          simulated: true,
          messageId: `sandbox-verify-${Date.now()}`
        };
      }

      console.error(`[EMAIL SERVICE ERROR] Resend rejected verification email to ${maskEmail(to)}:`, sendResult.error.message || sendResult.error);
      return {
        success: false,
        error: sendResult.error.message || 'Resend rejected verification email delivery.'
      };
    }

    console.log(`[EMAIL SERVICE] Verification email successfully dispatched via Resend to ${maskEmail(to)}. MessageId: ${sendResult.data?.id}`);
    return {
      success: true,
      messageId: sendResult.data?.id
    };
  } catch (err: any) {
    if (isResendSandboxRestriction(err)) {
      console.log(`[EMAIL SERVICE] Resend sandbox mode active: verification email delivery to ${maskEmail(to)} simulated.`);
      return {
        success: true,
        simulated: true,
        messageId: `sandbox-verify-${Date.now()}`
      };
    }
    console.error(`[EMAIL SERVICE ERROR] Failed to send verification email:`, err.message || err);
    return {
      success: false,
      error: err.message || 'Failed to dispatch verification email via Resend HTTPS API.'
    };
  }
}

/**
 * Dispatch a live test email directly via Resend HTTPS API from Admin Panel Settings.
 * Completely replaces the blocked SMTP / Nodemailer connection test.
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
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || effective.resend_api_key?.trim() || dyn.resend_api_key?.trim();
  const { fromHeader, fromEmail, fromName, replyTo, usedFallback: webmailFallback } = resolveSafeSender(
    effective.email_from_name || dyn.email_from_name,
    effective.email_from || dyn.email_from
  );

  if (!resendApiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured in server environment variables. Please add RESEND_API_KEY to your Render environment variables.'
    };
  }

  try {
    const resend = getResendClient(resendApiKey);

    const logoUrl = `${baseUrl}/sociarax-logo.png`;

    const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SociaraX Email Delivery Test</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #e2e8f0;">
  <div style="max-width: 560px; margin: 30px auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="text-align: center; margin-bottom: 16px;">
        <a href="${baseUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
          <img src="${logoUrl}" alt="SociaraX" width="190" style="display: block; margin: 0 auto; max-width: 190px; width: 190px; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic;" />
        </a>
      </div>
      <span style="background: #182235; border: 1px solid #312e81; color: #818cf8; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: bold;">
        SociaraX Resend HTTPS Delivery Test
      </span>
      <h2 style="color: #ffffff; margin-top: 16px; margin-bottom: 8px; font-size: 20px;">Resend Email API Connected</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Your email delivery service is operational over secure HTTPS on Render.</p>
    </div>

    <div style="background-color: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 20px; font-size: 13px; line-height: 1.8;">
      <div style="color: #cbd5e1;"><strong>Configured Domain:</strong> <a href="${baseUrl}" style="color: #60a5fa; text-decoration: none;">${baseUrl}</a></div>
      <div style="color: #cbd5e1;"><strong>Sender:</strong> "${fromName}" &lt;${fromEmail}&gt;</div>
      <div style="color: #cbd5e1;"><strong>Transport Protocol:</strong> Resend HTTPS API (Port 443 - Render Free Compatible)</div>
      <div style="color: #cbd5e1;"><strong>Timestamp:</strong> ${new Date().toUTCString()}</div>
      <div style="color: #cbd5e1;"><strong>Status:</strong> <span style="color: #34d399; font-weight: bold;">Active &amp; Delivered</span></div>
    </div>

    <p style="margin-top: 24px; font-size: 12px; color: #64748b; text-align: center;">
      SociaraX Enterprise SMM Cloud &bull; Automated Resend test delivery
    </p>
  </div>
</body>
</html>`;

    let sendResult = await safeResendSend(resend, {
      from: fromHeader,
      to: [to.trim()],
      subject: `[SociaraX Test] Resend HTTPS Email API Verified Successfully`,
      text: `SociaraX Email Test: Your Resend HTTPS Email API and domain (${baseUrl}) are operational. Sent at ${new Date().toISOString()}.`,
      html: testHtml,
      ...(replyTo ? { replyTo } : {})
    });

    let domainFallbackUsed = false;
    // If Resend rejects because the domain is unverified on resend.com/domains:
    if (
      sendResult.error &&
      fromEmail !== 'onboarding@resend.dev' &&
      (
        sendResult.error.message?.toLowerCase().includes('not verified') ||
        sendResult.error.message?.toLowerCase().includes('domain') ||
        (sendResult.error as any).name === 'validation_error'
      )
    ) {
      console.log(`[EMAIL SERVICE] Sender domain "${fromEmail}" is unverified on Resend. Auto-retrying test email via onboarding@resend.dev...`);
      const fallbackFromHeader = formatFromHeader(fromName, 'onboarding@resend.dev');
      sendResult = await safeResendSend(resend, {
        from: fallbackFromHeader,
        to: [to.trim()],
        subject: `[SociaraX Test] Resend HTTPS Email API Verified Successfully`,
        text: `SociaraX Email Test: Your Resend HTTPS Email API and domain (${baseUrl}) are operational. Sent at ${new Date().toISOString()}.`,
        html: testHtml,
        replyTo: fromEmail
      });
      domainFallbackUsed = true;
    }

    if (sendResult.error) {
      if (isResendSandboxRestriction(sendResult.error)) {
        return {
          success: false,
          error: `Resend Sandbox Mode: Your API key is connected and working! However, onboarding@resend.dev only allows sending test emails to your registered Resend account owner email. To send to "${to}", please verify your custom domain at https://resend.com/domains and configure a Sender From Address using that domain.`
        };
      }

      console.error('[RESEND TEST EMAIL ERROR]:', sendResult.error.message || sendResult.error);
      return {
        success: false,
        error: sendResult.error.message || 'Resend rejected test email delivery. Please verify that your sender domain or onboarding@resend.dev is allowed.'
      };
    }

    let note = '';
    if (webmailFallback) {
      note = ` (via onboarding@resend.dev; public domains like @gmail.com cannot be used as Resend senders)`;
    } else if (domainFallbackUsed) {
      note = ` (via onboarding@resend.dev; "${fromEmail}" is not yet verified at https://resend.com/domains)`;
    }

    return {
      success: true,
      messageId: sendResult.data?.id,
      message: `Test email successfully delivered to ${to} via Resend HTTPS API${note}. Message ID: ${sendResult.data?.id}`
    };
  } catch (err: any) {
    console.error('[EMAIL TEST ERROR]:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to dispatch test email via Resend HTTPS API.'
    };
  }
}

export interface SendFraudSuspensionOptions {
  to: string;
  username?: string;
  paymentId: number;
  utrNumber?: string;
  amount?: number;
  req?: any;
}

/**
 * Dispatches a professional fraud rejection and account suspension warning
 * strictly to the user's registered email address.
 * NEVER routes to or uses ADMIN_EMAIL.
 */
export async function sendFraudSuspensionEmail({
  to,
  username,
  paymentId,
  utrNumber,
  amount,
  req
}: SendFraudSuspensionOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const recipient = to?.trim();
  if (!recipient || !recipient.includes('@')) {
    console.warn('[EMAIL SERVICE] Invalid recipient email for fraud suspension notice:', recipient);
    return { success: false, error: 'Valid user email required' };
  }

  const dyn = await getDynamicEmailSettings();
  const baseUrl = getAppBaseUrl(req, dyn.app_url);
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || dyn.resend_api_key?.trim();
  const { fromHeader, replyTo } = resolveSafeSender(
    process.env.EMAIL_FROM_NAME?.trim() || dyn.email_from_name,
    process.env.EMAIL_FROM?.trim() || dyn.email_from
  );

  const subject = `SociaraX — Payment Rejected & Account Suspended`;

  const text = `Hello ${username || 'Valued User'},

Your recent payment was rejected because it was identified as suspected fraudulent or scam activity.

As a result, your SociaraX account has been suspended and further orders are currently unavailable.

If you believe this decision was made in error, please contact SociaraX support for review.

Payment Reference:
- Payment ID: #${paymentId}
${utrNumber ? `- UTR / Transaction ID: ${utrNumber}\n` : ''}${amount ? `- Amount: ₹${amount}\n` : ''}
Regards,
SociaraX
${baseUrl}
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <div style="background-color: #030712; padding: 40px 16px; min-height: 100vh;">
    <div style="max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
      
      <!-- Brand Header -->
      <div style="padding: 28px 32px; background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
          Sociara<span style="color: #6366f1;">X</span>
        </div>
        <div style="margin-top: 10px; display: inline-block; padding: 4px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.5px;">
          Security Alert
        </div>
      </div>

      <!-- Main Body Content -->
      <div style="padding: 32px;">
        <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">
          Payment Rejected &amp; Account Suspended
        </h1>

        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Hello ${username ? `<strong>${username}</strong>` : 'Valued User'},
        </p>

        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Your recent payment was rejected because it was identified as suspected fraudulent or scam activity.
        </p>

        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          As a result, your SociaraX account has been suspended and further orders are currently unavailable.
        </p>

        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          If you believe this decision was made in error, please contact SociaraX support for review.
        </p>

        <!-- Payment Details Box -->
        <div style="background: #090d16; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">
            Transaction Details
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Payment ID:</td>
              <td style="color: #e2e8f0; font-weight: 600; text-align: right; padding: 4px 0;">#${paymentId}</td>
            </tr>
            ${utrNumber ? `<tr><td style="color: #64748b; padding: 4px 0;">UTR / Ref:</td><td style="color: #e2e8f0; font-family: monospace; font-weight: 600; text-align: right; padding: 4px 0;">${utrNumber}</td></tr>` : ''}
            ${amount ? `<tr><td style="color: #64748b; padding: 4px 0;">Amount:</td><td style="color: #ef4444; font-weight: 700; text-align: right; padding: 4px 0;">₹${amount}</td></tr>` : ''}
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Reason:</td>
              <td style="color: #ef4444; font-weight: 700; text-align: right; padding: 4px 0;">Fraud / Scam</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
          Regards,<br />
          <strong style="color: #e2e8f0;">SociaraX</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="padding: 20px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
        &copy; ${new Date().getFullYear()} SociaraX Enterprise SMM Infrastructure. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;

  if (!resendApiKey) {
    console.log(`[EMAIL SERVICE] RESEND_API_KEY is not configured. Fraud warning recorded for ${maskEmail(recipient)}.`);
    return { success: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }

  try {
    const resend = getResendClient(resendApiKey);
    const sendResult = await safeResendSend(resend, {
      from: fromHeader,
      to: [recipient],
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {})
    });

    if (sendResult.error) {
      return { success: false, error: sendResult.error.message || 'Resend delivery error' };
    }

    return { success: true, messageId: sendResult.data?.id };
  } catch (err: any) {
    console.error('[EMAIL SERVICE] Fraud suspension email error:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to dispatch email' };
  }
}

export interface SendCustomerReminderOptions {
  to: string;
  username?: string;
  req?: any;
}

/**
 * Optional manual customer reminder to inform an active customer they can place orders.
 * Triggered only manually by admin, rate-limited, and sent strictly to user registered email.
 */
export async function sendCustomerReminderEmail({
  to,
  username,
  req
}: SendCustomerReminderOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const recipient = to?.trim();
  if (!recipient || !recipient.includes('@')) {
    return { success: false, error: 'Valid user email required' };
  }

  const dyn = await getDynamicEmailSettings();
  const baseUrl = getAppBaseUrl(req, dyn.app_url);
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || dyn.resend_api_key?.trim();
  const { fromHeader, replyTo } = resolveSafeSender(
    process.env.EMAIL_FROM_NAME?.trim() || dyn.email_from_name,
    process.env.EMAIL_FROM?.trim() || dyn.email_from
  );

  const subject = `SociaraX — Your Account is Active & Ready`;

  const text = `Hello ${username || 'Valued User'},

Your SociaraX account is active. You can place your next order whenever you need our services.

Explore high-speed SMM services here:
${baseUrl}

Regards,
SociaraX
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <div style="background-color: #030712; padding: 40px 16px; min-height: 100vh;">
    <div style="max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
      <div style="padding: 28px 32px; background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
          Sociara<span style="color: #6366f1;">X</span>
        </div>
      </div>
      <div style="padding: 32px;">
        <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
          Your Account is Active &amp; Ready
        </h1>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Hello ${username ? `<strong>${username}</strong>` : 'Valued User'},
        </p>
        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
          Your SociaraX account is active. You can place your next order whenever you need our services.
        </p>
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${baseUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px;">
            Place New Order
          </a>
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
          Regards,<br />
          <strong style="color: #e2e8f0;">SociaraX</strong>
        </p>
      </div>
      <div style="padding: 20px 32px; background: #090d16; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
        &copy; ${new Date().getFullYear()} SociaraX Enterprise SMM Infrastructure. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;

  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }

  try {
    const resend = getResendClient(resendApiKey);
    const sendResult = await safeResendSend(resend, {
      from: fromHeader,
      to: [recipient],
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {})
    });

    if (sendResult.error) {
      return { success: false, error: sendResult.error.message || 'Resend delivery error' };
    }

    return { success: true, messageId: sendResult.data?.id };
  } catch (err: any) {
    console.error('[EMAIL SERVICE] Reminder delivery error:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to dispatch email' };
  }
}

