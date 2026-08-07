import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchClearanceCertificateAction } from '@/app/actions/clearance';

describe('Clearance Completion & Printable Certificate Integration Tests', () => {
  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
  });

  it('1. Student A: All signatories approved + paid -> overallStatus = approved, printableAvailable = true', async () => {
    const doc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-a').get();
    assert.equal(doc.data()?.overallStatus, 'approved');
    assert.equal(doc.data()?.financialStatus, 'paid');
    assert.equal(doc.data()?.printableAvailable, true);

    const studentASession = await getSessionCookieForUser('student.a@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentASession;
    const certRes = await fetchClearanceCertificateAction('app-student-a');
    assert.equal(certRes.success, true);
    if (certRes.success) {
      assert.ok(certRes.certificateData);
      assert.equal(certRes.certificateData.application.printableAvailable, true);
    }
  });

  it('2. Student D: All signatories approved + unpaid -> overallStatus = not_approved, printableAvailable = false', async () => {
    const doc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-d').get();
    assert.equal(doc.data()?.financialStatus, 'unpaid');
    assert.equal(doc.data()?.overallStatus, 'not_approved');
    assert.equal(doc.data()?.printableAvailable, false);
    const studentDSession = await getSessionCookieForUser('student.d@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentDSession;
    const certRes = await fetchClearanceCertificateAction('app-student-d');
    assert.equal(certRes.success, false);
    if (!certRes.success) {
      assert.match(certRes.error, /has not been fully approved yet|certificate unavailable/i);
    }
  });

  it('3. Student B: One or more requirements pending -> overallStatus = pending, printableAvailable = false', async () => {
    const doc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-b').get();
    assert.equal(doc.data()?.overallStatus, 'pending');
    assert.equal(doc.data()?.printableAvailable, false);
    const studentBSession = await getSessionCookieForUser('student.b@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentBSession;
    const certRes = await fetchClearanceCertificateAction('app-student-b');
    assert.equal(certRes.success, false);
    if (!certRes.success) {
      assert.match(certRes.error, /certificate unavailable|has not been fully approved yet/i);
    }
  });

  it('4. Student C: One requirement not_approved -> overallStatus = not_approved, printableAvailable = false', async () => {
    const doc = await getAdminFirestore().collection('clearanceApplications').doc('app-student-c').get();
    assert.equal(doc.data()?.overallStatus, 'not_approved');
    assert.equal(doc.data()?.printableAvailable, false);
    const studentCSession = await getSessionCookieForUser('student.c@example.test', 'password123');
    process.env.TEST_SESSION_COOKIE = studentCSession;
    const certRes = await fetchClearanceCertificateAction('app-student-c');
    assert.equal(certRes.success, false);
    if (!certRes.success) {
      assert.match(certRes.error, /certificate unavailable|has not been fully approved yet/i);
    }
  });
});
