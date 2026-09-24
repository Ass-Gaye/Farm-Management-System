const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

// Expose reset token in API response for this integration test.
// Production must use email/SMS delivery (ALLOW_RESET_TOKEN_IN_RESPONSE=false).
process.env.ALLOW_RESET_TOKEN_IN_RESPONSE = "true";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const prisma = require("../src/lib/prisma");
const { app } = require("../src/server");

const testResetEmail = "reset_test_farmer@example.com";
let server;
let baseUrl;

const request = async (path, options = {}) => {
  const { headers, ...restOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const body = await response.json();
  return {
    status: response.status,
    body,
  };
};

const cleanup = async () => {
  await prisma.user.deleteMany({
    where: {
      email: testResetEmail,
    },
  });
};

before(async () => {
  await cleanup();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await cleanup();
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

test("Password reset workflow: request, token generation, reset, and login with new password", async () => {
  // 1. Register test user
  const regRes = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: testResetEmail,
      password: "OldPassword123",
      name: "Reset Test User",
    }),
  });
  assert.equal(regRes.status, 201);

  // 2. Request password reset (forgot-password)
  const forgotRes = await request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email: testResetEmail,
    }),
  });
  assert.equal(forgotRes.status, 200);
  assert.equal(forgotRes.body.success, true);
  assert.ok(forgotRes.body.data.resetToken);
  const resetToken = forgotRes.body.data.resetToken;

  // 3. Test non-existent user returns generic success message (prevents user enumeration)
  const nonExistentForgot = await request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email: "unknown_farmer_xyz@example.com",
    }),
  });
  assert.equal(nonExistentForgot.status, 200);
  assert.equal(nonExistentForgot.body.success, true);
  assert.equal(nonExistentForgot.body.data, undefined); // No token returned for unknown user

  // 4. Test reset-password with invalid token
  const invalidReset = await request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token: "invalid.token.here12345",
      newPassword: "NewPassword123",
    }),
  });
  assert.equal(invalidReset.status, 400);

  // 5. Reset password with valid token
  const validReset = await request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token: resetToken,
      newPassword: "NewPassword123",
    }),
  });
  assert.equal(validReset.status, 200);
  assert.equal(validReset.body.success, true);

  // 6. Test token cannot be reused (it is automatically invalidated because password hash changed)
  const reuseReset = await request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token: resetToken,
      newPassword: "AnotherPassword123",
    }),
  });
  assert.equal(reuseReset.status, 400);

  // 7. Verify old password no longer works
  const oldLoginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: testResetEmail,
      password: "OldPassword123",
    }),
  });
  assert.equal(oldLoginRes.status, 401);

  // 8. Verify new password logs in successfully
  const newLoginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: testResetEmail,
      password: "NewPassword123",
    }),
  });
  assert.equal(newLoginRes.status, 200);
  assert.ok(newLoginRes.body.data.token);
});
