/**
 * Clean, accessible, and secure transactional email templates for ASCS PKM.
 * All dynamic student and administrator content is HTML-escaped to prevent injection.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface RegistrationApprovedEmailInput {
  fullName: string;
  email: string;
  loginUrl: string;
}

export interface RegistrationRejectedEmailInput {
  fullName: string;
  email: string;
  rejectionReason: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderRegistrationApprovedEmail(
  input: RegistrationApprovedEmailInput
): RenderedEmail {
  const safeName = escapeHtml(input.fullName || 'Student');
  const safeEmail = escapeHtml(input.email);
  const safeLoginUrl = escapeHtml(input.loginUrl);

  const subject = 'ASCS PKM — Student Registration Approved';

  const text = `Hello ${input.fullName || 'Student'},

Your registration for the Automated Student Clearance System (ASCS) at Pamantasan ng Kolehiyo ng Mauban has been approved by the system administrator.

You can now sign in using your registered email address (${input.email}) to submit and track your clearance application.

Sign in here: ${input.loginUrl}

If you did not request this registration, please contact the PKM Administrator.

Best regards,
ASCS PKM Administration`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .title { color: #0f172a; font-size: 20px; font-weight: 700; margin: 0; }
    .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    .status-badge { display: inline-block; background-color: #dcfce7; color: #15803d; font-size: 12px; font-weight: 600; padding: 4px 12px; rounded-full; border-radius: 9999px; margin-bottom: 16px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; margin: 20px 0; }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">ASCS PKM</h1>
      <p class="subtitle">Automated Student Clearance System</p>
    </div>
    <div style="text-align: center;">
      <span class="status-badge">Registration Approved</span>
    </div>
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>Your registration for the Automated Student Clearance System at Pamantasan ng Kolehiyo ng Mauban has been approved by the system administrator.</p>
    <p>Your registered email address <strong>${safeEmail}</strong> is now active. You may log in to submit and track your clearance applications.</p>
    <div style="text-align: center;">
      <a href="${safeLoginUrl}" class="btn" style="color: #ffffff;">Sign In to ASCS</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this link into your browser:<br><a href="${safeLoginUrl}" style="color: #0284c7;">${safeLoginUrl}</a></p>
    <div class="footer">
      <p>This is an automated notification from ASCS PKM. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

export function renderRegistrationRejectedEmail(
  input: RegistrationRejectedEmailInput
): RenderedEmail {
  const safeName = escapeHtml(input.fullName || 'Student');
  const safeReason = escapeHtml(input.rejectionReason || 'No reason provided.');

  const subject = 'ASCS PKM — Student Registration Status Update';

  const text = `Hello ${input.fullName || 'Student'},

Thank you for your interest in registering for the Automated Student Clearance System (ASCS) at Pamantasan ng Kolehiyo ng Mauban.

Your registration request could not be approved at this time for the following reason:

${input.rejectionReason}

If you believe this decision was made in error or if you need to update your student information, please contact the PKM Administration Office or submit a new registration with the correct details.

Best regards,
ASCS PKM Administration`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .title { color: #0f172a; font-size: 20px; font-weight: 700; margin: 0; }
    .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    .status-badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .reason-box { background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 6px; margin: 20px 0; font-size: 14px; color: #334155; }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">ASCS PKM</h1>
      <p class="subtitle">Automated Student Clearance System</p>
    </div>
    <div style="text-align: center;">
      <span class="status-badge">Registration Not Approved</span>
    </div>
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>Thank you for submitting a registration request for the Automated Student Clearance System at Pamantasan ng Kolehiyo ng Mauban.</p>
    <p>Your registration could not be approved by the administrator. Reason provided:</p>
    <div class="reason-box">
      <strong>Administrator Remarks:</strong><br>
      ${safeReason}
    </div>
    <p style="font-size: 13px; color: #64748b;">If you need assistance or believe this was an error, please coordinate with the PKM Administration Office or submit a corrected registration.</p>
    <div class="footer">
      <p>This is an automated notification from ASCS PKM. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}
