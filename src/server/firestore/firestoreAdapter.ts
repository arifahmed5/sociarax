/**
 * SociaraX Firestore Complete Data Access Adapter
 * 
 * Production-ready data access layer covering ALL 17 migrated collections:
 * 1. system_settings
 * 2. users
 * 3. admin_security
 * 4. api_providers
 * 5. service_categories
 * 6. services
 * 7. orders
 * 8. wallet_transactions
 * 9. payment_requests
 * 10. support_tickets
 * 11. ticket_messages
 * 12. user_banners
 * 13. referral_rewards
 * 14. audit_logs
 * 15. fraud_rejection_audits
 * 16. notifications
 * 17. password_resets (LOCKED)
 * 
 * Preserves exact numeric IDs, field schemas, relational integrity,
 * and enforces strict ACID transaction atomicity & idempotency for all financial operations.
 */

import { getFirestoreInstance } from '../firebaseAdmin';
import { withFirestoreIdempotency } from './idempotency';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';

export interface AdapterStats {
  backend: 'firestore';
  connected: boolean;
  databaseId: string;
  collectionsCovered: number;
}

/**
 * Atomic Numeric ID Allocator
 * Ensures newly created records receive monotonic numeric IDs preserving existing sequence.
 */
async function getNextNumericId(db: Firestore, collectionName: string): Promise<number> {
  const counterRef = db.collection('_counters').doc(collectionName);
  return await db.runTransaction(async (t) => {
    const snap = await t.get(counterRef);
    let nextId = 1;
    if (snap.exists) {
      nextId = (snap.data()?.currentId || 0) + 1;
    } else {
      // Find highest existing document numeric ID
      const querySnap = await db.collection(collectionName).get();
      let maxId = 0;
      querySnap.forEach((doc) => {
        const numId = parseInt(doc.id, 10);
        if (!isNaN(numId) && numId > maxId) {
          maxId = numId;
        }
      });
      nextId = maxId + 1;
    }
    t.set(counterRef, { currentId: nextId, updated_at: new Date().toISOString() }, { merge: true });
    return nextId;
  });
}

// =========================================================================
// 1. SYSTEM SETTINGS
// =========================================================================
export const systemSettings = {
  async getAll(): Promise<Record<string, string>> {
    const db = getFirestoreInstance();
    const snap = await db.collection('system_settings').get();
    const map: Record<string, string> = {};
    snap.forEach((doc) => {
      const data = doc.data();
      map[data.key || doc.id] = String(data.value ?? '');
    });
    return map;
  },

  async get(key: string, defaultValue: string = ''): Promise<string> {
    const db = getFirestoreInstance();
    const doc = await db.collection('system_settings').doc(key).get();
    if (!doc.exists) return defaultValue;
    const val = doc.data()?.value;
    return val !== undefined && val !== null ? String(val) : defaultValue;
  },

  async set(key: string, value: string, description?: string): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('system_settings').doc(key).set({
      key,
      value: String(value),
      description: description || '',
      updated_at: now
    }, { merge: true });
  },

  async setMultiple(settings: Record<string, string>): Promise<void> {
    const db = getFirestoreInstance();
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      const ref = db.collection('system_settings').doc(key);
      batch.set(ref, { key, value: String(value), updated_at: now }, { merge: true });
    }
    await batch.commit();
  }
};

// =========================================================================
// 2. USERS
// =========================================================================
export const users = {
  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('users').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async getByEmail(email: string): Promise<any | null> {
    const db = getFirestoreInstance();
    const cleanEmail = email.trim().toLowerCase();
    const snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async getByUsername(username: string): Promise<any | null> {
    const db = getFirestoreInstance();
    const cleanUser = username.trim().toLowerCase();
    const snap = await db.collection('users').where('username', '==', cleanUser).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async list(options?: { limit?: number; offset?: number; search?: string }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query = db.collection('users').orderBy('id', 'desc');
    if (options?.limit) query = query.limit(options.limit);
    const snap = await query.get();
    const result: any[] = [];
    snap.forEach((doc) => {
      result.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return result;
  },

  async create(userData: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'users');
    const now = new Date().toISOString();
    const userDoc = {
      ...userData,
      id: nextId,
      wallet_balance: userData.wallet_balance !== undefined ? String(userData.wallet_balance) : '0.0000',
      currency: userData.currency || 'INR',
      status: userData.status || 'active',
      role: userData.role || 'user',
      created_at: userData.created_at || now,
      updated_at: now
    };
    await db.collection('users').doc(String(nextId)).set(userDoc);
    return userDoc;
  },

  async update(id: number | string, updates: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('users').doc(String(id)).update({
      ...updates,
      updated_at: now
    });
  },

  async getWalletBalance(id: number | string): Promise<number> {
    const user = await users.getById(id);
    return user ? parseFloat(user.wallet_balance || '0') : 0;
  }
};

// =========================================================================
// 3. ADMIN SECURITY
// =========================================================================
export const adminSecurity = {
  async getByEmail(email: string): Promise<any | null> {
    const db = getFirestoreInstance();
    const cleanEmail = email.trim().toLowerCase();
    const snap = await db.collection('admin_security').where('email', '==', cleanEmail).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('admin_security').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async update(id: number | string, updates: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('admin_security').doc(String(id)).update({
      ...updates,
      updated_at: now
    });
  },

  async recordFailedAttempt(id: number | string): Promise<{ locked: boolean; lockedUntil?: string }> {
    const db = getFirestoreInstance();
    const ref = db.collection('admin_security').doc(String(id));
    return await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) return { locked: false };
      const data = snap.data() || {};
      const newAttempts = (data.failed_attempts || 0) + 1;
      let lockedUntil = data.locked_until || null;
      let locked = false;

      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock
        locked = true;
      }

      t.update(ref, {
        failed_attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString()
      });

      return { locked, lockedUntil };
    });
  },

  async resetFailedAttempts(id: number | string): Promise<void> {
    const db = getFirestoreInstance();
    await db.collection('admin_security').doc(String(id)).update({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
};

// =========================================================================
// 4. API PROVIDERS
// =========================================================================
export const apiProviders = {
  async getAll(): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('api_providers').orderBy('priority', 'asc').get();
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('api_providers').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async update(id: number | string, updates: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('api_providers').doc(String(id)).update({
      ...updates,
      updated_at: now
    });
  }
};

// =========================================================================
// 5. SERVICE CATEGORIES
// =========================================================================
export const serviceCategories = {
  async getAll(): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('service_categories').orderBy('display_order', 'asc').get();
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('service_categories').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async create(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'service_categories');
    const now = new Date().toISOString();
    const catDoc = {
      ...data,
      id: nextId,
      created_at: now,
      updated_at: now
    };
    await db.collection('service_categories').doc(String(nextId)).set(catDoc);
    return catDoc;
  }
};

// =========================================================================
// 6. SERVICES
// =========================================================================
export const services = {
  async getAll(filter?: { category_id?: number; platform?: string; status?: string }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('services');
    if (filter?.status) {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.platform) {
      query = query.where('platform', '==', filter.platform);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      const data = doc.data();
      if (filter?.category_id !== undefined && data.category_id !== filter.category_id) {
        return;
      }
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...data });
    });
    return list;
  },

  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('services').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async update(id: number | string, updates: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('services').doc(String(id)).update({
      ...updates,
      updated_at: now
    });
  }
};

// =========================================================================
// 7. ORDERS & 8. WALLET TRANSACTIONS (Strict Financial Atomicity)
// =========================================================================
export const orders = {
  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('orders').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async list(options?: { userId?: number | string; status?: string; limit?: number }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('orders').orderBy('id', 'desc');
    if (options?.userId) {
      query = query.where('user_id', '==', parseInt(String(options.userId), 10));
    }
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  /**
   * Atomic Order Creation with Wallet Deduction
   * Guarantees that wallet balance is verified, deducted, order record created,
   * and ledger transaction recorded atomically without double-charging or race conditions.
   */
  async createWithDeductionAtomic(orderData: {
    userId: number;
    serviceId: number;
    serviceName: string;
    platform: string;
    link: string;
    quantity: number;
    charge: number;
    providerCost: number;
    providerCostUsd: number;
    exchangeRateUsed: number;
    profit: number;
    providerId: number;
    idempotencyKey?: string;
  }): Promise<any> {
    return await withFirestoreIdempotency(orderData.idempotencyKey, async () => {
      const db = getFirestoreInstance();
      const userRef = db.collection('users').doc(String(orderData.userId));

      return await db.runTransaction(async (t) => {
        // 1. Verify User State & Balance
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) {
          throw new Error('User not found.');
        }
        const userData = userSnap.data() || {};
        if (userData.status !== 'active') {
          throw new Error('User account is not active.');
        }
        const currentBal = parseFloat(userData.wallet_balance || '0');
        if (currentBal < orderData.charge) {
          throw new Error(`Insufficient wallet balance. Required: ₹${orderData.charge.toFixed(2)}, Available: ₹${currentBal.toFixed(2)}.`);
        }

        // 2. Allocate IDs
        const newBalance = parseFloat((currentBal - orderData.charge).toFixed(4));
        const now = new Date().toISOString();

        // 3. Prepare Order & Transaction Records
        // Use counter references inside transaction
        const orderCounterRef = db.collection('_counters').doc('orders');
        const txCounterRef = db.collection('_counters').doc('wallet_transactions');

        const orderCounterSnap = await t.get(orderCounterRef);
        const txCounterSnap = await t.get(txCounterRef);

        const nextOrderId = (orderCounterSnap.data()?.currentId || 89) + 1;
        const nextTxId = (txCounterSnap.data()?.currentId || 141) + 1;

        t.set(orderCounterRef, { currentId: nextOrderId, updated_at: now }, { merge: true });
        t.set(txCounterRef, { currentId: nextTxId, updated_at: now }, { merge: true });

        const orderRef = db.collection('orders').doc(String(nextOrderId));
        const txRef = db.collection('wallet_transactions').doc(String(nextTxId));

        const orderDoc = {
          id: nextOrderId,
          user_id: orderData.userId,
          service_id: orderData.serviceId,
          service_name: orderData.serviceName,
          platform: orderData.platform,
          link: orderData.link,
          quantity: orderData.quantity,
          charge: String(orderData.charge),
          provider_cost: String(orderData.providerCost),
          provider_cost_usd: String(orderData.providerCostUsd),
          exchange_rate_used: String(orderData.exchangeRateUsed),
          profit: String(orderData.profit),
          currency: 'INR',
          provider_id: orderData.providerId,
          provider_order_id: null,
          provider_status: 'pending',
          status: 'pending',
          start_count: 0,
          remains: orderData.quantity,
          idempotency_key: orderData.idempotencyKey || null,
          created_at: now,
          updated_at: now
        };

        const txDoc = {
          id: nextTxId,
          user_id: orderData.userId,
          type: 'ORDER_PAYMENT',
          amount: String(-Math.abs(orderData.charge)),
          balance_before: String(currentBal),
          balance_after: String(newBalance),
          currency: 'INR',
          reference_type: 'order',
          reference_id: String(nextOrderId),
          description: `Order #${nextOrderId} - ${orderData.serviceName}`,
          admin_id: null,
          created_at: now
        };

        // 4. Atomic writes
        t.update(userRef, { wallet_balance: String(newBalance), updated_at: now });
        t.set(orderRef, orderDoc);
        t.set(txRef, txDoc);

        return orderDoc;
      });
    }, { operationType: 'order_create' });
  },

  async updateStatus(id: number | string, status: string, extraUpdates?: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('orders').doc(String(id)).update({
      status,
      ...(extraUpdates || {}),
      updated_at: now
    });
  }
};

// =========================================================================
// 8. WALLET TRANSACTIONS & REFUNDS
// =========================================================================
export const wallet = {
  async listTransactions(options?: { userId?: number | string; limit?: number }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('wallet_transactions').orderBy('id', 'desc');
    if (options?.userId) {
      query = query.where('user_id', '==', parseInt(String(options.userId), 10));
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  /**
   * Atomic Order Refund
   * Restores user wallet balance, updates order refund status, and records ledger entry.
   */
  async refundOrderAtomic(orderId: number | string, refundAmount: number, options?: { reason?: string; idempotencyKey?: string }): Promise<any> {
    return await withFirestoreIdempotency(options?.idempotencyKey || `refund_order_${orderId}`, async () => {
      const db = getFirestoreInstance();
      const orderRef = db.collection('orders').doc(String(orderId));

      return await db.runTransaction(async (t) => {
        const orderSnap = await t.get(orderRef);
        if (!orderSnap.exists) throw new Error('Order not found.');
        const orderData = orderSnap.data() || {};
        if (orderData.status === 'refunded' || orderData.status === 'cancelled') {
          throw new Error('Order is already refunded or cancelled.');
        }

        const userRef = db.collection('users').doc(String(orderData.user_id));
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new Error('User not found.');
        const userData = userSnap.data() || {};

        const currentBal = parseFloat(userData.wallet_balance || '0');
        const newBal = parseFloat((currentBal + refundAmount).toFixed(4));
        const now = new Date().toISOString();

        // Allocate Tx ID
        const txCounterRef = db.collection('_counters').doc('wallet_transactions');
        const txCounterSnap = await t.get(txCounterRef);
        const nextTxId = (txCounterSnap.data()?.currentId || 141) + 1;
        t.set(txCounterRef, { currentId: nextTxId, updated_at: now }, { merge: true });

        const txRef = db.collection('wallet_transactions').doc(String(nextTxId));

        const txDoc = {
          id: nextTxId,
          user_id: orderData.user_id,
          type: 'REFUND',
          amount: String(refundAmount),
          balance_before: String(currentBal),
          balance_after: String(newBal),
          currency: 'INR',
          reference_type: 'order',
          reference_id: String(orderId),
          description: options?.reason || `Refund for Order #${orderId}`,
          admin_id: null,
          created_at: now
        };

        t.update(orderRef, { status: 'refunded', updated_at: now });
        t.update(userRef, { wallet_balance: String(newBal), updated_at: now });
        t.set(txRef, txDoc);

        return { success: true, orderId, refundAmount, newBalance: newBal };
      });
    }, { operationType: 'wallet_refund' });
  }
};

// =========================================================================
// 9. PAYMENT REQUESTS
// =========================================================================
export const paymentRequests = {
  async getById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('payment_requests').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async list(options?: { userId?: number | string; status?: string; limit?: number }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('payment_requests').orderBy('id', 'desc');
    if (options?.userId) {
      query = query.where('user_id', '==', parseInt(String(options.userId), 10));
    }
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async create(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'payment_requests');
    const now = new Date().toISOString();
    const paymentDoc = {
      ...data,
      id: nextId,
      status: 'pending',
      created_at: now,
      updated_at: now
    };
    await db.collection('payment_requests').doc(String(nextId)).set(paymentDoc);
    return paymentDoc;
  },

  /**
   * Atomic Payment Approval
   * Atomically verifies status is pending, updates status to approved,
   * adds funds to user's wallet, and creates a DEPOSIT_APPROVED ledger entry.
   */
  async approveAtomic(paymentId: number | string, adminId: number | string, idempotencyKey?: string): Promise<any> {
    return await withFirestoreIdempotency(idempotencyKey || `deposit_approve_${paymentId}`, async () => {
      const db = getFirestoreInstance();
      const payRef = db.collection('payment_requests').doc(String(paymentId));

      return await db.runTransaction(async (t) => {
        const paySnap = await t.get(payRef);
        if (!paySnap.exists) throw new Error('Payment request not found.');
        const payment = paySnap.data() || {};
        if (payment.status !== 'pending') {
          throw new Error(`Payment request is already ${payment.status}.`);
        }

        const userRef = db.collection('users').doc(String(payment.user_id));
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new Error('Associated user not found.');
        const user = userSnap.data() || {};

        const depositAmount = parseFloat(payment.amount || '0');
        const currentBal = parseFloat(user.wallet_balance || '0');
        const newBal = parseFloat((currentBal + depositAmount).toFixed(4));
        const now = new Date().toISOString();

        // Allocate Tx ID
        const txCounterRef = db.collection('_counters').doc('wallet_transactions');
        const txCounterSnap = await t.get(txCounterRef);
        const nextTxId = (txCounterSnap.data()?.currentId || 141) + 1;
        t.set(txCounterRef, { currentId: nextTxId, updated_at: now }, { merge: true });

        const txRef = db.collection('wallet_transactions').doc(String(nextTxId));

        const txDoc = {
          id: nextTxId,
          user_id: payment.user_id,
          type: 'DEPOSIT_APPROVED',
          amount: String(depositAmount),
          balance_before: String(currentBal),
          balance_after: String(newBal),
          currency: 'INR',
          reference_type: 'payment_request',
          reference_id: String(paymentId),
          description: `Deposit Approved - ${payment.payment_method || 'UPI'} (UTR: ${payment.utr_number || 'N/A'})`,
          admin_id: parseInt(String(adminId), 10) || 1,
          created_at: now
        };

        t.update(payRef, {
          status: 'approved',
          approved_by_admin_id: parseInt(String(adminId), 10) || 1,
          approved_at: now,
          updated_at: now
        });
        t.update(userRef, { wallet_balance: String(newBal), updated_at: now });
        t.set(txRef, txDoc);

        return { success: true, paymentId, depositAmount, newBalance: newBal };
      });
    }, { operationType: 'deposit_approve' });
  },

  async reject(paymentId: number | string, adminId: number | string, reason: string): Promise<void> {
    const db = getFirestoreInstance();
    const now = new Date().toISOString();
    await db.collection('payment_requests').doc(String(paymentId)).update({
      status: 'rejected',
      admin_note: reason,
      updated_at: now
    });
  }
};

// =========================================================================
// 10. SUPPORT TICKETS & 11. TICKET MESSAGES
// =========================================================================
export const support = {
  async listTickets(options?: { userId?: number | string; status?: string }): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('support_tickets').orderBy('id', 'desc');
    if (options?.userId) {
      query = query.where('user_id', '==', parseInt(String(options.userId), 10));
    }
    if (options?.status) {
      query = query.where('status', '==', options.status);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async getTicketById(id: number | string): Promise<any | null> {
    const db = getFirestoreInstance();
    const doc = await db.collection('support_tickets').doc(String(id)).get();
    if (!doc.exists) return null;
    return { id: parseInt(doc.id, 10) || doc.id, ...doc.data() };
  },

  async createTicket(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'support_tickets');
    const now = new Date().toISOString();
    const ticketDoc = {
      ...data,
      id: nextId,
      status: 'open',
      created_at: now,
      updated_at: now
    };
    await db.collection('support_tickets').doc(String(nextId)).set(ticketDoc);
    return ticketDoc;
  },

  async getMessages(ticketId: number | string): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('ticket_messages')
      .where('ticket_id', '==', parseInt(String(ticketId), 10))
      .orderBy('id', 'asc')
      .get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async createMessage(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'ticket_messages');
    const now = new Date().toISOString();
    const msgDoc = {
      ...data,
      id: nextId,
      created_at: now
    };
    await db.collection('ticket_messages').doc(String(nextId)).set(msgDoc);
    return msgDoc;
  }
};

// =========================================================================
// 12. USER BANNERS
// =========================================================================
export const userBanners = {
  async getAll(activeOnly: boolean = false): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('user_banners');
    if (activeOnly) {
      query = query.where('is_active', '==', true);
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async create(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'user_banners');
    const now = new Date().toISOString();
    const bannerDoc = {
      ...data,
      id: nextId,
      created_at: now,
      updated_at: now
    };
    await db.collection('user_banners').doc(String(nextId)).set(bannerDoc);
    return bannerDoc;
  },

  async delete(id: number | string): Promise<void> {
    const db = getFirestoreInstance();
    await db.collection('user_banners').doc(String(id)).delete();
  }
};

// =========================================================================
// 13. REFERRAL REWARDS
// =========================================================================
export const referralRewards = {
  async getByReferrer(referrerId: number | string): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('referral_rewards')
      .where('referrer_id', '==', parseInt(String(referrerId), 10))
      .get();
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async create(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'referral_rewards');
    const now = new Date().toISOString();
    const rewardDoc = {
      ...data,
      id: nextId,
      created_at: now
    };
    await db.collection('referral_rewards').doc(String(nextId)).set(rewardDoc);
    return rewardDoc;
  }
};

// =========================================================================
// 14. AUDIT LOGS & 15. FRAUD REJECTION AUDITS
// =========================================================================
export const audit = {
  async listLogs(limit: number = 50): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('audit_logs').orderBy('id', 'desc').limit(limit).get();
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async createLog(data: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'audit_logs');
    const now = new Date().toISOString();
    await db.collection('audit_logs').doc(String(nextId)).set({
      ...data,
      id: nextId,
      created_at: now
    });
  },

  async listFraudAudits(limit: number = 50): Promise<any[]> {
    const db = getFirestoreInstance();
    const snap = await db.collection('fraud_rejection_audits').orderBy('id', 'desc').limit(limit).get();
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async createFraudAudit(data: Record<string, any>): Promise<void> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'fraud_rejection_audits');
    const now = new Date().toISOString();
    await db.collection('fraud_rejection_audits').doc(String(nextId)).set({
      ...data,
      id: nextId,
      created_at: now
    });
  }
};

// =========================================================================
// 16. NOTIFICATIONS
// =========================================================================
export const notifications = {
  async list(userId?: number | string): Promise<any[]> {
    const db = getFirestoreInstance();
    let query: any = db.collection('notifications').orderBy('id', 'desc');
    if (userId) {
      query = query.where('user_id', '==', parseInt(String(userId), 10));
    }
    const snap = await query.get();
    const list: any[] = [];
    snap.forEach((doc: any) => {
      list.push({ id: parseInt(doc.id, 10) || doc.id, ...doc.data() });
    });
    return list;
  },

  async create(data: Record<string, any>): Promise<any> {
    const db = getFirestoreInstance();
    const nextId = await getNextNumericId(db, 'notifications');
    const now = new Date().toISOString();
    const docData = {
      ...data,
      id: nextId,
      created_at: now
    };
    await db.collection('notifications').doc(String(nextId)).set(docData);
    return docData;
  }
};

// =========================================================================
// 17. PASSWORD RESETS (LOCKED AS PER SYSTEM SECURITY DIRECTIVE)
// =========================================================================
export const passwordResets = {
  async isEnabled(): Promise<boolean> {
    return false; // Permanently locked as per architecture specification
  },

  async create(): Promise<never> {
    throw new Error('Password reset service is permanently disabled and locked.');
  },

  async verify(): Promise<never> {
    throw new Error('Password reset service is permanently disabled and locked.');
  }
};

/**
 * Main Exported Firestore Adapter Object
 */
export const firestoreAdapter = {
  systemSettings,
  users,
  adminSecurity,
  apiProviders,
  serviceCategories,
  services,
  orders,
  wallet,
  paymentRequests,
  support,
  userBanners,
  referralRewards,
  audit,
  notifications,
  passwordResets,
  
  async getStatus(): Promise<AdapterStats> {
    const db = getFirestoreInstance();
    try {
      const snap = await db.collection('system_settings').limit(1).get();
      return {
        backend: 'firestore',
        connected: !snap.empty,
        databaseId: db.databaseId || 'ai-studio-smmadminpanel-15668caa-c29c-4e63-887b-77d7708c98c4',
        collectionsCovered: 17
      };
    } catch (err: any) {
      console.warn('[FIRESTORE ADAPTER STATUS WARNING]:', err?.message || err);
      return {
        backend: 'firestore',
        connected: false,
        databaseId: db.databaseId || 'ai-studio-smmadminpanel-15668caa-c29c-4e63-887b-77d7708c98c4',
        collectionsCovered: 17
      };
    }
  }
};

export default firestoreAdapter;
