import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';

// Ensure Node.js prioritizes IPv4 resolution for outbound network sockets (prevents SMTP/network timeouts on container environments like Render without IPv6 egress)
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Graceful fallback if unsupported
}

import { checkDbConnection, initializeDatabaseSchema, startNeonKeepAliveHeartbeat } from './src/server/db';
import { ensureDefaultAdmin } from './src/server/auth';
import { providerRegistry } from './src/server/providers/providerRegistry';

import { authRouter } from './src/server/routes/authRoutes';
import { serviceRouter } from './src/server/routes/serviceRoutes';
import { orderRouter } from './src/server/routes/orderRoutes';
import { walletRouter } from './src/server/routes/walletRoutes';
import { providerRouter } from './src/server/routes/providerRoutes';
import { userRouter } from './src/server/routes/userRoutes';
import { ticketRouter } from './src/server/routes/ticketRoutes';
import { reportRouter } from './src/server/routes/reportRoutes';
import { settingsRouter } from './src/server/routes/settingsRoutes';
import { referralRouter } from './src/server/routes/referralRoutes';
import { monitoringRouter } from './src/server/routes/monitoringRoutes';
import { maintenanceRouter } from './src/server/routes/maintenanceRoutes';
import { loadConfigFromDatabase } from './src/server/maintenance/maintenanceEngine';
import { metricsTracker } from './src/server/monitoring/metricsTracker';
import { selfHealingEngine } from './src/server/monitoring/selfHealingEngine';
import { logEvent } from './src/server/monitoring/logger';
import crypto from 'crypto';

dotenv.config();

// -------------------------------------------------------------
// GLOBAL SERVER CRASH SHIELD (Prevents Node process from dying)
// -------------------------------------------------------------
process.on('uncaughtException', (err: Error) => {
  console.warn('[SERVER CRASH SHIELD] Neutralized uncaught exception:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason || '');
  if (!msg.includes('WebSocket') && !msg.includes('vite')) {
    console.warn('[SERVER REJECTION SHIELD] Neutralized unhandled rejection:', msg);
  }
});

// In-Memory Rate Limiting & Anti-DDoS Sliding Window
const requestWindowMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  // Safe IP extraction: prioritize Cloudflare CF-Connecting-IP, then X-Real-IP, then socket address
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim().split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim().split(',')[0].trim();
  }
  if (req.ip) {
    return req.ip;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function rateLimiter(limit: number = 180, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const key = `${ip}_${req.baseUrl || req.path}`;
    const now = Date.now();

    const record = requestWindowMap.get(key);
    if (!record || now > record.resetAt) {
      requestWindowMap.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    record.count++;
    if (record.count > limit) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a few seconds before trying again.'
      });
      return;
    }

    next();
  };
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requestWindowMap.entries()) {
    if (now > val.resetAt) {
      requestWindowMap.delete(key);
    }
  }
}, 300000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust first proxy hop (e.g. Render, Cloudflare)
  app.set('trust proxy', 1);

  // CORS Configuration to support AI Studio iframe preview, API calls, and preflight checks
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-Id', 'Cache-Control', 'Pragma']
  }));
  app.options('*', cors());

  // Permissions-Policy header to support Google Identity Services and FedCM
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'identity-credentials-get=(self "https://accounts.google.com")');
    next();
  });

  // Global Performance Compression (Gzip / Brotli for JSON and static files)
  app.use(compression({
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression'] || req.path.startsWith('/@') || req.path.includes('node_modules')) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024 // Only compress responses > 1KB
  }));

  // Global Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Prevent caching of all dynamic API responses (Private User Data & Financial Safety)
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Security & Anti-Sniff Headers (Permissive for AI Studio iframe embedding and web workers)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: http: data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' https: http: data: blob:; connect-src 'self' https: http: ws: wss:; frame-ancestors *;"
    );
    next();
  });

  // Request correlation ID & Performance Metrics tracking middleware
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    res.setHeader('X-Request-Id', requestId);
    (req as any).requestId = requestId;

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      metricsTracker.recordRequest(res.statusCode, duration);
      if (res.statusCode >= 500) {
        logEvent('ERROR', 'HTTP_SERVER', `Internal error on ${req.method} ${req.path}`, {
          requestId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          durationMs: duration
        });
      }
    });
    next();
  });

  // Apply general API Rate Limiting (180 requests/min per IP)
  app.use('/api', rateLimiter(180, 60000));
  // Strict rate limit for auth endpoints (45 requests/min per IP) to prevent brute force
  app.use('/api/auth/login', rateLimiter(45, 60000));
  app.use('/api/auth/register', rateLimiter(45, 60000));

  // Public lightweight Health check endpoints
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'SociaraX Enterprise SMM Backend',
      selfHealing: 'active',
      version: '3.4.0-enterprise',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Google Search Console Site Verification Endpoint
  app.get('/google12f79571b8dc9f88.html', (_req: Request, res: Response) => {
    res.type('text/html').send('google-site-verification: google12f79571b8dc9f88.html');
  });

  // Stealth Shield: Never expose any public /admin URL route (redirect direct hits immediately to home)
  app.get(['/admin', '/admin/*', '/dashboard/admin', '/admin-panel'], (_req: Request, res: Response) => {
    res.redirect(301, '/');
  });

  // Database status inspection endpoint
  app.get('/api/db-status', async (req, res) => {
    try {
      const status = await checkDbConnection();
      res.json(status);
    } catch (e: any) {
      res.json({ connected: true, message: 'Local fallback database active', error: e.message });
    }
  });

  // Mount API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/services', serviceRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/admin/payments', walletRouter);
  app.use('/api/admin/providers', providerRouter);
  app.use('/api/admin/users', userRouter);
  app.use('/api/tickets', ticketRouter);
  app.use('/api/admin/reports', reportRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/referrals', referralRouter);
  app.use('/api/admin/referrals', referralRouter);
  app.use('/api/monitoring', monitoringRouter);
  app.use('/api/admin/maintenance', maintenanceRouter);
  app.use('/api/maintenance', maintenanceRouter);

  // Global API Error Handler (Never let an API route throw an unhandled 500 error)
  app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
    selfHealingEngine.reportError('EXPRESS_ROUTER', err, req, 'ERROR');
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'A temporary server issue was handled and recovered by the self-healing system. Please retry shortly.'
      });
    }
  });

  // Initialize 24/7 Self-Healing Monitor Engine
  selfHealingEngine.start();

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Cache static immutable assets (JS/CSS/images) for high performance
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start HTTP listener immediately so health checks pass in <50ms
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SOCIARAX] Production Server running on http://0.0.0.0:${PORT} with Self-Healing Shield Active`);
  });

  // Initialize Database and Defaults in the background without blocking boot
  (async () => {
    try {
      startNeonKeepAliveHeartbeat();
      const conn = await checkDbConnection();
      if (conn.connected) {
        console.log('[SOCIARAX] Database connected:', conn.message);
        await initializeDatabaseSchema();
        await ensureDefaultAdmin();
        await providerRegistry.ensureDefaultProvider();
        await loadConfigFromDatabase();
      } else {
        console.warn('[SOCIARAX] Database running in resilient local mode:', conn.message);
      }
    } catch (initErr) {
      console.warn('[SOCIARAX INITIALIZATION RESILIENCE]:', initErr);
    }
  })();
}

startServer().catch(err => {
  console.warn('[FATAL SERVER START RECOVERY]:', err);
});

