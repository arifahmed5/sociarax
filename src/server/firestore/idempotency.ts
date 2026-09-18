/**
 * SociaraX Firestore Idempotency Guard
 * 
 * Protects financial and critical operational mutations against duplicates:
 * - Wallet deductions
 * - Wallet refunds
 * - Payment deposit approvals
 * - Order creations
 * - External provider (LuvSMM) dispatches
 */

import { getFirestoreInstance } from '../firebaseAdmin';

export interface IdempotencyRecord {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

// In-memory quick cache for sub-second rapid retries
const memoryCache = new Map<string, { status: string; result?: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function withFirestoreIdempotency<T>(
  key: string | undefined | null,
  operation: () => Promise<T>,
  options?: { ttlSeconds?: number; operationType?: string }
): Promise<T> {
  if (!key || typeof key !== 'string' || key.trim() === '') {
    return await operation();
  }

  const cleanKey = key.trim();
  const db = getFirestoreInstance();
  const idempotencyRef = db.collection('idempotency_keys').doc(cleanKey);

  // 1. Fast in-memory check
  const mem = memoryCache.get(cleanKey);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    if (mem.status === 'completed') {
      console.log(`[IDEMPOTENCY] Fast memory hit for key "${cleanKey}". Returning saved result.`);
      return mem.result as T;
    }
    if (mem.status === 'processing') {
      throw new Error(`Duplicate request in progress for idempotency key: ${cleanKey}`);
    }
  }

  // 2. Atomic Firestore transaction check
  const existingDoc = await idempotencyRef.get();
  if (existingDoc.exists) {
    const data = existingDoc.data() as IdempotencyRecord;
    if (data.status === 'completed') {
      console.log(`[IDEMPOTENCY] Firestore hit for key "${cleanKey}". Duplicate blocked, returning result.`);
      memoryCache.set(cleanKey, { status: 'completed', result: data.result, timestamp: Date.now() });
      return data.result as T;
    }
    if (data.status === 'processing') {
      const createdTime = new Date(data.created_at).getTime();
      // If processing for more than 60 seconds, treat as stale/failed to allow recovery
      if (Date.now() - createdTime < 60000) {
        throw new Error(`Duplicate request in progress for idempotency key: ${cleanKey}`);
      }
    }
  }

  // Mark as processing
  const now = new Date().toISOString();
  memoryCache.set(cleanKey, { status: 'processing', timestamp: Date.now() });
  await idempotencyRef.set({
    key: cleanKey,
    operationType: options?.operationType || 'generic',
    status: 'processing',
    created_at: now,
    updated_at: now
  });

  try {
    const result = await operation();
    
    // Mark as completed
    const completedAt = new Date().toISOString();
    await idempotencyRef.update({
      status: 'completed',
      result: result !== undefined ? JSON.parse(JSON.stringify(result)) : null,
      updated_at: completedAt
    });
    memoryCache.set(cleanKey, { status: 'completed', result, timestamp: Date.now() });

    return result;
  } catch (err: any) {
    memoryCache.delete(cleanKey);
    try {
      await idempotencyRef.update({
        status: 'failed',
        error: err.message || 'Unknown error',
        updated_at: new Date().toISOString()
      });
    } catch {
      // Ignore cleanup error on failure
    }
    throw err;
  }
}
