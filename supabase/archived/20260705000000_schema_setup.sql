-- OBSOLETE WARNING: These files were created during the previous Supabase planning phase and are no longer the active backend direction.
-- Firebase Auth and Firebase SQL Connect is the new active backend direction.

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

-- Create sequences
CREATE SEQUENCE public.application_no_seq START WITH 1 INCREMENT BY 1;

-- Create tables
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role public.user_role DEFAULT 'student'::public.user_role NOT NULL,
  account_status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
  must_change_password boolean DEFAULT true NOT NULL,
  contact_number text,
  last_password_changed_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id_number text UNIQUE NOT NULL,
  program text NOT NULL,
  year_level integer NOT NULL,
  section text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.clearance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL,
  label text NOT NULL,
  display_order integer NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  assigned_signatory_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.clearance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  academic_year text NOT NULL,
  semester text NOT NULL,
  purpose text NOT NULL,
  overall_status public.clearance_status DEFAULT 'pending'::public.clearance_status NOT NULL,
  submitted_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_student_semester UNIQUE (student_id, academic_year, semester)
);

CREATE TABLE public.clearance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.clearance_applications(id) ON DELETE CASCADE NOT NULL,
  requirement_id uuid REFERENCES public.clearance_requirements(id) ON DELETE CASCADE NOT NULL,
  signatory_role public.user_role NOT NULL,
  assigned_signatory_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.clearance_status DEFAULT 'pending'::public.clearance_status NOT NULL,
  acted_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_app_requirement UNIQUE (application_id, requirement_id)
);

CREATE TABLE public.remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES public.clearance_approvals(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.clearance_applications(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  status public.financial_status DEFAULT 'unpaid'::public.financial_status NOT NULL,
  notes text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  recorded_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_app_financial UNIQUE (application_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  related_application_id uuid REFERENCES public.clearance_applications(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS) on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create views (safe from exposing sensitive info, accessible only to authenticated users)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, role
FROM public.profiles;

-- Revoke default public execution privileges on view
REVOKE ALL ON public.public_profiles FROM public;
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO service_role;

-- Create Security Definer Helper Functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'accountant'::public.user_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_student_owner(app_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clearance_applications
    WHERE id = app_id AND student_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_adviser_approval(app_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clearance_approvals
    WHERE application_id = app_id 
      AND signatory_role = 'adviser'::public.user_role
      AND status = 'approved'::public.clearance_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_application(app_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Admin can access everything
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role = 'admin'::public.user_role THEN
    RETURN true;
  END IF;

  -- Student owner can access their own
  IF EXISTS (
    SELECT 1 FROM public.clearance_applications
    WHERE id = app_id AND student_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- Dean can access only if Adviser has approved
  IF v_role = 'dean'::public.user_role THEN
    RETURN public.has_adviser_approval(app_id);
  END IF;

  -- Signatories can access if there is an approval row for this application matching their role
  -- and (if assigned_signatory_id is defined) it matches the user ID
  RETURN EXISTS (
    SELECT 1 FROM public.clearance_approvals
    WHERE application_id = app_id
      AND signatory_role = v_role
      AND (assigned_signatory_id IS NULL OR assigned_signatory_id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_update_approval(approval_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Admin can update all
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role = 'admin'::public.user_role THEN
    RETURN true;
  END IF;

  -- Signatory can update if their role matches the approval's signatory_role
  -- and (if assigned_signatory_id is defined) matches their user ID
  RETURN EXISTS (
    SELECT 1 FROM public.clearance_approvals
    WHERE id = approval_id
      AND signatory_role = v_role
      AND (assigned_signatory_id IS NULL OR assigned_signatory_id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_student_profile(student_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Student can read their own profile
  IF v_uid = student_uuid THEN
    RETURN true;
  END IF;

  -- Admin can read all
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role = 'admin'::public.user_role THEN
    RETURN true;
  END IF;

  -- Accountant can read all students
  IF v_role = 'accountant'::public.user_role THEN
    RETURN true;
  END IF;

  -- Dean can read student if there is an application for that student with Adviser approval
  IF v_role = 'dean'::public.user_role THEN
    RETURN EXISTS (
      SELECT 1 FROM public.clearance_applications app
      JOIN public.clearance_approvals ap ON ap.application_id = app.id
      WHERE app.student_id = student_uuid
        AND ap.signatory_role = 'adviser'::public.user_role
        AND ap.status = 'approved'::public.clearance_status
    );
  END IF;

  -- Signatories can read student if they have an active clearance application that the signatory is assigned to
  RETURN EXISTS (
    SELECT 1 FROM public.clearance_applications app
    JOIN public.clearance_approvals ap ON ap.application_id = app.id
    WHERE app.student_id = student_uuid
      AND ap.signatory_role = v_role
      AND (ap.assigned_signatory_id IS NULL OR ap.assigned_signatory_id = v_uid)
  );
END;
$$;

-- RLS Policies

-- profiles
CREATE POLICY select_own_profile ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY update_allowed_fields ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- students
CREATE POLICY select_student ON public.students FOR SELECT USING (public.can_read_student_profile(id));
CREATE POLICY manage_student ON public.students FOR ALL USING (public.is_admin());

-- clearance_requirements
CREATE POLICY select_active_requirements ON public.clearance_requirements FOR SELECT USING (true);
CREATE POLICY manage_requirements ON public.clearance_requirements FOR ALL USING (public.is_admin());

-- clearance_applications
CREATE POLICY select_applications ON public.clearance_applications FOR SELECT USING (public.can_access_application(id));
CREATE POLICY insert_applications ON public.clearance_applications FOR INSERT WITH CHECK (public.is_admin()); -- students must use submission function
CREATE POLICY manage_applications ON public.clearance_applications FOR UPDATE USING (public.is_admin());

-- clearance_approvals
CREATE POLICY select_approvals ON public.clearance_approvals FOR SELECT USING (public.can_access_application(application_id));
CREATE POLICY update_approvals ON public.clearance_approvals FOR UPDATE USING (public.can_update_approval(id));
CREATE POLICY manage_approvals ON public.clearance_approvals FOR ALL USING (public.is_admin());

-- remarks
CREATE POLICY select_remarks ON public.remarks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.clearance_approvals ap
    WHERE ap.id = approval_id AND public.can_access_application(ap.application_id)
  )
);
CREATE POLICY insert_remarks ON public.remarks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clearance_approvals ap
    WHERE ap.id = approval_id AND public.can_update_approval(ap.id)
  )
);

-- financial_records
CREATE POLICY select_financial ON public.financial_records FOR SELECT USING (
  student_id = auth.uid() OR public.is_accountant() OR public.current_user_role() = 'dean'::public.user_role OR public.is_admin()
);
CREATE POLICY manage_financial ON public.financial_records FOR ALL USING (public.is_accountant() OR public.is_admin());

-- notifications
CREATE POLICY select_own_notifications ON public.notifications FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY update_own_notifications ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());

-- activity_logs
CREATE POLICY select_logs ON public.activity_logs FOR SELECT USING (public.is_admin());

-- Trigger & Automation Functions

-- Profile columns restriction trigger
CREATE OR REPLACE FUNCTION public.check_profile_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::public.user_role) THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'You are not authorized to change the user role.';
    END IF;
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
      RAISE EXCEPTION 'You are not authorized to change the account status.';
    END IF;
    IF OLD.must_change_password IS DISTINCT FROM NEW.must_change_password THEN
      RAISE EXCEPTION 'You are not authorized to change must_change_password flag.';
    END IF;
    IF OLD.deactivated_at IS DISTINCT FROM NEW.deactivated_at THEN
      RAISE EXCEPTION 'You are not authorized to change deactivated_at timestamp.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Automatic overall status calculation trigger
CREATE OR REPLACE FUNCTION public.trigger_calculate_overall_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_id uuid;
  v_any_not_approved boolean;
  v_all_approved boolean;
  v_fin_status public.financial_status;
  v_fin_verified timestamptz;
  v_next_status public.clearance_status;
BEGIN
  IF TG_TABLE_NAME = 'clearance_approvals' THEN
    v_app_id := COALESCE(NEW.application_id, OLD.application_id);
  ELSIF TG_TABLE_NAME = 'financial_records' THEN
    v_app_id := COALESCE(NEW.application_id, OLD.application_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clearance_approvals
    WHERE application_id = v_app_id AND status = 'not_approved'::public.clearance_status
  ) INTO v_any_not_approved;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.clearance_approvals
    WHERE application_id = v_app_id AND status <> 'approved'::public.clearance_status
  ) INTO v_all_approved;

  SELECT status, verified_at INTO v_fin_status, v_fin_verified
  FROM public.financial_records
  WHERE application_id = v_app_id;

  IF v_any_not_approved THEN
    v_next_status := 'not_approved'::public.clearance_status;
  ELSIF v_all_approved AND v_fin_status = 'paid'::public.financial_status THEN
    v_next_status := 'approved'::public.clearance_status;
  ELSIF v_all_approved AND v_fin_status = 'unpaid'::public.financial_status AND v_fin_verified IS NOT NULL THEN
    v_next_status := 'not_approved'::public.clearance_status;
  ELSE
    v_next_status := 'pending'::public.clearance_status;
  END IF;

  UPDATE public.clearance_applications
  SET 
    overall_status = v_next_status,
    updated_at = now()
  WHERE id = v_app_id;

  RETURN NEW;
END;
$$;

-- Assigned signatory role consistency check
CREATE OR REPLACE FUNCTION public.check_signatory_role_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_role public.user_role;
BEGIN
  IF TG_TABLE_NAME = 'clearance_requirements' THEN
    IF NEW.assigned_signatory_id IS NOT NULL THEN
      SELECT role INTO v_assigned_role FROM public.profiles WHERE id = NEW.assigned_signatory_id;
      IF v_assigned_role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Assigned signatory role (%) does not match requirement role (%)', v_assigned_role, NEW.role;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'clearance_approvals' THEN
    IF NEW.assigned_signatory_id IS NOT NULL THEN
      SELECT role INTO v_assigned_role FROM public.profiles WHERE id = NEW.assigned_signatory_id;
      IF v_assigned_role IS DISTINCT FROM NEW.signatory_role THEN
        RAISE EXCEPTION 'Assigned signatory role (%) does not match approval signatory_role (%)', v_assigned_role, NEW.signatory_role;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Auth profile creation trigger
CREATE OR REPLACE FUNCTION public.trigger_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_username text;
  v_full_name text;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role);
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student User');

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    username,
    full_name,
    role,
    account_status,
    must_change_password
  ) VALUES (
    NEW.id,
    NEW.email,
    v_username,
    v_full_name,
    v_role,
    'active'::public.account_status,
    true
  );

  RETURN NEW;
END;
$$;

-- Standard updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.trigger_update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Bind Triggers
CREATE TRIGGER tr_profile_update_restrictions
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_restrictions();

CREATE TRIGGER tr_profiles_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_timestamp();

CREATE TRIGGER tr_clearance_applications_timestamp
  BEFORE UPDATE ON public.clearance_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_timestamp();

CREATE TRIGGER tr_clearance_approvals_timestamp
  BEFORE UPDATE ON public.clearance_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_timestamp();

CREATE TRIGGER tr_financial_records_timestamp
  BEFORE UPDATE ON public.financial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_timestamp();

CREATE TRIGGER tr_approvals_overall_status
  AFTER UPDATE OF status ON public.clearance_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_overall_status();

CREATE TRIGGER tr_financial_overall_status
  AFTER UPDATE OF status, verified_at ON public.financial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_overall_status();

CREATE TRIGGER tr_requirements_role_consistency
  BEFORE INSERT OR UPDATE OF assigned_signatory_id, role ON public.clearance_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.check_signatory_role_consistency();

CREATE TRIGGER tr_approvals_role_consistency
  BEFORE INSERT OR UPDATE OF assigned_signatory_id, signatory_role ON public.clearance_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_signatory_role_consistency();

-- Planned Transaction/Action Functions

CREATE OR REPLACE FUNCTION public.submit_clearance_application(
  p_academic_year text,
  p_semester text,
  p_purpose text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_app_id uuid;
  v_app_no text;
  v_year text;
  v_req record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to submit an application';
  END IF;

  IF (SELECT role FROM public.profiles WHERE id = v_uid) IS DISTINCT FROM 'student'::public.user_role THEN
    RAISE EXCEPTION 'Only students can submit clearance applications';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clearance_applications
    WHERE student_id = v_uid AND academic_year = p_academic_year AND semester = p_semester
  ) THEN
    RAISE EXCEPTION 'You already have an active clearance application for this semester';
  END IF;

  v_year := to_char(now(), 'YYYY');
  v_app_no := 'CLR-' || v_year || '-' || lpad(nextval('public.application_no_seq')::text, 6, '0');

  INSERT INTO public.clearance_applications (
    student_id,
    academic_year,
    semester,
    purpose,
    application_number,
    overall_status
  ) VALUES (
    v_uid,
    p_academic_year,
    p_semester,
    p_purpose,
    v_app_no,
    'pending'::public.clearance_status
  ) RETURNING id INTO v_app_id;

  INSERT INTO public.financial_records (
    application_id,
    student_id,
    status
  ) VALUES (
    v_app_id,
    v_uid,
    'unpaid'::public.financial_status
  );

  FOR v_req IN 
    SELECT id, role, assigned_signatory_id FROM public.clearance_requirements WHERE is_active = true
  LOOP
    INSERT INTO public.clearance_approvals (
      application_id,
      requirement_id,
      signatory_role,
      assigned_signatory_id,
      status
    ) VALUES (
      v_app_id,
      v_req.id,
      v_req.role,
      v_req.assigned_signatory_id,
      'pending'::public.clearance_status
    );

    IF v_req.assigned_signatory_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id,
        type,
        message,
        related_application_id
      ) VALUES (
        v_req.assigned_signatory_id,
        'new_application',
        'A new clearance application ' || v_app_no || ' requires your review.',
        v_app_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_uid,
    'clearance_application_submitted',
    'clearance_application',
    v_app_id,
    jsonb_build_object('application_number', v_app_no, 'academic_year', p_academic_year, 'semester', p_semester)
  );

  RETURN v_app_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clearance_approval(
  p_approval_id uuid,
  p_next_status public.clearance_status,
  p_remarks_content text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_student_id uuid;
  v_app_id uuid;
  v_app_no text;
  v_signatory_role public.user_role;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to perform this action';
  END IF;

  IF NOT public.can_update_approval(p_approval_id) THEN
    RAISE EXCEPTION 'You are not authorized to update this approval record';
  END IF;

  IF p_next_status IN ('pending'::public.clearance_status, 'not_approved'::public.clearance_status) AND (p_remarks_content IS NULL OR trim(p_remarks_content) = '') THEN
    RAISE EXCEPTION 'Remarks are required when marking an approval as Pending or Not Approved';
  END IF;

  SELECT app.student_id, app.id, app.application_number, ap.signatory_role INTO v_student_id, v_app_id, v_app_no, v_signatory_role
  FROM public.clearance_approvals ap
  JOIN public.clearance_applications app ON app.id = ap.application_id
  WHERE ap.id = p_approval_id;

  UPDATE public.clearance_approvals
  SET 
    status = p_next_status,
    acted_at = now(),
    signatory_id = v_uid,
    updated_at = now()
  WHERE id = p_approval_id;

  IF p_remarks_content IS NOT NULL AND trim(p_remarks_content) <> '' THEN
    INSERT INTO public.remarks (
      approval_id,
      author_id,
      content
    ) VALUES (
      p_approval_id,
      v_uid,
      p_remarks_content
    );
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    type,
    message,
    related_application_id
  ) VALUES (
    v_student_id,
    'approval_action',
    'Your ' || v_signatory_role || ' clearance has been marked as ' || p_next_status || '.',
    v_app_id
  );

  INSERT INTO public.activity_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_uid,
    'signatory_action_taken',
    'clearance_approval',
    p_approval_id,
    jsonb_build_object(
      'application_number', v_app_no,
      'status', p_next_status,
      'remarks_added', (p_remarks_content IS NOT NULL AND trim(p_remarks_content) <> '')
    )
  );
END;
$$;

-- Revoke default public execution privileges on functions and restrict to proper roles
REVOKE ALL ON FUNCTION public.current_user_role() FROM public, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.is_accountant() FROM public, anon;
REVOKE ALL ON FUNCTION public.is_student_owner(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.has_adviser_approval(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_access_application(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_update_approval(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_read_student_profile(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.submit_clearance_application(text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_clearance_approval(uuid, public.clearance_status, text) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_accountant() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_student_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_adviser_approval(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_update_approval(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_student_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_clearance_application(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_clearance_approval(uuid, public.clearance_status, text) TO authenticated, service_role;

-- Performance Indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_students_id_number ON public.students(student_id_number);
CREATE INDEX idx_applications_student_id ON public.clearance_applications(student_id);
CREATE INDEX idx_approvals_application_id ON public.clearance_approvals(application_id);
CREATE INDEX idx_approvals_requirement_id ON public.clearance_approvals(requirement_id);
CREATE INDEX idx_approvals_signatory_role ON public.clearance_approvals(signatory_role);
CREATE INDEX idx_approvals_assigned_signatory_id ON public.clearance_approvals(assigned_signatory_id);
CREATE INDEX idx_financial_records_application_id ON public.financial_records(application_id);
CREATE INDEX idx_financial_records_student_id ON public.financial_records(student_id);
CREATE INDEX idx_notifications_recipient_read ON public.notifications(recipient_id, is_read);
CREATE INDEX idx_activity_logs_actor_id ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Seed default clearance requirements (Dean is viewer only, not a requirement)
INSERT INTO public.clearance_requirements (role, label, display_order, is_active) VALUES
('librarian'::public.user_role, 'Library Clearance', 1, true),
('accountant'::public.user_role, 'Accounting Clearance', 2, true),
('osa_coordinator'::public.user_role, 'OSA Clearance', 3, true),
('guidance_counselor'::public.user_role, 'Guidance Clearance', 4, true),
('area_chair'::public.user_role, 'Area Chair Clearance', 5, true),
('adviser'::public.user_role, 'Adviser Clearance', 6, true);
