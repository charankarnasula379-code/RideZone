/**
 * ============================================================
 * RideZone Modular Customer Profile & Bookings Controller
 * public/screens/profile/profile.js
 * ============================================================
 */

(function initRideZoneProfile() {
  'use strict';

  const upcomingListEl = document.getElementById('upcomingList');
  const historyListEl = document.getElementById('historyList');
  const accountTabUpcoming = document.getElementById('accountTabUpcoming');
  const accountTabHistory = document.getElementById('accountTabHistory');
  const accountUpcomingView = document.getElementById('accountUpcomingView');
  const accountHistoryView = document.getElementById('accountHistoryView');

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

  function switchTab(tabName) {
    if (tabName === 'upcoming') {
      accountTabUpcoming.classList.add('active');
      accountTabHistory.classList.remove('active');
      accountUpcomingView.classList.add('active');
      accountHistoryView.classList.remove('active');
    } else {
      accountTabHistory.classList.add('active');
      accountTabUpcoming.classList.remove('active');
      accountHistoryView.classList.add('active');
      accountUpcomingView.classList.remove('active');
    }
  }

  async function loadBookings() {
    const token = localStorage.getItem('ridezone_token');
    if (!token) {
      renderEmpty();
      return;
    }

    try {
      const res = await fetch('/api/user/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        renderEmpty();
        return;
      }
      const data = await res.json();
      const bookings = data.bookings || [];
      renderBookings(bookings);
    } catch (e) {
      console.warn('Error loading bookings:', e);
      renderEmpty();
    }
  }

  function renderBookings(bookings) {
    const upcoming = bookings.filter(b => b.booking_status !== 'Cancelled' && b.booking_status !== 'Completed');
    const history = bookings.filter(b => b.booking_status === 'Cancelled' || b.booking_status === 'Completed');

    // Update Tab Counts
    if (accountTabUpcoming) {
      accountTabUpcoming.innerHTML = `Upcoming Rentals <span class="tab-badge">${upcoming.length}</span>`;
    }
    if (accountTabHistory) {
      accountTabHistory.innerHTML = `Booking History <span class="tab-badge">${history.length}</span>`;
    }

    if (upcomingListEl) {
      if (upcoming.length === 0) {
        upcomingListEl.innerHTML = `
          <div class="account-empty-state">
            <h3>No upcoming reservations</h3>
            <p>You do not currently have any active or upcoming motorcycle rentals.</p>
            <a href="/vehicles" class="primary-button">Browse Vehicles</a>
          </div>
        `;
      } else {
        upcomingListEl.innerHTML = upcoming.map(b => renderCard(b, false)).join('');
      }
    }

    if (historyListEl) {
      if (history.length === 0) {
        historyListEl.innerHTML = `
          <div class="account-empty-state">
            <h3>No past rentals</h3>
            <p>Your completed or cancelled bookings will appear here.</p>
          </div>
        `;
      } else {
        historyListEl.innerHTML = history.map(b => renderCard(b, true)).join('');
      }
    }
  }

  function renderCard(b, isHistory) {
    const shortRef = formatShortReference(b.id);
    const pDate = b.pickup_date ? (b.pickup_date.includes('T') ? b.pickup_date.split('T')[0] : b.pickup_date) : b.date;
    const pTime = b.pickup_time || b.time || '10:00';
    const formattedPickup = formatDateTimeDisplay(pDate, pTime);

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

    const stateClass = b.booking_status === 'Active' ? 'state-active' : '';

    return `
      <div class="upcoming-booking-card">
        <div class="upcoming-card-top">
          <div class="upcoming-top-info">
            <div class="upcoming-vehicle-title">${escapeHtml(b.vehicle_name || b.vehicle || 'Vehicle')}</div>
            <div class="upcoming-meta-badges">
              <span class="booking-state-badge ${stateClass}">${escapeHtml(b.booking_status || 'Confirmed')}</span>
              <span class="active-reg-no">${escapeHtml(b.vehicle_reg_no || 'TS 09 RZ 1001')}</span>
            </div>
          </div>
        </div>

        <div class="upcoming-details-grid">
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Booking Reference</span>
            <span class="upcoming-detail-val">${shortRef}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Rental Duration</span>
            <span class="upcoming-detail-val">${b.hours} Hours</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Pickup Schedule</span>
            <span class="upcoming-detail-val">${formattedPickup}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Expected Return</span>
            <span class="upcoming-detail-val">${formattedReturn}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Total Paid</span>
            <span class="upcoming-detail-val">₹${Number(b.total_price || 0).toLocaleString('en-IN')}</span>
          </div>
          <div class="upcoming-detail-cell">
            <span class="upcoming-detail-label">Refundable Deposit</span>
            <span class="upcoming-detail-val">₹${Number(b.deposit_amount || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="upcoming-card-footer">
          <span>Payment: ${escapeHtml(b.payment_method || 'UPI')} (${escapeHtml(b.payment_status || 'Paid')})</span>
          <a href="/vehicle-details?id=${b.vehicle_id || 1}" class="primary-button" style="padding: 6px 14px; font-size: 12.5px;">View Vehicle</a>
        </div>
      </div>
    `;
  }

  function renderEmpty() {
    if (upcomingListEl) {
      upcomingListEl.innerHTML = `
        <div class="account-empty-state">
          <h3>No bookings found</h3>
          <p>Sign in or complete a booking to view your reservation details.</p>
          <a href="/vehicles" class="primary-button">Browse Vehicles</a>
        </div>
      `;
    }
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

  function init() {
    if (accountTabUpcoming) {
      accountTabUpcoming.addEventListener('click', () => switchTab('upcoming'));
    }
    if (accountTabHistory) {
      accountTabHistory.addEventListener('click', () => switchTab('history'));
    }

    loadBookings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
