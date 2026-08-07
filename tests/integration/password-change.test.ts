import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, getSessionCookieForUser, getIdTokenForUser } from '../helpers/test-auth';
import { resetEmulator } from '@/scripts/reset-emulator';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { getAuthenticatedUser, getAuthenticatedUserForPasswordChange } from '@/lib/auth/session';
import { POST as changePasswordRoute } from '@/app/api/auth/change-password/route';
import { NextRequest } from 'next/server';

describe('Mandatory Password Change Integration Tests', () => {
  before(async () => {
    setupTestEnvironment();
    await resetEmulator();
  });

  it('Covers complete mandatory password change workflow (1-10)', async () => {
    const userUid = 'demo-student-e-uid';
    const email = 'student.e@example.test';
    const oldPassword = 'password123';
    const newPassword = 'NewPassword456!';

    // 1. Temporary-password user authenticates & obtains session cookie
    const oldSession = await getSessionCookieForUser(email, oldPassword);
    assert.ok(oldSession);
    process.env.TEST_SESSION_COOKIE = oldSession;

    // 2. Session/profile retrieval for password change succeeds
    const userForPassChange = await getAuthenticatedUserForPasswordChange(oldSession);
    assert.equal(userForPassChange.user.mustChangePassword, true);

    // 3. Normal server action / normal auth check is REJECTED while mustChangePassword === true
    await assert.rejects(
      async () => {
        await getAuthenticatedUser(oldSession);
      },
      {
        message: 'Password change required before accessing this operation.',
      }
    );

    // 4. Incorrect current password fails in route
    const badReq = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ascs_session=${oldSession}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword999',
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const badRes = await changePasswordRoute(badReq);
    assert.ok([400, 401].includes(badRes.status));

    // 5. Correct current password changes password
    process.env.TEST_SESSION_COOKIE = oldSession;
    const goodReq = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ascs_session=${oldSession}`,
      },
      body: JSON.stringify({
        currentPassword: oldPassword,
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });

    const goodRes = await changePasswordRoute(goodReq);
    assert.equal(goodRes.status, 200);

    // 6. mustChangePassword becomes false in Firestore & Auth
    const userDoc = await getAdminFirestore().collection('users').doc(userUid).get();
    assert.equal(userDoc.data()?.mustChangePassword, false);

    const authUser = await getAdminAuth().getUser(userUid);
    assert.equal(authUser.customClaims?.mustChangePassword, false);

    // 7 & 8. Old password / old session no longer authenticates
    await assert.rejects(async () => {
      await getIdTokenForUser(email, oldPassword);
    });

    // 9. New password authenticates
    const newSession = await getSessionCookieForUser(email, newPassword);
    assert.ok(newSession);
    process.env.TEST_SESSION_COOKIE = newSession;

    // 10. User may now access normal operations!
    const activeUser = await getAuthenticatedUser(newSession);
    assert.equal(activeUser.uid, userUid);
    assert.equal(activeUser.user.mustChangePassword, false);
  });
});
