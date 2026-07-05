import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  // Prevent build-time crashes when credentials are not loaded
  if (!projectId || !clientEmail || !privateKey) {
    return;
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminAuth() {
  initAdmin();
  try {
    return getAuth();
  } catch (error) {
    console.error('Failed to get Firebase Admin Auth. Ensure Firebase Admin is initialized.', error);
    throw error;
  }
}
