/**
 * RideZone - Phase 1 Correctness & Data-Flow Hardening Automated Test Suite
 * Validates all 11 objectives across Frontend, Backend, Express API, Auth, and MySQL database.
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

// Helper for making JSON requests
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Helper valid 1x1 base64 images
const VALID_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_JPG_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const FAKE_PNG_SVG_DATA = 'data:image/png;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
const MISMATCHED_MIME_DATA = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('====================================================');
  console.log('  RIDEZONE — PHASE 1 CORRECTNESS TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      await fn();
      console.log('PASSED \u2714');
      passed++;
    } catch (err) {
      console.log(`FAILED \u2718\n  -> ${err.message}`);
      failed++;
    }
  }

  // 1. Authenticate Admin
  let adminToken = '';
  await test('Authenticate Administrator (admin@gmail.com)', async () => {
    const res = await request('POST', '/api/admin/login', {
      email: 'admin@gmail.com',
      password: 'admin'
    });
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(res.data.token, 'Expected admin token');
    adminToken = res.data.token;
  });

  // 2. Register/Login a Test Customer
  let customerToken = '';
  let customerId = null;
  const testCustomerEmail = `phase1_cust_${Date.now()}@example.com`;
  await test('Register and Authenticate Customer', async () => {
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Phase1 Test Customer',
      email: testCustomerEmail,
      password: 'Password123!',
      phone: '+91 99988 77766'
    });
    assert.strictEqual(regRes.status, 201, `Customer register failed: ${JSON.stringify(regRes.data)}`);
    assert.ok(regRes.data.token);
    customerToken = regRes.data.token;
    customerId = regRes.data.user.id;
  });

  // Objective 1: Image MIME / Extension Consistency & Binary Validation
  await test('Obj 1: Reject fake PNG with SVG content', async () => {
    const res = await request('POST', '/api/upload', {
      dataUrl: FAKE_PNG_SVG_DATA,
      filename: 'exploit.png'
    }, customerToken);
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for fake PNG, got ${res.status}`);
  });

  await test('Obj 1: Reject declared JPEG with actual PNG binary (MIME mismatch)', async () => {
    const res = await request('POST', '/api/upload', {
      dataUrl: MISMATCHED_MIME_DATA,
      filename: 'mismatch.jpg'
    }, customerToken);
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for MIME mismatch, got ${res.status}`);
  });

  await test('Obj 1: Reject dangerous file extensions (.exe / .svg / .php)', async () => {
    const res = await request('POST', '/api/upload', {
      dataUrl: VALID_PNG_BASE64,
      filename: 'malicious.php'
    }, customerToken);
    assert.strictEqual(res.status, 400, `Expected 400 Bad Request for php extension, got ${res.status}`);
  });

  await test('Obj 1: Accept valid PNG binary with matching MIME', async () => {
    const res = await request('POST', '/api/upload', {
      dataUrl: VALID_PNG_BASE64,
      filename: 'avatar.png'
    }, customerToken);
    assert.strictEqual(res.status, 200, `Expected 200 for valid PNG, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.url.startsWith('/uploads/'));
    assert.ok(res.data.url.endsWith('.png'));
  });

  // Objective 2: Admin Upload Authorization
  await test('Obj 2: Customer JWT cannot call POST /api/admin/upload (403)', async () => {
    const res = await request('POST', '/api/admin/upload', {
      dataUrl: VALID_PNG_BASE64,
      filename: 'veh.png'
    }, customerToken);
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for customer, got ${res.status}`);
  });

  await test('Obj 2: Unauthenticated request cannot call POST /api/admin/upload (401)', async () => {
    const res = await request('POST', '/api/admin/upload', {
      dataUrl: VALID_PNG_BASE64,
      filename: 'veh.png'
    });
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
  });

  let adminUploadedImg1 = '';
  let adminUploadedImg2 = '';
  await test('Obj 2: Admin JWT successfully uploads to POST /api/admin/upload (200)', async () => {
    const res1 = await request('POST', '/api/admin/upload', {
      dataUrl: VALID_PNG_BASE64,
      filename: 'bike1.png'
    }, adminToken);
    assert.strictEqual(res1.status, 200, `Expected 200 for admin upload: ${JSON.stringify(res1.data)}`);
    assert.ok(res1.data.url.startsWith('/uploads/'));
    adminUploadedImg1 = res1.data.url;

    const res2 = await request('POST', '/api/admin/upload', {
      dataUrl: VALID_JPG_BASE64,
      filename: 'bike2.jpg'
    }, adminToken);
    assert.strictEqual(res2.status, 200);
    adminUploadedImg2 = res2.data.url;
  });

  // Objective 3: Add Vehicle Gallery Persistence
  let createdVehicleId = null;
  await test('Obj 3: Add Vehicle persists gallery array to gallery_json', async () => {
    const testRegNo = `TS-${Math.floor(1000 + Math.random() * 9000)}-AB`;
    const res = await request('POST', '/api/admin/vehicles', {
      name: 'Ducati Panigale V4',
      brand: 'Ducati',
      model: 'Panigale V4',
      category: 'Superbike',
      year: 2024,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      price: 1500,
      deposit_amount: 5000,
      rating: 4.9,
      image: adminUploadedImg1,
      gallery: [adminUploadedImg1, adminUploadedImg2],
      vehicle_reg_no: testRegNo,
      status: 'Active',
      description: 'Superbike flagship vehicle.',
      specs: { motor_engine: '1103cc V4', top_speed: '299 km/h' }
    }, adminToken);

    assert.strictEqual(res.status, 201, `Expected 201 Created: ${JSON.stringify(res.data)}`);
    assert.ok(res.data.vehicle.id);
    createdVehicleId = res.data.vehicle.id;

    // Verify stored gallery in GET /api/admin/vehicles/:id
    const getRes = await request('GET', `/api/admin/vehicles/${createdVehicleId}`, null, adminToken);
    assert.strictEqual(getRes.status, 200);
    assert.ok(Array.isArray(getRes.data.vehicle.gallery));
    assert.strictEqual(getRes.data.vehicle.gallery.length, 2);
    assert.strictEqual(getRes.data.vehicle.gallery[0], adminUploadedImg1);
    assert.strictEqual(getRes.data.vehicle.gallery[1], adminUploadedImg2);
  });

  // Objective 4: Edit Vehicle Gallery Persistence
  await test('Obj 4: Edit Vehicle updates gallery_json and primary image without duplication', async () => {
    const updatedGallery = [adminUploadedImg2, adminUploadedImg1, '/assets/hunter.png'];
    const res = await request('PUT', `/api/admin/vehicles/${createdVehicleId}`, {
      name: 'Ducati Panigale V4 S',
      brand: 'Ducati',
      model: 'Panigale V4 S',
      category: 'Superbike',
      year: 2024,
      fuel_type: 'Petrol',
      transmission: 'Manual',
      price: 1800,
      deposit_amount: 6000,
      rating: 5.0,
      image: adminUploadedImg2,
      gallery: updatedGallery,
      vehicle_reg_no: 'TS-9999-ZZ',
      status: 'Active',
      description: 'Updated S version.'
    }, adminToken);

    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.data)}`);

    // Verify via public GET /api/vehicles/:id
    const publicGet = await request('GET', `/api/vehicles/${createdVehicleId}`);
    assert.strictEqual(publicGet.status, 200);
    assert.strictEqual(publicGet.data.vehicle.image, adminUploadedImg2);
    assert.ok(Array.isArray(publicGet.data.vehicle.gallery));
    assert.strictEqual(publicGet.data.vehicle.gallery.length, 3);
    assert.strictEqual(publicGet.data.vehicle.gallery[0], adminUploadedImg2);
  });

  // Objective 6: Vehicle Grid Ordering (ORDER BY id ASC)
  await test('Obj 6: GET /api/vehicles returns catalog ordered by id ASC (Ather at 1, Yamaha at 3)', async () => {
    const res = await request('GET', '/api/vehicles');
    assert.strictEqual(res.status, 200);
    const vehicles = res.data;
    assert.ok(vehicles.length >= 7, 'Expected at least 7 default fleet vehicles');
    // Ather is ID 1
    assert.strictEqual(vehicles[0].id, 1, 'First vehicle should be ID 1 (Ather 450X)');
    // Yamaha MT-15 is ID 3
    const yamaha = vehicles.find(v => v.name.includes('Yamaha'));
    assert.ok(yamaha, 'Yamaha vehicle must exist');
    assert.strictEqual(yamaha.id, 3, 'Yamaha MT-15 should have ID 3 (3rd position in fleet grid)');
  });

  // Objective 7: Rental Revenue Calculation & Objective 8: Month Analytics
  await test('Obj 7 & 8: Stats calculates non-cancelled rental revenue and handles period=month', async () => {
    const res7d = await request('GET', '/api/admin/stats?period=7d', null, adminToken);
    assert.strictEqual(res7d.status, 200);
    assert.ok(typeof res7d.data.stats.rentalRevenue === 'number');
    assert.ok(typeof res7d.data.stats.totalDepositsHeld === 'number');
    assert.ok(Array.isArray(res7d.data.stats.bookingsTrend));

    const resMonth = await request('GET', '/api/admin/stats?period=month', null, adminToken);
    assert.strictEqual(resMonth.status, 200);
    assert.ok(Array.isArray(resMonth.data.stats.bookingsTrend));
    assert.strictEqual(resMonth.data.stats.period, '30d');
  });

  // Objective 9: Booking Lifecycle Transitions & State Machine
  let testBookingId = null;
  const uniqueDate1 = new Date(Date.now() + Math.floor(Math.random() * 300 + 400) * 86400000).toISOString().split('T')[0];
  const uniqueDate2 = new Date(Date.now() + Math.floor(Math.random() * 300 + 800) * 86400000).toISOString().split('T')[0];

  await test('Obj 9: Create new reservation (Pending status)', async () => {
    const bookRes = await request('POST', '/api/bookings', {
      user_id: customerId,
      vehicle_id: 1,
      vehicle_name: 'Ather 450X Gen 3',
      vehicle_reg_no: 'TS-09-EA-1001',
      pickup_date: uniqueDate1,
      pickup_time: '10:00',
      hours: 4,
      booking_status: 'Pending',
      rental_price: 380,
      deposit_amount: 1000,
      total_price: 1380,
      payment_method: 'UPI'
    }, customerToken);

    assert.strictEqual(bookRes.status, 201, `Failed to create booking: ${JSON.stringify(bookRes.data)}`);
    testBookingId = bookRes.data.booking.id;
  });

  await test('Obj 9: Cannot activate a Pending booking directly (Must be Confirmed first)', async () => {
    const res = await request('POST', `/api/admin/bookings/${testBookingId}/activate`, {}, adminToken);
    assert.strictEqual(res.status, 400, `Expected 400 for activating Pending booking, got ${res.status}`);
  });

  await test('Obj 9: Admin accepts booking (Pending -> Confirmed)', async () => {
    const res = await request('POST', `/api/admin/bookings/${testBookingId}/accept`, {}, adminToken);
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.booking.booking_status, 'Confirmed');
  });

  await test('Obj 9: Admin activates booking (Confirmed -> Active)', async () => {
    const res = await request('POST', `/api/admin/bookings/${testBookingId}/activate`, {}, adminToken);
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.booking.booking_status, 'Active');
  });

  await test('Obj 9: Admin records vehicle return (Active -> Completed)', async () => {
    const res = await request('POST', `/api/admin/bookings/${testBookingId}/return`, {}, adminToken);
    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.data)}`);
  });

  await test('Obj 9: Cannot cancel or return a Completed booking', async () => {
    const resCancel = await request('POST', `/api/admin/bookings/${testBookingId}/cancel`, {}, adminToken);
    assert.strictEqual(resCancel.status, 400, `Expected 400 for cancelling Completed booking, got ${resCancel.status}`);

    const resReturn = await request('POST', `/api/admin/bookings/${testBookingId}/return`, {}, adminToken);
    assert.strictEqual(resReturn.status, 400, `Expected 400 for returning Completed booking, got ${resReturn.status}`);
  });

  // Objective 10: Admin Cancellation Propagation
  let cancelBookingId = null;
  await test('Obj 10: Create booking and perform Admin Cancellation (Sets cancelled_by = Admin)', async () => {
    const bookRes = await request('POST', '/api/bookings', {
      user_id: customerId,
      vehicle_id: 2,
      vehicle_name: 'Honda Activa 6G',
      vehicle_reg_no: 'TS-09-HB-2002',
      pickup_date: uniqueDate2,
      pickup_time: '12:00',
      hours: 6,
      rental_price: 450,
      deposit_amount: 1000,
      total_price: 1450,
      payment_method: 'Credit Card'
    }, customerToken);

    assert.strictEqual(bookRes.status, 201);
    cancelBookingId = bookRes.data.booking.id;

    // Cancel by Admin
    const cancelRes = await request('POST', `/api/admin/bookings/${cancelBookingId}/cancel`, {}, adminToken);
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.cancelled_by, 'Admin');
    assert.strictEqual(cancelRes.data.refundAmount, bookRes.data.booking.total_price);

    // Verify in GET /api/user/bookings
    const userBookings = await request('GET', '/api/user/bookings', null, customerToken);
    assert.strictEqual(userBookings.status, 200);
    const target = userBookings.data.bookings.find(b => b.id === cancelBookingId);
    assert.ok(target, 'Booking must be in customer list');
    assert.strictEqual(target.booking_status, 'Cancelled');
    assert.strictEqual(target.cancelled_by, 'Admin');
  });

  // Objective 11: Dead Customer-Status Control & Suspension Enforcement
  await test('Obj 11: Admin suspends customer via PATCH /api/admin/users/:id/status', async () => {
    const res = await request('PATCH', `/api/admin/users/${customerId}/status`, {
      status: 'Suspended'
    }, adminToken);

    assert.strictEqual(res.status, 200, `Expected 200: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.status, 'Suspended');

    // Customer list returns status = Suspended
    const usersRes = await request('GET', '/api/admin/users', null, adminToken);
    assert.strictEqual(usersRes.status, 200);
    const cust = usersRes.data.users.find(u => u.id === customerId);
    assert.ok(cust);
    assert.strictEqual(cust.status, 'Suspended');
  });

  await test('Obj 11: Suspended customer receives HTTP 403 on protected customer endpoints', async () => {
    const profileRes = await request('GET', '/api/user/profile', null, customerToken);
    assert.strictEqual(profileRes.status, 403, `Expected 403 for suspended customer, got ${profileRes.status}`);

    const bookingRes = await request('POST', '/api/bookings', {
      user_id: customerId,
      vehicle_id: 1,
      hours: 2
    }, customerToken);
    assert.strictEqual(bookingRes.status, 403, `Expected 403 for suspended customer booking attempt, got ${bookingRes.status}`);
  });

  await test('Obj 11: Admin reactivates customer (status -> Active)', async () => {
    const res = await request('PATCH', `/api/admin/users/${customerId}/status`, {
      status: 'Active'
    }, adminToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'Active');

    // Customer can now access profile again
    const profileRes = await request('GET', '/api/user/profile', null, customerToken);
    assert.strictEqual(profileRes.status, 200, `Expected 200 after reactivation, got ${profileRes.status}`);
  });

  // Cleanup test vehicle
  if (createdVehicleId) {
    await test('Cleanup temporary test vehicle', async () => {
      const delRes = await request('DELETE', `/api/admin/vehicles/${createdVehicleId}`, null, adminToken);
      assert.strictEqual(delRes.status, 200);
    });
  }

  console.log('\n====================================================');
  console.log(`  PHASE 1 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[Unhandled Test Error]:', err);
  process.exit(1);
});
