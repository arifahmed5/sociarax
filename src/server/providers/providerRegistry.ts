import { getDbPool } from '../db';
import { decryptSecret, encryptSecret } from '../totp';
import { LuvsmmAdapter } from './luvsmmAdapter';
import { ProviderAdapter, ProviderServiceItem } from './types';

class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  constructor() {
    const luvsmm = new LuvsmmAdapter();
    this.adapters.set('luvsmm', luvsmm);
    this.adapters.set('standard_smm', luvsmm); // standard SMM v2 clone
  }

  getAdapter(type: string = 'luvsmm'): ProviderAdapter {
    const adapter = this.adapters.get(type.toLowerCase());
    if (!adapter) {
      return this.adapters.get('luvsmm')!;
    }
    return adapter;
  }

  /**
   * Ensure default Luvsmm provider exists in DB from environment variables
   */
  async ensureDefaultProvider(): Promise<void> {
    const db = getDbPool();
    if (!db) return;

    const envUrl = process.env.LUVSMM_API_URL || 'https://luvsmm.com/api/v2';
    const envKey = process.env.LUVSMM_API_KEY || '';

    try {
      const client = await db.connect();
      try {
        const res = await client.query('SELECT id, api_key_encrypted FROM api_providers WHERE adapter_type = $1 LIMIT 1', ['luvsmm']);
        
        if (res.rowCount === 0) {
          const masked = envKey.length > 4 ? `••••••••••••${envKey.slice(-4)}` : '••••••••••••';
          const encrypted = encryptSecret(envKey);
          await client.query(`
            INSERT INTO api_providers (name, adapter_type, api_url, api_key_encrypted, masked_key, status, priority)
            VALUES ($1, $2, $3, $4, $5, 'active', 1)
          `, ['Luvsmm Main', 'luvsmm', envUrl, encrypted, masked]);
          console.log('[PROVIDER] Initialized default Luvsmm provider entry in database.');
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[PROVIDER] Error ensuring default provider:', err);
    }
  }

  /**
   * Get provider credentials and adapter for a given providerId or default active provider
   */
  async getActiveProvider(providerId?: number): Promise<{
    id: number;
    name: string;
    adapter: ProviderAdapter;
    apiUrl: string;
    apiKey: string;
  } | null> {
    const db = getDbPool();
    if (!db) {
      // Fallback to env if DB is not available
      const envUrl = process.env.LUVSMM_API_URL;
      const envKey = process.env.LUVSMM_API_KEY;
      if (envUrl && envKey) {
        return {
          id: 1,
          name: 'Luvsmm Default',
          adapter: this.getAdapter('luvsmm'),
          apiUrl: envUrl,
          apiKey: envKey,
        };
      }
      return null;
    }

    try {
      let query = 'SELECT id, name, adapter_type, api_url, api_key_encrypted, status FROM api_providers WHERE status = $1 ';
      const params: any[] = ['active'];

      if (providerId) {
        query += 'AND id = $2 ';
        params.push(providerId);
      } else {
        query += 'ORDER BY priority ASC, id ASC LIMIT 1';
      }

      const res = await db.query(query, params);
      if (res.rowCount === 0) {
        // If not in DB, fallback to env vars
        if (process.env.LUVSMM_API_URL && process.env.LUVSMM_API_KEY) {
          return {
            id: 0,
            name: 'Environment Luvsmm',
            adapter: this.getAdapter('luvsmm'),
            apiUrl: process.env.LUVSMM_API_URL,
            apiKey: process.env.LUVSMM_API_KEY,
          };
        }
        return null;
      }

      const row = res.rows[0];
      const decryptedKey = decryptSecret(row.api_key_encrypted) || process.env.LUVSMM_API_KEY || '';
      return {
        id: row.id,
        name: row.name,
        adapter: this.getAdapter(row.adapter_type),
        apiUrl: row.api_url,
        apiKey: decryptedKey,
      };
    } catch (err) {
      console.error('[PROVIDER REGISTRY ERROR]:', err);
      return null;
    }
  }
}

export const providerRegistry = new ProviderRegistry();
