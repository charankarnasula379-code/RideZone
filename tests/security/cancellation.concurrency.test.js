/**
 * RideZone Concurrency Test Suite: 20 Simultaneous Cancellation Requests
 * Verifies that atomic conditional updates prevent double-refund and race conditions.
 * Expected outcome: EXACTLY 1 cancellation succeeds (200 OK), 19 are rejected (400/409).
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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

async function runCancellationConcurrencyTest() {
  console.log("==================================================");
  console.log("TEST SUITE: 20-CLIENT CONCURRENT CANCELLATION TEST");
  console.log("==================================================\n");

  try {
    // 1. Create a customer
    const email = `cancel_tester_${Date.now()}@example.com`;
    const regRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Cancel Tester',
      email,
      password: 'password123',
      phone: '+91 9123456789'
    });
    const token = regRes.data.token;

    // 2. Create a booking to cancel
    const bookRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      vehicle: "Honda Activa 6G",
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: "10:00",
      hours: 2,
      payment_method: "UPI"
    });

    const bookingId = bookRes.data.booking.id;
    console.log(`Created booking '${bookingId}' (Total: ₹${bookRes.data.booking.total_price}).`);
    console.log(`Launching 20 simultaneous cancellation requests for booking '${bookingId}'...`);

    const requests = [];
    const totalRequests = 20;

    for (let i = 0; i < totalRequests; i++) {
      requests.push(
        makeRequest({
          hostname: 'localhost',
          port: 3001,
          path: `/api/user/bookings/${bookingId}/cancel`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
      );
    }

    const results = await Promise.all(requests);

    let successCount = 0;
    let rejectedCount = 0;
    let otherCount = 0;

    results.forEach((res) => {
      if (res.status === 200) successCount++;
      else if (res.status === 400 || res.status === 409) rejectedCount++;
      else {
        otherCount++;
        console.error(`Unexpected cancellation status: ${res.status}`, res.data);
      }
    });

    console.log(`\nCancellation Execution Results:`);
    console.log(`- 200 OK (Refund Processed): ${successCount}`);
    console.log(`- 400/409 (State Blocked):   ${rejectedCount}`);
    console.log(`- Other Statuses:            ${otherCount}`);

    console.log("\n==================================================");
    if (successCount === 1 && rejectedCount === 19 && otherCount === 0) {
      console.log("[PASS] ATOMIC CANCELLATION VERIFIED: Exactly 1 refund processed, 19 rejected!");
    } else {
      console.error(`[FAIL] CANCELLATION RACE CONDITION: Successes = ${successCount}, Rejected = ${rejectedCount}`);
    }
    console.log("==================================================");

    // Cleanup test booking and user
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ridezone'
      });
      if (bookingId) await pool.query('DELETE FROM bookings WHERE id = ?', [bookingId]);
      await pool.query('DELETE FROM users WHERE email = ?', [email]);
      await pool.end();
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

  } catch (err) {
    console.error("Cancellation concurrency test error:", err);
  }
}

runCancellationConcurrencyTest();
