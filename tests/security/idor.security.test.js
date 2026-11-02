/**
 * RideZone Security Test Suite: Insecure Direct Object Reference (IDOR) & Tenant Isolation
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

async function runIdorSecurityTests() {
  console.log("==================================================");
  console.log("   TEST SUITE 3: IDOR & TENANT ISOLATION TESTS    ");
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
    // 1. Create User A
    const emailA = `user_a_${Date.now()}@example.com`;
    const regA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'User Alice',
      email: emailA,
      password: 'passwordAlice123',
      phone: '+91 9111111111'
    });
    const tokenA = regA.data.token;

    // 2. Create User B
    const emailB = `user_b_${Date.now()}@example.com`;
    const regB = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'User Bob',
      email: emailB,
      password: 'passwordBob123',
      phone: '+91 9222222222'
    });
    const tokenB = regB.data.token;

    // 3. User A creates a booking
    console.log("--- 1. User A Creates a Booking ---");
    const randomOffset = 100 + Math.floor(Math.random() * 1000);
    const uniqueDate = new Date(Date.now() + randomOffset * 86400000).toISOString().split('T')[0];
    const bookResA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      }
    }, {
      vehicle: 'Yamaha MT-15 V2',
      date: uniqueDate,
      time: '12:00',
      hours: 3,
      payment_method: 'UPI'
    });

    assert("User A booking created successfully", bookResA.status === 201);
    const bookingIdA = bookResA.data.booking.id;

    // 4. User B checks their booking list
    console.log("\n--- 2. Booking List Isolation ---");
    const listResB = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/user/bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });

    assert("User B booking list returns HTTP 200", listResB.status === 200);
    const bookingsB = listResB.data.bookings || [];
    const containsAliceBooking = bookingsB.some(b => b.id === bookingIdA);
    assert("User B CANNOT see User A's booking in /api/user/bookings", !containsAliceBooking);

    // 5. User B attempts to cancel User A's booking (IDOR Attack)
    console.log("\n--- 3. IDOR Cancellation Attack Prevention ---");
    const cancelAttackRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/user/bookings/${bookingIdA}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      }
    });

    assert("User B cannot cancel User A's booking (HTTP 404/403)", [403, 404].includes(cancelAttackRes.status));

    // Verify User A's booking remains Active / Confirmed
    const listResA = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/user/bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const aliceBooking = (listResA.data.bookings || []).find(b => b.id === bookingIdA);
    assert("User A's booking remains Confirmed despite User B's attack", aliceBooking && aliceBooking.booking_status === 'Confirmed');

    // Cleanup test booking and users
    try {
      const mysql = require('mysql2/promise');
      const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ridezone'
      });
      if (bookingIdA) await pool.query('DELETE FROM bookings WHERE id = ?', [bookingIdA]);
      await pool.query('DELETE FROM users WHERE email IN (?, ?)', [emailA, emailB]);
      await pool.end();
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

    console.log("\n==================================================");
    console.log(`IDOR SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("IDOR security test unhandled error:", err);
  }
}

runIdorSecurityTests();
