import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SociaraxProvider, useSociarax } from './context/SociaraxContext';
import { Navigation } from './components/Navigation';
import { DbStatusBanner } from './components/DbStatusBanner';
import { getTheme } from './utils/theme';

// User Views
import { UserDashboard } from './components/user/UserDashboard';
import { NewOrderView } from './components/user/NewOrderView';
import { ServicesView } from './components/user/ServicesView';
import { OrdersView } from './components/user/OrdersView';
import { WalletView } from './components/user/WalletView';
import { SupportView } from './components/user/SupportView';
import { ProfileView } from './components/user/ProfileView';
import { ReferAndEarnView } from './components/user/ReferAndEarnView';
import { AuthModal } from './components/user/AuthModal';

// Admin Views
import { AdminAuthModal } from './components/admin/AdminAuthModal';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { AdminOrdersView } from './components/admin/AdminOrdersView';
import { AdminPaymentsView } from './components/admin/AdminPaymentsView';
import { AdminServicesView } from './components/admin/AdminServicesView';
import { AdminProvidersView } from './components/admin/AdminProvidersView';
import { AdminUsersView } from './components/admin/AdminUsersView';
import { AdminReportsView } from './components/admin/AdminReportsView';
import { AdminSettingsView } from './components/admin/AdminSettingsView';
import { AdminMonitoringView } from './components/admin/AdminMonitoringView';
import { AdminReferralsView } from './components/admin/AdminReferralsView';
import { AdminMaintenanceView } from './components/admin/AdminMaintenanceView';
import { AuthGate } from './components/AuthGate';

import { ShieldCheck, Zap, Lock, Mail, Send, Heart } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, admin, isUserLoading, isAdminLoading, userToken, adminToken } = useAuth();
  const { settings, maintenanceConfig } = useSociarax();

  const theme = getTheme(maintenanceConfig);

  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '').trim();
      if (h) return h;
    }
    return 'dashboard';
  });

  const [isUserAuthOpen, setIsUserAuthOpen] = useState<boolean>(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState<boolean>(false);
  const [selectedServiceIdForOrder, setSelectedServiceIdForOrder] = useState<number | null>(null);

  // Synchronize browser history / hash navigation with tabs
  React.useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash.replace('#', '').trim();
      if (h) setCurrentTab(h);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectServiceForOrder = (serviceId: number) => {
    setSelectedServiceIdForOrder(serviceId);
    handleTabChange('new_order');
  };

  const isOwnerOrAdmin = Boolean(
    admin || 
    user?.role === 'admin' || 
    user?.email?.toLowerCase() === 'arifahmed87204@gmail.com' || 
    user?.username?.toLowerCase() === 'arifahmed56'
  );

  const handleTabChange = (tab: string) => {
    if (tab.startsWith('admin_') && !admin && !isOwnerOrAdmin) {
      setIsAdminAuthOpen(true);
      return;
    }
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  // If session is restoring from localStorage token, display a clean dark loader to eliminate 1-2s flicker
  const hasSavedToken = Boolean(
    userToken || 
    adminToken || 
    (typeof window !== 'undefined' && (localStorage.getItem('sociarax_user_token') || localStorage.getItem('sociarax_admin_token')))
  );

  if ((isUserLoading || isAdminLoading) && hasSavedToken && !user && !admin) {
    return (
      <div className="w-full min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-pulse">
          <Zap className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
        <div className="text-xs font-semibold tracking-wider text-slate-300">
          Loading SociaraX Session...
        </div>
      </div>
    );
  }

  // If user is neither logged in as customer nor as admin, show the full Registration/Login landing barrier
  if (!user && !admin) {
    return (
      <>
        <AuthGate onOpenAdminAuth={() => setIsAdminAuthOpen(true)} />
        <AdminAuthModal
          isOpen={isAdminAuthOpen}
          onClose={() => setIsAdminAuthOpen(false)}
        />
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${theme.selectionClass} relative overflow-x-hidden`}>
      {/* Dynamic Background Glow Orb if enabled */}
      {maintenanceConfig.enableGlowEffects && (
        <>
          <div className={`fixed top-0 right-1/4 w-96 h-96 ${theme.primaryGlow} rounded-full blur-3xl pointer-events-none -z-10`} />
          <div className={`fixed bottom-10 left-1/4 w-96 h-96 ${theme.primaryGlow} rounded-full blur-3xl pointer-events-none -z-10`} />
        </>
      )}

      {/* Emergency Maintenance Mode Banner */}
      {maintenanceConfig.maintenanceModeActive && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-white py-2.5 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{maintenanceConfig.maintenanceMessage || 'SociaraX is currently undergoing scheduled high-speed infrastructure maintenance.'}</span>
        </div>
      )}

      {/* DB Connection Health Banner */}
      <DbStatusBanner />

      {/* Primary Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onOpenUserAuth={() => setIsUserAuthOpen(true)}
        onOpenAdminAuth={() => setIsAdminAuthOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto ${maintenanceConfig.compactMobileLayout ? 'px-3 sm:px-6 py-4 sm:py-6' : 'px-4 sm:px-6 py-6 sm:py-8'}`}>
        {/* Customer Portal Views */}
        {currentTab === 'dashboard' && (
          <UserDashboard
            onNavigate={handleTabChange}
            onOpenAuthModal={() => setIsUserAuthOpen(true)}
          />
        )}

        {currentTab === 'new_order' && (
          <NewOrderView
            onNavigate={handleTabChange}
            onOpenAuthModal={() => setIsUserAuthOpen(true)}
            preselectedServiceId={selectedServiceIdForOrder}
          />
        )}

        {currentTab === 'services' && (
          <ServicesView onSelectServiceForOrder={handleSelectServiceForOrder} />
        )}

        {currentTab === 'orders' && (
          <OrdersView 
            onNavigate={handleTabChange} 
            onOpenAuthModal={() => setIsUserAuthOpen(true)} 
          />
        )}

        {currentTab === 'wallet' && (
          <WalletView onOpenAuthModal={() => setIsUserAuthOpen(true)} />
        )}

        {currentTab === 'referrals' && (
          <ReferAndEarnView 
            onNavigate={handleTabChange} 
            onOpenAuthModal={() => setIsUserAuthOpen(true)} 
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView onNavigate={handleTabChange} />
        )}

        {currentTab === 'support' && (
          <SupportView />
        )}

        {/* Admin Portal Views (Requires 2FA or Owner Privileges) */}
        {currentTab === 'admin_dashboard' && (admin || isOwnerOrAdmin) && (
          <AdminDashboardView onNavigateAdmin={handleTabChange} />
        )}

        {currentTab === 'admin_orders' && (admin || isOwnerOrAdmin) && (
          <AdminOrdersView />
        )}

        {currentTab === 'admin_payments' && (admin || isOwnerOrAdmin) && (
          <AdminPaymentsView />
        )}

        {currentTab === 'admin_services' && (admin || isOwnerOrAdmin) && (
          <AdminServicesView />
        )}

        {currentTab === 'admin_providers' && (admin || isOwnerOrAdmin) && (
          <AdminProvidersView />
        )}

        {currentTab === 'admin_users' && (admin || isOwnerOrAdmin) && (
          <AdminUsersView />
        )}

        {currentTab === 'admin_reports' && (admin || isOwnerOrAdmin) && (
          <AdminReportsView />
        )}

        {currentTab === 'admin_settings' && (admin || isOwnerOrAdmin) && (
          <AdminSettingsView />
        )}

        {currentTab === 'admin_monitoring' && (admin || isOwnerOrAdmin) && (
          <AdminMonitoringView />
        )}

        {currentTab === 'admin_referrals' && (admin || isOwnerOrAdmin) && (
          <AdminReferralsView />
        )}

        {currentTab === 'admin_maintenance' && (admin || isOwnerOrAdmin) && (
          <AdminMaintenanceView />
        )}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={isUserAuthOpen}
        onClose={() => setIsUserAuthOpen(false)}
      />

      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => {
          setIsAdminAuthOpen(false);
          if (admin) setCurrentTab('admin_dashboard');
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Zap className="w-3 h-3" />
            </div>
            <span className="font-bold text-slate-300">{settings.site_name || 'SociaraX'}</span>
            <span>• High-Speed SMM Provider</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            {settings.telegram_support && (
              <span className="flex items-center gap-1">
                <Send className="w-3 h-3 text-cyan-400" />
                <span>{settings.telegram_support}</span>
              </span>
            )}
            {settings.support_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-indigo-400" />
                <span>{settings.support_email}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-Bit SSL Encrypted & TOTP Protected</span>
            </div>
            
            <button
              onClick={() => setIsAdminAuthOpen(true)}
              className="p-1 text-slate-700 hover:text-slate-400 transition-colors cursor-pointer"
              title="Staff Access"
              aria-label="Staff Access"
            >
              <Lock className="w-3 h-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SociaraxProvider>
        <MainLayout />
      </SociaraxProvider>
    </AuthProvider>
  );
}

export default App;
