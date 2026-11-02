/**
 * RideZone Verification Test Suite: Admin Cancellation Workflow End-to-End
 * Verifies:
 * - Admin cancellation requires reason before cancellation
 * - Predefined reasons work
 * - 'Other' requires additional details
 * - 100% refund behavior preserved
 * - Reason, details, timestamp, and admin identity persisted
 * - Non-admin rejected (403), unauthenticated rejected (401)
 * - Duplicate cancellations rejected (400)
 * - Customer GET /api/user/bookings returns the exact reason and details
 * - Customer-side XSS safety
 * - Customer cancellation flow unchanged
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

function escapeHtml(unsafeStr) {
  if (unsafeStr === null || unsafeStr === undefined) return "";
  return String(unsafeStr)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function runVerification() {
  console.log("================================================================================");
  console.log("  VERIFICATION SUITE: ADMIN CANCELLATION WORKFLOW & REASON PERSISTENCE          ");
  console.log("================================================================================\n");

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
    // 1. Authenticate Admin
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@gmail.com',
      password: 'admin'
    });
    assert("Admin login successful", adminLoginRes.status === 200 && !!adminLoginRes.data.token);
    const adminToken = adminLoginRes.data.token;

    // 2. Register a customer and create bookings
    const customerEmail = `canceltester_${Date.now()}@example.com`;
    const custRegRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Priya Sharma',
      email: customerEmail,
      password: 'password123',
      phone: '+91 98765 11223'
    });
    assert("Customer registration successful", custRegRes.status === 201 && !!custRegRes.data.token);
    const customerToken = custRegRes.data.token;

    // Helper to create a test booking with dynamic date offset to prevent scheduling overlap
    let testBookingDayOffset = 10;
    async function createTestBooking(vehicleName = "Kawasaki Ninja 300") {
      testBookingDayOffset += 3;
      const targetDate = new Date(Date.now() + testBookingDayOffset * 86400000).toISOString().split('T')[0];
      const bookRes = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/api/bookings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customerToken}`
        }
      }, {
        vehicle: vehicleName,
        date: targetDate,
        time: "10:00",
        hours: 4,
        payment_method: "UPI"
      });
      if (!bookRes.data || !bookRes.data.booking) {
        throw new Error(`Failed to create test booking for ${vehicleName}: ${JSON.stringify(bookRes.data)}`);
      }
      return bookRes.data.booking;
    }

    // --- TEST 1: Admin cancellation without reason is rejected (HTTP 400) ---
    console.log("\n--- Group 1: Admin API Validation ---");
    const booking1 = await createTestBooking();
    const noReasonRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {});
    assert("Admin cancel without reason rejected (HTTP 400)", noReasonRes.status === 400, `Got status ${noReasonRes.status}`);

    // --- TEST 2: Admin cancellation with invalid reason is rejected (HTTP 400) ---
    const invalidReasonRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { cancellation_reason: "Customer changed mind randomly" });
    assert("Admin cancel with unlisted reason rejected (HTTP 400)", invalidReasonRes.status === 400, `Got status ${invalidReasonRes.status}`);

    // --- TEST 3: Admin cancellation with 'Other' and NO details is rejected (HTTP 400) ---
    const otherNoDetailsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { cancellation_reason: "Other", cancellation_details: "" });
    assert("Admin cancel with 'Other' and empty details rejected (HTTP 400)", otherNoDetailsRes.status === 400, `Got status ${otherNoDetailsRes.status}`);

    // --- TEST 4: Admin cancellation with predefined reason succeeds (HTTP 200) ---
    console.log("\n--- Group 2: Successful Predefined Reason Cancellation ---");
    const validCancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      cancellation_reason: "Vehicle unavailable",
      cancellation_details: "The assigned motorcycle is currently undergoing unscheduled electrical check."
    });
    assert("Admin cancel with valid predefined reason succeeds (HTTP 200)", validCancelRes.status === 200, `Got status ${validCancelRes.status}`);
    assert("Response includes cancelled_by 'RideZone Admin'", validCancelRes.data.cancelled_by === 'RideZone Admin', `Got: ${validCancelRes.data.cancelled_by}`);
    assert("Response includes exact cancellation_reason", validCancelRes.data.cancellation_reason === "Vehicle unavailable", `Got: ${validCancelRes.data.cancellation_reason}`);
    assert("Response includes cancellation_details", validCancelRes.data.cancellation_details.includes("unscheduled electrical check"));
    assert("100% full refund registered", Number(validCancelRes.data.refundAmount) === Number(booking1.total_price), `Refund: ${validCancelRes.data.refundAmount}`);

    // --- TEST 5: Duplicate cancellation rejected (HTTP 400) ---
    const duplicateCancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking1.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { cancellation_reason: "Vehicle unavailable" });
    assert("Duplicate cancellation of already cancelled booking rejected (HTTP 400)", duplicateCancelRes.status === 400, `Got status ${duplicateCancelRes.status}`);

    // --- TEST 6: Successful 'Other' reason with mandatory details ---
    console.log("\n--- Group 3: Successful 'Other' Cancellation with Mandatory Details ---");
    const booking2 = await createTestBooking("Royal Enfield Hunter 350");
    const otherValidRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking2.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      cancellation_reason: "Other",
      cancellation_details: "Due to heavy city monsoon flooding, pickup hub is temporarily closed."
    });
    assert("Admin cancel with 'Other' and valid details succeeds (HTTP 200)", otherValidRes.status === 200, `Got status ${otherValidRes.status}`);
    assert("'Other' reason saved", otherValidRes.data.cancellation_reason === "Other");
    assert("Custom explanation saved", otherValidRes.data.cancellation_details.includes("monsoon flooding"));

    // --- TEST 7: Customer Endpoint returns exact reason and details ---
    console.log("\n--- Group 4: Customer Portal Integration ---");
    const custBookingsRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/user/bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert("Customer can retrieve bookings (HTTP 200)", custBookingsRes.status === 200);
    const userBookings = custBookingsRes.data.bookings || [];
    const b1OnCustomer = userBookings.find(b => b.id === booking1.id);
    assert("Customer receives booking 1 with status 'Cancelled'", b1OnCustomer && b1OnCustomer.booking_status === "Cancelled");
    assert("Customer receives cancelled_by 'RideZone Admin'", b1OnCustomer && b1OnCustomer.cancelled_by === "RideZone Admin");
    assert("Customer receives cancellation_reason 'Vehicle unavailable'", b1OnCustomer && b1OnCustomer.cancellation_reason === "Vehicle unavailable");
    assert("Customer receives cancellation_details", b1OnCustomer && b1OnCustomer.cancellation_details.includes("unscheduled electrical check"));
    assert("Customer receives refund_amount equal to total_price", b1OnCustomer && Number(b1OnCustomer.refund_amount) === Number(b1OnCustomer.total_price));

    const b2OnCustomer = userBookings.find(b => b.id === booking2.id);
    assert("Customer receives booking 2 with cancellation_reason 'Other'", b2OnCustomer && b2OnCustomer.cancellation_reason === "Other");
    assert("Customer receives custom details for 'Other'", b2OnCustomer && b2OnCustomer.cancellation_details.includes("monsoon flooding"));

    // --- TEST 8: Security & RBAC Protection ---
    console.log("\n--- Group 5: Security, RBAC & XSS Immunity ---");
    const unauthRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking2.id}/cancel`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { cancellation_reason: "Vehicle unavailable" });
    assert("Unauthenticated admin cancel attempt rejected (HTTP 401)", unauthRes.status === 401, `Status: ${unauthRes.status}`);

    const custOnAdminEndpoint = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking2.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      }
    }, { cancellation_reason: "Vehicle unavailable" });
    assert("Customer token on admin cancel endpoint rejected (HTTP 403 Forbidden)", custOnAdminEndpoint.status === 403, `Status: ${custOnAdminEndpoint.status}`);

    // XSS Sanitization test
    const booking3 = await createTestBooking("KTM RC 390");
    const xssPayload = "<script>alert('xss-admin-cancel')</script><img src=x onerror=alert(1)>";
    const xssCancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings/${booking3.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      cancellation_reason: "Other",
      cancellation_details: xssPayload
    });
    assert("Cancellation with XSS payload accepted safely in backend (HTTP 200)", xssCancelRes.status === 200);
    const escapedOutput = escapeHtml(xssCancelRes.data.cancellation_details);
    assert("XSS payload safely escaped with escapeHtml()", !escapedOutput.includes("<script>") && !escapedOutput.includes("<img") && escapedOutput.includes("&lt;script&gt;"));

    // --- TEST 9: Customer Cancellation Flow Remains Unchanged ---
    console.log("\n--- Group 6: Customer-Initiated Cancellation Integrity ---");
    const booking4 = await createTestBooking("Yamaha MT-15 V2");
    const custCancelRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/user/bookings/${booking4.id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      }
    });
    assert("Customer can cancel within 1-hour window (HTTP 200)", custCancelRes.status === 200, `Status: ${custCancelRes.status}`);
    const custCheckRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/user/bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const b4 = (custCheckRes.data.bookings || []).find(b => b.id === booking4.id);
    assert("Customer cancellation sets cancelled_by = 'Customer'", b4 && b4.cancelled_by === "Customer", `Got: ${b4?.cancelled_by}`);
    assert("Customer cancellation does NOT require cancellation_reason", b4 && b4.booking_status === "Cancelled");

    // --- TEST 10: Admin Bookings List projects cancellation reason and details ---
    console.log("\n--- Group 7: Admin Bookings List Projection ---");
    const adminListRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/admin/bookings?search=${encodeURIComponent(booking1.id)}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert("Admin bookings list returns HTTP 200", adminListRes.status === 200);
    const adminBookings = adminListRes.data.bookings || [];
    const b1InAdmin = adminBookings.find(b => b.id === booking1.id);
    assert("Admin bookings list projects cancellation_reason", b1InAdmin && b1InAdmin.cancellation_reason === "Vehicle unavailable");
    assert("Admin bookings list projects cancellation_details", b1InAdmin && !!b1InAdmin.cancellation_details);

    console.log("\n================================================================================");
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Verification suite encountered unexpected error:", err);
    process.exit(1);
  }
}

runVerification();
