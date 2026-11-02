/**
 * ============================================================
 * RideZone — Executive Administrator Controller
 * Single Authoritative Admin-Side Frontend Implementation
 * Luxury Showroom & Operations Design System
 * ============================================================
 */

// Centralized HTML Sanitizer (XSS Immunity)
function escapeHtml(unsafeStr) {
  if (unsafeStr === null || unsafeStr === undefined) return "";
  return String(unsafeStr)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------
// 1. GLOBAL STATE & CONFIGURATION
// ------------------------------------------------------------
const ADMIN_STATE = {
  token: localStorage.getItem('ridezone_admin_token') || '',
  admin: null,
  currentSection: 'dashboard',

  // Data caches
  stats: null,
  vehicles: [],
  bookings: [],
  users: [],
  payments: null,

  // Vehicle image gallery in modals
  addVehImages: ['/assets/hunter.png'],
  addVehPrimary: '/assets/hunter.png',
  editVehImages: [],
  editVehPrimary: '',
  pendingProfilePhoto: null,

  // Mini Calendar state inside Vehicle Detail Modal
  modalCal: {
    vehicleName: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth(), // 0-indexed
    selectedDateStr: null,
    bookings: []
  },

  // Filter states
  fleetFilters: {
    search: '',
    category: 'all',
    status: 'all'
  },
  bookingFilters: {
    statusTab: 'all',
    search: '',
    vehicle: 'all',
    date: ''
  },
  userFilters: {
    search: '',
    status: 'all'
  },
  paymentFilters: {
    search: '',
    status: 'all'
  },

  // Chart period
  chartPeriod: '7d'
};

// ------------------------------------------------------------
// 2. HTTP & API UTILITIES
// ------------------------------------------------------------
async function adminFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (ADMIN_STATE.token) {
    headers['Authorization'] = `Bearer ${ADMIN_STATE.token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    if (ADMIN_STATE.token && !endpoint.includes('/login')) {
      showToast('Administrator session expired or unauthorized. Please log in.', true);
      adminLogout();
    }
  }

  return response;
}

function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `admin-toast ${isError ? 'toast-error' : ''}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatPrice(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

function formatDate(dateVal) {
  if (!dateVal) return '--';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateVal, timeVal) {
  if (!dateVal) return '--';
  const dateStr = formatDate(dateVal);
  if (!timeVal) return dateStr;
  const timeClean = String(timeVal).substring(0, 5);
  return `${dateStr} at ${timeClean}`;
}

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'available' || s === 'paid' || s === 'active rider') {
    return `<span class="badge badge-success">${status}</span>`;
  } else if (s === 'confirmed') {
    return `<span class="badge badge-gold">${status}</span>`;
  } else if (s === 'pending' || s === 'booked' || s === 'maintenance') {
    return `<span class="badge badge-warning">${status}</span>`;
  } else if (s === 'cancelled' || s === 'inactive' || s === 'failed' || s === 'suspended' || s === 'unavailable') {
    return `<span class="badge badge-danger">${status}</span>`;
  } else if (s === 'completed' || s === 'refunded') {
    return `<span class="badge badge-outline">${status}</span>`;
  }
  return `<span class="badge badge-outline">${status}</span>`;
}

// ------------------------------------------------------------
// 2B. UNIFIED CONFIRMATION MODAL SYSTEM
// ------------------------------------------------------------
let currentConfirmCallback = null;

function showAdminConfirm({ breadcrumb = 'Operations > Confirmation', title = 'Confirm Action', message = 'Are you sure you want to proceed?', detailsHtml = '', confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
  const modal = document.getElementById('adminConfirmModal');
  if (!modal) {
    if (confirm(message)) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }

  document.getElementById('confirmModalBreadcrumb').textContent = breadcrumb;
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalMessage').textContent = message;

  const detailsEl = document.getElementById('confirmModalDetails');
  if (detailsHtml) {
    detailsEl.innerHTML = detailsHtml;
    detailsEl.classList.remove('hidden');
  } else {
    detailsEl.innerHTML = '';
    detailsEl.classList.add('hidden');
  }

  const actionBtn = document.getElementById('confirmModalActionBtn');
  actionBtn.textContent = confirmText;
  actionBtn.className = `btn ${confirmClass}`;

  currentConfirmCallback = onConfirm;
  modal.classList.remove('hidden');
}

function closeConfirmModal() {
  const modal = document.getElementById('adminConfirmModal');
  if (modal) modal.classList.add('hidden');
  currentConfirmCallback = null;
}

// ------------------------------------------------------------
// 3. AUTHENTICATION CONTROLLER
// ------------------------------------------------------------
async function checkAuth() {
  if (!ADMIN_STATE.token) {
    showLoginScreen();
    return;
  }

  try {
    const res = await adminFetch('/api/admin/me');
    if (!res.ok) {
      showLoginScreen();
      return;
    }
    const data = await res.json();
    ADMIN_STATE.admin = data.admin;
    showAppScreen();
  } catch (err) {
    console.error('[Admin Auth Check Error]:', err);
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('adminLoginScreen').classList.remove('hidden');
  document.getElementById('adminAppScreen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('adminLoginScreen').classList.add('hidden');
  document.getElementById('adminAppScreen').classList.remove('hidden');

  updateAdminUIElements();
  startLiveClock();
  adminNav(ADMIN_STATE.currentSection || 'dashboard');
}

function updateAdminUIElements() {
  if (ADMIN_STATE.admin) {
    const a = ADMIN_STATE.admin;
    const email = a.email || 'admin@gmail.com';
    const name = a.name || 'System Administrator';
    const phone = a.phone || '+91 98765 43210';
    const location = a.location || 'Hyderabad, Telangana, India';
    const photo = a.profile_photo || '';

    const topbarEmailEl = document.getElementById('topbarAdminEmail');
    if (topbarEmailEl) topbarEmailEl.textContent = email;

    const sidebarNameEl = document.getElementById('sidebarAdminName');
    if (sidebarNameEl) sidebarNameEl.textContent = name;

    const parts = name.trim().split(' ');
    const initials = parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();

    const sidebarAvatarEl = document.getElementById('sidebarAvatar');
    if (sidebarAvatarEl) {
      if (photo) {
        sidebarAvatarEl.innerHTML = `<img src="${photo}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        sidebarAvatarEl.textContent = initials || 'AD';
      }
    }

    const topbarAvatarEl = document.getElementById('topbarAvatar');
    if (topbarAvatarEl) {
      if (photo) {
        topbarAvatarEl.innerHTML = `<img src="${photo}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        topbarAvatarEl.textContent = initials || 'AD';
      }
    }

    const accNameEl = document.getElementById('accAdminName');
    if (accNameEl) accNameEl.textContent = name;

    const accEmailEl = document.getElementById('accAdminEmail');
    if (accEmailEl) accEmailEl.textContent = email;

    const accAvatarInitial = document.getElementById('accAdminAvatarInitial');
    const accAvatarImg = document.getElementById('accAdminAvatarImg');
    if (accAvatarImg && accAvatarInitial) {
      if (photo) {
        accAvatarImg.src = photo;
        accAvatarImg.classList.remove('hidden');
        accAvatarInitial.classList.add('hidden');
      } else {
        accAvatarImg.classList.add('hidden');
        accAvatarInitial.classList.remove('hidden');
        accAvatarInitial.textContent = initials || 'SA';
      }
    }

    // Profile Photo Card Preview in section-profile
    const profPhotoInitial = document.getElementById('profPhotoInitial');
    const profPhotoImg = document.getElementById('profPhotoImg');
    const removePhotoBtn = document.getElementById('btnRemoveAdminPhoto');
    if (profPhotoImg && profPhotoInitial) {
      if (photo) {
        profPhotoImg.src = photo;
        profPhotoImg.classList.remove('hidden');
        profPhotoInitial.classList.add('hidden');
        if (removePhotoBtn) removePhotoBtn.classList.remove('hidden');
      } else {
        profPhotoImg.classList.add('hidden');
        profPhotoInitial.classList.remove('hidden');
        profPhotoInitial.textContent = initials || 'SA';
        if (removePhotoBtn) removePhotoBtn.classList.add('hidden');
      }
    }

    const piName = document.getElementById('piAdminName');
    if (piName) piName.textContent = name;

    const piEmail = document.getElementById('piAdminEmail');
    if (piEmail) piEmail.textContent = email;

    const piPhone = document.getElementById('piAdminPhone');
    if (piPhone) piPhone.textContent = phone;

    const piLocation = document.getElementById('piAdminLocation');
    if (piLocation) piLocation.textContent = location;
  }
}

async function adminLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } catch (e) { }
  ADMIN_STATE.token = '';
  ADMIN_STATE.admin = null;
  localStorage.removeItem('ridezone_admin_token');
  const errEl = document.getElementById('adminLoginError');
  if (errEl) errEl.classList.add('hidden');
  const pwdInput = document.getElementById('adminPasswordInput');
  if (pwdInput) pwdInput.value = '';
  showLoginScreen();
  showToast('Logged out of Administrator portal.');
}

function startLiveClock() {
  function tick() {
    const now = new Date();
    const clockEl = document.getElementById('liveClockDisplay');
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
  }
  tick();
  setInterval(tick, 1000);
}

// ------------------------------------------------------------
// 4. NAVIGATION CONTROLLER
// ------------------------------------------------------------
const NAV_TITLES = {
  dashboard: { title: 'Dashboard', subtitle: 'Platform Overview & Real-Time Operational Statistics' },
  vehicles: { title: 'Vehicles', subtitle: 'Fleet Management, Registration Numbers & Active Rates' },
  bookings: { title: 'Bookings', subtitle: 'Customer Reservations, Status Schedules & Returns' },
  users: { title: 'Customers', subtitle: 'Registered Customer Profiles, Lifetime Spend & Histories' },
  payments: { title: 'Payments', subtitle: 'Financial Ledger, Security Deposits & Transaction Records' },
  profile: { title: 'Admin Profile', subtitle: 'Administrator Account Settings, Security & System Telemetry' },
  'add-vehicle': { title: 'Add Vehicle', subtitle: 'Register a new motorcycle or scooter into the RideZone fleet' },
  'edit-vehicle': { title: 'Edit Vehicle', subtitle: 'Update vehicle details, images, and specifications' }
};

function adminNav(sectionName) {
  if (!NAV_TITLES[sectionName]) sectionName = 'dashboard';
  ADMIN_STATE.currentSection = sectionName;

  // Update Topbar
  document.getElementById('pageTitle').textContent = NAV_TITLES[sectionName].title;
  document.getElementById('pageSubtitle').textContent = NAV_TITLES[sectionName].subtitle;

  // Update Sidebar — keep 'vehicles' highlighted for sub-pages
  const sidebarHighlight = (sectionName === 'add-vehicle' || sectionName === 'edit-vehicle') ? 'vehicles' : sectionName;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === sidebarHighlight);
  });

  // Switch Sections
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const activeSec = document.getElementById(`section-${sectionName}`);
  if (activeSec) {
    activeSec.classList.add('active');
    activeSec.scrollTop = 0;
  }

  // Scroll content area to top
  const contentArea = document.getElementById('adminContent');
  if (contentArea) contentArea.scrollTop = 0;

  // Close mobile sidebar if open
  document.getElementById('adminSidebar').classList.remove('open');

  // Load Section Content
  switch (sectionName) {
    case 'dashboard': loadDashboard(); break;
    case 'vehicles': loadVehicles(); break;
    case 'bookings': loadBookings(); break;
    case 'users': loadUsers(); break;
    case 'payments': loadPayments(); break;
    case 'profile': loadProfile(); break;
    // add-vehicle and edit-vehicle are pre-populated by their own opener functions
  }
}

// ------------------------------------------------------------
// 5. DASHBOARD CONTROLLER
// ------------------------------------------------------------
async function loadDashboard(period) {
  if (period) ADMIN_STATE.chartPeriod = period;
  const currentPeriod = ADMIN_STATE.chartPeriod || '7d';

  // Update tab button UI
  document.querySelectorAll('.chart-tab-btn[data-period]').forEach(btn => {
    if (btn.dataset.period === currentPeriod) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  try {
    const res = await adminFetch(`/api/admin/stats?period=${currentPeriod}`);
    if (!res.ok) throw new Error('Failed to retrieve dashboard statistics');
    const data = await res.json();
    ADMIN_STATE.stats = data.stats;

    // Top 4 Primary Operational KPI Cards
    document.getElementById('dashTotalVehicles').textContent = data.stats.totalVehicles;
    document.getElementById('dashAvailVehicles').textContent = `${data.stats.availableVehicles} of ${data.stats.totalVehicles}`;
    document.getElementById('dashTotalBookings').textContent = data.stats.totalBookings;
    document.getElementById('dashPendingBookings').textContent = data.stats.pendingBookings;
    document.getElementById('dashRentalRevenue').textContent = formatPrice(data.stats.rentalRevenue);
    document.getElementById('dashDepositsHeld').textContent = formatPrice(data.stats.depositsHeld || data.stats.totalDepositsHeld);
    document.getElementById('dashTotalUsers').textContent = data.stats.totalUsers;
    document.getElementById('dashActiveRentals').textContent = data.stats.activeRentals;

    // Secondary Telemetry Strip
    document.getElementById('telemAvail').textContent = data.stats.availableVehicles;
    document.getElementById('telemBooked').textContent = data.stats.bookedVehicles;
    document.getElementById('telemMaint').textContent = data.stats.maintenanceVehicles;
    document.getElementById('telemCompleted').textContent = data.stats.completedBookings;
    document.getElementById('telemCancelled').textContent = data.stats.cancelledBookings;
    document.getElementById('telemRefunds').textContent = formatPrice(data.stats.depositsRefunded || data.stats.totalRefunds);

    // Render Bookings Activity Bar Chart
    renderBookingsChart(data.bookingsTrend || []);

    // Render Top Booked Vehicles Ranking
    renderTopVehicles(data.topVehicles || []);

    // Render Recent Bookings Table
    const rBody = document.getElementById('dashRecentBookingsBody');
    if (data.recentBookings && data.recentBookings.length > 0) {
      rBody.innerHTML = data.recentBookings.map(b => `
        <tr>
          <td><strong class="font-mono text-gold">${b.id}</strong></td>
          <td>
            <div style="font-weight:600;">${escapeHtml(b.customer_name || 'Customer')}</div>
            <small class="text-muted">${escapeHtml(b.customer_email || '')}</small>
          </td>
          <td>
            <div style="font-weight:600;">${escapeHtml(b.vehicle_name)}</div>
            <small class="text-muted">${escapeHtml(b.vehicle_reg_no || '')}</small>
          </td>
          <td>${formatDateTime(b.pickup_date, b.pickup_time)} (${b.hours}h)</td>
          <td>${formatPrice(b.rental_price)}</td>
          <td><strong>${formatPrice(b.total_price)}</strong></td>
          <td>${getStatusBadge(b.booking_status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openBookingDetailModal('${b.id}')">View Details</button>
          </td>
        </tr>
      `).join('');
    } else {
      rBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="admin-empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
              </div>
              <div class="empty-title">No Recent Reservations</div>
              <p class="empty-subtitle">New customer bookings will appear here automatically.</p>
            </div>
          </td>
        </tr>
      `;
    }

  } catch (err) {
    console.error('[Dashboard Load Error]:', err);
    showToast(err.message, true);
  }
}

function renderBookingsChart(trendData) {
  const chartContainer = document.getElementById('dashBookingsChart');
  if (!chartContainer) return;

  if (!trendData || trendData.length === 0) {
    const isMonth = ADMIN_STATE.chartPeriod === 'month' || ADMIN_STATE.chartPeriod === '30d';
    chartContainer.innerHTML = `
      <div class="admin-empty-state w-100 py-4">
        <div class="empty-title" style="font-size:16px;">${isMonth ? 'No booking activity for this month.' : 'No recent booking activity to chart.'}</div>
        <p class="empty-subtitle" style="font-size:12px;">New reservations will appear here automatically.</p>
      </div>
    `;
    return;
  }

  const maxVal = Math.max(...trendData.map(d => d.count), 1);

  chartContainer.innerHTML = trendData.map(d => {
    const isZero = d.count === 0;
    const heightPercent = isZero ? 0 : Math.max(Math.round((d.count / maxVal) * 100), 10);
    const bookingWord = d.count === 1 ? 'Booking' : 'Bookings';
    const tooltipText = `${d.date} (${d.day})\n${d.count} ${bookingWord}${d.revenue > 0 ? ' • ' + formatPrice(d.revenue) : ''}`;
    return `
      <div class="chart-col" title="${escapeHtml(tooltipText)}">
        <span class="chart-bar-val ${isZero ? 'val-zero' : ''}">${d.count}</span>
        <div class="chart-bar-wrap">
          <div class="chart-bar-fill" style="height: ${heightPercent}%;"></div>
        </div>
        <span class="chart-col-label">${(ADMIN_STATE.chartPeriod === 'month' || ADMIN_STATE.chartPeriod === '30d') ? d.date : d.day}</span>
      </div>
    `;
  }).join('');
}

function renderTopVehicles(topList) {
  const listContainer = document.getElementById('dashTopVehiclesList');
  if (!listContainer) return;

  if (!topList || topList.length === 0) {
    listContainer.innerHTML = `
      <div class="admin-empty-state py-4">
        <div class="empty-title" style="font-size:16px;">No Fleet Ranking Yet</div>
        <p class="empty-subtitle" style="font-size:12px;">Vehicle popularity metrics will render as bookings occur.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = topList.map((tv, idx) => `
    <div class="top-veh-item">
      <div class="top-veh-rank">#${idx + 1}</div>
      <img class="top-veh-avatar" src="${tv.image || '/assets/hunter.png'}" alt="${escapeHtml(tv.name)}" onerror="this.src='/assets/hunter.png'">
      <div class="top-veh-meta" style="flex:1;">
        <div class="top-veh-name" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-weight:600;">${escapeHtml(tv.name)}</span>
            <span class="badge ${tv.status === 'Active' ? 'badge-success' : 'badge-warning'}" style="font-size:10px; margin-left:6px;">${tv.status || 'Active'}</span>
          </div>
          <strong>${tv.count} Bookings</strong>
        </div>
        <div class="top-veh-bar-wrap" style="margin-top:4px;">
          <div class="top-veh-bar" style="width: ${Math.min((tv.count / (topList[0]?.count || 1)) * 100, 100)}%;"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// ------------------------------------------------------------
// 6. VEHICLES / FLEET CONTROLLER
// ------------------------------------------------------------
async function loadVehicles() {
  try {
    const res = await adminFetch('/api/admin/vehicles');
    if (!res.ok) throw new Error('Failed to retrieve vehicle fleet');
    const data = await res.json();
    ADMIN_STATE.vehicles = data.vehicles || [];

    filterAndRenderVehicles();
    updateVehicleFilterOptions();

  } catch (err) {
    console.error('[Vehicles Load Error]:', err);
    showToast(err.message, true);
  }
}

function filterAndRenderVehicles() {
  const { search, category, status } = ADMIN_STATE.fleetFilters;
  let list = ADMIN_STATE.vehicles;

  if (search && search.trim()) {
    const s = search.toLowerCase();
    list = list.filter(v =>
      v.name.toLowerCase().includes(s) ||
      (v.brand && v.brand.toLowerCase().includes(s)) ||
      (v.model && v.model.toLowerCase().includes(s)) ||
      (v.vehicle_reg_no && v.vehicle_reg_no.toLowerCase().includes(s))
    );
  }

  if (category && category !== 'all') {
    list = list.filter(v => v.category.toLowerCase() === category.toLowerCase());
  }

  if (status && status !== 'all') {
    list = list.filter(v => (v.live_status || '').toLowerCase() === status.toLowerCase());
  }

  const tbody = document.getElementById('adminVehiclesTableBody');
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="admin-empty-state">
            <div class="empty-icon-wrap">
              <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>
            </div>
            <div class="empty-title">No Matching Vehicles</div>
            <p class="empty-subtitle">Adjust your search keyword or filters to view fleet inventory.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(v => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${v.image}" alt="${escapeHtml(v.name)}" onerror="this.src='/assets/ather.png'" style="width:52px; height:38px; object-fit:contain; border-radius:4px; background:#FAF8F5; border:1px solid #E8E2D2; padding:2px;">
          <div>
            <strong style="font-size:14px;">${escapeHtml(v.name)}</strong>
            <div style="font-size:0.75rem; color:var(--muted);">${escapeHtml(v.brand || '')} ${v.model ? '• ' + escapeHtml(v.model) : ''}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-outline">${v.category}</span></td>
      <td><strong class="font-mono text-gold">${v.vehicle_reg_no}</strong></td>
      <td><strong>${formatPrice(v.price)}/hr</strong></td>
      <td>${formatPrice(v.deposit_amount)}</td>
      <td><strong>${v.bookings_count || 0}</strong></td>
      <td><span style="color:var(--gold-dark); font-weight:700;">★ ${Number(v.rating).toFixed(1)}</span></td>
      <td>${getStatusBadge(v.status)}</td>
      <td>${getStatusBadge(v.live_status)}</td>
      <td>
        <div style="display:flex; gap:0.35rem;">
          <button class="btn btn-secondary btn-sm" onclick="openVehicleDetailModal(${v.id})" title="View Details">View</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditVehicleModal(${v.id})" title="Edit Fleet Record">Edit</button>
          <button class="btn ${v.status === 'Active' ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="toggleVehicleStatus(${v.id}, '${v.status}')">
            ${v.status === 'Active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateVehicleFilterOptions() {
  const filterSelect = document.getElementById('bookingsVehicleFilter');
  if (filterSelect && ADMIN_STATE.vehicles.length > 0) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Vehicles</option>' +
      ADMIN_STATE.vehicles.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
    if (currentVal) filterSelect.value = currentVal;
  }
}

// ------------------------------------------------------------
// 6B. VEHICLE IMAGE MANAGER LOGIC
// ------------------------------------------------------------
function renderAddVehImageGrid() {
  const grid = document.getElementById('addVehImageGrid');
  const countEl = document.getElementById('addVehCount');
  if (!grid) return;
  const list = ADMIN_STATE.addVehImages || [];
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    grid.innerHTML = '<div class="text-muted" style="font-size:12px; grid-column: 1/-1; padding:10px 0; text-align:center;">No vehicle photos uploaded yet. Use the upload box above or pick a fleet preset.</div>';
    return;
  }

  grid.innerHTML = list.map((imgUrl, idx) => {
    const isPrimary = (imgUrl === ADMIN_STATE.addVehPrimary);
    return `
      <div class="image-manager-card ${isPrimary ? 'is-primary' : ''}">
        ${isPrimary ? '<span class="image-primary-badge">★ Main Showcase</span>' : ''}
        <img src="${imgUrl}" alt="Vehicle Photo" onerror="this.src='/assets/hunter.png'">
        <div class="image-card-actions">
          ${!isPrimary 
            ? `<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px; padding:3px 6px; flex:1;" onclick="setAddVehPrimary('${imgUrl}')">Set Main</button>` 
            : `<span style="font-size:10px; font-weight:700; color:var(--rz-gold-dark); flex:1; text-align:center;">Primary</span>`}
          <button type="button" class="btn btn-ghost btn-sm text-danger" title="Delete image" style="font-size:12px; padding:3px 6px;" onclick="removeAddVehImage(${idx})">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function setAddVehPrimary(url) {
  ADMIN_STATE.addVehPrimary = url;
  document.getElementById('addVehMainImage').value = url;
  renderAddVehImageGrid();
}

function removeAddVehImage(index) {
  ADMIN_STATE.addVehImages.splice(index, 1);
  if (!ADMIN_STATE.addVehImages.includes(ADMIN_STATE.addVehPrimary)) {
    ADMIN_STATE.addVehPrimary = ADMIN_STATE.addVehImages[0] || '';
  }
  document.getElementById('addVehMainImage').value = ADMIN_STATE.addVehPrimary;
  renderAddVehImageGrid();
}

function applyAddVehPreset(val) {
  if (!val) return;
  if (!ADMIN_STATE.addVehImages.includes(val)) {
    ADMIN_STATE.addVehImages.push(val);
  }
  setAddVehPrimary(val);
}

function renderEditVehImageGrid() {
  const grid = document.getElementById('editVehImageGrid');
  const countEl = document.getElementById('editVehCount');
  if (!grid) return;
  const list = ADMIN_STATE.editVehImages || [];
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    grid.innerHTML = '<div class="text-muted" style="font-size:12px; grid-column: 1/-1; padding:10px 0; text-align:center;">No vehicle photos uploaded. Click the upload box above to add photos.</div>';
    return;
  }

  grid.innerHTML = list.map((imgUrl, idx) => {
    const isPrimary = (imgUrl === ADMIN_STATE.editVehPrimary);
    return `
      <div class="image-manager-card ${isPrimary ? 'is-primary' : ''}">
        ${isPrimary ? '<span class="image-primary-badge">★ Main Showcase</span>' : ''}
        <img src="${imgUrl}" alt="Vehicle Photo" onerror="this.src='/assets/hunter.png'">
        <div class="image-card-actions">
          ${!isPrimary 
            ? `<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px; padding:3px 6px; flex:1;" onclick="setEditVehPrimary('${imgUrl}')">Set Main</button>` 
            : `<span style="font-size:10px; font-weight:700; color:var(--rz-gold-dark); flex:1; text-align:center;">Primary</span>`}
          <button type="button" class="btn btn-ghost btn-sm text-danger" title="Delete image" style="font-size:12px; padding:3px 6px;" onclick="removeEditVehImage(${idx})">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function setEditVehPrimary(url) {
  ADMIN_STATE.editVehPrimary = url;
  document.getElementById('editVehMainImage').value = url;
  renderEditVehImageGrid();
}

function removeEditVehImage(index) {
  ADMIN_STATE.editVehImages.splice(index, 1);
  if (!ADMIN_STATE.editVehImages.includes(ADMIN_STATE.editVehPrimary)) {
    ADMIN_STATE.editVehPrimary = ADMIN_STATE.editVehImages[0] || '';
  }
  document.getElementById('editVehMainImage').value = ADMIN_STATE.editVehPrimary;
  renderEditVehImageGrid();
}

function applyEditVehPreset(val) {
  if (!val) return;
  if (!ADMIN_STATE.editVehImages.includes(val)) {
    ADMIN_STATE.editVehImages.push(val);
  }
  setEditVehPrimary(val);
}

function openAddVehicleModal() {
  // Reset state
  ADMIN_STATE.addVehImages = ['/assets/hunter.png'];
  ADMIN_STATE.addVehPrimary = '/assets/hunter.png';

  // Reset form
  const form = document.getElementById('addVehicleForm');
  if (form) form.reset();

  // Restore hidden field after reset
  const mainImgInput = document.getElementById('addVehMainImage');
  if (mainImgInput) mainImgInput.value = '/assets/hunter.png';

  const errEl = document.getElementById('addVehError');
  if (errEl) errEl.classList.add('hidden');

  // Navigate to full page
  adminNav('add-vehicle');
  // Render grid after nav (DOM is already visible)
  renderAddVehImageGrid();
}

async function openEditVehicleModal(id) {
  try {
    const res = await adminFetch(`/api/admin/vehicles/${id}`);
    if (!res.ok) throw new Error('Failed to retrieve vehicle details');
    const data = await res.json();
    const v = data.vehicle;

    document.getElementById('editVehId').value = v.id;
    // Update both the full-page title and the old modal title (defensive)
    const pageTitle = document.getElementById('editPageVehTitle');
    if (pageTitle) pageTitle.textContent = `Edit — ${v.name}`;
    const modalTitle = document.getElementById('editModalVehTitle');
    if (modalTitle) modalTitle.textContent = `Edit Record — ${v.name}`;

    document.getElementById('editVehName').value = v.name;
    document.getElementById('editVehBrand').value = v.brand || '';
    document.getElementById('editVehModel').value = v.model || '';
    document.getElementById('editVehCategory').value = v.category;
    document.getElementById('editVehRegNo').value = v.vehicle_reg_no;
    document.getElementById('editVehYear').value = v.year || 2024;
    document.getElementById('editVehFuel').value = v.fuel_type || 'Petrol';
    document.getElementById('editVehTransmission').value = v.transmission || 'Manual';
    document.getElementById('editVehStatus').value = v.status || 'Active';
    document.getElementById('editVehPrice').value = v.price;
    document.getElementById('editVehDeposit').value = v.deposit_amount;
    document.getElementById('editVehRating').value = v.rating;
    document.getElementById('editVehDesc').value = v.description || '';

    // Specs
    const s = v.specs || {};
    document.getElementById('editSpecMotor').value = s.motor_engine || '';
    document.getElementById('editSpecPower').value = s.power || '';
    document.getElementById('editSpecTorque').value = s.torque || '';
    document.getElementById('editSpecTopSpeed').value = s.top_speed || '';
    document.getElementById('editSpecRange').value = s.range_efficiency || '';
    document.getElementById('editSpecBrakes').value = s.brakes || '';

    // Gallery images
    const rawGallery = Array.isArray(v.gallery) && v.gallery.length > 0 ? v.gallery : (Array.isArray(v.additional_images) ? v.additional_images : []);
    const fullImages = [v.image, ...rawGallery].filter((img, idx, arr) => img && arr.indexOf(img) === idx);

    ADMIN_STATE.editVehImages = fullImages.length > 0 ? fullImages : [v.image || '/assets/hunter.png'];
    ADMIN_STATE.editVehPrimary = v.image || ADMIN_STATE.editVehImages[0];
    document.getElementById('editVehMainImage').value = ADMIN_STATE.editVehPrimary;

    // Navigate to full-page edit section
    adminNav('edit-vehicle');
    renderEditVehImageGrid();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function saveEditVehicle(e) {
  e.preventDefault();
  const id = document.getElementById('editVehId').value;
  const errEl = document.getElementById('editVehError');
  const submitBtn = document.getElementById('submitEditVehicleBtn');
  errEl.classList.add('hidden');
  submitBtn.disabled = true;

  const name = document.getElementById('editVehName').value.trim();
  const brand = document.getElementById('editVehBrand').value.trim();
  const model = document.getElementById('editVehModel').value.trim();
  const category = document.getElementById('editVehCategory').value;
  const vehicle_reg_no = document.getElementById('editVehRegNo').value.trim();
  const year = Number(document.getElementById('editVehYear').value) || 2024;
  const fuel_type = document.getElementById('editVehFuel').value;
  const transmission = document.getElementById('editVehTransmission').value;
  const status = document.getElementById('editVehStatus').value;
  const price = Number(document.getElementById('editVehPrice').value);
  const deposit_amount = Number(document.getElementById('editVehDeposit').value);
  const rating = Number(document.getElementById('editVehRating').value);
  const description = document.getElementById('editVehDesc').value.trim();

  const image = ADMIN_STATE.editVehPrimary || ADMIN_STATE.editVehImages[0] || '/assets/hunter.png';
  const additional_images = ADMIN_STATE.editVehImages.filter(img => img !== image);

  const specs = {
    motor_engine: document.getElementById('editSpecMotor').value.trim(),
    power: document.getElementById('editSpecPower').value.trim(),
    torque: document.getElementById('editSpecTorque').value.trim(),
    top_speed: document.getElementById('editSpecTopSpeed').value.trim(),
    range_efficiency: document.getElementById('editSpecRange').value.trim(),
    brakes: document.getElementById('editSpecBrakes').value.trim(),
    transmission,
    fuel_type
  };

  try {
    const res = await adminFetch(`/api/admin/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name, brand, model, category, vehicle_reg_no, year, fuel_type, transmission,
        status, price, deposit_amount, rating, image, gallery: ADMIN_STATE.editVehImages,
        additional_images, description, specs
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update vehicle');

    showToast(data.message || 'Vehicle record updated successfully!');
    adminNav('vehicles');
    loadDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}

async function toggleVehicleStatus(id, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  showAdminConfirm({
    breadcrumb: 'Vehicles > Fleet Status',
    title: `${newStatus === 'Active' ? 'Activate' : 'Deactivate'} Vehicle`,
    message: `Are you sure you want to change this vehicle's fleet status to '${newStatus}'?`,
    confirmText: newStatus === 'Active' ? 'Activate Vehicle' : 'Deactivate Vehicle',
    confirmClass: newStatus === 'Active' ? 'btn-primary' : 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await adminFetch(`/api/admin/vehicles/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update vehicle status');

        showToast(data.message || `Vehicle status updated to ${newStatus}.`);
        loadVehicles();
        loadDashboard();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

// ------------------------------------------------------------
// 6C. VEHICLE VIEW & CALENDAR MODAL
// ------------------------------------------------------------
async function openVehicleDetailModal(id) {
  try {
    const res = await adminFetch(`/api/admin/vehicles/${id}`);
    if (!res.ok) throw new Error('Failed to retrieve vehicle details');
    const data = await res.json();
    const v = data.vehicle;

    document.getElementById('modalVehName').textContent = v.name;
    document.getElementById('modalVehSubtitle').textContent = `${v.category} • Reg: ${v.vehicle_reg_no} • Rating: ★ ${Number(v.rating).toFixed(1)}`;
    document.getElementById('modalVehMainImg').src = v.image || '/assets/hunter.png';
    document.getElementById('modalVehHourly').textContent = `${formatPrice(v.price)}/hr`;
    document.getElementById('modalVehDeposit').textContent = formatPrice(v.deposit_amount);
    document.getElementById('modalVehRating').textContent = Number(v.rating).toFixed(1);
    document.getElementById('modalVehDescription').textContent = v.description || 'Verified luxury rental model with high-performance chassis, disc braking, and touring ergonomics.';

    const editBtn = document.getElementById('modalEditVehBtn');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModals();
        openEditVehicleModal(v.id);
      };
    }

    // Gallery Thumbnails
    const thumbsRow = document.getElementById('modalVehThumbs');
    const allImages = [v.image, ...(v.gallery || v.additional_images || [])].filter((img, idx, arr) => img && arr.indexOf(img) === idx);
    thumbsRow.innerHTML = allImages.map((img, idx) => `
      <img src="${img}" class="veh-thumb-item ${idx === 0 ? 'active' : ''}" onclick="selectModalMainImage('${img}', this)" alt="View">
    `).join('');

    // Specifications Grid
    const specsGrid = document.getElementById('modalVehSpecsGrid');
    const s = v.specs || {};
    specsGrid.innerHTML = `
      <div class="spec-item-compact"><div class="spec-k">Engine</div><div class="spec-v">${s.motor_engine || 'Standard Engine'}</div></div>
      <div class="spec-item-compact"><div class="spec-k">Power</div><div class="spec-v">${s.power || 'High Output'}</div></div>
      <div class="spec-item-compact"><div class="spec-k">Torque</div><div class="spec-v">${s.torque || 'High Torque'}</div></div>
      <div class="spec-item-compact"><div class="spec-k">Top Speed</div><div class="spec-v">${s.top_speed || '100+ km/h'}</div></div>
      <div class="spec-item-compact"><div class="spec-k">Fuel / Range</div><div class="spec-v">${s.range_efficiency || 'Petrol Tank'}</div></div>
      <div class="spec-item-compact"><div class="spec-k">Brakes</div><div class="spec-v">${s.brakes || 'Dual Disc ABS'}</div></div>
    `;

    // Mini Availability Calendar
    ADMIN_STATE.modalCal.vehicleName = v.name;
    ADMIN_STATE.modalCal.year = new Date().getFullYear();
    ADMIN_STATE.modalCal.month = new Date().getMonth();
    ADMIN_STATE.modalCal.selectedDateStr = null;

    // Fetch availability for vehicle
    const calRes = await adminFetch(`/api/admin/availability?vehicle=${encodeURIComponent(v.name)}`);
    if (calRes.ok) {
      const calData = await calRes.json();
      ADMIN_STATE.modalCal.bookings = calData.bookings || [];
    } else {
      ADMIN_STATE.modalCal.bookings = [];
    }

    renderModalMiniCalendar();
    document.getElementById('vehicleDetailModal').classList.remove('hidden');

  } catch (err) {
    showToast(err.message, true);
  }
}

function selectModalMainImage(url, imgEl) {
  document.getElementById('modalVehMainImg').src = url;
  document.querySelectorAll('.veh-thumb-item').forEach(el => el.classList.remove('active'));
  if (imgEl) imgEl.classList.add('active');
}

function renderModalMiniCalendar() {
  const { year, month, vehicleName, bookings } = ADMIN_STATE.modalCal;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const labelEl = document.getElementById('modalCalMonthLabel');
  if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

  const gridEl = document.getElementById('modalCalGrid');
  if (!gridEl) return;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="mini-cal-day" style="background:transparent; border-color:transparent; cursor:default;"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;

    const dayBookings = bookings.filter(b => b.pickup_date === dateStr);
    const isBooked = dayBookings.length > 0;

    html += `
      <div class="mini-cal-day ${isBooked ? 'is-booked' : 'is-avail'}" onclick="selectModalCalDate('${dateStr}', ${isBooked})" title="${dateStr}: ${isBooked ? `${dayBookings.length} booking(s)` : 'Available for rent'}">
        ${day}
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

function selectModalCalDate(dateStr, isBooked) {
  ADMIN_STATE.modalCal.selectedDateStr = dateStr;
  const infoEl = document.getElementById('modalCalSelectedText');
  if (infoEl) {
    if (isBooked) {
      const dayBookings = ADMIN_STATE.modalCal.bookings.filter(b => b.pickup_date === dateStr);
      infoEl.innerHTML = `<span class="text-danger">● Reserved on ${formatDate(dateStr)}:</span> ${dayBookings.map(b => `#${b.id} (${b.hours}h at ${b.pickup_time || '10:00'})`).join(', ')}`;
    } else {
      infoEl.innerHTML = `<span class="text-success">● Fully Available:</span> No reservations on ${formatDate(dateStr)}. Ready for customer dispatch.`;
    }
  }
}

// ------------------------------------------------------------
// 7. BOOKINGS CONTROLLER
// ------------------------------------------------------------
async function loadBookings() {
  try {
    const { statusTab, search, vehicle } = ADMIN_STATE.bookingFilters;
    const params = new URLSearchParams();
    if (statusTab && statusTab !== 'all') params.append('status', statusTab);
    if (search) params.append('search', search);
    if (vehicle && vehicle !== 'all') params.append('vehicle', vehicle);

    const res = await adminFetch(`/api/admin/bookings?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to retrieve bookings list');
    const data = await res.json();
    ADMIN_STATE.bookings = data.bookings || [];

    // Authoritative Tab counts
    const counts = data.counts || {
      all: ADMIN_STATE.bookings.length,
      pending: ADMIN_STATE.bookings.filter(b => b.booking_status === 'Pending').length,
      confirmed: ADMIN_STATE.bookings.filter(b => b.booking_status === 'Confirmed').length,
      active: ADMIN_STATE.bookings.filter(b => b.booking_status === 'Active').length,
      completed: ADMIN_STATE.bookings.filter(b => b.booking_status === 'Completed' || b.actual_return).length,
      cancelled: ADMIN_STATE.bookings.filter(b => b.booking_status === 'Cancelled').length
    };

    const tabAll = document.getElementById('tabCountAll');
    if (tabAll) tabAll.textContent = counts.all ?? 0;
    const tabPend = document.getElementById('tabCountPending');
    if (tabPend) tabPend.textContent = counts.pending ?? 0;
    const tabConf = document.getElementById('tabCountConfirmed');
    if (tabConf) tabConf.textContent = counts.confirmed ?? 0;
    const tabAct = document.getElementById('tabCountActive');
    if (tabAct) tabAct.textContent = counts.active ?? 0;
    const tabComp = document.getElementById('tabCountCompleted');
    if (tabComp) tabComp.textContent = counts.completed ?? 0;
    const tabCanc = document.getElementById('tabCountCancelled');
    if (tabCanc) tabCanc.textContent = counts.cancelled ?? 0;

    renderBookingsTable();

  } catch (err) {
    console.error('[Bookings Load Error]:', err);
    showToast(err.message, true);
  }
}

function renderBookingsTable() {
  const tbody = document.getElementById('adminBookingsTableBody');
  const list = ADMIN_STATE.bookings;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="admin-empty-state">
            <div class="empty-icon-wrap">
              <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
            </div>
            <div class="empty-title">No Reservations Found</div>
            <p class="empty-subtitle">There are no bookings matching the selected status tab or search parameters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(b => `
    <tr>
      <td><strong class="font-mono text-gold">${b.id}</strong></td>
      <td>
        <div style="font-weight:600;">${escapeHtml(b.customer_name || 'Customer')}</div>
        <small class="text-muted">${escapeHtml(b.customer_email || '')}</small>
      </td>
      <td>
        <div style="font-weight:600;">${escapeHtml(b.vehicle_name)}</div>
        <small class="text-muted">${escapeHtml(b.vehicle_reg_no || '')}</small>
      </td>
      <td>${formatDateTime(b.pickup_date, b.pickup_time)}</td>
      <td>${b.hours} hrs</td>
      <td>${formatPrice(b.rental_price)}</td>
      <td>${formatPrice(b.deposit_amount)}</td>
      <td><strong>${formatPrice(b.total_price)}</strong></td>
      <td><span class="badge badge-outline">${b.payment_method || 'UPI'}</span></td>
      <td>${getStatusBadge(b.booking_status)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openBookingDetailModal('${b.id}')">Inspect</button>
      </td>
    </tr>
  `).join('');
}

// ------------------------------------------------------------
// 7B. BOOKING DETAIL MODAL & LIFECYCLE ACTIONS
// ------------------------------------------------------------
async function openBookingDetailModal(bookingId) {
  try {
    const res = await adminFetch(`/api/admin/bookings/${bookingId}`);
    if (!res.ok) throw new Error('Failed to retrieve booking record');
    const data = await res.json();
    const b = data.booking;

    document.getElementById('bModalId').textContent = `Reservation #${b.id}`;
    document.getElementById('bModalCreated').textContent = `Submitted on ${formatDateTime(b.created_at)} • Status: ${b.booking_status}`;

    const content = document.getElementById('bModalContent');
    content.innerHTML = `
      <div class="form-grid-2">
        <!-- Vehicle Card -->
        <div class="admin-card" style="padding:16px;">
          <h4 class="form-section-title">Showroom Vehicle</h4>
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
            <img src="${b.vehicle_image || '/assets/hunter.png'}" alt="Vehicle" style="width:64px; height:44px; object-fit:contain; background:var(--surface-soft); border:1px solid var(--line); border-radius:4px; padding:2px;">
            <div>
              <strong style="font-size:15px;">${escapeHtml(b.vehicle_name)}</strong>
              <div class="text-gold font-mono" style="font-size:12px; font-weight:700;">${b.vehicle_reg_no || 'TS 09 RZ 1001'}</div>
            </div>
          </div>
          <div class="diag-row"><span class="diag-label">Hourly Rate:</span><strong>${formatPrice(b.rental_price / (b.hours || 1))}/hr</strong></div>
          <div class="diag-row"><span class="diag-label">Duration:</span><strong>${b.hours} Hours</strong></div>
        </div>

        <!-- Customer Card -->
        <div class="admin-card" style="padding:16px;">
          <h4 class="form-section-title">Customer Details</h4>
          <div class="diag-row"><span class="diag-label">Full Name:</span><strong>${escapeHtml(b.customer_name || 'Customer')}</strong></div>
          <div class="diag-row"><span class="diag-label">Email:</span><strong>${escapeHtml(b.customer_email || '--')}</strong></div>
          <div class="diag-row"><span class="diag-label">Phone:</span><strong>${escapeHtml(b.customer_phone || 'None')}</strong></div>
          <div class="diag-row"><span class="diag-label">Customer Since:</span><span>${formatDate(b.customer_since)}</span></div>
        </div>
      </div>

      <!-- Schedule & Financial Breakdown -->
      <div class="form-section-card mt-3">
        <h4 class="form-section-title">Schedule & Financial Breakdown</h4>
        <div class="form-grid-3">
          <div>
            <span class="text-muted" style="font-size:11px;">PICKUP SCHEDULE</span>
            <div style="font-weight:700;">${formatDateTime(b.pickup_date, b.pickup_time)}</div>
          </div>
          <div>
            <span class="text-muted" style="font-size:11px;">EXPECTED RETURN</span>
            <div style="font-weight:700;">${b.expected_return ? formatDateTime(b.expected_return) : 'Calculated on pickup'}</div>
          </div>
          <div>
            <span class="text-muted" style="font-size:11px;">ACTUAL RETURN</span>
            <div style="font-weight:700;">${b.actual_return ? formatDateTime(b.actual_return) : 'Pending Handover'}</div>
          </div>
        </div>

        <div class="nav-divider"></div>

        <div class="form-grid-3">
          <div>
            <span class="text-muted" style="font-size:11px;">BASE RENTAL FEE</span>
            <div style="font-weight:700; color:var(--charcoal);">${formatPrice(b.rental_price)}</div>
          </div>
          <div>
            <span class="text-muted" style="font-size:11px;">SECURITY DEPOSIT (ESCROW)</span>
            <div style="font-weight:700; color:var(--charcoal);">${formatPrice(b.deposit_amount)}</div>
          </div>
          <div>
            <span class="text-muted" style="font-size:11px;">TOTAL PAID</span>
            <div style="font-weight:800; color:var(--gold-dark); font-size:16px;">${formatPrice(b.total_price)}</div>
          </div>
        </div>

        ${b.late_charge > 0 ? `
          <div class="mt-2" style="background:var(--color-status-red-bg); padding:8px 12px; border-radius:4px; border:1px solid var(--color-status-red-border); font-size:13px; color:var(--color-status-red);">
            <strong>Late Return Surcharge:</strong> ${formatPrice(b.late_charge)} applied for ${b.late_hours} hour(s) overdue.
          </div>
        ` : ''}

        ${b.refund_amount > 0 && b.booking_status !== 'Cancelled' ? `
          <div class="mt-2" style="background:var(--gold-cream); padding:8px 12px; border-radius:4px; border:1px solid var(--gold-light); font-size:13px; color:var(--gold-dark);">
            <strong>Full Refund Issued:</strong> ${formatPrice(b.refund_amount)} (100% full refund policy).
          </div>
        ` : ''}
      </div>

      ${(b.booking_status || '').toLowerCase() === 'cancelled' ? `
        <!-- Cancellation Information (Read-Only) -->
        <div class="form-section-card mt-3" style="border: 1px solid #FECACA; background: #FFF5F5;">
          <h4 class="form-section-title" style="color: #991B1B; margin-bottom: 12px; display:flex; align-items:center; justify-content:space-between;">
            <span>Cancellation Information</span>
            <span class="badge badge-danger" style="font-size:11px;">Cancelled</span>
          </h4>
          <div class="form-grid-3">
            <div>
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">STATUS</span>
              <div style="font-weight:700; color:#DC2626; font-size:13.5px;">Cancelled</div>
            </div>
            <div>
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">CANCELLED BY</span>
              <div style="font-weight:700; color:var(--charcoal); font-size:13.5px;">${escapeHtml(b.cancelled_by || 'RideZone Admin')}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">CANCELLED AT</span>
              <div style="font-weight:700; color:var(--charcoal); font-size:13px;">${b.cancelled_at ? formatDateTime(b.cancelled_at) : 'Recorded'}</div>
            </div>
          </div>

          <div class="nav-divider" style="margin: 12px 0; border-color: #FECACA;"></div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <div>
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">REASON</span>
              <div style="font-weight:700; color:#991B1B; font-size:14px; margin-top:2px;">
                ${escapeHtml(b.cancellation_reason || (b.cancelled_by === 'Customer' ? 'Customer Cancellation' : 'Administrative decision'))}
              </div>
            </div>
            <div>
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">ADDITIONAL DETAILS</span>
              <div style="font-size:13px; color:var(--charcoal); background:#FFFFFF; padding:10px 14px; border-radius:6px; border:1px solid #FECACA; margin-top:3px; min-height:36px; line-height:1.5;">
                ${escapeHtml(b.cancellation_details || 'No additional details provided.')}
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:4px;">
              <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase;">REFUND PROCESSED</span>
              <strong class="font-mono text-gold" style="font-size:14.5px;">${formatPrice(b.refund_amount || b.total_price)} (100% full refund)</strong>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    const actions = document.getElementById('bModalActions');
    const bStatus = (b.booking_status || '').toLowerCase();

    if (bStatus === 'pending') {
      actions.innerHTML = `
        <button type="button" class="btn btn-secondary text-danger" onclick="cancelBookingAsAdmin('${b.id}')">Cancel Booking</button>
        <button type="button" class="btn btn-primary" onclick="confirmAcceptBooking('${b.id}')">Accept Booking</button>
      `;
      actions.classList.remove('hidden');
    } else if (bStatus === 'confirmed' || bStatus === 'upcoming') {
      actions.innerHTML = `
        <button type="button" class="btn btn-secondary text-danger" onclick="cancelBookingAsAdmin('${b.id}')">Cancel Booking</button>
        <button type="button" class="btn btn-primary" onclick="confirmActivateBooking('${b.id}')">Handover &amp; Activate</button>
      `;
      actions.classList.remove('hidden');
    } else if (bStatus === 'active') {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" onclick="processVehicleReturn('${b.id}')">Record Vehicle Return</button>
      `;
      actions.classList.remove('hidden');
    } else {
      actions.innerHTML = '';
      actions.classList.add('hidden');
    }

    document.getElementById('bookingDetailModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function confirmAcceptBooking(bookingId) {
  showAdminConfirm({
    breadcrumb: 'Bookings > Accept Reservation',
    title: 'Accept Booking Request',
    message: `Accept and confirm reservation #${bookingId}? This will notify the customer and lock the schedule.`,
    confirmText: 'Accept Booking',
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      try {
        const res = await adminFetch(`/api/admin/bookings/${bookingId}/accept`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to accept booking');

        showToast(`Reservation #${bookingId} successfully accepted!`);
        closeModals();
        loadBookings();
        loadDashboard();
        loadVehicles();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

async function confirmActivateBooking(bookingId) {
  showAdminConfirm({
    breadcrumb: 'Bookings > Vehicle Handover',
    title: 'Handover & Activate Rental',
    message: `Confirm physical vehicle handover to customer and activate reservation #${bookingId}?`,
    confirmText: 'Activate Rental',
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      try {
        const res = await adminFetch(`/api/admin/bookings/${bookingId}/activate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to activate booking');

        showToast(`Reservation #${bookingId} activated successfully!`);
        closeModals();
        loadBookings();
        loadDashboard();
        loadVehicles();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

async function processVehicleReturn(bookingId) {
  showAdminConfirm({
    breadcrumb: 'Bookings > Vehicle Return',
    title: 'Record Vehicle Return',
    message: `Confirm physical return of vehicle for reservation #${bookingId}?`,
    confirmText: 'Record Return',
    confirmClass: 'btn-primary',
    onConfirm: async () => {
      try {
        const res = await adminFetch(`/api/admin/bookings/${bookingId}/return`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to record return');

        showToast(`Vehicle return recorded! ${data.returnDetails.isLate ? `Late fee of ₹${data.returnDetails.lateCharge} applied.` : 'Returned on schedule.'}`);
        closeModals();
        loadBookings();
        loadDashboard();
        loadVehicles();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

// ------------------------------------------------------------
// 7C. DEDICATED ADMIN CANCELLATION ENGINE (2-Step Reason Workflow)
// ------------------------------------------------------------
let activeCancelBooking = null;

async function cancelBookingAsAdmin(bookingId) {
  await openAdminCancelModal(bookingId);
}

async function openAdminCancelModal(bookingId) {
  try {
    let b = (ADMIN_STATE.bookings || []).find(x => x.id === bookingId);
    if (!b) {
      const res = await adminFetch(`/api/admin/bookings/${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        b = data.booking;
      }
    }
    if (!b) throw new Error('Booking details could not be found.');

    activeCancelBooking = b;

    const modal = document.getElementById('adminCancelBookingModal');
    const step1 = document.getElementById('adminCancelStep1');
    const step2 = document.getElementById('adminCancelStep2');
    const reasonSelect = document.getElementById('adminCancelReasonSelect');
    const detailsInput = document.getElementById('adminCancelDetailsInput');
    const nextBtn = document.getElementById('adminCancelNextBtn');
    const reasonHelp = document.getElementById('adminCancelReasonHelp');
    const detailsReq = document.getElementById('adminCancelDetailsRequiredIndicator');
    const detailsBadge = document.getElementById('adminCancelDetailsBadge');

    step1.classList.remove('hidden');
    step2.classList.add('hidden');

    // Populate Booking Summary
    document.getElementById('adminCancelRef').textContent = `#${b.id}`;
    document.getElementById('adminCancelVehicle').textContent = b.vehicle_name || 'Vehicle';
    document.getElementById('adminCancelPickup').textContent = formatDateTime(b.pickup_date, b.pickup_time);
    document.getElementById('adminCancelCustomer').textContent = b.customer_name || 'Customer';

    // Reset controls
    reasonSelect.value = '';
    detailsInput.value = '';
    if (detailsReq) {
      detailsReq.textContent = '(optional)';
      detailsReq.className = 'text-muted';
    }
    if (detailsBadge) {
      detailsBadge.textContent = 'Optional for predefined reasons';
      detailsBadge.className = 'text-muted';
    }
    if (reasonHelp) {
      reasonHelp.textContent = '';
      reasonHelp.className = 'text-muted mt-1';
    }
    if (nextBtn) nextBtn.disabled = true;

    modal.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, true);
  }
}

function closeCancelModal() {
  const modal = document.getElementById('adminCancelBookingModal');
  if (modal) modal.classList.add('hidden');
  activeCancelBooking = null;
}

function validateCancelModalInputs() {
  const reasonSelect = document.getElementById('adminCancelReasonSelect');
  const detailsInput = document.getElementById('adminCancelDetailsInput');
  const nextBtn = document.getElementById('adminCancelNextBtn');
  const detailsReq = document.getElementById('adminCancelDetailsRequiredIndicator');
  const detailsBadge = document.getElementById('adminCancelDetailsBadge');
  const reasonHelp = document.getElementById('adminCancelReasonHelp');

  if (!reasonSelect || !detailsInput || !nextBtn) return false;

  const reason = reasonSelect.value;
  const details = detailsInput.value.trim();

  if (reason === 'Other') {
    if (detailsReq) {
      detailsReq.textContent = '*';
      detailsReq.className = 'text-danger font-bold';
    }
    if (detailsBadge) {
      detailsBadge.textContent = 'Required for "Other"';
      detailsBadge.className = 'text-danger font-bold';
    }
    if (!details || details.length < 3) {
      if (reasonHelp) {
        reasonHelp.textContent = 'Please provide detailed cancellation explanation for "Other" (at least 3 characters).';
        reasonHelp.className = 'text-danger mt-1';
      }
      nextBtn.disabled = true;
      return false;
    } else {
      if (reasonHelp) {
        reasonHelp.textContent = '';
      }
      nextBtn.disabled = false;
      return true;
    }
  } else if (reason) {
    if (detailsReq) {
      detailsReq.textContent = '(optional)';
      detailsReq.className = 'text-muted';
    }
    if (detailsBadge) {
      detailsBadge.textContent = 'Optional for predefined reasons';
      detailsBadge.className = 'text-muted';
    }
    if (reasonHelp) {
      reasonHelp.textContent = '';
      reasonHelp.className = 'text-muted mt-1';
    }
    nextBtn.disabled = false;
    return true;
  } else {
    if (detailsReq) {
      detailsReq.textContent = '(optional)';
      detailsReq.className = 'text-muted';
    }
    if (detailsBadge) {
      detailsBadge.textContent = 'Optional for predefined reasons';
      detailsBadge.className = 'text-muted';
    }
    if (reasonHelp) {
      reasonHelp.textContent = '';
      reasonHelp.className = 'text-muted mt-1';
    }
    nextBtn.disabled = true;
    return false;
  }
}

function goToCancelStep2() {
  if (!validateCancelModalInputs() || !activeCancelBooking) return;

  const reason = document.getElementById('adminCancelReasonSelect').value;
  const details = document.getElementById('adminCancelDetailsInput').value.trim();

  document.getElementById('adminConfirmReasonVal').textContent = reason;
  document.getElementById('adminConfirmDetailsVal').textContent = details || 'None provided';
  document.getElementById('adminConfirmRefundVal').textContent = formatPrice(activeCancelBooking.total_price);

  document.getElementById('adminCancelStep1').classList.add('hidden');
  document.getElementById('adminCancelStep2').classList.remove('hidden');
}

function goToCancelStep1() {
  document.getElementById('adminCancelStep2').classList.add('hidden');
  document.getElementById('adminCancelStep1').classList.remove('hidden');
}

async function executeAdminCancellation() {
  if (!activeCancelBooking) return;
  const finalBtn = document.getElementById('adminCancelFinalBtn');
  const reason = document.getElementById('adminCancelReasonSelect').value;
  const details = document.getElementById('adminCancelDetailsInput').value.trim();

  try {
    finalBtn.disabled = true;
    finalBtn.textContent = 'Cancelling...';

    const res = await adminFetch(`/api/admin/bookings/${activeCancelBooking.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancellation_reason: reason,
        cancellation_details: details || null
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

    const refund = data.refundAmount || data.refund_amount || activeCancelBooking.total_price;
    showToast(`Booking #${activeCancelBooking.id} cancelled. 100% full refund of ₹${Number(refund).toLocaleString('en-IN')} processed.`);
    closeCancelModal();
    closeModals();
    await loadBookings();
    loadDashboard();
    loadVehicles();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    finalBtn.disabled = false;
    finalBtn.textContent = 'Confirm Cancellation';
  }
}

function initAdminCancelModalListeners() {
  const reasonSelect = document.getElementById('adminCancelReasonSelect');
  if (reasonSelect) {
    reasonSelect.addEventListener('change', validateCancelModalInputs);
  }
  const detailsInput = document.getElementById('adminCancelDetailsInput');
  if (detailsInput) {
    detailsInput.addEventListener('input', validateCancelModalInputs);
  }
  const nextBtn = document.getElementById('adminCancelNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', goToCancelStep2);
  }
  const backBtn = document.getElementById('adminCancelBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', goToCancelStep1);
  }
  const finalBtn = document.getElementById('adminCancelFinalBtn');
  if (finalBtn) {
    finalBtn.addEventListener('click', executeAdminCancellation);
  }
  document.querySelectorAll('[data-close-cancel-modal]').forEach(btn => {
    btn.addEventListener('click', closeCancelModal);
  });
}

// ------------------------------------------------------------
// 8. CUSTOMERS CONTROLLER
// ------------------------------------------------------------
async function loadUsers() {
  try {
    const res = await adminFetch('/api/admin/users');
    if (!res.ok) throw new Error('Failed to retrieve customer accounts');
    const data = await res.json();
    ADMIN_STATE.users = data.users || [];

    filterAndRenderUsers();

  } catch (err) {
    console.error('[Users Load Error]:', err);
    showToast(err.message, true);
  }
}

function filterAndRenderUsers() {
  const { search, status } = ADMIN_STATE.userFilters;
  let list = ADMIN_STATE.users;

  if (status && status !== 'all') {
    list = list.filter(u => (u.status || 'Active').toLowerCase() === status.toLowerCase());
  }

  if (search && search.trim()) {
    const s = search.toLowerCase();
    list = list.filter(u =>
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.phone && u.phone.includes(s))
    );
  }

  const tbody = document.getElementById('adminUsersTableBody');
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="admin-empty-state">
            <div class="empty-icon-wrap">
              <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </div>
            <div class="empty-title">No Registered Customers Found</div>
            <p class="empty-subtitle">Customer accounts will be listed here upon user registration.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const uStatus = u.status || 'Active';
    const isSuspended = uStatus === 'Suspended';
    return `
    <tr>
      <td><strong class="font-mono text-gold">#C-${u.id}</strong></td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="user-avatar" style="width:30px; height:30px; font-size:11px;">${u.name.substring(0, 2).toUpperCase()}</div>
          <strong>${escapeHtml(u.name)}</strong>
        </div>
      </td>
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(u.phone || '--')}</td>
      <td><strong>${u.total_bookings || 0}</strong></td>
      <td><span class="text-gold font-weight-bold">${u.active_rentals || 0}</span></td>
      <td><strong>${formatPrice(u.total_spent || 0)}</strong></td>
      <td>
        <span class="badge ${isSuspended ? 'badge-danger' : 'badge-success'}">${uStatus === 'Active' ? 'Active Rider' : 'Suspended'}</span>
      </td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="openUserDetailModal(${u.id})">Profile &amp; History</button>
          <button class="btn ${isSuspended ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="toggleUserStatus(${u.id}, '${uStatus}')">
            ${isSuspended ? 'Activate' : 'Suspend'}
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
  showAdminConfirm({
    breadcrumb: 'Customers > Account Status',
    title: `${newStatus === 'Active' ? 'Reactivate' : 'Suspend'} Customer`,
    message: `Are you sure you want to change this customer's account status to '${newStatus}'?`,
    confirmText: newStatus === 'Active' ? 'Reactivate Account' : 'Suspend Account',
    confirmClass: newStatus === 'Active' ? 'btn-primary' : 'btn-danger',
    onConfirm: async () => {
      try {
        const res = await adminFetch(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update customer status');

        showToast(data.message || `Customer status updated to ${newStatus}.`);
        loadUsers();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

// Customer Profile & History Modal
async function openUserDetailModal(userId) {
  try {
    const res = await adminFetch(`/api/admin/users/${userId}`);
    if (!res.ok) throw new Error('Failed to retrieve customer details');
    const data = await res.json();
    const u = data.user;
    const s = data.summary;
    const bookings = data.bookings || [];

    document.getElementById('uModalName').textContent = u.name;
    document.getElementById('uModalEmail').textContent = `${u.email} • Member Since ${formatDate(u.created_at)}`;

    const content = document.getElementById('uModalContent');
    content.innerHTML = `
      <!-- Customer Lifetime Summary KPIs -->
      <div class="profile-activity-grid">
        <div class="activity-mini-card">
          <div class="act-val">${s.totalBookings}</div>
          <div class="act-label">Total Reservations</div>
        </div>
        <div class="activity-mini-card">
          <div class="act-val text-success">${s.active}</div>
          <div class="act-label">Active Rentals</div>
        </div>
        <div class="activity-mini-card">
          <div class="act-val text-gold">${s.completed}</div>
          <div class="act-label">Completed Trips</div>
        </div>
        <div class="activity-mini-card">
          <div class="act-val">${formatPrice(s.totalSpent || 0)}</div>
          <div class="act-label">Lifetime Spend</div>
        </div>
      </div>

      <!-- Personal Info Card -->
      <div class="form-section-card">
        <h4 class="form-section-title">Contact & Account Details</h4>
        <div class="form-grid-3">
          <div><span class="text-muted" style="font-size:11px;">USER ID</span><div style="font-weight:700;">#C-${u.id}</div></div>
          <div><span class="text-muted" style="font-size:11px;">EMAIL ADDRESS</span><div style="font-weight:600;">${escapeHtml(u.email)}</div></div>
          <div><span class="text-muted" style="font-size:11px;">PHONE NUMBER</span><div style="font-weight:600;">${escapeHtml(u.phone || 'None provided')}</div></div>
        </div>
      </div>

      <!-- Customer Booking History Table -->
      <div class="admin-card mt-3">
        <div class="admin-card-header">
          <h4 class="box-heading">Reservation & Payment History</h4>
        </div>
        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Vehicle</th>
                <th>Pickup Date</th>
                <th>Duration</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.length > 0 ? bookings.map(b => `
                <tr>
                  <td><strong class="font-mono text-gold">${b.id}</strong></td>
                  <td>${escapeHtml(b.vehicle_name)}</td>
                  <td>${formatDateTime(b.pickup_date, b.pickup_time)}</td>
                  <td>${b.hours} hrs</td>
                  <td><strong>${formatPrice(b.total_price)}</strong></td>
                  <td>${getStatusBadge(b.booking_status)}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="closeModals(); openBookingDetailModal('${b.id}')">Details</button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" class="text-center py-4 text-muted">No reservations recorded for this customer.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('userDetailModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, true);
  }
}

// ------------------------------------------------------------
// 9. PAYMENTS CONTROLLER
// ------------------------------------------------------------
async function loadPayments() {
  try {
    const { search, status } = ADMIN_STATE.paymentFilters;
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);

    const res = await adminFetch(`/api/admin/payments?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to retrieve financial transactions');
    const data = await res.json();
    ADMIN_STATE.payments = data;

    // Financial KPI Top Summary Cards
    const summary = data.summary || {};
    const grossVal = summary.gross_volume ?? summary.grossRevenue ?? 0;
    const netVal = summary.net_rental ?? summary.netRentalRevenue ?? 0;
    const depVal = summary.total_deposits_held ?? summary.depositsHeld ?? 0;
    const refVal = summary.total_refunds ?? summary.totalRefunds ?? 0;

    const grossEl = document.getElementById('payGrossTotal');
    if (grossEl) grossEl.textContent = formatPrice(grossVal);
    const netEl = document.getElementById('payNetRental');
    if (netEl) netEl.textContent = formatPrice(netVal);
    const depEl = document.getElementById('payDepositsHeld');
    if (depEl) depEl.textContent = formatPrice(depVal);
    const refEl = document.getElementById('payTotalRefunds');
    if (refEl) refEl.textContent = formatPrice(refVal);

    const tbody = document.getElementById('adminPaymentsTableBody');
    const list = data.transactions || [];

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11">
            <div class="admin-empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M21 4H3c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H3V8h18v10zm-10-7H5v2h6v-2z"/></svg>
              </div>
              <div class="empty-title">No Transactions Recorded</div>
              <p class="empty-subtitle">Financial audit logs will appear here when customer payments and refunds occur.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(t => {
      const displayTxnId = t.transaction_id || `TXN-${String(t.id).replace(/^RZ-/, "")}`;
      return `
        <tr>
          <td><strong class="font-mono text-gold">${displayTxnId}</strong></td>
          <td><strong class="font-mono">${t.booking_id || t.id}</strong></td>
          <td>
            <div style="font-weight:600;">${escapeHtml(t.customer_name || 'Customer')}</div>
            <small class="text-muted">${escapeHtml(t.customer_email || '')}</small>
          </td>
          <td>${escapeHtml(t.vehicle_name)}</td>
          <td>${formatPrice(t.rental_price)}</td>
          <td>${formatPrice(t.deposit_amount)}</td>
          <td><strong>${formatPrice(t.total_price)}</strong></td>
          <td><span class="badge badge-outline">${t.payment_method || 'UPI'}</span></td>
          <td>${getStatusBadge(t.display_status)}</td>
          <td>${formatDateTime(t.created_at)}</td>
          <td style="text-align:center;">
            <button class="btn-bill" onclick="openPaymentDetailModal('${displayTxnId}')" title="View Customer Bill">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Bill</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('[Payments Load Error]:', err);
    showToast(err.message, true);
  }
}

function openPaymentDetailModal(txnId) {
  if (!ADMIN_STATE.payments || !ADMIN_STATE.payments.transactions) return;
  const t = ADMIN_STATE.payments.transactions.find(item => 
    item.transaction_id === txnId || 
    item.id === txnId || 
    item.booking_id === txnId ||
    String(item.id).replace(/^RZ-/, "") === String(txnId).replace(/^TXN-/, "")
  );
  if (!t) return;

  const displayTxnId = t.transaction_id || `TXN-${String(t.id).replace(/^RZ-/, "")}`;
  document.getElementById('payModalTxnId').textContent = displayTxnId;
  document.getElementById('payModalDate').textContent = `Transaction Created: ${formatDateTime(t.created_at)}`;

  const hourlyRate = t.hours > 0 ? Math.round(Number(t.rental_price) / Number(t.hours)) : Number(t.rental_price);

  const content = document.getElementById('payModalContent');
  content.innerHTML = `
    <!-- Top Transaction Card -->
    <div class="form-section-card" style="background:var(--rz-surface-soft); border:1px solid var(--rz-border-gold); margin-bottom:14px;">
      <div class="form-grid-2">
        <div>
          <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Transaction Reference</span>
          <div class="font-mono text-gold" style="font-weight:700; font-size:15px;">${displayTxnId}</div>
        </div>
        <div>
          <span class="text-muted" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Booking ID</span>
          <div class="font-mono" style="font-weight:700; font-size:15px;">${t.booking_id || t.id}</div>
        </div>
      </div>
    </div>

    <!-- 1. Customer Information -->
    <div class="form-section-card mb-3">
      <h4 class="form-section-title" style="font-size:13px; font-weight:700; margin-bottom:8px; border-bottom:1px solid var(--rz-border); padding-bottom:4px;">1. Customer Information</h4>
      <div class="diag-key-val" style="margin-bottom:0;">
        <div class="diag-row"><span class="diag-label">Customer Name:</span><strong>${escapeHtml(t.customer_name || 'Customer')}</strong></div>
        <div class="diag-row"><span class="diag-label">Email Address:</span><span>${escapeHtml(t.customer_email || '--')}</span></div>
        <div class="diag-row"><span class="diag-label">Contact Phone:</span><span>${escapeHtml(t.customer_phone || '+91 98765 43210')}</span></div>
      </div>
    </div>

    <!-- 2. Vehicle & Rental Details -->
    <div class="form-section-card mb-3">
      <h4 class="form-section-title" style="font-size:13px; font-weight:700; margin-bottom:8px; border-bottom:1px solid var(--rz-border); padding-bottom:4px;">2. Vehicle &amp; Rental Information</h4>
      <div class="diag-key-val" style="margin-bottom:0;">
        <div class="diag-row"><span class="diag-label">Motorcycle / Model:</span><strong>${escapeHtml(t.vehicle_name)} ${t.vehicle_brand ? `(${escapeHtml(t.vehicle_brand)})` : ''}</strong></div>
        <div class="diag-row"><span class="diag-label">Registration Number:</span><strong class="font-mono text-gold">${escapeHtml(t.vehicle_reg_no || 'TS 09 RZ 1001')}</strong></div>
        <div class="diag-row"><span class="diag-label">Pickup Schedule:</span><span>${formatDateTime(t.pickup_date, t.pickup_time)}</span></div>
        <div class="diag-row"><span class="diag-label">Rental Duration:</span><strong>${t.hours || 4} Hours</strong> (Rate: ₹${hourlyRate}/hr)</div>
        ${t.expected_return ? `<div class="diag-row"><span class="diag-label">Expected Return:</span><span>${formatDate(t.expected_return)}</span></div>` : ''}
        ${t.actual_return ? `<div class="diag-row"><span class="diag-label">Actual Return:</span><span>${formatDate(t.actual_return)}</span></div>` : ''}
      </div>
    </div>

    <!-- 3. Payment & Authoritative Financial Breakdown -->
    <div class="form-section-card mb-0">
      <h4 class="form-section-title" style="font-size:13px; font-weight:700; margin-bottom:8px; border-bottom:1px solid var(--rz-border); padding-bottom:4px;">3. Payment Breakdown</h4>
      <div class="diag-key-val" style="margin-bottom:0;">
        <div class="diag-row"><span class="diag-label">Payment Method:</span><span>${t.payment_method || 'UPI'}</span></div>
        <div class="diag-row"><span class="diag-label">Booking Status:</span><span>${getStatusBadge(t.booking_status || 'Confirmed')}</span></div>
        <div class="diag-row"><span class="diag-label">Payment Status:</span><span>${getStatusBadge(t.display_status || t.payment_status || 'Paid')}</span></div>
        <div class="diag-row"><span class="diag-label">Base Rental Amount:</span><span>${formatPrice(t.rental_price)}</span></div>
        <div class="diag-row"><span class="diag-label">Security Deposit (Escrow):</span><span>${formatPrice(t.deposit_amount)}</span></div>
        <div class="diag-row" style="font-size:15px; border-top:1px solid var(--rz-border); padding-top:6px;"><span class="diag-label"><strong>Total Paid:</strong></span><strong class="text-gold font-mono" style="font-size:16px;">${formatPrice(t.total_price)}</strong></div>
        ${Number(t.refund_amount) > 0 ? `
          <div class="diag-row" style="color:var(--rz-danger); background:var(--rz-danger-bg); border-radius:4px; padding:6px 10px; margin-top:6px;">
            <span class="diag-label" style="color:var(--rz-danger); font-weight:700;">100% Full Refund Issued:</span>
            <strong class="font-mono">-${formatPrice(t.refund_amount)}</strong>
          </div>
          ${t.cancelled_by ? `<div class="diag-row" style="font-size:12px; color:var(--rz-text-secondary);"><span class="diag-label">Cancelled By:</span><span>${escapeHtml(t.cancelled_by)} (${t.cancelled_at ? formatDate(t.cancelled_at) : 'Processed'})</span></div>` : ''}
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('paymentDetailModal').classList.remove('hidden');
}

// Export for test suites & buttons
window.openPaymentReceiptModal = openPaymentDetailModal;

// ------------------------------------------------------------
// 10. ADMIN PROFILE CONTROLLER
// ------------------------------------------------------------
async function loadProfile() {
  updateAdminUIElements();
}

function openEditProfileModal() {
  const admin = ADMIN_STATE.admin || {};
  const nameInput = document.getElementById('editProfName');
  const emailInput = document.getElementById('editProfEmail');
  const phoneInput = document.getElementById('editProfPhone');
  const locInput = document.getElementById('editProfLocation');

  if (nameInput) nameInput.value = admin.name || 'System Administrator';
  if (emailInput) emailInput.value = admin.email || 'admin@gmail.com';
  if (phoneInput) phoneInput.value = admin.phone || '+91 98765 43210';
  if (locInput) locInput.value = admin.location || 'Hyderabad, Telangana, India';

  ADMIN_STATE.editModalPendingPhoto = (admin && admin.profile_photo) ? admin.profile_photo : null;

  const photoImg = document.getElementById('editModalPhotoImg');
  const photoInitial = document.getElementById('editModalPhotoInitial');
  const statusEl = document.getElementById('editModalPhotoStatus');
  if (statusEl) statusEl.classList.add('hidden');

  const name = admin.name || 'Admin';
  const parts = name.trim().split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();

  if (photoImg && photoInitial) {
    if (admin.profile_photo) {
      photoImg.src = admin.profile_photo;
      photoImg.classList.remove('hidden');
      photoInitial.classList.add('hidden');
    } else {
      photoImg.classList.add('hidden');
      photoInitial.classList.remove('hidden');
      photoInitial.textContent = initials || 'AD';
    }
  }

  const errEl = document.getElementById('editProfError');
  if (errEl) errEl.classList.add('hidden');
  const succEl = document.getElementById('editProfSuccess');
  if (succEl) succEl.classList.add('hidden');

  document.getElementById('editProfileModal').classList.remove('hidden');
}

function removeEditModalPhoto() {
  ADMIN_STATE.editModalPendingPhoto = '';
  const photoImg = document.getElementById('editModalPhotoImg');
  const photoInitial = document.getElementById('editModalPhotoInitial');
  const statusEl = document.getElementById('editModalPhotoStatus');

  if (photoImg) photoImg.classList.add('hidden');
  if (photoInitial) {
    photoInitial.classList.remove('hidden');
    const admin = ADMIN_STATE.admin || {};
    const name = admin.name || 'Admin';
    const parts = name.trim().split(' ');
    const initials = parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
    photoInitial.textContent = initials || 'AD';
  }
  if (statusEl) {
    statusEl.textContent = 'Photo marked for removal. Click "Save All Changes" to apply.';
    statusEl.classList.remove('hidden');
  }
}

function togglePasswordForm() {
  const staticView = document.getElementById('passwordStaticView');
  const form = document.getElementById('adminPasswordForm');
  const btn = document.getElementById('togglePasswordFormBtn');
  if (form && staticView) {
    const isHidden = form.classList.contains('hidden');
    if (isHidden) {
      form.classList.remove('hidden');
      staticView.classList.add('hidden');
      if (btn) btn.textContent = 'Hide Form';
    } else {
      form.classList.add('hidden');
      staticView.classList.remove('hidden');
      form.reset();
      const msgEl = document.getElementById('pwdUpdateMsg');
      const errEl = document.getElementById('pwdUpdateError');
      if (msgEl) msgEl.classList.add('hidden');
      if (errEl) errEl.classList.add('hidden');
      if (btn) btn.textContent = 'Change Password';
    }
  }
}

function cancelPhotoPreview() {
  ADMIN_STATE.pendingProfilePhoto = null;
  const pendingControls = document.getElementById('photoPendingControls');
  const defaultControls = document.getElementById('photoDefaultControls');
  if (pendingControls) pendingControls.classList.add('hidden');
  if (defaultControls) defaultControls.classList.remove('hidden');
  updateAdminUIElements();
}

async function saveAdminProfilePhoto() {
  if (!ADMIN_STATE.pendingProfilePhoto) return;
  const { dataUrl, filename } = ADMIN_STATE.pendingProfilePhoto;
  const btn = document.getElementById('btnSaveAdminPhoto');
  if (btn) btn.disabled = true;

  try {
    const uploadRes = await adminFetch('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, filename })
    });
    const uploadData = await uploadRes.json();
    const photoUrl = uploadData.url || dataUrl;

    const updateRes = await adminFetch('/api/admin/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: ADMIN_STATE.admin.name,
        email: ADMIN_STATE.admin.email,
        phone: ADMIN_STATE.admin.phone,
        location: ADMIN_STATE.admin.location,
        profile_photo: photoUrl
      })
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update profile photo');

    ADMIN_STATE.admin = updateData.admin;
    if (updateData.token) {
      ADMIN_STATE.token = updateData.token;
      localStorage.setItem('ridezone_admin_token', updateData.token);
    }
    ADMIN_STATE.pendingProfilePhoto = null;
    cancelPhotoPreview();
    updateAdminUIElements();
    showToast('Administrator profile photo saved successfully!');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function removeAdminProfilePhoto() {
  showAdminConfirm({
    breadcrumb: 'Admin Profile > Avatar',
    title: 'Remove Profile Photo',
    message: 'Remove your customized administrator portrait photo and restore default monogram?',
    confirmText: 'Remove Photo',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        const updateRes = await adminFetch('/api/admin/profile', {
          method: 'PUT',
          body: JSON.stringify({
            name: ADMIN_STATE.admin.name,
            email: ADMIN_STATE.admin.email,
            phone: ADMIN_STATE.admin.phone,
            location: ADMIN_STATE.admin.location,
            profile_photo: null
          })
        });

        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to remove profile photo');

        ADMIN_STATE.admin = updateData.admin;
        if (updateData.token) {
          ADMIN_STATE.token = updateData.token;
          localStorage.setItem('ridezone_admin_token', updateData.token);
        }
        updateAdminUIElements();
        showToast('Profile photo removed.');
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });
}

// ------------------------------------------------------------
// 11. EVENT LISTENERS & MODAL MANAGEMENT
// ------------------------------------------------------------
function closeModals() {
  document.querySelectorAll('.admin-modal-backdrop').forEach(m => m.classList.add('hidden'));
}

document.addEventListener('DOMContentLoaded', () => {
  // Check session immediately
  checkAuth();

  // Login Form Submission
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmailInput').value.trim();
      const password = document.getElementById('adminPasswordInput').value;
      const errorEl = document.getElementById('adminLoginError');
      const btn = document.getElementById('adminLoginBtn');

      errorEl.classList.add('hidden');
      btn.disabled = true;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        ADMIN_STATE.token = data.token;
        ADMIN_STATE.admin = data.admin;
        localStorage.setItem('ridezone_admin_token', data.token);

        showToast(`Welcome back, ${data.admin.name}!`);
        showAppScreen();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Confirmation Modal Action Trigger
  const confirmActionBtn = document.getElementById('confirmModalActionBtn');
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', () => {
      const cb = currentConfirmCallback;
      closeConfirmModal();
      if (typeof cb === 'function') cb();
    });
  }

  // Confirmation Modal Close Triggers
  document.querySelectorAll('[data-close-confirm]').forEach(btn => {
    btn.addEventListener('click', closeConfirmModal);
  });

  // Sidebar navigation click
  document.querySelectorAll('.sidebar-nav .nav-item[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      adminNav(btn.dataset.nav);
    });
  });

  // Chart Period Toggle Listeners
  document.querySelectorAll('.chart-tab-btn[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      loadDashboard(btn.dataset.period);
    });
  });

  // Logout triggers
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);

  // Mobile menu toggle
  const mobBtn = document.getElementById('mobileMenuBtn');
  if (mobBtn) {
    mobBtn.addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.toggle('open');
    });
  }

  // Close modals on [data-close-modal]
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  // Close modal on backdrop click
  document.querySelectorAll('.admin-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        if (backdrop.id === 'adminConfirmModal') {
          closeConfirmModal();
        } else if (backdrop.id === 'adminCancelBookingModal') {
          closeCancelModal();
        } else {
          closeModals();
        }
      }
    });
  });

  // Escape key closes open admin modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      closeCancelModal();
      closeModals();
    }
  });

  // Add Vehicle Form Submit
  const addVehForm = document.getElementById('addVehicleForm');
  if (addVehForm) {
    addVehForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('addVehError');
      const submitBtn = document.getElementById('submitAddVehicleBtn');
      errEl.classList.add('hidden');
      submitBtn.disabled = true;

      const name = document.getElementById('addVehName').value.trim();
      const brand = document.getElementById('addVehBrand').value.trim();
      const model = document.getElementById('addVehModel').value.trim();
      const category = document.getElementById('addVehCategory').value;
      const vehicle_reg_no = document.getElementById('addVehRegNo').value.trim();
      const year = Number(document.getElementById('addVehYear').value) || 2024;
      const fuel_type = document.getElementById('addVehFuel').value;
      const transmission = document.getElementById('addVehTransmission').value;
      const status = document.getElementById('addVehStatus').value;
      const price = Number(document.getElementById('addVehPrice').value);
      const deposit_amount = Number(document.getElementById('addVehDeposit').value) || 1000;
      const rating = Number(document.getElementById('addVehRating').value) || 4.8;
      const description = document.getElementById('addVehDesc').value.trim();

      const image = ADMIN_STATE.addVehPrimary || ADMIN_STATE.addVehImages[0] || '/assets/hunter.png';
      const additional_images = ADMIN_STATE.addVehImages.filter(img => img !== image);

      const specs = {
        motor_engine: document.getElementById('addSpecMotor').value.trim() || "Single Cylinder 4-Stroke",
        power: document.getElementById('addSpecPower').value.trim() || "Standard Power",
        torque: document.getElementById('addSpecTorque').value.trim() || "Standard Torque",
        top_speed: document.getElementById('addSpecTopSpeed').value.trim() || "100 km/h",
        range_efficiency: document.getElementById('addSpecRange').value.trim() || "45 km/l",
        brakes: document.getElementById('addSpecBrakes').value.trim() || "Dual Disc ABS",
        transmission,
        fuel_type
      };

      try {
        const res = await adminFetch('/api/admin/vehicles', {
          method: 'POST',
          body: JSON.stringify({
            name, brand, model, category, vehicle_reg_no, year, fuel_type, transmission,
            status, price, deposit_amount, rating, image, gallery: ADMIN_STATE.addVehImages,
            additional_images, description, specs
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add vehicle');

        showToast(data.message || `Vehicle ${name} added successfully!`);
        adminNav('vehicles');
        loadDashboard();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Edit Vehicle Form Submit
  const editVehForm = document.getElementById('editVehicleForm');
  if (editVehForm) editVehForm.addEventListener('submit', saveEditVehicle);

  // Add Vehicle Image File Picker
  const addVehImageFilesInput = document.getElementById('addVehImageFiles');
  if (addVehImageFilesInput) {
    addVehImageFilesInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const loading = document.getElementById('addVehUploadLoading');
      const errEl = document.getElementById('addVehUploadError');
      if (errEl) errEl.classList.add('hidden');
      if (loading) loading.classList.remove('hidden');

      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          if (errEl) {
            errEl.textContent = `Invalid file format for ${file.name}. Only PNG, JPG, and WEBP supported.`;
            errEl.classList.remove('hidden');
          }
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          if (errEl) {
            errEl.textContent = `File ${file.name} exceeds 5MB size limit.`;
            errEl.classList.remove('hidden');
          }
          continue;
        }

        try {
          const dataUrl = await readFileAsDataURL(file);
          const uploadRes = await adminFetch('/api/admin/upload', {
            method: 'POST',
            body: JSON.stringify({ dataUrl, filename: file.name })
          });
          const uploadData = await uploadRes.json();
          const photoUrl = uploadData.url || dataUrl;

          if (!ADMIN_STATE.addVehImages.includes(photoUrl)) {
            ADMIN_STATE.addVehImages.push(photoUrl);
          }
          if (!ADMIN_STATE.addVehPrimary) {
            ADMIN_STATE.addVehPrimary = photoUrl;
          }
        } catch (err) {
          if (errEl) {
            errEl.textContent = `Error uploading ${file.name}: ${err.message}`;
            errEl.classList.remove('hidden');
          }
        }
      }

      if (loading) loading.classList.add('hidden');
      renderAddVehImageGrid();
      showToast('Pictures added to vehicle images list!');
      addVehImageFilesInput.value = '';
    });
  }

  // Edit Vehicle Image File Picker
  const editVehImageFilesInput = document.getElementById('editVehImageFiles');
  if (editVehImageFilesInput) {
    editVehImageFilesInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const loading = document.getElementById('editVehUploadLoading');
      const errEl = document.getElementById('editVehUploadError');
      if (errEl) errEl.classList.add('hidden');
      if (loading) loading.classList.remove('hidden');

      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          if (errEl) {
            errEl.textContent = `Invalid file format for ${file.name}. Only PNG, JPG, and WEBP supported.`;
            errEl.classList.remove('hidden');
          }
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          if (errEl) {
            errEl.textContent = `File ${file.name} exceeds 5MB size limit.`;
            errEl.classList.remove('hidden');
          }
          continue;
        }

        try {
          const dataUrl = await readFileAsDataURL(file);
          const uploadRes = await adminFetch('/api/admin/upload', {
            method: 'POST',
            body: JSON.stringify({ dataUrl, filename: file.name })
          });
          const uploadData = await uploadRes.json();
          const photoUrl = uploadData.url || dataUrl;

          if (!ADMIN_STATE.editVehImages.includes(photoUrl)) {
            ADMIN_STATE.editVehImages.push(photoUrl);
          }
          if (!ADMIN_STATE.editVehPrimary) {
            ADMIN_STATE.editVehPrimary = photoUrl;
          }
        } catch (err) {
          if (errEl) {
            errEl.textContent = `Error uploading ${file.name}: ${err.message}`;
            errEl.classList.remove('hidden');
          }
        }
      }

      if (loading) loading.classList.add('hidden');
      renderEditVehImageGrid();
      showToast('Pictures added to vehicle images list!');
      editVehImageFilesInput.value = '';
    });
  }

  // Admin Photo Input (Profile Card)
  const adminPhotoInput = document.getElementById('adminPhotoInput');
  if (adminPhotoInput) {
    adminPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        showToast('Invalid photo format. Please select PNG, JPG, or WEBP.', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo exceeds 5MB size limit.', true);
        return;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        ADMIN_STATE.pendingProfilePhoto = { dataUrl, filename: file.name };

        const previewImg = document.getElementById('profPhotoImg');
        const initialSpan = document.getElementById('profPhotoInitial');
        const pendingControls = document.getElementById('photoPendingControls');
        const defaultControls = document.getElementById('photoDefaultControls');

        if (previewImg) {
          previewImg.src = dataUrl;
          previewImg.classList.remove('hidden');
        }
        if (initialSpan) initialSpan.classList.add('hidden');
        if (pendingControls) pendingControls.classList.remove('hidden');
        if (defaultControls) defaultControls.classList.add('hidden');

        showToast('Photo preview ready. Click "Save Photo" to apply.');
      } catch (err) {
        showToast('Error reading photo: ' + err.message, true);
      }
    });
  }

  // Fleet Search & Filters
  const fleetSearch = document.getElementById('fleetSearchInput');
  if (fleetSearch) {
    fleetSearch.addEventListener('input', (e) => {
      ADMIN_STATE.fleetFilters.search = e.target.value;
      filterAndRenderVehicles();
    });
  }

  const fleetCat = document.getElementById('fleetCategoryFilter');
  if (fleetCat) {
    fleetCat.addEventListener('change', (e) => {
      ADMIN_STATE.fleetFilters.category = e.target.value;
      filterAndRenderVehicles();
    });
  }

  const fleetStat = document.getElementById('fleetStatusFilter');
  if (fleetStat) {
    fleetStat.addEventListener('change', (e) => {
      ADMIN_STATE.fleetFilters.status = e.target.value;
      filterAndRenderVehicles();
    });
  }

  // Booking Status Tabs Click
  document.querySelectorAll('.status-tab-btn[data-bstatus]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ADMIN_STATE.bookingFilters.statusTab = btn.dataset.bstatus;
      loadBookings();
    });
  });

  // Booking Filters
  const bSearch = document.getElementById('bookingsSearchInput');
  if (bSearch) {
    let timeout;
    bSearch.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        ADMIN_STATE.bookingFilters.search = e.target.value;
        loadBookings();
      }, 300);
    });
  }

  const bVehFilter = document.getElementById('bookingsVehicleFilter');
  if (bVehFilter) {
    bVehFilter.addEventListener('change', (e) => {
      ADMIN_STATE.bookingFilters.vehicle = e.target.value;
      loadBookings();
    });
  }

  const bRefresh = document.getElementById('bookingsRefreshBtn');
  if (bRefresh) bRefresh.addEventListener('click', loadBookings);

  // Customer Filters
  const custSearch = document.getElementById('customerSearchInput');
  if (custSearch) {
    custSearch.addEventListener('input', (e) => {
      ADMIN_STATE.userFilters.search = e.target.value;
      filterAndRenderUsers();
    });
  }

  const custStatFilter = document.getElementById('customerStatusFilter');
  if (custStatFilter) {
    custStatFilter.addEventListener('change', (e) => {
      ADMIN_STATE.userFilters.status = e.target.value;
      filterAndRenderUsers();
    });
  }

  // Payments Filters
  const paySearch = document.getElementById('paymentsSearchInput');
  if (paySearch) {
    let timeout;
    paySearch.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        ADMIN_STATE.paymentFilters.search = e.target.value;
        loadPayments();
      }, 300);
    });
  }

  const payStatFilter = document.getElementById('paymentsStatusFilter');
  if (payStatFilter) {
    payStatFilter.addEventListener('change', (e) => {
      ADMIN_STATE.paymentFilters.status = e.target.value;
      loadPayments();
    });
  }

  const payRefresh = document.getElementById('paymentsRefreshBtn');
  if (payRefresh) payRefresh.addEventListener('click', loadPayments);

  // Mini Calendar Navigation inside Vehicle Detail Modal
  const calPrevBtn = document.getElementById('modalCalPrevBtn');
  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      ADMIN_STATE.modalCal.month--;
      if (ADMIN_STATE.modalCal.month < 0) {
        ADMIN_STATE.modalCal.month = 11;
        ADMIN_STATE.modalCal.year--;
      }
      renderModalMiniCalendar();
    });
  }

  const calNextBtn = document.getElementById('modalCalNextBtn');
  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      ADMIN_STATE.modalCal.month++;
      if (ADMIN_STATE.modalCal.month > 11) {
        ADMIN_STATE.modalCal.month = 0;
        ADMIN_STATE.modalCal.year++;
      }
      renderModalMiniCalendar();
    });
  }

  // In-Modal Admin Photo Picker
  const editModalPhotoInput = document.getElementById('editModalPhotoInput');
  if (editModalPhotoInput) {
    editModalPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        showToast('Invalid photo format. Please select PNG, JPG, or WEBP.', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo exceeds 5MB size limit.', true);
        return;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        const uploadRes = await adminFetch('/api/admin/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl, filename: file.name })
        });
        const uploadData = await uploadRes.json();
        const photoUrl = uploadData.url || dataUrl;

        ADMIN_STATE.editModalPendingPhoto = photoUrl;

        const photoImg = document.getElementById('editModalPhotoImg');
        const photoInitial = document.getElementById('editModalPhotoInitial');
        const statusEl = document.getElementById('editModalPhotoStatus');

        if (photoImg) {
          photoImg.src = photoUrl;
          photoImg.classList.remove('hidden');
        }
        if (photoInitial) photoInitial.classList.add('hidden');
        if (statusEl) {
          statusEl.textContent = 'New portrait selected. Click "Save All Changes" to apply.';
          statusEl.classList.remove('hidden');
        }
      } catch (err) {
        showToast('Error uploading portrait: ' + err.message, true);
      }
    });
  }

  // Admin Profile Modal Form Submit
  const editProfModalForm = document.getElementById('adminEditProfileModalForm');
  if (editProfModalForm) {
    editProfModalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('editProfName').value.trim();
      const email = document.getElementById('editProfEmail').value.trim();
      const phone = document.getElementById('editProfPhone').value.trim();
      const location = document.getElementById('editProfLocation').value.trim();

      const errEl = document.getElementById('editProfError');
      const succEl = document.getElementById('editProfSuccess');
      const saveBtn = document.getElementById('saveEditProfModalBtn');

      errEl.classList.add('hidden');
      succEl.classList.add('hidden');
      saveBtn.disabled = true;

      const payload = {
        name,
        email,
        phone,
        location
      };
      if (ADMIN_STATE.editModalPendingPhoto !== undefined) {
        payload.profile_photo = ADMIN_STATE.editModalPendingPhoto;
      }

      try {
        const res = await adminFetch('/api/admin/profile', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update admin profile');

        ADMIN_STATE.admin = data.admin;
        if (data.token) {
          ADMIN_STATE.token = data.token;
          localStorage.setItem('ridezone_admin_token', data.token);
        }

        updateAdminUIElements();
        succEl.textContent = 'Administrator profile updated successfully!';
        succEl.classList.remove('hidden');
        showToast('Admin profile updated!');
        setTimeout(() => {
          closeModals();
        }, 600);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Admin Password Form Submit
  const adminPasswordForm = document.getElementById('adminPasswordForm');
  if (adminPasswordForm) {
    adminPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('profCurrentPass').value;
      const newPassword = document.getElementById('profNewPass').value;
      const confirmPassword = document.getElementById('profConfirmPass').value;
      const msgEl = document.getElementById('pwdUpdateMsg');
      const errEl = document.getElementById('pwdUpdateError');
      const saveBtn = document.getElementById('savePwdBtn');

      msgEl.classList.add('hidden');
      errEl.classList.add('hidden');

      if (newPassword !== confirmPassword) {
        errEl.textContent = 'New passwords do not match. Please verify.';
        errEl.classList.remove('hidden');
        return;
      }

      if (newPassword.length < 6) {
        errEl.textContent = 'New password must be at least 6 characters long.';
        errEl.classList.remove('hidden');
        return;
      }

      saveBtn.disabled = true;

      try {
        const res = await adminFetch('/api/admin/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update password');

        msgEl.textContent = 'Administrator password changed successfully!';
        msgEl.classList.remove('hidden');
        adminPasswordForm.reset();
        showToast('Password successfully updated!');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Admin Cancel Booking Modal Listeners
  initAdminCancelModalListeners();
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
