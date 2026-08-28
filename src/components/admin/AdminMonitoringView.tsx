import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Database, 
  Lock, 
  Zap, 
  Clock, 
  Cpu, 
  Play, 
  Radio, 
  Layers, 
  Terminal,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SubsystemHealth {
  name: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  lastChecked: string;
  latencyMs: number;
  message: string;
  details?: Record<string, any>;
}

interface IncidentRecord {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  subsystem: string;
  title: string;
  description: string;
  status: 'OPEN' | 'AUTO_RESOLVED' | 'MITIGATED' | 'ESCALATED';
  recoveryActionTaken?: string;
  resolvedAt?: string;
}

interface SmokeTestResult {
  suite: string;
  testName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  message: string;
}

interface SmokeTestSummary {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  overallStatus: 'PASSED' | 'FAILED';
  results: SmokeTestResult[];
}

export const AdminMonitoringView: React.FC = () => {
  const { adminToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Smoke test states
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<SmokeTestSummary | null>(null);

  // Log viewer states
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<string>('ALL');

  const fetchMonitoringData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/monitoring/status', {
        headers: {
          'Authorization': adminToken ? `Bearer ${adminToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to retrieve diagnostics');
      }

      // Fetch logs
      const logRes = await fetch(`/api/monitoring/logs?limit=50${logFilter !== 'ALL' ? `&level=${logFilter}` : ''}`, {
        headers: {
          'Authorization': adminToken ? `Bearer ${adminToken}` : ''
        }
      });
      const logJson = await logRes.json();
      if (logJson.success) {
        setLogs(logJson.data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching monitoring telemetry');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, [adminToken, logFilter]);

  const handleRunSmokeTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/monitoring/run-smoke-tests', {
        method: 'POST',
        headers: {
          'Authorization': adminToken ? `Bearer ${adminToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (json.success) {
        setTestResults(json.data);
        fetchMonitoringData();
      } else {
        alert('Smoke test execution returned: ' + json.error);
      }
    } catch (err: any) {
      alert('Error triggering smoke test suite: ' + err.message);
    } finally {
      setRunningTests(false);
    }
  };

  const handleResetCircuitBreakers = async () => {
    try {
      const res = await fetch('/api/monitoring/circuit-breaker/reset', {
        method: 'POST',
        headers: {
          'Authorization': adminToken ? `Bearer ${adminToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: 'all' })
      });
      const json = await res.json();
      if (json.success) {
        fetchMonitoringData();
      }
    } catch (err: any) {
      alert('Failed to reset circuit breakers: ' + err.message);
    }
  };

  const getStatusBadge = (status: 'HEALTHY' | 'WARNING' | 'CRITICAL') => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Healthy
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Warning
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            Critical
          </span>
        );
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Connecting to 24/7 Self-Healing Telemetry Engine...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const subsystems = data?.subsystems || {};
  const circuits = data?.circuits || {};
  const recentIncidents: IncidentRecord[] = data?.recentIncidents || [];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  24/7 Self-Healing & System Monitor
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Production Shield Active
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous health verification, transient error recovery, circuit breakers & incident audit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunSmokeTests}
              disabled={runningTests}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
              {runningTests ? 'Executing Diagnostics...' : 'Run Live Smoke Tests'}
            </button>

            <button
              onClick={() => fetchMonitoringData(true)}
              disabled={refreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>System State</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">
              {data?.overallStatus === 'HEALTHY' ? '100% Operational' : data?.overallStatus || 'Active'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3" />
            Auto-healing shield online
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Average API Latency</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">{metrics.averageLatencyMs || 2}ms</span>
            <span className="text-xs text-slate-500 font-mono">p95: {metrics.p95LatencyMs || 5}ms</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            Throughput: <span className="text-slate-200">{metrics.requestsPerMinute || 0} RPM</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Error Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-extrabold ${(metrics.errorRatePercent || 0) > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {metrics.errorRatePercent || 0}%
            </span>
            <span className="text-xs text-slate-500">4xx/5xx</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            Server 5xx: <span className="text-slate-200">{metrics.serverErrors || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Server Uptime</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">{formatUptime(metrics.uptimeSeconds || 0)}</span>
          </div>
          <div className="mt-1 text-[11px] text-purple-400 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Build: {data?.version || '3.4.0'}
          </div>
        </div>
      </div>

      {/* Smoke Test Results Dialog / Card */}
      {testResults && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">
                Live Smoke Tests Verification Suite ({testResults.passed}/{testResults.totalTests} Passed)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{testResults.durationMs}ms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {testResults.results.map((r, idx) => (
              <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-300">{r.testName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.status === 'PASSED' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{r.message}</div>
                <div className="mt-1 text-[9px] text-slate-600 font-mono">{r.suite} • {r.durationMs}ms</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subsystem Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Core Subsystem Health Diagnostics
          </h2>
          <span className="text-xs text-slate-500">Autonomous Checks every 20s</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(subsystems).map(([key, sub]: [string, any]) => (
            <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{sub.name}</span>
                  {getStatusBadge(sub.status)}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{sub.message}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Latency: {sub.latencyMs}ms</span>
                <span>{new Date(sub.lastChecked).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Circuit Breakers & Anti-Infinite-Loop Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Circuit Breakers & Cascading Fault Isolation</h3>
            </div>
            <button
              onClick={handleResetCircuitBreakers}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(circuits).map(([name, c]: [string, any]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-white capitalize">{c.name.replace(/_/g, ' ')}</div>
                  <div className="text-[10px] text-slate-500">
                    Executions: {c.totalExecutions} | Failures: {c.failureCount} | Trips: {c.totalTrips}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.state === 'CLOSED' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : c.state === 'HALF_OPEN'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {c.state}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl text-xs text-indigo-300">
            <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Anti-Infinite-Loop & Financial Protection
            </div>
            Auto-recoveries are rate-limited to 6 per 15-minute window. Financial transactions & wallet operations are strict-isolated and never automatically retried without verified idempotency tokens.
          </div>
        </div>

        {/* Incidents & Self-Healing Events */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Recent Incidents & Automated Recoveries</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {data?.selfHealingEventsCount || 0} Auto-actions
              </span>
            </div>

            {recentIncidents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                No active incidents. System running smoothly with zero unresolved errors.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {recentIncidents.map((inc) => (
                  <div key={inc.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200">{inc.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.status === 'AUTO_RESOLVED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : inc.status === 'MITIGATED'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{inc.description}</p>
                    {inc.recoveryActionTaken && (
                      <div className="mt-1 text-[10px] text-emerald-400 font-mono">
                        ✓ Action: {inc.recoveryActionTaken}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Self-Healing Engine: Active</span>
            <span className="text-emerald-400 font-medium">Autonomous Watchdog</span>
          </div>
        </div>
      </div>

      {/* Real-time Sanitized System Log Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Sanitized Production System Logs</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter:</span>
            {['ALL', 'WARNING', 'ERROR', 'CRITICAL'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLogFilter(lvl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  logFilter === lvl
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs max-h-72 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-600 text-center py-4">No log records match current filter.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="leading-relaxed border-b border-slate-900 pb-1.5 last:border-0">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span className={`font-bold ${
                  log.level === 'CRITICAL' ? 'text-rose-400' :
                  log.level === 'ERROR' ? 'text-rose-300' :
                  log.level === 'WARNING' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  [{log.level}]
                </span>{' '}
                <span className="text-indigo-400">[{log.subsystem}]</span>{' '}
                <span className="text-slate-200">{log.message}</span>
                {log.path && <span className="text-slate-500 ml-2 font-sans text-[11px]">{log.method} {log.path}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
