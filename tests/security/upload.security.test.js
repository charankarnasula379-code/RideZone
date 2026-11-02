/**
 * RideZone Security Test Suite: Upload Endpoint Hardening & Magic-Byte Validation
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

async function runUploadSecurityTests() {
  console.log("==================================================");
  console.log("   TEST SUITE: UPLOAD SECURITY & MAGIC BYTES      ");
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
    // 1. Create a customer for auth token
    const email = `uploader_${Date.now()}@example.com`;
    const regRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Uploader Rider',
      email,
      password: 'password123',
      phone: '+91 9988776655'
    });
    const token = regRes.data.token;

    // 2. Unauthenticated Upload Rejection
    console.log("--- 1. Unauthenticated Upload Rejection ---");
    const unauthRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/upload',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      filename: "test.png"
    });
    assert("Unauthenticated upload rejected (HTTP 401)", unauthRes.status === 401);

    // 3. Valid PNG Upload
    console.log("\n--- 2. Valid PNG Magic Bytes Acceptance ---");
    const validPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const validPngRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      dataUrl: validPngBase64,
      filename: "valid-avatar.png"
    });
    assert("Valid PNG with real magic bytes accepted (HTTP 200)", validPngRes.status === 200);
    assert("Safe URL path returned (/uploads/)", validPngRes.data && validPngRes.data.url.startsWith("/uploads/"));

    // 4. Fake JPEG containing Script / HTML Payload Rejection
    console.log("\n--- 3. Fake JPEG with Script Content Rejection ---");
    const fakeJpgBase64 = "data:image/jpeg;base64," + Buffer.from("<script>alert('pwned')</script>").toString("base64");
    const fakeJpgRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      dataUrl: fakeJpgBase64,
      filename: "exploit.jpg"
    });
    assert("Fake JPEG without real magic bytes rejected (HTTP 400)", fakeJpgRes.status === 400);

    // 5. SVG / Script Vector Rejection
    console.log("\n--- 4. SVG Vector Rejection ---");
    const svgBase64 = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>').toString("base64");
    const svgRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      dataUrl: svgBase64,
      filename: "vector.svg"
    });
    assert("SVG format strictly rejected to prevent XSS (HTTP 400)", svgRes.status === 400);

    // 6. Oversized Image Rejection (>5MB)
    console.log("\n--- 5. Oversized Payload Rejection ---");
    const hugeBuffer = Buffer.alloc(6 * 1024 * 1024, 0); // 6MB
    // Add PNG magic bytes to the huge buffer
    hugeBuffer[0] = 0x89; hugeBuffer[1] = 0x50; hugeBuffer[2] = 0x4E; hugeBuffer[3] = 0x47;
    hugeBuffer[4] = 0x0D; hugeBuffer[5] = 0x0A; hugeBuffer[6] = 0x1A; hugeBuffer[7] = 0x0A;
    const hugeBase64 = "data:image/png;base64," + hugeBuffer.toString("base64");

    const hugeRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      dataUrl: hugeBase64,
      filename: "oversized.png"
    });
    assert("Oversized payload >5MB rejected (HTTP 413)", hugeRes.status === 413);

    console.log("\n==================================================");
    console.log(`UPLOAD TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Upload security test error:", err);
  }
}

runUploadSecurityTests();
