import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

const ADMIN_EMAILS_DEFAULT = ['admin@louzlabs.com.br'];

export function getAdminEmails(): string[] {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS;
  if (!envEmails) return ADMIN_EMAILS_DEFAULT;
  return envEmails
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isUserAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth) {
    throw new Error('Firebase não configurado. Adicione as chaves no arquivo .env.');
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export { auth };
