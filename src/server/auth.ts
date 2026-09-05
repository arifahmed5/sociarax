import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { getDbPool } from './db';
import { encryptSecret, decryptSecret } from './totp';

const SESSION_SECRET = process.env.SESSION_SECRET || 'sociarax_session_super_secret_jwt_hmac_2026';
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure2026!SociaraX';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@sociarax.com').toLowerCase();

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  walletBalance: number;
  status: string;
}

export interface AuthenticatedAdmin {
  id: number;
  email: string;
  role: 'admin';
  totpEnabled: boolean;
}

// In-memory rate limiting map for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function checkRateLimit(ip: string, maxAttempts: number = 10, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  if (now - entry.lastAttempt > windowMs) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  entry.lastAttempt = now;
  return true;
}

export function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Sign a secure session token with HMAC-SHA256
 */
export function signSessionToken(payload: object, expiresInHours: number = 72): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

/**
 * Verify and decode session token
 */
export function verifySessionToken<T = any>(token: string): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${data}`).digest('base64url');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload as T;
  } catch {
    return null;
  }
}

/**
 * Ensure default Admin exists in database
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const db = getDbPool();
  if (!db) return;

  try {
    const client = await db.connect();
    try {
      const res = await client.query('SELECT id FROM admin_security WHERE email = $1', [ADMIN_EMAIL]);
      if (res.rowCount === 0) {
        const passwordHash = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 10);
        await client.query(`
          INSERT INTO admin_security (email, password_hash, totp_enabled)
          VALUES ($1, $2, FALSE)
        `, [ADMIN_EMAIL, passwordHash]);
        console.log(`[AUTH] Initial admin account initialized: ${ADMIN_EMAIL}`);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[AUTH] Failed to initialize default admin:', err);
  }
}

/**
 * Express Middleware: Authenticate User Session
 */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.sociarax_user_token;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : cookieToken;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    return;
  }

  const payload = verifySessionToken<{ userId: number; role: string }>(token);
  if (!payload || !payload.userId) {
    res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await db.query(
      'SELECT id, username, email, phone, role, wallet_balance, status, created_at FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rowCount === 0 || result.rows[0].status === 'suspended') {
      res.status(403).json({ success: false, error: 'Account is suspended or does not exist.' });
      return;
    }

    const row = result.rows[0];
    (req as any).user = {
      id: row.id,
      username: row.username,
      email: row.email,
      phone: row.phone || null,
      role: (row.role === 'admin' || row.email?.toLowerCase() === 'arifahmed87204@gmail.com' || row.username?.toLowerCase() === 'arifahmed56') ? 'admin' : row.role,
      walletBalance: parseFloat(row.wallet_balance) || 0,
      status: row.status,
      created_at: row.created_at
    };
    next();
  } catch (err: any) {
    console.error('[AUTH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Internal server authorization error' });
  }
}

/**
 * Express Middleware: Authenticate Admin Session
 */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.sociarax_admin_token || req.cookies?.sociarax_user_token;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : cookieToken;

  if (!token) {
    res.status(401).json({ success: false, error: 'Admin authentication required.' });
    return;
  }

  const payload = verifySessionToken<{ adminId?: number; userId?: number; email?: string; role?: string; totpVerified?: boolean }>(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  const db = getDbPool();
  if (!db) {
    res.status(503).json({ success: false, error: 'Database service unavailable' });
    return;
  }

  try {
    const targetId = payload.adminId || payload.userId;
    const targetEmail = payload.email;

    // Check admin_security table first
    if (payload.adminId || targetEmail) {
      const result = await db.query(
        'SELECT id, email, totp_enabled FROM admin_security WHERE id = $1 OR LOWER(email) = LOWER($2)',
        [targetId || 0, targetEmail || '']
      );

      if (result.rowCount && result.rowCount > 0) {
        const row = result.rows[0];
        (req as any).admin = {
          id: row.id,
          email: row.email,
          role: 'admin',
          totpEnabled: row.totp_enabled
        };
        next();
        return;
      }
    }

    // Check users table with admin role or owner email
    if (targetId || targetEmail) {
      const userRes = await db.query(
        "SELECT id, email, username, role FROM users WHERE (id = $1 OR LOWER(email) = LOWER($2)) AND (role = 'admin' OR LOWER(email) = 'arifahmed87204@gmail.com' OR LOWER(username) = 'arifahmed56')",
        [targetId || 0, targetEmail || '']
      );

      if (userRes.rowCount && userRes.rowCount > 0) {
        const row = userRes.rows[0];
        (req as any).admin = {
          id: row.id,
          email: row.email,
          role: 'admin',
          totpEnabled: true
        };
        next();
        return;
      }
    }

    res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
  } catch (err: any) {
    console.error('[ADMIN AUTH ERROR]:', err);
    res.status(500).json({ success: false, error: 'Internal server authorization error' });
  }
}
