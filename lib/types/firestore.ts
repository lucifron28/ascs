import { UserRole } from './roles';
import { ClearanceStatus, FinancialStatus, AccountStatus } from './status';

export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
} | string | Date;

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  mustChangePassword: boolean;
  contactNumber: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  deactivatedAt: FirestoreTimestamp | null;
}

export interface PublicUserProfile {
  fullName: string;
  role: string;
}

export interface StudentProfile {
  uid: string;
  studentNumber: string;
  fullName: string;
  program: string;
  yearLevel: string;
  section: string;
  email: string;
  contactNumber: string;
  accountStatus: AccountStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface ClearanceRequirement {
  role: Exclude<UserRole, 'student' | 'admin' | 'dean'>;
  label: string;
  displayOrder: number;
  isActive: boolean;
  assignedSignatoryId: string | null;
  assignedSignatoryName: string | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface ClearanceApplication {
  applicationNumber: string; // CLR-YYYY-XXXXXX
  studentId: string; // Matches students/{studentId}
  studentUid: string;
  studentNumber: string;
  studentName: string;
  program: string;
  yearLevel: string;
  section: string;
  academicYear: string;
  semester: string;
  purpose: 'Enrollment' | 'Graduation' | 'Transfer' | 'Evaluation';
  overallStatus: ClearanceStatus;
  
  // Financial Accountability (Clearance-Level Only)
  financialStatus: FinancialStatus;
  financialVerifiedAt: FirestoreTimestamp | null;
  financialRemarks: string | null;
  financialUpdatedBy: string | null;
  financialUpdatedByName: string | null;

  // Counters & Flags
  adviserApproved: boolean;
  printableAvailable: boolean;
  pendingCount: number;
  approvedCount: number;
  notApprovedCount: number;
  submittedAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface ClearanceApproval {
  requirementId: string;
  signatoryRole: string;
  assignedSignatoryId: string | null;
  assignedSignatoryName: string | null;
  status: ClearanceStatus;
  remarksLatest: string | null;
  actedAt: FirestoreTimestamp | null;
  updatedAt: FirestoreTimestamp;
}

export interface ClearanceRemark {
  approvalId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: FirestoreTimestamp;
}

export interface Notification {
  recipientId: string;
  type: string;
  message: string;
  relatedApplicationId: string;
  isRead: boolean;
  createdAt: FirestoreTimestamp;
}

export interface ActivityLog {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: FirestoreTimestamp;
}

