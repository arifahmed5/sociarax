import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import rawConfig from '../../firebase-applet-config.json';

const config = (rawConfig as any)?.default || rawConfig;

let adminApp: App | null = null;

export function getFirebaseAdmin(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0]!;
    } else {
      adminApp = initializeApp({
        projectId: config.projectId || process.env.FIREBASE_PROJECT_ID,
      });
    }
  }
  return adminApp;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdmin();
  return await getAuth(app).verifyIdToken(idToken);
}

