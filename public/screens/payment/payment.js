/**
 * ============================================================
 * RideZone Modular Payment Screen Controller
 * public/screens/payment/payment.js
 * ============================================================
 */

(function initRideZonePayment() {
  'use strict';

  // Elements
  const paymentBackBtn = document.getElementById('paymentBackBtn');
  const payVehicleName = document.getElementById('payVehicleName');
  const payPickupSchedule = document.getElementById('payPickupSchedule');
  const payReturnSchedule = document.getElementById('payReturnSchedule');
  const payDuration = document.getElementById('payDuration');
  const payRentalAmount = document.getElementById('payRentalAmount');
  const payDepositAmount = document.getElementById('payDepositAmount');
  const payTotalAmount = document.getElementById('payTotalAmount');
  const paymentTabs = document.getElementById('paymentTabs');
  const upiForm = document.getElementById('upiForm');
  const cardForm = document.getElementById('cardForm');
  const netbankingForm = document.getElementById('netbankingForm');
  const paymentSubmitBtn = document.getElementById('paymentSubmitBtn');
  const paymentMessage = document.getElementById('paymentMessage');

  let bookingState = null;
  let selectedMethod = 'UPI';

  // Helper: Format Date & Time as "DD/MM/YYYY at HH:MM AM/PM"
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

  // Helper: Switch Payment Tabs
  function switchMethod(method) {
    selectedMethod = method;
    if (paymentTabs) {
      paymentTabs.querySelectorAll('.pay-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.method === method);
      });
    }
    if (upiForm) upiForm.classList.toggle('hidden', method !== 'UPI');
    if (cardForm) cardForm.classList.toggle('hidden', method !== 'Credit / Debit Card');
    if (netbankingForm) netbankingForm.classList.toggle('hidden', method !== 'Net Banking');
  }

  async function ensureAuthToken() {
    let token = localStorage.getItem('ridezone_token');
    if (token) return token;

    try {
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Demo Rider',
          email: `rider_${Date.now()}@ridezone.com`,
          password: 'password123',
          phone: '+91 98765 43210'
        })
      });
      if (regRes.ok) {
        const data = await regRes.json();
        token = data.token;
        localStorage.setItem('ridezone_token', token);
        if (data.user) localStorage.setItem('ridezone_user', JSON.stringify(data.user));
        return token;
      }
    } catch (e) {
      console.warn('Authentication token provisioning failed:', e);
    }
    return null;
  }

  function init() {
    const rawState = sessionStorage.getItem('ridezone_booking_state');
    if (!rawState) {
      // Redirect back to fleet or booking if no state exists
      window.location.href = '/vehicles';
      return;
    }

    try {
      bookingState = JSON.parse(rawState);
    } catch (e) {
      window.location.href = '/vehicles';
      return;
    }

    // Set Back Navigation Destination (Payment -> Back to Booking)
    if (paymentBackBtn) {
      paymentBackBtn.href = `/screens/booking/index.html?id=${encodeURIComponent(bookingState.vehicleId || '')}`;
    }

    // Render Order Summary
    if (payVehicleName) payVehicleName.textContent = bookingState.vehicleName || 'Motorcycle';
    if (payPickupSchedule) {
      payPickupSchedule.textContent = formatDateTimeDisplay(bookingState.pickupDate, bookingState.pickupTime);
    }
    if (payReturnSchedule) {
      payReturnSchedule.textContent = formatDateTimeDisplay(bookingState.returnDate, bookingState.returnTime);
    }
    if (payDuration) {
      payDuration.textContent = `${bookingState.duration} ${bookingState.duration === 1 ? 'Hour' : 'Hours'}`;
    }
    if (payRentalAmount) {
      payRentalAmount.textContent = `₹${Number(bookingState.rentalAmount || 0).toLocaleString('en-IN')}`;
    }
    if (payDepositAmount) {
      payDepositAmount.textContent = `₹${Number(bookingState.deposit || 1000).toLocaleString('en-IN')}`;
    }
    if (payTotalAmount) {
      payTotalAmount.textContent = `₹${Number(bookingState.totalAmount || 0).toLocaleString('en-IN')}`;
    }
    if (paymentSubmitBtn) {
      paymentSubmitBtn.textContent = `Pay ₹${Number(bookingState.totalAmount || 0).toLocaleString('en-IN')} (Demo)`;
    }

    // Attach Payment Method Tab Listeners
    if (paymentTabs) {
      paymentTabs.querySelectorAll('.pay-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          switchMethod(tab.dataset.method);
        });
      });
    }

    // Payment Submission
    if (paymentSubmitBtn) {
      paymentSubmitBtn.addEventListener('click', async () => {
        paymentSubmitBtn.disabled = true;
        const originalText = paymentSubmitBtn.textContent;
        paymentSubmitBtn.textContent = 'Processing Demo Payment...';
        if (paymentMessage) paymentMessage.textContent = '';

        try {
          const token = await ensureAuthToken();
          if (!token) {
            throw new Error('Authentication required to complete booking.');
          }

          const payload = {
            vehicle: bookingState.vehicleName,
            vehicle_id: bookingState.vehicleId,
            date: bookingState.pickupDate,
            time: bookingState.pickupTime,
            return_date: bookingState.returnDate,
            return_time: bookingState.returnTime,
            hours: bookingState.duration,
            payment_method: selectedMethod,
            terms_accepted: true
          };

          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'Payment and reservation failed.');
          }

          // Store verified confirmed booking record
          sessionStorage.setItem('ridezone_confirmed_booking', JSON.stringify(result.booking));

          // Redirect to Confirmation screen
          window.location.href = '/screens/booking-confirmation/index.html';
        } catch (error) {
          if (paymentMessage) {
            paymentMessage.textContent = error.message;
            paymentMessage.className = 'form-message error';
          }
          paymentSubmitBtn.disabled = false;
          paymentSubmitBtn.textContent = originalText;
        }
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
