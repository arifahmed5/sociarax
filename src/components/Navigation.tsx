import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSociarax } from '../context/SociaraxContext';
import { getTheme, getButtonRadius } from '../utils/theme';
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
  LayoutDashboard,
  Activity,
  Bot,
  Send,
  MessageCircle,
  Gift
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
  const { formatCurrency, adminPendingPayments, settings, maintenanceConfig } = useSociarax();

  const theme = getTheme(maintenanceConfig);
  const buttonRadius = getButtonRadius(maintenanceConfig);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdminTab = currentTab.startsWith('admin_');

  const isReferralEnabled = settings.referral_enabled !== 'false' && settings.referral_enabled !== '0';

  const customerNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new_order', label: 'New Order', icon: Zap },
    { id: 'services', label: 'Services', icon: Sparkles },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'wallet', label: 'Add Funds', icon: Wallet },
    ...(isReferralEnabled ? [{ id: 'referrals', label: 'Refer & Earn', icon: Gift }] : []),
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
    { id: 'admin_monitoring', label: '24/7 Health & Monitor', icon: Activity },
    { id: 'admin_referrals', label: 'Referral Program', icon: Gift },
    { id: 'admin_maintenance', label: 'AI Website Control', icon: Bot },
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
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2">
          {/* Left: Brand Logo & Portal Switcher */}
          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            <div 
              onClick={() => onTabChange(isAdminTab && admin ? 'admin_dashboard' : 'dashboard')}
              className="flex items-center gap-2 cursor-pointer group shrink-0"
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr ${theme.brandGradient} flex items-center justify-center shadow-md ${theme.brandGlow} group-hover:scale-105 transition-transform`}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                {maintenanceConfig.siteTitle || settings.site_name || 'SociaraX'}
              </span>
            </div>

            {/* Portal Switcher Pill - Only shown if authorized admin or owner */}
            {isOwnerOrAdmin && (
              <div className="hidden lg:flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl shrink-0 animate-fadeIn">
                <button
                  onClick={() => onTabChange('dashboard')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isAdminTab 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Customer
                </button>
                <button
                  onClick={() => {
                    if (admin) {
                      onTabChange('admin_dashboard');
                    } else {
                      onOpenAdminAuth();
                    }
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    isAdminTab
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>Admin</span>
                  {adminPendingPayments.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Center: Desktop Navigation Bar for Customer Portal */}
          {!isAdminTab && (
            <nav className="hidden lg:flex items-center justify-start xl:justify-center gap-1 xl:gap-1.5 flex-1 min-w-0 px-2 overflow-x-auto no-scrollbar">
              {customerNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`relative px-2 xl:px-2.5 2xl:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? `${theme.activeTabBg} ${theme.activeTabText} border ${theme.activeTabBorder} font-bold shadow-xs`
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right: User / Admin Actions & Header Elements */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Top Header Support Buttons OR Simple SociaraX Label */}
            {!isAdminTab && (
              <>
                {maintenanceConfig.showHeaderSimpleLabelOnly ? (
                  <div 
                    id="header-simple-label"
                    className="hidden 2xl:flex items-center px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-semibold text-slate-200 shadow-xs shrink-0"
                    title="SociaraX Brand"
                  >
                    <span className="text-indigo-400 font-bold mr-1.5">✦</span>
                    <span className="tracking-wide font-medium">{maintenanceConfig.headerSimpleLabel || 'SociaraX'}</span>
                  </div>
                ) : maintenanceConfig.showSupportInHeader ? (
                  <div 
                    id="header-contact-buttons"
                    className="hidden 2xl:flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shrink-0"
                  >
                    <a
                      href={`https://t.me/${(maintenanceConfig.telegramSupport || 'SociaraXSupport').replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-semibold transition-all"
                      title="Direct Telegram Support"
                    >
                      <Send className="w-3 h-3" />
                      <span>Telegram</span>
                    </a>
                    <a
                      href={`https://wa.me/${(maintenanceConfig.whatsappSupport || '919876543210').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-all"
                      title="Direct WhatsApp Support"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                ) : null}
              </>
            )}

            {isAdminTab && admin ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 bg-rose-950/40 border border-rose-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-slate-300 font-mono font-medium truncate max-w-[180px]">{admin.email || 'arifahmed87204@gmail.com'}</span>
                </div>
                <button
                  onClick={() => {
                    logoutAdmin();
                    onTabChange('dashboard');
                  }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
                  title="Log out Admin Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out Admin</span>
                  <span className="sm:hidden">Logout</span>
                </button>
              </div>
            ) : user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Wallet Balance Pill */}
                <button
                  onClick={() => onTabChange('wallet')}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                  title="View Wallet Balance"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-emerald-400 font-mono">
                    {formatCurrency(user.walletBalance)}
                  </span>
                </button>

                {/* Profile Pill */}
                <button
                  onClick={() => onTabChange('profile')}
                  className={`hidden xl:flex items-center gap-1.5 border px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'profile'
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                  }`}
                  title="Manage Profile & Password Settings"
                >
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate max-w-[100px]">{user.username}</span>
                </button>

                {/* Prominent User Logout Button */}
                <button
                  onClick={logoutUser}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0"
                  title="Sign out of account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onOpenUserAuth}
                  className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  Sign In / Register
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Dedicated Desktop Sub-Navbar (Ensures all 11 Admin tabs are 100% visible & unclipped) */}
      {isAdminTab && admin && (
        <div className="hidden lg:block border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-1 xl:gap-1.5 py-1.5 overflow-x-auto no-scrollbar">
            {adminNavItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative px-2.5 xl:px-3 py-1.5 rounded-xl text-[11px] xl:text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
