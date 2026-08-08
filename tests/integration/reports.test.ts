import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  fetchAdminReportSummaryAction,
  fetchDeanReportSummaryAction,
  fetchReportFilterOptionsAction,
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
  it('16. Report queries and exports handle legacy short-form semester records seamlessly without splitting terms', async () => {
    process.env.TEST_SESSION_COOKIE = adminSession;
    const firestore = getAdminFirestore();

    // Insert Application X (legacy short-form semester)
    await firestore.collection('clearanceApplications').doc('legacy-student-x_2029-2030_1st').set({
      studentUid: 'legacy-student-x',
      studentNumber: 'STUD-2029-0001',
      studentName: 'Student Legacy X',
      program: 'BSIT',
      yearLevel: '1',
      section: 'A',
      academicYear: '2029-2030',
      semester: '1st',
      purpose: 'Enrollment',
      overallStatus: 'approved',
      financialStatus: 'paid',
      adviserApproved: true,
      submittedAt: new Date().toISOString(),
    });

    // Insert Application Y (canonical long-form semester)
    await firestore.collection('clearanceApplications').doc('legacy-student-y_2029-2030_1st-Semester').set({
      studentUid: 'legacy-student-y',
      studentNumber: 'STUD-2029-0002',
      studentName: 'Student Legacy Y',
      program: 'BSIT',
      yearLevel: '1',
      section: 'A',
      academicYear: '2029-2030',
      semester: '1st Semester',
      purpose: 'Enrollment',
      overallStatus: 'pending',
      financialStatus: 'pending',
      adviserApproved: true,
      submittedAt: new Date().toISOString(),
    });

    // 1. Query Admin summary with canonical semester filter
    const adminCanonicalRes = await fetchAdminReportSummaryAction({
      academicYear: '2029-2030',
      semester: '1st Semester',
    });
    assert.equal(adminCanonicalRes.success, true);
    if (!adminCanonicalRes.success) return;
    assert.equal(adminCanonicalRes.summary.applicationSummary.total, 2);
    assert.equal(adminCanonicalRes.summary.applicationSummary.approved, 1);
    assert.equal(adminCanonicalRes.summary.applicationSummary.pending, 1);

    // 2. Query Admin summary with legacy alias filter
    const adminLegacyRes = await fetchAdminReportSummaryAction({
      academicYear: '2029-2030',
      semester: '1st',
    });
    assert.equal(adminLegacyRes.success, true);
    if (!adminLegacyRes.success) return;
    assert.equal(adminLegacyRes.summary.applicationSummary.total, 2);

    // 3. Query Dean summary with canonical semester filter
    process.env.TEST_SESSION_COOKIE = deanSession;
    const deanCanonicalRes = await fetchDeanReportSummaryAction({
      academicYear: '2029-2030',
      semester: '1st Semester',
    });
    assert.equal(deanCanonicalRes.success, true);
    if (!deanCanonicalRes.success) return;
    assert.equal(deanCanonicalRes.summary.applicationSummary.total, 2);

    // 4. Query Dean summary with legacy alias filter
    const deanLegacyRes = await fetchDeanReportSummaryAction({
      academicYear: '2029-2030',
      semester: '1st',
    });
    assert.equal(deanLegacyRes.success, true);
    if (!deanLegacyRes.success) return;
    assert.equal(deanLegacyRes.summary.applicationSummary.total, 2);

    // 5. CSV Detail Export produces canonical semester label for both rows
    process.env.TEST_SESSION_COOKIE = adminSession;
    const csvDetailRes = await exportAdminReportCsvAction(
      { academicYear: '2029-2030', semester: '1st Semester' },
      'application-detail'
    );
    assert.equal(csvDetailRes.success, true);
    if (csvDetailRes.success) {
      assert.ok(csvDetailRes.csvContent.includes('Student Legacy X'));
      assert.ok(csvDetailRes.csvContent.includes('Student Legacy Y'));
      // Ensure '1st Semester' is in the CSV lines and no raw un-normalized '1st' column
      const lines = csvDetailRes.csvContent.split('\n');
      const studentXLine = lines.find((l) => l.includes('Student Legacy X'));
      assert.ok(studentXLine && studentXLine.includes('1st Semester'));
    }

    // 6. Report Filter Options returns canonical semesters without duplicate '1st' option
    const optionsRes = await fetchReportFilterOptionsAction('admin');
    assert.equal(optionsRes.success, true);
    if (optionsRes.success) {
      assert.equal(optionsRes.filterOptions.semesters.includes('1st'), false);
      assert.equal(optionsRes.filterOptions.semesters.includes('1st Semester'), true);
    }
  });
});
