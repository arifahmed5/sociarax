import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SupportTicket, TicketMessage } from '../../types';
import { 
  LifeBuoy, 
  Plus, 
  Send, 
  MessageSquare, 
  MessageCircle,
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export const SupportView: React.FC = () => {
  const { userToken } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('order');
  const [orderId, setOrderId] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    }
  };

  const loadTicketMessages = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load ticket messages', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [userToken]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!subject || !initialMessage) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          subject,
          category,
          orderId: orderId ? parseInt(orderId, 10) : undefined,
          message: initialMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsCreating(false);
        setSubject('');
        setOrderId('');
        setInitialMessage('');
        await fetchTickets();
      } else {
        setErrorMessage(data.error || 'Failed to create ticket');
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          message: replyMessage.trim(),
          senderRole: 'user'
        })
      });
      const data = await res.json();
      if (data.success) {
        setReplyMessage('');
        await loadTicketMessages(selectedTicket);
      }
    } catch (err) {
      console.error('Failed to reply', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-indigo-400" />
            <span>Support Desk</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            24/7 dedicated assistance for order speedup, refills, and payments.
          </p>
        </div>

        {!selectedTicket && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Ticket</span>
          </button>
        )}
      </div>

      {/* Direct WhatsApp & Telegram Quick Help Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="https://t.me/arifahmed5_6"
          target="_blank"
          rel="noreferrer"
          className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-4.5 flex items-center justify-between transition-all group shadow-lg"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Direct Telegram Support</div>
              <div className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">@arifahmed5_6</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-sky-400 font-semibold bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
            <span>Chat Live</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </a>

        <a
          href="https://wa.me/916001768808?text=Hello%20SociaraX%20Support%20@arifahmed56"
          target="_blank"
          rel="noreferrer"
          className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4.5 flex items-center justify-between transition-all group shadow-lg"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">Direct WhatsApp Support</div>
              <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">@arifahmed56</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <span>WhatsApp</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </a>
      </div>

      {isCreating ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Create Support Ticket</h2>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Order #1234 refill request or speed inquiry"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-indigo-500"
                >
                  <option value="order">Order Issues</option>
                  <option value="payment">Payment / Deposit</option>
                  <option value="refill">Refill Guarantee</option>
                  <option value="api">API Integration</option>
                  <option value="other">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Order ID (Optional)</label>
                <input
                  type="number"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. 102"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Message</label>
              <textarea
                required
                rows={4}
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Describe your issue with order link, start count, or payment details..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              {isLoading ? 'Submitting...' : 'Submit Support Ticket'}
            </button>
          </form>
        </div>
      ) : selectedTicket ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <button
              onClick={() => setSelectedTicket(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Tickets</span>
            </button>
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              {selectedTicket.status}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
              <span>Category: <strong className="text-slate-200 capitalize">{selectedTicket.category}</strong></span>
              {selectedTicket.orderId && <span>Order: <strong className="text-slate-200 font-mono">#{selectedTicket.orderId}</strong></span>}
              <span>Created: {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {messages.map(msg => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl max-w-lg ${
                    isAdmin
                      ? 'bg-indigo-950/60 border border-indigo-500/30 ml-auto text-indigo-100'
                      : 'bg-slate-950 border border-slate-800 mr-auto text-slate-200'
                  }`}
                >
                  <div className="text-[11px] font-semibold mb-1 flex items-center justify-between gap-4">
                    <span className={isAdmin ? 'text-indigo-400' : 'text-slate-400'}>
                      {isAdmin ? '🛡️ SociaraX Support Agent' : '👤 You'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              );
            })}
          </div>

          {/* Reply Box */}
          <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-slate-800">
            <input
              type="text"
              required
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading || !replyMessage.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Reply</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-300">No support tickets</p>
              <p className="text-xs text-slate-500 mt-1">Have any questions about an order or payment? Open a ticket!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Ticket ID</th>
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Updated</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tickets.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400">#{t.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">{t.subject}</td>
                      <td className="py-3.5 px-4 capitalize text-slate-400">{t.category}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                          t.status === 'resolved' || t.status === 'closed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => loadTicketMessages(t)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          View Thread ({t.messageCount})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
