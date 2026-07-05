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

// Fetch pending approval queue for a signatory
export async function fetchPendingApprovalsAction() {
  try {
    const claims = await getAuthenticatedUser();
    const userId = claims.uid;
    const email = claims.email || '';

    // Extract role from profiles
    let role = 'student';
    if (process.env.DATABASE_URL) {
      const pRes = await query('SELECT role FROM public.profiles WHERE id = $1', [userId]);
      role = pRes.rows[0]?.role || 'student';
    } else {
      // Fallback role deduction for local testing
      const emailLower = email.toLowerCase();
      if (emailLower.includes('admin')) role = 'admin';
      else if (emailLower.includes('librarian')) role = 'librarian';
      else if (emailLower.includes('accountant')) role = 'accountant';
      else if (emailLower.includes('osa')) role = 'osa_coordinator';
      else if (emailLower.includes('guidance')) role = 'guidance_counselor';
      else if (emailLower.includes('chair')) role = 'area_chair';
      else if (emailLower.includes('adviser')) role = 'adviser';
      else if (emailLower.includes('dean')) role = 'dean';
    }

    if (role === 'student') {
      throw new Error('Unauthorized: Students do not have approval queues.');
    }

    if (process.env.DATABASE_URL) {
      const res = await query(
        `SELECT a.id as approval_id, a.signatory_role, a.status, ap.id as application_id, 
                ap.application_number, ap.academic_year, ap.semester, ap.purpose, ap.submitted_at, 
                s.student_id_number, p.full_name as student_name
         FROM public.clearance_approvals a
         JOIN public.clearance_applications ap ON a.application_id = ap.id
         JOIN public.students s ON ap.student_id = s.id
         JOIN public.profiles p ON s.id = p.id
         WHERE a.signatory_role = $1 AND a.status = 'pending' AND (a.assigned_signatory_id IS NULL OR a.assigned_signatory_id = $2)
         ORDER BY ap.submitted_at ASC`,
        [role, userId]
      );
      return { success: true, role, pendingQueue: res.rows };
    }

    // FALLBACK: Mock DB
    const db = getMockDb();
    
    // Filter approvals matching the role in pending state
    const pendingApprovals = db.clearance_approvals.filter(
      (ap: any) => ap.signatory_role === role && ap.status === 'pending'
    );

    const pendingQueue = pendingApprovals.map((ap: any) => {
      const app = db.clearance_applications.find((a: any) => a.id === ap.application_id);
      
      // Look up student name in profiles (we will fall back to mock details if profile doesn't exist)
      let studentName = 'Test Student';
      let studentIdNum = 'STUD-2026-0001';
      
      if (app) {
        if (app.student_id === 'mock-student-uid') {
          studentName = 'Juan Dela Cruz';
          studentIdNum = 'STUD-2026-0001';
        } else {
          studentName = app.student_id.toUpperCase().split('-')[0] || 'Demo Student';
          studentIdNum = 'STUD-MOCK-999';
        }
      }

      return {
        approval_id: ap.id,
        signatory_role: ap.signatory_role,
        status: ap.status,
        application_id: ap.application_id,
        application_number: app?.application_number || 'CLR-MOCK',
        academic_year: app?.academic_year || '2026-2027',
        semester: app?.semester || '1st',
        purpose: app?.purpose || 'Graduation',
        submitted_at: app?.submitted_at || new Date().toISOString(),
        student_id_number: studentIdNum,
        student_name: studentName
      };
    }).sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());

    return { success: true, role, pendingQueue };
  } catch (error: any) {
    console.error('Fetch pending approvals error:', error);
    return { success: false, error: error.message };
  }
}

// Sign / Action clearance approval
export async function signClearanceAction(data: {
  approvalId: string;
  status: 'approved' | 'pending' | 'not_approved';
  remarks: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const signatoryId = claims.uid;
    const email = claims.email || '';

    // Enforce remarks validation
    if (data.status !== 'approved' && (!data.remarks || data.remarks.trim() === '')) {
      throw new Error('Remarks are required when marking an approval as pending or not approved.');
    }

    if (process.env.DATABASE_URL) {
      await query(
        'SELECT public.update_clearance_approval($1, $2, $3, $4)',
        [data.approvalId, signatoryId, data.status, data.remarks]
      );
      return { success: true };
    }

    // FALLBACK: Mock DB
    const db = getMockDb();

    // Find the approval row
    const approvalIndex = db.clearance_approvals.findIndex((ap: any) => ap.id === data.approvalId);
    if (approvalIndex === -1) {
      throw new Error('Clearance approval record not found.');
    }

    const approval = db.clearance_approvals[approvalIndex];
    approval.status = data.status;
    approval.acted_at = new Date().toISOString();
    approval.updated_at = new Date().toISOString();
    approval.assigned_signatory_id = signatoryId;

    // Add remark if entered
    if (data.remarks && data.remarks.trim() !== '') {
      db.remarks.push({
        id: `rem-${Math.random().toString(36).substr(2, 9)}`,
        approval_id: data.approvalId,
        author_id: signatoryId,
        content: data.remarks,
        created_at: new Date().toISOString()
      });
    }

    // Log Activity
    db.activity_logs.push({
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      actor_id: signatoryId,
      action: 'approval_action',
      entity_type: 'clearance_approval',
      entity_id: data.approvalId,
      created_at: new Date().toISOString()
    });

    // Notify Student
    const app = db.clearance_applications.find((a: any) => a.id === approval.application_id);
    if (app) {
      db.notifications.push({
        id: `notif-${Math.random().toString(36).substr(2, 9)}`,
        recipient_id: app.student_id,
        type: 'approval_updated',
        message: `Your approval for ${approval.signatory_role} has been marked as ${data.status} in application ${app.application_number}`,
        related_application_id: app.id,
        is_read: false,
        created_at: new Date().toISOString()
      });

      // Recalculate Application overall status (Simulates Postgres Trigger)
      const appApprovals = db.clearance_approvals.filter((ap: any) => ap.application_id === app.id);
      const finance = db.financial_records.find((f: any) => f.application_id === app.id);
      
      const totalCount = appApprovals.length;
      const approvedCount = appApprovals.filter((ap: any) => ap.status === 'approved').length;
      const notApprovedCount = appApprovals.filter((ap: any) => ap.status === 'not_approved').length;
      const financeStatus = finance ? finance.status : 'unpaid';
      const financeVerified = finance ? finance.verified_at : null;

      let finalStatus = 'pending';
      if (notApprovedCount > 0) {
        finalStatus = 'not_approved';
      } else if (approvedCount === totalCount && totalCount > 0) {
        if (financeStatus === 'paid') {
          finalStatus = 'approved';
        } else if (financeStatus === 'unpaid' && financeVerified !== null) {
          finalStatus = 'not_approved';
        } else {
          finalStatus = 'pending';
        }
      }

      app.overall_status = finalStatus;
      app.updated_at = new Date().toISOString();
    }

    saveMockDb(db);

    return { success: true };
  } catch (error: any) {
    console.error('Sign clearance action error:', error);
    return { success: false, error: error.message };
  }
}

// Fetch all financial accounts (Accountant Queue)
export async function fetchFinancialQueueAction() {
  try {
    const claims = await getAuthenticatedUser();
    const userId = claims.uid;
    const email = claims.email || '';

    // Verify role is accountant or admin
    let role = 'student';
    if (process.env.DATABASE_URL) {
      const pRes = await query('SELECT role FROM public.profiles WHERE id = $1', [userId]);
      role = pRes.rows[0]?.role || 'student';
    } else {
      const emailLower = email.toLowerCase();
      if (emailLower.includes('admin')) role = 'admin';
      else if (emailLower.includes('accountant')) role = 'accountant';
    }

    if (role !== 'accountant' && role !== 'admin') {
      throw new Error('Unauthorized: Only accountants can access financial queues.');
    }

    if (process.env.DATABASE_URL) {
      const res = await query(
        `SELECT f.*, ap.application_number, ap.academic_year, ap.semester, ap.purpose, 
                ap.overall_status, p.full_name as student_name, s.student_id_number
         FROM public.financial_records f
         JOIN public.clearance_applications ap ON f.application_id = ap.id
         JOIN public.students s ON f.student_id = s.id
         JOIN public.profiles p ON s.id = p.id
         ORDER BY f.recorded_at DESC`
      );
      return { success: true, financialQueue: res.rows };
    }

    // FALLBACK: Mock DB
    const db = getMockDb();
    
    const financialQueue = db.financial_records.map((f: any) => {
      const app = db.clearance_applications.find((a: any) => a.id === f.application_id);
      
      let studentName = 'Test Student';
      let studentIdNum = 'STUD-2026-0001';
      
      if (app) {
        if (app.student_id === 'mock-student-uid') {
          studentName = 'Juan Dela Cruz';
          studentIdNum = 'STUD-2026-0001';
        } else {
          studentName = app.student_id.toUpperCase().split('-')[0] || 'Demo Student';
          studentIdNum = 'STUD-MOCK-999';
        }
      }

      return {
        id: f.id,
        application_id: f.application_id,
        student_id: f.student_id,
        status: f.status,
        notes: f.notes,
        verified_at: f.verified_at,
        recorded_at: f.recorded_at,
        application_number: app?.application_number || 'CLR-MOCK',
        academic_year: app?.academic_year || '2026-2027',
        semester: app?.semester || '1st',
        purpose: app?.purpose || 'Enrollment',
        overall_status: app?.overall_status || 'pending',
        student_name: studentName,
        student_id_number: studentIdNum
      };
    }).sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

    return { success: true, financialQueue };
  } catch (error: any) {
    console.error('Fetch financial queue error:', error);
    return { success: false, error: error.message };
  }
}

// Update student financial balance record
export async function updateFinancialStatusAction(data: {
  recordId: string;
  status: 'paid' | 'unpaid';
  notes: string;
}) {
  try {
    const claims = await getAuthenticatedUser();
    const accountantId = claims.uid;

    if (process.env.DATABASE_URL) {
      await query(
        `UPDATE public.financial_records 
         SET status = $1, notes = $2, verified_at = $3, updated_by = $4, updated_at = NOW() 
         WHERE id = $5`,
        [
          data.status,
          data.notes,
          data.status === 'paid' ? new Date() : null,
          accountantId,
          data.recordId
        ]
      );
      // Stored triggers in PostgreSQL will automatically recalculate application overall status.
      return { success: true };
    }

    // FALLBACK: Mock DB
    const db = getMockDb();

    // Find financial record
    const fIndex = db.financial_records.findIndex((f: any) => f.id === data.recordId);
    if (fIndex === -1) {
      throw new Error('Financial record not found.');
    }

    const fRecord = db.financial_records[fIndex];
    fRecord.status = data.status;
    fRecord.notes = data.notes;
    fRecord.verified_at = data.status === 'paid' ? new Date().toISOString() : null;
    fRecord.updated_by = accountantId;
    fRecord.updated_at = new Date().toISOString();

    // Log Activity
    db.activity_logs.push({
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      actor_id: accountantId,
      action: 'update_financial',
      entity_type: 'financial_record',
      entity_id: data.recordId,
      created_at: new Date().toISOString()
    });

    // Notify Student
    const app = db.clearance_applications.find((a: any) => a.id === fRecord.application_id);
    if (app) {
      db.notifications.push({
        id: `notif-${Math.random().toString(36).substr(2, 9)}`,
        recipient_id: fRecord.student_id,
        type: 'financial_updated',
        message: `Your financial accountability status has been updated to ${data.status.toUpperCase()} in application ${app.application_number}`,
        related_application_id: app.id,
        is_read: false,
        created_at: new Date().toISOString()
      });

      // Recalculate Application overall status (Simulates PostgreSQL trigger)
      const appApprovals = db.clearance_approvals.filter((ap: any) => ap.application_id === app.id);
      const totalCount = appApprovals.length;
      const approvedCount = appApprovals.filter((ap: any) => ap.status === 'approved').length;
      const notApprovedCount = appApprovals.filter((ap: any) => ap.status === 'not_approved').length;

      let finalStatus = 'pending';
      if (notApprovedCount > 0) {
        finalStatus = 'not_approved';
      } else if (approvedCount === totalCount && totalCount > 0) {
        if (data.status === 'paid') {
          finalStatus = 'approved';
        } else if (data.status === 'unpaid' && fRecord.verified_at !== null) {
          finalStatus = 'not_approved';
        } else {
          finalStatus = 'pending';
        }
      }

      app.overall_status = finalStatus;
      app.updated_at = new Date().toISOString();
    }

    saveMockDb(db);

    return { success: true };
  } catch (error: any) {
    console.error('Update financial status error:', error);
    return { success: false, error: error.message };
  }
}


