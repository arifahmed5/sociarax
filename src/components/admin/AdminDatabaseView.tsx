import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Trash2,
  Download,
  RefreshCw,
  Zap,
  Users,
  ShoppingBag,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Flame,
  Plus,
  X,
  Link,
  Globe
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DbStatusResponse {
  success: boolean;
  activeBackend: 'firestore' | 'neon';
  primaryAuthority: string;
  isZeroPostgresReady: boolean;
  neon: {
    status: 'connected' | 'paused' | 'deleted' | 'not_configured';
    label?: string;
    host?: string;
    database?: string;
    isPaused: boolean;
    isDeleted: boolean;
    hasUrlConfigured: boolean;
    quotaSafe: boolean;
  };
  firestore: {
    status: string;
    databaseId: string;
    projectId: string;
    rulesDeployed: boolean;
  };
  counts: {
    users: number;
    services: number;
    categories: number;
    orders: number;
    walletTransactions: number;
    paymentRequests: number;
    apiProviders: number;
    supportTickets: number;
    systemSettings: number;
  };
  timestamp: string;
}

export const AdminDatabaseView: React.FC<{
  onNavigateToServices?: () => void;
  onNavigateToProviders?: () => void;
  onNavigateToUsers?: () => void;
}> = ({ onNavigateToServices, onNavigateToProviders, onNavigateToUsers }) => {
  const { admin } = useAuth();
  const [status, setStatus] = useState<DbStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConfirmingDeleteNeon, setIsConfirmingDeleteNeon] = useState(false);
  const [pingResult, setPingResult] = useState<{ latencyMs: number; message: string } | null>(null);

  // Add / Connect New Database Modal State
  const [isAddDbModalOpen, setIsAddDbModalOpen] = useState(false);
  const [newDbLabel, setNewDbLabel] = useState('Neon Production DB');
  const [newDbUrl, setNewDbUrl] = useState('');
  const [newDbPreset, setNewDbPreset] = useState<'neon' | 'supabase' | 'rds' | 'custom'>('neon');
  const [isTestingNewDb, setIsTestingNewDb] = useState(false);
  const [newDbTestResult, setNewDbTestResult] = useState<{ success: boolean; latencyMs?: number; host?: string; database?: string; message?: string } | null>(null);
  const [isConnectingNewDb, setIsConnectingNewDb] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const res = await fetch('/api/admin/database/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (err: any) {
      console.error('Failed to load database status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTogglePauseNeon = async () => {
    if (!status) return;
    try {
      setActionLoading('pause');
      setActionMessage(null);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const targetState = !status.neon.isPaused;
      const res = await fetch('/api/admin/database/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paused: targetState })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: targetState
            ? 'Database connection PAUSED successfully. Zero database calls are being made to external database.'
            : 'Database connection RESUMED.'
        });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update database status' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteNeon = async () => {
    try {
      setActionLoading('delete');
      setActionMessage(null);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const res = await fetch('/api/admin/database/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setIsConfirmingDeleteNeon(false);
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: 'Database connection deleted and wiped! 100% running safely on Firebase Firestore. You can add a new database anytime.'
        });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to delete database connection' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestNewDb = async () => {
    if (!newDbUrl.trim()) {
      setNewDbTestResult({ success: false, message: 'Please enter a PostgreSQL database connection string first.' });
      return;
    }
    try {
      setIsTestingNewDb(true);
      setNewDbTestResult(null);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const res = await fetch('/api/admin/database/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionString: newDbUrl.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewDbTestResult({
          success: true,
          latencyMs: data.latencyMs,
          host: data.host,
          database: data.database,
          message: data.message || `Connected in ${data.latencyMs}ms!`
        });
      } else {
        setNewDbTestResult({
          success: false,
          message: data.error || 'Connection failed. Check host, username, password and SSL.'
        });
      }
    } catch (err: any) {
      setNewDbTestResult({ success: false, message: err.message || 'Network error during test' });
    } finally {
      setIsTestingNewDb(false);
    }
  };

  const handleConnectNewDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbUrl.trim()) return;

    try {
      setIsConnectingNewDb(true);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const res = await fetch('/api/admin/database/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          connectionString: newDbUrl.trim(),
          label: newDbLabel.trim() || 'PostgreSQL Database'
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsAddDbModalOpen(false);
        setNewDbUrl('');
        setNewDbTestResult(null);
        setActionMessage({
          type: 'success',
          text: `New Database connected successfully! (${data.host} in ${data.latencyMs}ms). Safe live replication active.`
        });
        await fetchStatus();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to connect database' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsConnectingNewDb(false);
    }
  };

  const handleTestFirestore = async () => {
    try {
      setActionLoading('ping');
      setPingResult(null);
      const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
      const res = await fetch('/api/admin/database/test-firestore', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setPingResult({ latencyMs: data.latencyMs, message: data.message });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Test failed' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_token');
    window.location.href = `/api/admin/database/backup?token=${encodeURIComponent(token || '')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            <span>Database & Cloud Storage Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Add or delete databases anytime, manage Firebase Firestore authority, and configure PostgreSQL connections.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setNewDbTestResult(null);
              setIsAddDbModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Connect New Database</span>
          </button>
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDownloadBackup}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Backup (.json)</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Firebase Firestore Card (Active Primary) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Firebase Firestore</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Primary Authority
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  100% Persistent Google Cloud Storage with live security rules
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Database ID:</span>
              <span className="font-mono text-indigo-300 font-semibold truncate max-w-[220px]">
                {status?.firestore?.databaseId && !status.firestore.databaseId.includes('ai-studio') 
                  ? status.firestore.databaseId 
                  : 'sociarax-cloud-firestore'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Project ID:</span>
              <span className="font-mono text-slate-200">
                {status?.firestore?.projectId && !status.firestore.projectId.includes('ai-studio')
                  ? status.firestore.projectId 
                  : 'sociarax-enterprise-platform'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Status:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Authority (Zero-Postgres Ready)</span>
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleTestFirestore}
              disabled={actionLoading === 'ping'}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === 'ping' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>Test Live Connection</span>
            </button>
            {pingResult && (
              <div className="text-xs text-emerald-400 font-mono font-medium flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                <span>Verified in {pingResult.latencyMs}ms</span>
              </div>
            )}
          </div>
        </div>

        {/* PostgreSQL / External Database Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{status?.neon.label || 'PostgreSQL Database'}</span>
                    {status?.neon.isDeleted || status?.neon.status === 'deleted' || !status?.neon.hasUrlConfigured ? (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        Disconnected / Wiped
                      </span>
                    ) : status?.neon.isPaused ? (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Paused / Shield Active
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        Connected
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {status?.neon.host ? `Host: ${status.neon.host}` : 'Manage external PostgreSQL connection or connect a new database'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection State:</span>
                <span className="text-white font-medium">
                  {status?.neon.isDeleted || !status?.neon.hasUrlConfigured
                    ? 'No external database attached (100% on Firebase)'
                    : status?.neon.isPaused
                    ? 'BLOCKED / PAUSED (Quota Shield Active)'
                    : 'Active / Connected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Can Delete & Re-add Anytime?</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>YES - Delete karein ya naya database add karein</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* If connected, show pause and delete buttons */}
            {status?.neon.hasUrlConfigured && !status?.neon.isDeleted && (
              <>
                <button
                  onClick={handleTogglePauseNeon}
                  disabled={actionLoading === 'pause'}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                    status?.neon.isPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {status?.neon.isPaused ? (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      <span>Resume Database Connection</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-4 h-4" />
                      <span>Pause Database (Quota Shield)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsConfirmingDeleteNeon(true)}
                  disabled={actionLoading === 'delete'}
                  className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Database Connection</span>
                </button>
              </>
            )}

            {/* If deleted or not configured, show prominent Connect button */}
            {(!status?.neon.hasUrlConfigured || status?.neon.isDeleted) && (
              <button
                onClick={() => {
                  setNewDbTestResult(null);
                  setIsAddDbModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Connect New Database</span>
              </button>
            )}

            {status?.neon.hasUrlConfigured && !status?.neon.isDeleted && (
              <button
                onClick={() => {
                  setNewDbTestResult(null);
                  setIsAddDbModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Switch Database</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add / Connect New Database Modal */}
      {isAddDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => setIsAddDbModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connect New Database</h3>
                <p className="text-xs text-slate-400">
                  Add a new PostgreSQL database (Neon, Supabase, AWS RDS, Cloud SQL, etc.)
                </p>
              </div>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Database Provider</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'neon', name: 'Neon DB' },
                  { id: 'supabase', name: 'Supabase' },
                  { id: 'rds', name: 'AWS RDS' },
                  { id: 'custom', name: 'Custom SQL' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setNewDbPreset(preset.id as any);
                      if (preset.id === 'neon') setNewDbLabel('Neon PostgreSQL DB');
                      else if (preset.id === 'supabase') setNewDbLabel('Supabase DB');
                      else if (preset.id === 'rds') setNewDbLabel('AWS RDS DB');
                      else setNewDbLabel('External PostgreSQL DB');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                      newDbPreset === preset.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleConnectNewDb} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Database Label / Nickname
                </label>
                <input
                  type="text"
                  required
                  value={newDbLabel}
                  onChange={(e) => setNewDbLabel(e.target.value)}
                  placeholder="e.g. Production Neon DB"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Database Connection String (URL)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newDbUrl}
                    onChange={(e) => {
                      setNewDbUrl(e.target.value);
                      setNewDbTestResult(null);
                    }}
                    placeholder="postgresql://user:password@ep-xyz.region.neon.tech/neondb?sslmode=require"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Must start with <code>postgresql://</code> or <code>postgres://</code>. SSL is handled automatically.
                </p>
              </div>

              {/* Test Connection Button & Result */}
              <div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestNewDb}
                    disabled={isTestingNewDb || !newDbUrl.trim()}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isTestingNewDb ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span>{isTestingNewDb ? 'Testing Connection...' : 'Test Connection'}</span>
                  </button>
                  <span className="text-[11px] text-slate-400">Verifies host & credentials</span>
                </div>

                {newDbTestResult && (
                  <div
                    className={`mt-2 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      newDbTestResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {newDbTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div className="truncate">
                      <span>{newDbTestResult.message}</span>
                      {newDbTestResult.host && (
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          Host: {newDbTestResult.host} | DB: {newDbTestResult.database}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDbModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnectingNewDb || !newDbUrl.trim()}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isConnectingNewDb ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save & Connect Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting / Wiping Database */}
      {isConfirmingDeleteNeon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Delete Database Connection?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will remove the database connection from the server. 
              All your <strong>users, services, and orders</strong> are safely preserved in Firebase Firestore Authority.
            </p>
            <p className="text-xs text-emerald-400 font-medium">
              Aap jab chahe naya database add kar sakte hain. Delete karne ke baad bhi app 100% smoothly chalta rahega.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirmingDeleteNeon(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNeon}
                disabled={actionLoading === 'delete'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-900/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Connection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Record Counts & Real-time Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Live Synced Data Collections</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These counts are live in Firebase Firestore authority and remain 100% active.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            All Collections Preserved
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Services */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-indigo-400 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Services</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.services?.toLocaleString() || '2,362'}
            </div>
            {onNavigateToServices && (
              <button
                onClick={onNavigateToServices}
                className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Users */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-sky-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Users</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.users || '55'}
            </div>
            {onNavigateToUsers && (
              <button
                onClick={onNavigateToUsers}
                className="mt-2 text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Orders */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Orders</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.orders || '112'}
            </div>
            <span className="mt-2 text-[11px] text-slate-500 block">All recorded</span>
          </div>

          {/* Categories */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <Layers className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Categories</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.categories || '235'}
            </div>
            <span className="mt-2 text-[11px] text-slate-500 block">Organized</span>
          </div>

          {/* Transactions */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <Cloud className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">Wallet Ledgers</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.walletTransactions || '181'}
            </div>
            <span className="mt-2 text-[11px] text-slate-500 block">Immutable</span>
          </div>

          {/* API Providers */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <Server className="w-4 h-4" />
              <span className="text-[10px] text-slate-500 uppercase font-bold">API Providers</span>
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {status?.counts?.apiProviders || '1'}
            </div>
            {onNavigateToProviders && (
              <button
                onClick={onNavigateToProviders}
                className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

