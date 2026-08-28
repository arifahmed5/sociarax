import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Send, 
  Layers, 
  Palette, 
  Sliders, 
  History, 
  Eye, 
  Check, 
  RefreshCw, 
  Cpu, 
  Lock, 
  Terminal,
  Activity,
  Zap,
  Globe,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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

interface SafetyCheck {
  code: string;
  name: string;
  status: 'PASS' | 'BLOCK' | 'WARN';
  detail: string;
}

interface MaintenanceLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  command: string;
  safetyScore: number;
  safetyStatus: 'SAFE' | 'BLOCKED' | 'WARNING';
  safetyChecks: SafetyCheck[];
  status: 'APPLIED' | 'REJECTED' | 'ROLLED_BACK';
  summary: string;
  appliedDiff: Partial<WebsiteMaintenanceConfig>;
  previousConfig: WebsiteMaintenanceConfig;
}

export const AdminMaintenanceView: React.FC = () => {
  const { adminToken, userToken } = useAuth();
  const token = adminToken || userToken;
  
  const [config, setConfig] = useState<WebsiteMaintenanceConfig | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'customizer' | 'logs' | 'security'>('console');
  
  // Last execution / preview response
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    safetyScore: number;
    safetyStatus: string;
    safetyChecks: SafetyCheck[];
    plan: string;
    appliedDiff: Partial<WebsiteMaintenanceConfig>;
    explanation: string;
    error?: string;
  } | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const quickPrompts = [
    { label: 'Theme to Ocean Blue', prompt: 'Change website theme color to Ocean Blue with blue accent gradient' },
    { label: 'Theme to Emerald Green', prompt: 'Website ka theme color Emerald Green karo' },
    { label: 'Theme to Royal Purple', prompt: 'Website ka color purple karo aur modern styling do' },
    { label: 'Theme to Cyber Cyan', prompt: 'Change portal theme to Cyber Cyan' },
    { label: 'Update Announcement', prompt: 'Update announcement banner text to "Special 20% Instant Bonus on all UPI deposits today!" and turn it ON' },
    { label: 'Switch Pill Buttons', prompt: 'Switch UI buttons style to rounded pill buttons' },
    { label: 'Toggle Compact Mobile', prompt: 'Enable compact high-density mobile layout' },
    { label: 'Emergency Maintenance ON', prompt: 'Enable emergency maintenance mode with message' }
  ];

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/maintenance/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load maintenance config:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/maintenance/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load maintenance logs:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [token]);

  const handleExecute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim()) return;

    setIsLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/maintenance/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command: command.trim() })
      });
      const data = await res.json();
      setLastResult(data);

      if (data.success) {
        setConfig(data.currentConfig);
        setNotification({ type: 'success', message: 'Maintenance update applied safely!' });
        setCommand('');
        fetchLogs();
      } else {
        setNotification({ type: 'error', message: data.error || 'Operation rejected by security gate.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Server connection error during maintenance execution.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!command.trim()) return;

    setIsPreviewLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/maintenance/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command: command.trim() })
      });
      const data = await res.json();
      setLastResult(data);
      if (!data.success) {
        setNotification({ type: 'error', message: data.error || 'Security risk identified.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Preview request failed.' });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRollback = async (logId: string) => {
    if (!confirm('Are you sure you want to rollback this maintenance change?')) return;

    try {
      const res = await fetch('/api/admin/maintenance/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logId })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: data.message });
        if (data.config) setConfig(data.config);
        fetchLogs();
      } else {
        setNotification({ type: 'error', message: data.error || 'Rollback failed.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Rollback connection failed.' });
    }
  };

  const handleDirectUpdate = async (partial: Partial<WebsiteMaintenanceConfig>) => {
    try {
      const res = await fetch('/api/admin/maintenance/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ config: partial })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setNotification({ type: 'success', message: 'Setting updated immediately.' });
        fetchLogs();
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Direct update failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Admin AI Autonomous Website Controller</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Website Maintenance & UI Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Execute live website modifications using natural language (English / Hindi / Hinglish) with guaranteed multi-layer security audits, zero credential exposure, and instant rollback.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => { fetchConfig(); fetchLogs(); }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>6-Layer Safety Shield Active</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('console')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'console'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>AI Command Console</span>
          </button>

          <button
            onClick={() => setActiveTab('customizer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'customizer'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Quick Customizer</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History & Rollback ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security & Isolation Rules</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: AI COMMAND CONSOLE */}
      {/* ========================================================================= */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* Natural Language Prompt Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Tell the AI what to change on the website</span>
              </label>
              <span className="text-[11px] text-slate-500">Supports English, Hindi & Hinglish</span>
            </div>

            <form onSubmit={handleExecute} className="space-y-3">
              <div className="relative">
                <textarea
                  id="admin-ai-prompt-input"
                  rows={3}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. Website ka color emerald green karo aur announcement banner active karo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              {/* Quick suggestion chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500">Suggested Instructions:</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCommand(qp.prompt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-validated with 6-stage security gate</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPreviewLoading || isLoading || !command.trim()}
                    onClick={handlePreview}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isPreviewLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Security Scan & Preview</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-apply-maintenance-ai"
                    type="submit"
                    disabled={isLoading || isPreviewLoading || !command.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Audit & Apply Live</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Execution / Preview Analysis Card */}
          {lastResult && (
            <div className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 space-y-4 ${
              lastResult.success ? 'border-indigo-500/40' : 'border-rose-500/50'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {lastResult.success ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {lastResult.success ? 'Security Clearance: PASSED' : 'Security Clearance: BLOCKED'}
                    </h4>
                    <span className="text-[11px] text-slate-400">Safety Index: {lastResult.safetyScore}/100</span>
                  </div>
                </div>

                <div className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
                  Status: {lastResult.safetyStatus}
                </div>
              </div>

              {/* Explanation & Plan */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Analysis & Outcome:</div>
                <p className="text-xs text-slate-300 leading-relaxed p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
                  {lastResult.explanation}
                </p>
              </div>

              {/* 6 Security Verification Results */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Security Gate Scan Results:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lastResult.safetyChecks?.map((chk, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                        chk.status === 'PASS'
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-300'
                          : chk.status === 'BLOCK'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                          : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {chk.status === 'PASS' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                      {chk.status === 'BLOCK' && <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                      {chk.status === 'WARN' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <div className="font-bold text-white">{chk.name}</div>
                        <div className="text-slate-400 leading-tight mt-0.5">{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applied Diff Preview */}
              {Object.keys(lastResult.appliedDiff || {}).length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-semibold text-slate-300">Applied Parameter Changes:</div>
                  <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto border border-slate-800">
                    {JSON.stringify(lastResult.appliedDiff, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Current Live UI Parameters Overview */}
          {config && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">Live Website Customization State</h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Active on Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Theme Accent Color</div>
                  <div className="text-white font-bold capitalize mt-0.5 flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${
                      config.themeColor === 'emerald' ? 'bg-emerald-500' :
                      config.themeColor === 'blue' ? 'bg-blue-500' :
                      config.themeColor === 'purple' ? 'bg-purple-500' :
                      config.themeColor === 'rose' ? 'bg-rose-500' :
                      config.themeColor === 'amber' ? 'bg-amber-500' :
                      config.themeColor === 'cyan' ? 'bg-cyan-500' : 'bg-indigo-500'
                    }`} />
                    {config.themeColor}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Button Style</div>
                  <div className="text-white font-bold mt-0.5">{config.buttonStyle}</div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Announcement Banner</div>
                  <div className="text-white font-bold mt-0.5">
                    {config.announcementBannerActive ? (
                      <span className="text-emerald-400">Enabled</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Maintenance Mode</div>
                  <div className="text-white font-bold mt-0.5">
                    {config.maintenanceModeActive ? (
                      <span className="text-rose-400">Emergency Active</span>
                    ) : (
                      <span className="text-emerald-400">Normal Active</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUICK CUSTOMIZER (MANUAL CONTROLS) */}
      {/* ========================================================================= */}
      {activeTab === 'customizer' && config && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Manual Quick Customizer</h3>
              <p className="text-xs text-slate-400">Directly fine-tune visual theme parameters and UI styles.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Color Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Primary Theme Accent
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                  { id: 'blue', label: 'Blue', bg: 'bg-blue-600' },
                  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                  { id: 'purple', label: 'Purple', bg: 'bg-purple-600' },
                  { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                  { id: 'amber', label: 'Amber', bg: 'bg-amber-600' },
                  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-600' },
                  { id: 'violet', label: 'Violet', bg: 'bg-violet-600' }
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleDirectUpdate({ themeColor: c.id as any })}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      config.themeColor === c.id 
                        ? 'border-white bg-slate-800 shadow-lg' 
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full ${c.bg}`} />
                    <span className="text-[11px] font-bold text-slate-200">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Button Style Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Button Corner Radius
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'rounded-xl', label: 'Modern (xl)' },
                  { id: 'rounded-2xl', label: 'Soft (2xl)' },
                  { id: 'rounded-lg', label: 'Compact (lg)' },
                  { id: 'rounded-full', label: 'Pill (full)' }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleDirectUpdate({ buttonStyle: b.id as any })}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      config.buttonStyle === b.id 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white font-bold' 
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Global Announcement Banner Toggle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Announcement Banner</span>
                <button
                  onClick={() => handleDirectUpdate({ announcementBannerActive: !config.announcementBannerActive })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    config.announcementBannerActive 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {config.announcementBannerActive ? 'ON' : 'OFF'}
                </button>
              </div>
              <textarea
                rows={2}
                value={config.announcementBannerText}
                onChange={(e) => setConfig({ ...config, announcementBannerText: e.target.value })}
                onBlur={() => handleDirectUpdate({ announcementBannerText: config.announcementBannerText })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* Emergency Maintenance Mode */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Maintenance Mode Banner</span>
                <button
                  onClick={() => handleDirectUpdate({ maintenanceModeActive: !config.maintenanceModeActive })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    config.maintenanceModeActive 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {config.maintenanceModeActive ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
              <textarea
                rows={2}
                value={config.maintenanceMessage}
                onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                onBlur={() => handleDirectUpdate({ maintenanceMessage: config.maintenanceMessage })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT LOGS & ONE-CLICK ROLLBACK */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">AI Maintenance Audit Log</h3>
              <p className="text-xs text-slate-400">Complete historical audit trail of all natural-language and direct changes with instant rollback.</p>
            </div>
            <button
              onClick={fetchLogs}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Logs</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No maintenance actions executed yet. Use the AI Console to apply updates safely.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'APPLIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        log.status === 'ROLLED_BACK' ? 'bg-slate-800 text-slate-400' :
                        'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {log.status}
                      </span>
                      <span className="text-xs font-bold text-white truncate max-w-md">{log.command}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      {log.status === 'APPLIED' && (
                        <button
                          onClick={() => handleRollback(log.id)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 leading-relaxed">
                    {log.summary}
                  </div>

                  {log.appliedDiff && Object.keys(log.appliedDiff).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(log.appliedDiff).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-indigo-300">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY RULES & SYSTEM SAFEGUARDS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">System Security & Protection Framework</h3>
              <p className="text-xs text-slate-400">The 6 permanent security barriers enforced on every AI maintenance operation.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Lock className="w-4 h-4" />
                <span>1. Credential & Secret Shield</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Blocks any prompt seeking passwords, database URLs, session tokens, TOTP private keys, or API tokens. Secrets are never exposed to LLM outputs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Activity className="w-4 h-4" />
                <span>2. 24/7 Self-Healing Safeguard</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                The core Self-Healing monitor and recovery daemon is an immutable system process. The AI cannot disable or tamper with self-healing routines.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Globe className="w-4 h-4" />
                <span>3. Financial Ledger Immutability</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                The website maintenance AI has zero authority over user wallet balances, orders, or transactions. Financial actions must proceed via the Payments Desk.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Layers className="w-4 h-4" />
                <span>4. Database Schema Protection</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Prohibits DROP TABLE, ALTER, or destructive SQL commands. Only safe configuration keys inside system_settings are mutated.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>5. User Privacy & Isolation</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Strict customer privacy boundaries are enforced. Normal end-users have zero access to maintenance endpoints or logs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Cpu className="w-4 h-4" />
                <span>6. XSS & Code Injection Filter</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                All custom headlines, banners, and links are parsed through an XSS sanitizer before being rendered on the public website.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
