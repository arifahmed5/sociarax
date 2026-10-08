import React, { useState } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { ApiProvider } from '../../types';
import { formatExactProviderBalance } from '../../utils/formatters';
import { 
  Server, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Key, 
  ExternalLink, 
  X,
  ShieldCheck,
  Zap,
  Trash2,
  Power,
  Search,
  ListFilter,
  Download
} from 'lucide-react';

export const AdminProvidersView: React.FC = () => {
  const { 
    adminProviders, 
    formatCurrency, 
    loadAdminProviders, 
    createAdminProvider, 
    updateAdminProvider, 
    deleteAdminProvider,
    toggleAdminProviderStatus,
    testAdminProvider,
    scanProviderServices,
    syncProviderServices,
    settings 
  } = useSociarax();

  const exchangeRate = Number(settings?.usd_to_inr_rate) || 89.5;

  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string; balance?: number; rawBalanceString?: string } | null>(null);

  // Scanning Modal State
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState<{ providerId: number; providerName: string; totalServices: number; services: any[] } | null>(null);
  const [scanSearch, setScanSearch] = useState('');
  const [isSyncingFromScan, setIsSyncingFromScan] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);

  // Form State
  const [name, setName] = useState('Luvsmm Main API');
  const [adapterType, setAdapterType] = useState('luvsmm');
  const [apiUrl, setApiUrl] = useState('https://luvsmm.com/api/v2');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    const res = await testAdminProvider(id);
    setTestingId(null);

    setTestResult({
      id,
      success: res.success,
      message: res.success ? (res.message || 'Connection successful') : (res.error || 'Connection failed'),
      balance: res.balance,
      rawBalanceString: res.rawBalanceString
    });
  };

  const handleScanServices = async (provider: ApiProvider) => {
    setScanningId(provider.id);
    setSyncStatusMsg(null);
    const res = await scanProviderServices(provider.id);
    setScanningId(null);

    if (res.success && res.services) {
      setScannedData({
        providerId: provider.id,
        providerName: provider.name,
        totalServices: res.totalServices || res.services.length,
        services: res.services
      });
      setIsScanModalOpen(true);
    } else {
      setTestResult({
        id: provider.id,
        success: false,
        message: res.error || 'Failed to scan services from provider API'
      });
    }
  };

  const handleToggleStatus = async (provider: ApiProvider) => {
    await toggleAdminProviderStatus(provider.id);
  };

  const handleDeleteProvider = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this API provider?')) return;
    setDeletingId(id);
    await deleteAdminProvider(id);
    setDeletingId(null);
  };

  const handleSyncScannedServices = async () => {
    if (!scannedData) return;
    setIsSyncingFromScan(true);
    setSyncStatusMsg(null);
    const res = await syncProviderServices(scannedData.providerId, 30);
    setIsSyncingFromScan(false);
    if (res.success) {
      setSyncStatusMsg({ success: true, message: res.message || 'Services synced successfully to Firestore!' });
    } else {
      setSyncStatusMsg({ success: false, message: res.error || 'Sync failed' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    if (editingProvider) {
      const res = await updateAdminProvider(editingProvider.id, {
        name,
        apiUrl,
        apiKey: apiKey || undefined,
        status,
        currency
      });
      setIsSaving(false);
      if (res.success) {
        setEditingProvider(null);
        setApiKey('');
      } else {
        setFormError(res.error || 'Failed to update provider');
      }
    } else {
      if (!apiKey) {
        setFormError('API Key is required');
        setIsSaving(false);
        return;
      }
      const res = await createAdminProvider({
        name,
        adapterType,
        apiUrl,
        apiKey,
        status,
        currency
      });
      setIsSaving(false);
      if (res.success) {
        setIsAddModalOpen(false);
        setApiKey('');
      } else {
        setFormError(res.error || 'Failed to add provider');
      }
    }
  };

  const handleOpenEdit = (p: ApiProvider) => {
    setEditingProvider(p);
    setName(p.name);
    setAdapterType(p.adapterType);
    setApiUrl(p.apiUrl);
    setApiKey('');
    setStatus(p.status);
    setCurrency(p.currency?.toUpperCase() === 'USD' ? 'USD' : 'INR');
    setFormError('');
  };

  const filteredScannedServices = React.useMemo(() => {
    if (!scannedData?.services) return [];
    if (!scanSearch.trim()) return scannedData.services.slice(0, 100);
    const q = scanSearch.toLowerCase();
    return scannedData.services.filter(s => 
      String(s.service || s.id || '').toLowerCase().includes(q) ||
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.category || '').toLowerCase().includes(q)
    ).slice(0, 100);
  }, [scannedData, scanSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" />
            <span>API Providers & Upstream Connections</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Manage upstream SMM API connections with AES-256 encrypted keys. Scan real-time services and import on demand.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAdminProviders()}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Providers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setIsAddModalOpen(true); setFormError(''); }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {adminProviders.map(provider => (
          <div 
            key={provider.id}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{provider.name}</h3>
                    <span className="text-[11px] text-slate-400 font-mono">Adapter: {provider.adapterType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(provider)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                      provider.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                    title="Click to Pause/Activate"
                  >
                    {provider.status === 'active' ? '● Active' : '○ Inactive'}
                  </button>
                </div>
              </div>

              {/* Endpoint & Key details */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 mb-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">API Endpoint:</span>
                  <span className="font-mono text-indigo-300 truncate max-w-[200px]">{provider.apiUrl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Encrypted Key:</span>
                  <span className="font-mono text-slate-400">{provider.maskedKey}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Live Upstream Balance:</span>
                  <div className="text-right">
                    {provider.currency?.toUpperCase() === 'INR' ? (
                      <>
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          ₹{formatExactProviderBalance(provider.rawBalanceString || provider.balance)} INR
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          (≈ ${formatExactProviderBalance((Number(provider.balance) || 0) / exchangeRate)} USD)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          ${formatExactProviderBalance(provider.rawBalanceString || provider.balance)} USD
                        </span>
                        <span className="text-[10px] text-emerald-300 font-mono font-medium">
                          (≈ ₹{((Number(provider.balance) || 0) * exchangeRate).toFixed(2)} INR)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Result Message */}
              {testResult && testResult.id === provider.id && (
                <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleTestConnection(provider.id)}
                disabled={testingId === provider.id}
                className="py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${testingId === provider.id ? 'animate-spin' : ''}`} />
                <span>{testingId === provider.id ? 'Testing...' : 'Test Balance'}</span>
              </button>
              <button
                onClick={() => handleScanServices(provider)}
                disabled={scanningId === provider.id}
                className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Scan real-time services from provider API"
              >
                <Search className={`w-3.5 h-3.5 ${scanningId === provider.id ? 'animate-spin' : ''}`} />
                <span>{scanningId === provider.id ? 'Scanning...' : 'Scan Services'}</span>
              </button>
              <button
                onClick={() => handleOpenEdit(provider)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Edit Provider & API Key"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteProvider(provider.id)}
                disabled={deletingId === provider.id}
                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                title="Delete Provider"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Real-Time Scanned Services Modal */}
      {isScanModalOpen && scannedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl relative">
            <button
              onClick={() => setIsScanModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <span>Real-Time Services: {scannedData.providerName}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Loaded {scannedData.totalServices} live services directly from upstream API.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncScannedServices}
                  disabled={isSyncingFromScan}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${isSyncingFromScan ? 'animate-spin' : ''}`} />
                  <span>{isSyncingFromScan ? 'Syncing...' : 'Sync All to System'}</span>
                </button>
              </div>
            </div>

            {syncStatusMsg && (
              <div className={`mb-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                syncStatusMsg.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
              }`}>
                {syncStatusMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{syncStatusMsg.message}</span>
              </div>
            )}

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search real-time services by ID, name, or category..."
                value={scanSearch}
                onChange={(e) => setScanSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">ID</th>
                    <th className="py-2.5 px-3 font-semibold">Service Name</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Provider Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Min / Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredScannedServices.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono text-indigo-400">{s.service || s.id}</td>
                      <td className="py-2 px-3 text-slate-200 font-medium max-w-xs truncate">{s.name}</td>
                      <td className="py-2 px-3 text-slate-400 max-w-xs truncate">{s.category || 'General'}</td>
                      <td className="py-2 px-3 font-mono text-emerald-400 text-right">
                        ${s.rate || 0}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {s.min} - {s.max}
                      </td>
                    </tr>
                  ))}
                  {filteredScannedServices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No services matching your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredScannedServices.length} of {scannedData.totalServices} upstream services</span>
              <button
                onClick={() => setIsScanModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingProvider) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => { setIsAddModalOpen(false); setEditingProvider(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              {editingProvider ? 'Edit API Provider' : 'Add API Provider'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter upstream SMM provider credentials.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Luvsmm Main"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">API URL (Endpoint)</label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://luvsmm.com/api/v2"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  API Key {editingProvider && '(Leave blank to keep existing encrypted key)'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required={!editingProvider}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter provider API key"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium"
                  >
                    <option value="INR">INR (₹ Rupee)</option>
                    <option value="USD">USD ($ Dollar)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving Provider...' : 'Save Provider'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
