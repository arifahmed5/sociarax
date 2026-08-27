export interface ProviderServiceItem {
  service: string | number;
  name: string;
  type?: string;
  category?: string;
  rate: number | string;
  min: number | string;
  max: number | string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
  description?: string;
}

export interface ProviderCreateOrderParams {
  service: string | number;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
  comments?: string;
}

export interface ProviderCreateOrderResult {
  success: boolean;
  orderId?: string | number;
  error?: string;
  rawResponse?: any;
}

export interface ProviderOrderStatusResult {
  success: boolean;
  orderId: string | number;
  status: 'Pending' | 'In progress' | 'Completed' | 'Partial' | 'Canceled' | 'Processing' | 'Refunded' | string;
  charge?: number;
  start_count?: number | string;
  remains?: number | string;
  currency?: string;
  error?: string;
}

export interface ProviderBalanceResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

export interface ProviderAdapter {
  readonly name: string;
  readonly type: string;
  
  testConnection(apiUrl: string, apiKey: string): Promise<{ success: boolean; message: string; balance?: number }>;
  getBalance(apiUrl: string, apiKey: string): Promise<ProviderBalanceResult>;
  getServices(apiUrl: string, apiKey: string): Promise<{ success: boolean; services: ProviderServiceItem[]; error?: string }>;
  createOrder(apiUrl: string, apiKey: string, params: ProviderCreateOrderParams): Promise<ProviderCreateOrderResult>;
  getOrderStatus(apiUrl: string, apiKey: string, orderId: string | number): Promise<ProviderOrderStatusResult>;
  getMultipleOrderStatus?(apiUrl: string, apiKey: string, orderIds: (string | number)[]): Promise<Record<string, ProviderOrderStatusResult>>;
  cancelOrder?(apiUrl: string, apiKey: string, orderId: string | number): Promise<{ success: boolean; message?: string; error?: string }>;
  refillOrder?(apiUrl: string, apiKey: string, orderId: string | number): Promise<{ success: boolean; refillId?: string; error?: string }>;
}
