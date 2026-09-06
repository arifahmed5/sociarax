import React, { useState, useEffect, useRef } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { SupportTicket, TicketMessage } from '../../types';
import { 
  LifeBuoy, 
  MessageSquare, 
  Search, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Send, 
  User, 
  Mail, 
  X, 
  Check, 
  ShieldCheck, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';

export const AdminSupportView: React.FC = () => {
  const { 
    adminTickets, 
    isAdminTicketsLoading, 
    loadAdminTickets, 
    adminReplyTicket, 
    updateAdminTicketStatus 
  } = useSociarax();

  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'resolved' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Selected ticket for conversation view
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);
  const [autoResolveOnReply, setAutoResolveOnReply] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial load and periodic refresh
  useEffect(() => {
    loadAdminTickets();
  }, [loadAdminTickets]);

  // When a ticket is opened, load its full message thread
  useEffect(() => {
    if (!selectedTicket) {
      setTicketMessages([]);
      return;
    }

    const fetchTicketMessages = async () => {
      setIsMessagesLoading(true);
      try {
        const token = localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_user_token');
        const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success && data.messages) {
          setTicketMessages(data.messages);
        }
      } catch (err) {
        console.error('[FETCH TICKET MESSAGES ERROR]:', err);
      } finally {
        setIsMessagesLoading(false);
      }
    };

    fetchTicketMessages();
  }, [selectedTicket]);

  // Scroll to bottom of message thread
  useEffect(() => {
    if (ticketMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticketMessages]);

  // Quick reply macro presets
  const quickMacros = [
    'Your order is being accelerated in our high-speed provider queue now.',
    'Payment has been verified and your wallet balance is updated.',
    'Refill requested successfully! Please monitor your counter over the next 1-4 hours.',
    'Please ensure your target social profile/post is set to 100% public.'
  ];

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    setNotice(null);

    const res = await adminReplyTicket(selectedTicket.id, replyText.trim());

    if (res.success) {
      // If admin selected auto-resolve
      if (autoResolveOnReply) {
        await updateAdminTicketStatus(selectedTicket.id, 'resolved');
        setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
      } else {
        setSelectedTicket(prev => prev ? { ...prev, status: 'pending' } : null);
      }

      // Add message locally to thread immediately
      setTicketMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          ticketId: selectedTicket.id,
          senderRole: 'admin',
          senderId: 1,
          message: replyText.trim(),
          createdAt: new Date().toISOString()
        }
      ]);

      setReplyText('');
      setNotice({ type: 'success', message: 'Reply sent to customer successfully!' });
      setTimeout(() => setNotice(null), 3000);
    } else {
      setNotice({ type: 'error', message: res.error || 'Failed to send reply' });
    }

    setIsSubmittingReply(false);
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    const res = await updateAdminTicketStatus(ticketId, newStatus);
    if (res.success) {
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
      setNotice({ type: 'success', message: `Ticket #${ticketId} status updated to ${newStatus}` });
      setTimeout(() => setNotice(null), 3000);
    } else {
      setNotice({ type: 'error', message: res.error || 'Failed to update status' });
    }
  };

  // Filtered tickets calculation
  const filteredTickets = adminTickets.filter(ticket => {
    // Status tab filter
    if (activeTab !== 'all' && ticket.status !== activeTab) return false;

    // Category filter
    if (selectedCategory !== 'all' && ticket.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = String(ticket.id).includes(q);
      const matchSubject = ticket.subject.toLowerCase().includes(q);
      const matchUsername = (ticket.username || '').toLowerCase().includes(q);
      const matchEmail = (ticket.email || '').toLowerCase().includes(q);
      const matchOrder = ticket.orderId ? String(ticket.orderId).includes(q) : false;
      return matchId || matchSubject || matchUsername || matchEmail || matchOrder;
    }

    return true;
  });

  const openCount = adminTickets.filter(t => t.status === 'open').length;
  const pendingCount = adminTickets.filter(t => t.status === 'pending').length;
  const resolvedCount = adminTickets.filter(t => t.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Support Desk & User Inquiries
              {openCount > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse font-semibold">
                  {openCount} Open
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Review and respond to client support tickets, order assistance requests, and payment inquiries.
            </p>
          </div>
        </div>

        <button
          onClick={() => loadAdminTickets()}
          disabled={isAdminTicketsLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
          title="Refresh Support Tickets"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAdminTicketsLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Notice Toast */}
      {notice && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold border shadow-lg transition-all ${
          notice.type === 'success'
            ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div 
          onClick={() => setActiveTab('open')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'open'
              ? 'bg-rose-950/40 border-rose-500/50 shadow-md'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Needs Response</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-400 mt-2 font-mono">{openCount}</p>
          <span className="text-[10px] text-slate-500">Awaiting agent reply</span>
        </div>

        <div 
          onClick={() => setActiveTab('pending')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-950/40 border-amber-500/50 shadow-md'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending User</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-400 mt-2 font-mono">{pendingCount}</p>
          <span className="text-[10px] text-slate-500">Waiting on customer</span>
        </div>

        <div 
          onClick={() => setActiveTab('resolved')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'resolved'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-2 font-mono">{resolvedCount}</p>
          <span className="text-[10px] text-slate-500">Successfully closed</span>
        </div>

        <div 
          onClick={() => setActiveTab('all')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Inquiries</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white mt-2 font-mono">{adminTickets.length}</p>
          <span className="text-[10px] text-slate-500">All customer tickets</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Tickets', count: adminTickets.length },
              { id: 'open', label: 'Open', count: openCount, badgeColor: 'bg-rose-500/20 text-rose-400' },
              { id: 'pending', label: 'Pending', count: pendingCount, badgeColor: 'bg-amber-500/20 text-amber-400' },
              { id: 'resolved', label: 'Resolved', count: resolvedCount, badgeColor: 'bg-emerald-500/20 text-emerald-400' },
              { id: 'closed', label: 'Closed', count: adminTickets.filter(t => t.status === 'closed').length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : tab.badgeColor || 'bg-slate-700 text-slate-300'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="order">Order Issues</option>
              <option value="payment">Payment & Wallet</option>
              <option value="service">Service Speed / Refill</option>
              <option value="account">Account & Login</option>
              <option value="other">Other Inquiry</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ticket, user, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tickets Table / List */}
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No support tickets found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'No tickets matched your search query.' : 'There are currently no tickets in this filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">ID & Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Subject & Category</th>
                  <th className="px-4 py-3">Order Ref</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-normal">
                {filteredTickets.map(ticket => {
                  const isTicketOpen = ticket.status === 'open';
                  const isTicketPending = ticket.status === 'pending';
                  const isTicketResolved = ticket.status === 'resolved';

                  return (
                    <tr 
                      key={ticket.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isTicketOpen ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* ID & Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-white">#{ticket.id}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(ticket.createdAt).toLocaleDateString()} {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
                            {(ticket.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{ticket.username || 'User'}</div>
                            {ticket.email && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{ticket.email}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subject & Category */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-medium text-white truncate" title={ticket.subject}>
                          {ticket.subject}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize font-medium">
                            {ticket.category}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {ticket.messageCount || 1} msg
                          </span>
                        </div>
                      </td>

                      {/* Order Reference */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {ticket.orderId ? (
                          <div className="flex items-center gap-1 font-mono text-indigo-400 bg-indigo-950/50 border border-indigo-500/30 px-2 py-1 rounded-md text-[11px] w-fit">
                            <ShoppingBag className="w-3 h-3 text-indigo-400" />
                            <span>#{ticket.orderId}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                          ticket.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : ticket.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : ticket.priority === 'low'
                            ? 'bg-slate-700/50 text-slate-400'
                            : 'bg-indigo-500/10 text-indigo-300'
                        }`}>
                          {ticket.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          className={`text-xs font-semibold rounded-lg px-2 py-1 border cursor-pointer ${
                            isTicketOpen
                              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                              : isTicketPending
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : isTicketResolved
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <option value="open">Open</option>
                          <option value="pending">Pending</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            isTicketOpen
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                              : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{isTicketOpen ? 'Reply Now' : 'View Thread'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conversation Thread & Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-white text-sm bg-slate-800 px-2.5 py-0.5 rounded-md">
                    Ticket #{selectedTicket.id}
                  </span>
                  <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                    selectedTicket.status === 'open'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : selectedTicket.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : selectedTicket.status === 'resolved'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {selectedTicket.status}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 capitalize font-medium">
                    {selectedTicket.category}
                  </span>
                  {selectedTicket.orderId && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      Order: #{selectedTicket.orderId}
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-bold text-white">{selectedTicket.subject}</h2>
                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>Customer: <strong className="text-slate-200">{selectedTicket.username || 'Client'}</strong></span>
                  {selectedTicket.email && (
                    <span>Email: <strong className="text-slate-300">{selectedTicket.email}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Status Switcher in Modal Header */}
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold cursor-pointer focus:border-indigo-500"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Close conversation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Messages Thread */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-950/40">
              {isMessagesLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading conversation history...</p>
                </div>
              ) : ticketMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No messages recorded in this ticket yet.
                </div>
              ) : (
                ticketMessages.map(msg => {
                  const isAdmin = msg.senderRole === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] sm:max-w-xl ${
                        isAdmin ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        {isAdmin ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-indigo-300">SociaraX Support (Admin)</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-semibold text-slate-300">
                              {selectedTicket.username || 'Client'}
                            </span>
                          </>
                        )}
                        <span className="text-[10px] text-slate-500 ml-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className={`p-4 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap ${
                        isAdmin
                          ? 'bg-indigo-950/70 border border-indigo-500/30 text-indigo-100 rounded-tr-xs'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Macro Presets */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Quick Macros:
              </span>
              {quickMacros.map((macro, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReplyText(macro)}
                  className="text-[11px] px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer transition-colors shrink-0"
                >
                  {macro.length > 36 ? `${macro.substring(0, 36)}...` : macro}
                </button>
              ))}
            </div>

            {/* Reply Composer Form */}
            <form onSubmit={handleSendReply} className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 space-y-3">
              <textarea
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response to the customer here..."
                className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoResolveOnReply}
                    onChange={(e) => setAutoResolveOnReply(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Mark ticket as <strong className="text-emerald-400">Resolved</strong> after sending reply</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedTicket.id, 'resolved')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Resolve Ticket
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingReply || !replyText.trim()}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingReply ? 'Sending...' : 'Send Reply'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
