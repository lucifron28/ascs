import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeanApprovalData } from './migrate-adviser-to-dean';

const baseInput = {
  deanUid: 'dean-uid',
  deanName: 'Academic Dean',
  now: '2026-08-17T00:00:00.000Z',
};

test('legacy approved Adviser becomes a pending Dean decision without copied action data', () => {
  const dean = buildDeanApprovalData({
    ...baseInput,
    existingDeanApproval: null,
    legacyAdviserApproval: {
      status: 'approved',
      remarksLatest: 'Adviser approved this record',
      actedById: 'adviser-uid',
      actedByName: 'Class Adviser',
      actedAt: '2026-08-16T00:00:00.000Z',
    },
    legacyApprovalId: 'adviser',
  });

  assert.equal(dean.signatoryRole, 'dean');
  assert.equal(dean.status, 'pending');
  assert.equal(dean.remarksLatest, null);
  assert.equal(dean.actedById, null);
  assert.equal(dean.actedByName, null);
  assert.equal(dean.actedAt, null);
  assert.equal(dean.legacySourceApprovalId, 'adviser');
  assert.equal(dean.migratedFromLegacyAdviser, true);
});

test('legacy rejected Adviser also becomes pending rather than a Dean rejection', () => {
  const dean = buildDeanApprovalData({
    ...baseInput,
    existingDeanApproval: null,
    legacyAdviserApproval: {
      status: 'not_approved',
      remarksLatest: 'Missing document',
      actedById: 'adviser-uid',
      actedAt: '2026-08-16T00:00:00.000Z',
    },
    legacyApprovalId: 'adviser',
  });

  assert.equal(dean.status, 'pending');
  assert.equal(dean.remarksLatest, null);
  assert.equal(dean.actedAt, null);
});

test('a genuine Dean decision is preserved and wins over legacy Adviser history', () => {
  const dean = buildDeanApprovalData({
    ...baseInput,
    existingDeanApproval: {
      status: 'approved',
      assignedSignatoryId: 'old-dean-uid',
      assignedSignatoryName: 'Former Dean',
      remarksLatest: 'Dean reviewed the record',
      actedById: 'real-dean-actor',
      actedByName: 'Academic Dean',
      actedAt: '2026-08-16T12:00:00.000Z',
    },
    legacyAdviserApproval: {
      status: 'not_approved',
      remarksLatest: 'Legacy note',
      actedById: 'adviser-uid',
    },
  });

  assert.equal(dean.status, 'approved');
  assert.equal(dean.remarksLatest, 'Dean reviewed the record');
  assert.equal(dean.actedById, 'real-dean-actor');
  assert.equal(dean.actedByName, 'Academic Dean');
  assert.equal(dean.actedAt, '2026-08-16T12:00:00.000Z');
  assert.equal(dean.assignedSignatoryId, 'dean-uid');
  assert.equal(dean.assignedSignatoryName, 'Academic Dean');
});

test('an existing Dean row is reused on a second run rather than duplicated', () => {
  const first = buildDeanApprovalData({
    ...baseInput,
    existingDeanApproval: null,
    legacyAdviserApproval: { status: 'approved' },
    legacyApprovalId: 'adviser',
  });
  const second = buildDeanApprovalData({
    ...baseInput,
    existingDeanApproval: first,
    legacyAdviserApproval: { status: 'approved', remarksLatest: 'Old Adviser data' },
    legacyApprovalId: 'adviser',
  });

  assert.equal(second.status, 'pending');
  assert.equal(second.remarksLatest, null);
  assert.equal(second.actedAt, null);
  assert.equal(second.signatoryRole, 'dean');
  assert.equal(second.requirementId, 'dean');
});
