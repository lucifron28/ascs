import type { AcademicProgramCode } from '@/lib/academic-programs';
import type { UserRole } from '@/lib/types/roles';

export const DEMO_ACCOUNT_GROUPS = [
  'Students',
  'Clearance Signatories',
  'Financial / Oversight',
  'Administration',
] as const;

export type DemoAccountGroup = (typeof DEMO_ACCOUNT_GROUPS)[number];

/** Safe, reusable identity metadata. Emulator passwords intentionally do not live here. */
export interface DemoAccountDefinition {
  id: string;
  uid: string;
  email: string;
  label: string;
  fullName: string;
  role: UserRole;
  group: DemoAccountGroup;
  description: string;
  program?: AcademicProgramCode;
}

export const DEMO_ACCOUNT_DEFINITIONS: readonly DemoAccountDefinition[] = [
  {
    id: 'student-a',
    uid: 'demo-student-a-uid',
    email: 'student.a@example.test',
    label: 'Student A — Approved',
    fullName: 'Student A (Approved)',
    role: 'student',
    group: 'Students',
    program: 'BSAIS',
    description: 'Fully approved and financially paid. Demonstrates final status and printable record.',
  },
  {
    id: 'student-b',
    uid: 'demo-student-b-uid',
    email: 'student.b@example.test',
    label: 'Student B — Pending',
    fullName: 'Student B (Pending)',
    role: 'student',
    group: 'Students',
    program: 'BSMA',
    description: 'Demonstrates a partially completed clearance.',
  },
  {
    id: 'student-c',
    uid: 'demo-student-c-uid',
    email: 'student.c@example.test',
    label: 'Student C — Not Approved',
    fullName: 'Student C (Not Approved)',
    role: 'student',
    group: 'Students',
    program: 'BEED',
    description: 'Demonstrates a rejected requirement and visible remarks.',
  },
  {
    id: 'student-d',
    uid: 'demo-student-d-uid',
    email: 'student.d@example.test',
    label: 'Student D — Unpaid Hold',
    fullName: 'Student D (Unpaid Hold)',
    role: 'student',
    group: 'Students',
    program: 'CRIM',
    description: 'Demonstrates how financial accountability can block final clearance.',
  },
  {
    id: 'student-e',
    uid: 'demo-student-e-uid',
    email: 'student.e@example.test',
    label: 'Student E — Temporary Password',
    fullName: 'Student E (Temp Pass)',
    role: 'student',
    group: 'Students',
    program: 'ENGLISH',
    description: 'Demonstrates mandatory password-change enforcement.',
  },
  {
    id: 'student-f',
    uid: 'demo-student-f-uid',
    email: 'student.f@example.test',
    label: 'Student F — Inactive',
    fullName: 'Student F (Inactive)',
    role: 'student',
    group: 'Students',
    program: 'ACP',
    description: 'Demonstrates blocked account access.',
  },
  {
    id: 'student-g',
    uid: 'demo-student-g-uid',
    email: 'student.g@example.test',
    label: 'Student G — Live Journey',
    fullName: 'Student G (Live Journey)',
    role: 'student',
    group: 'Students',
    program: 'FSM',
    description: 'Used for the complete end-to-end defense workflow from clearance submission through final approval.',
  },
  {
    id: 'librarian',
    uid: 'demo-librarian-uid',
    email: 'librarian@example.test',
    label: 'Librarian',
    fullName: 'Librarian Officer',
    role: 'librarian',
    group: 'Clearance Signatories',
    description: 'Reviews the Library clearance requirement.',
  },
  {
    id: 'osa-coordinator',
    uid: 'demo-osa-uid',
    email: 'osa@example.test',
    label: 'OSA Coordinator',
    fullName: 'OSA Coordinator',
    role: 'osa_coordinator',
    group: 'Clearance Signatories',
    description: 'Reviews the Office of Student Affairs clearance requirement.',
  },
  {
    id: 'guidance-counselor',
    uid: 'demo-guidance-uid',
    email: 'guidance@example.test',
    label: 'Guidance Counselor',
    fullName: 'Guidance Counselor',
    role: 'guidance_counselor',
    group: 'Clearance Signatories',
    description: 'Reviews the Guidance clearance requirement.',
  },
  {
    id: 'area-chair',
    uid: 'demo-chair-uid',
    email: 'chair@example.test',
    label: 'Area Chair',
    fullName: 'Area Chair',
    role: 'area_chair',
    group: 'Clearance Signatories',
    description: 'Reviews the Academic Department clearance requirement.',
  },
  {
    id: 'accountant',
    uid: 'demo-accountant-uid',
    email: 'accountant@example.test',
    label: 'Accountant',
    fullName: 'Accountant Officer',
    role: 'accountant',
    group: 'Financial / Oversight',
    description: 'Updates the Accountant financial gate status.',
  },
  {
    id: 'dean',
    uid: 'demo-dean-uid',
    email: 'dean@example.test',
    label: 'Dean',
    fullName: 'Dean of Business Program',
    role: 'dean',
    group: 'Clearance Signatories',
    description: 'Reviews and approves the final Dean Clearance requirement.',
  },
  {
    id: 'admin',
    uid: 'demo-admin-uid',
    email: 'admin@example.test',
    label: 'System Administrator',
    fullName: 'System Administrator',
    role: 'admin',
    group: 'Administration',
    description: 'Manages users, requirement assignments, activity logs, and institution-wide reporting.',
  },
] as const satisfies readonly DemoAccountDefinition[];

export function shouldShowDemoAccountPicker(demoMode: boolean, useFirebaseEmulator: boolean): boolean {
  return demoMode && useFirebaseEmulator;
}

export function getDemoAccountById(id: string): DemoAccountDefinition | undefined {
  return DEMO_ACCOUNT_DEFINITIONS.find((account) => account.id === id);
}

export function getDemoAccountByEmail(email: string): DemoAccountDefinition | undefined {
  return DEMO_ACCOUNT_DEFINITIONS.find((account) => account.email === email);
}
