/**
 * RideZone Security Test Suite: Security Headers & Error Response Hardening
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

async function runSecurityHeadersTests() {
  console.log("==================================================");
  console.log("  TEST SUITE 9: SECURITY HEADERS & ERROR HARDENING ");
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
    console.log("--- 1. HTTP Security Response Headers ---");
    const res = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/vehicles',
      method: 'GET'
    });

    const headers = res.headers;

    assert("X-Content-Type-Options is set to 'nosniff'", headers['x-content-type-options'] === 'nosniff');
    assert("X-Frame-Options is set to 'SAMEORIGIN'", headers['x-frame-options'] === 'SAMEORIGIN');
    assert("X-XSS-Protection is enabled", headers['x-xss-protection'] && headers['x-xss-protection'].includes('1'));
    assert("Referrer-Policy header is configured", !!headers['referrer-policy']);
    assert("Content-Security-Policy header is present", !!headers['content-security-policy']);

    console.log("\n--- 2. Error Response Leakage Prevention ---");
    const badJsonRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: "nonexistent@example.com",
      password: "wrong"
    });

    const errorPayload = typeof badJsonRes.data === 'string' ? badJsonRes.data : JSON.stringify(badJsonRes.data);
    assert("Error response does NOT leak stack trace", !errorPayload.includes(" at ") && !errorPayload.includes("node_modules"));
    assert("Error response does NOT leak SQL queries or syntax", !errorPayload.includes("SELECT") && !errorPayload.includes("FROM users"));

    console.log("\n==================================================");
    console.log(`SECURITY HEADERS RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Security headers test unhandled error:", err);
  }
}

runSecurityHeadersTests();
