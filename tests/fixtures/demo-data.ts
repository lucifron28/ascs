import { UserRole } from '@/lib/types/roles';
import { ClearanceStatus, FinancialStatus, AccountStatus } from '@/lib/types/status';
import { getDemoAccountById } from '@/lib/demo/demo-accounts';
import type { AcademicProgramCode } from '@/lib/academic-programs';

export const DEMO_EMULATOR_PASSWORD = 'password123';

export interface DemoUserFixture {
  uid: string;
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  accountStatus: AccountStatus;
  mustChangePassword?: boolean;
  studentNumber?: string;
  program?: AcademicProgramCode;
  yearLevel?: string;
  section?: string;
}

export const DEMO_REQUIREMENTS_FIXTURE = [
  { id: 'librarian', role: 'librarian' as const, label: 'Librarian Clearance', displayOrder: 1, isActive: true },
  { id: 'osa_coordinator', role: 'osa_coordinator' as const, label: 'OSA Coordinator Clearance', displayOrder: 2, isActive: true },
  { id: 'guidance_counselor', role: 'guidance_counselor' as const, label: 'Guidance Counselor Clearance', displayOrder: 3, isActive: true },
  { id: 'area_chair', role: 'area_chair' as const, label: 'Area Chair Clearance', displayOrder: 4, isActive: true },
  { id: 'adviser', role: 'adviser' as const, label: 'Adviser Clearance', displayOrder: 5, isActive: true },
];

type DemoUserOverrides = Omit<Partial<DemoUserFixture>, 'uid' | 'email' | 'password' | 'role' | 'fullName'>;

function buildDemoUser(id: string, overrides: DemoUserOverrides = {}): DemoUserFixture {
  const account = getDemoAccountById(id);
  if (!account) throw new Error(`Unknown demo account definition: ${id}`);

  return {
    uid: account.uid,
    email: account.email,
    password: DEMO_EMULATOR_PASSWORD,
    role: account.role,
    fullName: account.fullName,
    accountStatus: 'active',
    ...overrides,
  };
}

export const DEMO_STAFF_FIXTURES: DemoUserFixture[] = [
  buildDemoUser('admin'),
  buildDemoUser('dean'),
  buildDemoUser('librarian'),
  buildDemoUser('accountant'),
  buildDemoUser('osa-coordinator'),
  buildDemoUser('guidance-counselor'),
  buildDemoUser('area-chair'),
  buildDemoUser('adviser'),
];

export const DEMO_STUDENT_FIXTURES: DemoUserFixture[] = [
  {
    ...buildDemoUser('student-a', {
      studentNumber: 'STUD-2026-0001',
      program: 'BSAIS',
      yearLevel: '4th Year',
      section: 'A',
    }),
  },
  {
    ...buildDemoUser('student-b', {
      studentNumber: 'STUD-2026-0002',
      program: 'BSMA',
      yearLevel: '3rd Year',
      section: 'B',
    }),
  },
  {
    ...buildDemoUser('student-c', {
      studentNumber: 'STUD-2026-0003',
      program: 'BEED',
      yearLevel: '4th Year',
      section: 'A',
    }),
  },
  {
    ...buildDemoUser('student-d', {
      studentNumber: 'STUD-2026-0004',
      program: 'CRIM',
      yearLevel: '2nd Year',
      section: 'B',
    }),
  },
  {
    ...buildDemoUser('student-e', {
      studentNumber: 'STUD-2026-0005',
      program: 'ENGLISH',
      yearLevel: '1st Year',
      section: 'A',
      mustChangePassword: true,
    }),
  },
  {
    ...buildDemoUser('student-f', {
      studentNumber: 'STUD-2026-0006',
      program: 'ACP',
      yearLevel: '4th Year',
      section: 'B',
      accountStatus: 'inactive',
    }),
  },
  {
    ...buildDemoUser('student-g', {
      studentNumber: 'STUD-2026-0007',
      program: 'FSM',
      yearLevel: '3rd Year',
      section: 'A',
      mustChangePassword: false,
    }),
  },
];

function studentProgram(id: string): AcademicProgramCode {
  const account = getDemoAccountById(id);
  const student = DEMO_STUDENT_FIXTURES.find((fixture) => fixture.uid === account?.uid);
  if (!student?.program) throw new Error(`Missing program for demo student: ${id}`);
  return student.program;
}

export interface DemoApplicationFixture {
  id: string;
  applicationNumber: string;
  studentUid: string;
  studentNumber: string;
  studentName: string;
  program: AcademicProgramCode;
  yearLevel: string;
  section: string;
  academicYear: string;
  semester: string;
  purpose: 'Graduation' | 'Enrollment' | 'Transfer' | 'Evaluation';
  overallStatus: ClearanceStatus;
  financialStatus: FinancialStatus;
  financialRemarks: string | null;
  adviserApproved: boolean;
  printableAvailable: boolean;
  pendingCount: number;
  approvedCount: number;
  notApprovedCount: number;
  approvals: Record<string, {
    status: ClearanceStatus;
    remarksLatest: string | null;
  }>;
}

export const DEMO_APPLICATION_FIXTURES: DemoApplicationFixture[] = [
  // Student A: Fully approved + paid -> overall approved, printable true
  {
    id: 'app-student-a',
    applicationNumber: 'CLR-2026-000001',
    studentUid: 'demo-student-a-uid',
    studentNumber: 'STUD-2026-0001',
    studentName: 'Student A (Approved)',
    program: studentProgram('student-a'),
    yearLevel: '4th Year',
    section: 'A',
    academicYear: '2026-2027',
    semester: '1st Semester',
    purpose: 'Graduation',
    overallStatus: 'approved',
    financialStatus: 'paid',
    financialRemarks: 'Fully paid tuition balance.',
    adviserApproved: true,
    printableAvailable: true,
    pendingCount: 0,
    approvedCount: 5,
    notApprovedCount: 0,
    approvals: {
      librarian: { status: 'approved', remarksLatest: null },
      osa_coordinator: { status: 'approved', remarksLatest: null },
      guidance_counselor: { status: 'approved', remarksLatest: null },
      area_chair: { status: 'approved', remarksLatest: null },
      adviser: { status: 'approved', remarksLatest: null },
    },
  },
  // Student B: 2 approved, 3 pending + paid -> overall pending, printable false
  {
    id: 'app-student-b',
    applicationNumber: 'CLR-2026-000002',
    studentUid: 'demo-student-b-uid',
    studentNumber: 'STUD-2026-0002',
    studentName: 'Student B (Pending)',
    program: studentProgram('student-b'),
    yearLevel: '3rd Year',
    section: 'B',
    academicYear: '2026-2027',
    semester: '1st Semester',
    purpose: 'Enrollment',
    overallStatus: 'pending',
    financialStatus: 'paid',
    financialRemarks: null,
    adviserApproved: false,
    printableAvailable: false,
    pendingCount: 3,
    approvedCount: 2,
    notApprovedCount: 0,
    approvals: {
      librarian: { status: 'approved', remarksLatest: null },
      osa_coordinator: { status: 'approved', remarksLatest: null },
      guidance_counselor: { status: 'pending', remarksLatest: null },
      area_chair: { status: 'pending', remarksLatest: null },
      adviser: { status: 'pending', remarksLatest: null },
    },
  },
  // Student C: 1 not_approved with remarks + paid -> overall not_approved, printable false
  {
    id: 'app-student-c',
    applicationNumber: 'CLR-2026-000003',
    studentUid: 'demo-student-c-uid',
    studentNumber: 'STUD-2026-0003',
    studentName: 'Student C (Not Approved)',
    program: studentProgram('student-c'),
    yearLevel: '4th Year',
    section: 'A',
    academicYear: '2026-2027',
    semester: '1st Semester',
    purpose: 'Graduation',
    overallStatus: 'not_approved',
    financialStatus: 'paid',
    financialRemarks: null,
    adviserApproved: false,
    printableAvailable: false,
    pendingCount: 3,
    approvedCount: 1,
    notApprovedCount: 1,
    approvals: {
      librarian: { status: 'not_approved', remarksLatest: 'Unreturned book: Operating System Concepts' },
      osa_coordinator: { status: 'approved', remarksLatest: null },
      guidance_counselor: { status: 'pending', remarksLatest: null },
      area_chair: { status: 'pending', remarksLatest: null },
      adviser: { status: 'pending', remarksLatest: null },
    },
  },
  // Student D: All 5 signatories approved + unpaid -> overall not_approved, printable false
  {
    id: 'app-student-d',
    applicationNumber: 'CLR-2026-000004',
    studentUid: 'demo-student-d-uid',
    studentNumber: 'STUD-2026-0004',
    studentName: 'Student D (Unpaid Hold)',
    program: studentProgram('student-d'),
    yearLevel: '2nd Year',
    section: 'B',
    academicYear: '2026-2027',
    semester: '1st Semester',
    purpose: 'Enrollment',
    overallStatus: 'not_approved',
    financialStatus: 'unpaid',
    financialRemarks: 'Unpaid tuition balance PHP 5,000.',
    adviserApproved: true,
    printableAvailable: false,
    pendingCount: 0,
    approvedCount: 5,
    notApprovedCount: 0,
    approvals: {
      librarian: { status: 'approved', remarksLatest: null },
      osa_coordinator: { status: 'approved', remarksLatest: null },
      guidance_counselor: { status: 'approved', remarksLatest: null },
      area_chair: { status: 'approved', remarksLatest: null },
      adviser: { status: 'approved', remarksLatest: null },
    },
  },
];
