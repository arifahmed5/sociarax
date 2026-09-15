import React, { useState, useEffect, useMemo } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge, PlatformBadge } from '../Badges';
import { 
  ShoppingBag, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  LogIn,
  PlusCircle,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  X,
  Send,
  LifeBuoy
} from 'lucide-react';
import { SociaraxOrder } from '../../types';

interface OrdersViewProps {
  onNavigate: (tab: string) => void;
  onOpenAuthModal?: () => void;
  onReorder?: (order: SociaraxOrder) => void;
  onReport?: (order: SociaraxOrder) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onNavigate, onOpenAuthModal, onReorder, onReport }) => {
  const { userOrders, formatCurrency, isOrdersLoading, loadUserOrders } = useSociarax();
  const { user, userToken } = useAuth();
  const isAuthenticated = Boolean(userToken || user || localStorage.getItem('sociarax_user_token'));

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Report / Complain Modal State
  const [reportingOrder, setReportingOrder] = useState<SociaraxOrder | null>(null);
  const [reportCategory, setReportCategory] = useState<'order' | 'speedup' | 'refill' | 'other'>('order');
  const [reportSubject, setReportSubject] = useState<string>('');
  const [reportMessage, setReportMessage] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>('');
  const [reportSuccessTicketId, setReportSuccessTicketId] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserOrders();
    }
  }, [isAuthenticated, loadUserOrders]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUserOrders();
    setIsRefreshing(false);
  };

  const handleOpenReport = (ord: SociaraxOrder) => {
    setReportingOrder(ord);
    setReportCategory('order');
    setReportSubject(`Issue with Order #${ord.id}: ${ord.serviceName}`);
    setReportMessage('');
    setReportError('');
    setReportSuccessTicketId(null);
  };

  const handleCloseReport = () => {
    setReportingOrder(null);
    setReportError('');
    setReportSuccessTicketId(null);
  };

  const handleQuickReason = (cat: 'order' | 'speedup' | 'refill' | 'other', text: string) => {
    setReportCategory(cat);
    setReportMessage(prev => prev ? `${prev}\n${text}` : text);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingOrder || !reportMessage.trim()) return;

    setIsSubmittingReport(true);
    setReportError('');

    try {
      const token = userToken || localStorage.getItem('sociarax_user_token');
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: reportSubject.trim() || `Complaint: Order #${reportingOrder.id}`,
          category: reportCategory,
          orderId: reportingOrder.id,
          message: reportMessage.trim()
        })
      });

      const data = await res.json();
      if (data.success && data.ticket) {
        setReportSuccessTicketId(data.ticket.id);
      } else {
        setReportError(data.error || 'Failed to submit report ticket.');
      }
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit report ticket.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return userOrders.filter(ord => {
      const matchStatus = statusFilter === 'all' || ord.status.toLowerCase() === statusFilter.toLowerCase();
      const matchSearch = !searchQuery.trim() ||
        String(ord.id).includes(searchQuery) ||
        ord.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.link.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [userOrders, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-indigo-400" />
            <span>Order History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Track and monitor the real-time progress of all your social media campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => onNavigate('new_order')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <LogIn className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Log in to view your orders</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 mb-6">
            Please log in or create an account to access your live campaigns, fulfillment metrics, and order history.
          </p>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Sign In / Register
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Filter Tabs & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'processing', label: 'Processing' },
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

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID or Link..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {isOrdersLoading && userOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium">Fetching orders from server...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-300">No orders found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {statusFilter !== 'all' ? `No orders in "${statusFilter}" status.` : 'You haven\'t placed any orders yet.'}
                </p>
                <button
                  onClick={() => onNavigate('new_order')}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  Place Your First Order
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Order ID</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Service & Target Link</th>
                      <th className="py-3.5 px-4">Quantity</th>
                      <th className="py-3.5 px-4">Charge</th>
                      <th className="py-3.5 px-4">Start / Remains</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                          #{ord.id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <PlatformBadge service={ord} />
                          </div>
                          <div className="font-semibold text-slate-200 truncate">{ord.serviceName}</div>
                          <a
                            href={ord.link.startsWith('http') ? ord.link : `https://${ord.link}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 mt-0.5 truncate max-w-[240px]"
                          >
                            <span className="truncate">{ord.link}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 font-bold">
                          {ord.quantity.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                          {formatCurrency(ord.charge)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300 text-xs">
                          <div>Start: {ord.startCount !== undefined ? ord.startCount.toLocaleString() : '-'}</div>
                          <div className="text-slate-500">Remains: {ord.remains !== undefined ? ord.remains.toLocaleString() : '-'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={ord.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onReorder ? onReorder(ord) : onNavigate('new_order')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
                              title="Reorder this service"
                            >
                              Reorder
                            </button>
                            <button
                              onClick={() => handleOpenReport(ord)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Report issue or complain about this order"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>Report</span>
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
        </>
      )}

      {/* Report / Complain Modal */}
      {reportingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button
              onClick={handleCloseReport}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-rose-400 font-bold text-lg mb-1">
                <AlertCircle className="w-5 h-5" />
                <span>Report Order #{reportingOrder.id}</span>
              </div>
              <p className="text-xs text-slate-400">
                Submit an urgent complaint or request to the 24/7 SociaraX support team.
              </p>
            </div>

            {/* Order snapshot summary */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PlatformBadge service={reportingOrder} />
                  <span className="font-semibold text-white truncate max-w-[220px]">
                    {reportingOrder.serviceName}
                  </span>
                </div>
                <StatusBadge status={reportingOrder.status} />
              </div>
              <div className="text-slate-400 truncate flex items-center justify-between">
                <span className="truncate max-w-[280px]">Link: {reportingOrder.link}</span>
                <span className="text-slate-300 font-mono font-medium">Qty: {reportingOrder.quantity.toLocaleString()}</span>
              </div>
            </div>

            {reportSuccessTicketId ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Complaint Submitted Successfully!</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Support Ticket <strong>#{reportSuccessTicketId}</strong> has been created. Our team will review this order promptly.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      handleCloseReport();
                      onNavigate('support');
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    <span>View in Support Desk</span>
                  </button>
                  <button
                    onClick={handleCloseReport}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                {reportError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{reportError}</span>
                  </div>
                )}

                {/* Quick reason pills */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Quick Complaint Type:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickReason('speedup', 'Order is running slower than estimated. Please speed it up.')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        reportCategory === 'speedup'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ⚡ Speed Up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickReason('refill', 'Follower/subscriber count dropped. Requesting non-drop refill under guarantee.')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        reportCategory === 'refill'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      🔄 Request Refill
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickReason('order', 'Order has not started yet after expected start time.')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        reportCategory === 'order'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ⏳ Not Started
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickReason('other', 'Issue with fulfillment or link error.')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        reportCategory === 'other'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ❓ Other Issue
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Subject:
                  </label>
                  <input
                    type="text"
                    value={reportSubject}
                    onChange={(e) => setReportSubject(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Detailed Explanation:
                  </label>
                  <textarea
                    rows={3}
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    required
                    placeholder="Describe what happened so support can immediately resolve it..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseReport}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport || !reportMessage.trim()}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    {isSubmittingReport ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Report</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
