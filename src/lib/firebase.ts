/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || config.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || config.appId
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });


