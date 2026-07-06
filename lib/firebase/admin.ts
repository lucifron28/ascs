import 'server-only';
import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const isEmulator = 
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' || 
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST || 
  !!process.env.FIRESTORE_EMULATOR_HOST;

const isDummyKey = !privateKey || privateKey.includes('...') || privateKey.includes('YOUR_PRIVATE_KEY');
const hasCredentials = !!(projectId && clientEmail && privateKey) && !isDummyKey;

let adminApp: any = null;

if (getApps().length === 0) {
  if (isEmulator) {
    adminApp = initializeApp({
      projectId: projectId || 'ascs11',
    });
  } else if (hasCredentials && privateKey) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
} else {
  adminApp = getApp();
}

const adminAuth: Auth = adminApp ? getAuth(adminApp) : null as any;
const adminDb: Firestore = adminApp ? getFirestore(adminApp) : null as any;

// Helper functions for backward compatibility
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth not initialized. Check credentials.');
  }
  return adminAuth;
}

export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore not initialized. Check credentials.');
  }
  return adminDb;
}

export { adminApp, adminAuth, adminDb };
