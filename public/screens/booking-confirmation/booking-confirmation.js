/**
 * ============================================================
 * RideZone Modular Booking Confirmation Controller
 * public/screens/booking-confirmation/booking-confirmation.js
 * ============================================================
 */

(function initRideZoneConfirmation() {
  'use strict';

  const confirmDetailsBox = document.getElementById('confirmDetailsBox');

  function formatShortReference(rawId) {
    if (!rawId) return 'RZ-00000000';
    if (rawId.startsWith('RZ-')) return rawId;
    const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `RZ-${cleanId.slice(0, 8)}`;
  }

  function formatDateTimeDisplay(dateStr, timeStr) {
    if (!dateStr) return 'N/A';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const [y, m, d] = cleanDate.split('-');
      const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      if (!timeStr) return formattedDate;
      const [hr, min] = timeStr.split(':');
      let h = Number(hr);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${formattedDate} at ${String(h).padStart(2, '0')}:${min} ${ampm}`;
    } catch (e) {
      return `${dateStr} ${timeStr || ''}`;
    }
  }

  function init() {
    const rawBooking = sessionStorage.getItem('ridezone_confirmed_booking');
    if (!rawBooking) {
      // Fallback: check booking state or redirect
      const stateStr = sessionStorage.getItem('ridezone_booking_state');
      if (stateStr) {
        try {
          renderFallbackState(JSON.parse(stateStr));
          return;
        } catch (e) {}
      }
      window.location.href = '/vehicles';
      return;
    }

    try {
      const b = JSON.parse(rawBooking);
      renderBooking(b);
    } catch (e) {
      window.location.href = '/vehicles';
    }
  }

  function renderBooking(b) {
    if (!confirmDetailsBox) return;

    const shortRef = formatShortReference(b.id);
    const pDate = b.pickup_date ? (b.pickup_date.includes('T') ? b.pickup_date.split('T')[0] : b.pickup_date) : b.date;
    const pTime = b.pickup_time || b.time || '10:00';
    const formattedPickup = formatDateTimeDisplay(pDate, pTime);

    // Compute Return from expected_return or pickup + hours
    let formattedReturn = 'N/A';
    if (b.expected_return) {
      const dt = new Date(b.expected_return);
      if (!isNaN(dt.getTime())) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const rDate = `${y}-${m}-${d}`;
        const rTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        formattedReturn = formatDateTimeDisplay(rDate, rTime);
      }
    }
    if (formattedReturn === 'N/A' && pDate && pTime) {
      const [py, pm, pd] = pDate.split('-').map(Number);
      const [ph, pmin] = pTime.split(':').map(Number);
      const start = new Date(py, pm - 1, pd, ph, pmin, 0, 0);
      const end = new Date(start.getTime() + (Number(b.hours) || 2) * 3600 * 1000);
      const y = end.getFullYear();
      const m = String(end.getMonth() + 1).padStart(2, '0');
      const d = String(end.getDate()).padStart(2, '0');
      const rDate = `${y}-${m}-${d}`;
      const rTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      formattedReturn = formatDateTimeDisplay(rDate, rTime);
    }

    confirmDetailsBox.innerHTML = `
      <div class="confirm-row">
        <span>Booking Reference</span>
        <span class="confirm-ref">${shortRef}</span>
      </div>
      <div class="confirm-row">
        <span>Vehicle</span>
        <span class="confirm-value"><strong>${escapeHtml(b.vehicle_name || b.vehicle || 'Vehicle')}</strong></span>
      </div>
      <div class="confirm-row">
        <span>Vehicle Registration</span>
        <span class="confirm-ref">${escapeHtml(b.vehicle_reg_no || 'TS 09 RZ 1001')}</span>
      </div>
      <div class="confirm-row">
        <span>Pickup Date & Time</span>
        <span class="confirm-value">${formattedPickup}</span>
      </div>
      <div class="confirm-row">
        <span>Return Date & Time</span>
        <span class="confirm-value">${formattedReturn}</span>
      </div>
      <div class="confirm-row">
        <span>Rental Duration</span>
        <span class="confirm-value">${b.hours} ${b.hours === 1 ? 'Hour' : 'Hours'}</span>
      </div>
      <div class="confirm-row">
        <span>Rental Amount</span>
        <span class="confirm-value">₹${Number(b.rental_price || 0).toLocaleString('en-IN')}</span>
      </div>
      <div class="confirm-row">
        <span>Refundable Deposit</span>
        <span class="confirm-value">₹${Number(b.deposit_amount || 0).toLocaleString('en-IN')}</span>
      </div>
      <div class="confirm-divider"></div>
      <div class="confirm-row confirm-row-total">
        <span>Total Amount Paid</span>
        <strong class="confirm-price">₹${Number(b.total_price || 0).toLocaleString('en-IN')}</strong>
      </div>
      <div class="confirm-row">
        <span>Payment Method</span>
        <span class="confirm-value">${escapeHtml(b.payment_method || 'UPI')} (Paid)</span>
      </div>
      <div class="confirm-row">
        <span>Customer</span>
        <span class="confirm-value">${escapeHtml(b.customer_name || b.user_name || 'Valued Customer')}</span>
      </div>
    `;
  }

  function renderFallbackState(state) {
    if (!confirmDetailsBox) return;
    const formattedPickup = formatDateTimeDisplay(state.pickupDate, state.pickupTime);
    const formattedReturn = formatDateTimeDisplay(state.returnDate, state.returnTime);

    confirmDetailsBox.innerHTML = `
      <div class="confirm-row">
        <span>Booking Reference</span>
        <span class="confirm-ref">RZ-DEMO2026</span>
      </div>
      <div class="confirm-row">
        <span>Vehicle</span>
        <span class="confirm-value"><strong>${escapeHtml(state.vehicleName)}</strong></span>
      </div>
      <div class="confirm-row">
        <span>Pickup Date & Time</span>
        <span class="confirm-value">${formattedPickup}</span>
      </div>
      <div class="confirm-row">
        <span>Return Date & Time</span>
        <span class="confirm-value">${formattedReturn}</span>
      </div>
      <div class="confirm-row">
        <span>Rental Duration</span>
        <span class="confirm-value">${state.duration} Hours</span>
      </div>
      <div class="confirm-row">
        <span>Rental Amount</span>
        <span class="confirm-value">₹${Number(state.rentalAmount).toLocaleString('en-IN')}</span>
      </div>
      <div class="confirm-row">
        <span>Refundable Deposit</span>
        <span class="confirm-value">₹${Number(state.deposit).toLocaleString('en-IN')}</span>
      </div>
      <div class="confirm-divider"></div>
      <div class="confirm-row confirm-row-total">
        <span>Total Amount Paid</span>
        <strong class="confirm-price">₹${Number(state.totalAmount).toLocaleString('en-IN')}</strong>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
