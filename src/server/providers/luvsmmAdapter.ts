import { 
  ProviderAdapter, 
  ProviderBalanceResult, 
  ProviderCreateOrderParams, 
  ProviderCreateOrderResult, 
  ProviderOrderStatusResult, 
  ProviderServiceItem 
} from './types';

export class LuvsmmAdapter implements ProviderAdapter {
  readonly name = 'Luvsmm';
  readonly type = 'luvsmm';

  private async makeRequest(apiUrl: string, apiKey: string, bodyParams: Record<string, any>, timeoutMs: number = 15000): Promise<any> {
    const cleanUrl = apiUrl.trim();
    const formData = new URLSearchParams();
    formData.append('key', apiKey.trim());
    for (const [key, value] of Object.entries(bodyParams)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SociaraX-Server/1.0',
          'Accept': 'application/json',
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[LUVSMM ADAPTER] Non-JSON response received:', responseText.slice(0, 300));
        throw new Error('Provider returned non-JSON response');
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Provider connection timed out after 15 seconds');
      }
      throw err;
    }
  }

  async testConnection(apiUrl: string, apiKey: string): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
      const balanceRes = await this.getBalance(apiUrl, apiKey);
      if (balanceRes.success) {
        return {
          success: true,
          message: `Connection successful! Provider balance: ${balanceRes.balance} ${balanceRes.currency || ''}`,
          balance: balanceRes.balance,
        };
      }
      return {
        success: false,
        message: balanceRes.error || 'Connection failed with provider',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection error: ${err.message}`,
      };
    }
  }

  async getBalance(apiUrl: string, apiKey: string): Promise<ProviderBalanceResult> {
    try {
      const data = await this.makeRequest(apiUrl, apiKey, { action: 'balance' });
      if (data && data.error) {
        return { success: false, error: String(data.error) };
      }
      if (data && (data.balance !== undefined || data.balance_formatted !== undefined)) {
        const balance = parseFloat(data.balance || data.balance_formatted || '0');
        return {
          success: true,
          balance: isNaN(balance) ? 0 : balance,
          currency: data.currency || 'USD',
        };
      }
      return { success: false, error: 'Invalid balance format from provider' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getServices(apiUrl: string, apiKey: string): Promise<{ success: boolean; services: ProviderServiceItem[]; error?: string }> {
    try {
      const data = await this.makeRequest(apiUrl, apiKey, { action: 'services' });
      if (Array.isArray(data)) {
        const services: ProviderServiceItem[] = data.map((item: any) => ({
          service: item.service || item.id,
          name: item.name,
          type: item.type || 'Default',
          category: item.category || 'General',
          rate: parseFloat(item.rate || '0'),
          min: parseInt(item.min || '10', 10),
          max: parseInt(item.max || '100000', 10),
          dripfeed: Boolean(item.dripfeed),
          refill: Boolean(item.refill),
          cancel: Boolean(item.cancel),
          description: item.desc || item.description || '',
        }));
        return { success: true, services };
      }
      if (data && data.error) {
        return { success: false, services: [], error: String(data.error) };
      }
      return { success: false, services: [], error: 'Expected array of services from provider' };
    } catch (err: any) {
      return { success: false, services: [], error: err.message };
    }
  }

  async createOrder(apiUrl: string, apiKey: string, params: ProviderCreateOrderParams): Promise<ProviderCreateOrderResult> {
    try {
      const postData: Record<string, any> = {
        action: 'add',
        service: params.service,
        link: params.link,
        quantity: params.quantity,
      };

      if (params.runs) postData.runs = params.runs;
      if (params.interval) postData.interval = params.interval;
      if (params.comments) postData.comments = params.comments;

      const data = await this.makeRequest(apiUrl, apiKey, postData);

      if (data && data.order) {
        return {
          success: true,
          orderId: data.order,
          rawResponse: data,
        };
      }

      const errorMessage = data?.error || 'Provider rejected order without specific error';
      return {
        success: false,
        error: errorMessage,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to communicate with provider API',
      };
    }
  }

  async getOrderStatus(apiUrl: string, apiKey: string, orderId: string | number): Promise<ProviderOrderStatusResult> {
    try {
      const data = await this.makeRequest(apiUrl, apiKey, {
        action: 'status',
        order: orderId,
      });

      if (data && data.status) {
        return {
          success: true,
          orderId,
          status: data.status,
          charge: parseFloat(data.charge || '0'),
          start_count: data.start_count,
          remains: data.remains,
          currency: data.currency,
        };
      }

      return {
        success: false,
        orderId,
        status: 'Unknown',
        error: data?.error || 'Unable to retrieve status',
      };
    } catch (err: any) {
      return {
        success: false,
        orderId,
        status: 'Unknown',
        error: err.message,
      };
    }
  }

  async getMultipleOrderStatus(apiUrl: string, apiKey: string, orderIds: (string | number)[]): Promise<Record<string, ProviderOrderStatusResult>> {
    const results: Record<string, ProviderOrderStatusResult> = {};
    if (orderIds.length === 0) return results;

    try {
      const data = await this.makeRequest(apiUrl, apiKey, {
        action: 'status',
        orders: orderIds.join(','),
      });

      if (data && typeof data === 'object') {
        for (const id of orderIds) {
          const item = data[String(id)];
          if (item && item.status) {
            results[String(id)] = {
              success: true,
              orderId: id,
              status: item.status,
              charge: parseFloat(item.charge || '0'),
              start_count: item.start_count,
              remains: item.remains,
            };
          } else {
            results[String(id)] = {
              success: false,
              orderId: id,
              status: 'Unknown',
              error: item?.error || 'Status not returned',
            };
          }
        }
        return results;
      }
    } catch (err: any) {
      console.warn('[LUVSMM MULTI STATUS ERROR]:', err.message);
    }

    // Fallback to individual status checks
    for (const id of orderIds) {
      results[String(id)] = await this.getOrderStatus(apiUrl, apiKey, id);
    }
    return results;
  }
}
