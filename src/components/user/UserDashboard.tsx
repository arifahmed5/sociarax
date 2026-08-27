import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { StatusBadge, PlatformBadge } from '../Badges';
import { 
  Wallet, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  ArrowUpRight, 
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  Megaphone,
  LogOut,
  User
} from 'lucide-react';

interface UserDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenAuthModal: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ onNavigate, onOpenAuthModal }) => {
  const { user, logoutUser } = useAuth();
  const { userOrders, formatCurrency, settings, services } = useSociarax();

  // Metrics from real order data
  const totalOrders = userOrders.length;
  const pendingOrders = userOrders.filter(o => o.status === 'pending' || o.status === 'processing' || o.status === 'in_progress').length;
  const completedOrders = userOrders.filter(o => o.status === 'completed').length;
  const recentOrders = userOrders.slice(0, 5);

  const isOwnerOrAdmin = Boolean(
    user?.role === 'admin' || 
    user?.email?.toLowerCase() === 'arifahmed87204@gmail.com' || 
    user?.username?.toLowerCase() === 'arifahmed56'
  );

  return (
    <div className="space-y-6">
      {/* Super Admin Quick-Access Banner */}
      {isOwnerOrAdmin && (
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 border-2 border-rose-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-rose-950/30 animate-pulse-slow">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/40 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Super Administrator Mode
                </span>
                <span className="text-xs text-slate-400">Account: <strong className="text-white font-mono">{user?.username}</strong></span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                Full Management Access to SociaraX Backend
              </h2>
              <p className="text-xs text-slate-300">
                LuvSMM API Active • 2,680 Services • Provider Dispatch & Catalog Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('admin_dashboard')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Admin Panel</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Announcement Banner */}
      {settings.announcement && (
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-indigo-950/40">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Announcement</div>
            <div className="text-xs sm:text-sm text-slate-200 truncate">{settings.announcement}</div>
          </div>
        </div>
      )}

      {/* Hero Welcome / Balance Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SociaraX Enterprise SMM Infrastructure</span>
              </div>
              {user && (
                <button
                  onClick={logoutUser}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                  title="Sign out of account"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {user ? `Welcome back, ${user.username}!` : 'Power Your Social Media Growth'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              High-speed, high-retention social media marketing services with real-time server delivery and 100% transparent pricing.
            </p>
          </div>

          {/* Wallet Action Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 shadow-inner">
            <div>
              <div className="text-xs text-slate-400 font-medium">Available Balance</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {user ? formatCurrency(user.walletBalance) : '₹0.00'}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {user ? (
                <>
                  <button
                    onClick={() => onNavigate('wallet')}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Funds</span>
                  </button>
                  <button
                    onClick={() => onNavigate('new_order')}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>New Order</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Sign In / Register</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Wallet Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {user ? formatCurrency(user.walletBalance) : '₹0.00'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for orders</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {totalOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">All time orders</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active / Pending</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {pendingOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Currently processing</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono">
            {completedOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Fulfilled successfully</div>
        </div>
      </div>

      {/* Quick Order & Recent Orders Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Service Highlights */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Featured Services</span>
              </h3>
              <button
                onClick={() => onNavigate('services')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {services.slice(0, 4).map(srv => (
                <div 
                  key={srv.id}
                  onClick={() => onNavigate('new_order')}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <PlatformBadge platform={srv.platform} />
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {formatCurrency(srv.rate)} / 1k
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {srv.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Min: {srv.min.toLocaleString()}</span>
                    <span>{srv.averageTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('new_order')}
            className="w-full mt-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Launch Order Form</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent Orders Table */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              <span>Recent Orders</span>
            </h3>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View Order History ({userOrders.length})
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">No orders placed yet</p>
              <p className="text-xs text-slate-500 mt-1">Select a service and place your first order in seconds.</p>
              <button
                onClick={() => onNavigate('new_order')}
                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Place New Order
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Order ID</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold">Quantity</th>
                    <th className="pb-3 font-semibold">Charge</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentOrders.map(ord => (
                    <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-mono text-slate-300">#{ord.id}</td>
                      <td className="py-3 max-w-[200px]">
                        <div className="font-medium text-slate-200 truncate">{ord.serviceName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{ord.link}</div>
                      </td>
                      <td className="py-3 font-mono text-slate-300">{ord.quantity.toLocaleString()}</td>
                      <td className="py-3 font-mono font-bold text-emerald-400">{formatCurrency(ord.charge)}</td>
                      <td className="py-3">
                        <StatusBadge status={ord.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
