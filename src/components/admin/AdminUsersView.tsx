import React, { useState, useMemo } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { ManagedUser } from '../../types';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Wallet, 
  ShieldAlert, 
  ShieldCheck, 
  DollarSign, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export const AdminUsersView: React.FC = () => {
  const { 
    adminUsers, 
    formatCurrency, 
    loadAdminUsers, 
    updateUserStatus, 
    adjustUserWallet 
  } = useSociarax();

  const [searchQuery, setSearchQuery] = useState('');
  
  // Wallet Adjustment Modal State
  const [adjustingUser, setAdjustingUser] = useState<ManagedUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState('Manual bonus credit');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustNotice, setAdjustNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    loadAdminUsers();
  }, [loadAdminUsers]);

  const handleStatusToggle = async (user: ManagedUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await updateUserStatus(user.id, newStatus);
  };

  const handleWalletAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser || !adjustAmount) return;

    setIsAdjusting(true);
    setAdjustNotice(null);

    const res = await adjustUserWallet(adjustingUser.id, Number(adjustAmount), adjustReason);
    setIsAdjusting(false);

    if (res.success) {
      setAdjustNotice({ type: 'success', message: res.message || 'User wallet updated successfully!' });
      setAdjustingUser(null);
      setAdjustAmount('');
      setTimeout(() => setAdjustNotice(null), 4000);
    } else {
      setAdjustNotice({ type: 'error', message: res.error || 'Failed to adjust wallet' });
    }
  };

  const filteredUsers = useMemo(() => {
    return adminUsers.filter(u => {
      const matchSearch = !searchQuery.trim() ||
        String(u.id).includes(searchQuery) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSearch;
    });
  }, [adminUsers, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Registered Users & Wallets</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Total {adminUsers.length} clients. Manage user statuses, order totals, and manual wallet adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAdminUsers()}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {adjustNotice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          adjustNotice.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
        }`}>
          {adjustNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{adjustNotice.message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full md:w-80">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ID, username or email..."
          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">User ID</th>
                <th className="py-3.5 px-4">Username & Email</th>
                <th className="py-3.5 px-4">Wallet Balance</th>
                <th className="py-3.5 px-4">Orders Placed</th>
                <th className="py-3.5 px-4">Total Spent</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                    #{user.id}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{user.username}</div>
                    <div className="text-[11px] text-slate-400">{user.email}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base">
                    {formatCurrency(user.walletBalance)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {user.totalOrders} orders
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-white">
                    {formatCurrency(user.totalSpent)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      user.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {user.status === 'active' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                      <span className="capitalize">{user.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => { setAdjustingUser(user); setAdjustAmount(''); }}
                        className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Adjust Balance
                      </button>
                      <button
                        onClick={() => handleStatusToggle(user)}
                        className={`p-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          user.status === 'active'
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                        title={user.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAdjustingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              Adjust Wallet: {adjustingUser.username}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Current balance: <strong className="text-emerald-400 font-mono">{formatCurrency(adjustingUser.walletBalance)}</strong>
            </p>

            <form onSubmit={handleWalletAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount to Credit / Debit (INR ₹)
                </label>
                <div className="relative">
                  <span className="text-slate-500 absolute left-3.5 top-2.5 font-bold">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="Use positive for credit (e.g. 500) or negative for debit (e.g. -200)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter positive (e.g. 100) to add money, negative (e.g. -50) to deduct.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Reason
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Manual bank deposit verification or promotional credit"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isAdjusting || adjustAmount === ''}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
              >
                {isAdjusting ? 'Processing Ledger Update...' : 'Commit Wallet Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
