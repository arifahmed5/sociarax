import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import config from '../../firebase-applet-config.json';

let adminApp: App | null = null;

export function getFirebaseAdmin(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0]!;
    } else {
      adminApp = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || config.projectId,
      });
    }
  }
  return adminApp;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdmin();
  return await getAuth(app).verifyIdToken(idToken);
}

