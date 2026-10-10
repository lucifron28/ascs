import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  renderRegistrationApprovedEmail,
  renderRegistrationRejectedEmail,
} from './templates';
import {
  isFictionalOrTestEmail,
  sendEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
} from './service';

test('1. escapeHtml escapes special characters to prevent HTML injection', () => {
  assert.equal(
    escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );
  assert.equal(
    escapeHtml("John & Mary's Book"),
    'John &amp; Mary&#039;s Book'
  );
});

test('2. renderRegistrationApprovedEmail renders clean approval email with student details', () => {
  const { subject, html, text } = renderRegistrationApprovedEmail({
    fullName: 'Juan dela Cruz',
    email: 'juan@example.test',
    loginUrl: 'https://ascs-one.vercel.app/login',
  });

  assert.equal(subject, 'ASCS PKM — Student Registration Approved');
  assert.ok(html.includes('Juan dela Cruz'));
  assert.ok(html.includes('juan@example.test'));
  assert.ok(html.includes('https://ascs-one.vercel.app/login'));
  assert.ok(text.includes('Juan dela Cruz'));
  assert.ok(text.includes('has been approved'));
});

test('3. renderRegistrationApprovedEmail escapes potentially dangerous content', () => {
  const { html } = renderRegistrationApprovedEmail({
    fullName: '<img src=x onerror=alert(1)>',
    email: 'attacker@example.test',
    loginUrl: 'https://ascs-one.vercel.app/login',
  });

  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
});

test('4. renderRegistrationRejectedEmail renders rejection email containing administrator remarks', () => {
  const { subject, html, text } = renderRegistrationRejectedEmail({
    fullName: 'Maria Clara',
    email: 'maria@example.test',
    rejectionReason: 'Invalid student ID number. Please provide official ID.',
  });

  assert.equal(subject, 'ASCS PKM — Student Registration Status Update');
  assert.ok(html.includes('Maria Clara'));
  assert.ok(html.includes('Invalid student ID number. Please provide official ID.'));
  assert.ok(text.includes('Invalid student ID number. Please provide official ID.'));
});

test('5. renderRegistrationRejectedEmail escapes dangerous input in rejection reason', () => {
  const { html } = renderRegistrationRejectedEmail({
    fullName: 'Maria Clara',
    email: 'maria@example.test',
    rejectionReason: '<script>evil()</script>',
  });

  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;evil()&lt;/script&gt;'));
});

test('6. isFictionalOrTestEmail identifies fictional and test email addresses', () => {
  assert.equal(isFictionalOrTestEmail('student@example.test'), true);
  assert.equal(isFictionalOrTestEmail('user@test.test'), true);
  assert.equal(isFictionalOrTestEmail('test@example.com'), true);
  assert.equal(isFictionalOrTestEmail('admin@localhost'), true);
  assert.equal(isFictionalOrTestEmail('realstudent@gmail.com'), false);
  assert.equal(isFictionalOrTestEmail('student@pkm.edu.ph'), false);
});

test('7. sendEmail simulates delivery without network request for fictional test addresses', async () => {
  const result = await sendEmail({
    to: 'student@example.test',
    subject: 'Test Subject',
    html: '<p>Test</p>',
    text: 'Test',
  });

  assert.equal(result.success, true);
  assert.equal(result.simulated, true);
  assert.ok(result.id?.startsWith('sim-'));
});

test('8. sendEmail simulates delivery when running under test environment', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const result = await sendEmail({
      to: 'realstudent@gmail.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    });

    assert.equal(result.success, true);
    assert.equal(result.simulated, true);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('9. sendRegistrationApprovedEmail formats and delivers simulated email', async () => {
  const result = await sendRegistrationApprovedEmail({
    to: 'student@example.test',
    fullName: 'Juan dela Cruz',
  });

  assert.equal(result.success, true);
  assert.equal(result.simulated, true);
});

test('10. sendRegistrationRejectedEmail formats and delivers simulated email with reason', async () => {
  const result = await sendRegistrationRejectedEmail({
    to: 'student@example.test',
    fullName: 'Maria Clara',
    rejectionReason: 'Invalid student credentials.',
  });

  assert.equal(result.success, true);
  assert.equal(result.simulated, true);
});

test('11. sendEmail returns descriptive error when Gmail SMTP credentials are not configured', async () => {
  const originalEnv = { ...process.env };
  delete process.env.NODE_ENV;
  delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;
  delete process.env.FIREBASE_EMULATOR_HUB;
  delete process.env.GMAIL_USER;
  delete process.env.SMTP_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_PASSWORD;

  try {
    const result = await sendEmail({
      to: 'realstudent@gmail.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    });

    assert.equal(result.success, false);
    assert.match(result.error || '', /Gmail SMTP credentials .* are not configured/);
  } finally {
    process.env = originalEnv;
  }
});
