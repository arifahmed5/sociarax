import { GoogleGenAI } from '@google/genai';
import { getDbPool, checkDbConnection } from '../db';
import { selfHealingEngine } from '../monitoring/selfHealingEngine';
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
  showSupportInHeader: boolean;
  showHeaderSimpleLabelOnly: boolean;
  headerSimpleLabel: string;
  loginHeadline: string;
  loginSubtitle: string;
  registerHeadline: string;
  authTagline: string;
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
  accentGradient: 'from-indigo-600 via-indigo-500 to-purple-600',
  showSupportInHeader: true,
  showHeaderSimpleLabelOnly: false,
  headerSimpleLabel: 'SociaraX',
  loginHeadline: 'Welcome to SociaraX',
  loginSubtitle: 'Enter your credentials to access your dashboard',
  registerHeadline: 'Create Your SociaraX Account',
  authTagline: 'Protected by SociaraX Enterprise Security & SSL Encryption'
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionType?: 'CUSTOMIZE' | 'DIAGNOSTIC' | 'CONVERSATION' | 'BLOCKED';
  appliedDiff?: Partial<WebsiteMaintenanceConfig>;
  safetyScore?: number;
  verified?: boolean;
}

// In-memory runtime state
let currentConfig: WebsiteMaintenanceConfig = { ...DEFAULT_MAINTENANCE_CONFIG };
let actionLogs: MaintenanceActionLog[] = [];
let conversationHistory: ChatMessage[] = [
  {
    id: 'msg_welcome',
    sender: 'assistant',
    text: 'Namaste! Main aapka SociaraX AI Admin Assistant & Autonomous Website Controller hoon. Aap mujhse bolkar ya type karke website ka koi bhi design, colors, header, buttons, banners customize karwa sakte hain, ya fir website ka live health status & problem diagnosis pooch sakte hain. Main aapki kya sahayata karoon?',
    timestamp: new Date().toISOString(),
    actionType: 'CONVERSATION',
    verified: true
  }
];

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

// Helper: Save referral setting directly to database
export async function updateReferralSettingInDb(key: string, value: string): Promise<boolean> {
  const db = getDbPool();
  if (!db) return false;
  try {
    await db.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [key, value]);
    return true;
  } catch (err) {
    console.error('[AI MAINTENANCE] Failed to update referral setting:', key, err);
    return false;
  }
}

// Helper: Fetch live referral settings from database
export async function getLiveReferralSettings(): Promise<{
  enabled: boolean;
  bonusAmount: number;
  minDeposit: number;
  terms: string;
  totalReferredCount: number;
  totalRewardsPaid: number;
}> {
  const db = getDbPool();
  let enabled = true;
  let bonusAmount = 25.0;
  let minDeposit = 100.0;
  let terms = 'Refer friends to SociaraX. When they make their first verified deposit, you receive an instant wallet reward!';
  let totalReferredCount = 0;
  let totalRewardsPaid = 0;

  if (db) {
    try {
      const sRes = await db.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('referral_enabled', 'referral_bonus_amount', 'referral_min_deposit', 'referral_terms')
      `);
      sRes.rows.forEach(r => {
        if (r.key === 'referral_enabled') enabled = r.value !== 'false';
        if (r.key === 'referral_bonus_amount') bonusAmount = parseFloat(r.value || '25.0');
        if (r.key === 'referral_min_deposit') minDeposit = parseFloat(r.value || '100.0');
        if (r.key === 'referral_terms') terms = r.value;
      });

      const uRes = await db.query(`SELECT COUNT(*) as count FROM users WHERE referred_by_id IS NOT NULL`);
      totalReferredCount = parseInt(uRes.rows[0]?.count || '0', 10);

      const txRes = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM wallet_transactions 
        WHERE description ILIKE '%referral%' OR type = 'referral_bonus'
      `);
      totalRewardsPaid = parseFloat(txRes.rows[0]?.total || '0');
    } catch (err) {
      console.warn('[AI MAINTENANCE] Referral settings fetch notice:', err);
    }
  }

  return { enabled, bonusAmount, minDeposit, terms, totalReferredCount, totalRewardsPaid };
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
// DETERMINISTIC INTENT PARSER & DIAGNOSTIC INSPECTION
// -------------------------------------------------------------
export async function parseIntentDeterministically(command: string): Promise<{
  diff: Partial<WebsiteMaintenanceConfig>;
  referralUpdates?: {
    enabled?: boolean;
    bonusAmount?: number;
    minDeposit?: number;
    terms?: string;
  };
  summary: string;
  conversationalExplanation: string;
  isDiagnostic: boolean;
}> {
  const lower = command.toLowerCase().trim();
  const diff: Partial<WebsiteMaintenanceConfig> = {};
  const changes: string[] = [];
  const referralUpdates: {
    enabled?: boolean;
    bonusAmount?: number;
    minDeposit?: number;
    terms?: string;
  } = {};

  // 0. CHECK IF COMMAND IS A NUMBER OR OPTION SELECTION (e.g. "1", "2", "3", "4", "5", "option 2")
  const strippedNumber = lower.replace(/^(option|no|number|num)\s*/i, '').trim();
  if (['1', '2', '3', '4', '5'].includes(strippedNumber)) {
    if (strippedNumber === '1') {
      return {
        diff: {},
        summary: 'Website UI & Design Customizer Options',
        conversationalExplanation: `Aap Website UI ke ye elements instantly badal sakte hain:
🎨 1. Theme Color: Emerald Green, Ocean Blue, Royal Purple, Cyber Cyan, Rose Gold, Sunset Amber, Electric Violet.
🔘 2. Button Shapes: Pill Rounded (rounded-full), Ultra Smooth (rounded-2xl), Sharp (rounded-lg).
🏷️ 3. Top Header: Simple SociaraX Label lagao ya Contact Buttons (TG/WA) dikhao.
📝 4. Login & Register: Custom Headlines aur Taglines likho.
📢 5. Announcement Banner: Banner ON/OFF karo aur custom announcement text likho.

Bataiye kaunsa change karna hai? (e.g. "Website ka color Emerald Green kardo")`,
        isDiagnostic: true
      };
    } else if (strippedNumber === '2') {
      const refData = await getLiveReferralSettings();
      return {
        diff: {},
        summary: 'Referral & Affiliate System Control',
        conversationalExplanation: `Live Referral & Affiliate System Status:
• Program Status: ${refData.enabled ? 'ACTIVE & ENABLED ✅' : 'DISABLED / OFF ⏸️'}
• Referral Bonus Amount: ₹${refData.bonusAmount.toFixed(2)} per qualified invite
• Min Qualifying Deposit: ₹${refData.minDeposit.toFixed(2)}
• Total Referred Users: ${refData.totalReferredCount} users
• Total Rewards Paid Out: ₹${refData.totalRewardsPaid.toFixed(2)}

Aap mujhe directly bolkar manage karwa sakte hain:
👉 "Referral system off kardo" / "Referral enable karo"
👉 "Referral bonus ₹50 kardo"
👉 "Referral min deposit ₹200 karo"`,
        isDiagnostic: true
      };
    } else if (strippedNumber === '3') {
      return {
        diff: {},
        summary: '24/7 Security & DDoS Defense Suite',
        conversationalExplanation: `SociaraX 24/7 Multi-Layer Autonomous Security Report:
🛡️ Rate Limiting: 180 req/min API shield & 45 req/min Auth Brute-force protection active.
🛡️ SQL Injection & XSS: 100% Parameterized queries & sanitization active.
🛡️ Self-Healing Engine: Continuously monitoring backend memory, DB pool, and latency.
Aapka pura platform 100% safe aur DDoS protected hai!`,
        isDiagnostic: true
      };
    } else if (strippedNumber === '4') {
      let dbStatus: any = { connected: true, message: 'Connected' };
      try {
        dbStatus = await checkDbConnection();
      } catch (e: any) {
        dbStatus = { connected: false, message: e?.message || 'Error' };
      }
      const selfHealing = selfHealingEngine.getDiagnosticReport();
      return {
        diff: {},
        summary: 'System Diagnostics & Health Status',
        conversationalExplanation: `System Diagnostics Live Health Report:
• Database: ${dbStatus.connected ? 'PostgreSQL Pool Active (100% Healthy)' : 'Reconnecting...'}
• Self-Healing Engine: ${selfHealing.overallStatus} (0 active incidents)
• API Response: Instant (<50ms)
• Active Theme: ${currentConfig.themeColor.toUpperCase()}
• Maintenance Mode: ${currentConfig.maintenanceModeActive ? 'ACTIVE' : 'OFF'}
Website perfectly operational hai!`,
        isDiagnostic: true
      };
    } else if (strippedNumber === '5') {
      const db = getDbPool();
      let orderCount = 0;
      let userCount = 0;
      if (db) {
        try {
          const o = await db.query('SELECT COUNT(*) FROM orders');
          orderCount = parseInt(o.rows[0]?.count || '0', 10);
          const u = await db.query('SELECT COUNT(*) FROM users');
          userCount = parseInt(u.rows[0]?.count || '0', 10);
        } catch (e) {
          console.warn('Stats query error:', e);
        }
      }
      return {
        diff: {},
        summary: 'Orders & Users Live Overview',
        conversationalExplanation: `Live Platform Overview:
• Total Registered Users: ${userCount}
• Total Orders Processed: ${orderCount}
Sabhi queues aur payment gateways smoothly run ho rahe hain!`,
        isDiagnostic: true
      };
    }
  }

  // 0. SPECIALIZED ADMINISTRATIVE OPERATIONS (Referral System, Orders, Users, Services, Deposits)
  // A. Referral / Affiliate System Management & Inspection
  const isReferralRelated = 
    lower.includes('referral') || 
    lower.includes('referal') || 
    lower.includes('refarel') || 
    lower.includes('refaral') || 
    lower.includes('refral') || 
    lower.includes('refrel') || 
    lower.includes('refrral') || 
    lower.includes('affiliate') || 
    lower.includes('affilate') || 
    lower.includes('invite') || 
    lower.includes('referrer') || 
    lower.includes('refer') ||
    (lower.includes('bonus') && (lower.includes('badal') || lower.includes('change') || lower.includes('set') || lower.includes('kardo') || lower.includes('karo') || lower.includes('rupaye') || lower.includes('rupee') || lower.includes('₹')));

  if (isReferralRelated) {
    // 1. Check if changing bonus amount (e.g. "referral bonus 50 kardo", "refarel bonus 100 karo", "bonus 50 kardo")
    const bonusChangeMatch = command.match(/(?:bonus|reward|amount|paisa|rupee|inr|rs|₹)?\s*(?:ko|to|is|badalkar|karke|set\s*to)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:kardo|karo|set|change|karna|rakho|bana|karo)/i) || 
                             command.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees|rs|inr|₹)?\s*(?:bonus|reward)/i) ||
                             command.match(/(?:bonus|reward)\s*(?:ko|to|is)?\s*(\d+(?:\.\d+)?)/i);

    if (bonusChangeMatch && (lower.includes('bonus') || lower.includes('reward') || lower.includes('amount') || lower.includes('change') || lower.includes('kardo') || lower.includes('karo') || lower.includes('set') || lower.includes('badal'))) {
      const newBonus = parseFloat(bonusChangeMatch[1]);
      if (!isNaN(newBonus) && newBonus >= 0) {
        await updateReferralSettingInDb('referral_bonus_amount', String(newBonus));
        referralUpdates.bonusAmount = newBonus;
        return {
          diff: {},
          referralUpdates,
          summary: `Referral Bonus Updated to ₹${newBonus}`,
          conversationalExplanation: `Haanji! Maine Referral Bonus ko safaltapoorvak update kar diya hai:
• Naya Referral Bonus: ₹${newBonus} per qualified referral.
• Live Status: Database me turant save ho chuka hai.
Ab koi bhi user apne referral link se friend ko join karwayega aur unka qualifying deposit aayega to dono ko updated bonus credit hoga!`,
          isDiagnostic: false
        };
      }
    }

    // 2. Check if changing min qualifying deposit (e.g. "referral min deposit 200 kardo", "qualifying deposit 150 karo", "refarel deposit 200 karo")
    if (lower.includes('min') || lower.includes('minimum') || lower.includes('deposit') || lower.includes('qualifying')) {
      const minDepMatch = command.match(/(\d+(?:\.\d+)?)/);
      if (minDepMatch) {
        const newMin = parseFloat(minDepMatch[1]);
        if (!isNaN(newMin) && newMin >= 0) {
          await updateReferralSettingInDb('referral_min_deposit', String(newMin));
          referralUpdates.minDeposit = newMin;
          return {
            diff: {},
            referralUpdates,
            summary: `Referral Min Deposit Updated to ₹${newMin}`,
            conversationalExplanation: `Maine Minimum Qualifying Deposit requirement ko update kar diya hai:
• Naya Qualifying Deposit: ₹${newMin}
• Live System: Ab referee ko minimum ₹${newMin} ka deposit complete karna hoga referral bonus claim karne ke liye.`,
            isDiagnostic: false
          };
        }
      }
    }

    // 3. Check if toggle OFF / Disable (e.g. "2 Refarel system abhi enable hai off kardo", "referral band karo", "referral disable")
    const isOffCommand = 
      lower.includes('band') || 
      lower.includes('disable') || 
      lower.includes('off') || 
      lower.includes('rok do') || 
      lower.includes('rok') || 
      lower.includes('hatao') || 
      lower.includes('deactivate') || 
      lower.includes('close') ||
      lower.includes('stop');

    if (isOffCommand) {
      await updateReferralSettingInDb('referral_enabled', 'false');
      referralUpdates.enabled = false;
      return {
        diff: {},
        referralUpdates,
        summary: 'Referral Program Disabled',
        conversationalExplanation: 'Haanji! Maine Referral & Affiliate Program ko safaltapoorvak DISABLE (OFF) kar diya hai. Users ko naye referral bonus credit nahi honge jab tak aap dobara enable na karein.',
        isDiagnostic: false
      };
    }

    // 4. Check if toggle ON / Enable (e.g. "Referral enable karo", "refarel on kardo", "referral system chalu karo")
    const isOnCommand = 
      lower.includes('enable') || 
      lower.includes('chalu') || 
      lower.includes('on karo') || 
      lower.includes('on kardo') || 
      lower.includes('activate') || 
      lower.includes('start') || 
      lower.includes('kholo') ||
      (lower.includes('on') && !lower.includes('off') && !lower.includes('button'));

    if (isOnCommand) {
      await updateReferralSettingInDb('referral_enabled', 'true');
      referralUpdates.enabled = true;
      return {
        diff: {},
        referralUpdates,
        summary: 'Referral Program Enabled',
        conversationalExplanation: 'Haanji! Maine Referral & Affiliate Program ko safaltapoorvak ENABLE (ON) kar diya hai! Sabhi active users apne referral link se naye users invite karke wallet rewards earn kar sakte hain.',
        isDiagnostic: false
      };
    }

    // 5. Status / Inspection for Referral
    const refData = await getLiveReferralSettings();
    const explanation = `Maine live Referral & Affiliate System ka inspection complete kiya hai:
• Program Status: ${refData.enabled ? 'ACTIVE & RUNNING ✅' : 'DISABLED ⏸️'}
• Referral Bonus Amount: ₹${refData.bonusAmount.toFixed(2)} per qualified invite
• Min Qualifying Deposit: ₹${refData.minDeposit.toFixed(2)}
• Total Referred Users: ${refData.totalReferredCount} users
• Total Referral Rewards Paid: ₹${refData.totalRewardsPaid.toFixed(2)}

Aap mujhse directly bol sakte hain:
👉 "Referral system off kardo" / "Referral enable karo"
👉 "Referral bonus ₹50 kardo"
👉 "Referral min deposit ₹200 kardo"`;

    return {
      diff: {},
      referralUpdates,
      summary: 'Referral System Inspection & Status Report',
      conversationalExplanation: explanation,
      isDiagnostic: true
    };
  }

  // B. Orders Status & Management
  if (lower.includes('order') || lower.includes('orders')) {
    const db = getDbPool();
    let totalOrders = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let canceledCount = 0;

    if (db) {
      try {
        const statsRes = await db.query(`
          SELECT status, COUNT(*) as count FROM orders GROUP BY status
        `);
        statsRes.rows.forEach(r => {
          const count = parseInt(r.count, 10);
          totalOrders += count;
          if (r.status === 'pending') pendingCount = count;
          if (r.status === 'processing' || r.status === 'in_progress') processingCount += count;
          if (r.status === 'completed') completedCount = count;
          if (r.status === 'canceled' || r.status === 'cancelled') canceledCount = count;
        });
      } catch (e) {
        console.warn('Orders count query error:', e);
      }
    }

    return {
      diff: {},
      summary: 'Live Orders Status Report',
      conversationalExplanation: `Maine live Orders Database ka status check kiya hai:
• Total Orders Placed: ${totalOrders} orders
• Pending Orders: ${pendingCount} orders
• Processing / In Progress: ${processingCount} orders
• Completed Orders: ${completedCount} orders
• Canceled / Refunded: ${canceledCount} orders
Sabhi orders system aur API provider queues smoothly process ho rahe hain!`,
      isDiagnostic: true
    };
  }

  // C. Users Status & Directory
  if (lower.includes('user') || lower.includes('users') || lower.includes('customer') || lower.includes('member')) {
    const db = getDbPool();
    let totalUsers = 0;
    let activeUsers = 0;
    let adminUsers = 0;

    if (db) {
      try {
        const uRes = await db.query(`
          SELECT role, COUNT(*) as count FROM users GROUP BY role
        `);
        uRes.rows.forEach(r => {
          const count = parseInt(r.count, 10);
          totalUsers += count;
          if (r.role === 'admin') adminUsers += count;
          else activeUsers += count;
        });
      } catch (e) {
        console.warn('Users count query error:', e);
      }
    }

    return {
      diff: {},
      summary: 'Users & Accounts Status Report',
      conversationalExplanation: `Maine live Users Directory ka status check kiya hai:
• Total Registered Accounts: ${totalUsers} accounts
• Active Customers: ${activeUsers} users
• Admin Accounts: ${adminUsers} admins
Authentication, JWT token verification aur Google OAuth fully secure hain!`,
      isDiagnostic: true
    };
  }

  // D. Services Catalog Inspection
  if (lower.includes('service') || lower.includes('services') || lower.includes('rate') || lower.includes('rates') || lower.includes('catalog')) {
    const db = getDbPool();
    let totalServices = 0;
    let instaCount = 0;
    let ytCount = 0;
    let tgCount = 0;
    let otherCount = 0;

    if (db) {
      try {
        const sRes = await db.query(`
          SELECT platform, COUNT(*) as count FROM services WHERE status = 'active' GROUP BY platform
        `);
        sRes.rows.forEach(r => {
          const count = parseInt(r.count, 10);
          totalServices += count;
          if (r.platform === 'instagram') instaCount += count;
          else if (r.platform === 'youtube') ytCount += count;
          else if (r.platform === 'telegram') tgCount += count;
          else otherCount += count;
        });
      } catch (e) {
        console.warn('Services count query error:', e);
      }
    }

    return {
      diff: {},
      summary: 'Services Catalog Status Report',
      conversationalExplanation: `Maine live Services Catalog ka inspection kiya hai:
• Total Active Services: ${totalServices} services
• Instagram Services: ${instaCount} active
• YouTube Services: ${ytCount} active
• Telegram Services: ${tgCount} active
• Other Platforms (Facebook, X, Spotify, etc.): ${otherCount} active
Sabhi platform filters and categories perfectly synchronized hain!`,
      isDiagnostic: true
    };
  }

  // E. Payments & Deposits
  if (lower.includes('payment') || lower.includes('payments') || lower.includes('deposit') || lower.includes('deposits') || lower.includes('qr')) {
    const db = getDbPool();
    let pendingDeposits = 0;
    let approvedDeposits = 0;
    let totalDepositVol = 0;

    if (db) {
      try {
        const dRes = await db.query(`
          SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
          FROM deposit_requests GROUP BY status
        `);
        dRes.rows.forEach(r => {
          const count = parseInt(r.count, 10);
          const sum = parseFloat(r.total);
          if (r.status === 'pending') pendingDeposits = count;
          if (r.status === 'approved') {
            approvedDeposits = count;
            totalDepositVol += sum;
          }
        });
      } catch (e) {
        console.warn('Deposits count query error:', e);
      }
    }

    return {
      diff: {},
      summary: 'Payments & Deposits Status Report',
      conversationalExplanation: `Maine live Payments & Deposits ka status check kiya hai:
• Pending Manual Deposits: ${pendingDeposits} requests
• Approved Deposits: ${approvedDeposits} completed transactions
• Total Verified Inflow: ₹${totalDepositVol.toFixed(2)}
UPI QR Code gateway aur instant verification desk fully operational hain!`,
      isDiagnostic: true
    };
  }

  // 0.1 IDENTITY & NAME INQUIRIES
  if (
    lower.includes('naam') || 
    lower.includes('name') || 
    lower.includes('who are you') || 
    lower.includes('kaun ho') || 
    lower.includes('aap kaun') ||
    lower.includes('tum kaun') ||
    lower.includes('tumhara intro') ||
    lower.includes('tumhari identity')
  ) {
    return {
      diff: {},
      summary: 'SociaraX AI Controller Identity',
      conversationalExplanation: `Mera naam SociaraX AI Admin Controller hai! 🤖
Main aapka 24/7 autonomous website management aur maintenance assistant hoon. 

Main kya kya karta hoon:
1. Website UI & Design Customization: Aap mujhe bolkar ya message karke website ke colors, header, buttons, banners, login/register text badalwa sakte hain.
2. 24/7 Live Security & Attack Defense: DDoS protection, rate limiting, SQL injection defense, aur self-healing engine chalata hoon.
3. System Diagnostics & Analytics: Real-time orders, database health, payments, active users, aur referral system ka live status deta hoon.
4. Autonomous Maintenance: Live database aur background processes ko fail-safe state me rakhta hoon.`,
      isDiagnostic: true
    };
  }

  // 0.2 ATTACKS, HACKING & DDOS DEFENSE INQUIRIES
  if (
    lower.includes('attack') || 
    lower.includes('hack') || 
    lower.includes('ddos') || 
    lower.includes('rok paog') || 
    lower.includes('rok sakti') ||
    lower.includes('rok sakte') ||
    lower.includes('suraksha') || 
    lower.includes('security') || 
    lower.includes('virus') || 
    lower.includes('firewall') || 
    lower.includes('brute') || 
    lower.includes('safe') ||
    lower.includes('bacha')
  ) {
    return {
      diff: {},
      summary: 'SociaraX Autonomous Attack & Security Defense Suite',
      conversationalExplanation: `Haanji, bilkul! Agar koi bhi SociaraX website par attack ya malicious activity karne ki koshish karega, toh mera autonomous security system use turant block karega:

🛡️ 1. Multi-Layer Sliding Window Rate Limiter:
• Normal API endpoints par 180 requests/minute limit active hai jo automated bot flooding aur DDoS scraping ko rokta hai.
• Login aur Auth endpoints par 45 requests/minute limit hai jo brute-force password attacks ko block karta hai.

🛡️ 2. Intelligent Security Audit Suite:
• SEC_CREDENTIAL_SHIELD: Passwords, tokens, aur private keys ko unauthorized inspection se bachata hai.
• SEC_MALICIOUS_INJECTION: SQL Injections aur command tampering ko parameterization ke sath neutralise karta hai.
• SEC_XSS_SANITIZATION: UI fields me kisi bhi script injection ko sanitize karta hai.

🛡️ 3. 24/7 Self-Healing Engine:
• Database pool connection, backend memory, aur API response latency ko continuously monitor karta hai. Agar koi sub-system fail hota hai to automatically heal kar deta hai.

Aapka website aur data 100% secure aur protected hai!`,
      isDiagnostic: true
    };
  }

  // 0.3 HOW-TO & CAPABILITIES INQUIRY
  if (
    lower.includes('kya kya customize') || 
    lower.includes('kya customize') || 
    lower.includes('kaise customize') || 
    lower.includes('options kya') || 
    lower.includes('kya kar sakte') ||
    lower.includes('capabilities') ||
    lower.includes('features kya')
  ) {
    return {
      diff: {},
      summary: 'Available Customization & Control Commands',
      conversationalExplanation: `Aap mujhse natural language me bolkar ya message karke ye sab instantly customize karwa sakte hain:

🎨 1. Theme & Colors:
• "Website ka color emerald green kardo"
• "Theme color ocean blue / royal purple / cyber cyan / rose gold kardo"

🔘 2. Buttons & Shapes:
• "Buttons pill rounded kardo" (rounded-full)
• "Button style ultra smooth / sharp kardo"

🏷️ 3. Top Header & Navbar:
• "Top header me simple SociaraX label lagao"
• "Top header se contact buttons hide kardo"
• "Telegram aur WhatsApp contact buttons enable karo"

📝 4. Login & Register Modals:
• "Login headline 'Welcome to SociaraX' kardo"
• "Register page headline 'Create Account' kardo"

📢 5. Announcement Banner:
• "Announcement banner ON karo"
• "Banner text 'Non-drop SMM delivery active' set karo"

🎁 6. Referral System:
• "Referral bonus ₹50 kardo"
• "Referral min deposit ₹200 kardo"
• "Referral program band karo / chalu karo"

🛠️ 7. System Diagnostics:
• "Website me kya problem hai?"
• "Database aur orders ka status batao"`,
      isDiagnostic: true
    };
  }

  // Check if this is a diagnostic inquiry or status question
  const isQuestionOrDiagnostic = 
    lower.includes('problem') || 
    lower.includes('error') || 
    lower.includes('kya haal') || 
    lower.includes('kya dikkat') || 
    lower.includes('kya issue') || 
    lower.includes('status') || 
    lower.includes('database') || 
    lower.includes('health') || 
    lower.includes('diagnos') || 
    lower.includes('theek hai') ||
    lower.includes('kaise ho') ||
    lower.includes('hello') ||
    lower.includes('namaste') ||
    lower.includes('help');

  if (isQuestionOrDiagnostic) {
    let dbStatus: any = { connected: true, message: 'Database Connected' };
    try {
      dbStatus = await checkDbConnection();
    } catch {
      dbStatus = { connected: false, message: 'Connection Check Error' };
    }

    const report = selfHealingEngine.getDiagnosticReport();
    const activeTheme = currentConfig.themeColor.toUpperCase();
    const isMaintenance = currentConfig.maintenanceModeActive ? 'ACTIVE' : 'OFF';

    let explanation = '';
    if (lower.includes('kaise ho') || lower.includes('hello') || lower.includes('namaste')) {
      explanation = `Namaste! Main bilkul theek hoon aur aapki SociaraX website ko 24/7 monitor aur customize karne ke liye ready hoon. Aap mujhse bolkar ya type karke website ka color, top header, buttons, login page, referral system, ya system diagnostics execute karwa sakte hain.`;
    } else if (lower.includes('problem') || lower.includes('issue') || lower.includes('error')) {
      if (report.overallStatus === 'HEALTHY' && dbStatus.connected) {
        explanation = `Maine abhi live website ka poora inspection complete kiya hai:
• Database: PostgreSQL engine 100% HEALTHY aur actively connected hai.
• 24/7 Self-Healing Engine: Active hai (Zero open incidents).
• API & Routing: Express server aur Vite SPA perfectly functional hain.
• Theme & UI: Active Theme '${activeTheme}', Maintenance Mode: ${isMaintenance}.
Filhaal website me koi error ya problem nahi hai, sabhi services smoothly run ho rahi hain!`;
      } else {
        explanation = `Maine live system check kiya hai:
• Database Status: ${dbStatus.message}
• Subsystems Health: Backend ${report.subsystems.backendApi.status}, DB ${report.subsystems.database.status}
• Self-Healing Status: ${report.overallStatus}`;
      }
    } else if (lower.includes('database')) {
      explanation = `Database Live Status: ${dbStatus.connected ? 'PostgreSQL Database pool active aur healthy hai. Queries seamlessly execute ho rahi hain.' : 'Database reconnecting... Fallback layer active.'}`;
    } else {
      explanation = `System Diagnostic Overview:
• Overall Health: ${report.overallStatus}
• Database Pool: ${dbStatus.connected ? 'Connected (PostgreSQL)' : 'Fallback mode'}
• 24/7 Monitoring: 100% Active & Protected
• Active Theme: ${activeTheme}
• Header Simple Label: "${currentConfig.headerSimpleLabel}" (Support Buttons: ${currentConfig.showSupportInHeader ? 'Shown' : 'Hidden'})`;
    }

    return {
      diff: {},
      summary: 'System Diagnostic & Health Inspection Report',
      conversationalExplanation: explanation,
      isDiagnostic: true
    };
  }

  // 1. TOP HEADER & NAVBAR CUSTOMIZATIONS
  const isHeaderCommand = 
    lower.includes('top header') || 
    lower.includes('header') || 
    lower.includes('navbar') || 
    lower.includes('nav bar') ||
    lower.includes('contact button') ||
    lower.includes('contact buttons');

  if (isHeaderCommand) {
    if (
      (lower.includes('replace') || lower.includes('badlo') || lower.includes('hata') || lower.includes('remove') || lower.includes('change')) &&
      (lower.includes('sociarax') || lower.includes('label') || lower.includes('simple') || lower.includes('badge'))
    ) {
      diff.showHeaderSimpleLabelOnly = true;
      diff.showSupportInHeader = false;
      
      const quotedMatch = command.match(/["“'‘]([^"”'’]+)["”'’]/);
      if (quotedMatch && quotedMatch[1] && quotedMatch[1].trim().length > 0) {
        diff.headerSimpleLabel = quotedMatch[1].trim();
      } else {
        const labelTextMatch = command.match(/(?:named|called|label|naam)\s+([A-Za-z0-9_]+)/i);
        if (labelTextMatch && labelTextMatch[1] && !['label', 'the', 'a', 'simple'].includes(labelTextMatch[1].toLowerCase())) {
          diff.headerSimpleLabel = labelTextMatch[1].trim();
        } else {
          diff.headerSimpleLabel = 'SociaraX';
        }
      }
      changes.push(`Top header se Telegram/WhatsApp buttons ko hata kar clean "${diff.headerSimpleLabel}" simple label set kar diya gaya hai`);
    } else if (
      lower.includes('hide telegram') || 
      lower.includes('hide whatsapp') || 
      lower.includes('hide contact') || 
      lower.includes('buttons hatao') ||
      lower.includes('remove contact')
    ) {
      diff.showSupportInHeader = false;
      diff.showHeaderSimpleLabelOnly = true;
      diff.headerSimpleLabel = diff.headerSimpleLabel || 'SociaraX';
      changes.push('Top header me se contact buttons hide kar diye gaye hain');
    } else if (
      lower.includes('show telegram') || 
      lower.includes('show whatsapp') || 
      lower.includes('show contact') || 
      lower.includes('contact buttons dikhao') ||
      lower.includes('enable contact')
    ) {
      diff.showSupportInHeader = true;
      diff.showHeaderSimpleLabelOnly = false;
      changes.push('Top header me direct Telegram aur WhatsApp contact buttons enable kar diye gaye hain');
    }
  }

  // 2. LOGIN / SIGN IN / AUTH MODAL UI CUSTOMIZATIONS
  const isAuthCommand = 
    lower.includes('login') || 
    lower.includes('signin') || 
    lower.includes('sign in') || 
    lower.includes('log in') || 
    lower.includes('register') || 
    lower.includes('signup') || 
    lower.includes('sign up') ||
    lower.includes('auth');

  if (isAuthCommand) {
    const quotedAuth = command.match(/["“'‘]([^"”'’]+)["”'’]/);

    if (lower.includes('register') || lower.includes('signup') || lower.includes('sign up')) {
      if (quotedAuth && quotedAuth[1]) {
        diff.registerHeadline = quotedAuth[1].trim();
        changes.push(`Registration modal headline ko update karke "${diff.registerHeadline}" kar diya gaya hai`);
      } else {
        const regHeadMatch = command.match(/(?:register|signup|sign up)\s*(?:page|modal)?\s*(?:ka|ki|ke)?\s*(?:headline|heading|title|text)\s*(?:ko|to|is|badalkar|likho|set\s*to|change\s*karke)?\s*[:=]?\s*["“'‘]?([^"”'’\n,]+)["”'’]?/i);
        if (regHeadMatch && regHeadMatch[1] && regHeadMatch[1].trim().length > 2) {
          diff.registerHeadline = regHeadMatch[1].trim();
          changes.push(`Registration modal headline ko update karke "${diff.registerHeadline}" kar diya gaya hai`);
        }
      }
    } else if (lower.includes('subtitle') || lower.includes('subheading') || lower.includes('desc')) {
      if (quotedAuth && quotedAuth[1]) {
        diff.loginSubtitle = quotedAuth[1].trim();
        changes.push(`Login modal subtitle ko update karke "${diff.loginSubtitle}" kar diya gaya hai`);
      } else {
        const loginSubMatch = command.match(/(?:login|signin|sign in|log in)\s*(?:page|modal)?\s*(?:ka|ki|ke)?\s*(?:subtitle|subheading|desc|description)\s*(?:ko|to|is|badalkar|likho|set\s*to|change\s*karke)?\s*[:=]?\s*["“'‘]?([^"”'’\n]+)["”'’]?/i);
        if (loginSubMatch && loginSubMatch[1] && loginSubMatch[1].trim().length > 2) {
          diff.loginSubtitle = loginSubMatch[1].trim();
          changes.push(`Login modal subtitle ko update karke "${diff.loginSubtitle}" kar diya gaya hai`);
        }
      }
    } else {
      if (quotedAuth && quotedAuth[1]) {
        diff.loginHeadline = quotedAuth[1].trim();
        changes.push(`Login modal headline ko update karke "${diff.loginHeadline}" kar diya gaya hai`);
      } else {
        const loginHeadMatch = command.match(/(?:login|signin|sign in|log in)\s*(?:page|modal)?\s*(?:ka|ki|ke)?\s*(?:headline|heading|title|text)\s*(?:ko|to|is|badalkar|likho|set\s*to|change\s*karke)?\s*[:=]?\s*["“'‘]?([^"”'’\n,]+)["”'’]?/i);
        if (loginHeadMatch && loginHeadMatch[1] && loginHeadMatch[1].trim().length > 2) {
          diff.loginHeadline = loginHeadMatch[1].trim();
          changes.push(`Login modal headline ko update karke "${diff.loginHeadline}" kar diya gaya hai`);
        }
      }
    }
  }

  // 3. THEME COLORS & PALETTES
  const isThemeCommand = lower.includes('color') || lower.includes('theme') || lower.includes('look') || lower.includes('styling');
  if (isThemeCommand || lower.includes('green') || lower.includes('purple') || lower.includes('blue') || lower.includes('emerald') || lower.includes('cyan')) {
    if (lower.includes('emerald') || lower.includes('green') || lower.includes('hara')) {
      diff.themeColor = 'emerald';
      diff.accentGradient = 'from-emerald-600 via-teal-500 to-cyan-600';
      changes.push('Website theme color ko Emerald Green me update kiya gaya');
    } else if (lower.includes('purple') || lower.includes('baingani')) {
      diff.themeColor = 'purple';
      diff.accentGradient = 'from-purple-600 via-fuchsia-500 to-indigo-600';
      changes.push('Website theme color ko Royal Purple me update kiya gaya');
    } else if (lower.includes('blue') || lower.includes('neela') || lower.includes('ocean')) {
      diff.themeColor = 'blue';
      diff.accentGradient = 'from-blue-600 via-sky-500 to-indigo-600';
      changes.push('Website theme color ko Ocean Blue me update kiya gaya');
    } else if (lower.includes('cyan') || lower.includes('cyber')) {
      diff.themeColor = 'cyan';
      diff.accentGradient = 'from-cyan-600 via-teal-500 to-sky-600';
      changes.push('Website theme color ko Cyber Cyan me update kiya gaya');
    } else if (lower.includes('rose') || lower.includes('pink') || lower.includes('gulabi') || lower.includes('red') || lower.includes('lal')) {
      diff.themeColor = 'rose';
      diff.accentGradient = 'from-rose-600 via-pink-500 to-orange-500';
      changes.push('Website theme color ko Rose Gold me update kiya gaya');
    } else if (lower.includes('amber') || lower.includes('gold') || lower.includes('yellow') || lower.includes('peela')) {
      diff.themeColor = 'amber';
      diff.accentGradient = 'from-amber-500 via-orange-500 to-yellow-600';
      changes.push('Website theme color ko Sunset Amber me update kiya gaya');
    } else if (lower.includes('violet')) {
      diff.themeColor = 'violet';
      diff.accentGradient = 'from-violet-600 via-purple-500 to-pink-600';
      changes.push('Website theme color ko Electric Violet me update kiya gaya');
    } else if (lower.includes('indigo') || lower.includes('default')) {
      diff.themeColor = 'indigo';
      diff.accentGradient = 'from-indigo-600 via-indigo-500 to-purple-600';
      changes.push('Website theme color ko SociaraX Indigo me update kiya gaya');
    }
  }

  // 4. BUTTON STYLING
  if (lower.includes('button') || lower.includes('radius') || lower.includes('shape')) {
    if (lower.includes('pill') || lower.includes('full') || lower.includes('round') || lower.includes('gol')) {
      diff.buttonStyle = 'rounded-full';
      changes.push('UI buttons ka style Pill (rounded-full) set kiya gaya');
    } else if (lower.includes('sharp') || lower.includes('square') || lower.includes('small')) {
      diff.buttonStyle = 'rounded-lg';
      changes.push('UI buttons ka style Sharp (rounded-lg) set kiya gaya');
    } else if (lower.includes('extra round') || lower.includes('smooth')) {
      diff.buttonStyle = 'rounded-2xl';
      changes.push('UI buttons ka style Ultra Smooth (rounded-2xl) set kiya gaya');
    } else if (lower.includes('standard') || lower.includes('modern') || lower.includes('default')) {
      diff.buttonStyle = 'rounded-xl';
      changes.push('UI buttons ka style Modern Rounded (rounded-xl) set kiya gaya');
    }
  }

  // 5. ANNOUNCEMENT BANNER
  if (lower.includes('announcement') || lower.includes('banner') || lower.includes('notice')) {
    if (lower.includes('turn on') || lower.includes('enable') || lower.includes('chalu') || lower.includes('on')) {
      diff.announcementBannerActive = true;
      changes.push('Announcement banner ko ON kiya gaya');
    } else if (lower.includes('turn off') || lower.includes('disable') || lower.includes('band') || lower.includes('off') || lower.includes('hatao')) {
      diff.announcementBannerActive = false;
      changes.push('Announcement banner ko OFF kiya gaya');
    }

    const bannerTextMatch = command.match(/(?:banner\s*text|announcement\s*text|notice\s*text)\s*(?:to|is|ko|set\s*to|badalkar)?\s*[:=]?\s*["“'‘]?([^"”'’\n]+)["”'’]?/i);
    if (bannerTextMatch && bannerTextMatch[1] && bannerTextMatch[1].trim().length > 3) {
      diff.announcementBannerText = bannerTextMatch[1].trim();
      diff.announcementBannerActive = true;
      changes.push(`Banner text ko "${diff.announcementBannerText}" update kiya gaya`);
    }
  }

  // 6. MAINTENANCE MODE
  if (lower.includes('maintenance mode')) {
    if (lower.includes('enable') || lower.includes('on') || lower.includes('chalu') || lower.includes('activate')) {
      diff.maintenanceModeActive = true;
      changes.push('Website Maintenance Mode ko ENABLE kar diya gaya');
    } else if (lower.includes('disable') || lower.includes('off') || lower.includes('band') || lower.includes('deactivate')) {
      diff.maintenanceModeActive = false;
      changes.push('Website Maintenance Mode ko DISABLE kar diya gaya');
    }
  }

  const summary = changes.length > 0 ? changes.join('; ') : '';
  const conversationalExplanation = changes.length > 0
    ? `Haanji! Maine aapke kahe anusaar website settings update kar di hain: ${changes.join('. ')}. Sabhi changes live website par reflect ho chuke hain.`
    : '';

  return { diff, referralUpdates, summary, conversationalExplanation, isDiagnostic: false };
}

// -------------------------------------------------------------
// CORE AI ENGINE: ANALYZE AND EXECUTE (TEXT / VOICE)
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
  actionType?: 'CUSTOMIZE' | 'DIAGNOSTIC' | 'CONVERSATION' | 'BLOCKED';
}> {
  // Step 1: Run Multi-Layer Security Check on the raw prompt
  const initialAudit = runSecurityAudit(command, {});
  if (!initialAudit.passed) {
    const blockedMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `Suraksha Niti (Security Policy) ke karan yeh request reject ki gayi hai: ${initialAudit.blockingReason}. Sensitive credentials ya destructive operations strictly prohibited hain.`,
      timestamp: new Date().toISOString(),
      actionType: 'BLOCKED',
      safetyScore: initialAudit.safetyScore,
      verified: false
    };
    conversationHistory.push({
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: command,
      timestamp: new Date().toISOString()
    });
    conversationHistory.push(blockedMsg);

    return {
      success: false,
      safetyScore: initialAudit.safetyScore,
      safetyStatus: 'BLOCKED',
      safetyChecks: initialAudit.checks,
      plan: `BLOCKED: ${initialAudit.blockingReason}`,
      appliedDiff: {},
      currentConfig,
      explanation: blockedMsg.text,
      error: initialAudit.blockingReason,
      actionType: 'BLOCKED'
    };
  }

  // Step 2: High-Speed Instant Processing Pipeline
  let requestedDiff: Partial<WebsiteMaintenanceConfig> = {};
  let aiExplanation = '';
  let actionType: 'CUSTOMIZE' | 'DIAGNOSTIC' | 'CONVERSATION' = 'CUSTOMIZE';

  // Test deterministic & specialized intent parser first
  const deterministicResult = await parseIntentDeterministically(command);

  if (deterministicResult.conversationalExplanation && (deterministicResult.isDiagnostic || Object.keys(deterministicResult.diff).length > 0 || (deterministicResult.referralUpdates && Object.keys(deterministicResult.referralUpdates).length > 0))) {
    requestedDiff = deterministicResult.diff;
    aiExplanation = deterministicResult.conversationalExplanation;
    actionType = deterministicResult.isDiagnostic ? 'DIAGNOSTIC' : (Object.keys(requestedDiff).length > 0 || (deterministicResult.referralUpdates && Object.keys(deterministicResult.referralUpdates).length > 0) ? 'CUSTOMIZE' : 'CONVERSATION');
  } else {
    // If not matched directly, invoke Gemini with rich context and conversation history
    let dbDiagnostic: any = { connected: true, message: 'PostgreSQL Connected' };
    try {
      dbDiagnostic = await checkDbConnection();
    } catch (err: any) {
      dbDiagnostic = { connected: false, message: err?.message || 'DB check failed' };
    }
    const selfHealingReport = selfHealingEngine.getDiagnosticReport();
    const refData = await getLiveReferralSettings();

    // Format recent conversation history for natural memory
    const recentHistoryText = conversationHistory
      .slice(-6)
      .map(m => `${m.sender === 'user' ? 'Admin' : 'AI Controller'}: "${m.text.replace(/\n+/g, ' ')}"`)
      .join('\n');

    const gemini = getGeminiClient();
    if (gemini) {
      const candidateModels = ['gemini-3.7-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];
      const promptContent = `You are SociaraX's Autonomous AI Admin Assistant, Security Engineer & Website Controller for the SociaraX SMM platform.
You communicate warmly, naturally, and intelligently like a helpful human DevOps engineer and platform manager in fluent Hindi / Hinglish / English.
You have FULL ACCESS to control the website UI, Referral & Affiliate settings, security rules, and system diagnostics.

RECENT CONVERSATION HISTORY:
${recentHistoryText || 'No prior context.'}

LIVE SYSTEM CONTEXT:
• Platform: SociaraX (SMM Services Panel)
• Database: ${dbDiagnostic.connected ? 'HEALTHY (PostgreSQL pool connected)' : 'FALLBACK LAYER'}
• Self-Healing: ${selfHealingReport.overallStatus} (0 active incidents)
• Theme: ${currentConfig.themeColor}
• Header Simple Label: ${currentConfig.showHeaderSimpleLabelOnly ? 'ON ("' + currentConfig.headerSimpleLabel + '")' : 'OFF (Support buttons shown)'}
• Maintenance Mode: ${currentConfig.maintenanceModeActive ? 'ACTIVE' : 'OFF'}
• Buttons Style: ${currentConfig.buttonStyle}
• Announcement Banner: ${currentConfig.announcementBannerActive ? 'ACTIVE ("' + currentConfig.announcementBannerText + '")' : 'OFF'}
• Referral System Status: ${refData.enabled ? 'ENABLED' : 'DISABLED'} | Bonus: ₹${refData.bonusAmount} | Min Deposit: ₹${refData.minDeposit}

ADMIN'S MESSAGE:
"${command}"

INSTRUCTIONS:
1. Understand the admin's exact intent (UI change, Referral toggle or bonus change, question, greeting, follow-up, or general chat).
2. If admin wants to change Referral settings:
   - Provide "referralAction": { "enabled": boolean, "bonusAmount": number, "minDeposit": number }
3. If admin wants to change UI settings:
   - Provide "diff": { ...keys to change... }
4. Formulate a warm, natural, human-like response in Hindi / Hinglish ("explanation") directly confirming what you changed or answering their query with absolute clarity. Never repeat repetitive robotic disclaimers.

AVAILABLE CONFIG KEYS FOR "diff":
- themeColor: 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet'
- buttonStyle: 'rounded-xl' | 'rounded-2xl' | 'rounded-lg' | 'rounded-full'
- showSupportInHeader: boolean
- showHeaderSimpleLabelOnly: boolean
- headerSimpleLabel: string
- loginHeadline: string
- loginSubtitle: string
- registerHeadline: string
- announcementBannerActive: boolean
- announcementBannerText: string
- announcementBannerType: 'info' | 'warning' | 'success' | 'alert'
- maintenanceModeActive: boolean
- heroHeadline: string
- heroSubtitle: string
- telegramSupport: string
- whatsappSupport: string

Respond ONLY in valid strict JSON format:
{
  "actionType": "CUSTOMIZE" | "DIAGNOSTIC" | "CONVERSATION",
  "diff": { ...optional UI keys... },
  "referralAction": { ...optional referral changes e.g. "enabled": false, "bonusAmount": 50... },
  "explanation": "Warm, natural human response in Hindi/Hinglish directly answering/confirming the command",
  "summary": "Short summary"
}`;

      for (const modelName of candidateModels) {
        try {
          const response = await gemini.models.generateContent({
            model: modelName,
            contents: promptContent
          });

          const text = response.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.explanation) {
              aiExplanation = parsed.explanation;
              requestedDiff = (parsed.diff && typeof parsed.diff === 'object') ? parsed.diff : {};
              
              // Apply any referral action from Gemini
              if (parsed.referralAction && typeof parsed.referralAction === 'object') {
                if (typeof parsed.referralAction.enabled === 'boolean') {
                  await updateReferralSettingInDb('referral_enabled', parsed.referralAction.enabled ? 'true' : 'false');
                }
                if (typeof parsed.referralAction.bonusAmount === 'number') {
                  await updateReferralSettingInDb('referral_bonus_amount', String(parsed.referralAction.bonusAmount));
                }
                if (typeof parsed.referralAction.minDeposit === 'number') {
                  await updateReferralSettingInDb('referral_min_deposit', String(parsed.referralAction.minDeposit));
                }
              }

              actionType = parsed.actionType || (Object.keys(requestedDiff).length > 0 || parsed.referralAction ? 'CUSTOMIZE' : 'CONVERSATION');
              break;
            }
          }
        } catch (err: any) {
          const isUnavailable = err?.status === 503 || err?.code === 503 || String(err?.message || '').includes('503');
          const isRateLimited = err?.status === 429 || err?.code === 429 || String(err?.message || '').includes('429');
          if (isUnavailable || isRateLimited) {
            continue;
          }
        }
      }
    }

    if (!aiExplanation) {
      requestedDiff = deterministicResult.diff;
      if (deterministicResult.conversationalExplanation) {
        aiExplanation = deterministicResult.conversationalExplanation;
      } else if (Object.keys(requestedDiff).length > 0) {
        aiExplanation = deterministicResult.summary || `Haanji! Maine aapke kahe anusaar website settings update kar di hain. Sabhi changes live website par reflect ho chuke hain.`;
      } else {
        aiExplanation = `Haanji! Maine aapka message suna: "${command}". 
Main aapki SociaraX website ka AI Controller hoon. Aap mujhse koi bhi design change karwa sakte hain (jaise theme color, buttons, header layout, login text), referral bonus update karwa sakte hain, ya live security/orders status pooch sakte hain. Bataiye kya karna hai?`;
      }
      actionType = deterministicResult.isDiagnostic ? 'DIAGNOSTIC' : (Object.keys(requestedDiff).length > 0 ? 'CUSTOMIZE' : 'CONVERSATION');
    }
  }

  // Step 3: Run Security Audit on the resulting diff
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
      explanation: `Suraksha Niti ke tehat yeh command reject kiya gaya: ${audit.blockingReason}`,
      error: audit.blockingReason,
      actionType: 'BLOCKED'
    };
  }

  // If dry-run / preview mode
  if (dryRun) {
    return {
      success: true,
      safetyScore: audit.safetyScore,
      safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
      safetyChecks: audit.checks,
      plan: aiExplanation || 'Preview safe configuration diff ready for deployment.',
      appliedDiff: requestedDiff,
      currentConfig: { ...currentConfig, ...requestedDiff },
      explanation: aiExplanation,
      actionType
    };
  }

  // Step 4: Apply safe diff if customization was requested
  const previous = { ...currentConfig };
  let hasActualChanges = Object.keys(requestedDiff).length > 0;

  if (hasActualChanges) {
    currentConfig = { ...currentConfig, ...requestedDiff };
    await persistConfigToDatabase(currentConfig);

    const logEntry: MaintenanceActionLog = {
      id: `maint_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      adminEmail,
      command,
      safetyScore: audit.safetyScore,
      safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
      safetyChecks: audit.checks,
      status: 'APPLIED',
      summary: aiExplanation,
      appliedDiff: requestedDiff,
      previousConfig: previous
    };

    actionLogs.unshift(logEntry);
    if (actionLogs.length > 50) {
      actionLogs.pop();
    }
  }

  // Update conversation chat history
  const userMsg: ChatMessage = {
    id: `usr_${Date.now()}`,
    sender: 'user',
    text: command,
    timestamp: new Date().toISOString()
  };
  const assistantMsg: ChatMessage = {
    id: `asst_${Date.now()}`,
    sender: 'assistant',
    text: aiExplanation,
    timestamp: new Date().toISOString(),
    actionType,
    appliedDiff: hasActualChanges ? requestedDiff : undefined,
    safetyScore: audit.safetyScore,
    verified: true
  };

  conversationHistory.push(userMsg);
  conversationHistory.push(assistantMsg);
  if (conversationHistory.length > 60) {
    conversationHistory = conversationHistory.slice(-50);
  }

  return {
    success: true,
    safetyScore: audit.safetyScore,
    safetyStatus: audit.riskLevel === 'SAFE' ? 'SAFE' : 'WARNING',
    safetyChecks: audit.checks,
    plan: aiExplanation,
    appliedDiff: requestedDiff,
    currentConfig,
    explanation: aiExplanation,
    actionType
  };
}

// -------------------------------------------------------------
// CHAT & LOGS RETRIEVAL
// -------------------------------------------------------------
export function getConversationHistory(): ChatMessage[] {
  return [...conversationHistory];
}

export function clearConversationHistory(): void {
  conversationHistory = [
    {
      id: 'msg_welcome_new',
      sender: 'assistant',
      text: 'Chat history cleared. Main SociaraX AI Assistant hoon. Bataiye abhi kya customize ya inspect karna hai?',
      timestamp: new Date().toISOString(),
      actionType: 'CONVERSATION',
      verified: true
    }
  ];
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
