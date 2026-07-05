'use server';

import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin';
import { query } from '@/lib/db';

const MOCK_DB_FILE = path.join(process.cwd(), 'dev_mock_db.json');

// Get active mock DB
function getMockDb() {
  if (!fs.existsSync(MOCK_DB_FILE)) {
    const defaultDb = {
      clearance_requirements: [
        { id: 'req-1', role: 'librarian', label: 'Librarian Clearance', display_order: 1, is_active: true },
        { id: 'req-2', role: 'accountant', label: 'Accountant Clearance', display_order: 2, is_active: true },
        { id: 'req-3', role: 'osa_coordinator', label: 'OSA Coordinator Clearance', display_order: 3, is_active: true },
        { id: 'req-4', role: 'guidance_counselor', label: 'Guidance Counselor Clearance', display_order: 4, is_active: true },
        { id: 'req-5', role: 'area_chair', label: 'Area Chair Clearance', display_order: 5, is_active: true },
        { id: 'req-6', role: 'adviser', label: 'Adviser Clearance', display_order: 6, is_active: true }
      ],
      clearance_applications: [] as any[],
      clearance_approvals: [] as any[],
      financial_records: [] as any[],
      remarks: [] as any[],
      notifications: [] as any[],
      activity_logs: [] as any[]
    };
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    return defaultDb;
  }
  return JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8'));
}

// Save active mock DB
function saveMockDb(data: any) {
  fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Verify session and return claims
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    throw new Error('Unauthorized: No session cookie found.');
  }

  try {
    return await getAdminAuth().verifySessionCookie(session, true);
  } catch (error) {
    throw new Error('Unauthorized: Invalid session.');
  }
}

// Submit application action
export async function submitApplicationAction(data: {
  academicYear: string;
  semester: string;
  purpose: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const studentId = claims.uid;
    const email = claims.email || '';

    // If DATABASE_URL is defined, use PostgreSQL
    if (process.env.DATABASE_URL) {
      const res = await query(
        'SELECT public.submit_clearance_application($1, $2, $3, $4) as app_id',
        [studentId, data.academicYear, data.semester, data.purpose]
      );
      return { success: true, applicationId: res.rows[0].app_id };
    }

    // STANDALONE EMULATOR FALLBACK: JSON Mock DB
    const db = getMockDb();

    // Verify student has no active application for the term
    const exists = db.clearance_applications.some(
      (app: any) =>
        app.student_id === studentId &&
        app.academic_year === data.academicYear &&
        app.semester === data.semester
    );

    if (exists) {
      throw new Error(`Already submitted an application for ${data.academicYear} ${data.semester}`);
    }

    const appId = `app-${Math.random().toString(36).substr(2, 9)}`;
    const appNumber = `CLR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newApp = {
      id: appId,
      application_number: appNumber,
      student_id: studentId,
      academic_year: data.academicYear,
      semester: data.semester,
      purpose: data.purpose,
      overall_status: 'pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create clearance approvals based on requirements
    const newApprovals = db.clearance_requirements
      .filter((req: any) => req.is_active)
      .map((req: any) => ({
        id: `appr-${Math.random().toString(36).substr(2, 9)}`,
        application_id: appId,
        requirement_id: req.id,
        signatory_role: req.role,
        assigned_signatory_id: req.assigned_signatory_id || null,
        status: 'pending',
        acted_at: null,
        updated_at: new Date().toISOString()
      }));

    // Create unpaid financial record
    const newFinance = {
      id: `fin-${Math.random().toString(36).substr(2, 9)}`,
      application_id: appId,
      student_id: studentId,
      status: 'unpaid',
      notes: 'Default unpaid balance checklist.',
      updated_by: null,
      verified_at: null,
      recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Log Activity
    const newLog = {
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      actor_id: studentId,
      action: 'submitted_application',
      entity_type: 'clearance_application',
      entity_id: appId,
      created_at: new Date().toISOString()
    };

    // Add Notification
    const newNotification = {
      id: `notif-${Math.random().toString(36).substr(2, 9)}`,
      recipient_id: studentId,
      type: 'application_submitted',
      message: `Your clearance application ${appNumber} has been successfully submitted.`,
      related_application_id: appId,
      is_read: false,
      created_at: new Date().toISOString()
    };

    db.clearance_applications.push(newApp);
    db.clearance_approvals.push(...newApprovals);
    db.financial_records.push(newFinance);
    db.activity_logs.push(newLog);
    db.notifications.push(newNotification);

    saveMockDb(db);

    return { success: true, applicationId: appId };
  } catch (error: any) {
    console.error('Submit application action error:', error);
    return { success: false, error: error.message };
  }
}

// Fetch student dashboard details action
export async function fetchStudentDashboardAction() {
  try {
    const claims = await getAuthenticatedUser();
    const studentId = claims.uid;

    if (process.env.DATABASE_URL) {
      // Fetch application
      const appRes = await query(
        'SELECT * FROM public.clearance_applications WHERE student_id = $1 ORDER BY submitted_at DESC LIMIT 1',
        [studentId]
      );

      if (appRes.rows.length === 0) {
        return { success: true, application: null };
      }

      const app = appRes.rows[0];

      // Fetch approvals
      const approvalsRes = await query(
        `SELECT a.*, r.label, r.display_order, p.full_name as assignee_name 
         FROM public.clearance_approvals a 
         JOIN public.clearance_requirements r ON a.requirement_id = r.id
         LEFT JOIN public.profiles p ON a.assigned_signatory_id = p.id
         WHERE a.application_id = $1 
         ORDER BY r.display_order ASC`,
        [app.id]
      );

      // Fetch remarks
      const remarksRes = await query(
        `SELECT r.*, p.full_name as author_name 
         FROM public.remarks r
         JOIN public.profiles p ON r.author_id = p.id
         WHERE r.approval_id IN (SELECT id FROM public.clearance_approvals WHERE application_id = $1)
         ORDER BY r.created_at DESC`,
        [app.id]
      );

      // Fetch financial
      const finRes = await query(
        'SELECT * FROM public.financial_records WHERE application_id = $1',
        [app.id]
      );

      return {
        success: true,
        application: app,
        approvals: approvalsRes.rows,
        remarks: remarksRes.rows,
        financial: finRes.rows[0] || null
      };
    }

    // FALLBACK: Mock DB
    const db = getMockDb();

    // Find student's latest application
    const app = db.clearance_applications
      .filter((a: any) => a.student_id === studentId)
      .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];

    if (!app) {
      return { success: true, application: null };
    }

    // Gather approvals with requirement details
    const approvals = db.clearance_approvals
      .filter((ap: any) => ap.application_id === app.id)
      .map((ap: any) => {
        const req = db.clearance_requirements.find((r: any) => r.id === ap.requirement_id);
        return {
          ...ap,
          label: req?.label || 'Clearance Checklist',
          display_order: req?.display_order || 99,
          assignee_name: ap.assigned_signatory_id ? 'Demo Signatory' : 'Unassigned'
        };
      })
      .sort((a: any, b: any) => a.display_order - b.display_order);

    // Gather remarks
    const approvalIds = approvals.map((a: any) => a.id);
    const remarks = db.remarks
      .filter((r: any) => approvalIds.includes(r.approval_id))
      .map((r: any) => ({
        ...r,
        author_name: r.author_id === 'mock-student-uid' ? 'Student' : 'Signatory'
      }));

    // Gather financial record
    const financial = db.financial_records.find((f: any) => f.application_id === app.id) || null;

    return {
      success: true,
      application: app,
      approvals,
      remarks,
      financial
    };
  } catch (error: any) {
    console.error('Fetch student dashboard action error:', error);
    return { success: false, error: error.message };
  }
}
