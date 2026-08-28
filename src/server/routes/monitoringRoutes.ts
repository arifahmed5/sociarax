import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../auth';
import { selfHealingEngine } from '../monitoring/selfHealingEngine';
import { getRecentLogs, LogLevel } from '../monitoring/logger';
import { circuitRegistry } from '../monitoring/circuitBreaker';
import { runLiveSmokeTests } from '../monitoring/smokeTestRunner';

export const monitoringRouter = Router();

/**
 * Public lightweight ping endpoint
 * GET /api/monitoring/ping
 */
monitoringRouter.get('/ping', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * Admin System Diagnostic Report
 * GET /api/monitoring/status
 */
monitoringRouter.get('/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const report = selfHealingEngine.getDiagnosticReport();
    res.json({
      success: true,
      data: report
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate diagnostic report: ' + err.message
    });
  }
});

/**
 * Admin Sanitized Real-time System Logs
 * GET /api/monitoring/logs
 */
monitoringRouter.get('/logs', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const minLevel = (req.query.level as LogLevel) || undefined;
    const logs = getRecentLogs(limit, minLevel);
    res.json({
      success: true,
      data: logs
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs: ' + err.message
    });
  }
});

/**
 * Trigger Live Automated Smoke Tests & Diagnostics
 * POST /api/monitoring/run-smoke-tests
 */
monitoringRouter.post('/run-smoke-tests', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const results = await runLiveSmokeTests();
    res.json({
      success: true,
      data: results
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to execute smoke tests: ' + err.message
    });
  }
});

/**
 * Reset a specific or all circuit breakers
 * POST /api/monitoring/circuit-breaker/reset
 */
monitoringRouter.post('/circuit-breaker/reset', requireAdminAuth, (req: Request, res: Response) => {
  const { name } = req.body;
  
  if (name && (circuitRegistry as any)[name]) {
    (circuitRegistry as any)[name].reset();
    res.json({ success: true, message: `Circuit breaker [${name}] reset to CLOSED.` });
  } else if (!name || name === 'all') {
    Object.values(circuitRegistry).forEach(cb => cb.reset());
    res.json({ success: true, message: 'All circuit breakers reset to CLOSED.' });
  } else {
    res.status(400).json({ success: false, error: 'Unknown circuit breaker name.' });
  }
});
