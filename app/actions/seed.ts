'use server';

import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';

// Default Clearance Requirements
const DEFAULT_REQUIREMENTS = [
  { id: 'librarian', role: 'librarian', label: 'Librarian Clearance', displayOrder: 1, isActive: true },
  { id: 'accountant', role: 'accountant', label: 'Accountant Clearance', displayOrder: 2, isActive: true },
  { id: 'osa_coordinator', role: 'osa_coordinator', label: 'OSA Coordinator Clearance', displayOrder: 3, isActive: true },
  { id: 'guidance_counselor', role: 'guidance_counselor', label: 'Guidance Counselor Clearance', displayOrder: 4, isActive: true },
  { id: 'area_chair', role: 'area_chair', label: 'Area Chair Clearance', displayOrder: 5, isActive: true },
  { id: 'adviser', role: 'adviser', label: 'Adviser Clearance', displayOrder: 6, isActive: true }
];

// Default Transaction Categories
const DEFAULT_CATEGORIES = [
  // Income categories
  { id: 'membership_dues', name: 'Membership Dues', direction: 'income', isClearanceRelevant: true, defaultAmount: 150, isActive: true },
  { id: 'monthly_contribution', name: 'Monthly Contribution', direction: 'income', isClearanceRelevant: false, defaultAmount: 50, isActive: true },
  { id: 'donation', name: 'Donation', direction: 'income', isClearanceRelevant: false, defaultAmount: 0, isActive: true },
  { id: 'merchandise', name: 'T-shirt / Merchandise', direction: 'income', isClearanceRelevant: true, defaultAmount: 300, isActive: true },
  // Expense categories
  { id: 'supplies', name: 'Supplies', direction: 'expense', isClearanceRelevant: false, defaultAmount: 0, isActive: true },
  { id: 'transportation', name: 'Transportation', direction: 'expense', isClearanceRelevant: false, defaultAmount: 0, isActive: true },
  { id: 'meals', name: 'Meals', direction: 'expense', isClearanceRelevant: false, defaultAmount: 0, isActive: true }
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

    // 1. Seed Clearance Requirements
    const reqCol = firestore.collection('clearanceRequirements');
    for (const req of DEFAULT_REQUIREMENTS) {
      await reqCol.doc(req.id).set({
        ...req,
        assignedSignatoryId: null,
        assignedSignatoryName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 2. Seed Transaction Categories
    const catCol = firestore.collection('transactionCategories');
    for (const cat of DEFAULT_CATEGORIES) {
      await catCol.doc(cat.id).set({
        ...cat,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 3. Seed Demo Users & Authentication accounts
    const usersCol = firestore.collection('users');
    const publicCol = firestore.collection('publicUsers');
    const studentsCol = firestore.collection('students');

    for (const user of DEMO_USERS) {
      // Create user in Auth Emulator if it does not exist
      try {
        await auth.createUser({
          uid: user.uid,
          email: user.email,
          password: 'password123',
          emailVerified: true
        });
      } catch (authErr: any) {
        // If user already exists, ignore and continue
        if (authErr.code !== 'auth/uid-already-exists' && authErr.code !== 'auth/email-already-exists') {
          console.warn(`Auth user creation failed for ${user.email}:`, authErr.message);
        }
      }

      // Set custom user claims for role-based middleware routing
      await auth.setCustomUserClaims(user.uid, { role: user.role });

      // Create users/{userId} document
      await usersCol.doc(user.uid).set({
        uid: user.uid,
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
      await publicCol.doc(user.uid).set({
        fullName: user.fullName,
        role: user.role
      });

      // If user is a student, create student document
      if (user.role === 'student') {
        await studentsCol.doc(user.uid).set({
          uid: user.uid,
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

    return { success: true, message: 'Database seeded successfully with requirements, transaction categories, and demo accounts.' };
  } catch (error: any) {
    console.error('Database seeding error:', error);
    return { success: false, error: error.message };
  }
}
