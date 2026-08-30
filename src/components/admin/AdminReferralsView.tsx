import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { 
  Gift, 
  Users, 
  Coins, 
  TrendingUp, 
  Settings, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck,
  Search,
  ExternalLink
} from 'lucide-react';

interface ReferralAdminSettings {
  referral_enabled: string;
  referral_bonus_amount: string;
  referral_min_deposit: string;
  referral_required_count: string;
  referral_terms: string;
}

interface ReferralRewardItem {
  id: number;
  referrerId: number;
  referrerUsername: string;
  referrerEmail: string;
  referredUserId: number;
  referredUsername: string;
  referredEmail: string;
  bonusAmount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export const AdminReferralsView: React.FC = () => {
  const { adminToken, userToken } = useAuth();
  const { formatCurrency, loadSettings } = useSociarax();
  const token = adminToken || userToken;

  const [settings, setSettings] = useState<ReferralAdminSettings>({
    referral_enabled: 'true',
    referral_bonus_amount: '25.0',
    referral_min_deposit: '100.0',
    referral_required_count: '1',
    referral_terms: 'Refer friends to SociaraX. When they make their first verified deposit of ₹100 or more, you both receive an instant wallet reward!'
  });

  const [metrics, setMetrics] = useState({
    totalRewardsCount: 0,
    totalBonusDisbursed: 0,
    activeReferrersCount: 0,
    totalReferredSignups: 0
  });

  const [rewards, setRewards] = useState<ReferralRewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [search, setSearch] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/referrals/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (data.settings) setSettings(data.settings);
        if (data.metrics) setMetrics(data.metrics);
        if (data.rewards) setRewards(data.rewards);
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to load referral program data' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to fetch referral overview' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/referrals/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        await loadSettings();
        setNotification({ type: 'success', message: 'Referral program settings updated successfully!' });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Network error saving referral settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRewards = rewards.filter(r => 
    r.referrerUsername.toLowerCase().includes(search.toLowerCase()) ||
    r.referredUsername.toLowerCase().includes(search.toLowerCase()) ||
    r.referrerEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Gift className="w-3.5 h-3.5" />
              <span>Affiliate & Referral Control</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Referral Program Management
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Configure reward rules, minimum qualifying deposit thresholds, and audit bonus distributions in real-time.
            </p>
          </div>

          <button
            onClick={fetchOverview}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
            title="Refresh Overview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-400">Total Referred Signups</div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {metrics.totalReferredSignups}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-400">Active Referrers</div>
          <div className="text-2xl font-extrabold text-indigo-400 mt-1">
            {metrics.activeReferrersCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-400">Rewards Disbursed</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {metrics.totalRewardsCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-400">Total Bonus Paid Out</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
            {formatCurrency(metrics.totalBonusDisbursed)}
          </div>
        </div>
      </div>

      {/* Referral Rules Settings Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Referral Program Configuration</span>
          </h3>
          <span className="text-xs text-slate-400">Controls automatic wallet bonuses upon verified user deposits</span>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Program Status
              </label>
              <select
                value={settings.referral_enabled}
                onChange={(e) => setSettings({ ...settings, referral_enabled: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="true">Enabled (Active)</option>
                <option value="false">Disabled (Paused)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Bonus Amount Per Referral (₹)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={settings.referral_bonus_amount}
                onChange={(e) => setSettings({ ...settings, referral_bonus_amount: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Min First Deposit Required (₹)
              </label>
              <input
                type="number"
                step="1"
                min="10"
                value={settings.referral_min_deposit}
                onChange={(e) => setSettings({ ...settings, referral_min_deposit: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Referral Terms / Explanation for Users
            </label>
            <textarea
              rows={2}
              value={settings.referral_terms}
              onChange={(e) => setSettings({ ...settings, referral_terms: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Referral Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rewards Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Recent Referral Bonuses Disbursed</span>
          </h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search user or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
            Loading referral records...
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
            No referral rewards found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-xl">ID</th>
                  <th className="p-3">Referrer (Earned Bonus)</th>
                  <th className="p-3">Referred Sign-up</th>
                  <th className="p-3">Bonus Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 rounded-r-xl">Credited Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRewards.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono text-slate-400">#{r.id}</td>
                    <td className="p-3">
                      <div className="font-bold text-white">@{r.referrerUsername}</div>
                      <div className="text-[11px] text-slate-500">{r.referrerEmail}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-indigo-300">@{r.referredUsername}</div>
                      <div className="text-[11px] text-slate-500">{r.referredEmail}</div>
                    </td>
                    <td className="p-3 font-bold text-emerald-400 font-mono">
                      +₹{r.bonusAmount.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
