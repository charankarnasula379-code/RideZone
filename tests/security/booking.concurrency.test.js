/**
 * RideZone Concurrency Test Suite: 50 Simultaneous Overlapping Booking Requests
 * Verifies that strict transaction isolation & row-level locks prevent double-booking.
 * Expected outcome: EXACTLY 1 booking succeeds (201 Created), 49 conflict (409 Conflict).
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

async function runBookingConcurrencyTest() {
  console.log("==================================================");
  console.log("  TEST SUITE: 50-CLIENT CONCURRENT BOOKING TEST  ");
  console.log("==================================================\n");

  try {
    // 1. Create a test rider account
    const email = `concurrency_rider_${Date.now()}@example.com`;
    const regRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Concurrency Tester',
      email,
      password: 'password123',
      phone: '+91 9123456789'
    });

    const token = regRes.data.token;
    if (!token) throw new Error("Could not acquire customer token");

    // 2. Select a target vehicle and schedule with a unique isolated future date
    const targetVehicle = "Kawasaki Ninja 300";
    const randomFutureOffsetDays = 30 + Math.floor(Math.random() * 500);
    const targetDate = new Date(Date.now() + randomFutureOffsetDays * 86400000).toISOString().split('T')[0];
    const targetTime = "14:00";
    const duration = 5;

    console.log(`Launching 50 simultaneous booking requests for '${targetVehicle}' on ${targetDate} at ${targetTime} (${duration} hrs)...`);

    const requests = [];
    const totalRequests = 50;

    for (let i = 0; i < totalRequests; i++) {
      requests.push(
        makeRequest({
          hostname: 'localhost',
          port: 3001,
          path: '/api/bookings',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }, {
          vehicle: targetVehicle,
          date: targetDate,
          time: targetTime,
          hours: duration,
          payment_method: 'UPI'
        })
      );
    }

    // Await all 50 concurrent requests simultaneously
    const results = await Promise.all(requests);

    let successCount = 0;
    let conflictCount = 0;
    let otherCount = 0;

    results.forEach((res) => {
      if (res.status === 201) successCount++;
      else if (res.status === 409) conflictCount++;
      else {
        otherCount++;
        console.error(`Unexpected status code: ${res.status}`, res.data);
      }
    });

    console.log(`\nConcurrency Execution Results:`);
    console.log(`- 201 Created (Successful): ${successCount}`);
    console.log(`- 409 Conflict (Blocked):    ${conflictCount}`);
    console.log(`- Other Statuses:            ${otherCount}`);

    console.log("\n==================================================");
    if (successCount === 1 && conflictCount === 49 && otherCount === 0) {
      console.log("[PASS] RACE CONDITION RESOLVED: Exactly 1 booking created, 49 rejected!");
    } else {
      console.error(`[FAIL] CONCURRENCY VIOLATION: Successes = ${successCount}, Conflicts = ${conflictCount}`);
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
      const successfulBooking = results.find(r => r.status === 201)?.data?.booking?.id;
      if (successfulBooking) await pool.query('DELETE FROM bookings WHERE id = ?', [successfulBooking]);
      await pool.query('DELETE FROM users WHERE email = ?', [email]);
      await pool.end();
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

  } catch (err) {
    console.error("Booking concurrency test error:", err);
  }
}

runBookingConcurrencyTest();
