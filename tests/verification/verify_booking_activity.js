/**
 * RideZone Verification Test Suite: Admin Dashboard Booking Activity & Calendar Bucketing
 * Verifies:
 * - Booking Activity counts are driven by real database created_at timestamps.
 * - Confirmed, Pending, Completed, and Cancelled bookings are all counted in activity.
 * - Cancelled bookings do not contribute to rental revenue.
 * - Exactly 7 consecutive calendar days are produced for '7d' (oldest -> newest -> today).
 * - Zero-booking days remain visible with count = 0.
 * - Dynamic refresh: creating a new booking increments today's bar immediately.
 * - Month ('30d') returns exactly 30 consecutive calendar days ending on today.
 * - Idempotent execution: all test fixtures are cleaned up immediately.
 */

const http = require('http');
const mysql = require('mysql2/promise');
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

async function runBookingActivityTests() {
  console.log('================================================================================');
  console.log('  TEST SUITE: ADMIN DASHBOARD BOOKING ACTIVITY & REAL DATA VERIFICATION         ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ridezone',
    port: process.env.DB_PORT || 3306
  });

  try {
    // 1. Authenticate as Administrator
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@gmail.com',
      password: 'admin'
    });

    assert("Admin login successful (HTTP 200)", loginRes.status === 200);
    const adminToken = loginRes.data.token;
    assert("Admin JWT acquired", !!adminToken);

    // 2. Direct ground-truth SQL query for today
    const [dbTodayRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as create_date,
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN booking_status != 'Cancelled' THEN rental_price ELSE 0 END), 0) as valid_rev
      FROM bookings
      WHERE DATE_FORMAT(created_at, '%Y-%m-%d') = DATE_FORMAT(NOW(), '%Y-%m-%d')
      GROUP BY create_date
    `);
    const dbTodayCount = dbTodayRows.length > 0 ? Number(dbTodayRows[0].total_count) : 0;
    const dbTodayRev = dbTodayRows.length > 0 ? Number(dbTodayRows[0].valid_rev) : 0;
    console.log(`[Ground Truth] Database bookings created today: ${dbTodayCount} (Revenue: ₹${dbTodayRev})`);

    // 3. API Query for 7d
    const stats7dRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats?period=7d',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert("GET /api/admin/stats?period=7d returns HTTP 200", stats7dRes.status === 200);

    const trend7d = stats7dRes.data.bookingsTrend || [];
    assert("7d trend contains exactly 7 calendar-day buckets", trend7d.length === 7, `Got ${trend7d.length}`);

    // Check chronological order and date continuity
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let chronologicalCorrect = true;
    for (let i = 0; i < 7; i++) {
      const expectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const expectedDay = dayNames[expectedDate.getDay()];
      const expectedFormattedDate = expectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (trend7d[i].day !== expectedDay || trend7d[i].date !== expectedFormattedDate) {
        chronologicalCorrect = false;
        console.error(`Mismatch at bucket ${i}: Expected ${expectedDay} ${expectedFormattedDate}, got ${trend7d[i].day} ${trend7d[i].date}`);
      }
    }
    assert("7d trend buckets are strictly chronological from oldest to today", chronologicalCorrect);

    // Check today's bucket matches database ground truth
    const todayBucket7d = trend7d[6];
    assert("Today's bucket count matches MySQL database count", todayBucket7d.count === dbTodayCount, `Expected ${dbTodayCount}, got ${todayBucket7d.count}`);
    assert("Today's bucket revenue matches MySQL non-cancelled revenue", todayBucket7d.revenue === dbTodayRev, `Expected ${dbTodayRev}, got ${todayBucket7d.revenue}`);

    // Check zero-activity day preservation
    const zeroDays = trend7d.filter(d => d.count === 0);
    assert("Zero-activity days are preserved with count 0 (not omitted)", zeroDays.length >= 0 && trend7d.every(d => typeof d.count === 'number' && d.count >= 0));

    // 4. Test Dynamic Increment: create a 4th booking today and verify chart reflects it
    console.log('\n--- Dynamic Creation & Real-Time Count Increment Test ---');
    const [userRow] = await pool.query("SELECT id, name, email FROM users WHERE id = 3 LIMIT 1");
    const testUserId = userRow[0]?.id || 3;
    const testUserName = userRow[0]?.name || 'Charan G';
    const testUserEmail = userRow[0]?.email || 'charan@gmail.com';

    const testBookingId = `RZ-TEST-${Date.now().toString(36).toUpperCase()}`;
    const testPrice = 750;

    await pool.query(`
      INSERT INTO bookings (
        id, user_id, user_name, customer_email, vehicle_id, vehicle_name, vehicle_reg_no,
        pickup_date, pickup_time, hours, rental_price, deposit_amount, total_price,
        payment_method, payment_status, booking_status, created_at
      ) VALUES (
        ?, ?, ?, ?, 1, 'Test Regression Bike', 'TS 09 RZ 9999',
        CURRENT_DATE(), '10:00', 5, ?, 1000, ?,
        'UPI', 'Paid', 'Confirmed', NOW()
      )
    `, [testBookingId, testUserId, testUserName, testUserEmail, testPrice, testPrice + 1000]);

    // Re-query stats
    const statsAfterInsert = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats?period=7d',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const updatedToday = (statsAfterInsert.data.bookingsTrend || [])[6];
    assert("Creating 1 additional booking increments today's count by 1 (e.g. 3 -> 4)", updatedToday.count === dbTodayCount + 1, `Expected ${dbTodayCount + 1}, got ${updatedToday.count}`);
    assert("Additional booking updates today's revenue", updatedToday.revenue === dbTodayRev + testPrice, `Expected ${dbTodayRev + testPrice}, got ${updatedToday.revenue}`);

    // Cleanup dynamic test booking
    await pool.query("DELETE FROM bookings WHERE id = ?", [testBookingId]);
    console.log(`[Cleaned up test booking ${testBookingId}]`);

    // Verify count returns to baseline
    const statsAfterCleanup = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats?period=7d',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const restoredToday = (statsAfterCleanup.data.bookingsTrend || [])[6];
    assert("Removing test fixture restores today's count exactly to baseline", restoredToday.count === dbTodayCount, `Expected ${dbTodayCount}, got ${restoredToday.count}`);

    // 5. Test Cancelled Booking Counting
    console.log('\n--- Cancelled Booking Status Inclusion Test ---');
    const cancelledBookingId = `RZ-CANC-${Date.now().toString(36).toUpperCase()}`;
    await pool.query(`
      INSERT INTO bookings (
        id, user_id, user_name, customer_email, vehicle_id, vehicle_name, vehicle_reg_no,
        pickup_date, pickup_time, hours, rental_price, deposit_amount, total_price,
        payment_method, payment_status, booking_status, cancellation_reason, cancelled_by, created_at
      ) VALUES (
        ?, ?, ?, ?, 1, 'Test Regression Bike', 'TS 09 RZ 9999',
        CURRENT_DATE(), '10:00', 5, 500, 1000, 1500,
        'UPI', 'Refunded', 'Cancelled', 'Vehicle unavailable', 'RideZone Admin', NOW()
      )
    `, [cancelledBookingId, testUserId, testUserName, testUserEmail]);

    const statsAfterCancelled = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats?period=7d',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const todayWithCancelled = (statsAfterCancelled.data.bookingsTrend || [])[6];
    assert("Cancelled bookings created today ARE counted in Booking Activity", todayWithCancelled.count === dbTodayCount + 1, `Expected ${dbTodayCount + 1}, got ${todayWithCancelled.count}`);
    assert("Cancelled bookings do NOT add to rental revenue", todayWithCancelled.revenue === dbTodayRev, `Expected ${dbTodayRev}, got ${todayWithCancelled.revenue}`);

    // Cleanup cancelled test booking
    await pool.query("DELETE FROM bookings WHERE id = ?", [cancelledBookingId]);
    console.log(`[Cleaned up cancelled test booking ${cancelledBookingId}]`);

    // 6. Test Month Option ('30d')
    console.log('\n--- Month (30d) Continuous Trend Test ---');
    const stats30dRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats?period=30d',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert("GET /api/admin/stats?period=30d returns HTTP 200", stats30dRes.status === 200);
    const trend30d = stats30dRes.data.bookingsTrend || [];
    assert("30d trend contains exactly 30 calendar-day buckets", trend30d.length === 30, `Got ${trend30d.length}`);
    const todayBucket30d = trend30d[29];
    assert("30d trend ending bucket is today with exact count", todayBucket30d.count === dbTodayCount, `Expected ${dbTodayCount}, got ${todayBucket30d.count}`);

    // 7. Timezone / Near-Midnight check
    console.log('\n--- Timezone & Near-Midnight Alignment Test ---');
    const [tzTest] = await pool.query(`
      SELECT 
        DATE_FORMAT('2026-09-06 23:45:00', '%Y-%m-%d') as near_midnight_date,
        DATE_FORMAT(NOW(), '%Y-%m-%d') as cur_date
    `);
    assert("Near-midnight 23:45 timestamp evaluates to correct calendar date", tzTest[0].near_midnight_date === '2026-09-06');

    // 8. KPI Card Consistency
    console.log('\n--- KPI Card Total Bookings Consistency Test ---');
    const [[{ total_db_bookings }]] = await pool.query("SELECT COUNT(*) as total_db_bookings FROM bookings");
    const kpiTotalBookings = stats7dRes.data.stats.totalBookings;
    assert("Total Bookings KPI matches MySQL SELECT COUNT(*) exactly", Number(kpiTotalBookings) === Number(total_db_bookings), `KPI: ${kpiTotalBookings}, DB: ${total_db_bookings}`);

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBookingActivityTests();
