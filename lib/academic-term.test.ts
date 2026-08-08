import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSemester,
  getSemesterStorageAliases,
  getApplicationTermDocumentIds,
} from './academic-term';

test('1. 1st normalizes to 1st Semester', () => {
  assert.equal(normalizeSemester('1st'), '1st Semester');
});

test('2. 1st Semester remains canonical', () => {
  assert.equal(normalizeSemester('1st Semester'), '1st Semester');
});

test('3. 2nd normalizes correctly', () => {
  assert.equal(normalizeSemester('2nd'), '2nd Semester');
});

test('4. 2nd Semester remains canonical', () => {
  assert.equal(normalizeSemester('2nd Semester'), '2nd Semester');
});

test('5. Summer normalizes correctly', () => {
  assert.equal(normalizeSemester('Summer'), 'Summer Semester');
});

test('6. Summer Semester remains canonical', () => {
  assert.equal(normalizeSemester('Summer Semester'), 'Summer Semester');
});

test('7. Empty semester rejected', () => {
  assert.throws(() => normalizeSemester(''), /Semester cannot be empty/);
  assert.throws(() => normalizeSemester('   '), /Semester cannot be empty/);
});

test('8. Unknown semester rejected', () => {
  assert.throws(() => normalizeSemester('First'), /Invalid semester specified/);
  assert.throws(() => normalizeSemester('1'), /Invalid semester specified/);
  assert.throws(() => normalizeSemester('Sem1'), /Invalid semester specified/);
  assert.throws(() => normalizeSemester('Third Semester'), /Invalid semester specified/);
});

test('9. Non-string rejected', () => {
  assert.throws(() => normalizeSemester(null), /Semester must be a string/);
  assert.throws(() => normalizeSemester(undefined), /Semester must be a string/);
  assert.throws(() => normalizeSemester(123), /Semester must be a string/);
  assert.throws(() => normalizeSemester({}), /Semester must be a string/);
});

test('10. Alias list for 1st contains canonical + legacy', () => {
  const aliases = getSemesterStorageAliases('1st Semester');
  assert.deepEqual(aliases, ['1st Semester', '1st']);
  const aliasesFromShort = getSemesterStorageAliases('1st');
  assert.deepEqual(aliasesFromShort, ['1st Semester', '1st']);
});

test('11. Alias list for 2nd contains canonical + legacy', () => {
  const aliases = getSemesterStorageAliases('2nd Semester');
  assert.deepEqual(aliases, ['2nd Semester', '2nd']);
});

test('12. Alias list for Summer contains canonical + legacy', () => {
  const aliases = getSemesterStorageAliases('Summer Semester');
  assert.deepEqual(aliases, ['Summer Semester', 'Summer']);
});

test('13. Application-term document IDs include legacy and canonical possibilities', () => {
  const docIds = getApplicationTermDocumentIds('student-uid-1', '2026-2027', '1st Semester');
  assert.deepEqual(docIds, [
    'student-uid-1_2026-2027_1st-Semester',
    'student-uid-1_2026-2027_1st',
  ]);

  const legacyDocIds = getApplicationTermDocumentIds('student-uid-1', '2026-2027', '1st');
  assert.deepEqual(legacyDocIds, [
    'student-uid-1_2026-2027_1st-Semester',
    'student-uid-1_2026-2027_1st',
  ]);
});
