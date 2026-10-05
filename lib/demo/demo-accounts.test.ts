import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_ACCOUNT_DEFINITIONS,
  DEMO_ACCOUNT_GROUPS,
  shouldShowDemoAccountPicker,
} from './demo-accounts';
import { DEMO_APPLICATION_FIXTURES, DEMO_STUDENT_FIXTURES } from '@/tests/fixtures/demo-data';
import { isActiveStudentProgramCode } from '@/lib/academic-programs';
import { isStudentProfileSemester, isStudentYearLevel } from '@/lib/student-profile-options';

test('demo account picker is restricted to Demo Mode plus Firebase Emulator Mode', () => {
  assert.equal(shouldShowDemoAccountPicker(true, true), true);
  assert.equal(shouldShowDemoAccountPicker(true, false), false);
  assert.equal(shouldShowDemoAccountPicker(false, true), false);
  assert.equal(shouldShowDemoAccountPicker(false, false), false);
});

test('demo account directory exposes every required student and staff identity', () => {
  assert.deepEqual(DEMO_ACCOUNT_GROUPS, [
    'Students',
    'Clearance Signatories',
    'Financial / Oversight',
    'Administration',
  ]);
  assert.equal(DEMO_ACCOUNT_DEFINITIONS.length, 14);

  const labels = DEMO_ACCOUNT_DEFINITIONS.map((account) => account.label);
  for (const label of [
    'Student A — Approved',
    'Student B — Pending',
    'Student C — Not Approved',
    'Student D — Unpaid Hold',
    'Student E — Temporary Password',
    'Student F — Inactive',
    'Student G — Live Journey',
    'Librarian',
    'OSA Coordinator',
    'Guidance Counselor',
    'Area Chair',
    'Accountant',
    'Dean',
    'System Administrator',
  ]) {
    assert.ok(labels.includes(label), `missing demo account: ${label}`);
  }
});

test('student fixtures use PKM programs and applications match their profiles', () => {
  const expected = new Map([
    ['student.a@example.test', 'BSAIS'],
    ['student.b@example.test', 'BSMA'],
    ['student.c@example.test', 'BSAIS'],
    ['student.d@example.test', 'BSMA'],
    ['student.e@example.test', 'BSAIS'],
    ['student.f@example.test', 'BSMA'],
    ['student.g@example.test', 'BSAIS'],
  ]);

  for (const student of DEMO_STUDENT_FIXTURES) {
    assert.ok(student.program);
    assert.ok(isActiveStudentProgramCode(student.program));
    assert.ok(isStudentYearLevel(student.yearLevel));
    assert.ok(isStudentProfileSemester(student.semester));
    assert.equal(student.program, expected.get(student.email));
  }

  for (const application of DEMO_APPLICATION_FIXTURES) {
    const student = DEMO_STUDENT_FIXTURES.find((item) => item.uid === application.studentUid);
    assert.equal(application.program, student?.program);
  }
});
