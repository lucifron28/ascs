'use server';

import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';

// Default Clearance Requirements
const DEFAULT_REQUIREMENTS = [
  { id: 'librarian', role: 'librarian', label: 'Librarian Clearance', displayOrder: 1, isActive: true },
  { id: 'osa_coordinator', role: 'osa_coordinator', label: 'OSA Coordinator Clearance', displayOrder: 2, isActive: true },
  { id: 'guidance_counselor', role: 'guidance_counselor', label: 'Guidance Counselor Clearance', displayOrder: 3, isActive: true },
  { id: 'area_chair', role: 'area_chair', label: 'Area Chair Clearance', displayOrder: 4, isActive: true },
  { id: 'adviser', role: 'adviser', label: 'Adviser Clearance', displayOrder: 5, isActive: true }
];


// Demo Users Configuration
const DEMO_USERS = [
  { uid: 'demo-student-uid', email: 'student@pkm.edu.ph', role: 'student', fullName: 'Juan Dela Cruz', studentNumber: 'STUD-2026-0001' },
  { uid: 'demo-admin-uid', email: 'admin@pkm.edu.ph', role: 'admin', fullName: 'System Administrator' },
  { uid: 'demo-librarian-uid', email: 'librarian@pkm.edu.ph', role: 'librarian', fullName: 'Maria Clara (Librarian)' },
  { uid: 'demo-accountant-uid', email: 'accountant@pkm.edu.ph', role: 'accountant', fullName: 'Crispin Basilio (Accountant)' },
  { uid: 'demo-osa-uid', email: 'osa@pkm.edu.ph', role: 'osa_coordinator', fullName: 'Simoun Ibarra (OSA)' },
  { uid: 'demo-guidance-uid', email: 'guidance@pkm.edu.ph', role: 'guidance_counselor', fullName: 'Fili Burgos (Guidance)' },
  { uid: 'demo-chair-uid', email: 'chair@pkm.edu.ph', role: 'area_chair', fullName: 'Tasio Pilosopo (Area Chair)' },
  { uid: 'demo-adviser-uid', email: 'adviser@pkm.edu.ph', role: 'adviser', fullName: 'Salvi Padre (Adviser)' },
  { uid: 'demo-dean-uid', email: 'dean@pkm.edu.ph', role: 'dean', fullName: 'Damaso Padre (Dean)' }
];

export async function seedDatabaseAction() {
  // Only allow running in development/emulator environments to prevent production pollution
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== 'true') {
    return { success: false, error: 'Seeding is restricted to development emulator mode.' };
  }

  try {
    const firestore = getAdminFirestore();
    const auth = getAdminAuth();

    // 1. Seed Clearance Requirements (5 default non-accountant signatories)
    const reqCol = firestore.collection('clearanceRequirements');
    // Delete obsolete Accountant requirement doc if present in emulator/demo DB
    await reqCol.doc('accountant').delete().catch(() => {});

    for (const req of DEFAULT_REQUIREMENTS) {
      await reqCol.doc(req.id).set({
        ...req,
        assignedSignatoryId: null,
        assignedSignatoryName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }


    // 3. Seed Demo Users & Authentication accounts
    const usersCol = firestore.collection('users');
    const publicCol = firestore.collection('publicUsers');
    const studentsCol = firestore.collection('students');

    for (const user of DEMO_USERS) {
      // Create user in Auth Emulator if it does not exist
      let authUid = user.uid;
      try {
        await auth.createUser({
          uid: user.uid,
          email: user.email,
          password: 'password123',
          displayName: user.fullName,
        });
        authUid = user.uid;
      } catch (authErr: unknown) {
        const err = authErr as { code?: string; message?: string };
        if (err.code === 'auth/email-already-exists') {
          const existingUser = await auth.getUserByEmail(user.email);
          authUid = existingUser.uid;
        } else {
          const msg = err.message || '';
          if (!msg.includes('already exists') && !msg.includes('uid-already-exists')) {
            console.warn(`Auth seed warning for ${user.email}:`, msg);
          }
        }
      }

      // Keep repeated demo seeding deterministic even when an account already
      // exists with an old password or a different UID.
      await auth.updateUser(authUid, {
        email: user.email,
        password: 'password123',
        emailVerified: true,
      });
      await auth.setCustomUserClaims(authUid, { role: user.role });

      // Create users/{userId} document
      await usersCol.doc(authUid).set({
        uid: authUid,
        email: user.email,
        username: user.email.split('@')[0],
        fullName: user.fullName,
        role: user.role,
        accountStatus: 'active',
        mustChangePassword: false,
        contactNumber: '09123456789',
        createdAt: new Date(),
        updatedAt: new Date(),
        deactivatedAt: null
      });

      // Create publicUsers/{userId} document
      await publicCol.doc(authUid).set({
        fullName: user.fullName,
        role: user.role
      });

      // If user is a student, create student document
      if (user.role === 'student') {
        await studentsCol.doc(authUid).set({
          uid: authUid,
          studentNumber: user.studentNumber || 'STUD-2026-0001',
          fullName: user.fullName,
          program: 'BSIT',
          yearLevel: '4th Year',
          section: 'A',
          email: user.email,
          contactNumber: '09123456789',
          accountStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return { success: true, message: 'Database seeded successfully with requirements and demo accounts.' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database seeding error';
    console.error('Seed database error:', error);
    return { success: false, error: message };
  }
}
