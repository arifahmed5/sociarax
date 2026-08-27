import React, { useState, useEffect } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { PaymentRequestItem } from '../../types';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  X,
  User
} from 'lucide-react';

export const AdminPaymentsView: React.FC = () => {
  const { 
    adminPendingPayments, 
    adminPaymentHistory, 
    formatCurrency, 
    isPaymentsLoading, 
    loadAdminPendingPayments, 
    loadAdminPaymentHistory,
    approvePayment, 
    rejectPayment 
  } = useSociarax();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<PaymentRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState('Invalid or unverified UTR number');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadAdminPendingPayments();
    loadAdminPaymentHistory();

    const interval = setInterval(() => {
      loadAdminPendingPayments();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadAdminPendingPayments, loadAdminPaymentHistory]);

  const handleApprove = async (id: number) => {
    setIsProcessing(true);
    setActionNotice(null);
    const res = await approvePayment(id);
    setIsProcessing(false);

    if (res.success) {
      setActionNotice({ type: 'success', message: res.message || 'Payment approved and wallet credited!' });
      setTimeout(() => setActionNotice(null), 4000);
    } else {
      setActionNotice({ type: 'error', message: res.error || 'Failed to approve payment' });
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    setIsProcessing(true);
    setActionNotice(null);
    const res = await rejectPayment(rejectingItem.id, rejectReason);
    setIsProcessing(false);

    if (res.success) {
      setRejectingItem(null);
      setActionNotice({ type: 'success', message: 'Payment marked as rejected.' });
      setTimeout(() => setActionNotice(null), 4000);
    } else {
      setActionNotice({ type: 'error', message: res.error || 'Failed to reject payment' });
    }
  };

  const handleRefresh = async () => {
    await loadAdminPendingPayments();
    await loadAdminPaymentHistory();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            <span>Manual Payment & UTR Verification Queue</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Verify manual UPI / IMPS payments, match UTR numbers, and credit user wallet balances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Table"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          actionNotice.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
        }`}>
          {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 max-w-sm">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pending Approvals ({adminPendingPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit History ({adminPaymentHistory.length})
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {activeTab === 'pending' ? (
          adminPendingPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-200">Payment Queue is Clear!</p>
              <p className="text-xs text-slate-500 mt-1">No pending manual deposits waiting for approval.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4">12-Digit UTR / Ref ID</th>
                    <th className="py-3.5 px-4">Payer Details</th>
                    <th className="py-3.5 px-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {adminPendingPayments.map(req => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                        #{req.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{req.username}</div>
                        <div className="text-[11px] text-slate-500">{req.email}</div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          Bal: {formatCurrency(req.currentUserBalance || 0)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base">
                        {formatCurrency(req.amount)}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-slate-300 font-semibold">
                        {req.method}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white select-all font-bold bg-slate-950/40 p-2 rounded">
                        {req.utr}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {req.payerDetails || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve (+{formatCurrency(req.amount)})</span>
                          </button>
                          <button
                            onClick={() => setRejectingItem(req)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">UTR</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Details / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {adminPaymentHistory.map(req => (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">#{req.id}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">{req.username}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {formatCurrency(req.amount)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{req.utr}</td>
                    <td className="py-3.5 px-4">
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {req.rejectionReason || req.payerDetails || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setRejectingItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              Reject Payment #{rejectingItem.id}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              User: <strong className="text-slate-200">{rejectingItem.username}</strong> • Amount: <strong className="text-emerald-400 font-mono">{formatCurrency(rejectingItem.amount)}</strong>
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Rejection Reason
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-rose-500"
                >
                  <option value="Invalid or unverified UTR number">Invalid or unverified UTR number</option>
                  <option value="Payment not received in merchant account">Payment not received in merchant account</option>
                  <option value="Amount mismatch with bank credit">Amount mismatch with bank credit</option>
                  <option value="Duplicate submission of previous UTR">Duplicate submission of previous UTR</option>
                  <option value="Other / Suspected fraudulent entry">Other / Suspected fraudulent entry</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Confirm Payment Rejection'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
