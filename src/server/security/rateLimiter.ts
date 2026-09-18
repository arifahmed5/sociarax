/**
 * SociaraX Enterprise Server-Side Rate Limiter & Anti-Abuse Protection Layer
 * 
 * Provides robust in-memory rate limiting, concurrency limiting, and request flood protection:
 * - Global API rate limiting (120 req/min per IP)
 * - Strict authentication rate limiting (10 attempts/15 min per IP)
 * - Order flood protection (10 submissions/min per user, max 2 concurrent)
 * - Payment / Wallet abuse protection (5 deposits/10 min per user, 20 wallet actions/min)
 * - Support desk spam protection (5 tickets/hour, 20 replies/hour per user)
 * - Expensive provider & catalog sync protection
 * - Fail-safe design with zero sensitive data leaks
 * - Compatible with Render single-instance Node deployments behind reverse proxy
 */

import { Request, Response, NextFunction } from 'express';

// ==========================================
// TYPES & DATA STRUCTURES
// ==========================================

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  limit: number | ((req: Request) => number);
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
  skip?: (req: Request) => boolean;
  name?: string;
}

export interface ConcurrencyLimiterOptions {
  maxConcurrent: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
  name?: string;
}

// In-Memory Storage Maps
const rateLimitStore = new Map<string, RateLimitRecord>();
const concurrencyStore = new Map<string, number>();

// Safety bounds: Max 50,000 active entries to prevent heap exhaustion under distributed floods
const MAX_STORE_ENTRIES = 50000;

// Periodic cleanup of expired rate limit records (runs every 60 seconds)
const cleanupInterval = setInterval(() => {
  try {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, record] of rateLimitStore.entries()) {
      if (now >= record.resetAt) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }
    // If still oversized due to active keys, prune oldest 20%
    if (rateLimitStore.size > MAX_STORE_ENTRIES) {
      const keysToDelete = Array.from(rateLimitStore.keys()).slice(0, Math.floor(MAX_STORE_ENTRIES * 0.2));
      for (const k of keysToDelete) {
        rateLimitStore.delete(k);
      }
    }
  } catch (err: any) {
    // Non-fatal, keep process alive
  }
}, 60000);

// Prevent cleanup interval from blocking process termination
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

// ==========================================
// REAL IP EXTRACTION (Render / Trusted Proxy)
// ==========================================

/**
 * Extracts and sanitizes the client IP address.
 * Respects Express 'trust proxy 1' configuration (standard on Render).
 * Sanitizes input to prevent header injection or spoofing.
 */
export function getSafeClientIp(req: Request): string {
  try {
    // 1. Prioritize Express-resolved req.ip (which validates upstream hops using app.set('trust proxy', 1))
    if (req.ip && typeof req.ip === 'string') {
      const sanitized = sanitizeIp(req.ip);
      if (sanitized) return sanitized;
    }

    // 2. Direct socket address fallback
    if (req.socket && req.socket.remoteAddress) {
      const sanitized = sanitizeIp(req.socket.remoteAddress);
      if (sanitized) return sanitized;
    }

    // 3. Render / reverse proxy standard X-Forwarded-For fallback
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      // First IP in chain is the original client IP
      const firstIp = xff.split(',')[0].trim();
      const sanitized = sanitizeIp(firstIp);
      if (sanitized) return sanitized;
    }

    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Validates IPv4 or IPv6 characters, rejecting header tampering
 */
function sanitizeIp(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6
  // Match standard IPv4 or IPv6 characters only
  if (/^[0-9a-fA-F:.]+$/.test(cleaned) && cleaned.length <= 45) {
    return cleaned;
  }
  return '';
}

/**
 * Extracts authenticated user ID if present (from req.user, req.admin, or session token)
 */
export function getAuthenticatedUserId(req: Request): number | null {
  if ((req as any).user?.id && typeof (req as any).user.id === 'number') {
    return (req as any).user.id;
  }
  if ((req as any).admin?.id && typeof (req as any).admin.id === 'number') {
    return (req as any).admin.id;
  }
  // Try extracting from authorization header or cookie token if req.user is not yet attached
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.sociarax_user_token || req.cookies?.sociarax_admin_token;
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : cookieToken;
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const data = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const uid = data.userId || data.adminId || data.id;
        if (typeof uid === 'number') return uid;
      }
    }
  } catch {
    // Non-fatal, fallback to null
  }
  return null;
}

// ==========================================
// LOW-LEVEL RATE CHECK ENGINE
// ==========================================

/**
 * Atomically checks and updates rate limit counter for a given key
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 15 * 60 * 1000
): boolean {
  try {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now >= record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (record.count >= limit) {
      return false;
    }

    record.count++;
    return true;
  } catch {
    // Fail-open to avoid breaking legitimate requests on unexpected internal error
    return true;
  }
}

/**
 * Explicitly resets rate limit for a key (e.g. after successful action or test)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Retrieves remaining attempts and reset time for headers/diagnostics
 */
export function getRateLimitStatus(key: string, limit: number): { remaining: number; resetInMs: number } {
  const record = rateLimitStore.get(key);
  const now = Date.now();
  if (!record || now >= record.resetAt) {
    return { remaining: limit, resetInMs: 0 };
  }
  return {
    remaining: Math.max(0, limit - record.count),
    resetInMs: Math.max(0, record.resetAt - now)
  };
}

// ==========================================
// MIDDLEWARE GENERATORS
// ==========================================

/**
 * Creates an Express rate-limiting middleware
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    limit,
    keyGenerator = (req: Request) => `ip_${getSafeClientIp(req)}`,
    message = 'Too many requests. Please try again later.',
    statusCode = 429,
    skip,
    name = 'rate_limiter'
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (skip && skip(req)) {
        return next();
      }

      // Never rate-limit preflight OPTIONS
      if (req.method === 'OPTIONS') {
        return next();
      }

      const key = `${name}_${keyGenerator(req)}`;
      const effectiveLimit = typeof limit === 'function' ? limit(req) : limit;
      const now = Date.now();

      let record = rateLimitStore.get(key);
      if (!record || now >= record.resetAt) {
        record = { count: 1, resetAt: now + windowMs };
        rateLimitStore.set(key, record);

        // Security headers
        res.setHeader('X-RateLimit-Limit', effectiveLimit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveLimit - 1));
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
        return next();
      }

      record.count++;

      const remaining = Math.max(0, effectiveLimit - record.count);
      res.setHeader('X-RateLimit-Limit', effectiveLimit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > effectiveLimit) {
        const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
        res.setHeader('Retry-After', retryAfterSec);

        res.status(statusCode).json({
          success: false,
          error: message
        });
        return;
      }

      next();
    } catch (err: any) {
      // Fail-safe: internal limiter errors must never crash the server
      console.warn(`[RATE LIMIT FAIL-SAFE] (${name}):`, err?.message || 'internal check error');
      next();
    }
  };
}

/**
 * Creates an Express concurrency-limiting middleware.
 * Prevents a single IP or user from exhausting Node resources with parallel requests.
 * Does NOT queue unbounded requests in memory.
 */
export function createConcurrencyLimiter(options: ConcurrencyLimiterOptions) {
  const {
    maxConcurrent,
    keyGenerator = (req: Request) => `cc_ip_${getSafeClientIp(req)}`,
    message = 'Too many concurrent requests in progress. Please wait a moment.',
    statusCode = 429,
    name = 'concurrency_limiter'
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.method === 'OPTIONS') {
        return next();
      }

      const key = `${name}_${keyGenerator(req)}`;
      const current = concurrencyStore.get(key) || 0;

      if (current >= maxConcurrent) {
        res.status(statusCode).json({
          success: false,
          error: message
        });
        return;
      }

      // Increment active counter
      concurrencyStore.set(key, current + 1);

      // Decrement on completion or client disconnect
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          const active = concurrencyStore.get(key) || 1;
          if (active <= 1) {
            concurrencyStore.delete(key);
          } else {
            concurrencyStore.set(key, active - 1);
          }
        }
      };

      res.on('finish', release);
      res.on('close', release);

      next();
    } catch (err: any) {
      // Fail-safe
      console.warn(`[CONCURRENCY FAIL-SAFE] (${name}):`, err?.message || 'internal check error');
      next();
    }
  };
}

// ==========================================
// PRE-CONFIGURED PRODUCTION LIMITERS
// ==========================================

/**
 * 1. Global API Rate Limiter
 * - 120 requests per IP per 1 minute
 * - Applies to all /api/* routes
 */
export const globalApiLimiter = createRateLimiter({
  name: 'global_api',
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Too many requests. Please try again later.',
  keyGenerator: (req) => getSafeClientIp(req)
});

/**
 * 2. Authentication Rate Limiter
 * - 10 attempts per IP per 15 minutes
 * - Login, Registration, Google OAuth, TOTP verification
 */
export const authLimiter = createRateLimiter({
  name: 'auth_attempt',
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  keyGenerator: (req) => getSafeClientIp(req)
});

/**
 * 3. Order Flood Protection Limiter (User + IP Dual Guard)
 * - Maximum 10 orders per user per 1 minute
 * - Maximum 20 orders per IP per 1 minute (for non-authenticated or shared IPs)
 * - Executes strictly before LuvSMM provider calls and wallet deductions
 */
export const orderSubmissionLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = getSafeClientIp(req);
  const userId = getAuthenticatedUserId(req);

  // Check IP limit: 20 per minute
  if (!checkRateLimit(`order_ip_${ip}`, 20, 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: 'Order request rate limit exceeded for this network. Please wait a minute before submitting more orders.'
    });
    return;
  }

  // Check User limit: 10 per minute
  if (userId) {
    if (!checkRateLimit(`order_user_${userId}`, 10, 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'You have submitted too many orders in a short time. Please wait a minute before placing more orders.'
      });
      return;
    }
  }

  next();
};

/**
 * Concurrency guard for order creation
 * Maximum 2 simultaneous orders per user or IP
 */
export const orderConcurrencyLimiter = createConcurrencyLimiter({
  name: 'order_exec',
  maxConcurrent: 2,
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `user_${userId}` : `ip_${getSafeClientIp(req)}`;
  },
  message: 'An order is already being processed for your account. Please wait a moment.'
});

/**
 * 4. Payment / Deposit Submission Limiter
 * - Maximum 5 deposit requests per user per 10 minutes
 * - Maximum 10 deposit requests per IP per 10 minutes
 */
export const paymentSubmissionLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = getSafeClientIp(req);
  const userId = getAuthenticatedUserId(req);

  // Check IP limit: 10 per 10 minutes
  if (!checkRateLimit(`deposit_ip_${ip}`, 10, 10 * 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: 'Too many payment requests from this network. Please try again later.'
    });
    return;
  }

  // Check User limit: 5 per 10 minutes
  if (userId) {
    if (!checkRateLimit(`deposit_user_${userId}`, 5, 10 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'Too many payment requests submitted. Please wait 10 minutes before submitting another payment.'
      });
      return;
    }
  }

  next();
};

/**
 * Concurrency guard for payment and wallet mutations
 * Maximum 2 simultaneous wallet/payment operations per user
 */
export const walletConcurrencyLimiter = createConcurrencyLimiter({
  name: 'wallet_exec',
  maxConcurrent: 2,
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `user_${userId}` : `ip_${getSafeClientIp(req)}`;
  },
  message: 'A wallet transaction is already in progress. Please wait a moment.'
});

/**
 * Wallet sensitive operations limiter (20 requests per user per minute)
 */
export const walletSensitiveLimiter = createRateLimiter({
  name: 'wallet_sens',
  windowMs: 60 * 1000,
  limit: 20,
  message: 'Too many wallet operations. Please wait a minute.',
  keyGenerator: (req) => {
    const userId = getAuthenticatedUserId(req);
    return userId ? `user_${userId}` : `ip_${getSafeClientIp(req)}`;
  }
});

/**
 * 5. Support Desk Spam Protection
 * - Maximum 5 new tickets per user per hour
 * - Maximum 20 replies per user per hour
 */
export const ticketCreateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = getSafeClientIp(req);
  const userId = getAuthenticatedUserId(req);

  if (!checkRateLimit(`ticket_ip_${ip}`, 10, 60 * 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: 'Ticket submission rate limit reached for this network. Please wait an hour.'
    });
    return;
  }

  if (userId) {
    if (!checkRateLimit(`ticket_user_${userId}`, 5, 60 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'You have submitted the maximum of 5 support tickets this hour. Please wait before creating a new ticket.'
      });
      return;
    }
  }

  next();
};

export const ticketReplyLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = getSafeClientIp(req);
  const userId = getAuthenticatedUserId(req);

  if (!checkRateLimit(`reply_ip_${ip}`, 30, 60 * 60 * 1000)) {
    res.status(429).json({
      success: false,
      error: 'Reply rate limit reached for this network. Please wait a while.'
    });
    return;
  }

  if (userId) {
    if (!checkRateLimit(`reply_user_${userId}`, 20, 60 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: 'You have sent the maximum of 20 replies this hour. Please wait before sending more messages.'
      });
      return;
    }
  }

  next();
};

/**
 * 6. Expensive Admin & System Operations Limiters
 * - Provider API test & live balance: 15 req/min
 * - Catalog sync: 5 req/10 min
 * - Email dispatches: 5 req/10 min
 * - Storage maintenance: 3 req/15 min
 */
export const providerActionLimiter = createRateLimiter({
  name: 'prov_action',
  windowMs: 60 * 1000,
  limit: 15,
  message: 'Provider operation rate limit reached. Please wait a minute before retrying.',
  keyGenerator: (req) => `admin_${getAuthenticatedUserId(req) || getSafeClientIp(req)}`
});

export const serviceSyncLimiter = createRateLimiter({
  name: 'svc_sync',
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: 'Service catalog sync rate limit reached. Please wait 10 minutes before syncing again.',
  keyGenerator: (req) => `admin_${getAuthenticatedUserId(req) || getSafeClientIp(req)}`
});

export const emailTriggerLimiter = createRateLimiter({
  name: 'email_dispatch',
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: 'Email dispatch rate limit reached. Please wait 10 minutes before sending more emails.',
  keyGenerator: (req) => `admin_${getAuthenticatedUserId(req) || getSafeClientIp(req)}`
});

export const storageMaintenanceLimiter = createRateLimiter({
  name: 'maint_db',
  windowMs: 15 * 60 * 1000,
  limit: 3,
  message: 'Database storage maintenance can only be executed up to 3 times per 15 minutes.',
  keyGenerator: (req) => `admin_${getAuthenticatedUserId(req) || getSafeClientIp(req)}`
});
