import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { checkDbConnection, initializeDatabaseSchema } from './src/server/db';
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

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Security Headers & Request Logger
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Database status inspection endpoint
  app.get('/api/db-status', async (req, res) => {
    const status = await checkDbConnection();
    res.json(status);
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

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SociaraX Enterprise SMM Backend',
      timestamp: new Date().toISOString()
    });
  });

  // Initialize Database and Defaults in the background
  try {
    const conn = await checkDbConnection();
    if (conn.connected) {
      console.log('[SOCIARAX] Database connected successfully:', conn.message);
      await initializeDatabaseSchema();
      await ensureDefaultAdmin();
      await providerRegistry.ensureDefaultProvider();
    } else {
      console.warn('[SOCIARAX] Database connection pending:', conn.message);
    }
  } catch (initErr) {
    console.error('[SOCIARAX INITIALIZATION ERROR]:', initErr);
  }

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SOCIARAX] Production Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[FATAL SERVER START ERROR]:', err);
});
