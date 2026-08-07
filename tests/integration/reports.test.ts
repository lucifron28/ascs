import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  fetchAdminReportSummaryAction,
  fetchDeanReportSummaryAction,
  exportAdminReportCsvAction,
  exportDeanReportCsvAction,
} from '@/app/actions/reports';

describe('Reports & CSV Export Integration Tests', () => {
  let adminSession: string;
  let deanSession: string;
  let studentSession: string;
  let librarianSession: string;

  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
    adminSession = await getSessionCookieForUser('admin@example.test', 'password123');
    deanSession = await getSessionCookieForUser('dean@example.test', 'password123');
    studentSession = await getSessionCookieForUser('student.a@example.test', 'password123');
    librarianSession = await getSessionCookieForUser('librarian@example.test', 'password123');
  });

  it('1. Admin report totals match fixtures & 2. Completion rate denominator & 3. Financial counts', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const res = await fetchAdminReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });

    assert.equal(res.success, true);
    if (!res.success) return;

    const summary = res.summary;
    assert.equal(summary.scope, 'admin');

    assert.equal(summary.applicationSummary.total, 4);
    assert.equal(summary.applicationSummary.approved, 1);
    assert.equal(summary.applicationSummary.pending, 1);
    assert.equal(summary.applicationSummary.notApproved, 2);

    assert.ok(summary.financialSummary);
    assert.equal(summary.financialSummary?.paid, 3);
    assert.equal(summary.financialSummary?.unpaid, 1);
  });

  it('4. Program breakdown & 5. Year-level breakdown & 6. Section breakdown & 7. Requirement bottlenecks', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const res = await fetchAdminReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });
    assert.equal(res.success, true);
    if (!res.success) return;

    assert.ok(res.summary.programBreakdown.length > 0);
    assert.ok(res.summary.yearLevelBreakdown.length > 0);
    assert.ok(res.summary.sectionBreakdown.length > 0);
    assert.ok(res.summary.requirementBreakdown.length > 0);
  });

  it('8. Dean report includes only adviser-approved & 9. Excludes financial summary', async () => {
    process.env.TEST_SESSION_COOKIE = deanSession;
    const res = await fetchDeanReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });

    assert.equal(res.success, true);
    if (!res.success) return;

    assert.equal(res.summary.scope, 'dean');
    assert.equal(res.summary.financialSummary, undefined);
    assert.equal(res.summary.applicationSummary.total, 2);
  });

  it('10. Student cannot call reports & 11. Signatory cannot call reports', async () => {
    process.env.TEST_SESSION_COOKIE = studentSession;
    const studentRes = await fetchAdminReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });
    assert.equal(studentRes.success, false);

    process.env.TEST_SESSION_COOKIE = librarianSession;
    const sigRes = await fetchAdminReportSummaryAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });
    assert.equal(sigRes.success, false);
  });

  it('12. Malformed report scope is rejected', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const badRes = await fetchAdminReportSummaryAction({
      academicYear: 'invalid-year-format',
      semester: 'invalid-sem',
    });
    assert.equal(badRes.success, false);
    if (!badRes.success) {
      assert.match(badRes.error, /Failed to generate|invalid|error/i);
    }
  });

  it('13. Admin CSV export succeeds & 14. Dean CSV excludes financial & 15. Activity log written', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const csvRes = await exportAdminReportCsvAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });

    assert.equal(csvRes.success, true);
    if (!csvRes.success) return;

    assert.ok(csvRes.csvContent);
    assert.match(csvRes.csvContent, /ASCS Clearance ADMIN Report|Submitted Applications/i);

    const logsSnap = await getAdminFirestore()
      .collection('activityLogs')
      .where('action', '==', 'export_admin_report_csv')
      .get();
    assert.ok(logsSnap.size >= 1);

    process.env.TEST_SESSION_COOKIE = deanSession;
    const deanCsvRes = await exportDeanReportCsvAction({
      academicYear: '2026-2027',
      semester: '1st Semester',
    });
    assert.equal(deanCsvRes.success, true);
    if (deanCsvRes.success) {
      assert.ok(deanCsvRes.csvContent);
      assert.equal(deanCsvRes.csvContent.includes('Financial Status'), false);
    }
  });
});
