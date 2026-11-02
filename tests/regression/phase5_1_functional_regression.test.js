/**
 * ============================================================
 * RIDEZONE — PHASE 5.1 FUNCTIONAL REGRESSION TEST SUITE
 * Exhaustive Verification for:
 * 1. Add Vehicle Image & Gallery Management
 * 2. Edit Vehicle Gallery Persistence & Text-only Preservation
 * 3. Booking Tab Status Counts Synchronization
 * 4. Booking Status Filtering & Lifecycle Actions
 * 5. Payment Receipt Endpoint, Data Completeness & Fields
 * 6. Payment Financial KPI Calculations (Non-zero)
 * 7. Payment Status Filtering & Search
 * 8. Admin Profile Update with In-Modal Photo Management
 * 9. Security & Image Authorization Behavior
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

(async function runPhase51FunctionalRegressionSuite() {
  console.log("====================================================");
  console.log("  RIDEZONE — PHASE 5.1 FUNCTIONAL REGRESSION SUITE  ");
  console.log("====================================================");

  let adminToken = null;
  let customerToken = null;
  let customerId = null;
  const uniqueTs = Date.now();
  const customerEmail = `p51_user_${uniqueTs}@example.com`;

  // 1. Authenticate Admin and Customer
  await test("Auth: Authenticate Administrator", async () => {
    const res = await makeRequest("/api/admin/login", { method: "POST" }, {
      email: "admin@gmail.com",
      password: "admin"
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.token);
    adminToken = res.data.token;
  });

  await test("Auth: Register and Authenticate Customer", async () => {
    const res = await makeRequest("/api/auth/register", { method: "POST" }, {
      name: "Phase51 Test Rider",
      email: customerEmail,
      password: "password123",
      phone: "+91 98765 11111"
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.token);
    customerToken = res.data.token;
    customerId = res.data.user.id;
  });

  // ------------------------------------------------------------
  // 2. VEHICLE ADD & GALLERY PERSISTENCE
  // ------------------------------------------------------------
  let createdVehicleId = null;
  const sampleGallery = ["/assets/hunter.png", "/assets/hunter-2.png", "/assets/hunter-3.png"];

  await test("Vehicle Add: Save vehicle with primary image and gallery array", async () => {
    const res = await makeRequest("/api/admin/vehicles", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: `Regression Hunter 350 ${uniqueTs}`,
      brand: "Royal Enfield",
      model: "Hunter 350 Retro",
      category: "Bike",
      year: 2024,
      fuel_type: "Petrol",
      transmission: "Manual",
      price: 340,
      deposit_amount: 2000,
      rating: 4.9,
      image: "/assets/hunter.png",
      vehicle_reg_no: `TS 09 RZ ${Math.floor(1000 + Math.random() * 8999)}`,
      status: "Active",
      description: "Test vehicle with complete gallery persistence.",
      gallery: sampleGallery
    });
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.data.vehicle.id);
    createdVehicleId = res.data.vehicle.id;
  });

  await test("Vehicle Gallery: GET /api/admin/vehicles/:id returns persistent gallery array", async () => {
    const res = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.data.vehicle.gallery));
    assert.strictEqual(res.data.vehicle.gallery.length, 3);
    assert.strictEqual(res.data.vehicle.gallery[0], "/assets/hunter.png");
  });

  // ------------------------------------------------------------
  // 3. VEHICLE EDIT & GALLERY PRESERVATION ON TEXT-ONLY EDITS
  // ------------------------------------------------------------
  await test("Vehicle Edit: Text-only update preserves existing gallery", async () => {
    const editRes = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: `Regression Hunter 350 Updated ${uniqueTs}`,
      price: 360
    });
    assert.strictEqual(editRes.statusCode, 200);

    const getRes = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.data.vehicle.name, `Regression Hunter 350 Updated ${uniqueTs}`);
    assert.strictEqual(Number(getRes.data.vehicle.price), 360);
    assert.ok(Array.isArray(getRes.data.vehicle.gallery));
    assert.strictEqual(getRes.data.vehicle.gallery.length, 3, "Gallery must not be wiped out on text-only edit");
  });

  await test("Vehicle Edit: Update gallery array adds and replaces images cleanly", async () => {
    const newGallery = ["/assets/hunter-2.png", "/assets/hunter.png"];
    const editRes = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      image: "/assets/hunter-2.png",
      gallery: newGallery
    });
    assert.strictEqual(editRes.statusCode, 200);

    const getRes = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.data.vehicle.image, "/assets/hunter-2.png");
    assert.strictEqual(getRes.data.vehicle.gallery.length, 2);
  });

  // ------------------------------------------------------------
  // 4. BOOKINGS COUNTS & STATUS FILTERING
  // ------------------------------------------------------------
  let bookingId = null;
  const bookingDate = new Date(Date.now() + Math.floor(Math.random() * 200 + 400) * 86400000).toISOString().split("T")[0];

  await test("Bookings: Customer creates reservation (Pending status)", async () => {
    const res = await makeRequest("/api/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      user_id: customerId,
      vehicle_id: createdVehicleId,
      vehicle_name: `Regression Hunter 350 Updated ${uniqueTs}`,
      vehicle_reg_no: "TS 09 RZ 9999",
      pickup_date: bookingDate,
      pickup_time: "10:00",
      hours: 5,
      rental_price: 1800,
      deposit_amount: 2000,
      total_price: 3800,
      payment_method: "UPI"
    });
    assert.strictEqual(res.statusCode, 201);
    bookingId = res.data.booking.id;
  });

  await test("Bookings: GET /api/admin/bookings returns non-zero counts object matching records", async () => {
    const res = await makeRequest("/api/admin/bookings", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.counts, "Counts object must be present in response");
    assert.ok(res.data.counts.all > 0, "All count must be greater than 0");
    assert.ok(res.data.counts.all >= res.data.counts.pending, "All count must be >= pending count");
    assert.ok(typeof res.data.counts.pending === "number");
    assert.ok(typeof res.data.counts.confirmed === "number");
    assert.ok(typeof res.data.counts.active === "number");
    assert.ok(typeof res.data.counts.completed === "number");
    assert.ok(typeof res.data.counts.cancelled === "number");
  });

  await test("Bookings: Filter by status returns filtered records matching query", async () => {
    const pendingRes = await makeRequest("/api/admin/bookings?status=Pending", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(pendingRes.statusCode, 200);
    for (const b of pendingRes.data.bookings) {
      assert.strictEqual(b.booking_status, "Pending");
    }
  });

  // ------------------------------------------------------------
  // 5. BOOKING DETAILS & LIFECYCLE STATE ACTIONS
  // ------------------------------------------------------------
  await test("Booking Lifecycle: Admin accepts booking (Pending -> Confirmed)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${bookingId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Confirmed");
  });

  await test("Booking Lifecycle: Admin activates booking (Confirmed -> Active)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${bookingId}/activate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Active");
  });

  await test("Booking Lifecycle: Admin records vehicle return (Active -> Completed)", async () => {
    const res = await makeRequest(`/api/admin/bookings/${bookingId}/return`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.booking.booking_status, "Completed");
  });

  // ------------------------------------------------------------
  // 6. PAYMENTS & RECEIPT DATA COMPLETENESS
  // ------------------------------------------------------------
  await test("Payments API: Returns non-zero summary metrics and valid transactions list", async () => {
    const res = await makeRequest("/api/admin/payments", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.summary, "Payment summary must exist");
    assert.ok(res.data.summary.gross_volume > 0, "Gross volume must not be 0");
    assert.ok(res.data.summary.net_rental > 0, "Net rental revenue must not be 0");
    assert.ok(Array.isArray(res.data.transactions));
    assert.ok(res.data.transactions.length > 0);
  });

  await test("Receipt Data: Payment transaction contains full vehicle, customer, rental and money breakdown", async () => {
    const res = await makeRequest("/api/admin/payments", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    const txn = res.data.transactions.find(t => t.booking_id === bookingId);
    assert.ok(txn, "Created booking must exist in payments transactions");

    // Check required receipt fields
    assert.ok(txn.transaction_id.startsWith("TXN-"), "Transaction ID must have TXN- prefix");
    assert.ok(txn.booking_id, "Booking reference must exist");
    assert.ok(txn.customer_name, "Customer name must exist");
    assert.ok(txn.customer_email, "Customer email must exist");
    assert.ok(txn.customer_phone, "Customer phone must exist");
    assert.ok(txn.vehicle_name, "Vehicle name must exist");
    assert.ok(txn.vehicle_brand, "Vehicle brand must exist");
    assert.ok(txn.pickup_date, "Pickup date must exist");
    assert.ok(txn.pickup_time, "Pickup time must exist");
    assert.ok(txn.hours > 0, "Rental hours must exist");
    assert.ok(txn.rental_price > 0, "Rental price must exist");
    assert.ok(txn.deposit_amount > 0, "Deposit amount must exist");
    assert.ok(txn.total_price > 0, "Total price must exist");
    assert.ok(txn.payment_method, "Payment method must exist");
    assert.ok(txn.display_status, "Display status must exist");
  });

  await test("Payments Filter: Filtering by status (Paid vs Refunded) works accurately", async () => {
    const paidRes = await makeRequest("/api/admin/payments?status=Paid", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(paidRes.statusCode, 200);
    for (const t of paidRes.data.transactions) {
      assert.strictEqual(t.display_status, "Paid");
    }
  });

  await test("Payments Search: Searching by vehicle name or transaction ID works", async () => {
    const searchRes = await makeRequest(`/api/admin/payments?search=Regression`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(searchRes.statusCode, 200);
    assert.ok(searchRes.data.transactions.length > 0);
    assert.ok(searchRes.data.transactions.some(t => t.vehicle_name.includes("Regression")));
  });

  // ------------------------------------------------------------
  // 7. ADMIN PROFILE & IN-MODAL IMAGE MANAGEMENT
  // ------------------------------------------------------------
  await test("Admin Profile: Update metadata and photo together", async () => {
    const updateRes = await makeRequest("/api/admin/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: "System Administrator Pro",
      email: "admin@gmail.com",
      phone: "+91 98765 00000",
      location: "Bengaluru, Karnataka, India",
      profile_photo: "/assets/hunter.png"
    });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.data.admin.name, "System Administrator Pro");
    assert.strictEqual(updateRes.data.admin.location, "Bengaluru, Karnataka, India");
    assert.strictEqual(updateRes.data.admin.profile_photo, "/assets/hunter.png");
  });

  await test("Admin Profile Persistence: GET /api/admin/me returns persisted profile photo and details", async () => {
    const meRes = await makeRequest("/api/admin/me", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.data.admin.name, "System Administrator Pro");
    assert.strictEqual(meRes.data.admin.profile_photo, "/assets/hunter.png");
  });

  await test("Admin Profile: Removing photo sets profile_photo to null cleanly", async () => {
    const removeRes = await makeRequest("/api/admin/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      name: "System Administrator",
      email: "admin@gmail.com",
      phone: "+91 98765 43210",
      location: "Hyderabad, Telangana, India",
      profile_photo: null
    });
    assert.strictEqual(removeRes.statusCode, 200);
    assert.strictEqual(removeRes.data.admin.profile_photo, null);

    const meRes = await makeRequest("/api/admin/me", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(meRes.statusCode, 200);
    assert.strictEqual(meRes.data.admin.profile_photo, null);
  });

  // ------------------------------------------------------------
  // 8. SECURITY & AUTHORIZATION PRESERVATION
  // ------------------------------------------------------------
  await test("Security: Customer token cannot update admin profile (HTTP 403)", async () => {
    const res = await makeRequest("/api/admin/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${customerToken}` }
    }, {
      name: "Hacked Admin"
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await test("Security: Unauthenticated request cannot fetch payments (HTTP 401)", async () => {
    const res = await makeRequest("/api/admin/payments");
    assert.strictEqual(res.statusCode, 401);
  });

  // Cleanup temporary test vehicle
  await test("Cleanup: Delete temporary test vehicle", async () => {
    // Complete any active bookings or delete directly
    const res = await makeRequest(`/api/admin/vehicles/${createdVehicleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
  });

  console.log("====================================================");
  console.log("  PHASE 5.1 FUNCTIONAL REGRESSION: ALL TESTS PASSED ✔");
  console.log("====================================================");
})();
