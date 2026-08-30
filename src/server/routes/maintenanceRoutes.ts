import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../auth';
import {
  processMaintenanceInstruction,
  rollbackMaintenanceAction,
  getCurrentMaintenanceConfig,
  getMaintenanceLogs,
  updateMaintenanceConfigDirect,
  getConversationHistory,
  clearConversationHistory
} from '../maintenance/maintenanceEngine';

export const maintenanceRouter = Router();

/**
 * GET /api/admin/maintenance/chat/history
 * Get live AI chat conversation history
 */
maintenanceRouter.get('/chat/history', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    history: getConversationHistory()
  });
});

/**
 * POST /api/admin/maintenance/chat/clear
 * Clear AI chat conversation history
 */
maintenanceRouter.post('/chat/clear', requireAdminAuth, (req: Request, res: Response) => {
  clearConversationHistory();
  res.json({
    success: true,
    message: 'Chat history cleared successfully',
    history: getConversationHistory()
  });
});

/**
 * GET /api/settings/maintenance-config
 * Public endpoint to fetch live theme and website customizer settings
 */
maintenanceRouter.get('/public-config', (req: Request, res: Response) => {
  res.json({
    success: true,
    config: getCurrentMaintenanceConfig()
  });
});

/**
 * POST /api/admin/maintenance/execute
 * Analyze, audit and safely apply admin natural-language maintenance command
 */
maintenanceRouter.post('/execute', requireAdminAuth, async (req: Request, res: Response) => {
  const { command } = req.body;
  const adminEmail = (req as any).admin?.email || 'admin@sociarax.com';

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Command text is required.' });
    return;
  }

  try {
    const result = await processMaintenanceInstruction(command.trim(), adminEmail, false);
    if (!result.success) {
      res.status(403).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('[MAINTENANCE ROUTE EXECUTE ERROR]:', err);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred during maintenance execution: ' + (err?.message || err)
    });
  }
});

/**
 * POST /api/admin/maintenance/preview
 * Run safety scan and generate plan without applying changes
 */
maintenanceRouter.post('/preview', requireAdminAuth, async (req: Request, res: Response) => {
  const { command } = req.body;
  const adminEmail = (req as any).admin?.email || 'admin@sociarax.com';

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Command text is required.' });
    return;
  }

  try {
    const result = await processMaintenanceInstruction(command.trim(), adminEmail, true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Preview error: ' + (err?.message || err)
    });
  }
});

/**
 * GET /api/admin/maintenance/logs
 * Retrieve maintenance action logs
 */
maintenanceRouter.get('/logs', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    logs: getMaintenanceLogs()
  });
});

/**
 * POST /api/admin/maintenance/rollback
 * Rollback a specific maintenance action
 */
maintenanceRouter.post('/rollback', requireAdminAuth, async (req: Request, res: Response) => {
  const { logId } = req.body;
  if (!logId) {
    res.status(400).json({ success: false, error: 'Log ID is required for rollback.' });
    return;
  }

  try {
    const result = await rollbackMaintenanceAction(logId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Rollback failed: ' + (err?.message || err) });
  }
});

/**
 * GET /api/admin/maintenance/config
 * Get live maintenance config (Admin)
 */
maintenanceRouter.get('/config', requireAdminAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    config: getCurrentMaintenanceConfig()
  });
});

/**
 * POST /api/admin/maintenance/config
 * Direct manual update of maintenance parameters
 */
maintenanceRouter.post('/config', requireAdminAuth, async (req: Request, res: Response) => {
  const { config } = req.body;
  const adminEmail = (req as any).admin?.email || 'admin@sociarax.com';

  if (!config || typeof config !== 'object') {
    res.status(400).json({ success: false, error: 'Invalid config payload.' });
    return;
  }

  try {
    const updated = await updateMaintenanceConfigDirect(config, adminEmail);
    res.json({
      success: true,
      message: 'Maintenance configuration updated directly.',
      config: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Update failed: ' + (err?.message || err) });
  }
});
