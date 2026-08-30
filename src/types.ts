export type PlatformType = 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'telegram' | 'twitter' | 'spotify' | 'other' | string;

export type OrderStatus = 'pending' | 'processing' | 'in_progress' | 'completed' | 'partial' | 'cancelled' | 'canceled' | 'refunded' | 'failed';

export type ServiceCategory = string;
export type PaymentMethod = string;
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export type SmmService = SociaraxService;
export type SmmOrder = SociaraxOrder;
export type SmmUser = ManagedUser;
export type SmmTransaction = WalletTransaction;
export type SmmProvider = ApiProvider;
export type SmmTicket = SupportTicket;
export type PanelSettings = SystemSettings;

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  role: 'user' | 'admin';
  walletBalance: number;
  currency?: string;
  status: 'active' | 'suspended';
  referralCode?: string;
  referredById?: number | null;
  created_at?: string;
}

export interface ReferralReward {
  id: number;
  referrerId: number;
  referredUserId: number;
  referredUsername: string;
  referredEmail: string;
  bonusAmount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  referralBonusAmount: number;
  referralMinDeposit: number;
  referralTerms: string;
  referralEnabled: boolean;
  rewards: ReferralReward[];
}

export interface AdminProfile {
  id: number;
  email: string;
  role: 'admin';
  totpEnabled: boolean;
}

export interface TotpSetupData {
  qrCodeDataUrl: string;
  manualKey: string;
  otpauthUrl: string;
  setupToken: string;
}

export interface SociaraxService {
  id: number;
  name: string;
  category: string;
  platform: PlatformType;
  description: string;
  type: string;
  min: number;
  max: number;
  rate: number; // SociaraX customer rate per 1000
  refill: boolean;
  cancel: boolean;
  dripfeed?: boolean;
  averageTime: string;
}

export interface AdminService extends SociaraxService {
  providerId: number | null;
  providerName: string;
  providerServiceId: string;
  providerRate: number;
  sellingRate: number;
  markupPercentage: number;
  markupFixed: number;
  profitPer1000: number;
  profitMarginPct: string;
  status: 'active' | 'inactive';
  displayOrder: number;
  createdAt: string;
}

export interface SociaraxOrder {
  id: number;
  serviceName: string;
  platform: PlatformType;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatus;
  startCount?: number;
  remains?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrder extends SociaraxOrder {
  userId: number;
  username: string;
  email: string;
  serviceId: number;
  providerCost: number;
  profit: number;
  providerId: number | null;
  providerName: string;
  providerOrderId: string | null;
  providerStatus: string | null;
  providerError: string | null;
}

export interface WalletTransaction {
  id: number;
  type: 'DEPOSIT_APPROVED' | 'ORDER_PAYMENT' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface PaymentRequestItem {
  id: number;
  userId?: number;
  username?: string;
  email?: string;
  currentUserBalance?: number;
  amount: number;
  currency?: string;
  method: string;
  utr: string;
  payerDetails?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  approvedByAdminId?: number;
  approvedAt?: string;
  createdAt: string;
}

export interface ApiProvider {
  id: number;
  name: string;
  adapterType: string;
  apiUrl: string;
  maskedKey: string;
  status: 'active' | 'inactive';
  balance: number;
  currency: string;
  priority: number;
  lastCheckedAt?: string;
  lastError?: string;
  createdAt: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  role: string;
  walletBalance: number;
  currency: string;
  status: 'active' | 'suspended';
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  userId: number;
  username?: string;
  subject: string;
  category: string;
  orderId?: number;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  senderRole: 'user' | 'admin';
  senderId: number;
  message: string;
  createdAt: string;
}

export interface AdminMetrics {
  totalRevenue: number;
  totalProviderCost: number;
  totalProfit: number;
  profitMarginPct: string;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  totalUsers: number;
  activeUsers: number;
  totalUserWalletBalance: number;
  totalDeposits: number;
  pendingDepositsCount: number;
  pendingDepositsAmount: number;
  approvedDepositsCount: number;
}

export interface PlatformMetric {
  platform: string;
  orderCount: number;
  revenue: number;
  profit: number;
}

export interface DailyTrendMetric {
  date: string;
  orders: number;
  revenue: number;
  profit: number;
}

export interface SystemSettings {
  site_name: string;
  site_title: string;
  currency: string;
  currency_symbol: string;
  usd_to_inr_rate?: string;
  default_markup_percentage?: string;
  min_deposit: string;
  upi_id: string;
  upi_secondary_id?: string;
  upi_merchant_name: string;
  custom_qr_image_url?: string;
  qr_code_url: string;
  bank_transfer_enabled?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_ifsc_code?: string;
  bank_branch?: string;
  bank_instructions?: string;
  usdt_enabled?: string;
  usdt_network?: string;
  usdt_wallet_address?: string;
  usdt_qr_image_url?: string;
  usdt_to_inr_rate?: string;
  usdt_instructions?: string;
  support_email: string;
  telegram_support: string;
  whatsapp_support: string;
  announcement: string;
  [key: string]: string | undefined;
}

export type ThemeColorName = 'indigo' | 'purple' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
export type ButtonStyleName = 'rounded-xl' | 'rounded-2xl' | 'rounded-lg' | 'rounded-full';

export interface WebsiteMaintenanceConfig {
  themeColor: ThemeColorName;
  siteTitle: string;
  heroHeadline: string;
  heroSubtitle: string;
  announcementBannerText: string;
  announcementBannerActive: boolean;
  announcementBannerType: 'info' | 'warning' | 'success' | 'alert';
  buttonStyle: ButtonStyleName;
  telegramSupport: string;
  whatsappSupport: string;
  maintenanceModeActive: boolean;
  maintenanceMessage: string;
  enableGlowEffects: boolean;
  compactMobileLayout: boolean;
  customBadgeText: string;
  quickSupportPhone: string;
  accentGradient: string;
  showSupportInHeader: boolean;
  showHeaderSimpleLabelOnly: boolean;
  headerSimpleLabel: string;
  loginHeadline: string;
  loginSubtitle: string;
  registerHeadline: string;
  authTagline: string;
}
