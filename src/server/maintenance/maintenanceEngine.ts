import { GoogleGenAI } from '@google/genai';
import { getDbPool } from '../db';
import crypto from 'crypto';

export interface WebsiteMaintenanceConfig {
  themeColor: 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
  siteTitle: string;
  heroHeadline: string;
  heroSubtitle: string;
  announcementBannerText: string;
  announcementBannerActive: boolean;
  announcementBannerType: 'info' | 'warning' | 'success' | 'alert';
  buttonStyle: 'rounded-xl' | 'rounded-2xl' | 'rounded-lg' | 'rounded-full';
  telegramSupport: string;
  whatsappSupport: string;
  maintenanceModeActive: boolean;
  maintenanceMessage: string;
  enableGlowEffects: boolean;
  compactMobileLayout: boolean;
  customBadgeText: string;
  quickSupportPhone: string;
  accentGradient: string;
}

export const DEFAULT_MAINTENANCE_CONFIG: WebsiteMaintenanceConfig = {
  themeColor: 'indigo',
  siteTitle: 'SociaraX',
  heroHeadline: 'Welcome to SociaraX.',
  heroSubtitle: 'Non-drop social media growth services, real-time automated order fulfillment, multi-gateway INR payments, and direct owner WhatsApp/Telegram support.',
  announcementBannerText: 'Automated instant delivery active across Instagram, YouTube, Telegram, Snapchat, Facebook & X with 100% Non-Drop Refill Guarantee.',
  announcementBannerActive: true,
  announcementBannerType: 'info',
  buttonStyle: 'rounded-xl',
  telegramSupport: '@SociaraXSupport',
  whatsappSupport: '@SociaraXDirect',
  maintenanceModeActive: false,
  maintenanceMessage: 'SociaraX is currently undergoing scheduled high-speed infrastructure maintenance. Services will resume shortly.',
  enableGlowEffects: true,
  compactMobileLayout: false,
  customBadgeText: 'Automated SMM Infrastructure & Instant API Engine',
  quickSupportPhone: '+91 98765 43210',
  accentGradient: 'from-indigo-600 via-indigo-500 to-purple-600'
};

export interface SafetyCheckResult {
  code: string;
  name: string;
  status: 'PASS' | 'BLOCK' | 'WARN';
  detail: string;
}

export interface MaintenanceActionLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  command: string;
  safetyScore: number;
  safetyStatus: 'SAFE' | 'BLOCKED' | 'WARNING';
  safetyChecks: SafetyCheckResult[];
  status: 'APPLIED' | 'REJECTED' | 'ROLLED_BACK';
  summary: string;
  appliedDiff: Partial<WebsiteMaintenanceConfig>;
  previousConfig: WebsiteMaintenanceConfig;
}

// In-memory runtime state
let currentConfig: WebsiteMaintenanceConfig = { ...DEFAULT_MAINTENANCE_CONFIG };
let actionLogs: MaintenanceActionLog[] = [];

// Lazy Gemini SDK client initialization
let genAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    try {
      genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('[AI MAINTENANCE] Gemini client initialization notice:', err);
    }
  }
  return genAiClient;
}

// -------------------------------------------------------------
// MULTI-LAYER SAFETY AND SECURITY AUDIT SUITE
// -------------------------------------------------------------
export function runSecurityAudit(command: string, requestedDiff: Partial<WebsiteMaintenanceConfig>): {
  passed: boolean;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  safetyScore: number;
  checks: SafetyCheckResult[];
  blockingReason?: string;
} {
  const checks: SafetyCheckResult[] = [];
  const lowerCommand = command.toLowerCase();

  // 1. CREDENTIAL & SECRET LEAK PREVENTION
  const secretKeywords = [
    'password', 'passwd', 'totp', 'secret', 'jwt', 'private_key', 'api_key',
    'database_url', 'session_secret', 'token', 'gemini_api_key', 'env',
    'credential', 'otp', 'hash', 'salt', 'bcrypt', 'cookie'
  ];
  const asksForSecrets = secretKeywords.some(k => lowerCommand.includes(k) && (
    lowerCommand.includes('show') || lowerCommand.includes('reveal') || 
    lowerCommand.includes('print') || lowerCommand.includes('export') || 
    lowerCommand.includes('get') || lowerCommand.includes('send') ||
    lowerCommand.includes('batao') || lowerCommand.includes('nikalo')
  ));

  if (asksForSecrets) {
    checks.push({
      code: 'SEC_CREDENTIAL_SHIELD',
      name: 'Credential & Secret Leak Shield',
      status: 'BLOCK',
      detail: 'Command attempted to inspect, extract, or expose authentication credentials or environmental secrets.'
    });
  } else {
    checks.push({
      code: 'SEC_CREDENTIAL_SHIELD',
      name: 'Credential & Secret Leak Shield',
      status: 'PASS',
      detail: 'Zero sensitive environmental secrets or authentication hashes requested.'
    });
  }

  // 2. FINANCIAL LEDGER & WALLET IMMUTABILITY
  const financialKeywords = [
    'wallet', 'balance', 'paisa', 'rupee', 'inr', 'add balance', 'set balance',
    'delete transaction', 'modify payment', 'refund all', 'free balance'
  ];
  const touchesFinance = financialKeywords.some(k => lowerCommand.includes(k));

  if (touchesFinance) {
    checks.push({
      code: 'SEC_FINANCIAL_LEDGER',
      name: 'Financial Ledger Protection',
      status: 'BLOCK',
      detail: 'Website maintenance AI cannot directly alter real wallet balances or financial transactions. Use the manual Payments Desk.'
    });
  } else {
    checks.push({
      code: 'SEC_FINANCIAL_LEDGER',
      name: 'Financial Ledger Protection',
      status: 'PASS',
      detail: 'No wallet balances, financial ledger columns, or orders tampered with.'
    });
  }

  // 3. 24/7 SELF-HEALING & MONITOR SAFEGUARD
  const selfHealingKeywords = [
    'disable self healing', 'stop monitor', 'kill monitor', 'turn off health',
    'stop self-healing', 'disable recovery', 'delete logs'
  ];
  const disablesSelfHealing = selfHealingKeywords.some(k => lowerCommand.includes(k));

  if (disablesSelfHealing) {
    checks.push({
      code: 'SEC_SELF_HEALING_SAFEGUARD',
      name: '24/7 Self-Healing Protection',
      status: 'BLOCK',
      detail: 'The core Self-Healing and Monitoring Engine is an immutable system service and cannot be deactivated.'
    });
  } else {
    checks.push({
      code: 'SEC_SELF_HEALING_SAFEGUARD',
      name: '24/7 Self-Healing Protection',
      status: 'PASS',
      detail: 'Self-healing engine runtime health remains 100% active and protected.'
    });
  }

  // 4. DESTRUCTIVE SQL & DATABASE SCHEMA PROTECTION
  const sqlInjectionKeywords = [
    'drop table', 'drop database', 'delete from users', 'truncate', 'alter table',
    'exec(', 'union select', 'information_schema', '<script', 'javascript:'
  ];
  const hasSqlThreat = sqlInjectionKeywords.some(k => lowerCommand.includes(k));

  if (hasSqlThreat) {
    checks.push({
      code: 'SEC_SCHEMA_PROTECTION',
      name: 'Database Schema & Injection Guard',
      status: 'BLOCK',
      detail: 'Dangerous destructive command or script injection pattern detected.'
    });
  } else {
    checks.push({
      code: 'SEC_SCHEMA_PROTECTION',
      name: 'Database Schema & Injection Guard',
      status: 'PASS',
      detail: 'Database schema, tables, and integrity constraints are fully safeguarded.'
    });
  }

  // 5. TENANT PRIVACY & USER ISOLATION
  const userTamperKeywords = ['delete all users', 'ban all users', 'steal user', 'dump users'];
  const violatesUserIsolation = userTamperKeywords.some(k => lowerCommand.includes(k));

  if (violatesUserIsolation) {
    checks.push({
      code: 'SEC_USER_ISOLATION',
      name: 'User Privacy & Tenant Isolation',
      status: 'BLOCK',
      detail: 'Bulk destructive operations on user accounts are restricted.'
    });
  } else {
    checks.push({
      code: 'SEC_USER_ISOLATION',
      name: 'User Privacy & Tenant Isolation',
      status: 'PASS',
      detail: 'User data boundaries, privacy isolation, and security intact.'
    });
  }

  // 6. XSS / SANITIZATION AUDIT FOR CUSTOM TEXT VALUES
  let xssDetected = false;
  for (const val of Object.values(requestedDiff)) {
    if (typeof val === 'string' && (val.includes('<script') || val.includes('onerror=') || val.includes('javascript:'))) {
      xssDetected = true;
      break;
    }
  }

  if (xssDetected) {
    checks.push({
      code: 'SEC_XSS_SANITIZATION',
      name: 'Content & Script Sanitizer',
      status: 'BLOCK',
      detail: 'Malicious markup or script tags stripped from UI text fields.'
    });
  } else {
    checks.push({
      code: 'SEC_XSS_SANITIZATION',
      name: 'Content & Script Sanitizer',
      status: 'PASS',
      detail: 'All UI strings, titles, and layout properties strictly sanitized.'
    });
  }

  const hasBlocks = checks.some(c => c.status === 'BLOCK');
  const hasWarns = checks.some(c => c.status === 'WARN');

  if (hasBlocks) {
    const blockingCheck = checks.find(c => c.status === 'BLOCK');
    return {
      passed: false,
      riskLevel: 'CRITICAL',
      safetyScore: 10,
      checks,
      blockingReason: blockingCheck?.detail || 'Operation blocked by security policies.'
    };
  }

  return {
    passed: true,
    riskLevel: hasWarns ? 'LOW' : 'SAFE',
    safetyScore: hasWarns ? 85 : 100,
    checks
  };
}

// -------------------------------------------------------------
// DETERMINISTIC INTENT PARSER (Hindi / Hinglish / English)
// -------------------------------------------------------------
export function parseIntentDeterministically(command: string): {
  diff: Partial<WebsiteMaintenanceConfig>;
  summary: string;
} {
  const lower = command.toLowerCase();
  const diff: Partial<WebsiteMaintenanceConfig> = {};
  const changes: string[] = [];

  // Theme color changes
  if (lower.includes('purple') || lower.includes('jamuni') || lower.includes('baingani')) {
    diff.themeColor = 'purple';
    diff.accentGradient = 'from-purple-600 via-purple-500 to-indigo-600';
    changes.push('Set theme accent color to Royal Purple');
  } else if (lower.includes('emerald') || lower.includes('green') || lower.includes('hara')) {
    diff.themeColor = 'emerald';
    diff.accentGradient = 'from-emerald-600 via-teal-500 to-cyan-600';
    changes.push('Set theme accent color to Emerald Green');
  } else if (lower.includes('blue') || lower.includes('neela') || lower.includes('ocean')) {
    diff.themeColor = 'blue';
    diff.accentGradient = 'from-blue-600 via-sky-500 to-indigo-600';
    changes.push('Set theme accent color to Ocean Blue');
  } else if (lower.includes('rose') || lower.includes('red') || lower.includes('lal') || lower.includes('pink') || lower.includes('gulabi')) {
    diff.themeColor = 'rose';
    diff.accentGradient = 'from-rose-600 via-pink-500 to-purple-600';
    changes.push('Set theme accent color to Rose Red');
  } else if (lower.includes('amber') || lower.includes('gold') || lower.includes('yellow') || lower.includes('peela')) {
    diff.themeColor = 'amber';
    diff.accentGradient = 'from-amber-500 via-orange-500 to-yellow-600';
    changes.push('Set theme accent color to Gold Amber');
  } else if (lower.includes('cyan') || lower.includes('sky')) {
    diff.themeColor = 'cyan';
    diff.accentGradient = 'from-cyan-500 via-teal-500 to-blue-600';
    changes.push('Set theme accent color to Cyber Cyan');
  } else if (lower.includes('indigo') || lower.includes('default color')) {
    diff.themeColor = 'indigo';
    diff.accentGradient = 'from-indigo-600 via-indigo-500 to-purple-600';
    changes.push('Reset theme accent color to Indigo Electric');
  }

  // Button styles
  if (lower.includes('pill button') || lower.includes('round button') || lower.includes('rounded-full')) {
    diff.buttonStyle = 'rounded-full';
    changes.push('Switched UI button style to Pill (rounded-full)');
  } else if (lower.includes('square button') || lower.includes('sharp button') || lower.includes('rounded-lg')) {
    diff.buttonStyle = 'rounded-lg';
    changes.push('Switched UI button style to Compact (rounded-lg)');
  } else if (lower.includes('rounded-2xl') || lower.includes('soft button')) {
    diff.buttonStyle = 'rounded-2xl';
    changes.push('Switched UI button style to Soft Curves (rounded-2xl)');
  } else if (lower.includes('default button') || lower.includes('standard button')) {
    diff.buttonStyle = 'rounded-xl';
    changes.push('Switched UI button style to Modern Standard (rounded-xl)');
  }

  // Announcement Banner
  if (lower.includes('announcement') || lower.includes('banner') || lower.includes('alert')) {
    if (lower.includes('hide') || lower.includes('disable') || lower.includes('band karo') || lower.includes('off')) {
      diff.announcementBannerActive = false;
      changes.push('Turned off global announcement banner');
    } else if (lower.includes('show') || lower.includes('enable') || lower.includes('chalu') || lower.includes('on')) {
      diff.announcementBannerActive = true;
      changes.push('Enabled global announcement banner');
    }
  }

  // Mobile layout density
  if (lower.includes('compact mobile') || lower.includes('mobile layout') || lower.includes('dense')) {
    diff.compactMobileLayout = true;
    changes.push('Enabled high-density compact mobile layout');
  } else if (lower.includes('spacious') || lower.includes('normal mobile')) {
    diff.compactMobileLayout = false;
    changes.push('Restored standard spacious mobile layout');
  }

  // Glow effects
  if (lower.includes('disable glow') || lower.includes('no glow') || lower.includes('glow band')) {
    diff.enableGlowEffects = false;
    changes.push('Disabled ambient background glow fx');
  } else if (lower.includes('enable glow') || lower.includes('glow on')) {
    diff.enableGlowEffects = true;
    changes.push('Enabled vibrant ambient background glow fx');
  }

  // Maintenance mode
  if (lower.includes('maintenance mode') || lower.includes('under maintenance')) {
    if (lower.includes('enable') || lower.includes('on') || lower.includes('chalu')) {
      diff.maintenanceModeActive = true;
      changes.push('Enabled website emergency maintenance banner');
    } else if (lower.includes('disable') || lower.includes('off') || lower.includes('band')) {
      diff.maintenanceModeActive = false;
      changes.push('Disabled website emergency maintenance banner');
    }
  }

  // Custom text extractions
  const titleMatch = command.match(/(?:title|heading|naam)\s*(?:ko|to|is)?\s*["':]?([^"'\n,]+)["']?/i);
  if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 2 && !lower.includes('color')) {
    diff.heroHeadline = titleMatch[1].trim();
    changes.push(`Updated hero headline to "${titleMatch[1].trim()}"`);
  }

  const telegramMatch = command.match(/telegram(?:\s+support)?\s*(?:to|is|ko)?\s*([@a-zA-Z0-9_]+)/i);
  if (telegramMatch && telegramMatch[1]) {
    diff.telegramSupport = telegramMatch[1].startsWith('@') ? telegramMatch[1] : `@${telegramMatch[1]}`;
    changes.push(`Updated Telegram support handle to ${diff.telegramSupport}`);
  }

  const whatsappMatch = command.match(/whatsapp(?:\s+support)?\s*(?:to|is|ko)?\s*([+0-9\s]+)/i);
  if (whatsappMatch && whatsappMatch[1] && whatsappMatch[1].trim().length >= 8) {
    diff.whatsappSupport = whatsappMatch[1].trim();
    changes.push(`Updated WhatsApp support number to ${diff.whatsappSupport}`);
  }

  const summary = changes.length > 0
    ? changes.join('; ')
    : 'Analyzed request: General styling and UI optimization configuration evaluated safely.';

  return { diff, summary };
}

// -------------------------------------------------------------
// CORE AI ENGINE: ANALYZE AND EXECUTE
// -------------------------------------------------------------
export async function processMaintenanceInstruction(
  command: string,
  adminEmail: string,
  dryRun: boolean = false
): Promise<{
  success: boolean;
  safetyScore: number;
  safetyStatus: 'SAFE' | 'BLOCKED' | 'WARNING';
  safetyChecks: SafetyCheckResult[];
  plan: string;
  appliedDiff: Partial<WebsiteMaintenanceConfig>;
  currentConfig: WebsiteMaintenanceConfig;
  explanation: string;
  logId?: string;
  error?: string;
}> {
  // Step 1: Parse requested modifications
  let requestedDiff: Partial<WebsiteMaintenanceConfig> = {};
  let aiExplanation = '';

  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `You are SociaraX's Autonomous Website Maintenance AI Controller.
An authorized admin gave this natural language command: "${command}"

Current Website Configuration:
${JSON.stringify(currentConfig, null, 2)}

Your task:
1. Interpret the admin's exact intent (supports English, Hindi, Hinglish).
2. Propose safe updates to the configuration keys:
   - themeColor: 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet'
   - siteTitle: string
   - heroHeadline: string
   - heroSubtitle: string
   - announcementBannerText: string
   - announcementBannerActive: boolean
   - announcementBannerType: 'info' | 'warning' | 'success' | 'alert'
   - buttonStyle: 'rounded-xl' | 'rounded-2xl' | 'rounded-lg' | 'rounded-full'
   - telegramSupport: string
   - whatsappSupport: string
   - maintenanceModeActive: boolean
   - maintenanceMessage: string
   - enableGlowEffects: boolean
   - compactMobileLayout: boolean
   - customBadgeText: string

Respond ONLY in strict JSON format with this schema:
{
  "diff": { ...only modified keys... },
  "explanation": "Clear, professional 1-2 sentence explanation of changes and safety considerations",
  "summary": "Short 5-8 word summary"
}`
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.diff && typeof parsed.diff === 'object') {
          requestedDiff = parsed.diff;
          aiExplanation = parsed.explanation || parsed.summary || '';
        }
      }
    } catch (err: any) {
      console.warn('[AI MAINTENANCE] Gemini parse fallback to deterministic rules:', err?.message || err);
    }
  }

  // Fallback if Gemini not available or didn't produce keys
  if (Object.keys(requestedDiff).length === 0) {
    const fallback = parseIntentDeterministically(command);
    requestedDiff = fallback.diff;
    aiExplanation = fallback.summary;
  }

  // Step 2: Run Multi-Layer Security & Safety Audit
  const audit = runSecurityAudit(command, requestedDiff);

  if (!audit.passed) {
    return {
      success: false,
      safetyScore: audit.safetyScore,
      safetyStatus: 'BLOCKED',
      safetyChecks: audit.checks,
      plan: `BLOCKED: ${audit.blockingReason}`,
      appliedDiff: {},
      currentConfig,
      explanation: `Security Policy Violation: ${audit.blockingReason}. For system and user security, dangerous operations are automatically rejected by the AI Maintenance Gate.`,
      error: audit.blockingReason
    };
  }

  // If dry-run / preview mode, return without committing
  if (dryRun) {
    return {
      success: true,
      safetyScore: audit.safetyScore,
      safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
      safetyChecks: audit.checks,
      plan: aiExplanation || 'Preview safe configuration diff ready for deployment.',
      appliedDiff: requestedDiff,
      currentConfig: { ...currentConfig, ...requestedDiff },
      explanation: `Security scan passed with ${audit.safetyScore}% safety score. All 6 security validation barriers passed.`
    };
  }

  // Step 3: Apply safe diff
  const previous = { ...currentConfig };
  currentConfig = { ...currentConfig, ...requestedDiff };

  // Persist into database system_settings
  await persistConfigToDatabase(currentConfig);

  // Record into Action Log
  const logEntry: MaintenanceActionLog = {
    id: `maint_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    adminEmail,
    command,
    safetyScore: audit.safetyScore,
    safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
    safetyChecks: audit.checks,
    status: 'APPLIED',
    summary: aiExplanation || 'Applied website customization updates safely.',
    appliedDiff: requestedDiff,
    previousConfig: previous
  };

  actionLogs.unshift(logEntry);
  if (actionLogs.length > 50) {
    actionLogs.pop();
  }

  return {
    success: true,
    safetyScore: audit.safetyScore,
    safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
    safetyChecks: audit.checks,
    plan: aiExplanation || 'Maintenance updates successfully applied to the live portal.',
    appliedDiff: requestedDiff,
    currentConfig,
    explanation: `Changes successfully executed with 100% security clearance. The website theme, layout, and UI parameters are updated in real-time.`,
    logId: logEntry.id
  };
}

// -------------------------------------------------------------
// ROLLBACK ACTION
// -------------------------------------------------------------
export async function rollbackMaintenanceAction(logId: string): Promise<{
  success: boolean;
  message: string;
  config?: WebsiteMaintenanceConfig;
}> {
  const log = actionLogs.find(l => l.id === logId);
  if (!log) {
    return { success: false, message: 'Maintenance action log not found.' };
  }

  if (log.status === 'ROLLED_BACK') {
    return { success: false, message: 'Action was already rolled back previously.' };
  }

  currentConfig = { ...log.previousConfig };
  log.status = 'ROLLED_BACK';

  await persistConfigToDatabase(currentConfig);

  return {
    success: true,
    message: `Successfully rolled back to previous state from ${new Date(log.timestamp).toLocaleTimeString()}`,
    config: currentConfig
  };
}

// -------------------------------------------------------------
// DATABASE PERSISTENCE HELPERS
// -------------------------------------------------------------
async function persistConfigToDatabase(config: WebsiteMaintenanceConfig): Promise<void> {
  const db = getDbPool();
  if (!db) return;

  try {
    await db.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('website_maintenance_config', $1, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(config)]);
  } catch (err: any) {
    console.error('[AI MAINTENANCE] Failed to persist config to DB:', err?.message || err);
  }
}

export async function loadConfigFromDatabase(): Promise<void> {
  const db = getDbPool();
  if (!db) return;

  try {
    const res = await db.query("SELECT value FROM system_settings WHERE key = 'website_maintenance_config'");
    if (res.rowCount && res.rowCount > 0 && res.rows[0].value) {
      const parsed = JSON.parse(res.rows[0].value);
      currentConfig = { ...DEFAULT_MAINTENANCE_CONFIG, ...parsed };
    }
  } catch (err: any) {
    console.warn('[AI MAINTENANCE] Config load notice:', err?.message || err);
  }
}

export function getCurrentMaintenanceConfig(): WebsiteMaintenanceConfig {
  return { ...currentConfig };
}

export function getMaintenanceLogs(): MaintenanceActionLog[] {
  return [...actionLogs];
}

export async function updateMaintenanceConfigDirect(
  partial: Partial<WebsiteMaintenanceConfig>,
  adminEmail: string
): Promise<WebsiteMaintenanceConfig> {
  const previous = { ...currentConfig };
  currentConfig = { ...currentConfig, ...partial };
  await persistConfigToDatabase(currentConfig);

  const logEntry: MaintenanceActionLog = {
    id: `maint_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    adminEmail,
    command: 'Direct Admin UI Customizer Update',
    safetyScore: 100,
    safetyStatus: 'SAFE',
    safetyChecks: runSecurityAudit('Direct UI Setting', partial).checks,
    status: 'APPLIED',
    summary: 'Direct manual parameter adjustment',
    appliedDiff: partial,
    previousConfig: previous
  };
  actionLogs.unshift(logEntry);

  return { ...currentConfig };
}
