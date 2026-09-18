import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import path from 'path';
import rawConfig from '../../firebase-applet-config.json';

const config = (rawConfig as any)?.default || rawConfig;

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getFirebaseAdmin(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0]!;
    } else {
      const projectId = config.projectId || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0306783571';
      let credentialsObj: any = null;

      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          credentialsObj = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        } catch {
          credentialsObj = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credentialsObj = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      }

      if (credentialsObj) {
        adminApp = initializeApp({
          credential: cert(credentialsObj),
          projectId,
        });
      } else {
        adminApp = initializeApp({
          projectId,
        });
      }
    }
  }
  return adminApp;
}

export function getFirestoreInstance(): Firestore {
  if (!firestoreDb) {
    const app = getFirebaseAdmin();
    const databaseId = config.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID || '(default)';
    firestoreDb = getFirestore(app, databaseId);
  }
  return firestoreDb;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdmin();
  return await getAuth(app).verifyIdToken(idToken);
}

