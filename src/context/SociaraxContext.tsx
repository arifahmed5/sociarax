import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  SociaraxService, 
  AdminService, 
  SociaraxOrder, 
  AdminOrder, 
  WalletTransaction, 
  PaymentRequestItem, 
  ApiProvider, 
  ManagedUser, 
  AdminMetrics, 
  PlatformMetric, 
  DailyTrendMetric, 
  SystemSettings,
  WebsiteMaintenanceConfig
} from '../types';
import { useAuth } from './AuthContext';

export const DEFAULT_MAINTENANCE_CONFIG: WebsiteMaintenanceConfig = {
  themeColor: 'indigo',
  siteTitle: 'SociaraX',
  heroHeadline: 'Welcome to SociaraX.',
  heroSubtitle: 'Non-drop social media growth services, real-time automated order fulfillment, multi-gateway INR payments, and direct owner WhatsApp/Telegram support.',
  announcementBannerText: 'Automated instant delivery active across Instagram, YouTube, Telegram, Snapchat, Facebook & X with 100% Non-Drop Refill Guarantee.',
  announcementBannerActive: true,
  announcementBannerType: 'info',
  buttonStyle: 'rounded-xl',
  telegramSupport: '@SociaraXSupport',
  whatsappSupport: '@SociaraXDirect',
  maintenanceModeActive: false,
  maintenanceMessage: 'SociaraX is currently undergoing scheduled high-speed infrastructure maintenance. Services will resume shortly.',
  enableGlowEffects: true,
  compactMobileLayout: false,
  customBadgeText: 'Automated SMM Infrastructure & Instant API Engine',
  quickSupportPhone: '+91 98765 43210',
  accentGradient: 'from-indigo-600 via-indigo-500 to-purple-600',
  showSupportInHeader: true,
  showHeaderSimpleLabelOnly: false,
  headerSimpleLabel: 'SociaraX',
  loginHeadline: 'Welcome to SociaraX',
  loginSubtitle: 'Enter your credentials to access your dashboard',
  registerHeadline: 'Create Your SociaraX Account',
  authTagline: 'Protected by SociaraX Enterprise Security & SSL Encryption'
};

interface SociaraxContextType {
  // Website Maintenance & UI Theme Config
  maintenanceConfig: WebsiteMaintenanceConfig;
  refreshMaintenanceConfig: () => Promise<void>;
  updateMaintenanceConfigLocally: (newConfig: WebsiteMaintenanceConfig) => void;
  // Services
  services: SociaraxService[];
  adminServices: AdminService[];
  categories: string[];
  platforms: string[];
  isServicesLoading: boolean;
  loadServices: (platform?: string, category?: string, search?: string) => Promise<void>;
  loadAdminServices: () => Promise<void>;
  createAdminService: (data: any) => Promise<{ success: boolean; error?: string }>;
  updateAdminService: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
  deleteAdminService: (id: number) => Promise<{ success: boolean; message?: string; error?: string }>;
  toggleAdminServiceStatus: (id: number) => Promise<{ success: boolean; status?: string; error?: string }>;
  syncProviderServices: (providerId?: number, defaultMarkupPct?: number) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Orders
  userOrders: SociaraxOrder[];
  adminOrders: AdminOrder[];
  isOrdersLoading: boolean;
  loadUserOrders: (status?: string, platform?: string, search?: string) => Promise<void>;
  loadAdminOrders: (status?: string, platform?: string, search?: string) => Promise<void>;
  placeOrder: (serviceId: number, link: string, quantity: number) => Promise<{ success: boolean; order?: any; error?: string }>;
  updateAdminOrderStatus: (orderId: number, newStatus: string, refund?: boolean) => Promise<{ success: boolean; error?: string }>;
  syncAdminOrderStatus: () => Promise<{ success: boolean; message?: string; error?: string }>;

  // Payments & Wallet
  userTransactions: WalletTransaction[];
  userDepositRequests: PaymentRequestItem[];
  adminPendingPayments: PaymentRequestItem[];
  adminPaymentHistory: PaymentRequestItem[];
  isPaymentsLoading: boolean;
  loadUserTransactions: () => Promise<void>;
  submitDeposit: (amount: number, method: string, utr: string, payerDetails?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  loadAdminPendingPayments: () => Promise<void>;
  loadAdminPaymentHistory: () => Promise<void>;
  approvePayment: (paymentId: number) => Promise<{ success: boolean; message?: string; error?: string }>;
  rejectPayment: (paymentId: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  adjustUserWallet: (userId: number, amount: number, reason: string) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Providers
  adminProviders: ApiProvider[];
  loadAdminProviders: () => Promise<void>;
  createAdminProvider: (data: any) => Promise<{ success: boolean; error?: string }>;
  updateAdminProvider: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
  testAdminProvider: (id: number) => Promise<{ success: boolean; message?: string; balance?: number; error?: string }>;

  // Users
  adminUsers: ManagedUser[];
  loadAdminUsers: () => Promise<void>;
  updateUserStatus: (userId: number, status: 'active' | 'suspended') => Promise<{ success: boolean; error?: string }>;

  // Reports
  adminMetrics: AdminMetrics | null;
  platformBreakdown: PlatformMetric[];
  dailyTrend: DailyTrendMetric[];
  loadAdminReports: () => Promise<void>;

  // Settings
  settings: SystemSettings;
  loadSettings: () => Promise<void>;
  saveAdminSettings: (data: Partial<SystemSettings>) => Promise<{ success: boolean; error?: string }>;

  // Helpers
  formatCurrency: (amount: number) => string;
}

const SociaraxContext = createContext<SociaraxContextType | undefined>(undefined);

export const SociaraxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken, adminToken, updateLocalWalletBalance } = useAuth();

  // State
  const [services, setServices] = useState<SociaraxService[]>([]);
  const [adminServices, setAdminServices] = useState<AdminService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isServicesLoading, setIsServicesLoading] = useState<boolean>(false);

  const [userOrders, setUserOrders] = useState<SociaraxOrder[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);

  const [userTransactions, setUserTransactions] = useState<WalletTransaction[]>([]);
  const [userDepositRequests, setUserDepositRequests] = useState<PaymentRequestItem[]>([]);
  const [adminPendingPayments, setAdminPendingPayments] = useState<PaymentRequestItem[]>([]);
  const [adminPaymentHistory, setAdminPaymentHistory] = useState<PaymentRequestItem[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState<boolean>(false);

  const [adminProviders, setAdminProviders] = useState<ApiProvider[]>([]);
  const [adminUsers, setAdminUsers] = useState<ManagedUser[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [platformBreakdown, setPlatformBreakdown] = useState<PlatformMetric[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendMetric[]>([]);
  const [maintenanceConfig, setMaintenanceConfig] = useState<WebsiteMaintenanceConfig>(DEFAULT_MAINTENANCE_CONFIG);

  const [settings, setSettings] = useState<SystemSettings>({
    site_name: 'SociaraX',
    site_title: 'SociaraX - Premium SMM Provider Panel',
    currency: 'INR',
    currency_symbol: '₹',
    min_deposit: '10',
    upi_id: 'sociarax@upi',
    upi_merchant_name: 'SociaraX Media Services',
    qr_code_url: '',
    support_email: 'support@sociarax.com',
    telegram_support: '@SociaraXSupport',
    whatsapp_support: '+91 98765 43210',
    announcement: 'Welcome to SociaraX! All Instagram and YouTube services are running with instant speed and high retention.'
  });

  const formatCurrency = (amount: number): string => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Safe Fetch JSON helper to prevent syntax errors when server returns HTML or fails
  const safeFetchJson = async (url: string, options?: RequestInit): Promise<any> => {
    try {
      const headers = new Headers(options?.headers || {});
      // Auto-inject authorization if not already explicitly provided
      if (!headers.has('Authorization')) {
        const adminTok = adminToken || localStorage.getItem('sociarax_admin_token');
        const usrTok = userToken || localStorage.getItem('sociarax_user_token');
        if (url.includes('/admin') && adminTok) {
          headers.set('Authorization', `Bearer ${adminTok}`);
        } else if (usrTok) {
          headers.set('Authorization', `Bearer ${usrTok}`);
        } else if (adminTok) {
          headers.set('Authorization', `Bearer ${adminTok}`);
        }
      }

      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.warn(`[API NON-JSON RESPONSE] URL: ${url}, Status: ${res.status}`);
        return { success: false, error: `Server returned HTTP ${res.status}` };
      }
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn(`[API FETCH NETWORK WARNING] URL: ${url}:`, err?.message || err);
      return { success: false, error: err.message || 'Network communication error' };
    }
  };

  // 1. Customer Services
  const loadServices = useCallback(async (platform?: string, category?: string, search?: string) => {
    setIsServicesLoading(true);
    try {
      const params = new URLSearchParams();
      if (platform && platform !== 'all') params.append('platform', platform);
      if (category && category !== 'all') params.append('category', category);
      if (search) params.append('search', search);

      const data = await safeFetchJson(`/api/services?${params.toString()}`);
      if (data && data.success) {
        setServices(data.services || []);
        if (data.categories) setCategories(data.categories);
        if (data.platforms) setPlatforms(data.platforms);
      }
    } catch (err) {
      console.error('[LOAD SERVICES ERROR]:', err);
    } finally {
      setIsServicesLoading(false);
    }
  }, []);

  // 2. Admin Services
  const loadAdminServices = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) {
      setIsServicesLoading(false);
      return;
    }
    setIsServicesLoading(true);
    try {
      const data = await safeFetchJson('/api/services/admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminServices(data.services || []);
      }
    } catch (err) {
      console.error('[LOAD ADMIN SERVICES ERROR]:', err);
    } finally {
      setIsServicesLoading(false);
    }
  }, [adminToken]);

  const createAdminService = async (data: any) => {
    try {
      const resData = await safeFetchJson('/api/services/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(data)
      });
      if (resData && resData.success) {
        await Promise.all([loadAdminServices(), loadServices()]);
        return { success: true };
      }
      return { success: false, error: resData?.error || 'Failed to create service' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateAdminService = async (id: number, data: any) => {
    try {
      const resData = await safeFetchJson(`/api/services/admin/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(data)
      });
      if (resData && resData.success) {
        await Promise.all([loadAdminServices(), loadServices()]);
        return { success: true };
      }
      return { success: false, error: resData?.error || 'Failed to update service' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteAdminService = async (id: number) => {
    try {
      const resData = await safeFetchJson(`/api/services/admin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (resData && resData.success) {
        await Promise.all([loadAdminServices(), loadServices()]);
        return { success: true, message: resData.message };
      }
      return { success: false, error: resData?.error || 'Failed to delete service' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const toggleAdminServiceStatus = async (id: number) => {
    try {
      const resData = await safeFetchJson(`/api/services/admin/${id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (resData && resData.success) {
        await Promise.all([loadAdminServices(), loadServices()]);
        return { success: true, status: resData.status };
      }
      return { success: false, error: resData?.error || 'Failed to toggle status' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const syncProviderServices = async (providerId?: number, defaultMarkupPct: number = 30) => {
    try {
      const resData = await safeFetchJson('/api/services/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ providerId, defaultMarkupPct })
      });
      if (resData && resData.success) {
        await Promise.all([loadAdminServices(), loadServices()]);
        return { success: true, message: resData.message };
      }
      return { success: false, error: resData?.error || 'Sync failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 3. User Orders
  const loadUserOrders = useCallback(async (status?: string, platform?: string, search?: string) => {
    const token = userToken || localStorage.getItem('sociarax_user_token');
    if (!token) {
      setIsOrdersLoading(false);
      return;
    }
    setIsOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (platform && platform !== 'all') params.append('platform', platform);
      if (search) params.append('search', search);

      const data = await safeFetchJson(`/api/orders?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setUserOrders(data.orders || []);
      }
    } catch (err) {
      console.error('[LOAD USER ORDERS ERROR]:', err);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [userToken]);

  const placeOrder = async (serviceId: number, link: string, quantity: number) => {
    try {
      const token = userToken || localStorage.getItem('sociarax_user_token');
      const data = await safeFetchJson('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ serviceId, link, quantity })
      });
      if (data && data.success) {
        if (data.newBalance !== undefined) {
          updateLocalWalletBalance(data.newBalance);
        }
        await loadUserOrders();
        return { success: true, order: data.order };
      }
      return { success: false, error: data?.error || 'Order placement failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 4. Admin Orders
  const loadAdminOrders = useCallback(async (status?: string, platform?: string, search?: string) => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) {
      setIsOrdersLoading(false);
      return;
    }
    setIsOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (platform && platform !== 'all') params.append('platform', platform);
      if (search) params.append('search', search);

      const data = await safeFetchJson(`/api/orders/admin?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminOrders(data.orders || []);
      }
    } catch (err) {
      console.error('[LOAD ADMIN ORDERS ERROR]:', err);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [adminToken]);

  const updateAdminOrderStatus = async (orderId: number, newStatus: string, refund: boolean = false) => {
    try {
      const data = await safeFetchJson(`/api/orders/admin/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ newStatus, refund })
      });
      if (data && data.success) {
        await loadAdminOrders();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to update order status' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const syncAdminOrderStatus = async () => {
    try {
      const data = await safeFetchJson('/api/orders/admin/sync-status', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (data && data.success) {
        await loadAdminOrders();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Sync failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 5. Payments & Wallet
  const loadUserTransactions = useCallback(async () => {
    const token = userToken || localStorage.getItem('sociarax_user_token');
    if (!token) {
      setIsPaymentsLoading(false);
      return;
    }
    setIsPaymentsLoading(true);
    try {
      const data = await safeFetchJson('/api/wallet/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setUserTransactions(data.transactions || []);
        setUserDepositRequests(data.depositRequests || []);
        if (data.currentBalance !== undefined) {
          updateLocalWalletBalance(data.currentBalance);
        }
      }
    } catch (err) {
      console.error('[LOAD USER TRANSACTIONS ERROR]:', err);
    } finally {
      setIsPaymentsLoading(false);
    }
  }, [userToken, updateLocalWalletBalance]);

  const submitDeposit = async (amount: number, method: string, utr: string, payerDetails?: string) => {
    try {
      const token = userToken || localStorage.getItem('sociarax_user_token');
      const data = await safeFetchJson('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, paymentMethod: method, utrNumber: utr, payerDetails })
      });
      if (data && data.success) {
        await loadUserTransactions();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Deposit submission failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const loadAdminPendingPayments = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) {
      setIsPaymentsLoading(false);
      return;
    }
    setIsPaymentsLoading(true);
    try {
      const data = await safeFetchJson('/api/admin/payments/admin/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminPendingPayments(data.pendingPayments || []);
      }
    } catch (err) {
      console.error('[LOAD PENDING PAYMENTS ERROR]:', err);
    } finally {
      setIsPaymentsLoading(false);
    }
  }, [adminToken]);

  const loadAdminPaymentHistory = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) return;
    try {
      const data = await safeFetchJson('/api/admin/payments/admin/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminPaymentHistory(data.history || []);
      }
    } catch (err) {
      console.error('[LOAD PAYMENT HISTORY ERROR]:', err);
    }
  }, [adminToken]);

  const approvePayment = async (paymentId: number) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const data = await safeFetchJson(`/api/admin/payments/admin/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        await loadAdminPendingPayments();
        await loadAdminPaymentHistory();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Approval failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const rejectPayment = async (paymentId: number, reason: string) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const data = await safeFetchJson(`/api/admin/payments/admin/${paymentId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      if (data && data.success) {
        await loadAdminPendingPayments();
        await loadAdminPaymentHistory();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Rejection failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const adjustUserWallet = async (userId: number, amount: number, reason: string) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const data = await safeFetchJson('/api/admin/payments/admin/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, amount, reason })
      });
      if (data && data.success) {
        await loadAdminUsers();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || 'Adjustment failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 6. Providers
  const loadAdminProviders = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) return;
    try {
      const data = await safeFetchJson('/api/admin/providers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminProviders(data.providers || []);
      }
    } catch (err) {
      console.error('[LOAD PROVIDERS ERROR]:', err);
    }
  }, [adminToken]);

  const createAdminProvider = async (data: any) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const resData = await safeFetchJson('/api/admin/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (resData && resData.success) {
        await loadAdminProviders();
        return { success: true };
      }
      return { success: false, error: resData?.error || 'Failed to create provider' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateAdminProvider = async (id: number, data: any) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const resData = await safeFetchJson(`/api/admin/providers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (resData && resData.success) {
        await loadAdminProviders();
        return { success: true };
      }
      return { success: false, error: resData?.error || 'Failed to update provider' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const testAdminProvider = async (id: number) => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const data = await safeFetchJson(`/api/admin/providers/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        await loadAdminProviders();
        return { success: true, message: data.message, balance: data.balance };
      }
      return { success: false, error: data?.error || 'Provider test failed' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 7. Users
  const loadAdminUsers = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) return;
    try {
      const data = await safeFetchJson('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminUsers(data.users || []);
      }
    } catch (err) {
      console.error('[LOAD ADMIN USERS ERROR]:', err);
    }
  }, [adminToken]);

  const updateUserStatus = async (userId: number, status: 'active' | 'suspended') => {
    try {
      const token = adminToken || localStorage.getItem('sociarax_admin_token');
      const data = await safeFetchJson(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (data && data.success) {
        await loadAdminUsers();
        return { success: true };
      }
      return { success: false, error: data?.error || 'Failed to update user status' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // 8. Reports
  const loadAdminReports = useCallback(async () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token');
    if (!token) return;
    try {
      const data = await safeFetchJson('/api/admin/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (data && data.success) {
        setAdminMetrics(data.metrics);
        setPlatformBreakdown(data.platformBreakdown || []);
        setDailyTrend(data.dailyTrend || []);
      }
    } catch (err) {
      console.error('[LOAD REPORTS ERROR]:', err);
    }
  }, [adminToken]);

  // 9. Website Maintenance & UI Theme Config
  const refreshMaintenanceConfig = useCallback(async () => {
    try {
      const data = await safeFetchJson('/api/maintenance/public-config');
      if (data && data.success && data.config) {
        setMaintenanceConfig(data.config);
      }
      const sData = await safeFetchJson('/api/settings');
      if (sData && sData.success && sData.settings) {
        setSettings(sData.settings);
      }
    } catch (err) {
      console.warn('[LOAD MAINTENANCE CONFIG NOTICE]:', err);
    }
  }, []);

  const updateMaintenanceConfigLocally = useCallback((newConfig: WebsiteMaintenanceConfig) => {
    setMaintenanceConfig(newConfig);
  }, []);

  // 10. Settings
  const loadSettings = useCallback(async () => {
    try {
      const data = await safeFetchJson('/api/settings');
      if (data && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('[LOAD SETTINGS ERROR]:', err);
    }
  }, []);

  const saveAdminSettings = async (data: Partial<SystemSettings>) => {
    try {
      const resData = await safeFetchJson('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ settings: data })
      });
      if (resData && resData.success) {
        setSettings(prev => prev ? ({ ...prev, ...data } as SystemSettings) : null);
        await loadSettings();
        return { success: true };
      }
      return { success: false, error: resData?.error || 'Failed to save settings' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Initialize data on mount
  useEffect(() => {
    refreshMaintenanceConfig();
    loadSettings();
    loadServices();
  }, [refreshMaintenanceConfig, loadSettings, loadServices]);

  useEffect(() => {
    if (userToken) {
      loadUserOrders();
      loadUserTransactions();
    }
  }, [userToken, loadUserOrders, loadUserTransactions]);

  useEffect(() => {
    if (adminToken) {
      loadAdminServices();
      loadAdminOrders();
      loadAdminPendingPayments();
      loadAdminPaymentHistory();
      loadAdminProviders();
      loadAdminUsers();
      loadAdminReports();
    }
  }, [adminToken, loadAdminServices, loadAdminOrders, loadAdminPendingPayments, loadAdminPaymentHistory, loadAdminProviders, loadAdminUsers, loadAdminReports]);

  return (
    <SociaraxContext.Provider
      value={{
        services,
        adminServices,
        categories,
        platforms,
        isServicesLoading,
        loadServices,
        loadAdminServices,
        createAdminService,
        updateAdminService,
        deleteAdminService,
        toggleAdminServiceStatus,
        syncProviderServices,

        userOrders,
        adminOrders,
        isOrdersLoading,
        loadUserOrders,
        loadAdminOrders,
        placeOrder,
        updateAdminOrderStatus,
        syncAdminOrderStatus,

        userTransactions,
        userDepositRequests,
        adminPendingPayments,
        adminPaymentHistory,
        isPaymentsLoading,
        loadUserTransactions,
        submitDeposit,
        loadAdminPendingPayments,
        loadAdminPaymentHistory,
        approvePayment,
        rejectPayment,
        adjustUserWallet,

        adminProviders,
        loadAdminProviders,
        createAdminProvider,
        updateAdminProvider,
        testAdminProvider,

        adminUsers,
        loadAdminUsers,
        updateUserStatus,

        adminMetrics,
        platformBreakdown,
        dailyTrend,
        loadAdminReports,

        maintenanceConfig,
        refreshMaintenanceConfig,
        updateMaintenanceConfigLocally,

        settings,
        loadSettings,
        saveAdminSettings,

        formatCurrency
      }}
    >
      {children}
    </SociaraxContext.Provider>
  );
};

export const useSociarax = (): SociaraxContextType => {
  const context = useContext(SociaraxContext);
  if (!context) {
    throw new Error('useSociarax must be used within a SociaraxProvider');
  }
  return context;
};
