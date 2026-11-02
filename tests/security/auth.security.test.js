/**
 * RideZone Security Test Suite: Authentication, Token Security & Password Lifecycle
 */

const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAuthSecurityTests() {
  console.log("==================================================");
  console.log("   TEST SUITE 1: AUTHENTICATION & TOKEN SECURITY  ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${extra ? '-> ' + extra : ''}`);
      failed++;
    }
  }

  let dbPool = null;

  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ridezone'
    });

    const uniqueEmail = `sec_user_${Date.now()}@example.com`;

    // 1. Missing Token
    console.log("--- 1. Missing Token Handling ---");
    const missingRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET'
    });
    assert("Missing JWT rejected with HTTP 401", missingRes.status === 401);

    // 2. Malformed Token
    console.log("\n--- 2. Malformed Token Handling ---");
    const malformedRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': 'Bearer not.a.valid.jwt.token' }
    });
    assert("Malformed JWT rejected with HTTP 401", malformedRes.status === 401);

    // 3. Register Customer & Check Plaintext Password Prevention
    console.log("\n--- 3. Registration & Password Hashing Verification ---");
    const plainPassword = "SecretPassword123!";
    const regRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Security Test Rider',
      email: uniqueEmail,
      password: plainPassword,
      phone: '+91 9988776655'
    });

    assert("Registration returns HTTP 201", regRes.status === 201);
    const originalToken = regRes.data.token;
    assert("Valid JWT received upon registration", !!originalToken);

    // Verify in database that password is NOT plaintext and starts with bcrypt prefix $2
    const [userDbRows] = await dbPool.query("SELECT password_hash FROM users WHERE email = ?", [uniqueEmail]);
    assert("User record exists in MySQL database", userDbRows.length > 0);
    if (userDbRows.length > 0) {
      const hash = userDbRows[0].password_hash;
      assert("Password is NEVER stored in plaintext", hash !== plainPassword);
      assert("Password is stored as valid bcrypt hash ($2a/$2b)", hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    }

    // 4. Invalid Signature Rejection
    console.log("\n--- 4. Invalid Signature Rejection ---");
    const tamperedToken = originalToken.slice(0, -8) + "XXXXXXXX";
    const tamperedRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tamperedToken}` }
    });
    assert("Tampered token signature rejected with HTTP 401", tamperedRes.status === 401);

    // 5. Password Change Requires Current Password
    console.log("\n--- 5. Password Change Requires Valid Current Password ---");
    const wrongCurrentRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${originalToken}`
      }
    }, {
      currentPassword: 'WRONG_PASSWORD_123',
      newPassword: 'NewSecurePassword456!'
    });
    assert("Password change with wrong current password rejected (HTTP 400)", wrongCurrentRes.status === 400);

    // 6. Valid Password Change & Session Invalidation (Token Revocation)
    console.log("\n--- 6. Password Change & Token Invalidation ---");
    const changePassRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/change-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${originalToken}`
      }
    }, {
      currentPassword: plainPassword,
      newPassword: 'NewSecurePassword456!'
    });
    assert("Valid password change succeeds (HTTP 200)", changePassRes.status === 200);
    const newToken = changePassRes.data.token;
    assert("New JWT issued after password change", !!newToken);

    // Verify old token is now rejected
    const oldTokenAccess = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${originalToken}` }
    });
    assert("Old token invalidated after password update (HTTP 401)", oldTokenAccess.status === 401);

    // Verify new token works
    const newTokenAccess = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${newToken}` }
    });
    assert("New token works properly (HTTP 200)", newTokenAccess.status === 200);

    // 7. Password Reset Token Single-Use & Expiration
    console.log("\n--- 7. Password Reset Token Lifecycle ---");
    const forgotRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/forgot-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: uniqueEmail });

    assert("Forgot password generates reset token", forgotRes.status === 200 && !!forgotRes.data.resetToken);
    const resetToken = forgotRes.data.resetToken;

    // Use reset token
    const resetRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/reset-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      token: resetToken,
      newPassword: 'BrandNewPassword789!'
    });
    assert("Password reset succeeds with valid single-use token", resetRes.status === 200);

    // Try reusing the exact same reset token
    const reuseResetRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/reset-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      token: resetToken,
      newPassword: 'AnotherPassword999!'
    });
    assert("Reusing used reset token rejected (HTTP 400)", reuseResetRes.status === 400);

    console.log("\n==================================================");
    console.log(`AUTH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Auth security test unhandled error:", err);
  } finally {
    if (dbPool) await dbPool.end();
  }
}

runAuthSecurityTests();
