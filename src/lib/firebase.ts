/// <reference types="vite/client" />
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

// Ensure config object is properly extracted regardless of bundling mode
const config = (rawConfig as any)?.default || rawConfig;

export const firebaseConfig = {
  apiKey: config.apiKey as string,
  authDomain: config.authDomain as string,
  projectId: config.projectId as string,
  storageBucket: config.storageBucket as string,
  messagingSenderId: config.messagingSenderId as string,
  appId: config.appId as string
};

function initializeFirebaseApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    const existing = existingApps[0];
    if (existing.options?.apiKey === firebaseConfig.apiKey) {
      return existing;
    }
    try {
      deleteApp(existing);
    } catch {
      // Continue to fresh initialization
    }
  }
  return initializeApp(firebaseConfig);
}

export const app = initializeFirebaseApp();
export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });


