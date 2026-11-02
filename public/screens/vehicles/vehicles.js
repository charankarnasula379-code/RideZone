/**
 * ============================================================
 * RideZone Modular Vehicles Screen Search Integration
 * public/screens/vehicles/vehicles.js
 * ============================================================
 */

(function initRideZoneVehiclesSearchIntegration() {
  'use strict';

  function applySearchParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type') || '';
    const locationParam = urlParams.get('location') || '';
    const pickupParam = urlParams.get('pickup') || '';
    const returnParam = urlParams.get('return') || '';

    if (!typeParam && !locationParam && !pickupParam && !returnParam) {
      return;
    }

    const fleetGrid = document.querySelector('#fleetGrid');
    if (!fleetGrid) return;

    // 1. Display active search banner
    let bannerEl = document.querySelector('#searchActiveBanner');
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'searchActiveBanner';
      bannerEl.className = 'search-active-banner';
      fleetGrid.parentNode.insertBefore(bannerEl, fleetGrid);
    }

    let summaryText = 'Showing search results';
    if (typeParam && typeParam !== 'all') {
      summaryText += ` for <strong>${escapeHtml(typeParam)}</strong>`;
    }
    if (locationParam) {
      summaryText += ` • Location: <strong>${escapeHtml(locationParam)}</strong>`;
    }
    if (pickupParam) {
      summaryText += ` • Pickup: <strong>${escapeHtml(pickupParam)}</strong>`;
    }
    if (returnParam) {
      summaryText += ` • Return: <strong>${escapeHtml(returnParam)}</strong>`;
    }

    bannerEl.innerHTML = `
      <div class="search-active-banner-text">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <span>${summaryText}</span>
      </div>
      <button type="button" class="btn-clear-search-banner" id="btnClearSearchBanner">
        Clear Search & Show All
      </button>
    `;

    const clearBtn = bannerEl.querySelector('#btnClearSearchBanner');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        bannerEl.remove();
        history.replaceState(null, '', window.location.pathname);
        const catAll = document.querySelector('#catAll');
        if (catAll) {
          catAll.checked = true;
          catAll.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const quickPills = document.querySelectorAll('.quick-filter-pill');
        quickPills.forEach(p => {
          const isAll = p.dataset.category.toLowerCase() === 'all';
          p.classList.toggle('is-active', isAll);
          p.setAttribute('aria-pressed', isAll ? 'true' : 'false');
        });
      });
    }

    // 2. Pre-fill Pickup Date in Booking Modal if provided
    if (pickupParam) {
      const dateInput = document.querySelector('#bookingDateInput');
      if (dateInput) {
        dateInput.value = pickupParam;
      }
    }

    // 3. Category & Type Filter Application
    const normalizedType = typeParam.toLowerCase().trim();

    if (normalizedType.includes('bike')) {
      const catBike = document.querySelector('input[name="category"][value="Bike"]');
      const catAll = document.querySelector('#catAll');
      if (catAll) catAll.checked = false;
      if (catBike) {
        catBike.checked = true;
        catBike.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const quickPills = document.querySelectorAll('.quick-filter-pill');
      quickPills.forEach(p => {
        const isMatch = p.dataset.category.toLowerCase() === 'bike';
        p.classList.toggle('is-active', isMatch);
        p.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    } else if (normalizedType.includes('scooter')) {
      const catScooter = document.querySelector('input[name="category"][value="Scooter"]');
      const catAll = document.querySelector('#catAll');
      if (catAll) catAll.checked = false;
      if (catScooter) {
        catScooter.checked = true;
        catScooter.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const quickPills = document.querySelectorAll('.quick-filter-pill');
      quickPills.forEach(p => {
        const isMatch = p.dataset.category.toLowerCase() === 'scooter';
        p.classList.toggle('is-active', isMatch);
        p.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    } else if (normalizedType.includes('car')) {
      // Uncheck all categories and show polished Cars empty state
      document.querySelectorAll('input[name="category"]').forEach(cb => cb.checked = false);
      renderSpecialEmptyState(
        fleetGrid,
        '🚘',
        'No cars currently in fleet',
        'RideZone specializes in premium two-wheeler mobility (Bikes, Scooters, and Electric). Four-wheeler fleet expansion is coming soon! Browse our available high-performance bikes and scooters below.'
      );
    } else if (normalizedType.includes('jeep')) {
      // Uncheck all categories and show polished Jeeps empty state
      document.querySelectorAll('input[name="category"]').forEach(cb => cb.checked = false);
      renderSpecialEmptyState(
        fleetGrid,
        '🚙',
        'No jeeps currently in fleet',
        'RideZone specializes in premium two-wheeler mobility (Bikes, Scooters, and Electric). Adventure 4x4 vehicles are arriving in our next fleet release! Explore our adventure tourers and bikes in the meantime.'
      );
    }
  }

  function renderSpecialEmptyState(container, icon, title, description) {
    const resultsCountEl = document.querySelector('#fleetResultsCount');
    if (resultsCountEl) {
      resultsCountEl.innerHTML = '<span class="count-num">0</span> vehicles found';
    }

    container.innerHTML = `
      <div class="special-fleet-empty-state">
        <span class="special-empty-icon">${icon}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <button type="button" class="btn-reset-fleet-special" id="btnResetSpecialFilter">
          Explore Available Two-Wheelers →
        </button>
      </div>
    `;

    const resetBtn = container.querySelector('#btnResetSpecialFilter');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const bannerEl = document.querySelector('#searchActiveBanner');
        if (bannerEl) bannerEl.remove();
        history.replaceState(null, '', window.location.pathname);
        const catAll = document.querySelector('#catAll');
        if (catAll) {
          catAll.checked = true;
          catAll.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
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

  function waitForFleetReady(callback, maxAttempts = 40) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const fleetGrid = document.querySelector('#fleetGrid');
      const hasContent = fleetGrid && (fleetGrid.querySelectorAll('.vehicle-card').length > 0 || fleetGrid.querySelector('.fleet-empty-state'));
      if (hasContent || attempts >= maxAttempts) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  // Hook into initial load when fleet cards are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForFleetReady(applySearchParameters);
    });
  } else {
    waitForFleetReady(applySearchParameters);
  }

  // Also listen for popstate if user navigates back/forward
  window.addEventListener('popstate', () => {
    waitForFleetReady(applySearchParameters);
  });

})();

