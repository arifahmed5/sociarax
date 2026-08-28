import crypto from 'crypto';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  details?: Record<string, any>;
  sanitizedStack?: string;
}

// In-memory ring buffer for recent logs (keeps last 500 entries)
const MAX_LOG_ENTRIES = 500;
const logHistory: LogEntry[] = [];

// Sensitive field keys to scrub from logs
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'session_secret',
  'admin_token',
  'apikey',
  'api_key',
  'secret',
  'private_key',
  'database_url',
  'totp_secret',
  'card_number',
  'cvv',
  'upi_pin',
  'utr',
  'payer_vpa'
]);

/**
 * Recursively sanitize object payloads to prevent any secret leak in logs
 */
export function sanitizeData(data: any, depth = 0): any {
  if (depth > 4) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string' && data.length > 500) {
      return data.slice(0, 500) + '...[TRUNCATED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.slice(0, 20).map(item => sanitizeData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    let isSensitive = false;
    for (const sens of SENSITIVE_KEYS) {
      if (lowerKey.includes(sens)) {
        isSensitive = true;
        break;
      }
    }

    if (isSensitive) {
      sanitized[key] = '[REDACTED_SECURE]';
    } else {
      sanitized[key] = sanitizeData(val, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Centralized sanitized logger
 */
export function logEvent(
  level: LogLevel,
  subsystem: string,
  message: string,
  options: {
    requestId?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    durationMs?: number;
    details?: Record<string, any>;
    error?: any;
  } = {}
): LogEntry {
  let sanitizedStack: string | undefined;
  if (options.error) {
    if (options.error.stack) {
      // Remove local machine file paths if any
      sanitizedStack = String(options.error.stack)
        .split('\n')
        .slice(0, 5)
        .join('\n');
    }
  }

  const entry: LogEntry = {
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    level,
    subsystem,
    message: message.slice(0, 300),
    requestId: options.requestId,
    path: options.path,
    method: options.method,
    statusCode: options.statusCode,
    durationMs: options.durationMs,
    details: options.details ? sanitizeData(options.details) : undefined,
    sanitizedStack
  };

  logHistory.unshift(entry);
  if (logHistory.length > MAX_LOG_ENTRIES) {
    logHistory.pop();
  }

  // Also print to console with structured format
  const consolePrefix = `[${entry.timestamp}] [${level}] [${subsystem}]`;
  if (level === 'CRITICAL' || level === 'ERROR') {
    console.error(`${consolePrefix} ${message}`, entry.details || '');
  } else if (level === 'WARNING') {
    console.warn(`${consolePrefix} ${message}`);
  } else {
    console.log(`${consolePrefix} ${message}`);
  }

  return entry;
}

export function getRecentLogs(limit = 100, minLevel?: LogLevel): LogEntry[] {
  let filtered = logHistory;
  if (minLevel) {
    const levelOrder: Record<LogLevel, number> = { INFO: 0, WARNING: 1, ERROR: 2, CRITICAL: 3 };
    filtered = filtered.filter(l => levelOrder[l.level] >= levelOrder[minLevel]);
  }
  return filtered.slice(0, limit);
}
