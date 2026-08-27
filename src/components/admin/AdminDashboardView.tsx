import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Zap,
  LogOut,
  RefreshCw,
  Wallet
} from 'lucide-react';

interface AdminDashboardViewProps {
  onNavigateAdmin: (tab: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigateAdmin }) => {
  const { logoutAdmin, adminToken } = useAuth();
  const { adminMetrics, formatCurrency, adminPendingPayments, syncAdminOrderStatus, adminProviders, loadAdminProviders } = useSociarax();

  const [liveBalanceData, setLiveBalanceData] = useState<{
    totalInr: number;
    totalUsd: number;
    exchangeRate: number;
    rawPrimaryBalance: number;
    rawPrimaryCurrency: string;
    providers: any[];
  } | null>(null);
  const [isFetchingLiveBalance, setIsFetchingLiveBalance] = useState(false);

  const fetchLiveBalance = async () => {
    setIsFetchingLiveBalance(true);
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const res = await fetch('/api/admin/providers/live-balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLiveBalanceData({
          totalInr: Number(data.totalLiveBalanceInr ?? data.totalInrBalance ?? 0),
          totalUsd: Number(data.totalLiveBalanceUsd ?? data.primaryProvider?.rawBalance ?? 0),
          exchangeRate: Number(data.usdToInrRate ?? 88),
          rawPrimaryBalance: Number(data.rawPrimaryBalance ?? data.primaryProvider?.rawBalance ?? 0),
          rawPrimaryCurrency: String(data.rawPrimaryCurrency ?? data.primaryProvider?.currency ?? 'USD').toUpperCase(),
          providers: data.providers || []
        });
        loadAdminProviders();
      }
    } catch (err) {
      console.error('Failed to fetch provider live balance:', err);
    } finally {
      setIsFetchingLiveBalance(false);
    }
  };

  useEffect(() => {
    fetchLiveBalance();
  }, []);

  const metrics = adminMetrics || {
    totalRevenue: 0,
    totalProviderCost: 0,
    totalProfit: 0,
    profitMarginPct: '0.0',
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    refundedOrders: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalUserWalletBalance: 0,
    totalDeposits: 0,
    pendingDepositsCount: 0,
    pendingDepositsAmount: 0,
    approvedDepositsCount: 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2FA Authenticated Administrator</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            SociaraX Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time financial performance, automated provider order dispatch, and payment approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => syncAdminOrderStatus()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Sync Upstream Orders</span>
          </button>
          
          <button
            onClick={() => {
              logoutAdmin();
              onNavigateAdmin('dashboard');
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exit and Log Out Admin Session"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out Admin</span>
          </button>
        </div>
      </div>

      {/* Pending Action Alerts */}
      {adminPendingPayments.length > 0 && (
        <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {adminPendingPayments.length} Deposit Payment{adminPendingPayments.length > 1 ? 's' : ''} Awaiting Approval
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Totaling {formatCurrency(adminPendingPayments.reduce((acc, curr) => acc + curr.amount, 0))} via manual UPI / UTR.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateAdmin('admin_payments')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer shrink-0"
          >
            Review & Approve
          </button>
        </div>
      )}

      {/* Live Provider LuvSMM Balance Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                LuvSMM Provider Live API Balance
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Upstream Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time wallet balance fetched directly from your LuvSMM provider account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end bg-slate-950/60 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-800">
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-400 font-medium">
              Exact Upstream Balance:
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight flex items-baseline gap-1.5">
              <span>
                {liveBalanceData 
                  ? (liveBalanceData.rawPrimaryCurrency === 'INR' 
                      ? `₹${(Number(liveBalanceData.rawPrimaryBalance) || 0).toFixed(2)}` 
                      : `$${(Number(liveBalanceData.rawPrimaryBalance) || 0).toFixed(2)}`)
                  : (adminProviders.length > 0 
                      ? `$${(Number(adminProviders[0]?.balance) || 0).toFixed(2)}` 
                      : '$0.00')}
              </span>
              <span className="text-xs font-bold text-emerald-300">
                {liveBalanceData?.rawPrimaryCurrency || 'USD'}
              </span>
            </div>
            <div className="text-[11px] text-indigo-300 font-mono font-medium mt-0.5">
              ≈ {liveBalanceData ? formatCurrency(liveBalanceData.totalInr || 0) : '₹0.00'} INR (Rate: ₹{liveBalanceData?.exchangeRate || 88}/$)
            </div>
          </div>

          <button
            onClick={fetchLiveBalance}
            disabled={isFetchingLiveBalance}
            className="p-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 transition-all cursor-pointer disabled:opacity-50 shadow-md shrink-0"
            title="Refresh Live LuvSMM Balance"
          >
            <RefreshCw className={`w-5 h-5 ${isFetchingLiveBalance ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Customer Revenue</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">From {metrics.totalOrders} customer orders</div>
        </div>

        {/* Total Provider Cost */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Provider API Cost</span>
            <Server className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono">
            {formatCurrency(metrics.totalProviderCost)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Luvsmm & API charges</div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Net Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {formatCurrency(metrics.totalProfit)}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-1">
            Margin: <strong className="font-bold font-mono">{metrics.profitMarginPct}%</strong>
          </div>
        </div>

        {/* Total Approved Deposits */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total User Deposits</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {formatCurrency(metrics.totalDeposits)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">User balances: {formatCurrency(metrics.totalUserWalletBalance)}</div>
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigateAdmin('admin_orders')}
          className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="text-xs text-slate-400 mb-1">Total Orders</div>
          <div className="text-xl font-bold text-white font-mono">{metrics.totalOrders}</div>
        </div>
        <div 
          onClick={() => onNavigateAdmin('admin_orders')}
          className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="text-xs text-slate-400 mb-1">Pending Orders</div>
          <div className="text-xl font-bold text-amber-400 font-mono">{metrics.pendingOrders + metrics.processingOrders}</div>
        </div>
        <div 
          onClick={() => onNavigateAdmin('admin_orders')}
          className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="text-xs text-slate-400 mb-1">Completed Orders</div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{metrics.completedOrders}</div>
        </div>
        <div 
          onClick={() => onNavigateAdmin('admin_users')}
          className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer"
        >
          <div className="text-xs text-slate-400 mb-1">Registered Users</div>
          <div className="text-xl font-bold text-indigo-400 font-mono">{metrics.totalUsers}</div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          onClick={() => onNavigateAdmin('admin_orders')}
          className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 p-6 rounded-3xl transition-all cursor-pointer group shadow-xl"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
            Order Management & Dispatch
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track upstream provider status, manual refunds, and client charge vs provider cost.
          </p>
          <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold mt-4">
            <span>Manage Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateAdmin('admin_payments')}
          className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 p-6 rounded-3xl transition-all cursor-pointer group shadow-xl"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
            Payment & UTR Approvals
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Review manual UPI/Bank deposits, verify 12-digit UTR references, and credit balances atomically.
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-4">
            <span>Review Payments ({adminPendingPayments.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateAdmin('admin_providers')}
          className="bg-gradient-to-br from-slate-900 to-purple-950/40 border border-slate-800 hover:border-purple-500/40 p-6 rounded-3xl transition-all cursor-pointer group shadow-xl"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
            <Server className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
            API Providers & Sync
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Configure Luvsmm credentials, test live connection balance, and sync prices with auto-markup.
          </p>
          <div className="flex items-center gap-1 text-xs text-purple-400 font-semibold mt-4">
            <span>Provider Configuration</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};
