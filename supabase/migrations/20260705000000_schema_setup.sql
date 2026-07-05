-- CREATE SCHEMA SETUP MIGRATION
-- Compatible with PostgreSQL on Cloud SQL / Firebase SQL Connect
-- Uses text-based IDs matching Firebase Auth UIDs

-- Create custom types and enums
CREATE TYPE public.user_role AS ENUM (
  'student',
  'librarian',
  'accountant',
  'osa_coordinator',
  'guidance_counselor',
  'area_chair',
  'adviser',
  'dean',
  'admin'
);

CREATE TYPE public.clearance_status AS ENUM (
  'pending',
  'approved',
  'not_approved'
);

CREATE TYPE public.financial_status AS ENUM (
  'paid',
  'unpaid'
);

CREATE TYPE public.account_status AS ENUM (
  'active',
  'inactive',
  'deactivated'
);

-- Sequence for readable application numbers
CREATE SEQUENCE public.application_no_seq;

-- 1. PROFILES TABLE (Linked with Firebase Auth UIDs)
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'student',
  account_status public.account_status NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT true,
  contact_number text,
  last_password_changed_at timestamp with time zone,
  deactivated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. STUDENTS TABLE (Extended profile for students)
CREATE TABLE public.students (
  id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id_number text UNIQUE NOT NULL,
  program text NOT NULL,
  year_level integer NOT NULL,
  section text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. CLEARANCE REQUIREMENTS TABLE (Pre-defined signatory checklist items)
CREATE TABLE public.clearance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL,
  label text NOT NULL,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  assigned_signatory_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT req_role_check CHECK (role IN ('librarian', 'accountant', 'osa_coordinator', 'guidance_counselor', 'area_chair', 'adviser'))
);

-- 4. CLEARANCE APPLICATIONS TABLE
CREATE TABLE public.clearance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  semester text NOT NULL,
  purpose text NOT NULL,
  overall_status public.clearance_status NOT NULL DEFAULT 'pending',
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_term UNIQUE (student_id, academic_year, semester)
);

-- 5. CLEARANCE APPROVALS TABLE (Individual signatory signs)
CREATE TABLE public.clearance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.clearance_applications(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.clearance_requirements(id) ON DELETE CASCADE,
  signatory_role public.user_role NOT NULL,
  assigned_signatory_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.clearance_status NOT NULL DEFAULT 'pending',
  acted_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_app_requirement UNIQUE (application_id, requirement_id)
);

-- 6. REMARKS TABLE (Detailed comments for pending/not_approved actions)
CREATE TABLE public.remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.clearance_approvals(id) ON DELETE CASCADE,
  author_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. FINANCIAL RECORDS TABLE (Accounting status tracking)
CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.clearance_applications(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.financial_status NOT NULL DEFAULT 'unpaid',
  notes text,
  updated_by text REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamp with time zone,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  related_application_id uuid REFERENCES public.clearance_applications(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 9. ACTIVITY LOGS TABLE (Audit trail)
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 10. PUBLIC PROFILES VIEW
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, role FROM public.profiles;

-- 11. INDEXES OPTIMIZATIONS
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_students_student_id_number ON public.students(student_id_number);
CREATE INDEX idx_clearance_applications_student_id ON public.clearance_applications(student_id);
CREATE INDEX idx_clearance_approvals_application_id ON public.clearance_approvals(application_id);
CREATE INDEX idx_clearance_approvals_signatory ON public.clearance_approvals(assigned_signatory_id, signatory_role);
CREATE INDEX idx_financial_records_student_id ON public.financial_records(student_id);
CREATE INDEX idx_notifications_recipient_is_read ON public.notifications(recipient_id, is_read);
CREATE INDEX idx_activity_logs_actor_id ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- 12. TRIGGERS & CONSISTENCY FUNCTIONS

-- Helper function to check if a user profile has the expected role
CREATE OR REPLACE FUNCTION public.check_user_role(user_id text, expected_role public.user_role)
RETURNS boolean AS $$
DECLARE
  v_role public.user_role;
BEGIN
  IF user_id IS NULL THEN
    RETURN true;
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = user_id;
  RETURN v_role = expected_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to validate assigned signatory role consistency on clearance_requirements
CREATE OR REPLACE FUNCTION public.trig_requirement_signatory_role_check()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_signatory_id IS NOT NULL THEN
    IF NOT public.check_user_role(NEW.assigned_signatory_id, NEW.role) THEN
      RAISE EXCEPTION 'Assigned signatory (id: %) does not have the expected role: %', 
        NEW.assigned_signatory_id, NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_requirement_signatory_role
BEFORE INSERT OR UPDATE ON public.clearance_requirements
FOR EACH ROW EXECUTE FUNCTION public.trig_requirement_signatory_role_check();

-- Trigger to validate assigned signatory role consistency on clearance_approvals
CREATE OR REPLACE FUNCTION public.trig_approval_signatory_role_check()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_signatory_id IS NOT NULL THEN
    IF NOT public.check_user_role(NEW.assigned_signatory_id, NEW.signatory_role) THEN
      RAISE EXCEPTION 'Assigned signatory (id: %) does not have the expected role: %', 
        NEW.assigned_signatory_id, NEW.signatory_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_approval_signatory_role
BEFORE INSERT OR UPDATE ON public.clearance_approvals
FOR EACH ROW EXECUTE FUNCTION public.trig_approval_signatory_role_check();

-- Trigger function to automatically compute the overall clearance_applications status
CREATE OR REPLACE FUNCTION public.trig_calculate_overall_clearance_status()
RETURNS trigger AS $$
DECLARE
  v_application_id uuid;
  v_total_approvals integer;
  v_approved_approvals integer;
  v_not_approved_approvals integer;
  v_financial_status public.financial_status;
  v_financial_verified timestamp with time zone;
  v_final_status public.clearance_status;
BEGIN
  -- Determine application ID based on operation
  IF TG_OP = 'DELETE' THEN
    v_application_id := OLD.application_id;
  ELSE
    v_application_id := NEW.application_id;
  END IF;

  -- Read financial record status
  SELECT status, verified_at INTO v_financial_status, v_financial_verified
  FROM public.financial_records
  WHERE application_id = v_application_id;

  -- Default to unpaid if record doesn't exist
  IF v_financial_status IS NULL THEN
    v_financial_status := 'unpaid';
  END IF;

  -- Count approval records status
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status = 'approved' THEN 1 END),
    COUNT(CASE WHEN status = 'not_approved' THEN 1 END)
  INTO 
    v_total_approvals,
    v_approved_approvals,
    v_not_approved_approvals
  FROM public.clearance_approvals
  WHERE application_id = v_application_id;

  -- Decision Matrix:
  -- 1. If any signatory approval is 'not_approved', the overall status is 'not_approved'
  -- 2. If all required approvals are 'approved' AND financial record is 'paid', overall status is 'approved'
  -- 3. If all required approvals are 'approved' but financial record is 'unpaid' (and verified), overall status is 'not_approved'
  -- 4. Otherwise, overall status remains 'pending'
  IF v_not_approved_approvals > 0 THEN
    v_final_status := 'not_approved';
  ELSIF v_approved_approvals = v_total_approvals AND v_total_approvals > 0 THEN
    IF v_financial_status = 'paid' THEN
      v_final_status := 'approved';
    ELSIF v_financial_status = 'unpaid' AND v_financial_verified IS NOT NULL THEN
      v_final_status := 'not_approved';
    ELSE
      v_final_status := 'pending';
    END IF;
  ELSE
    v_final_status := 'pending';
  END IF;

  -- Update clearance application status
  UPDATE public.clearance_applications
  SET overall_status = v_final_status,
      updated_at = now()
  WHERE id = v_application_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach status trigger to approvals updates
CREATE TRIGGER calculate_overall_status_on_approval
AFTER INSERT OR UPDATE OR DELETE ON public.clearance_approvals
FOR EACH ROW EXECUTE FUNCTION public.trig_calculate_overall_clearance_status();

-- Helper function to perform calculate status trigger logic using application ID
CREATE OR REPLACE FUNCTION public.trig_calculate_overall_clearance_status_wrapper(p_app_id uuid)
RETURNS void AS $$
DECLARE
  v_total_approvals integer;
  v_approved_approvals integer;
  v_not_approved_approvals integer;
  v_financial_status public.financial_status;
  v_financial_verified timestamp with time zone;
  v_final_status public.clearance_status;
BEGIN
  SELECT status, verified_at INTO v_financial_status, v_financial_verified
  FROM public.financial_records
  WHERE application_id = p_app_id;

  IF v_financial_status IS NULL THEN
    v_financial_status := 'unpaid';
  END IF;

  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status = 'approved' THEN 1 END),
    COUNT(CASE WHEN status = 'not_approved' THEN 1 END)
  INTO 
    v_total_approvals,
    v_approved_approvals,
    v_not_approved_approvals
  FROM public.clearance_approvals
  WHERE application_id = p_app_id;

  IF v_not_approved_approvals > 0 THEN
    v_final_status := 'not_approved';
  ELSIF v_approved_approvals = v_total_approvals AND v_total_approvals > 0 THEN
    IF v_financial_status = 'paid' THEN
      v_final_status := 'approved';
    ELSIF v_financial_status = 'unpaid' AND v_financial_verified IS NOT NULL THEN
      v_final_status := 'not_approved';
    ELSE
      v_final_status := 'pending';
    END IF;
  ELSE
    v_final_status := 'pending';
  END IF;

  UPDATE public.clearance_applications
  SET overall_status = v_final_status,
      updated_at = now()
  WHERE id = p_app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to calculate overall status on finance updates
CREATE OR REPLACE FUNCTION public.trig_calculate_overall_status_on_finance_fn()
RETURNS trigger AS $$
BEGIN
  PERFORM public.trig_calculate_overall_clearance_status_wrapper(NEW.application_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_overall_status_on_finance
AFTER INSERT OR UPDATE ON public.financial_records
FOR EACH ROW EXECUTE FUNCTION public.trig_calculate_overall_status_on_finance_fn();

-- Trigger to automatically update updated_at fields
CREATE OR REPLACE FUNCTION public.trig_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trig_set_updated_at();
CREATE TRIGGER set_updated_at_clearance_applications BEFORE UPDATE ON public.clearance_applications FOR EACH ROW EXECUTE FUNCTION public.trig_set_updated_at();
CREATE TRIGGER set_updated_at_clearance_approvals BEFORE UPDATE ON public.clearance_approvals FOR EACH ROW EXECUTE FUNCTION public.trig_set_updated_at();
CREATE TRIGGER set_updated_at_financial_records BEFORE UPDATE ON public.financial_records FOR EACH ROW EXECUTE FUNCTION public.trig_set_updated_at();

-- 13. TRANSACTION STORED PROCEDURES / FUNCTIONS

-- Submit Clearance Application Transaction
CREATE OR REPLACE FUNCTION public.submit_clearance_application(
  p_student_id text,
  p_academic_year text,
  p_semester text,
  p_purpose text
)
RETURNS uuid AS $$
DECLARE
  v_student_exists boolean;
  v_has_active_app boolean;
  v_app_id uuid;
  v_app_seq bigint;
  v_app_number text;
BEGIN
  -- Verify student role
  SELECT EXISTS(
    SELECT 1 FROM public.students WHERE id = p_student_id
  ) INTO v_student_exists;

  IF NOT v_student_exists THEN
    RAISE EXCEPTION 'User (id: %) is not registered as a student', p_student_id;
  END IF;

  -- Verify term uniqueness
  SELECT EXISTS(
    SELECT 1 FROM public.clearance_applications
    WHERE student_id = p_student_id 
      AND academic_year = p_academic_year 
      AND semester = p_semester
  ) INTO v_has_active_app;

  IF v_has_active_app THEN
    RAISE EXCEPTION 'Student has already submitted a clearance application for % %', p_academic_year, p_semester;
  END IF;

  -- Generate application number (CLR-YYYY-000001)
  v_app_seq := nextval('public.application_no_seq');
  v_app_number := 'CLR-' || to_char(now(), 'YYYY') || '-' || lpad(v_app_seq::text, 6, '0');

  -- Insert Application Header
  INSERT INTO public.clearance_applications (
    application_number, student_id, academic_year, semester, purpose, overall_status
  ) VALUES (
    v_app_number, p_student_id, p_academic_year, p_semester, p_purpose, 'pending'
  ) RETURNING id INTO v_app_id;

  -- Insert Clearance Approvals based on active requirements
  INSERT INTO public.clearance_approvals (
    application_id, requirement_id, signatory_role, assigned_signatory_id, status
  )
  SELECT 
    v_app_id, 
    id, 
    role, 
    assigned_signatory_id,
    'pending'
  FROM public.clearance_requirements
  WHERE is_active = true;

  -- Insert Financial Record default unpaid state
  INSERT INTO public.financial_records (
    application_id, student_id, status
  ) VALUES (
    v_app_id, p_student_id, 'unpaid'
  );

  -- Log Activity
  INSERT INTO public.activity_logs (
    actor_id, action, entity_type, entity_id
  ) VALUES (
    p_student_id, 'submitted_application', 'clearance_application', v_app_id
  );

  -- Send Notification to Student
  INSERT INTO public.notifications (
    recipient_id, type, message, related_application_id
  ) VALUES (
    p_student_id, 'application_submitted', 
    'Your clearance application ' || v_app_number || ' has been successfully submitted.',
    v_app_id
  );

  RETURN v_app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Clearance Approval Transaction
CREATE OR REPLACE FUNCTION public.update_clearance_approval(
  p_approval_id uuid,
  p_signatory_id text,
  p_status public.clearance_status,
  p_remarks text
)
RETURNS void AS $$
DECLARE
  v_approval_exists boolean;
  v_app_id uuid;
  v_signatory_role public.user_role;
  v_assigned_signatory text;
  v_app_number text;
  v_student_id text;
BEGIN
  -- Verify approval record exists
  SELECT 
    true, application_id, signatory_role, assigned_signatory_id
  INTO 
    v_approval_exists, v_app_id, v_signatory_role, v_assigned_signatory
  FROM public.clearance_approvals
  WHERE id = p_approval_id;

  IF NOT v_approval_exists THEN
    RAISE EXCEPTION 'Clearance approval record % not found', p_approval_id;
  END IF;

  -- Enforce signatory assignment checks
  IF v_assigned_signatory IS NOT NULL AND v_assigned_signatory <> p_signatory_id THEN
    RAISE EXCEPTION 'Clearance approval % is assigned to signatory %, cannot be signed by %',
      p_approval_id, v_assigned_signatory, p_signatory_id;
  END IF;

  -- Verify actor has the correct role
  IF NOT public.check_user_role(p_signatory_id, v_signatory_role) THEN
    -- Admin is allowed to sign on behalf of signatories
    IF NOT public.check_user_role(p_signatory_id, 'admin') THEN
      RAISE EXCEPTION 'Actor % does not have the expected signatory role: %', p_signatory_id, v_signatory_role;
    END IF;
  END IF;

  -- Enforce remarks requirement for pending / not_approved actions
  IF p_status IN ('pending', 'not_approved') AND (p_remarks IS NULL OR trim(p_remarks) = '') THEN
    RAISE EXCEPTION 'Remarks are required when marking an approval as pending or not approved';
  END IF;

  -- Update approval status
  UPDATE public.clearance_approvals
  SET status = p_status,
      acted_at = now()
  WHERE id = p_approval_id;

  -- Add remark if content is provided
  IF p_remarks IS NOT NULL AND trim(p_remarks) <> '' THEN
    INSERT INTO public.remarks (
      approval_id, author_id, content
    ) VALUES (
      p_approval_id, p_signatory_id, p_remarks
    );
  END IF;

  -- Log action
  INSERT INTO public.activity_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_signatory_id, 'approval_action', 'clearance_approval', p_approval_id,
    jsonb_build_object('status', p_status, 'role', v_signatory_role)
  );

  -- Send notification to student
  SELECT student_id, application_number INTO v_student_id, v_app_number
  FROM public.clearance_applications
  WHERE id = v_app_id;

  INSERT INTO public.notifications (
    recipient_id, type, message, related_application_id
  ) VALUES (
    v_student_id, 'approval_updated',
    'Your approval for ' || v_signatory_role::text || ' has been marked as ' || p_status::text || ' in application ' || v_app_number,
    v_app_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. SEED REQUIREMENTS DATA (Default checklist categories)
INSERT INTO public.clearance_requirements (role, label, display_order, is_active) VALUES
  ('librarian', 'Librarian Clearance', 1, true),
  ('accountant', 'Accountant Clearance', 2, true),
  ('osa_coordinator', 'OSA Coordinator Clearance', 3, true),
  ('guidance_counselor', 'Guidance Counselor Clearance', 4, true),
  ('area_chair', 'Area Chair Clearance', 5, true),
  ('adviser', 'Adviser Clearance', 6, true);
