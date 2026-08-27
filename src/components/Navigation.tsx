import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSociarax } from '../context/SociaraxContext';
import { 
  Zap, 
  ShoppingBag, 
  Sparkles, 
  Wallet, 
  LifeBuoy, 
  ShieldCheck, 
  Server, 
  CreditCard, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  User, 
  Menu, 
  X,
  ChevronRight,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenUserAuth: () => void;
  onOpenAdminAuth: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  onOpenUserAuth,
  onOpenAdminAuth
}) => {
  const { user, admin, logoutUser, logoutAdmin } = useAuth();
  const { formatCurrency, adminPendingPayments, settings } = useSociarax();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdminTab = currentTab.startsWith('admin_');

  const customerNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new_order', label: 'New Order', icon: Zap },
    { id: 'services', label: 'Services', icon: Sparkles },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'wallet', label: 'Add Funds', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'support', label: 'Support', icon: LifeBuoy },
  ];

  const adminNavItems: NavItem[] = [
    { id: 'admin_dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'admin_orders', label: 'Orders', icon: ShoppingBag },
    { 
      id: 'admin_payments', 
      label: 'Payments', 
      icon: CreditCard, 
      badge: adminPendingPayments.length > 0 ? adminPendingPayments.length : undefined 
    },
    { id: 'admin_services', label: 'Pricing & Catalog', icon: Sparkles },
    { id: 'admin_providers', label: 'API Providers', icon: Server },
    { id: 'admin_users', label: 'Users', icon: Users },
    { id: 'admin_reports', label: 'Reports', icon: BarChart3 },
    { id: 'admin_settings', label: 'Settings', icon: Settings },
  ];

  // Admin panel is visible when admin is active, or if user is owner / admin role
  const isOwnerOrAdmin = Boolean(
    admin || 
    user?.role === 'admin' || 
    user?.email?.toLowerCase() === 'arifahmed87204@gmail.com' || 
    user?.username?.toLowerCase() === 'arifahmed56'
  );

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-4">
            <div 
              onClick={() => onTabChange(isAdminTab && admin ? 'admin_dashboard' : 'dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-white tracking-tight">
                    {settings.site_name || 'SociaraX'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    SMM
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Enterprise Social Growth</div>
              </div>
            </div>

            {/* Portal Switcher Pill - Only shown if authorized admin or owner */}
            {isOwnerOrAdmin && (
              <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl ml-2 animate-fadeIn">
                <button
                  onClick={() => onTabChange('dashboard')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    !isAdminTab 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Customer Portal
                </button>
                <button
                  onClick={() => {
                    if (admin) {
                      onTabChange('admin_dashboard');
                    } else {
                      onOpenAdminAuth();
                    }
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isAdminTab
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>Admin Panel</span>
                  {adminPendingPayments.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Center: Desktop Navigation Bar */}
          <nav className="hidden lg:flex items-center gap-1">
            {isAdminTab && admin ? (
              adminNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`relative px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              customerNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })
            )}
          </nav>

          {/* Right: User / Admin Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdminTab && admin ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-slate-300 font-mono font-medium">{admin.email || 'arifahmed87204@gmail.com'}</span>
                </div>
                <button
                  onClick={() => {
                    logoutAdmin();
                    onTabChange('dashboard');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="Log out Admin Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out Admin</span>
                  <span className="sm:hidden">Logout</span>
                </button>
              </div>
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Wallet Balance Pill */}
                <button
                  onClick={() => onTabChange('wallet')}
                  className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  title="View Wallet Balance"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-xs sm:text-sm text-emerald-400 font-mono">
                    {formatCurrency(user.walletBalance)}
                  </span>
                </button>

                {/* Profile Pill */}
                <button
                  onClick={() => onTabChange('profile')}
                  className={`hidden md:flex items-center gap-1.5 border px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'profile'
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                  }`}
                  title="Manage Profile & Password Settings"
                >
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{user.username}</span>
                </button>

                {/* Prominent User Logout Button */}
                <button
                  onClick={logoutUser}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="Sign out of account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenUserAuth}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-4 py-4 space-y-3">
          {/* User / Admin Status Card on Mobile */}
          {user && !isAdminTab && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {user.username}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono font-semibold">
                    Balance: {formatCurrency(user.walletBalance)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  logoutUser();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {admin && isAdminTab && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-300">Admin Authenticated</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">{admin.email}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  logoutAdmin();
                  onTabChange('dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out Admin</span>
              </button>
            </div>
          )}

          {/* Mobile Portal Switcher - Only shown if authorized admin or owner */}
          {isOwnerOrAdmin && (
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => { onTabChange('dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg ${
                  !isAdminTab ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                Customer Portal
              </button>
              <button
                onClick={() => {
                  if (admin) {
                    onTabChange('admin_dashboard');
                  } else {
                    onOpenAdminAuth();
                  }
                  setIsMobileMenuOpen(false);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 ${
                  isAdminTab ? 'bg-rose-600 text-white' : 'text-slate-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin (2FA)</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(isAdminTab && admin ? adminNavItems : customerNavItems).map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onTabChange(item.id); setIsMobileMenuOpen(false); }}
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isActive
                      ? isAdminTab 
                        ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold'
                        : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Bottom Logout Button */}
          {user && (
            <div className="pt-2 border-t border-slate-900">
              <button
                onClick={() => {
                  logoutUser();
                  if (admin) logoutAdmin();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-rose-500/10 text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out / Log Out of SociaraX</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
