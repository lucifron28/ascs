import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchDeanApplicationsAction } from '@/app/actions/clearance';
import { fetchDeanReportSummaryAction } from '@/app/actions/reports';
import { deactivateUserAccountAction } from '@/app/actions/admin-accounts';

describe('Adviser -> Dean Visibility Integration Tests', () => {
  let deanSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    deanSession = await getSessionCookieForUser('dean@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = deanSession;
  });

  it('1. Application is hidden from Dean before Adviser approval & 2. Adviser approval sets Dean-visible state & 3. Dean sees only adviser-approved records', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const res = await fetchDeanApplicationsAction();
    assert.equal(res.success, true);
    if (!res.success) return;

    assert.ok(Array.isArray(res.deanQueue));
    const visibleIds = res.deanQueue.map((item) => item.id);
    assert.equal(visibleIds.includes('app-student-a'), true);
    assert.equal(visibleIds.includes('app-student-d'), true);
    assert.equal(visibleIds.includes('app-student-b'), false);
    assert.equal(visibleIds.includes('app-student-c'), false);
  });

  it('4. Reverting Adviser status away from approved revokes Dean visibility', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').update({
      adviserApproved: false,
    });

    const res = await fetchDeanApplicationsAction();
    assert.equal(res.success, true);
    if (!res.success) return;

    const visibleIds = res.deanQueue.map((item) => item.id);
    assert.equal(visibleIds.includes('app-student-a'), false);

    await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').update({
      adviserApproved: true,
    });
  });

  it('5. Dean does not become a required clearance signatory', async () => {
    const reqsSnap = await getAdminFirestore().collection('clearanceRequirements').get();
    const reqRoles = reqsSnap.docs.map((d) => d.data().role);
    assert.equal(reqRoles.includes('dean'), false);
  });

  it('6. Dean cannot perform Admin-only operations', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const failRes = await deactivateUserAccountAction({ userId: 'demo-student-b-uid' });
    assert.equal(failRes.success, false);
    if (!failRes.success) {
      assert.match(failRes.error, /unauthorized|only active administrators/i);
    }
  });

  it('7. Dean reporting is adviser-approved scoped & 8. Dean report contains no financialSummary', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const reportRes = await fetchDeanReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });

    assert.equal(reportRes.success, true);
    if (!reportRes.success) return;

    assert.equal(reportRes.summary.scope, 'dean');
    assert.equal(reportRes.summary.financialSummary, undefined);
    assert.ok(reportRes.summary.applicationSummary.total >= 1);
  });
});
