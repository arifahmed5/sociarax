import React, { useState } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { ApiProvider } from '../../types';
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
  Zap
} from 'lucide-react';

export const AdminProvidersView: React.FC = () => {
  const { 
    adminProviders, 
    formatCurrency, 
    loadAdminProviders, 
    createAdminProvider, 
    updateAdminProvider, 
    testAdminProvider 
  } = useSociarax();

  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string; balance?: number } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);

  // Form State
  const [name, setName] = useState('Luvsmm Main API');
  const [adapterType, setAdapterType] = useState('luvsmm');
  const [apiUrl, setApiUrl] = useState('https://luvsmm.com/api/v2');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
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
      balance: res.balance
    });
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
        status
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
        status
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
    setFormError('');
  };

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
            Manage upstream SMM API connections (Luvsmm and standard v2 APIs) with AES-256 encrypted keys.
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

                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  provider.status === 'active' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {provider.status}
                </span>
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
                          ₹{(Number(provider.balance) || 0).toFixed(2)} INR
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          (≈ ${((Number(provider.balance) || 0) / 88).toFixed(2)} USD)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-bold text-emerald-400 text-sm block">
                          ${(Number(provider.balance) || 0).toFixed(2)} USD
                        </span>
                        <span className="text-[10px] text-emerald-300 font-mono font-medium">
                          (≈ ₹{((Number(provider.balance) || 0) * 88).toFixed(2)} INR)
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
                  <span>{testResult.message} {testResult.balance !== undefined ? `(Live Balance: ${testResult.balance})` : ''}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleTestConnection(provider.id)}
                disabled={testingId === provider.id}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${testingId === provider.id ? 'animate-spin' : ''}`} />
                <span>{testingId === provider.id ? 'Testing...' : 'Test Connection'}</span>
              </button>
              <button
                onClick={() => handleOpenEdit(provider)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Edit Provider"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

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
