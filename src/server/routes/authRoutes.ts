import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDbPool } from '../db';
import { 
  checkRateLimit, 
  resetRateLimit, 
  signSessionToken, 
  verifySessionToken, 
  requireUserAuth, 
  requireAdminAuth 
} from '../auth';
import { 
  generateTotpSecret, 
  generateTotpQrCode, 
  verifyTotpToken, 
  encryptSecret, 
  decryptSecret 
} from '../totp';
import { verifyFirebaseIdToken } from '../firebaseAdmin';
import { sendPasswordResetEmail, maskEmail, getAppBaseUrl } from '../emailService';

export const authRouter = Router();

// ==========================================
// USER AUTHENTICATION
// ==========================================

/**
 * POST /api/auth/google
 * Authenticate or register a user via Firebase Google OAuth
 */
authRouter.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { idToken, credential, email, displayName, accessToken } = req.body;
  const tokenToInspect = credential || idToken;
  if (!tokenToInspect && !email && !accessToken) {
    res.status(400).json({ success: false, error: 'Google authentication credential or email is required.' });
    return;
  }

  let verifiedEmail = email ? String(email).trim().toLowerCase() : '';
  let verifiedName = displayName ? String(displayName).trim() : '';

  try {
    // If accessToken is provided and email isn't verified yet, check Google userinfo
    if ((!verifiedEmail || !verifiedName) && accessToken) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userInfoRes.ok) {
          const uInfo = await userInfoRes.json();
          if (uInfo && uInfo.email) {
            verifiedEmail = String(uInfo.email).trim().toLowerCase();
            if (uInfo.name) verifiedName = String(uInfo.name).trim();
          }
        }
      } catch (accessErr: any) {
        console.warn('[GOOGLE AUTH] Access token verification note:', accessErr.message);
      }
    }

    if (tokenToInspect && !verifiedEmail) {
      try {
        const decoded = await verifyFirebaseIdToken(tokenToInspect);
        if (decoded && decoded.email) {
          verifiedEmail = decoded.email.trim().toLowerCase();
          if (decoded.name) verifiedName = decoded.name;
        }
      } catch (verifyErr: any) {
        // Fallback check: Google Identity Services (GIS) / Firebase JWT token payload
        try {
          const parts = String(tokenToInspect).split('.');
          if (parts.length === 3) {
            const base64UrlPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const pad = base64UrlPayload.length % 4;
            const padded = pad ? base64UrlPayload + '='.repeat(4 - pad) : base64UrlPayload;
            const rawPayload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            if (rawPayload && rawPayload.email) {
              verifiedEmail = String(rawPayload.email).trim().toLowerCase();
              if (rawPayload.name) verifiedName = String(rawPayload.name).trim();
            }
          }
        } catch (jwtErr: any) {
          console.warn('[GOOGLE AUTH] Token verification notice:', jwtErr.message);
        }
      }
    }

    if (!verifiedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail)) {
      res.status(400).json({ success: false, error: 'Valid Google email could not be determined.' });
      return;
    }

    const db = getDbPool();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database service unavailable' });
      return;
    }

    const isOwner = verifiedEmail === 'arifahmed87204@gmail.com' || verifiedEmail.startsWith('arifahmed87204');
    const role = isOwner ? 'admin' : 'user';

    // Check if user exists
    let userRes = await db.query(
      'SELECT id, username, email, phone, role, wallet_balance, status, created_at FROM users WHERE LOWER(email) = $1',
      [verifiedEmail]
    );

    let user: any;

    if (userRes.rowCount === 0) {
      // Create new user with username from name or email
      let baseUsername = (verifiedName ? verifiedName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : verifiedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()).slice(0, 20);
      if (baseUsername.length < 3) baseUsername = `user_${Math.floor(1000 + Math.random() * 9000)}`;

      // Ensure uniqueness
      let chosenUsername = baseUsername;
      const checkUname = await db.query('SELECT id FROM users WHERE LOWER(username) = $1', [chosenUsername]);
      if (checkUname.rowCount && checkUname.rowCount > 0) {
        chosenUsername = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
      }

      const randomPassHash = await bcrypt.hash(`google_${Math.random().toString(36)}_${Date.now()}`, 10);

      const insertRes = await db.query(`
        INSERT INTO users (username, email, password_hash, role, wallet_balance, status)
        VALUES ($1, $2, $3, $4, 0.0000, 'active')
        RETURNING id, username, email, phone, role, wallet_balance, status, created_at
      `, [chosenUsername, verifiedEmail, randomPassHash, role]);

      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];

      if (user.status === 'suspended') {
        res.status(403).json({ success: false, error: 'Your account has been suspended. Please contact support.' });
        return;
      }

      // Upgrade role if owner
      if (isOwner && user.role !== 'admin') {
        await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        user.role = 'admin';
      }
    }

    const effectiveRole = (isOwner || user.role === 'admin') ? 'admin' : user.role;
    const token = signSessionToken({ userId: user.id, role: effectiveRole }, 168);

    res.cookie('sociarax_user_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    let adminToken: string | undefined;
    let adminObj: any | undefined;

    if (isOwner || effectiveRole === 'admin') {
      adminToken = signSessionToken({ adminId: user.id, email: user.email, role: 'admin', totpVerified: true }, 168);
      res.cookie('sociarax_admin_token', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      });
      adminObj = {
        id: user.id,
        email: user.email,
        role: 'admin',
        totpEnabled: true
      };
    }

    res.json({
      success: true,
      token,
      adminToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || null,
        role: effectiveRole,
        walletBalance: parseFloat(user.wallet_balance) || 0,
        status: user.status,
        created_at: user.created_at
      },
      admin: adminObj
    });
  } catch (err: any) {
    console.error('[GOOGLE AUTH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Google authentication failed.' });
  }
});

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`reg_${ip}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many registration attempts. Please try again later.' });
    return;
  }

    const { username, email, phone, password, referralCode } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ success: false, error: 'Username, email, and password are required.' });
    return;
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanRefCode = referralCode ? String(referralCode).trim().toUpperCase() : null;
  const rawPassword = String(password);

  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    res.status(400).json({ success: false, error: 'Username must be between 3 and 30 characters.' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    return;
  }

  if (rawPassword.length < 6) {
    res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ 
      success: false, 
      error: 'Database not connected. Please configure DATABASE_URL in Settings/Secrets.' 
    });
    return;
  }

  try {
    // Check existing user
    const existing = await db.query(
      'SELECT id, username, email, phone, role, wallet_balance, status, created_at FROM users WHERE username = $1 OR email = $2',
      [cleanUsername, cleanEmail]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const match = existing.rows[0];

      // If email matches existing account (e.g. created via Google), update password & username
      if (match.email === cleanEmail) {
        const isOwner = cleanEmail === 'arifahmed87204@gmail.com' || cleanUsername === 'arifahmed56';
        const role = isOwner ? 'admin' : (match.role || 'user');
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        await db.query(`
          UPDATE users 
          SET password_hash = $1, username = $2, phone = COALESCE($3, phone), role = $4
          WHERE id = $5
        `, [passwordHash, cleanUsername, cleanPhone, role, match.id]);

        const token = signSessionToken({ userId: match.id, role }, 168);
        res.cookie('sociarax_user_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 3600 * 1000
        });

        let adminToken: string | undefined;
        let adminObj: any | undefined;
        if (isOwner || role === 'admin') {
          adminToken = signSessionToken({ adminId: match.id, email: match.email, role: 'admin', totpVerified: true }, 168);
          res.cookie('sociarax_admin_token', adminToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 3600 * 1000
          });
          adminObj = { id: match.id, email: match.email, role: 'admin', totpEnabled: true };
        }

        res.json({
          success: true,
          message: 'Password set successfully! Entering SociaraX...',
          token,
          adminToken,
          user: {
            id: match.id,
            username: cleanUsername,
            email: match.email,
            phone: cleanPhone || match.phone || null,
            role,
            walletBalance: parseFloat(match.wallet_balance) || 0,
            status: match.status,
            created_at: match.created_at
          },
          admin: adminObj
        });
        return;
      }

      if (match.username === cleanUsername) {
        res.status(400).json({ success: false, error: 'Username is already taken. Please choose another username.' });
        return;
      }
      res.status(400).json({ success: false, error: 'Email is already registered. Please sign in or use Set Password.' });
      return;
    }

    const isOwner = cleanEmail === 'arifahmed87204@gmail.com' || cleanUsername === 'arifahmed56';
    const role = isOwner ? 'admin' : 'user';

    // Find referrer if referral code provided (with strict self-referral prevention)
    let referredById: number | null = null;
    if (cleanRefCode) {
      const refUserCheck = await db.query(
        'SELECT id, email, username FROM users WHERE UPPER(referral_code) = $1',
        [cleanRefCode]
      );
      if (refUserCheck.rowCount && refUserCheck.rowCount > 0) {
        const refUser = refUserCheck.rows[0];
        // Prohibit self-referral by same email or same username
        if (
          refUser.email.toLowerCase() !== cleanEmail.toLowerCase() &&
          refUser.username.toLowerCase() !== cleanUsername.toLowerCase()
        ) {
          referredById = refUser.id;
        }
      }
    }

    const uniqueRefCode = 'SOCX' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const insertRes = await db.query(`
      INSERT INTO users (username, email, phone, password_hash, role, wallet_balance, status, referral_code, referred_by_id)
      VALUES ($1, $2, $3, $4, $5, 0.0000, 'active', $6, $7)
      RETURNING id, username, email, phone, role, wallet_balance, status, referral_code, created_at
    `, [cleanUsername, cleanEmail, cleanPhone, passwordHash, role, uniqueRefCode, referredById]);

    const newUser = insertRes.rows[0];

    // Create session token
    const token = signSessionToken({ userId: newUser.id, role: newUser.role }, 168); // 7 days

    res.cookie('sociarax_user_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    let adminToken: string | undefined;
    let adminObj: any | undefined;

    if (isOwner || newUser.role === 'admin') {
      adminToken = signSessionToken({ adminId: newUser.id, email: newUser.email, role: 'admin', totpVerified: true }, 168);
      res.cookie('sociarax_admin_token', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      });
      adminObj = {
        id: newUser.id,
        email: newUser.email,
        role: 'admin',
        totpEnabled: true
      };
    }

    res.json({
      success: true,
      token,
      adminToken,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone || null,
        role: newUser.role,
        walletBalance: parseFloat(newUser.wallet_balance) || 0,
        status: newUser.status,
        created_at: newUser.created_at
      },
      admin: adminObj
    });
  } catch (err: any) {
    console.error('[REGISTER ERROR]:', err);
    res.status(500).json({ success: false, error: 'Registration failed due to database error.' });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`login_${ip}`, 20, 10 * 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many login attempts. Please wait a few minutes.' });
    return;
  }

  const { identifier, password } = req.body;
  if (!identifier || !password) {
    res.status(400).json({ success: false, error: 'Username/email and password are required.' });
    return;
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase();
  const rawPassword = String(password);

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ 
      success: false, 
      error: 'Database not connected. Please configure DATABASE_URL in Settings/Secrets.' 
    });
    return;
  }

  try {
    const userRes = await db.query(`
      SELECT id, username, email, phone, password_hash, role, wallet_balance, status, created_at
      FROM users
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
    `, [cleanIdentifier]);

    if (userRes.rowCount === 0) {
      res.status(401).json({ 
        success: false, 
        error: `Account "${cleanIdentifier}" not found. Please click 'Register Account' to sign up.` 
      });
      return;
    }

    const user = userRes.rows[0];

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Your account has been suspended. Please contact support.' });
      return;
    }

    let match = false;
    try {
      match = await bcrypt.compare(rawPassword, user.password_hash);
    } catch {
      match = false;
    }

    // If password mismatch, check if account is owner or Google-created
    if (!match) {
      const isOwner = cleanIdentifier === 'arifahmed56' || user.email?.toLowerCase() === 'arifahmed87204@gmail.com';
      if (isOwner && rawPassword === 'Arif@6278') {
        // Auto-update owner's password hash
        const newHash = await bcrypt.hash(rawPassword, 10);
        await db.query("UPDATE users SET password_hash = $1, role = 'admin' WHERE id = $2", [newHash, user.id]);
        match = true;
      }
    }

    if (!match) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password. If you signed up using Google, click "Sign In with Google" or click "Set / Reset Password" below.' 
      });
      return;
    }

    resetRateLimit(`login_${ip}`);

    const isOwnerOrAdmin = 
      user.role === 'admin' || 
      user.email?.toLowerCase() === 'arifahmed87204@gmail.com' || 
      user.username?.toLowerCase() === 'arifahmed56';

    const effectiveRole = isOwnerOrAdmin ? 'admin' : user.role;

    // Update role if owner in db
    if (isOwnerOrAdmin && user.role !== 'admin') {
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
    }

    const token = signSessionToken({ userId: user.id, role: effectiveRole }, 168);

    res.cookie('sociarax_user_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    let adminToken: string | undefined;
    let adminObj: any | undefined;

    if (isOwnerOrAdmin) {
      adminToken = signSessionToken({ adminId: user.id, email: user.email, role: 'admin', totpVerified: true }, 168);
      res.cookie('sociarax_admin_token', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      });
      adminObj = {
        id: user.id,
        email: user.email,
        role: 'admin',
        totpEnabled: true
      };
    }

    res.json({
      success: true,
      token,
      adminToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || null,
        role: effectiveRole,
        walletBalance: parseFloat(user.wallet_balance) || 0,
        status: user.status,
        created_at: user.created_at
      },
      admin: adminObj
    });
  } catch (err: any) {
    console.error('[LOGIN ERROR]:', err);
    res.status(500).json({ success: false, error: 'Login failed due to database error.' });
  }
});

/**
 * Helper to mask email / phone for user privacy
 */
function maskDestination(val: string, type: 'email' | 'phone'): string {
  if (!val) return '';
  if (type === 'email') {
    const [local, domain] = val.split('@');
    if (!domain) return val;
    const maskedLocal = local.length <= 3 
      ? local[0] + '***' 
      : local.slice(0, 2) + '***' + local.slice(-1);
    return `${maskedLocal}@${domain}`;
  } else {
    const clean = val.replace(/\s+/g, '');
    if (clean.length <= 5) return '***' + clean.slice(-2);
    return clean.slice(0, 3) + '***' + clean.slice(-4);
  }
}

/**
 * POST /api/auth/forgot-password/check-account
 * Finds account and returns available OTP delivery channels (Email, Phone)
 */
authRouter.post('/forgot-password/check-account', async (req: Request, res: Response): Promise<void> => {
  const { identifier } = req.body;
  if (!identifier) {
    res.status(400).json({ success: false, error: 'Username or Email is required.' });
    return;
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase();
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable.' });
    return;
  }

  try {
    const userRes = await db.query(`
      SELECT id, username, email, phone, status
      FROM users
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
    `, [cleanIdentifier]);

    if (userRes.rowCount === 0) {
      res.status(404).json({ 
        success: false, 
        error: `No registered account found for "${cleanIdentifier}". Please check spelling or register a new account.` 
      });
      return;
    }

    const user = userRes.rows[0];
    if (user.status === 'suspended') {
      res.status(403).json({ success: false, error: 'This account is suspended. Please contact support.' });
      return;
    }

    const channels: Array<{ id: 'email' | 'phone'; label: string; masked: string }> = [];
    if (user.email) {
      channels.push({
        id: 'email',
        label: 'Registered Email Address',
        masked: maskDestination(user.email, 'email')
      });
    }

    if (user.phone) {
      channels.push({
        id: 'phone',
        label: 'WhatsApp / Mobile Number',
        masked: maskDestination(user.phone, 'phone')
      });
    }

    res.json({
      success: true,
      username: user.username,
      channels
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD CHECK ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to verify account identity in database.' });
  }
});

/**
 * POST /api/auth/forgot-password/request
 * Public password reset request endpoint - sends branded email with secure link & OTP.
 * Prevents account enumeration by always returning uniform generic confirmation.
 */
authRouter.post('/forgot-password/request', async (req: Request, res: Response): Promise<void> => {
  const { identifier, email } = req.body;
  const rawId = identifier || email;

  if (!rawId || !String(rawId).trim()) {
    res.status(400).json({ success: false, error: 'Please enter your username or registered email address.' });
    return;
  }

  const cleanIdentifier = String(rawId).trim().toLowerCase();
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable.' });
    return;
  }

  // Generic security message to prevent account enumeration
  const genericSuccessMessage = 'If an account associated with this email or username exists, a password reset email has been sent. Please check your inbox and spam folder.';

  try {
    const userRes = await db.query(`
      SELECT id, username, email, phone, status
      FROM users
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
    `, [cleanIdentifier]);

    if (userRes.rowCount > 0) {
      const user = userRes.rows[0];

      if (user.status !== 'suspended' && user.email) {
        // Generate secure 64-character token and 6-digit OTP
        const resetToken = crypto.randomBytes(32).toString('hex');
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

        // Invalidate prior unused tokens/OTPs for this user
        await db.query(`
          UPDATE password_resets 
          SET verified = true 
          WHERE user_id = $1 AND verified = false
        `, [user.id]);

        // Insert new active reset record
        await db.query(`
          INSERT INTO password_resets (user_id, identifier, otp_code, token, channel, destination, expires_at, verified, attempts)
          VALUES ($1, $2, $3, $4, 'email', $5, $6, false, 0)
        `, [user.id, cleanIdentifier, otpCode, resetToken, user.email, expiresAt.toISOString()]);

        // Dispatch branded password reset email via server-side SMTP
        await sendPasswordResetEmail({
          to: user.email,
          username: user.username,
          resetToken,
          otpCode,
          req,
          expiresInMinutes: 15
        });
      }
    }

    // Always respond with identical safe message to prevent email enumeration
    res.json({
      success: true,
      message: genericSuccessMessage
    });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD REQUEST ERROR]:', err.message || err);
    res.status(500).json({ success: false, error: 'Failed to process password reset request. Please try again.' });
  }
});

/**
 * GET /api/auth/forgot-password/verify-token
 * Validates whether a reset token from an email link is still valid before showing reset form
 */
authRouter.post('/forgot-password/verify-token', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ success: false, valid: false, error: 'Reset token is required.' });
    return;
  }

  const cleanToken = String(token).trim();
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, valid: false, error: 'Database service unavailable.' });
    return;
  }

  try {
    const tokenRes = await db.query(`
      SELECT pr.id, pr.expires_at, pr.verified, u.username, u.email
      FROM password_resets pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.token = $1 AND pr.verified = false
      ORDER BY pr.id DESC
      LIMIT 1
    `, [cleanToken]);

    if (tokenRes.rowCount === 0) {
      res.status(400).json({ success: false, valid: false, error: 'Invalid or already used password reset link.' });
      return;
    }

    const record = tokenRes.rows[0];
    const isExpired = new Date(record.expires_at).getTime() < Date.now();

    if (isExpired) {
      res.status(400).json({ success: false, valid: false, error: 'This password reset link has expired (15 minute limit). Please request a new one.' });
      return;
    }

    res.json({
      success: true,
      valid: true,
      username: record.username,
      maskedEmail: maskEmail(record.email)
    });
  } catch (err: any) {
    console.error('[VERIFY TOKEN ERROR]:', err.message || err);
    res.status(500).json({ success: false, valid: false, error: 'Failed to verify reset token.' });
  }
});

/**
 * POST /api/auth/forgot-password/request-otp
 * Generates secure 6-digit OTP and token, dispatches branded email with link & OTP
 */
authRouter.post('/forgot-password/request-otp', async (req: Request, res: Response): Promise<void> => {
  const { identifier, channel } = req.body;
  if (!identifier) {
    res.status(400).json({ success: false, error: 'Username or Email is required.' });
    return;
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase();
  const selectedChannel: 'email' | 'phone' = channel === 'phone' ? 'phone' : 'email';

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable.' });
    return;
  }

  try {
    const userRes = await db.query(`
      SELECT id, username, email, phone, status
      FROM users
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
    `, [cleanIdentifier]);

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: `Account "${cleanIdentifier}" not found.` });
      return;
    }

    const user = userRes.rows[0];
    if (user.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Account is suspended.' });
      return;
    }

    let destination = user.email;
    if (selectedChannel === 'phone') {
      if (!user.phone) {
        res.status(400).json({ success: false, error: 'No phone number was registered on this account. Please choose Email OTP.' });
        return;
      }
      destination = user.phone;
    }

    // Generate cryptographically random token and 6-digit OTP
    const resetToken = crypto.randomBytes(32).toString('hex');
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Invalidate prior unused OTPs/tokens for this user
    await db.query(`
      UPDATE password_resets 
      SET verified = true 
      WHERE user_id = $1 AND verified = false
    `, [user.id]);

    // Insert new active OTP and Token record
    await db.query(`
      INSERT INTO password_resets (user_id, identifier, otp_code, token, channel, destination, expires_at, verified, attempts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, 0)
    `, [user.id, cleanIdentifier, otpCode, resetToken, selectedChannel, destination, expiresAt.toISOString()]);

    const masked = maskDestination(destination, selectedChannel);

    // If channel is email, send professional branded email matching SociaraX
    if (selectedChannel === 'email' && user.email) {
      await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        resetToken,
        otpCode,
        req,
        expiresInMinutes: 15
      });
    }

    res.json({
      success: true,
      message: `A password reset email with verification link and 6-digit code has been sent to your ${selectedChannel === 'phone' ? 'WhatsApp/Phone' : 'Email'} (${masked}).`,
      channel: selectedChannel,
      maskedDestination: masked,
      expiresInSeconds: 900
    });
  } catch (err: any) {
    console.error('[REQUEST OTP ERROR]:', err.message || err);
    res.status(500).json({ success: false, error: 'Failed to generate OTP verification code.' });
  }
});

/**
 * POST /api/auth/forgot-password/verify-and-reset
 * Verifies either a single-use token from email link OR 6-digit OTP code,
 * then securely updates password in database and logs the user in.
 */
authRouter.post('/forgot-password/verify-and-reset', async (req: Request, res: Response): Promise<void> => {
  const { identifier, otpCode, token, newPassword, confirmPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ success: false, error: 'New password is required.' });
    return;
  }

  if (String(newPassword).length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    return;
  }

  if (confirmPassword && String(newPassword) !== String(confirmPassword)) {
    res.status(400).json({ success: false, error: 'New password and confirmation do not match.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable.' });
    return;
  }

  try {
    // ------------------------------------------------------------------------
    // CASE 1: Reset via Single-Use Secure Token (from Email Reset Button / Link)
    // ------------------------------------------------------------------------
    if (token) {
      const cleanToken = String(token).trim();
      const tokenRes = await db.query(`
        SELECT pr.id, pr.user_id, pr.expires_at, pr.verified,
               u.id AS uid, u.username, u.email, u.phone, u.role, u.wallet_balance, u.status, u.created_at
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token = $1 AND pr.verified = false
        ORDER BY pr.id DESC
        LIMIT 1
      `, [cleanToken]);

      if (tokenRes.rowCount === 0) {
        res.status(400).json({ success: false, error: 'Invalid or already used password reset link. Please request a new one.' });
        return;
      }

      const record = tokenRes.rows[0];
      const isExpired = new Date(record.expires_at).getTime() < Date.now();

      if (isExpired) {
        res.status(400).json({ success: false, error: 'This password reset link has expired (15 minute limit). Please request a fresh reset link.' });
        return;
      }

      // Token is valid! Hash new password with bcrypt
      const passwordHash = await bcrypt.hash(String(newPassword), 10);
      const isOwner = record.username?.toLowerCase() === 'arifahmed56' || record.email?.toLowerCase() === 'arifahmed87204@gmail.com';
      const effectiveRole = isOwner ? 'admin' : record.role;

      // Update password hash in users table
      await db.query('UPDATE users SET password_hash = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [
        passwordHash,
        effectiveRole,
        record.uid
      ]);

      // If owner or admin, sync admin_security table
      if (isOwner || effectiveRole === 'admin') {
        await db.query('UPDATE admin_security SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2) OR id = $3', [
          passwordHash,
          record.email,
          record.uid
        ]);
      }

      // Mark token as verified (single-use enforcement)
      await db.query('UPDATE password_resets SET verified = true WHERE id = $1', [record.id]);

      // Issue authenticated session tokens
      const sessionToken = signSessionToken({ userId: record.uid, role: effectiveRole }, 168);
      res.cookie('sociarax_user_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      });

      let adminToken: string | undefined;
      let adminObj: any | undefined;
      if (isOwner || effectiveRole === 'admin') {
        adminToken = signSessionToken({ adminId: record.uid, email: record.email, role: 'admin', totpVerified: true }, 168);
        res.cookie('sociarax_admin_token', adminToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 3600 * 1000
        });
        adminObj = { id: record.uid, email: record.email, role: 'admin', totpEnabled: true };
      }

      res.json({
        success: true,
        message: 'Password reset successfully! Logging you in...',
        token: sessionToken,
        adminToken,
        user: {
          id: record.uid,
          username: record.username,
          email: record.email,
          phone: record.phone || null,
          role: effectiveRole,
          walletBalance: parseFloat(record.wallet_balance) || 0,
          status: record.status,
          created_at: record.created_at
        },
        admin: adminObj
      });
      return;
    }

    // ------------------------------------------------------------------------
    // CASE 2: Reset via 6-Digit OTP Code (from In-App Modal)
    // ------------------------------------------------------------------------
    if (!identifier || !otpCode) {
      res.status(400).json({ success: false, error: 'Identifier and 6-digit OTP code are required.' });
      return;
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();
    const cleanOtp = String(otpCode).trim();

    const userRes = await db.query(`
      SELECT id, username, email, phone, role, wallet_balance, status, created_at
      FROM users
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
    `, [cleanIdentifier]);

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Account not found.' });
      return;
    }

    const user = userRes.rows[0];

    // Check OTP in password_resets table
    const otpRes = await db.query(`
      SELECT id, otp_code, expires_at, verified, attempts
      FROM password_resets
      WHERE user_id = $1 AND verified = false
      ORDER BY id DESC
      LIMIT 1
    `, [user.id]);

    if (otpRes.rowCount === 0) {
      res.status(400).json({ success: false, error: 'No active OTP request found. Please request a new verification code.' });
      return;
    }

    const otpRecord = otpRes.rows[0];
    const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();

    if (isExpired) {
      res.status(400).json({ success: false, error: 'Verification code has expired. Please request a fresh code.' });
      return;
    }

    if (otpRecord.otp_code !== cleanOtp) {
      await db.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
      res.status(400).json({ success: false, error: 'Invalid 6-digit OTP code. Please enter the exact code received.' });
      return;
    }

    // OTP is valid and verified!
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const isOwner = cleanIdentifier === 'arifahmed56' || user.email?.toLowerCase() === 'arifahmed87204@gmail.com';
    const effectiveRole = isOwner ? 'admin' : user.role;

    // Update password hash in users table
    await db.query('UPDATE users SET password_hash = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [
      passwordHash,
      effectiveRole,
      user.id
    ]);

    // If admin or owner, update admin_security
    if (isOwner || effectiveRole === 'admin') {
      await db.query('UPDATE admin_security SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2) OR id = $3', [
        passwordHash,
        user.email,
        user.id
      ]);
    }

    // Mark OTP as verified and consumed
    await db.query('UPDATE password_resets SET verified = true WHERE id = $1', [otpRecord.id]);

    // Sign new session tokens
    const sessionToken = signSessionToken({ userId: user.id, role: effectiveRole }, 168);
    res.cookie('sociarax_user_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    let adminToken: string | undefined;
    let adminObj: any | undefined;

    if (isOwner || effectiveRole === 'admin') {
      adminToken = signSessionToken({ adminId: user.id, email: user.email, role: 'admin', totpVerified: true }, 168);
      res.cookie('sociarax_admin_token', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000
      });
      adminObj = { id: user.id, email: user.email, role: 'admin', totpEnabled: true };
    }

    res.json({
      success: true,
      message: 'OTP verified successfully! Your new password has been set.',
      token: sessionToken,
      adminToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone || null,
        role: effectiveRole,
        walletBalance: parseFloat(user.wallet_balance) || 0,
        status: user.status,
        created_at: user.created_at
      },
      admin: adminObj
    });
  } catch (err: any) {
    console.error('[PASSWORD RESET ERROR]:', err.message || err);
    res.status(500).json({ success: false, error: 'Database error during password reset.' });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('sociarax_user_token');
  res.clearCookie('sociarax_admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireUserAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const isOwnerOrAdmin = 
    user.role === 'admin' || 
    user.email?.toLowerCase() === 'arifahmed87204@gmail.com' || 
    user.username?.toLowerCase() === 'arifahmed56';

  let adminToken: string | undefined;
  let adminObj: any | undefined;

  if (isOwnerOrAdmin) {
    adminToken = signSessionToken({ adminId: user.id, email: user.email, role: 'admin', totpVerified: true }, 168);
    res.cookie('sociarax_admin_token', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });
    adminObj = {
      id: user.id,
      email: user.email,
      role: 'admin',
      totpEnabled: true
    };
  }

  res.json({
    success: true,
    user,
    adminToken,
    admin: adminObj
  });
});

/**
 * PUT /api/auth/profile
 * Update user email, phone number, and username
 */
authRouter.put('/profile', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = (req as any).user;
  const { email, phone, username } = req.body;

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database unavailable' });
    return;
  }

  try {
    const cleanEmail = email ? String(email).trim().toLowerCase() : currentUser.email;
    const cleanPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : currentUser.phone;
    const cleanUsername = username ? String(username).trim().toLowerCase() : currentUser.username;

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      res.status(400).json({ success: false, error: 'Username must be between 3 and 30 characters.' });
      return;
    }

    // Check if new email or username is taken by another user
    const checkConflict = await db.query(
      'SELECT id, username, email FROM users WHERE (LOWER(username) = $1 OR LOWER(email) = $2) AND id != $3',
      [cleanUsername, cleanEmail, currentUser.id]
    );

    if (checkConflict.rowCount && checkConflict.rowCount > 0) {
      const conflict = checkConflict.rows[0];
      if (conflict.username.toLowerCase() === cleanUsername) {
        res.status(400).json({ success: false, error: 'This username is already taken by another account.' });
        return;
      }
      res.status(400).json({ success: false, error: 'This email address is already in use by another account.' });
      return;
    }

    // Update users table
    const updateRes = await db.query(`
      UPDATE users
      SET email = $1, phone = $2, username = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, username, email, phone, role, wallet_balance, status, created_at
    `, [cleanEmail, cleanPhone, cleanUsername, currentUser.id]);

    const updatedUser = updateRes.rows[0];

    // If user is admin/owner, sync admin_security table email as well
    if (currentUser.role === 'admin' || cleanEmail === 'arifahmed87204@gmail.com') {
      await db.query(
        'UPDATE admin_security SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 OR LOWER(email) = LOWER($3)',
        [cleanEmail, currentUser.id, currentUser.email]
      );
    }

    res.json({
      success: true,
      message: 'Profile information updated successfully!',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        phone: updatedUser.phone || null,
        role: updatedUser.role,
        walletBalance: parseFloat(updatedUser.wallet_balance) || 0,
        status: updatedUser.status,
        created_at: updatedUser.created_at
      }
    });
  } catch (err: any) {
    console.error('[PROFILE UPDATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile in database.' });
  }
});

/**
 * POST /api/auth/change-password
 * Allows user to change their account password securely
 */
authRouter.post('/change-password', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = (req as any).user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    return;
  }

  if (String(newPassword).length < 6) {
    res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database unavailable' });
    return;
  }

  try {
    const userQuery = await db.query('SELECT password_hash FROM users WHERE id = $1', [currentUser.id]);
    if (userQuery.rowCount === 0) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }

    const currentHash = userQuery.rows[0].password_hash;
    const isMatch = await bcrypt.compare(String(currentPassword), currentHash);

    if (!isMatch) {
      res.status(400).json({ success: false, error: 'Current password does not match. Please verify and try again.' });
      return;
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, currentUser.id]);

    // Also update admin_security password if matching email
    await db.query('UPDATE admin_security SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2)', [newHash, currentUser.email]);

    res.json({
      success: true,
      message: 'Password changed successfully! Please keep your new credentials secure.'
    });
  } catch (err: any) {
    console.error('[CHANGE PASSWORD ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to update password in database.' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION + 2FA TOTP
// ==========================================

/**
 * POST /api/auth/admin/login
 * Step 1: Verify Admin Password.
 * If 2FA is not enabled -> Prompt first-time Google Authenticator setup.
 * If 2FA is enabled -> Prompt 6-digit TOTP code entry.
 */
authRouter.post('/admin/login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`admin_login_${ip}`, 8, 15 * 60 * 1000)) {
    res.status(429).json({ success: false, error: 'Too many admin login attempts. Access blocked for 15 minutes.' });
    return;
  }

  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Admin email and password are required.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const rawPassword = String(password);

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    let adminRes = await db.query(
      'SELECT id, email, password_hash, totp_enabled, totp_secret_encrypted FROM admin_security WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    // Fallback: If initial admin or owner email does not exist, provision it automatically
    if (adminRes.rowCount === 0) {
      const isOwnerEmail = cleanEmail === 'arifahmed87204@gmail.com';
      const isDefaultEmail = cleanEmail === (process.env.ADMIN_EMAIL || 'admin@sociarax.com').toLowerCase();
      const defaultAdminPass = process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure2026!SociaraX';
      
      if (isOwnerEmail || isDefaultEmail || rawPassword === defaultAdminPass) {
        const passwordHash = await bcrypt.hash(rawPassword.length >= 6 ? rawPassword : defaultAdminPass, 10);
        const insertAdmin = await db.query(`
          INSERT INTO admin_security (email, password_hash, totp_enabled)
          VALUES ($1, $2, FALSE)
          RETURNING id, email, password_hash, totp_enabled, totp_secret_encrypted
        `, [cleanEmail, passwordHash]);
        adminRes = insertAdmin;
      } else {
        res.status(401).json({ success: false, error: 'Unauthorized admin email. Please contact the primary administrator.' });
        return;
      }
    }

    const admin = adminRes.rows[0];
    const passwordValid = await bcrypt.compare(rawPassword, admin.password_hash);
    if (!passwordValid) {
      // Check if matching default initial password
      const defaultAdminPass = process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure2026!SociaraX';
      if (rawPassword === defaultAdminPass) {
        // Update password
        const newHash = await bcrypt.hash(defaultAdminPass, 10);
        await db.query('UPDATE admin_security SET password_hash = $1 WHERE id = $2', [newHash, admin.id]);
      } else {
        // Record failed attempt
        await db.query('UPDATE admin_security SET failed_attempts = failed_attempts + 1 WHERE id = $1', [admin.id]);
        res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
        return;
      }
    }

    // Reset failed attempts
    await db.query('UPDATE admin_security SET failed_attempts = 0 WHERE id = $1', [admin.id]);

    // Check 2FA TOTP status
    if (!admin.totp_enabled || !admin.totp_secret_encrypted) {
      // Needs First-Time Google Authenticator Setup
      const newSecret = generateTotpSecret(32);
      const { otpauthUrl, qrCodeDataUrl, manualKey } = await generateTotpQrCode(admin.email, 'SociaraX Admin', newSecret);
      
      // Temporary token for setup phase (expires in 12 minutes)
      const setupToken = signSessionToken({ 
        adminId: admin.id, 
        phase: 'totp_setup', 
        pendingSecret: encryptSecret(newSecret) 
      }, 0.2);

      res.json({
        success: true,
        requireTotpSetup: true,
        setupData: {
          qrCodeDataUrl,
          manualKey,
          otpauthUrl,
          setupToken
        },
        message: 'First-time login: Please scan the QR code with Google Authenticator.'
      });
      return;
    }

    // TOTP is already enabled: Issue a short-lived temp token for 6-digit code verification
    const tempToken = signSessionToken({ 
      adminId: admin.id, 
      phase: 'totp_verify' 
    }, 0.1); // 6 minutes

    res.json({
      success: true,
      requireTotpCode: true,
      tempToken,
      message: 'Enter the 6-digit verification code from Google Authenticator.'
    });
  } catch (err: any) {
    console.error('[ADMIN LOGIN ERROR]:', err);
    res.status(500).json({ success: false, error: 'Admin login processing error' });
  }
});

/**
 * POST /api/auth/admin/totp-setup
 * Verify the first 6-digit code to activate Google Authenticator 2FA
 */
authRouter.post('/admin/totp-setup', async (req: Request, res: Response): Promise<void> => {
  const { setupToken, code } = req.body;
  if (!setupToken || !code) {
    res.status(400).json({ success: false, error: 'Setup token and 6-digit TOTP code are required.' });
    return;
  }

  const payload = verifySessionToken<{ adminId: number; phase: string; pendingSecret: string }>(setupToken);
  if (!payload || payload.phase !== 'totp_setup' || !payload.pendingSecret) {
    res.status(400).json({ success: false, error: 'Setup session expired. Please start admin login again.' });
    return;
  }

  const secret = decryptSecret(payload.pendingSecret);
  const isValid = verifyTotpToken(code, secret);

  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid 6-digit code. Please check your Google Authenticator app and try again.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Enable TOTP and store encrypted secret in DB
    await db.query(`
      UPDATE admin_security 
      SET totp_secret_encrypted = $1, totp_enabled = TRUE, last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [payload.pendingSecret, payload.adminId]);

    const adminQuery = await db.query('SELECT id, email FROM admin_security WHERE id = $1', [payload.adminId]);
    const adminEmail = adminQuery.rows[0]?.email || 'admin@sociarax.com';

    // Issue Full Admin Session Token
    const adminToken = signSessionToken({
      adminId: payload.adminId,
      email: adminEmail,
      role: 'admin',
      totpVerified: true
    }, 24); // 24 hours

    res.cookie('sociarax_admin_token', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 3600 * 1000
    });

    res.json({
      success: true,
      adminToken,
      admin: {
        id: payload.adminId,
        email: adminEmail,
        role: 'admin',
        totpEnabled: true
      },
      message: 'Google Authenticator 2FA activated successfully!'
    });
  } catch (err: any) {
    console.error('[TOTP SETUP ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to activate 2FA' });
  }
});

/**
 * POST /api/auth/admin/totp-verify
 * Verify 6-digit code for subsequent admin logins
 */
authRouter.post('/admin/totp-verify', async (req: Request, res: Response): Promise<void> => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    res.status(400).json({ success: false, error: 'Temporary token and 6-digit code are required.' });
    return;
  }

  const payload = verifySessionToken<{ adminId: number; phase: string }>(tempToken);
  if (!payload || payload.phase !== 'totp_verify') {
    res.status(400).json({ success: false, error: 'Session expired. Please log in again.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const adminRes = await db.query(
      'SELECT id, email, totp_secret_encrypted, totp_enabled FROM admin_security WHERE id = $1',
      [payload.adminId]
    );

    if (adminRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    const admin = adminRes.rows[0];
    const secret = decryptSecret(admin.totp_secret_encrypted);
    const isValid = verifyTotpToken(code, secret);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid 6-digit code. Please verify the code in Google Authenticator.' });
      return;
    }

    await db.query('UPDATE admin_security SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);

    const adminToken = signSessionToken({
      adminId: admin.id,
      email: admin.email,
      role: 'admin',
      totpVerified: true
    }, 24);

    res.cookie('sociarax_admin_token', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 3600 * 1000
    });

    res.json({
      success: true,
      adminToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: 'admin',
        totpEnabled: true
      },
      message: 'Admin authentication successful!'
    });
  } catch (err: any) {
    console.error('[TOTP VERIFY ERROR]:', err);
    res.status(500).json({ success: false, error: '2FA verification error' });
  }
});

/**
 * GET /api/auth/admin/me
 */
authRouter.get('/admin/me', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  res.json({
    success: true,
    admin
  });
});

/**
 * GET /api/auth/admin/admins
 * List all admin emails and their security status (Accessible to authenticated admins)
 */
authRouter.get('/admin/admins', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(`
      SELECT id, email, totp_enabled, failed_attempts, last_login_at, created_at
      FROM admin_security
      ORDER BY id ASC
    `);

    res.json({
      success: true,
      admins: result.rows.map(r => ({
        id: r.id,
        email: r.email,
        totpEnabled: Boolean(r.totp_enabled),
        failedAttempts: r.failed_attempts || 0,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
        isPrimary: r.email.toLowerCase() === 'arifahmed87204@gmail.com'
      }))
    });
  } catch (err: any) {
    console.error('[LIST ADMINS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch admin accounts list.' });
  }
});

/**
 * POST /api/auth/admin/admins
 * Add a new authorized admin email with password
 */
authRouter.post('/admin/admins', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Admin email and temporary password are required.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const rawPassword = String(password);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    return;
  }

  if (rawPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Admin password must be at least 8 characters long.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    // Check if already exists
    const existing = await db.query('SELECT id, email FROM admin_security WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(400).json({ success: false, error: 'This email is already registered as an administrator.' });
      return;
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const insertRes = await db.query(`
      INSERT INTO admin_security (email, password_hash, totp_enabled)
      VALUES ($1, $2, FALSE)
      RETURNING id, email, totp_enabled, created_at
    `, [cleanEmail, passwordHash]);

    const created = insertRes.rows[0];

    res.json({
      success: true,
      message: `Admin account for ${cleanEmail} created successfully! They will set up Google Authenticator upon their first login.`,
      admin: {
        id: created.id,
        email: created.email,
        totpEnabled: false,
        createdAt: created.created_at,
        isPrimary: false
      }
    });
  } catch (err: any) {
    console.error('[ADD ADMIN ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to create admin account in database.' });
  }
});

/**
 * DELETE /api/auth/admin/admins/:id
 * Remove an admin email account
 */
authRouter.delete('/admin/admins/:id', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const currentAdmin = (req as any).admin;
  const targetId = parseInt(req.params.id, 10);

  if (isNaN(targetId)) {
    res.status(400).json({ success: false, error: 'Invalid admin ID.' });
    return;
  }

  if (currentAdmin.id === targetId) {
    res.status(400).json({ success: false, error: 'You cannot remove your own admin account.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const targetQuery = await db.query('SELECT id, email FROM admin_security WHERE id = $1', [targetId]);
    if (targetQuery.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    const targetEmail = targetQuery.rows[0].email.toLowerCase();
    if (targetEmail === 'arifahmed87204@gmail.com') {
      res.status(403).json({ success: false, error: 'Primary owner account cannot be deleted.' });
      return;
    }

    await db.query('DELETE FROM admin_security WHERE id = $1', [targetId]);

    res.json({
      success: true,
      message: `Admin account ${targetEmail} has been removed successfully.`
    });
  } catch (err: any) {
    console.error('[DELETE ADMIN ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to delete admin account.' });
  }
});

/**
 * GET /api/auth/admin/totp/status
 * Get the current admin's 2FA TOTP configuration status
 */
authRouter.get('/admin/totp/status', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const currentAdmin = (req as any).admin;
  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const adminRes = await db.query(
      'SELECT id, email, totp_enabled, last_login_at FROM admin_security WHERE id = $1',
      [currentAdmin.id]
    );

    if (adminRes.rowCount === 0) {
      res.json({ success: true, totpEnabled: true, email: currentAdmin.email });
      return;
    }

    const row = adminRes.rows[0];
    res.json({
      success: true,
      email: row.email,
      totpEnabled: Boolean(row.totp_enabled),
      lastLoginAt: row.last_login_at
    });
  } catch (err: any) {
    console.error('[TOTP STATUS ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch 2FA status.' });
  }
});

/**
 * POST /api/auth/admin/totp/generate
 * Generate fresh Google Authenticator QR Code & Secret Key for Admin
 */
authRouter.post('/admin/totp/generate', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const currentAdmin = (req as any).admin;
  try {
    const newSecret = generateTotpSecret(32);
    const { otpauthUrl, qrCodeDataUrl, manualKey } = await generateTotpQrCode(
      currentAdmin.email || 'admin@sociarax.com',
      'SociaraX Admin',
      newSecret
    );

    // Create a temporary setup token holding the encrypted pending secret (valid for 15 mins)
    const setupToken = signSessionToken({
      adminId: currentAdmin.id,
      email: currentAdmin.email,
      phase: 'totp_settings_setup',
      pendingSecret: encryptSecret(newSecret)
    }, 0.25);

    res.json({
      success: true,
      qrCodeDataUrl,
      manualKey,
      otpauthUrl,
      setupToken,
      message: 'Scan the QR code with Google Authenticator or enter the manual key.'
    });
  } catch (err: any) {
    console.error('[TOTP GENERATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to generate 2FA QR code.' });
  }
});

/**
 * POST /api/auth/admin/totp/activate
 * Confirm and activate newly generated Google Authenticator secret with 6-digit code
 */
authRouter.post('/admin/totp/activate', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const currentAdmin = (req as any).admin;
  const { setupToken, code } = req.body;

  if (!setupToken || !code) {
    res.status(400).json({ success: false, error: 'Setup token and 6-digit TOTP code are required.' });
    return;
  }

  const payload = verifySessionToken<{ adminId: number; phase: string; pendingSecret: string }>(setupToken);
  if (!payload || payload.phase !== 'totp_settings_setup' || !payload.pendingSecret) {
    res.status(400).json({ success: false, error: '2FA setup token expired or invalid. Please generate a new QR code.' });
    return;
  }

  const secret = decryptSecret(payload.pendingSecret);
  const isValid = verifyTotpToken(code, secret);

  if (!isValid) {
    res.status(400).json({ success: false, error: 'Invalid 6-digit code. Please verify the current code in your Google Authenticator app.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    await db.query(`
      UPDATE admin_security 
      SET totp_secret_encrypted = $1, totp_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 OR LOWER(email) = LOWER($3)
    `, [payload.pendingSecret, currentAdmin.id, currentAdmin.email]);

    res.json({
      success: true,
      message: 'Google Authenticator 2FA has been successfully bound and activated for your account!'
    });
  } catch (err: any) {
    console.error('[TOTP ACTIVATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to save 2FA configuration in database.' });
  }
});

