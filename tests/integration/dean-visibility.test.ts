import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchDeanApplicationsAction, fetchPendingApprovalsAction, signClearanceAction } from '@/app/actions/clearance';
import { fetchDeanReportSummaryAction } from '@/app/actions/reports';
import { deactivateUserAccountAction } from '@/app/actions/admin-accounts';

describe('Dean clearance signatory integration tests', () => {
  let deanSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    deanSession = await getSessionCookieForUser('dean@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = deanSession;
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

  it('Dean receives the fifth approval and recomputes deanApproved/counters', async () => {
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
    assert.equal(app.data()?.approvedCount, 3);
    assert.equal(app.data()?.pendingCount, 2);
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
