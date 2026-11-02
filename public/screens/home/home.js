/**
 * ============================================================
 * RideZone Modular Home Screen Controller
 * public/screens/home/home.js
 * ============================================================
 */

(function initRideZoneHome() {
  'use strict';

  // Elements
  const searchForm = document.getElementById('homeSearchForm');
  const vehicleTypeSelect = document.getElementById('searchVehicleType');
  const locationSelect = document.getElementById('searchLocation');
  const pickupDateInput = document.getElementById('searchPickupDate');
  const returnDateInput = document.getElementById('searchReturnDate');
  const searchErrorEl = document.getElementById('searchValidationError');
  const searchErrorText = document.getElementById('searchValidationText');
  const vehicleCountStat = document.getElementById('heroVehicleCount');
  const headerSearchBtn = document.getElementById('headerSearchBtn');

  // Format Date to YYYY-MM-DD helper
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Add days helper
  function addDays(d, days) {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
  }

  // 1. Initialize Date Inputs with Min & Default Values
  const today = new Date();
  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(addDays(today, 1));

  if (pickupDateInput) {
    pickupDateInput.min = todayStr;
    if (!pickupDateInput.value) {
      pickupDateInput.value = todayStr;
    }

    pickupDateInput.addEventListener('change', () => {
      clearError();
      const pVal = pickupDateInput.value;
      if (pVal && returnDateInput) {
        returnDateInput.min = pVal;
        if (returnDateInput.value && returnDateInput.value < pVal) {
          // Auto advance return date if it is before new pickup date
          const newPickup = new Date(pVal + 'T00:00:00');
          returnDateInput.value = formatDate(addDays(newPickup, 1));
        }
      }
    });
  }

  if (returnDateInput) {
    returnDateInput.min = pickupDateInput ? (pickupDateInput.value || todayStr) : todayStr;
    if (!returnDateInput.value) {
      returnDateInput.value = tomorrowStr;
    }

    returnDateInput.addEventListener('change', () => {
      clearError();
    });
  }

  // Error messaging helpers
  function showError(msg) {
    if (searchErrorText) searchErrorText.textContent = msg;
    if (searchErrorEl) {
      searchErrorEl.classList.remove('hidden');
      searchErrorEl.setAttribute('role', 'alert');
    }
  }

  function clearError() {
    if (searchErrorEl) {
      searchErrorEl.classList.add('hidden');
      searchErrorEl.removeAttribute('role');
    }
  }

  // 2. Validate and Execute Search
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearError();

      const vehicleType = vehicleTypeSelect ? vehicleTypeSelect.value : 'all';
      const location = locationSelect ? locationSelect.value : 'Showroom & Campus Hub';
      const pickupDate = pickupDateInput ? pickupDateInput.value : '';
      const returnDate = returnDateInput ? returnDateInput.value : '';

      // Date Validation Rules
      if (!pickupDate) {
        showError('Please select a pickup date.');
        if (pickupDateInput) pickupDateInput.focus();
        return;
      }

      if (pickupDate < todayStr) {
        showError('Pickup date cannot be in the past.');
        if (pickupDateInput) pickupDateInput.focus();
        return;
      }

      if (!returnDate) {
        showError('Please select a return date.');
        if (returnDateInput) returnDateInput.focus();
        return;
      }

      if (returnDate < pickupDate) {
        showError('Return date cannot be earlier than the pickup date.');
        if (returnDateInput) returnDateInput.focus();
        return;
      }

      // Preserve search criteria in sessionStorage
      const searchPayload = {
        type: vehicleType,
        location: location,
        pickup: pickupDate,
        return: returnDate,
        timestamp: Date.now()
      };
      try {
        sessionStorage.setItem('ridezone_search', JSON.stringify(searchPayload));
      } catch (err) {
        console.warn('SessionStorage unavailable:', err);
      }

      // Build clean query string and navigate to /vehicles
      const queryParams = new URLSearchParams();
      if (vehicleType && vehicleType !== 'all') {
        queryParams.set('type', vehicleType);
      }
      if (location) {
        queryParams.set('location', location);
      }
      if (pickupDate) {
        queryParams.set('pickup', pickupDate);
      }
      if (returnDate) {
        queryParams.set('return', returnDate);
      }

      const targetUrl = `/vehicles?${queryParams.toString()}`;
      window.location.href = targetUrl;
    });
  }

  // Header quick search button
  if (headerSearchBtn) {
    headerSearchBtn.addEventListener('click', () => {
      if (searchForm) {
        searchForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (vehicleTypeSelect) vehicleTypeSelect.focus();
      } else {
        window.location.href = '/vehicles';
      }
    });
  }

  // 3. Grounded Fleet Statistics from Real Database API
  async function loadFleetStats() {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const vehicles = await res.json();
        if (Array.isArray(vehicles) && vehicles.length > 0 && vehicleCountStat) {
          vehicleCountStat.textContent = `${vehicles.length}`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic vehicle count for stats:', err);
    }
  }

  loadFleetStats();

  // 4. Highlight Active Navigation
  function updateNavIndicator() {
    const navLinks = document.querySelectorAll('.desktop-nav .nav-link');
    const path = window.location.pathname.toLowerCase();
    navLinks.forEach((link) => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const isHome = path === '/' || path === '' || path.includes('/screens/home') || path.endsWith('index.html');
      if (isHome && (href === '/' || href.includes('home') || href === '/index.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  updateNavIndicator();

  // ------------------------------------------------------------
  // 5. OUR PREMIUM COLLECTION (FEATURED VEHICLES CAROUSEL)
  // ------------------------------------------------------------
  const featuredTrack = document.getElementById('featuredCarouselTrack');
  const featuredPrevBtn = document.getElementById('featuredPrevBtn');
  const featuredNextBtn = document.getElementById('featuredNextBtn');
  const featuredErrorState = document.getElementById('featuredErrorState');
  const featuredRetryBtn = document.getElementById('featuredRetryBtn');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCategoryBadgeClass(category) {
    const cat = String(category || '').toLowerCase().trim();
    if (cat.includes('superbike')) return 'badge-cat-superbike';
    if (cat.includes('bike')) return 'badge-cat-bike';
    if (cat.includes('electric')) return 'badge-cat-electric';
    if (cat.includes('scooter')) return 'badge-cat-scooter';
    return 'badge-cat-default';
  }

  function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '/assets/hunter.png';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    return '/' + trimmed;
  }

  function updateArrowStates() {
    if (!featuredTrack || !featuredPrevBtn || !featuredNextBtn) return;
    const scrollLeft = featuredTrack.scrollLeft;
    const maxScroll = featuredTrack.scrollWidth - featuredTrack.clientWidth;
    
    // Disable prev if near the left start
    featuredPrevBtn.disabled = scrollLeft <= 4;
    
    // Disable next if near the right end or if content completely fits
    featuredNextBtn.disabled = maxScroll <= 4 || scrollLeft >= maxScroll - 4;
  }

  function getScrollStep() {
    if (!featuredTrack) return 300;
    const firstCard = featuredTrack.querySelector('.featured-card');
    if (firstCard) {
      // Scroll by 1-2 cards depending on visible track width
      const cardWidth = firstCard.offsetWidth + 20; // 20px gap
      if (featuredTrack.clientWidth > 900) {
        return cardWidth * 2;
      }
      return cardWidth;
    }
    return Math.max(260, featuredTrack.clientWidth * 0.75);
  }

  function renderFeaturedVehicles(vehicles) {
    if (!featuredTrack) return;

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      showFeaturedError('No featured vehicles available at this time.');
      return;
    }

    // Hide error state if previously shown
    if (featuredErrorState) {
      featuredErrorState.classList.add('hidden');
    }

    featuredTrack.innerHTML = vehicles.map((v) => {
      const isAvailable = (v.status === 'Active');
      const badgeClass = getCategoryBadgeClass(v.category);
      const imgSrc = normalizeImageUrl(v.image);
      const ratingHtml = (v.rating && !isNaN(Number(v.rating)))
        ? `<span class="featured-rating"><span class="featured-star-icon" aria-hidden="true">★</span> ${Number(v.rating).toFixed(1)}</span>`
        : '';
      
      const statusHtml = isAvailable
        ? `<span class="featured-availability status-available"><span class="status-dot" aria-hidden="true"></span> Available</span>`
        : `<span class="featured-availability status-unavailable"><span class="status-dot" aria-hidden="true"></span> Unavailable</span>`;

      return `
        <article class="featured-card" data-id="${v.id}" data-name="${escapeHtml(v.name)}">
          <div class="featured-card-visual">
            <span class="featured-category-badge ${badgeClass}">${escapeHtml(v.category || 'Vehicle').toUpperCase()}</span>
            <img src="${imgSrc}" alt="${escapeHtml(v.name)}" class="featured-card-img" loading="lazy" onerror="this.onerror=null;this.src='/assets/hunter.png';">
          </div>
          <div class="featured-card-body">
            <h3 class="featured-card-name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</h3>
            <div class="featured-card-meta">
              <div class="featured-card-price">
                ₹${escapeHtml(v.price)} <span class="featured-price-unit">/hour</span>
              </div>
              <div class="featured-card-status-rating">
                ${statusHtml}
                ${ratingHtml}
              </div>
            </div>
            <div class="featured-card-actions">
              <a href="/vehicle-details?id=${v.id}&v=${encodeURIComponent(v.name)}" class="featured-btn-details" aria-label="View details for ${escapeHtml(v.name)}">
                View Details
              </a>
              <button type="button" class="featured-btn-book" data-action="book" data-id="${v.id}" data-vname="${escapeHtml(v.name)}" ${!isAvailable ? 'disabled' : ''} aria-label="Book ${escapeHtml(v.name)} now">
                Book Now
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach booking triggers to Book Now buttons
    featuredTrack.querySelectorAll('.featured-btn-book').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vehicleId = btn.dataset.id;
        const vehicleName = btn.dataset.vname;
        if (typeof window.initiateBooking === 'function') {
          window.initiateBooking(vehicleId || vehicleName);
        } else if (typeof initiateBooking === 'function') {
          initiateBooking(vehicleId || vehicleName);
        } else {
          window.location.href = `/vehicle-details?id=${vehicleId}&book=true`;
        }
      });
    });

    // Initialize carousel buttons state
    updateArrowStates();
  }

  function showFeaturedError(msg) {
    if (featuredTrack) featuredTrack.innerHTML = '';
    if (featuredErrorState) {
      const msgEl = document.getElementById('featuredErrorMsg');
      if (msgEl && msg) msgEl.textContent = msg;
      featuredErrorState.classList.remove('hidden');
    }
  }

  async function loadFeaturedVehicles() {
    if (!featuredTrack) return;
    try {
      if (featuredErrorState) featuredErrorState.classList.add('hidden');
      const res = await fetch('/api/vehicles');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const vehicles = await res.json();
      if (Array.isArray(vehicles) && vehicles.length > 0) {
        renderFeaturedVehicles(vehicles);
      } else {
        showFeaturedError('No vehicles found in the fleet.');
      }
    } catch (err) {
      console.warn('Could not load featured vehicles:', err);
      showFeaturedError('Unable to load vehicles. Please try again.');
    }
  }

  // Setup Carousel Arrow Listeners
  if (featuredPrevBtn) {
    featuredPrevBtn.addEventListener('click', () => {
      if (!featuredTrack) return;
      const step = getScrollStep();
      featuredTrack.scrollBy({ left: -step, behavior: 'smooth' });
    });
  }

  if (featuredNextBtn) {
    featuredNextBtn.addEventListener('click', () => {
      if (!featuredTrack) return;
      const step = getScrollStep();
      featuredTrack.scrollBy({ left: step, behavior: 'smooth' });
    });
  }

  if (featuredTrack) {
    // Debounce scroll listener with requestAnimationFrame
    let ticking = false;
    featuredTrack.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateArrowStates();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // Keyboard arrow navigation
    featuredTrack.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        featuredTrack.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        featuredTrack.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
      }
    });

    window.addEventListener('resize', updateArrowStates);
  }

  if (featuredRetryBtn) {
    featuredRetryBtn.addEventListener('click', () => {
      // Re-insert skeleton placeholders and load
      if (featuredTrack) {
        featuredTrack.innerHTML = `
          <div class="featured-card-skeleton" aria-hidden="true"></div>
          <div class="featured-card-skeleton" aria-hidden="true"></div>
          <div class="featured-card-skeleton" aria-hidden="true"></div>
          <div class="featured-card-skeleton" aria-hidden="true"></div>
          <div class="featured-card-skeleton" aria-hidden="true"></div>
        `;
      }
      loadFeaturedVehicles();
    });
  }

  // Initial load
  loadFeaturedVehicles();

})();
