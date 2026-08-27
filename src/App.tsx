import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SociaraxProvider, useSociarax } from './context/SociaraxContext';
import { Navigation } from './components/Navigation';
import { DbStatusBanner } from './components/DbStatusBanner';

// User Views
import { UserDashboard } from './components/user/UserDashboard';
import { NewOrderView } from './components/user/NewOrderView';
import { ServicesView } from './components/user/ServicesView';
import { OrdersView } from './components/user/OrdersView';
import { WalletView } from './components/user/WalletView';
import { SupportView } from './components/user/SupportView';
import { ProfileView } from './components/user/ProfileView';
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
import { AuthGate } from './components/AuthGate';

import { ShieldCheck, Zap, Lock, Mail, Send, Heart } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, admin } = useAuth();
  const { settings } = useSociarax();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isUserAuthOpen, setIsUserAuthOpen] = useState<boolean>(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState<boolean>(false);
  const [selectedServiceIdForOrder, setSelectedServiceIdForOrder] = useState<number | null>(null);

  const handleSelectServiceForOrder = (serviceId: number) => {
    setSelectedServiceIdForOrder(serviceId);
    setCurrentTab('new_order');
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
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
