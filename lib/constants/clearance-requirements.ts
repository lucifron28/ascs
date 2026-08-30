import { UserRole } from '../types/roles';

export interface DefaultClearanceRequirement {
  role: Exclude<UserRole, 'student' | 'admin' | 'accountant' | 'adviser'>;
  label: string;
  displayOrder: number;
}

export const DEFAULT_CLEARANCE_REQUIREMENTS: DefaultClearanceRequirement[] = [
  {
    role: 'librarian',
    label: 'Librarian Clearance',
    displayOrder: 1,
  },
  {
    role: 'osa_coordinator',
    label: 'OSA Coordinator Clearance',
    displayOrder: 3,
  },
  {
    role: 'guidance_counselor',
    label: 'Guidance Counselor Clearance',
    displayOrder: 4,
  },
  {
    role: 'area_chair',
    label: 'Area Chair Clearance',
    displayOrder: 5,
  },
  {
    role: 'dean',
    label: 'Dean Clearance',
    displayOrder: 6,
  },
];
