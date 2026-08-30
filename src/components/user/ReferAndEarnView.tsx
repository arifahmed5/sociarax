import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { ReferralStats } from '../../types';
import { 
  Gift, 
  Copy, 
  Check, 
  Users, 
  TrendingUp, 
  Coins, 
  Sparkles, 
  Share2, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Send
} from 'lucide-react';

interface ReferAndEarnViewProps {
  onNavigate: (tab: string) => void;
  onOpenAuthModal: () => void;
}

export const ReferAndEarnView: React.FC<ReferAndEarnViewProps> = ({ onNavigate, onOpenAuthModal }) => {
  const { user, userToken, adminToken } = useAuth();
  const { formatCurrency, settings } = useSociarax();
  const token = userToken || adminToken;

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState('');

  const fetchReferralStats = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/referrals/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to load referral statistics');
      }
    } catch (err: any) {
      setError('Network error while loading referral dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralStats();
  }, [token]);

  const handleCopyCode = () => {
    if (!stats?.referralCode) return;
    navigator.clipboard.writeText(stats.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!stats?.referralLink) return;
    navigator.clipboard.writeText(stats.referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!stats?.referralLink) return;
    const text = encodeURIComponent(`Boost your social media presence with SociaraX! Sign up using my referral link and get premium SMM services: ${stats.referralLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareTelegram = () => {
    if (!stats?.referralLink) return;
    const text = encodeURIComponent(`Join SociaraX for high-speed Instagram, YouTube & Telegram growth! Referral link: ${stats.referralLink}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${text}`, '_blank');
  };

  const isProgramDisabled = settings.referral_enabled === 'false' || (stats && stats.referralEnabled === false);

  if (isProgramDisabled) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Referral Program Paused</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            The SociaraX Referral & Rewards program is temporarily paused by the administration. Check back soon for exciting affiliate promotions!
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400">
            <Gift className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Refer & Earn Program</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Invite your friends to SociaraX and earn instant cash rewards deposited directly into your wallet for every successful deposit!
          </p>
          <button
            onClick={onOpenAuthModal}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Sign In to View Your Referral Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SociaraX Partner Rewards</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Refer Friends & Earn {stats?.referralBonusAmount ? `₹${stats.referralBonusAmount}` : '₹25'} Per Deposit
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Share your personal invite link. Whenever a referred friend completes their first qualifying deposit of {stats?.referralMinDeposit ? `₹${stats.referralMinDeposit}` : '₹100'} or more, your wallet is automatically credited!
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shrink-0 min-w-[200px] text-center">
            <div className="text-xs text-slate-400 font-medium">Your Total Bonus Earned</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono mt-1">
              {formatCurrency(stats?.totalEarned || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats?.activeReferrals || 0} Successful Rewards
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Referred Friends</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats?.totalReferrals || 0}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Reward Per Referral</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              ₹{stats?.referralBonusAmount || 25}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Min Qualifying Deposit</div>
            <div className="text-xl font-bold text-purple-300 mt-0.5">
              ₹{stats?.referralMinDeposit || 100}
            </div>
          </div>
        </div>
      </div>

      {/* Share Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Referral Code & Link Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>Your Personal Referral Code & Link</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Referral Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={stats?.referralCode || '...'}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-indigo-300 select-all"
                />
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Direct Invite Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={stats?.referralLink || '...'}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 truncate select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Social Share Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 min-w-[120px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={handleShareTelegram}
                className="flex-1 min-w-[120px] px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Telegram</span>
              </button>
            </div>
          </div>
        </div>

        {/* How It Works & Terms */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>How Referral Rewards Work</span>
          </h3>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                1
              </div>
              <p>Share your invite link or referral code with your friends, clients, or communities.</p>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                2
              </div>
              <p>Your friend registers an account on SociaraX using your code.</p>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                3
              </div>
              <p>Once they make their first verified deposit (₹{stats?.referralMinDeposit || 100}+), ₹{stats?.referralBonusAmount || 25} is credited instantly to your SociaraX wallet!</p>
            </div>
          </div>

          <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 leading-relaxed">
            {stats?.referralTerms || 'Referral rewards are non-reversible and can be immediately used to purchase any SMM service on the platform.'}
          </div>
        </div>
      </div>

      {/* Rewards History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Referral Rewards Ledger</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {stats?.rewards?.length || 0} rewards credited
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
            Loading reward history...
          </div>
        ) : !stats?.rewards || stats.rewards.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800/80">
            No referral rewards earned yet. Share your invite link above to start earning!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-xl">Referred User</th>
                  <th className="p-3">Bonus Credited</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 rounded-r-xl">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.rewards.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      @{r.referredUsername}
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
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
