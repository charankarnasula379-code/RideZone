/**
 * RideZone Security Test Suite: Complete Admin Route Authorization & RBAC Audit
 * Enumerates every single /api/admin/* endpoint and verifies strict admin authorization.
 */

const http = require('http');

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

async function runAdminAuthorizationAudit() {
  console.log("==================================================");
  console.log("  TEST SUITE 2: ADMIN AUTHORIZATION & RBAC AUDIT  ");
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

  try {
    // 1. Create a customer token
    const customerEmail = `cust_rbac_${Date.now()}@example.com`;
    const custReg = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Regular Customer',
      email: customerEmail,
      password: 'password123',
      phone: '+91 9988776655'
    });
    const customerToken = custReg.data.token;

    // 2. Get Admin token
    const adminLogin = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@gmail.com',
      password: 'admin'
    });
    const adminToken = adminLogin.data.token;

    // List of all protected admin routes with their methods and test payloads
    const adminEndpoints = [
      { method: 'GET', path: '/api/admin/stats' },
      { method: 'GET', path: '/api/admin/vehicles' },
      { method: 'GET', path: '/api/admin/vehicles/1' },
      { method: 'GET', path: '/api/admin/bookings' },
      { method: 'GET', path: '/api/admin/bookings/RZ-TEST' },
      { method: 'GET', path: '/api/admin/users' },
      { method: 'GET', path: '/api/admin/users/1' },
      { method: 'GET', path: '/api/admin/payments' },
      { method: 'GET', path: '/api/admin/availability' },
      { method: 'GET', path: '/api/admin/me' },
      { method: 'PUT', path: '/api/admin/profile', body: { name: 'Admin', email: 'admin@gmail.com' } },
      { method: 'POST', path: '/api/admin/change-password', body: { currentPassword: 'admin', newPassword: 'admin' } },
      { method: 'POST', path: '/api/admin/bookings/RZ-TEST/cancel' },
      { method: 'POST', path: '/api/admin/bookings/RZ-TEST/return' }
    ];

    console.log(`Auditing ${adminEndpoints.length} Admin Endpoints against Unauthorized Access...\n`);

    for (const ep of adminEndpoints) {
      // Test A: No token -> Must reject with 401
      const noTokenRes = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: ep.path,
        method: ep.method,
        headers: { 'Content-Type': 'application/json' }
      }, ep.body);
      assert(`Unauthenticated ${ep.method} ${ep.path} rejected (HTTP 401)`, noTokenRes.status === 401, `Status: ${noTokenRes.status}`);

      // Test B: Customer token -> Must reject with 403 Forbidden
      const custTokenRes = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: ep.path,
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerToken}`
        }
      }, ep.body);
      assert(`Customer token on ${ep.method} ${ep.path} rejected (HTTP 403)`, custTokenRes.status === 403, `Status: ${custTokenRes.status}`);

      // Test C: Admin token -> Must allow access (HTTP 200, 201, or 404 for mock ID)
      const adminTokenRes = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: ep.path,
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, ep.body);
      const isAllowed = [200, 201, 400, 404].includes(adminTokenRes.status);
      assert(`Admin token on ${ep.method} ${ep.path} authorized`, isAllowed, `Status: ${adminTokenRes.status}`);
    }

    console.log("\n==================================================");
    console.log(`ADMIN RBAC AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Admin authorization audit unhandled error:", err);
  }
}

runAdminAuthorizationAudit();
