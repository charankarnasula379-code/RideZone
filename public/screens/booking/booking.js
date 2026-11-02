/**
 * ============================================================
 * RideZone Modular Booking Screen Controller
 * public/screens/booking/booking.js
 * ============================================================
 */

(function initRideZoneBooking() {
  'use strict';

  // Elements
  const bookingVehicleDisplay = document.getElementById('bookingVehicleDisplay');
  const durationPresets = document.getElementById('durationPresets');
  const bookingHoursInput = document.getElementById('bookingHoursInput');
  const hoursInputGroup = document.getElementById('hoursInputGroup');
  const bookingPickupDate = document.getElementById('bookingPickupDate');
  const bookingPickupTime = document.getElementById('bookingPickupTime');
  const bookingReturnDate = document.getElementById('bookingReturnDate');
  const bookingReturnTime = document.getElementById('bookingReturnTime');
  const bookingBackBtn = document.getElementById('bookingBackBtn');
  const bookingProceedBtn = document.getElementById('bookingProceedBtn');
  const bookingMessage = document.getElementById('bookingMessage');
  const summaryRate = document.getElementById('summaryRate');
  const summaryDuration = document.getElementById('summaryDuration');
  const summaryRentalAmount = document.getElementById('summaryRentalAmount');
  const summaryDepositAmount = document.getElementById('summaryDepositAmount');
  const summaryTotal = document.getElementById('summaryTotal');
  const policyDepositDisplay = document.getElementById('policyDepositDisplay');
  const conditionCheckboxes = Array.from(document.querySelectorAll('.rental-condition-checkbox'));

  // Client-Side Booking State
  let state = {
    vehicleId: null,
    vehicleName: '',
    vehiclePrice: 280,
    deposit: 1000,
    rentalPlan: 'hourly', // 'hourly', 'halfday', 'fullday'
    duration: 2,
    pickupDate: '',
    pickupTime: '10:00',
    returnDate: '',
    returnTime: '12:00',
    rentalAmount: 560,
    totalAmount: 1560,
    conditionsAccepted: false
  };

  // Helper: Format Date to YYYY-MM-DD
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper: Compute Return Date & Time from Pickup + Duration
  function computeReturn(pickupDateStr, pickupTimeStr, hours) {
    if (!pickupDateStr || !pickupTimeStr) return { returnDate: '', returnTime: '' };
    const [y, m, d] = pickupDateStr.split('-').map(Number);
    const [h, min] = pickupTimeStr.split(':').map(Number);
    const pickupDt = new Date(y, m - 1, d, h, min, 0, 0);
    const returnDt = new Date(pickupDt.getTime() + hours * 3600 * 1000);

    const retYear = returnDt.getFullYear();
    const retMonth = String(returnDt.getMonth() + 1).padStart(2, '0');
    const retDay = String(returnDt.getDate()).padStart(2, '0');
    const returnDate = `${retYear}-${retMonth}-${retDay}`;

    const retHour = String(returnDt.getHours()).padStart(2, '0');
    const retMin = String(returnDt.getMinutes()).padStart(2, '0');
    const returnTime = `${retHour}:${retMin}`;

    return { returnDate, returnTime, pickupDt, returnDt };
  }

  // Helper: Validate combined datetime when user edits Return Date / Time manually
  function validateDatetime() {
    const pDate = bookingPickupDate.value;
    const pTime = bookingPickupTime.value;
    const rDate = bookingReturnDate.value;
    const rTime = bookingReturnTime.value;

    if (!pDate || !pTime || !rDate || !rTime) {
      showMessage('Please provide complete pickup and return date and time.', true);
      return false;
    }

    const [py, pm, pd] = pDate.split('-').map(Number);
    const [ph, pmin] = pTime.split(':').map(Number);
    const pickupDt = new Date(py, pm - 1, pd, ph, pmin, 0, 0);

    const [ry, rm, rd] = rDate.split('-').map(Number);
    const [rh, rmin] = rTime.split(':').map(Number);
    const returnDt = new Date(ry, rm - 1, rd, rh, rmin, 0, 0);

    if (isNaN(pickupDt.getTime()) || isNaN(returnDt.getTime())) {
      showMessage('Invalid date or time format.', true);
      return false;
    }

    const diffMs = returnDt.getTime() - pickupDt.getTime();
    if (diffMs <= 0) {
      showMessage('Return datetime must be strictly after pickup datetime.', true);
      return false;
    }

    const durationHours = Math.round(diffMs / (3600 * 1000));
    if (durationHours < 1 || durationHours > 24) {
      showMessage('Rental duration must be between 1 and 24 hours.', true);
      return false;
    }

    clearMessage();
    return { valid: true, durationHours, pDate, pTime, rDate, rTime };
  }

  function showMessage(msg, isError) {
    if (!bookingMessage) return;
    bookingMessage.textContent = msg;
    bookingMessage.className = isError ? 'form-message error' : 'form-message';
    updateProceedState();
  }

  function clearMessage() {
    if (!bookingMessage) return;
    bookingMessage.textContent = '';
    bookingMessage.className = 'form-message';
    updateProceedState();
  }

  // Update Summary Pricing Card
  function updateSummary() {
    const rentalAmount = state.vehiclePrice * state.duration;
    const totalAmount = rentalAmount + state.deposit;

    state.rentalAmount = rentalAmount;
    state.totalAmount = totalAmount;

    if (summaryRate) summaryRate.textContent = `₹${state.vehiclePrice}/hr`;
    if (summaryDuration) summaryDuration.textContent = `${state.duration} ${state.duration === 1 ? 'hour' : 'hours'}`;
    if (summaryRentalAmount) summaryRentalAmount.textContent = `₹${rentalAmount.toLocaleString('en-IN')}`;
    if (summaryDepositAmount) summaryDepositAmount.textContent = `₹${state.deposit.toLocaleString('en-IN')}`;
    if (summaryTotal) summaryTotal.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
    if (policyDepositDisplay) policyDepositDisplay.textContent = `₹${state.deposit.toLocaleString('en-IN')}`;

    updateProceedState();
  }

  // Checkbox & Proceed Button Validation
  function updateProceedState() {
    const allChecked = conditionCheckboxes.length > 0 && conditionCheckboxes.every(cb => cb.checked);
    state.conditionsAccepted = allChecked;

    conditionCheckboxes.forEach(cb => {
      const row = cb.closest('.mandatory-condition-row');
      if (row) row.classList.toggle('is-checked', cb.checked);
    });

    const isError = bookingMessage && bookingMessage.classList.contains('error');
    const canProceed = allChecked && !isError;

    if (bookingProceedBtn) {
      bookingProceedBtn.disabled = !canProceed;
      bookingProceedBtn.innerHTML = canProceed ? 'Proceed to Payment &rarr;' : 'Proceed to Payment';
    }
  }

  // Apply Duration Plan (Hourly, Half Day, 24 Hours)
  function applyPlan(planMode, hours) {
    state.rentalPlan = planMode;
    state.duration = hours;

    if (bookingHoursInput) bookingHoursInput.value = String(hours);

    // Update preset buttons
    if (durationPresets) {
      durationPresets.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === planMode);
      });
    }

    // Auto-calculate Return Date and Return Time
    const ret = computeReturn(bookingPickupDate.value, bookingPickupTime.value, hours);
    if (bookingReturnDate && ret.returnDate) bookingReturnDate.value = ret.returnDate;
    if (bookingReturnTime && ret.returnTime) bookingReturnTime.value = ret.returnTime;

    state.pickupDate = bookingPickupDate.value;
    state.pickupTime = bookingPickupTime.value;
    state.returnDate = ret.returnDate;
    state.returnTime = ret.returnTime;

    clearMessage();
    updateSummary();
  }

  // Initialize Page Data
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    const vParam = urlParams.get('v');

    // Default min date for pickup = today
    const now = new Date();
    const todayStr = formatDate(now);
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = formatDate(tomorrow);

    bookingPickupDate.min = todayStr;
    bookingReturnDate.min = todayStr;

    // Load Vehicles to match vehicle details
    let vehicle = null;
    try {
      if (idParam) {
        const res = await fetch(`/api/vehicles/${encodeURIComponent(idParam)}`);
        if (res.ok) {
          const data = await res.json();
          vehicle = data.vehicle;
        }
      }
      if (!vehicle) {
        const allRes = await fetch('/api/vehicles');
        if (allRes.ok) {
          const allData = await allRes.json();
          const list = allData.vehicles || [];
          if (idParam) vehicle = list.find(v => String(v.id) === String(idParam));
          if (!vehicle && vParam) vehicle = list.find(v => v.name.toLowerCase() === vParam.toLowerCase());
          if (!vehicle) vehicle = list[0];
        }
      }
    } catch (e) {
      console.warn('Could not fetch vehicle details:', e);
    }

    if (vehicle) {
      state.vehicleId = vehicle.id;
      state.vehicleName = vehicle.name;
      state.vehiclePrice = Number(vehicle.price) || 280;
      state.deposit = Number(vehicle.deposit_amount) || 1000;
      if (bookingVehicleDisplay) bookingVehicleDisplay.value = vehicle.name;
    }

    // Set Back Navigation Destination (Booking -> Back to Vehicle Details)
    if (bookingBackBtn && state.vehicleId) {
      bookingBackBtn.href = `/vehicle-details?id=${encodeURIComponent(state.vehicleId)}&v=${encodeURIComponent(state.vehicleName)}`;
    }

    // Check if restoring state from Payment screen (Back to Booking)
    const savedStateStr = sessionStorage.getItem('ridezone_booking_state');
    let restored = false;

    if (savedStateStr) {
      try {
        const saved = JSON.parse(savedStateStr);
        if (!idParam || String(saved.vehicleId) === String(state.vehicleId) || saved.vehicleName === state.vehicleName) {
          state = { ...state, ...saved };
          if (bookingPickupDate && state.pickupDate) bookingPickupDate.value = state.pickupDate;
          if (bookingPickupTime && state.pickupTime) bookingPickupTime.value = state.pickupTime;
          if (bookingReturnDate && state.returnDate) bookingReturnDate.value = state.returnDate;
          if (bookingReturnTime && state.returnTime) bookingReturnTime.value = state.returnTime;
          if (bookingHoursInput && state.duration) bookingHoursInput.value = String(state.duration);

          if (durationPresets) {
            durationPresets.querySelectorAll('.duration-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.mode === state.rentalPlan);
            });
          }

          conditionCheckboxes.forEach(cb => {
            cb.checked = !!state.conditionsAccepted;
          });

          restored = true;
        }
      } catch (e) {}
    }

    if (!restored) {
      // Fresh Initialization: 10:00 AM, 2 hours, tomorrow
      bookingPickupDate.value = tomorrowStr;
      bookingPickupTime.value = '10:00';
      applyPlan('hourly', 2);
    } else {
      updateSummary();
    }

    attachEventListeners();
  }

  function attachEventListeners() {
    // Rental Plan Presets
    if (durationPresets) {
      durationPresets.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode;
          if (mode === 'halfday') {
            applyPlan('halfday', 6);
          } else if (mode === 'fullday') {
            applyPlan('fullday', 24);
          } else {
            const h = Number(bookingHoursInput.value) || 2;
            applyPlan('hourly', h);
          }
        });
      });
    }

    // Hours manual input
    if (bookingHoursInput) {
      bookingHoursInput.addEventListener('input', () => {
        let h = parseInt(bookingHoursInput.value, 10);
        if (isNaN(h) || h < 1) h = 1;
        if (h > 24) h = 24;

        state.rentalPlan = 'hourly';
        state.duration = h;

        if (durationPresets) {
          durationPresets.querySelectorAll('.duration-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === 'hourly');
          });
        }

        const ret = computeReturn(bookingPickupDate.value, bookingPickupTime.value, h);
        bookingReturnDate.value = ret.returnDate;
        bookingReturnTime.value = ret.returnTime;
        state.returnDate = ret.returnDate;
        state.returnTime = ret.returnTime;

        clearMessage();
        updateSummary();
      });
    }

    // Pickup Date / Time change -> updates Return Date / Time automatically
    const onPickupChange = () => {
      const pDate = bookingPickupDate.value;
      const pTime = bookingPickupTime.value;
      state.pickupDate = pDate;
      state.pickupTime = pTime;

      const ret = computeReturn(pDate, pTime, state.duration);
      bookingReturnDate.value = ret.returnDate;
      bookingReturnTime.value = ret.returnTime;
      state.returnDate = ret.returnDate;
      state.returnTime = ret.returnTime;

      clearMessage();
      updateSummary();
    };

    bookingPickupDate.addEventListener('change', onPickupChange);
    bookingPickupTime.addEventListener('change', onPickupChange);

    // Return Date / Time manual change -> Validate combined datetime
    const onReturnChange = () => {
      const val = validateDatetime();
      if (!val || !val.valid) {
        return;
      }

      state.duration = val.durationHours;
      state.rentalPlan = 'hourly';
      if (bookingHoursInput) bookingHoursInput.value = String(val.durationHours);

      if (durationPresets) {
        durationPresets.querySelectorAll('.duration-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === 'hourly');
        });
      }

      state.pickupDate = val.pDate;
      state.pickupTime = val.pTime;
      state.returnDate = val.rDate;
      state.returnTime = val.rTime;

      updateSummary();
    };

    bookingReturnDate.addEventListener('change', onReturnChange);
    bookingReturnTime.addEventListener('change', onReturnChange);

    // Mandatory Conditions Checkboxes
    conditionCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        updateProceedState();
      });
    });

    // Proceed to Payment Form Submit
    const form = document.getElementById('bookingForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        // 1. Validate complete datetime
        const val = validateDatetime();
        if (!val || !val.valid) return;

        // 2. Validate mandatory rental conditions
        const allChecked = conditionCheckboxes.every(cb => cb.checked);
        if (!allChecked) {
          showMessage('Please accept the required rental conditions before continuing.', true);
          return;
        }

        // 3. Assemble and save state to sessionStorage
        state.pickupDate = bookingPickupDate.value;
        state.pickupTime = bookingPickupTime.value;
        state.returnDate = bookingReturnDate.value;
        state.returnTime = bookingReturnTime.value;
        state.conditionsAccepted = true;

        sessionStorage.setItem('ridezone_booking_state', JSON.stringify(state));

        // 4. Navigate to modular Payment screen
        window.location.href = `/screens/payment/index.html?id=${encodeURIComponent(state.vehicleId)}`;
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
