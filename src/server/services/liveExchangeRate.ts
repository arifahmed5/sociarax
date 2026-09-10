/**
 * Live USD to INR Exchange Rate Service
 * Fetches the real current exchange rate from live open exchange-rate APIs
 * with safe in-memory caching to avoid rate-limiting.
 */

interface LiveRateResult {
  rate: number;
  source: string;
  fetchedAt: string;
  isLive: boolean;
}

let cachedRate: { rate: number; timestamp: number; source: string } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function getLiveUsdToInrRate(fallbackRate = 89.5): Promise<LiveRateResult> {
  const now = Date.now();

  // Return cached live rate if within TTL
  if (cachedRate && (now - cachedRate.timestamp) < CACHE_TTL_MS && cachedRate.rate > 0) {
    return {
      rate: cachedRate.rate,
      source: cachedRate.source,
      fetchedAt: new Date(cachedRate.timestamp).toISOString(),
      isLive: true
    };
  }

  const sources = [
    {
      url: 'https://open.er-api.com/v6/latest/USD',
      extract: (data: any) => data?.rates?.INR
    },
    {
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      extract: (data: any) => data?.rates?.INR
    }
  ];

  for (const src of sources) {
    try {
      const response = await fetch(src.url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const json = await response.json();
        const inrRate = src.extract(json);
        const parsedRate = typeof inrRate === 'number' ? inrRate : parseFloat(String(inrRate));

        if (Number.isFinite(parsedRate) && parsedRate > 50 && parsedRate < 150) {
          const hostname = new URL(src.url).hostname;
          cachedRate = {
            rate: parsedRate,
            timestamp: now,
            source: hostname
          };

          return {
            rate: parsedRate,
            source: hostname,
            fetchedAt: new Date(now).toISOString(),
            isLive: true
          };
        }
      }
    } catch (err: any) {
      // Continue to next source
      console.warn(`[EXCHANGE RATE] Failed to fetch from ${src.url}:`, err?.message || err);
    }
  }

  // If both live rate APIs fail, return fallback with isLive: false
  return {
    rate: fallbackRate > 0 ? fallbackRate : 89.5,
    source: 'system_settings_fallback',
    fetchedAt: new Date(now).toISOString(),
    isLive: false
  };
}
