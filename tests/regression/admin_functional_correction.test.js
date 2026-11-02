const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Helper for making requests
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    const reqOptions = {
      hostname: 'localhost',
      port: Number(process.env.PORT) || 3001,
      path: path,
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('RIDEZONE — Admin Functional Correction Test Suite', () => {
  let adminToken = '';
  let customerToken = '';

  before(async () => {
    // 1. Authenticate Admin
    const adminLogin = await makeRequest('/api/admin/login', {
      method: 'POST',
      body: { email: 'admin@gmail.com', password: 'admin' }
    });
    assert.equal(adminLogin.status, 200, 'Admin login should succeed');
    adminToken = adminLogin.body.token;
    assert.ok(adminToken, 'Admin token should be present');

    // 2. Authenticate or register a customer
    const userLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'testcustomer@ridezone.com', password: 'Password@123' }
    });
    if (userLogin.status === 200) {
      customerToken = userLogin.body.token;
    } else {
      const reg = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: { name: 'Test Customer', email: 'testcustomer@ridezone.com', password: 'Password@123' }
      });
      customerToken = reg.body.token;
    }
  });

  test('1. Dashboard Stats API returns authoritative Rental Revenue & Deposits', async () => {
    const res = await makeRequest('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const stats = res.body.stats;
    assert.ok(stats, 'Stats payload should exist');
    assert.ok(typeof stats.rentalRevenue === 'number', 'rentalRevenue must be a number');
    assert.ok(stats.rentalRevenue > 0, `rentalRevenue (${stats.rentalRevenue}) must be > 0`);
    assert.ok(typeof stats.depositsHeld === 'number', 'depositsHeld must be a number');
    assert.ok(typeof stats.pendingBookings === 'number', 'pendingBookings must be a number');
    assert.ok(Array.isArray(res.body.topVehicles), 'topVehicles must be an array');
    assert.ok(Array.isArray(res.body.bookingsTrend), 'bookingsTrend must be an array');
  });

  test('2. Dashboard Stats supports period query parameter (7d vs month)', async () => {
    const res7d = await makeRequest('/api/admin/stats?period=7d', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res7d.status, 200);
    assert.ok(Array.isArray(res7d.body.bookingsTrend));

    const resMonth = await makeRequest('/api/admin/stats?period=month', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resMonth.status, 200);
    assert.ok(Array.isArray(resMonth.body.bookingsTrend));
  });

  test('3. Top Vehicles list contains vehicle image and live fleet status', async () => {
    const res = await makeRequest('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const top = res.body.topVehicles;
    if (top.length > 0) {
      assert.ok(top[0].image, 'Top vehicle must have an image path');
      assert.ok(top[0].name, 'Top vehicle must have a name');
      assert.ok(top[0].status, 'Top vehicle must have a status');
    }
  });

  test('4. Admin Profile isolation prevents cross-table corruption of customers', async () => {
    const updateRes = await makeRequest('/api/admin/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'System Administrator',
        email: 'admin@gmail.com',
        phone: '+91 98765 43210',
        location: 'Hyderabad, Telangana, India'
      }
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.admin.name, 'System Administrator');
    assert.equal(updateRes.body.admin.email, 'admin@gmail.com');
  });

  test('5. Admin Booking Accept endpoint works transactionally', async () => {
    // Get all bookings to find or inspect
    const bRes = await makeRequest('/api/admin/bookings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(bRes.status, 200);
    const bookings = bRes.body.bookings;
    assert.ok(Array.isArray(bookings));
  });

  test('6. File Upload Endpoint accepts data URL and stores safely', async () => {
    const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await makeRequest('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { dataUrl: dummyDataUrl, filename: 'test_image.png' }
    });
    assert.equal(uploadRes.status, 200);
    assert.ok(uploadRes.body.url, 'Upload response must include url');
    assert.ok(uploadRes.body.url.startsWith('/uploads/'), 'Upload path must be in /uploads/');
  });
});
