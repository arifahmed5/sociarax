import React, { useState, useEffect, useMemo } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { AdminOrder } from '../../types';
import { StatusBadge, PlatformBadge } from '../Badges';
import { 
  ShoppingBag, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Server, 
  Edit3, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  ShieldAlert
} from 'lucide-react';

export const AdminOrdersView: React.FC = () => {
  const { 
    adminOrders, 
    formatCurrency, 
    isOrdersLoading, 
    loadAdminOrders, 
    updateAdminOrderStatus, 
    syncAdminOrderStatus 
  } = useSociarax();

  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');

  // Editing order state
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [newStatus, setNewStatus] = useState<string>('completed');
  const [shouldRefund, setShouldRefund] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string>('');

  // Live Provider Verify Modal state
  const [verifyingOrder, setVerifyingOrder] = useState<AdminOrder | null>(null);
  const [providerVerifyResult, setProviderVerifyResult] = useState<any>(null);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_user_token') || '';

  useEffect(() => {
    loadAdminOrders();
  }, []); // Run once on component mount

  const handleVerifyProvider = async (order: AdminOrder) => {
    setVerifyingOrder(order);
    setProviderVerifyResult(null);
    setVerifyError('');
    setIsCheckingProvider(true);

    try {
      const res = await fetch(`/api/orders/admin/${order.id}/verify-provider`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setProviderVerifyResult(data);
        // Refresh local orders to reflect any updated status
        loadAdminOrders();
      } else {
        setVerifyError(data.error || 'Failed to verify with provider.');
      }
    } catch (err: any) {
      setVerifyError('Network error connecting to provider verification API.');
    } finally {
      setIsCheckingProvider(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncNotice('');
    const res = await syncAdminOrderStatus();
    setIsSyncing(false);
    if (res.success) {
      setSyncNotice(res.message || 'Upstream provider orders synchronized successfully!');
      setTimeout(() => setSyncNotice(''), 4000);
    }
  };

  const handleOpenEdit = (order: AdminOrder) => {
    setEditingOrder(order);
    setNewStatus(order.status);
    setShouldRefund(order.status !== 'refunded' && order.status !== 'cancelled');
    setUpdateError('');
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setUpdateError('');
    setIsUpdating(true);

    const res = await updateAdminOrderStatus(
      editingOrder.id,
      newStatus,
      newStatus === 'refunded' || newStatus === 'cancelled' ? shouldRefund : false
    );
    setIsUpdating(false);

    if (res.success) {
      setEditingOrder(null);
    } else {
      setUpdateError(res.error || 'Failed to update order status');
    }
  };

  const filteredOrders = useMemo(() => {
    return adminOrders.filter(ord => {
      const matchStatus = statusFilter === 'all' || ord.status === statusFilter;
      const matchPlatform = platformFilter === 'all' || ord.platform === platformFilter;
      const matchSearch = !searchQuery.trim() ||
        String(ord.id).includes(searchQuery) ||
        ord.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ord.providerOrderId && ord.providerOrderId.includes(searchQuery)) ||
        ord.link.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchPlatform && matchSearch;
    });
  }, [adminOrders, statusFilter, platformFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-400" />
            <span>Customer Orders & Upstream Dispatch</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Total {adminOrders.length} orders. Real-time profit and provider order tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAdminOrders()}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Table"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Server className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Provider Orders'}</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'processing', label: 'Processing' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'refunded', label: 'Refunded' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search user, order ID, provider ID..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {isOrdersLoading && adminOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading orders from database...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-base font-semibold text-slate-300">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Service & Target</th>
                  <th className="py-3.5 px-4">Qty</th>
                  <th className="py-3.5 px-4">Charge / Cost / Profit</th>
                  <th className="py-3.5 px-4">Provider Info</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      #{ord.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{ord.username}</div>
                      <div className="text-[11px] text-slate-500">{ord.email}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <PlatformBadge platform={ord.platform} />
                      </div>
                      <div className="font-medium text-slate-200 truncate">{ord.serviceName}</div>
                      <a
                        href={ord.link.startsWith('http') ? ord.link : `https://${ord.link}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-0.5 truncate max-w-[200px]"
                      >
                        <span className="truncate">{ord.link}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                      {ord.quantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-white font-bold">{formatCurrency(ord.charge)}</div>
                      <div className="text-[11px] text-rose-400/90 flex items-center gap-1">
                        <span>Cost: {formatCurrency(ord.providerCost)}</span>
                        {ord.providerCostUsd !== undefined && ord.providerCostUsd > 0 && (
                          <span className="text-[10px] text-rose-300/80 font-sans font-medium">
                            (${Number(ord.providerCostUsd).toFixed(3)} USD)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-bold">
                        Profit: {formatCurrency(ord.profit)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-slate-300 font-medium">{ord.providerName || 'Direct'}</div>
                      <div className="text-[11px] font-mono text-indigo-400">
                        {ord.providerOrderId ? `Ext ID: #${ord.providerOrderId}` : 'No Ext ID'}
                      </div>
                      {ord.providerError && (
                        <div className="text-[10px] text-rose-400 line-clamp-1" title={ord.providerError}>
                          Err: {ord.providerError}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {ord.providerOrderId && (
                          <button
                            onClick={() => handleVerifyProvider(ord)}
                            className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                            title="Verify on Upstream Provider API"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(ord)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Edit Status / Refund"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Provider Verification Modal */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setVerifyingOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-indigo-400">
              <Server className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">
                Live Upstream Verification
              </h3>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono font-bold text-white">#{verifyingOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Provider:</span>
                <span className="text-indigo-300 font-semibold">{verifyingOrder.providerName || 'LuvSMM'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Provider Order ID:</span>
                <span className="font-mono font-bold text-amber-300">#{verifyingOrder.providerOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Service:</span>
                <span className="text-slate-200 truncate max-w-[240px]">{verifyingOrder.serviceName}</span>
              </div>
            </div>

            {isCheckingProvider ? (
              <div className="p-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300">Querying {verifyingOrder.providerName || 'LuvSMM'} API in real-time...</p>
              </div>
            ) : verifyError ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Verification Error</span>
                </div>
                <p>{verifyError}</p>
              </div>
            ) : providerVerifyResult ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Live Status on LuvSMM
                    </span>
                    <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-emerald-500/20 uppercase">
                      {providerVerifyResult.liveProviderResponse?.status || 'Active'}
                    </span>
                  </div>
                  {providerVerifyResult.liveProviderResponse?.remains !== undefined && (
                    <div className="text-slate-300 text-[11px] flex justify-between">
                      <span>Remains: {providerVerifyResult.liveProviderResponse.remains}</span>
                      <span>Start Count: {providerVerifyResult.liveProviderResponse.start_count || 0}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">Raw Upstream JSON Response:</span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-36">
                    {JSON.stringify(providerVerifyResult.liveProviderResponse, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">
              Update Order #{editingOrder.id}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              User: <strong className="text-slate-200">{editingOrder.username}</strong> • Charge: <strong className="text-emerald-400 font-mono">{formatCurrency(editingOrder.charge)}</strong>
            </p>

            {updateError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {(newStatus === 'cancelled' || newStatus === 'refunded') && (
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shouldRefund}
                      onChange={(e) => setShouldRefund(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Refund {formatCurrency(editingOrder.charge)} to user's wallet
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    If checked, an atomic transaction will credit {formatCurrency(editingOrder.charge)} back to {editingOrder.username}'s wallet.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
