export type UserRole =
  | 'student'
  | 'librarian'
  | 'accountant'
  | 'osa_coordinator'
  | 'guidance_counselor'
  | 'area_chair'
  | 'adviser'
  | 'dean'
  | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  student_id_number: string;
  program: string;
  year_level: number;
  section: string;
  created_at: string;
}
