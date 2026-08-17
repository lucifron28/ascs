import { UserRole } from '../types/roles';

export interface DefaultClearanceRequirement {
  role: Exclude<UserRole, 'student' | 'admin' | 'accountant' | 'adviser'>;
  label: string;
  displayOrder: number;
}

export const DEFAULT_CLEARANCE_REQUIREMENTS: DefaultClearanceRequirement[] = [
  {
    role: 'librarian',
    label: 'Library Clearance',
    displayOrder: 1,
  },
  {
    role: 'osa_coordinator',
    label: 'Office of Student Affairs Clearance',
    displayOrder: 2,
  },
  {
    role: 'guidance_counselor',
    label: 'Guidance and Counseling Clearance',
    displayOrder: 3,
  },
  {
    role: 'area_chair',
    label: 'Academic Department Clearance',
    displayOrder: 4,
  },
  {
    role: 'dean',
    label: 'Dean Clearance',
    displayOrder: 5,
  },
];
