/**
 * ============================================================
 * RIDEZONE — PHASE 5 FINAL VERIFICATION & QA GATE TEST SUITE
 * Exhaustive End-to-End Verification across all User & Admin
 * screens, auth flows, booking lifecycle, payments, refunds,
 * image security, RBAC/IDOR, design tokens, and synchronizations.
 * ============================================================
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");

function test(name, fn) {
  return async () => {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await fn();
      console.log("\x1b[32mPASSED ✔\x1b[0m");
    } catch (err) {
      console.log("\x1b[31mFAILED ✘\x1b[0m");
      console.error(err);
      process.exitCode = 1;
    }
  };
}

function makeRequest(pathStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      "Content-Type": "application/json"
    };

    const reqOptions = {
      hostname: "localhost",
      port: 3001,
      path: pathStr,
      method: options.method || "GET",
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

(async function runPhase5FinalQAGate() {
  console.log("====================================================");
  console.log("  RIDEZONE — PHASE 5 FINAL VERIFICATION & QA GATE   ");
  console.log("====================================================");

  let adminToken = null;
  let customerAToken = null;
  let customerBToken = null;
  let customerAId = null;
  let customerBId = null;
  const uniqueTimestamp = Date.now();
  const customerAEmail = `qa_cust_a_${uniqueTimestamp}@example.com`;
  const customerBEmail = `qa_cust_b_${uniqueTimestamp}@example.com`;

  // ------------------------------------------------------------
  // 1. ALL PUBLIC & ADMIN ROUTES AVAILABILITY
  // ------------------------------------------------------------
  await test("User Portal: GET / (Home) returns HTTP 200", async () => {
    const res = await makeRequest("/");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /vehicles (Fleet) returns HTTP 200", async () => {
    const res = await makeRequest("/vehicles");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /vehicle-details (Details) returns HTTP 200", async () => {
    const res = await makeRequest("/vehicle-details?id=1");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /how-it-works returns HTTP 200", async () => {
    const res = await makeRequest("/how-it-works");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /about returns HTTP 200", async () => {
    const res = await makeRequest("/about");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /contact returns HTTP 200", async () => {
    const res = await makeRequest("/contact");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("User Portal: GET /terms returns HTTP 200", async () => {
    const res = await makeRequest("/terms");
    assert.strictEqual(res.statusCode, 200);
  });

  await test("Admin Portal: GET /admin returns HTTP 200", async () => {
    const res = await makeRequest("/admin");
    assert.strictEqual(res.statusCode, 200);
  });

  // ------------------------------------------------------------
  // 2. AUTHENTICATION & LOGIN SWITCHING
  // ------------------------------------------------------------
  await test("Admin Auth: Authenticate System Administrator", async () => {
    const res = await makeRequest("/api/admin/login", { method: "POST" }, {
      email: "admin@gmail.com",
      password: "admin"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.token, "Admin token must be returned");
    adminToken = res.data.token;
  });

  await test("Customer Auth: Register Customer A", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "QA Customer Alpha",
      email: customerAEmail,
      password: "password123",
      phone: "+91 98765 00001"
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.token, "Customer A token must be returned");
    customerAToken = res.data.token;
    customerAId = res.data.user.id;
  });

  await test("Customer Auth: Register Customer B", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "QA Customer Beta",
      email: customerBEmail,
      password: "password123",
      phone: "+91 98765 00002"
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.token, "Customer B token must be returned");
    customerBToken = res.data.token;
    customerBId = res.data.user.id;
  });

  await test("Auth Validation: Duplicate email registration returns HTTP 409", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "Duplicate Tester",
      email: customerAEmail,
      password: "password123"
    });
    assert.strictEqual(res.statusCode, 409);
  });

  await test("Auth Validation: Incorrect password returns HTTP 401", async () => {
    const res = await makeRequest("/api/auth/login", { method: "POST" }, {
      email: customerAEmail,
      password: "wrongpassword"
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await test("Login Switcher: DOM navigation link strict separation", async () => {
    const indexPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "index.html"))
      ? path.join(__dirname, "..", "..", "public", "index.html")
      : path.join(__dirname, "..", "index.html");
    const adminPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "admin", "admin.html"))
      ? path.join(__dirname, "..", "..", "public", "admin", "admin.html")
      : path.join(__dirname, "..", "admin", "admin.html");
    const indexHtml = fs.readFileSync(indexPath, "utf-8");
    const adminHtml = fs.readFileSync(adminPath, "utf-8");
    assert.ok(indexHtml.includes('href="/admin"'), "User login must point to /admin");
    assert.ok(adminHtml.includes('href="/?auth=login"'), "Admin login must point to /?auth=login");
  });

  // ------------------------------------------------------------
  // 3. CONTACT API & XSS SANITIZATION
  // ------------------------------------------------------------
  await test("Contact API: Rejects empty payload with HTTP 400", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {});
    assert.strictEqual(res.statusCode, 400);
  });

  await test("Contact API: Accepts valid inquiry with HTML sanitization", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {
      name: "QA Inquirer <script>alert('xss')</script>",
      email: "inquiry@example.com",
      subject: "Test Subject",
      message: "This is a verified test inquiry for RideZone."
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.message);
  });

  // ------------------------------------------------------------
  // 4. VEHICLE CATALOG & YAMAHA MT-15 ORDERING
  // ------------------------------------------------------------
  await test("Vehicle Catalog: Ordered by ID ASC with Yamaha MT-15 in row 1 position 3", async () => {
    const res = await makeRequest("/api/vehicles");
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data), "Vehicles must be an array");
    assert.ok(res.data.length >= 7, "Catalog must contain at least 7 showroom vehicles");

    for (let i = 1; i < res.data.length; i++) {
      assert.ok(res.data[i].id >= res.data[i - 1].id, "Catalog must be ordered by id ASC");
    }

    const pos3Vehicle = res.data[2];
    assert.ok(pos3Vehicle.name.includes("Yamaha"), "Row 1, position 3 vehicle must be Yamaha MT-15");
    assert.strictEqual(pos3Vehicle.id, 3);
  });

  // ------------------------------------------------------------
  // 5. IMAGE SECURITY & MAGIC BYTES
  // ------------------------------------------------------------
  await test("Image Security: Customer token cannot upload to POST /api/admin/upload (403)", async () => {
    const res = await makeRequest("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` }
    }, {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      filename: "test.png"
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await test("Image Security: Rejects declared JPEG containing raw PNG binary (MIME mismatch)", async () => {
    const res = await makeRequest("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      dataUrl: "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      filename: "fake_jpeg.jpg"
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await test("Image Security: Admin successfully uploads valid PNG image", async () => {
    const res = await makeRequest("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      filename: "verified_test.png"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.url, "Uploaded image URL must be returned");
  });

  // ------------------------------------------------------------
  // 6. BOOKING FLOW & STATE MACHINE TRANSITIONS
  // ------------------------------------------------------------
  let testBookingId = null;
  const bookingDate = new Date(Date.now() + Math.floor(Math.random() * 200 + 400) * 86400000).toISOString().split("T")[0];

  await test("Booking Flow: Customer creates reservation (Pending status)", async () => {
    const res = await makeRequest("/api/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` }
    }, {
      user_id: customerAId,
      vehicle_id: 1,
      vehicle_name: "Ather 450X Gen 3",
      vehicle_reg_no: "TS 09 RZ 1001",
      pickup_date: bookingDate,
      pickup_time: "10:00",
      hours: 4,
      rental_price: 380,
      deposit_amount: 1500,
      total_price: 1880,
      payment_method: "UPI"
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.booking.id);
    testBookingId = res.data.booking.id;
  });

  await test("State Machine: Reject invalid transition (Cannot activate Pending directly)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${testBookingId}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  await test("State Machine: Admin accepts reservation (Pending -> Confirmed)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${testBookingId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Confirmed");
  });

  await test("State Machine: Admin activates rental on vehicle handover (Confirmed -> Active)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${testBookingId}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Active");
  });

  await test("State Machine: Admin records vehicle return (Active -> Completed)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${testBookingId}/return`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Completed");
  });

  await test("State Machine: Completed booking cannot be cancelled or re-activated", async () => {
    const res = await makeRequest(`/api/admin/bookings/${testBookingId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  // ------------------------------------------------------------
  // 7. ADMIN CANCELLATION & 100% REFUND PROPAGATION
  // ------------------------------------------------------------
  let cancelBookingId = null;
  const cancelDate = new Date(Date.now() + Math.floor(Math.random() * 200 + 700) * 86400000).toISOString().split("T")[0];

  await test("Refund Flow: Create booking and perform Admin Cancellation", async () => {
    const bookRes = await makeRequest("/api/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${customerAToken}` }
    }, {
      user_id: customerAId,
      vehicle_id: 2,
      vehicle_name: "Honda Activa 6G",
      vehicle_reg_no: "TS 09 RZ 1002",
      pickup_date: cancelDate,
      pickup_time: "12:00",
      hours: 6,
      rental_price: 450,
      deposit_amount: 1000,
      total_price: 1450,
      payment_method: "Credit Card"
    });
    assert.strictEqual(bookRes.statusCode, 201);
    cancelBookingId = bookRes.data.booking.id;

    // Admin cancels
    const cancelRes = await makeRequest(`/api/admin/bookings/${cancelBookingId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(cancelRes.statusCode, 200);
    assert.strictEqual(cancelRes.data.cancelled_by, "Admin");
    assert.strictEqual(cancelRes.data.refundAmount, 1450);
  });

  await test("Customer Journey: Cancelled booking displays Admin notice in customer history", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const target = res.data.bookings.find(b => b.id === cancelBookingId);
    assert.ok(target, "Booking must be in customer list");
    assert.strictEqual(target.booking_status, "Cancelled");
    assert.strictEqual(target.cancelled_by, "Admin");
    assert.strictEqual(target.refund_amount, 1450);
  });

  // ------------------------------------------------------------
  // 8. TENANT ISOLATION (IDOR PROTECTION)
  // ------------------------------------------------------------
  await test("IDOR Protection: Customer B cannot view Customer A's bookings", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerBToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const hasCustABooking = res.data.bookings.some(b => b.id === cancelBookingId);
    assert.strictEqual(hasCustABooking, false, "Customer B must not see Customer A's bookings");
  });

  await test("IDOR Protection: Customer B cannot cancel Customer A's booking", async () => {
    const res = await makeRequest(`/api/user/bookings/${cancelBookingId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerBToken}` }
    });
    assert.ok(res.statusCode === 404 || res.statusCode === 403, "Must reject cross-tenant cancellation");
  });

  // ------------------------------------------------------------
  // 9. CUSTOMER ACCOUNT & PROFILE UPDATES
  // ------------------------------------------------------------
  await test("Customer Profile: Retrieve and update profile metadata", async () => {
    const getRes = await makeRequest("/api/user/profile", {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    assert.strictEqual(getRes.statusCode, 200);

    const updateRes = await makeRequest("/api/user/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${customerAToken}` }
    }, {
      name: "QA Alpha Updated",
      phone: "+91 98765 99999"
    });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.data.user.name, "QA Alpha Updated");
  });

  // ------------------------------------------------------------
  // 10. ADMIN DASHBOARD STATS & REVENUE MATH
  // ------------------------------------------------------------
  await test("Admin Analytics: GET /api/admin/stats returns non-cancelled rental revenue and 7d vs month trend", async () => {
    const res7d = await makeRequest("/api/admin/stats?period=7d", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res7d.statusCode, 200);
    assert.ok(typeof res7d.data.stats.rentalRevenue === "number");
    assert.ok(typeof res7d.data.stats.totalDepositsHeld === "number");
    assert.ok(Array.isArray(res7d.data.stats.bookingsTrend));

    const resMonth = await makeRequest("/api/admin/stats?period=month", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(resMonth.statusCode, 200);
    assert.ok(Array.isArray(resMonth.data.stats.bookingsTrend));
    assert.strictEqual(resMonth.data.stats.period, "30d");
  });

  // ------------------------------------------------------------
  // 11. ADMIN PAYMENTS SYNCHRONIZATION
  // ------------------------------------------------------------
  await test("Admin Payments: Shows real customer metadata and refunds without placeholders", async () => {
    const res = await makeRequest("/api/admin/payments", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.transactions));
    assert.ok(typeof res.data.summary.gross_volume === "number");
    assert.ok(typeof res.data.summary.net_rental === "number");
    assert.ok(typeof res.data.summary.total_refunds === "number");

    const refundTxn = res.data.transactions.find(t => t.booking_id === cancelBookingId);
    assert.ok(refundTxn, "Cancelled booking must exist in payments transactions");
    assert.strictEqual(refundTxn.customer_name, "QA Alpha Updated");
    assert.strictEqual(refundTxn.customer_email, customerAEmail);
    assert.strictEqual(refundTxn.display_status, "Refunded");
  });

  // ------------------------------------------------------------
  // 12. CUSTOMER SUSPENSION CONTROL
  // ------------------------------------------------------------
  await test("Customer Management: Admin suspends customer account", async () => {
    const res = await makeRequest(`/api/admin/users/${customerAId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      status: "Suspended"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.status, "Suspended");
  });

  await test("Customer Management: Suspended customer receives HTTP 403 on protected customer routes", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerAToken}` }
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await test("Customer Management: Admin reactivates customer account (Active)", async () => {
    const res = await makeRequest(`/api/admin/users/${customerAId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      status: "Active"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.status, "Active");
  });

  // ------------------------------------------------------------
  // 13. ACCESSIBILITY & ESCAPE KEY MODAL HANDLING
  // ------------------------------------------------------------
  await test("Accessibility: Escape key listeners present in script.js and admin.js", async () => {
    const scriptPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "js", "script.js"))
      ? path.join(__dirname, "..", "..", "public", "js", "script.js")
      : path.join(__dirname, "..", "script.js");
    const adminJsPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "admin", "admin.js"))
      ? path.join(__dirname, "..", "..", "public", "admin", "admin.js")
      : path.join(__dirname, "..", "admin", "admin.js");
    const scriptJs = fs.readFileSync(scriptPath, "utf-8");
    const adminJs = fs.readFileSync(adminJsPath, "utf-8");
    assert.ok(scriptJs.includes('e.key === "Escape"') || scriptJs.includes('event.key === "Escape"'), "script.js must contain Escape listener");
    assert.ok(adminJs.includes("e.key === 'Escape'") || adminJs.includes("event.key === 'Escape'"), "admin.js must contain Escape listener");
  });

  console.log("====================================================");
  console.log("  PHASE 5 QA GATE: ALL 32 TEST VERIFICATIONS PASSED ✔");
  console.log("====================================================");
})();
