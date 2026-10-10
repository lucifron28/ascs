import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeliveryStatus } from './delivery';
import type { SendEmailResult } from './service';

test('1. resolveDeliveryStatus classifies provider outcomes accurately', () => {
  // Provider failure -> 'failed'
  const failedResult: SendEmailResult = {
    success: false,
    error: 'Domain not verified',
  };
  assert.equal(resolveDeliveryStatus(failedResult), 'failed');

  // Test address or emulator simulation -> 'simulated'
  const simulatedResult: SendEmailResult = {
    success: true,
    simulated: true,
    id: 'sim-12345',
  };
  assert.equal(resolveDeliveryStatus(simulatedResult), 'simulated');

  // Real provider send -> 'sent'
  const realResult: SendEmailResult = {
    success: true,
    id: 'msg_re_abc123',
  };
  assert.equal(resolveDeliveryStatus(realResult), 'sent');
});

test('2. resolveDeliveryStatus never conflates simulated delivery with sent delivery', () => {
  const simulated: SendEmailResult = { success: true, simulated: true };
  assert.notEqual(resolveDeliveryStatus(simulated), 'sent');
  assert.equal(resolveDeliveryStatus(simulated), 'simulated');
});
