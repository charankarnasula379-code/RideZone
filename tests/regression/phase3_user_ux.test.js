/**
 * tests/phase3_user_ux.test.js
 * Comprehensive automated verification for Phase 3 User UX Polish & Customer Journey Completion.
 */

const assert = require("assert");
const http = require("http");

const BASE_URL = "http://localhost:3001";

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: options.headers || {}
    };

    if (body) {
      if (typeof body === "object" && !reqOptions.headers["Content-Type"]) {
        reqOptions.headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
      }
      reqOptions.headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log("====================================================");
  console.log("  RIDEZONE — PHASE 3 USER UX & JOURNEY TEST SUITE");
  console.log("====================================================");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        process.stdout.write(`[TEST] ${name} ... `);
        await fn();
        console.log("PASSED ✔");
        passed++;
      } catch (err) {
        console.log(`FAILED ❌: ${err.message}`);
        failed++;
      }
    };
  }

  // 1. Contact Form API Validation
  await test("Contact API rejects empty payload (400)", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {});
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.data.error.includes("required"));
  })();

  await test("Contact API rejects invalid email format (400)", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {
      name: "Rahul Sharma",
      email: "invalid-email-string",
      subject: "Inquiry about Ather",
      message: "Hello, is the Ather available for tomorrow?"
    });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.data.error.toLowerCase().includes("email"));
  })();

  await test("Contact API rejects short message (400)", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {
      name: "Rahul Sharma",
      email: "rahul@example.com",
      subject: "Test",
      message: "Hi"
    });
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.data.error.toLowerCase().includes("message"));
  })();

  await test("Contact API accepts valid inquiry (200)", async () => {
    const res = await makeRequest("/api/contact", { method: "POST" }, {
      name: "Rahul Sharma",
      email: "rahul@example.com",
      subject: "Showroom visit booking",
      message: "I would like to schedule a pickup for the Yamaha MT-15 this weekend."
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.message.includes("received"));
  })();

  // 2. Catalog & Yamaha MT-15 Placement
  await test("GET /api/vehicles returns catalog ordered by id with Yamaha MT-15 in row 1 position 3", async () => {
    const res = await makeRequest("/api/vehicles");
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length >= 3);
    assert.strictEqual(res.data[0].id, 1, "First vehicle is ID 1 (Ather)");
    assert.strictEqual(res.data[1].id, 2, "Second vehicle is ID 2 (Activa)");
    assert.strictEqual(res.data[2].id, 3, "Third vehicle is ID 3 (Yamaha MT-15)");
    assert.ok(res.data[2].name.includes("Yamaha MT-15"), "3rd card is Yamaha MT-15");
  })();

  // 3. User Authentication & Profile Lifecycle
  const testUserEmail = `customer_p3_${Date.now()}@example.com`;
  const testUserPassword = "Password123!";
  let customerToken = null;
  let customerId = null;

  await test("Register new customer for Phase 3 testing", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "Ananya Roy",
      email: testUserEmail,
      password: testUserPassword,
      phone: "9876543210"
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.token);
    assert.ok(res.data.user);
    customerToken = res.data.token;
    customerId = res.data.user.id;
  })();

  await test("GET /api/user/profile retrieves customer profile", async () => {
    const res = await makeRequest("/api/user/profile", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.email, testUserEmail);
    assert.strictEqual(res.data.user.name, "Ananya Roy");
  })();

  await test("PUT /api/user/profile updates customer metadata", async () => {
    const res = await makeRequest("/api/user/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      name: "Ananya Roy Chowdhury",
      email: testUserEmail,
      phone: "+91 98765 43210"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.name, "Ananya Roy Chowdhury");
  })();

  // 4. Booking Lifecycle in Customer Account
  let bookingId = null;
  await test("Create customer booking (Pending status)", async () => {
    const res = await makeRequest("/api/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      vehicle_id: 3,
      pickup_date: "2026-11-20",
      pickup_time: "10:00:00",
      hours: 4,
      payment_method: "UPI",
      booking_status: "Pending",
      terms_agreed: true
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.booking);
    bookingId = res.data.booking.id;
    assert.strictEqual(res.data.booking.booking_status, "Pending");
  })();

  await test("GET /api/user/bookings returns customer booking (Pending status)", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.bookings));
    const found = res.data.bookings.find((b) => b.id === bookingId);
    assert.ok(found, "Booking found in customer's list");
    assert.strictEqual(found.booking_status, "Pending");
  })();

  // 5. Admin Acceptance -> Confirmed
  let adminToken = null;
  await test("Authenticate Admin to manage booking lifecycle", async () => {
    const res = await makeRequest("/api/auth/login", { method: "POST" }, {
      email: "admin@gmail.com",
      password: "admin"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.token);
    adminToken = res.data.token;
  })();

  await test("Admin accepts booking (Pending -> Confirmed)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${bookingId}/accept`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Confirmed");
  })();

  await test("Customer sees booking updated to Confirmed in GET /api/user/bookings", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const found = res.data.bookings.find((b) => b.id === bookingId);
    assert.ok(found);
    assert.strictEqual(found.booking_status, "Confirmed");
  })();

  // 6. Admin Cancellation -> Customer History Notification
  await test("Admin cancels booking (Confirmed -> Cancelled with cancelled_by=Admin)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      reason: "Maintenance recall for selected motorcycle."
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Cancelled");
    assert.strictEqual(res.data.booking.cancelled_by, "Admin");
  })();

  await test("Customer sees booking in history with cancelled_by=Admin and full refund", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const found = res.data.bookings.find((b) => b.id === bookingId);
    assert.ok(found);
    assert.strictEqual(found.booking_status, "Cancelled");
    assert.strictEqual(found.cancelled_by, "Admin");
    assert.ok(Number(found.refund_amount) > 0, "Refund recorded");
  })();

  // 7. Customer Tenant Isolation
  const otherUserEmail = `customer_other_${Date.now()}@example.com`;
  let otherToken = null;

  await test("Register second customer to test tenant isolation", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "Vikram Seth",
      email: otherUserEmail,
      password: testUserPassword
    });
    assert.strictEqual(res.statusCode, 201);
    otherToken = res.data.token;
  })();

  await test("Second customer cannot view first customer's bookings", async () => {
    const res = await makeRequest("/api/user/bookings", {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const found = res.data.bookings.find((b) => b.id === bookingId);
    assert.strictEqual(found, undefined, "First customer booking must not appear for second customer");
  })();

  await test("Second customer cannot cancel first customer's booking", async () => {
    const res = await makeRequest(`/api/user/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.strictEqual(res.statusCode, 404);
  })();

  await test("Customer token cannot access admin routes (403)", async () => {
    const res = await makeRequest("/api/admin/dashboard-stats", {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.statusCode, 403);
  })();

  console.log("====================================================");
  console.log(`  PHASE 3 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("====================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test Suite Execution Error:", err);
  process.exit(1);
});
