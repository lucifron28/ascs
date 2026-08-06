'use server';

import { getAdminFirestore } from '@/lib/firebase/admin';
import { verifySessionCookie } from '@/lib/auth/session';

// 1. Fetch User-Scoped Notifications
export async function fetchUserNotificationsAction() {
  try {
    const claims = await verifySessionCookie();
    const recipientId = claims.uid;

    const firestore = getAdminFirestore();
    const notifsSnap = await firestore
      .collection('notifications')
      .where('recipientId', '==', recipientId)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const notifications = notifsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        recipientId: data.recipientId,
        type: data.type || 'info',
        message: data.message || '',
        relatedApplicationId: data.relatedApplicationId || null,
        isRead: data.isRead ?? false,
        createdAt: data.createdAt
          ? typeof data.createdAt === 'string'
            ? data.createdAt
            : data.createdAt.toDate?.()?.toISOString?.() || new Date().toISOString()
          : new Date().toISOString(),
      };
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return { success: true, notifications, unreadCount };
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    return { success: false, error: error.message };
  }
}

// 2. Mark Single Notification as Read
export async function markNotificationAsReadAction(data: { notificationId: string }) {
  try {
    const claims = await verifySessionCookie();
    const recipientId = claims.uid;

    const firestore = getAdminFirestore();
    const notifRef = firestore.collection('notifications').doc(data.notificationId);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      throw new Error('Notification not found.');
    }

    if (notifSnap.data()?.recipientId !== recipientId) {
      throw new Error('Unauthorized: Cannot modify notification for another user.');
    }

    await notifRef.update({
      isRead: true,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    return { success: false, error: error.message };
  }
}

// 3. Mark All Notifications as Read for Recipient
export async function markAllNotificationsAsReadAction() {
  try {
    const claims = await verifySessionCookie();
    const recipientId = claims.uid;

    const firestore = getAdminFirestore();
    const unreadSnap = await firestore
      .collection('notifications')
      .where('recipientId', '==', recipientId)
      .where('isRead', '==', false)
      .get();

    if (!unreadSnap.empty) {
      const batch = firestore.batch();
      unreadSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });
      await batch.commit();
    }

    return { success: true };
  } catch (error: any) {
    console.error('Mark all notifications read error:', error);
    return { success: false, error: error.message };
  }
}
