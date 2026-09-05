import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  fetchDeanApplicationsAction,
  fetchPendingApprovalsAction,
  fetchStudentDashboardAction,
  signClearanceAction,
} from '@/app/actions/clearance';
import { fetchDeanReportSummaryAction } from '@/app/actions/reports';
import { deactivateUserAccountAction } from '@/app/actions/admin-accounts';

describe('Dean clearance signatory integration tests', () => {
  let deanSession: string;
  let studentSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    deanSession = await getSessionCookieForUser('dean@example.test', 'password123');
    studentSession = await getSessionCookieForUser('student.a@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = deanSession;
  });

  it('Student checklist hides retained Adviser and Accountant rows', async () => {
    await getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-a')
      .collection('approvals')
      .doc('adviser')
      .set({ signatoryRole: 'adviser', status: 'approved', requirementId: 'adviser' });
    await getAdminFirestore()
      .collection('clearanceApplications')
      .doc('app-student-a')
      .collection('approvals')
      .doc('accountant')
      .set({ signatoryRole: 'accountant', status: 'approved', requirementId: 'accountant' });

    process.env.TEST_SESSION_COOKIE = studentSession;
    const result = await fetchStudentDashboardAction();
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.deepEqual(
      result.approvals.map((approval) => approval.signatory_role).sort(),
      ['area_chair', 'dean', 'guidance_counselor', 'librarian', 'osa_coordinator'],
    );
  });

  it('Dean report scope uses deanApproved and active applications', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const res = await fetchDeanApplicationsAction();
    assert.equal(res.success, true);
    if (!res.success) return;

    const visibleIds = (res.deanQueue || []).map((item) => item.id);
    assert.equal(visibleIds.includes('app-student-a'), true);
    assert.equal(visibleIds.includes('app-student-d'), true);
    assert.equal(visibleIds.includes('app-student-b'), false);
    assert.equal(visibleIds.includes('app-student-c'), false);
  });

  it('Dean receives the final approval only after Accountant and prior signatories finish', async () => {
    const guidanceSession = await getSessionCookieForUser('guidance@example.test', 'password123');
    const areaChairSession = await getSessionCookieForUser('chair@example.test', 'password123');

    process.env.TEST_SESSION_COOKIE = guidanceSession;
    const guidanceRes = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'guidance_counselor',
      status: 'approved',
      remarks: '',
    });
    assert.equal(guidanceRes.success, true);

    process.env.TEST_SESSION_COOKIE = areaChairSession;
    const areaChairRes = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'area_chair',
      status: 'approved',
      remarks: '',
    });
    assert.equal(areaChairRes.success, true);

    process.env.TEST_SESSION_COOKIE = deanSession;
    const queue = await fetchPendingApprovalsAction();
    assert.equal(queue.success, true);
    if (!queue.success) return;
    assert.equal(queue.role, 'dean');
    assert.ok(queue.pendingQueue.some((item) => item.application_id === 'app-student-b'));

    const res = await signClearanceAction({
      applicationId: 'app-student-b',
      approvalId: 'dean',
      status: 'approved',
      remarks: '',
    });
    assert.equal(res.success, true);

    const app = await getAdminFirestore().collection('clearanceApplications').doc('app-student-b').get();
    assert.equal(app.data()?.deanApproved, true);
    assert.equal(app.data()?.approvedCount, 5);
    assert.equal(app.data()?.pendingCount, 0);
    assert.equal(app.data()?.overallStatus, 'approved');
  });

  it('Dean is an active required role and Adviser is legacy-only', async () => {
    const reqsSnap = await getAdminFirestore().collection('clearanceRequirements').get();
    const activeRoles = reqsSnap.docs.filter((d) => d.data().isActive !== false).map((d) => d.data().role);
    assert.deepEqual(activeRoles.sort(), ['area_chair', 'dean', 'guidance_counselor', 'librarian', 'osa_coordinator']);
    assert.equal(activeRoles.includes('adviser'), false);
  });

  it('Dean cannot perform Admin-only operations', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const failRes = await deactivateUserAccountAction({ userId: 'demo-student-b-uid' });
    assert.equal(failRes.success, false);
    if (!failRes.success) assert.match(failRes.error, /unauthorized|only active administrators/i);
  });

  it('Dean reporting remains scoped and excludes financialSummary', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const reportRes = await fetchDeanReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });
    assert.equal(reportRes.success, true);
    if (!reportRes.success) return;
    const summary = reportRes.summary;
    if (!summary) return;
    assert.equal(summary.scope, 'dean');
    assert.equal(summary.financialSummary, undefined);
    assert.ok(summary.applicationSummary.total >= 1);
  });
});
