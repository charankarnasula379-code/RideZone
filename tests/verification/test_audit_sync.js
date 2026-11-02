/**
 * RideZone Comprehensive Audit & Synchronization Test Suite
 */
const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '..', '..', '.env'))
  ? path.join(__dirname, '..', '..', '.env')
  : path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || '07899d821fd543b061b4b2725642bbaccbdbcd0996dd413c580b4fe92f38ee33';

async function runTests() {
  console.log('=== STARTING RIDEZONE AUDIT & INTEGRITY TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Direct MySQL Fleet Check
  console.log('Test Group 1: MySQL Fleet Database Verification');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ridezone',
    port: Number(process.env.DB_PORT || 3306)
  });

  // Clean up any lingering previous test data
  await pool.query("DELETE FROM bookings WHERE user_name = 'Audit Test Customer'");
  await pool.query("DELETE FROM users WHERE email LIKE 'audit_tester_%'");

  const [vehicles] = await pool.query('SELECT * FROM vehicles ORDER BY id ASC');
  assert(vehicles.length === 9, `Database contains exactly 9 vehicles (found: ${vehicles.length})`);

  const hunter = vehicles.find(v => v.name.includes('Hunter 350'));
  assert(hunter && hunter.name === 'Royal Enfield Hunter 350', 'Royal Enfield Hunter 350 exists');
  assert(hunter && hunter.image === '/assets/hunter.png', `Hunter image is /assets/hunter.png (found: ${hunter?.image})`);
  assert(hunter && Number(hunter.deposit_amount) === 2000, `Hunter deposit is ₹2,000 (found: ${hunter?.deposit_amount})`);
  assert(hunter && hunter.vehicle_reg_no === 'TS 09 RZ 1006', `Hunter registration is TS 09 RZ 1006 (found: ${hunter?.vehicle_reg_no})`);

  const tvs = vehicles.find(v => v.name.includes('Apache'));
  assert(tvs && tvs.name.includes('Apache'), `TVS Apache exists in fleet (found: ${tvs?.name})`);
  assert(tvs && tvs.image === '/assets/tvs.png', `TVS image is /assets/tvs.png (found: ${tvs?.image})`);
  assert(tvs && Number(tvs.deposit_amount) === 1500, `TVS deposit is ₹1,500 (found: ${tvs?.deposit_amount})`);
  assert(tvs && tvs.vehicle_reg_no === 'TS 09 RZ 1007', `TVS registration is TS 09 RZ 1007 (found: ${tvs?.vehicle_reg_no})`);

  // Verify no duplicates
  const names = vehicles.map(v => v.name.toLowerCase());
  const uniqueNames = new Set(names);
  assert(names.length === uniqueNames.size, `No duplicate vehicle names in database (${uniqueNames.size} unique)`);

  // 2. Public API Fleet Verification
  console.log('\nTest Group 2: Public API /api/vehicles Verification');

  const resApi = await fetch(`${BASE_URL}/api/vehicles`);
  assert(resApi.ok, 'GET /api/vehicles returns HTTP 200');
  const apiVehicles = await resApi.json();
  assert(Array.isArray(apiVehicles) && apiVehicles.length === 9, `API returns exactly 9 vehicles (found: ${apiVehicles.length})`);

  const apiHunter = apiVehicles.find(v => v.name.includes('Hunter'));
  assert(apiHunter && typeof apiHunter.specs === 'object', 'Hunter API has parsed specs object');
  assert(apiHunter && Array.isArray(apiHunter.gallery) && apiHunter.gallery.length === 3, `Hunter API has 3 gallery images (found: ${apiHunter?.gallery?.length})`);

  const apiTvs = apiVehicles.find(v => v.name.includes('Apache'));
  assert(apiTvs && typeof apiTvs.specs === 'object', 'TVS API has parsed specs object');
  assert(apiTvs && Array.isArray(apiTvs.gallery) && apiTvs.gallery.length === 3, `TVS API has 3 gallery images (found: ${apiTvs?.gallery?.length})`);

  // 3. User Authentication & Booking Lifecycle
  console.log('\nTest Group 3: Customer Booking & Payment Synchronization');
  const testUserEmail = `audit_tester_${Date.now()}@example.com`;
  const testUserName = 'Audit Test Customer';
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testUserName,
      email: testUserEmail,
      password: 'Password123!',
      phone: '+91 98765 43210'
    })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.token, 'Customer registered successfully and received token');
  const userToken = regData.token;

  // Book Hunter 350 for 3 hours on a fresh future date
  const futureDays = 10 + Math.floor(Math.random() * 50);
  const futureDate = new Date(Date.now() + futureDays * 86400000).toISOString().split('T')[0];
  const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      vehicle: 'Royal Enfield Hunter 350',
      date: futureDate,
      time: '11:00',
      hours: 3,
      payment_method: 'UPI'
    })
  });
  const bookData = await bookRes.json();
  if (!bookRes.ok) {
    console.error('  [Booking Create Failed Status]:', bookRes.status, bookData);
  }
  assert(bookRes.ok && bookData.booking, 'Booking created successfully for Hunter 350');
  if (!bookData.booking) return;
  const bookingId = bookData.booking.id;

  // Verify booking calculated totals (320 * 3 = 960 rental + 2000 deposit = 2960 total)
  assert(Number(bookData.booking.rental_price) === 960, `Rental price is ₹960 (found: ${bookData.booking.rental_price})`);
  assert(Number(bookData.booking.deposit_amount) === 2000, `Deposit amount is ₹2000 (found: ${bookData.booking.deposit_amount})`);
  assert(Number(bookData.booking.total_price) === 2960, `Total price is ₹2960 (found: ${bookData.booking.total_price})`);

  // 4. Admin Portal Data Synchronization
  console.log('\nTest Group 4: Admin API Data Synchronization');
  const [adminRows] = await pool.query('SELECT * FROM admins LIMIT 1');
  const dbAdmin = adminRows[0] || { id: 1, email: 'admin@gmail.com' };
  const adminToken = jwt.sign({ id: dbAdmin.id, email: dbAdmin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });

  // Verify Admin Bookings endpoint
  const adminBookRes = await fetch(`${BASE_URL}/api/admin/bookings`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminBookings = await adminBookRes.json();
  const foundAdminBooking = adminBookings.bookings?.find((b) => b.id === bookingId);
  assert(foundAdminBooking, 'Created booking appears in Admin Bookings list');
  assert(foundAdminBooking && foundAdminBooking.customer_name === testUserName, `Admin booking shows real customer name: "${foundAdminBooking?.customer_name}"`);
  assert(foundAdminBooking && foundAdminBooking.customer_email === testUserEmail, `Admin booking shows real customer email: "${foundAdminBooking?.customer_email}"`);

  // Verify Admin Payments endpoint
  const adminPayRes = await fetch(`${BASE_URL}/api/admin/payments`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminPayments = await adminPayRes.json();
  const foundPayment = adminPayments.transactions?.find((t) => t.booking_id === bookingId);
  assert(foundPayment, 'Payment transaction appears in Admin Payments list');
  assert(foundPayment && foundPayment.customer_name === testUserName, `Admin payment shows real customer name: "${foundPayment?.customer_name}"`);
  assert(foundPayment && foundPayment.customer_email === testUserEmail, `Admin payment shows real customer email: "${foundPayment?.customer_email}"`);
  assert(foundPayment && Number(foundPayment.deposit_amount) === 2000, `Admin payment shows ₹2,000 deposit held`);

  // 5. Vehicle Availability Endpoint
  console.log('\nTest Group 5: Vehicle Availability Synchronization');
  const availRes = await fetch(`${BASE_URL}/api/vehicles/${encodeURIComponent('Royal Enfield Hunter 350')}/availability`);
  const availData = await availRes.json();
  const hasBookingInAvail = availData.bookings?.some((b) => b.id === bookingId);
  assert(hasBookingInAvail, 'Vehicle availability reflects newly created reservation');

  // 6. Booking Cancellation & 100% Refund Verification
  console.log('\nTest Group 6: Booking Cancellation & 100% Refund Policy');
  const cancelRes = await fetch(`${BASE_URL}/api/user/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ reason: 'Schedule changed' })
  });
  const cancelData = await cancelRes.json();
  assert(cancelRes.ok, 'Booking cancelled successfully within 1-hour window');
  const refundAmount = cancelData.cancellation?.totalRefundAmount ?? cancelData.refund_amount;
  const cancelFee = cancelData.cancellation?.cancellationFee ?? cancelData.cancellation_fee;
  assert(Number(refundAmount) === 2960, `100% Full Refund issued: ₹${refundAmount} (expected: ₹2960)`);
  assert(Number(cancelFee) === 0, `Cancellation fee is ₹0 (found: ₹${cancelFee})`);

  // Verify Admin Payments reflects refund
  const adminPayRes2 = await fetch(`${BASE_URL}/api/admin/payments`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminPayments2 = await adminPayRes2.json();
  const refundedPayment = adminPayments2.transactions?.find((t) => t.booking_id === bookingId);
  assert(refundedPayment && Number(refundedPayment.refund_amount) === 2960, `Admin payment transaction records ₹2,960 refund`);
  assert(refundedPayment && refundedPayment.display_status === 'Refunded', `Admin payment status is "Refunded" (found: ${refundedPayment?.display_status})`);

  // Clean up test data
  await pool.query('DELETE FROM bookings WHERE id = ?', [bookingId]);
  await pool.query('DELETE FROM users WHERE email = ?', [testUserEmail]);
  await pool.end();

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
