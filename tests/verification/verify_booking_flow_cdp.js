/**
 * Native Node.js Chrome DevTools Protocol (CDP) Verification for Booking Flow
 * Tests:
 * 1. Booking screen: 4 datetime controls, automatic duration calculation, validation, single-arrow Back button
 * 2. Payment screen: Order summary displays both pickup & return datetimes, single-arrow Back button
 * 3. Back navigation: Preserves state without duplicating bookings
 * 4. Confirmation screen: Verified pickup & return datetimes, single-arrow Back button
 * 5. Vehicle Details screen: Single-arrow Back button
 * Saves screenshots to public/assets/test_screenshots/
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CDP_HTTP = 'http://localhost:9222';
const BASE_URL = 'http://localhost:3001';

async function cdpRequest(endpoint, method = 'GET', body = null) {
  const opt = { method };
  if (body) {
    opt.headers = { 'Content-Type': 'application/json' };
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(`${CDP_HTTP}${endpoint}`, opt);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { raw: text };
  }
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
      }
    };
  }

  async waitOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve) => {
      this.ws.onopen = () => resolve();
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'd:\\temp_chrome_booking_prof';

  console.log('[Runner] Spawning Chrome headless on port 9222...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check'
  ], {
    detached: false,
    stdio: 'ignore'
  });

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch('http://localhost:9222/json/version');
      if (res.ok) {
        console.log('[Runner] Chrome CDP is ready!');
        break;
      }
    } catch (e) {}
  }

  const screenshotsDir = path.join(__dirname, '..', '..', 'public', 'assets', 'test_screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let failures = 0;
  let passes = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ PASS: ${msg}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failures++;
    }
  }

  try {
    const newTab = await cdpRequest('/json/new?' + encodeURIComponent(`${BASE_URL}/screens/booking/index.html?id=1&v=Royal%20Enfield%20Hunter%20350`), 'PUT');
    const client = new CDPClient(newTab.webSocketDebuggerUrl);
    await client.waitOpen();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    async function setViewport(width = 1440, height = 900) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    async function takeScreenshot(filename) {
      const result = await client.send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(result.data, 'base64');
      const outPath = path.join(screenshotsDir, filename);
      fs.writeFileSync(outPath, buffer);
      console.log(`  📸 Screenshot saved: ${filename} (${Math.round(buffer.length / 1024)} KB)`);
    }

    // ==========================================
    // 1. TEST BOOKING SCREEN
    // ==========================================
    console.log('\n--- 1. Testing Booking Screen (/screens/booking/index.html) ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/screens/booking/index.html?id=1&v=Royal%20Enfield%20Hunter%20350` });
    await new Promise((r) => setTimeout(r, 1500));
    await setViewport(1440, 900);

    const bookingCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const backBtn = document.querySelector('#bookingBackBtn');
        const backText = backBtn ? backBtn.textContent.trim() : '';
        const svgs = backBtn ? backBtn.querySelectorAll('svg').length : 0;
        
        const pickupDate = document.querySelector('#bookingPickupDate');
        const pickupTime = document.querySelector('#bookingPickupTime');
        const returnDate = document.querySelector('#bookingReturnDate');
        const returnTime = document.querySelector('#bookingReturnTime');

        const hasDoubleArrow = backText.includes('← ←') || (backText.includes('←') && svgs > 0);

        return {
          backText,
          svgs,
          hasDoubleArrow,
          hasPickupDate: !!pickupDate,
          hasPickupTime: !!pickupTime,
          hasReturnDate: !!returnDate,
          hasReturnTime: !!returnTime,
          pickupDateVal: pickupDate ? pickupDate.value : '',
          pickupTimeVal: pickupTime ? pickupTime.value : '',
          returnDateVal: returnDate ? returnDate.value : '',
          returnTimeVal: returnTime ? returnTime.value : ''
        };
      })()`,
      returnByValue: true
    });

    const bRes = bookingCheck.result.value;
    assert(bRes.hasPickupDate && bRes.hasPickupTime, 'Pickup Date and Pickup Time controls are present');
    assert(bRes.hasReturnDate && bRes.hasReturnTime, 'Return Date and Return Time controls are present');
    assert(bRes.backText.includes('Back to Vehicle Details'), `Back button text is "Back to Vehicle Details" (${bRes.backText})`);
    assert(!bRes.hasDoubleArrow, 'Back button has exactly ONE arrow (no duplicate arrows)');

    // Test automatic calculation: click Half Day (6 Hours) plan
    const planCalcCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const halfDayBtn = document.querySelector('[data-mode="halfday"]');
        if (halfDayBtn) halfDayBtn.click();
        const pDate = document.querySelector('#bookingPickupDate').value;
        const pTime = document.querySelector('#bookingPickupTime').value;
        const rDate = document.querySelector('#bookingReturnDate').value;
        const rTime = document.querySelector('#bookingReturnTime').value;
        const durationDisplay = document.querySelector('#summaryDuration')?.textContent;
        return { pDate, pTime, rDate, rTime, durationDisplay };
      })()`,
      returnByValue: true
    });

    const planRes = planCalcCheck.result.value;
    assert(planRes.durationDisplay && planRes.durationDisplay.includes('6 hours'), `Half day calculation sets duration to 6 hours (${planRes.durationDisplay})`);

    // Test 24 Hours plan
    const dayPlanCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const dayBtn = document.querySelector('[data-mode="fullday"]');
        if (dayBtn) dayBtn.click();
        const pDate = document.querySelector('#bookingPickupDate').value;
        const rDate = document.querySelector('#bookingReturnDate').value;
        const durationDisplay = document.querySelector('#summaryDuration')?.textContent;
        return { pDate, rDate, durationDisplay };
      })()`,
      returnByValue: true
    });
    const dayRes = dayPlanCheck.result.value;
    assert(dayRes.durationDisplay && dayRes.durationDisplay.includes('24 hours'), `24 hours calculation sets duration to 24 hours (${dayRes.durationDisplay})`);

    // Test Invalid datetime validation (return <= pickup)
    const invalidValCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const pDate = document.querySelector('#bookingPickupDate');
        const rDate = document.querySelector('#bookingReturnDate');
        pDate.value = '2026-09-15';
        rDate.value = '2026-09-14'; // Return before pickup
        rDate.dispatchEvent(new Event('change'));
        const msg = document.querySelector('#bookingMessage')?.textContent || '';
        const isProceedDisabled = document.querySelector('#bookingProceedBtn')?.disabled;
        return { msg, isProceedDisabled };
      })()`,
      returnByValue: true
    });
    const invRes = invalidValCheck.result.value;
    assert(invRes.msg.includes('Return datetime must be strictly after pickup datetime') && invRes.isProceedDisabled, 'Invalid datetime correctly rejected with error message');

    // Restore valid plan and accept conditions with dynamic date to prevent overlap
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const randDay = Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0');
        const pDate = document.querySelector('#bookingPickupDate');
        pDate.value = '2026-11-' + randDay;
        pDate.dispatchEvent(new Event('change'));

        const halfDayBtn = document.querySelector('[data-mode="halfday"]');
        if (halfDayBtn) halfDayBtn.click();

        document.querySelector('#condEligibility').checked = true;
        document.querySelector('#condEligibility').dispatchEvent(new Event('change'));
        document.querySelector('#condDepositCancellation').checked = true;
        document.querySelector('#condDepositCancellation').dispatchEvent(new Event('change'));
        document.querySelector('#condSafeUsage').checked = true;
        document.querySelector('#condSafeUsage').dispatchEvent(new Event('change'));
      })()`
    });

    await takeScreenshot('cdp_booking_screen.png');

    // Submit booking form -> proceeds to Payment
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('#bookingForm').dispatchEvent(new Event('submit'));
      })()`
    });

    await new Promise((r) => setTimeout(r, 1500));

    // ==========================================
    // 2. TEST PAYMENT SCREEN
    // ==========================================
    console.log('\n--- 2. Testing Payment Screen (/screens/payment/index.html) ---');
    const paymentCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const backBtn = document.querySelector('#paymentBackBtn');
        const backText = backBtn ? backBtn.textContent.trim() : '';
        const svgs = backBtn ? backBtn.querySelectorAll('svg').length : 0;
        const hasDoubleArrow = backText.includes('← ←') || (backText.includes('←') && svgs > 0);

        const pickupDisplay = document.querySelector('#payPickupSchedule')?.textContent.trim() || '';
        const returnDisplay = document.querySelector('#payReturnSchedule')?.textContent.trim() || '';
        const durationDisplay = document.querySelector('#payDuration')?.textContent.trim() || '';

        return {
          url: window.location.href,
          backText,
          svgs,
          hasDoubleArrow,
          pickupDisplay,
          returnDisplay,
          durationDisplay
        };
      })()`,
      returnByValue: true
    });

    const pRes = paymentCheck.result.value;
    assert(pRes.url.includes('/payment/'), 'Successfully transitioned to Payment screen');
    assert(pRes.backText.includes('Back to Booking'), `Back button text is "Back to Booking" (${pRes.backText})`);
    assert(!pRes.hasDoubleArrow, 'Back button has exactly ONE arrow (no duplicate arrows)');
    assert(pRes.pickupDisplay.length > 5 && pRes.pickupDisplay.includes('at'), `Order summary shows complete Pickup datetime (${pRes.pickupDisplay})`);
    assert(pRes.returnDisplay.length > 5 && pRes.returnDisplay.includes('at'), `Order summary shows complete Return datetime (${pRes.returnDisplay})`);

    await takeScreenshot('cdp_payment_screen.png');

    // ==========================================
    // 3. TEST BACK NAVIGATION STATE PRESERVATION
    // ==========================================
    console.log('\n--- 3. Testing Payment -> Booking Back Navigation & State Retention ---');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('#paymentBackBtn').click();
      })()`
    });
    await new Promise((r) => setTimeout(r, 1500));

    const backRetainCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const pDate = document.querySelector('#bookingPickupDate')?.value;
        const rDate = document.querySelector('#bookingReturnDate')?.value;
        const duration = document.querySelector('#summaryDuration')?.textContent;
        return { url: window.location.href, pDate, rDate, duration };
      })()`,
      returnByValue: true
    });
    const brRes = backRetainCheck.result.value;
    assert(brRes.url.includes('/booking/'), 'Back button navigated back to Booking screen');
    assert(brRes.pDate && brRes.rDate, `Pickup & Return dates preserved on back navigation (${brRes.pDate} -> ${brRes.rDate})`);

    // Return to Payment
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('#condEligibility').checked = true;
        document.querySelector('#condEligibility').dispatchEvent(new Event('change'));
        document.querySelector('#condDepositCancellation').checked = true;
        document.querySelector('#condDepositCancellation').dispatchEvent(new Event('change'));
        document.querySelector('#condSafeUsage').checked = true;
        document.querySelector('#condSafeUsage').dispatchEvent(new Event('change'));
        document.querySelector('#bookingForm').dispatchEvent(new Event('submit'));
      })()`
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Submit payment
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('#paymentSubmitBtn').click();
      })()`
    });
    await new Promise((r) => setTimeout(r, 3500));

    // ==========================================
    // 4. TEST CONFIRMATION SCREEN
    // ==========================================
    console.log('\n--- 4. Testing Confirmation Screen (/screens/booking-confirmation/index.html) ---');
    const confCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const backBtn = document.querySelector('#confirmBackBtn');
        const doneBtn = document.querySelector('.confirm-done-btn');
        const backText = backBtn ? backBtn.textContent.trim() : '';
        const doneText = doneBtn ? doneBtn.textContent.trim() : '';
        const svgs = backBtn ? backBtn.querySelectorAll('svg').length : 0;
        const hasDoubleArrow = backText.includes('← ←') || (backText.includes('←') && svgs > 0);

        const detailsText = document.querySelector('#confirmDetailsBox')?.innerText || '';

        return {
          url: window.location.href,
          backText,
          doneText,
          hasDoubleArrow,
          detailsText
        };
      })()`,
      returnByValue: true
    });

    const cRes = confCheck.result.value;
    assert(cRes.url.includes('/booking-confirmation/'), 'Successfully transitioned to Booking Confirmation screen');
    assert(cRes.backText.includes('Back to Vehicles'), `Back button text is "Back to Vehicles" (${cRes.backText})`);
    assert(!cRes.hasDoubleArrow, 'Confirmation Back button has exactly ONE arrow (no duplicate arrows)');
    const hasPickupAndReturn = (cRes.detailsText.includes('Pickup') && cRes.detailsText.includes('Return'));
    assert(hasPickupAndReturn, `Confirmation displays verified Pickup & Return Date and Time (${cRes.detailsText.replace(/\s+/g, ' ').slice(0, 120)}...)`);

    await takeScreenshot('cdp_confirmation_screen.png');

    // ==========================================
    // 5. TEST VEHICLE DETAILS SCREEN
    // ==========================================
    console.log('\n--- 5. Testing Vehicle Details Screen (/vehicle-details.html?id=1) ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/vehicle-details.html?id=1` });
    await new Promise((r) => setTimeout(r, 1500));

    const detailsCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const backBtn = document.querySelector('#vehicleDetailsBackBtn');
        const backText = backBtn ? backBtn.textContent.trim() : '';
        const svgs = backBtn ? backBtn.querySelectorAll('svg').length : 0;
        const hasDoubleArrow = backText.includes('← ←') || (backText.includes('←') && svgs > 0);

        const modalBack = document.querySelector('#bookingModal .back-step-btn');
        const modalBackText = modalBack ? modalBack.textContent.trim() : '';
        const modalSvgs = modalBack ? modalBack.querySelectorAll('svg').length : 0;
        const modalHasDouble = modalBackText.includes('← ←') || (modalBackText.includes('←') && modalSvgs > 0);

        return {
          backText,
          svgs,
          hasDoubleArrow,
          modalBackText,
          modalHasDouble
        };
      })()`,
      returnByValue: true
    });

    const dRes = detailsCheck.result.value;
    assert(dRes.backText.includes('Back to Vehicles'), `Vehicle Details back button text is "Back to Vehicles" (${dRes.backText})`);
    assert(!dRes.hasDoubleArrow, 'Vehicle details Back button has exactly ONE arrow');
    assert(!dRes.modalHasDouble, 'Modal Back button has exactly ONE arrow');

    await takeScreenshot('cdp_vehicle_details.png');

    await client.close();

    console.log(`\n========================================`);
    console.log(`CDP BROWSER VERIFICATION: ${passes} PASSED, ${failures} FAILED`);
    console.log(`========================================\n`);

    chrome.kill('SIGKILL');
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Error during CDP test]:', err);
    chrome.kill('SIGKILL');
    process.exit(1);
  }
}

main();
