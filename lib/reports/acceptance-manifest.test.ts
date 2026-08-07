import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INTEGRATION_SCENARIOS } from '../../scripts/acceptance-manifest';

describe('Acceptance Manifest Verification', () => {
  it('ensures every tests/integration/*.test.ts file on disk is registered in acceptance-manifest.ts', () => {
    const integrationDir = path.resolve(process.cwd(), 'tests', 'integration');
    const filesOnDisk = fs
      .readdirSync(integrationDir)
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => `tests/integration/${f}`);

    const manifestFiles = INTEGRATION_SCENARIOS.map((s) => s.file);

    for (const file of filesOnDisk) {
      assert.ok(
        manifestFiles.includes(file),
        `DISCREPANCY: Integration test file '${file}' exists on disk but is omitted from scripts/acceptance-manifest.ts!`
      );
    }

    assert.equal(
      manifestFiles.length,
      filesOnDisk.length,
      `Manifest has ${manifestFiles.length} files but disk has ${filesOnDisk.length} files.`
    );
  });
});
