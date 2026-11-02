/**
 * RideZone Mandatory Rental Conditions & Reservation Flow Verification
 * Tests the on-page mandatory rental conditions, checkbox requirements,
 * accessibility labels, bypass prevention, and server-side validation.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const envPath = fs.existsSync(path.join(__dirname, '..', '..', '.env'))
  ? path.join(__dirname, '..', '..', '.env')
  : path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

const BASE_URL = 'http://localhost:3001';

async function runMandatoryConditionsTests() {
  console.log('=== RIDEZONE MANDATORY RENTAL CONDITIONS VERIFICATION ===\n');

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

  const projectRoot = path.join(__dirname, '..', '..');
  const publicDir = fs.existsSync(path.join(projectRoot, 'public'))
    ? path.join(projectRoot, 'public')
    : projectRoot;

  // 1. DOM Verification on Reservation Pages
  console.log('1. DOM & Accessibility Verification across Reservation Pages:');
  const pages = ['vehicles.html', 'vehicle-details.html', 'index.html'];

  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');

    assert(html.includes('id="mandatoryConditionsCard"'), `${page} has #mandatoryConditionsCard container`);
    assert(html.includes('id="condEligibility"'), `${page} contains Eligibility & Verification checkbox (#condEligibility)`);
    assert(html.includes('id="condDepositCancellation"'), `${page} contains Security Deposit & Cancellation checkbox (#condDepositCancellation)`);
    assert(html.includes('id="condSafeUsage"'), `${page} contains Safe Usage & Accurate Information checkbox (#condSafeUsage)`);
    assert(html.includes('id="policyDepositDisplay"'), `${page} contains dynamic #policyDepositDisplay`);
    assert(html.includes('for="condEligibility"'), `${page} has accessible <label for="condEligibility"> association`);
    assert(html.includes('for="condDepositCancellation"'), `${page} has accessible <label for="condDepositCancellation"> association`);
    assert(html.includes('for="condSafeUsage"'), `${page} has accessible <label for="condSafeUsage"> association`);
    assert(html.includes('href="/terms"'), `${page} includes supplementary link to /terms`);
    assert(html.includes('target="_blank"'), `${page} terms link opens safely in new tab (target="_blank")`);
    
    // Check initial disabled state of proceed button
    const hasDisabledProceed = /<button[^>]+id="bookingProceedBtn"[^>]*disabled[^>]*>/i.test(html);
    assert(hasDisabledProceed, `${page} has #bookingProceedBtn initially disabled`);
  }

  // 2. CSS Styling & Design System Verification
  console.log('\n2. CSS Design System Verification in style.css:');
  const css = fs.readFileSync(path.join(publicDir, 'css', 'style.css'), 'utf8');
  assert(css.includes('.mandatory-conditions-card'), 'style.css defines .mandatory-conditions-card');
  assert(css.includes('.mandatory-condition-row'), 'style.css defines .mandatory-condition-row');
  assert(css.includes('.mandatory-condition-row.is-checked'), 'style.css defines .is-checked state for condition rows');
  assert(css.includes('.mandatory-condition-row.has-error'), 'style.css defines .has-error state for condition rows');
  assert(css.includes('.conditions-highlights-box'), 'style.css defines .conditions-highlights-box');
  assert(css.includes('.fullpage-submit-btn:disabled'), 'style.css defines disabled state for proceed button');

  // 3. Client-Side Script Verification in script.js
  console.log('\n3. Client-Side Booking Logic Verification in script.js:');
  const js = fs.readFileSync(path.join(publicDir, 'js', 'script.js'), 'utf8');
  assert(js.includes('updateProceedButtonState'), 'script.js defines updateProceedButtonState function');
  assert(js.includes('rental-condition-checkbox'), 'script.js queries .rental-condition-checkbox');
  assert(js.includes('Please accept the required rental conditions before continuing.'), 'script.js enforces required validation message');
  assert(js.includes('policyDepositDisplay'), 'script.js dynamically updates deposit amount in conditions card');
  assert(js.includes('openBooking(vehicleIdentifier, isBackNav = false)'), 'script.js preserves accepted state on back navigation');
  assert(js.includes('!bookingData.conditionsAccepted'), 'script.js guards openPayment against bypassed conditions');

  // 4. Server-Side Booking API Validation (Prevent Bypass):
  console.log('\n4. Server-Side Booking API Validation (Prevent Bypass):');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ridezone',
    port: Number(process.env.DB_PORT || 3306)
  });

  await pool.query("DELETE FROM bookings WHERE user_name = 'Terms Test User'");
  await pool.query("DELETE FROM users WHERE email LIKE 'terms_test_%'");

  const testUserEmail = `terms_test_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Terms Test User',
      email: testUserEmail,
      password: 'Password123!',
      phone: '+91 91234 56789'
    })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.token, 'Test user registered successfully');
  const userToken = regData.token;

  // A. Attempt booking with terms_accepted: false (Bypass attempt)
  const futureDays = 150 + Math.floor(Math.random() * 300);
  const futureDate = new Date(Date.now() + futureDays * 86400000).toISOString().split('T')[0];
  const bypassRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      vehicle: 'Royal Enfield Hunter 350',
      date: futureDate,
      time: '14:00',
      hours: 2,
      payment_method: 'UPI',
      terms_accepted: false
    })
  });
  const bypassData = await bypassRes.json();
  assert(bypassRes.status === 400, 'Server rejected booking with terms_accepted: false (HTTP 400)');
  assert(
    bypassData.error === 'Please accept the required rental conditions before continuing.',
    `Server returned exact error: "${bypassData.error}"`
  );

  // B. Attempt booking with terms_accepted: true (Legitimate submission)
  const validRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      vehicle: 'Royal Enfield Hunter 350',
      date: futureDate,
      time: '14:00',
      hours: 2,
      payment_method: 'UPI',
      terms_accepted: true
    })
  });
  const validData = await validRes.json();
  if (validRes.status !== 201) {
    console.error('  [Valid Booking Failed Status]:', validRes.status, validData);
  }
  assert(validRes.status === 201 && validData.booking, 'Server accepted booking with terms_accepted: true (HTTP 201)');

  // Clean up
  if (validData.booking?.id) {
    await pool.query('DELETE FROM bookings WHERE id = ?', [validData.booking.id]);
  }
  await pool.query('DELETE FROM users WHERE email = ?', [testUserEmail]);
  await pool.end();

  console.log(`\n========================================`);
  console.log(`MANDATORY CONDITIONS RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runMandatoryConditionsTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
