import { UserRole } from '@/lib/types/roles';
import { ClearanceStatus, FinancialStatus, AccountStatus } from '@/lib/types/status';

export interface DemoUserFixture {
  uid: string;
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  accountStatus: AccountStatus;
  mustChangePassword?: boolean;
  studentNumber?: string;
  program?: string;
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

export const DEMO_STAFF_FIXTURES: DemoUserFixture[] = [
  {
    uid: 'demo-admin-uid',
    email: 'admin@example.test',
    password: 'password123',
    role: 'admin',
    fullName: 'System Administrator',
    accountStatus: 'active',
  },
  {
    uid: 'demo-dean-uid',
    email: 'dean@example.test',
    password: 'password123',
    role: 'dean',
    fullName: 'Academic Dean',
    accountStatus: 'active',
  },
  {
    uid: 'demo-librarian-uid',
    email: 'librarian@example.test',
    password: 'password123',
    role: 'librarian',
    fullName: 'Librarian Officer',
    accountStatus: 'active',
  },
  {
    uid: 'demo-accountant-uid',
    email: 'accountant@example.test',
    password: 'password123',
    role: 'accountant',
    fullName: 'Accountant Officer',
    accountStatus: 'active',
  },
  {
    uid: 'demo-osa-uid',
    email: 'osa@example.test',
    password: 'password123',
    role: 'osa_coordinator',
    fullName: 'OSA Coordinator',
    accountStatus: 'active',
  },
  {
    uid: 'demo-guidance-uid',
    email: 'guidance@example.test',
    password: 'password123',
    role: 'guidance_counselor',
    fullName: 'Guidance Counselor',
    accountStatus: 'active',
  },
  {
    uid: 'demo-chair-uid',
    email: 'chair@example.test',
    password: 'password123',
    role: 'area_chair',
    fullName: 'Area Chair',
    accountStatus: 'active',
  },
  {
    uid: 'demo-adviser-uid',
    email: 'adviser@example.test',
    password: 'password123',
    role: 'adviser',
    fullName: 'Class Adviser',
    accountStatus: 'active',
  },
];

export const DEMO_STUDENT_FIXTURES: DemoUserFixture[] = [
  {
    uid: 'demo-student-a-uid',
    email: 'student.a@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student A (Approved)',
    studentNumber: 'STUD-2026-0001',
    program: 'BSIT',
    yearLevel: '4th Year',
    section: 'A',
    accountStatus: 'active',
  },
  {
    uid: 'demo-student-b-uid',
    email: 'student.b@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student B (Pending)',
    studentNumber: 'STUD-2026-0002',
    program: 'BSCS',
    yearLevel: '3rd Year',
    section: 'B',
    accountStatus: 'active',
  },
  {
    uid: 'demo-student-c-uid',
    email: 'student.c@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student C (Not Approved)',
    studentNumber: 'STUD-2026-0003',
    program: 'BSIS',
    yearLevel: '4th Year',
    section: 'A',
    accountStatus: 'active',
  },
  {
    uid: 'demo-student-d-uid',
    email: 'student.d@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student D (Unpaid Hold)',
    studentNumber: 'STUD-2026-0004',
    program: 'BSIT',
    yearLevel: '2nd Year',
    section: 'B',
    accountStatus: 'active',
  },
  {
    uid: 'demo-student-e-uid',
    email: 'student.e@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student E (Temp Pass)',
    studentNumber: 'STUD-2026-0005',
    program: 'BSCS',
    yearLevel: '1st Year',
    section: 'A',
    accountStatus: 'active',
    mustChangePassword: true,
  },
  {
    uid: 'demo-student-f-uid',
    email: 'student.f@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student F (Inactive)',
    studentNumber: 'STUD-2026-0006',
    program: 'BSIT',
    yearLevel: '4th Year',
    section: 'B',
    accountStatus: 'inactive',
  },
  {
    uid: 'demo-student-g-uid',
    email: 'student.g@example.test',
    password: 'password123',
    role: 'student',
    fullName: 'Student G (Live Journey)',
    studentNumber: 'STUD-2026-0007',
    program: 'BSIT',
    yearLevel: '3rd Year',
    section: 'A',
    accountStatus: 'active',
    mustChangePassword: false,
  },
];

export interface DemoApplicationFixture {
  id: string;
  applicationNumber: string;
  studentUid: string;
  studentNumber: string;
  studentName: string;
  program: string;
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
    program: 'BSIT',
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
    program: 'BSCS',
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
    program: 'BSIS',
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
    program: 'BSIT',
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
