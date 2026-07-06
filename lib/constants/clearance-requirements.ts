import { UserRole } from '../types/roles';

export interface DefaultClearanceRequirement {
  role: Exclude<UserRole, 'student' | 'admin' | 'dean'>;
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
    role: 'accountant',
    label: 'Financial Accountability Monitoring',
    displayOrder: 2,
  },
  {
    role: 'osa_coordinator',
    label: 'Office of Student Affairs Clearance',
    displayOrder: 3,
  },
  {
    role: 'guidance_counselor',
    label: 'Guidance and Counseling Clearance',
    displayOrder: 4,
  },
  {
    role: 'area_chair',
    label: 'Academic Department Clearance',
    displayOrder: 5,
  },
  {
    role: 'adviser',
    label: 'Adviser Review',
    displayOrder: 6,
  },
];
