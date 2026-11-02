// ============================================================
// RideZone - Frontend Client Script
// Final User-Side Implementation: Security Deposits, Cancellation, Edit Profile, Scroll Spy
// ============================================================

// Centralized HTML Sanitization (XSS Immunity)
function escapeHtml(unsafeStr) {
  if (unsafeStr === null || unsafeStr === undefined) return "";
  return String(unsafeStr)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Centralized Configuration (Single Authoritative Source of Truth)
const RIDEZONE_CONFIG = {
  deposits: {
    "Ather 450X": 1500,
    "Honda Activa 6G": 1000,
    "Suzuki Access 125": 1000,
    "Yamaha MT-15 V2": 2000,
    "Bajaj Pulsar NS200": 2000,
    "KTM RC 390": 3000,
    "Kawasaki Ninja 300": 3500,
    "default": 1000
  },
  cancellationFees: {
    "Ather 450X": 100,
    "Honda Activa 6G": 50,
    "Suzuki Access 125": 50,
    "Yamaha MT-15 V2": 150,
    "Bajaj Pulsar NS200": 150,
    "KTM RC 390": 300,
    "Kawasaki Ninja 300": 350,
    "default": 100
  },
  vehicleRegMap: {
    "Ather 450X": "TS 09 RZ 1001",
    "Honda Activa 6G": "TS 09 RZ 1002",
    "Suzuki Access 125": "TS 09 RZ 1003",
    "Yamaha MT-15 V2": "TS 09 RZ 1004",
    "Bajaj Pulsar NS200": "TS 09 RZ 1005",
    "KTM RC 390": "TS 09 RZ 1006",
    "Kawasaki Ninja 300": "TS 09 RZ 1007"
  }
};

const state = {
  vehicles: [],
  filter: "all",
  currentUser: null,
  selectedVehicle: null,
  pendingBookingData: null,
  pendingBookingVehicleName: null,
  selectedPaymentMethod: "UPI",
  // Calendar state
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: null,
  currentVehicleBookings: [],
  // User profile bookings cache
  userBookings: [],
  cancellingBookingId: null,
  // 360 Viewers
  hero360Viewer: null,
  details360Viewer: null
};

// Verified Technical Specifications & 3-Image Gallery Catalog
const vehicleSpecsData = {
  "Ather 450X": {
    images: ["/assets/ather.png", "/assets/ather-2.png", "/assets/ather-3.png"],
    description: "India's premier high-performance smart electric scooter featuring instant Warp mode acceleration, 7-inch touchscreen dashboard, and an intelligent IP67-rated battery system.",
    specs: [
      { label: "Motor Type", value: "Permanent Magnet (PMSM)" },
      { label: "Peak Power", value: "6.4 kW (8.58 bhp)" },
      { label: "Max Torque", value: "26 Nm (Instant)" },
      { label: "Transmission", value: "Automatic (Belt Drive)" },
      { label: "Battery Capacity", value: "3.7 kWh Lithium-ion" },
      { label: "TrueRange (Eco)", value: "111 km per charge" },
      { label: "Top Speed", value: "90 km/h" },
      { label: "Kerb Weight", value: "111.6 kg" },
      { label: "Braking System", value: "Front & Rear Disc + CBS" }
    ]
  },
  "Honda Activa 6G": {
    images: ["/assets/honda.png", "/assets/honda-2.png", "/assets/honda-3.png"],
    description: "India's most trusted daily commuter scooter, engineered with Honda's enhanced Smart Power (eSP) technology, silent ACG starter, and unmatched fuel efficiency.",
    specs: [
      { label: "Engine", value: "109.51 cc, 4-Stroke SI (eSP)" },
      { label: "Max Power", value: "7.79 bhp @ 8,000 rpm" },
      { label: "Max Torque", value: "8.90 Nm @ 5,500 rpm" },
      { label: "Transmission", value: "Automatic (V-Matic CVT)" },
      { label: "Fuel Tank", value: "5.3 Litres" },
      { label: "Top Speed", value: "85 km/h" },
      { label: "Kerb Weight", value: "106 kg" },
      { label: "Seat Height", value: "765 mm" },
      { label: "Braking System", value: "130 mm Drum with CBS" }
    ]
  },
  "Suzuki Access 125": {
    images: ["/assets/suzuki.png", "/assets/suzuki-2.png", "/assets/suzuki-3.png"],
    description: "A refined and comfortable 125cc scooter offering smooth Suzuki Eco Performance (SEP), chrome retro detailing, and class-leading underseat storage.",
    specs: [
      { label: "Engine", value: "124 cc, 4-Stroke 1-Cylinder" },
      { label: "Max Power", value: "8.7 PS @ 6,750 rpm" },
      { label: "Max Torque", value: "10.0 Nm @ 5,500 rpm" },
      { label: "Transmission", value: "Automatic (CVT)" },
      { label: "Fuel Tank", value: "5.0 Litres" },
      { label: "Top Speed", value: "90 km/h" },
      { label: "Kerb Weight", value: "103 kg" },
      { label: "Seat Height", value: "773 mm" },
      { label: "Braking System", value: "Front Disc / Rear Drum + CBS" }
    ]
  },
  "Yamaha MT-15 V2": {
    images: ["/assets/yamaha.png", "/assets/yamaha-2.png", "/assets/yamaha-3.png"],
    description: "The Dark Warrior naked streetfighter featuring Yamaha's high-revving R15-derived liquid-cooled engine with Variable Valve Actuation and inverted gold USD front forks.",
    specs: [
      { label: "Engine", value: "155 cc Liquid-Cooled SOHC VVA" },
      { label: "Max Power", value: "18.4 PS (18.1 bhp) @ 10k rpm" },
      { label: "Max Torque", value: "14.1 Nm @ 7,500 rpm" },
      { label: "Transmission", value: "6-Speed + Slipper Clutch" },
      { label: "Fuel Tank", value: "10.0 Litres" },
      { label: "Top Speed", value: "130 km/h" },
      { label: "Kerb Weight", value: "141 kg" },
      { label: "Seat Height", value: "810 mm" },
      { label: "Braking System", value: "Front & Rear Disc (Dual ABS)" }
    ]
  },
  "Bajaj Pulsar NS200": {
    images: ["/assets/bajaj.png", "/assets/bajaj-2.png", "/assets/bajaj-3.png"],
    description: "A muscular streetfighter built on a pressed steel perimeter frame, driven by a triple-spark 200cc liquid-cooled powerplant engineered for aggressive cornering and high performance.",
    specs: [
      { label: "Engine", value: "199.5 cc Liquid-Cooled 4V DTS-i" },
      { label: "Max Power", value: "24.5 PS (24.13 bhp) @ 9.75k rpm" },
      { label: "Max Torque", value: "18.74 Nm @ 8,000 rpm" },
      { label: "Transmission", value: "6-Speed Manual" },
      { label: "Fuel Tank", value: "12.0 Litres" },
      { label: "Top Speed", value: "136 km/h" },
      { label: "Kerb Weight", value: "158 kg" },
      { label: "Seat Height", value: "805 mm" },
      { label: "Braking System", value: "Front & Rear Petal Disc (Dual ABS)" }
    ]
  },
  "KTM RC 390": {
    images: ["/assets/ktm.png", "/assets/ktm-2.png", "/assets/ktm-3.png"],
    description: "A track-focused supersport engineered with Moto3 aerodynamic bodywork, ultra-lightweight trellis chassis, cornering ABS with Supermoto mode, and class-leading acceleration.",
    specs: [
      { label: "Engine", value: "373.27 cc Liquid-Cooled DOHC 4V" },
      { label: "Max Power", value: "43.5 PS (42.9 bhp) @ 9,000 rpm" },
      { label: "Max Torque", value: "37.0 Nm @ 7,000 rpm" },
      { label: "Transmission", value: "6-Speed + Quickshifter+" },
      { label: "Fuel Tank", value: "13.7 Litres" },
      { label: "Top Speed", value: "170 km/h" },
      { label: "Kerb Weight", value: "172 kg" },
      { label: "Seat Height", value: "824 mm" },
      { label: "Braking System", value: "320mm Radial Caliper + Cornering ABS" }
    ]
  },
  "Kawasaki Ninja 300": {
    images: ["/assets/kawasaki.png", "/assets/kawasaki-2.png", "/assets/kawasaki-3.png"],
    description: "A legendary twin-cylinder supersport motorcycle delivering ultra-smooth parallel-twin revs, race-inspired supersport fairings, dual-channel ABS, and exceptional highway stability.",
    specs: [
      { label: "Engine", value: "296 cc Liquid-Cooled Parallel Twin" },
      { label: "Max Power", value: "39.0 PS (38.4 bhp) @ 11,000 rpm" },
      { label: "Max Torque", value: "26.1 Nm @ 10,000 rpm" },
      { label: "Transmission", value: "6-Speed + Slipper Clutch" },
      { label: "Fuel Tank", value: "17.0 Litres" },
      { label: "Top Speed", value: "175 km/h" },
      { label: "Kerb Weight", value: "179 kg" },
      { label: "Seat Height", value: "785 mm" },
      { label: "Braking System", value: "Dual Petal Disc + Dual ABS" }
    ]
  },
  "Royal Enfield Hunter 350": {
    images: ["/assets/hunter.png", "/assets/hunter-2.png", "/assets/hunter-3.png"],
    description: "A stylish and agile modern roadster engineered on Royal Enfield's J-series 349cc engine platform, offering torquey urban response, comfortable upright ergonomics, and distinctive retro character.",
    specs: [
      { label: "Engine", value: "349.34 cc Single Cylinder 4-Stroke Air-Oil Cooled" },
      { label: "Max Power", value: "20.2 bhp @ 6,100 rpm" },
      { label: "Max Torque", value: "27.0 Nm @ 4,000 rpm" },
      { label: "Transmission", value: "5-Speed Manual" },
      { label: "Fuel Tank", value: "13.0 Litres" },
      { label: "Top Speed", value: "114 km/h" },
      { label: "Kerb Weight", value: "181 kg" },
      { label: "Seat Height", value: "790 mm" },
      { label: "Braking System", value: "Front 300mm / Rear 270mm Disc (Dual ABS)" }
    ]
  },
  "TVS Apache RR 310": {
    images: ["/assets/tvs.png", "/assets/tvs-2.png", "/assets/tvs-3.png"],
    description: "Track-honed supersport motorcycle engineered with reverse-inclined DOHC powertrain, race-tuned Bi-Directional Quickshifter, Michelin Road 5 tires, and 4 riding modes.",
    specs: [
      { label: "Engine", value: "312.2 cc SI 4-Stroke 4-Valve Liquid Cooled" },
      { label: "Max Power", value: "34.0 PS @ 9,700 rpm" },
      { label: "Max Torque", value: "27.3 Nm @ 7,700 rpm" },
      { label: "Transmission", value: "6-Speed + Slipper Clutch" },
      { label: "Fuel Tank", value: "11.0 Litres" },
      { label: "Top Speed", value: "160 km/h" },
      { label: "Kerb Weight", value: "174 kg" },
      { label: "Seat Height", value: "810 mm" },
      { label: "Braking System", value: "Front 300mm Petal / Rear 240mm Petal Disc (Dual ABS)" }
    ]
  }
};

/**
 * Dynamically extract and format vehicle specifications from MySQL API response
 */
function getVehicleSpecs(vehicle) {
  if (!vehicle) return [];
  if (vehicle.specs && typeof vehicle.specs === "object" && Object.keys(vehicle.specs).length > 0) {
    const labelMap = {
      motor_engine: "Engine / Motor",
      power: "Max Power",
      torque: "Max Torque",
      top_speed: "Top Speed",
      range_efficiency: "Mileage / Range",
      battery_capacity: "Fuel Tank / Battery",
      fuel_type: "Fuel Type",
      transmission: "Transmission",
      kerb_weight: "Kerb Weight",
      seat_height: "Seat Height",
      brakes: "Braking System",
      seating_capacity: "Seating Capacity"
    };
    return Object.entries(vehicle.specs)
      .filter(([_, val]) => val && String(val).trim() !== "")
      .map(([key, value]) => ({
        label: labelMap[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value: String(value)
      }));
  }
  if (vehicleSpecsData[vehicle.name] && vehicleSpecsData[vehicle.name].specs) {
    return vehicleSpecsData[vehicle.name].specs;
  }
  return [
    { label: "Category", value: vehicle.category || "Standard" },
    { label: "Hourly Rate", value: `₹${vehicle.price || 280}` },
    { label: "Fuel Type", value: vehicle.fuel_type || "Petrol" },
    { label: "Transmission", value: vehicle.transmission || "Manual" }
  ];
}

/**
 * Dynamically retrieve vehicle gallery images prioritizing MySQL database record
 */
function getVehicleGallery(vehicle) {
  if (!vehicle) return ["/assets/ather.png"];
  if (Array.isArray(vehicle.gallery) && vehicle.gallery.length > 0) {
    return vehicle.gallery;
  }
  if (vehicleSpecsData[vehicle.name] && vehicleSpecsData[vehicle.name].images) {
    return vehicleSpecsData[vehicle.name].images;
  }
  return [vehicle.image || "/assets/ather.png"];
}

/**
 * Dynamically retrieve vehicle overview description prioritizing MySQL database record
 */
function getVehicleDescription(vehicle) {
  if (!vehicle) return "Experience premium riding freedom with RideZone.";
  if (vehicle.description && vehicle.description.trim()) {
    return vehicle.description.trim();
  }
  if (vehicleSpecsData[vehicle.name] && vehicleSpecsData[vehicle.name].description) {
    return vehicleSpecsData[vehicle.name].description;
  }
  return `Experience verified riding freedom with the ${vehicle.name}. Reliable, inspected, and road-ready.`;
}

// DOM Element Selectors
const vehicleGrid = document.querySelector("#vehicleGrid");
const viewAllButton = document.querySelector("#viewAll");
const openAuthBtn = document.querySelector("#openAuth");

// Modals
const authModal = document.querySelector("#authModal");
const vehicleDetailsModal = document.querySelector("#vehicleDetailsModal");
const bookingModal = document.querySelector("#bookingModal");
const paymentModal = document.querySelector("#paymentModal");
const confirmationModal = document.querySelector("#confirmationModal");
const userProfileModal = document.querySelector("#userProfileModal");
const cancelBookingModal = document.querySelector("#cancelBookingModal");
const logoutModal = document.querySelector("#logoutModal");

// Auth Elements
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const tabLogin = document.querySelector("#tabLogin");
const tabRegister = document.querySelector("#tabRegister");
const authTitle = document.querySelector("#authTitle");
const authMessage = document.querySelector("#authMessage");

// Details Modal Elements
const detailsTitle = document.querySelector("#detailsTitle");
const detailsBadge = document.querySelector("#detailsBadge");
const detailsRatingNum = document.querySelector("#detailsRatingNum");
const detailsMainImage = document.querySelector("#detailsMainImage");
const galleryThumbs = document.querySelector("#galleryThumbs");
const specsList = document.querySelector("#specsList");
const detailsDescription = document.querySelector("#detailsDescription");
const detailsHourlyPrice = document.querySelector("#detailsHourlyPrice");
const detailsHalfDayPrice = document.querySelector("#detailsHalfDayPrice");
const detailsFullDayPrice = document.querySelector("#detailsFullDayPrice");
const detailsBookBtn = document.querySelector("#detailsBookBtn");

// Availability Calendar Elements
const calMonthLabel = document.querySelector("#calMonthLabel");
const calPrevMonth = document.querySelector("#calPrevMonth");
const calNextMonth = document.querySelector("#calNextMonth");
const calendarGrid = document.querySelector("#calendarGrid");
const calSelectedDateHint = document.querySelector("#calSelectedDateHint");

// Booking Elements
const bookingForm = document.querySelector("#bookingForm");
const bookingVehicleInput = document.querySelector("#bookingVehicleInput");
const bookingVehicleDisplay = document.querySelector("#bookingVehicleDisplay");
const bookingHoursInput = document.querySelector("#bookingHoursInput");
const bookingDateInput = document.querySelector("#bookingDateInput");
const bookingTimeInput = document.querySelector("#bookingTimeInput");
const bookingProceedBtn = document.querySelector("#bookingProceedBtn");
const bookingMessage = document.querySelector("#bookingMessage");
const durationPresets = document.querySelector("#durationPresets");
const summaryRate = document.querySelector("#summaryRate");
const summaryDuration = document.querySelector("#summaryDuration");
const summaryRentalAmount = document.querySelector("#summaryRentalAmount");
const summaryDepositAmount = document.querySelector("#summaryDepositAmount");
const summaryTotal = document.querySelector("#summaryTotal");

// Payment Elements
const payVehicleName = document.querySelector("#payVehicleName");
const paySchedule = document.querySelector("#paySchedule");
const payDuration = document.querySelector("#payDuration");
const payRentalAmount = document.querySelector("#payRentalAmount");
const payDepositAmount = document.querySelector("#payDepositAmount");
const payTotalAmount = document.querySelector("#payTotalAmount");
const paymentTabs = document.querySelector("#paymentTabs");
const upiForm = document.querySelector("#upiForm");
const cardForm = document.querySelector("#cardForm");
const netbankingForm = document.querySelector("#netbankingForm");
const paymentSubmitBtn = document.querySelector("#paymentSubmitBtn");
const paymentBackBtn = document.querySelector("#paymentBackBtn");
const paymentMessage = document.querySelector("#paymentMessage");

// Confirmation Elements
const confirmDetailsBox = document.querySelector("#confirmDetailsBox");
const confirmViewProfileBtn = document.querySelector("#confirmViewProfileBtn");

// Profile & Edit Profile Elements
const profileUserName = document.querySelector("#profileUserName");
const profileUserEmail = document.querySelector("#profileUserEmail");
const profileUserPhone = document.querySelector("#profileUserPhone");
const toggleEditProfileBtn = document.querySelector("#toggleEditProfileBtn");
const profileViewCard = document.querySelector("#profileViewCard");
const profileEditForm = document.querySelector("#profileEditForm");
const editProfileName = document.querySelector("#editProfileName");
const editProfileEmail = document.querySelector("#editProfileEmail");
const editProfilePhone = document.querySelector("#editProfilePhone");
const saveProfileBtn = document.querySelector("#saveProfileBtn");
const cancelEditProfileBtn = document.querySelector("#cancelEditProfileBtn");
const editProfileMessage = document.querySelector("#editProfileMessage");

// Active Rental & History
const activeRentalBox = document.querySelector("#activeRentalBox");
const bookingHistoryList = document.querySelector("#bookingHistoryList");
const profileLogoutBtn = document.querySelector("#profileLogoutBtn");
const confirmLogoutBtn = document.querySelector("#confirmLogoutBtn");

// Cancellation Modal Elements
const cancelBookingRef = document.querySelector("#cancelBookingRef");
const cancelVehicleName = document.querySelector("#cancelVehicleName");
const cancelPickupSchedule = document.querySelector("#cancelPickupSchedule");
const cancelRentalAmount = document.querySelector("#cancelRentalAmount");
const cancelFeeAmount = document.querySelector("#cancelFeeAmount");
const cancelRefundableRental = document.querySelector("#cancelRefundableRental");
const cancelDepositAmount = document.querySelector("#cancelDepositAmount");
const cancelTotalRefund = document.querySelector("#cancelTotalRefund");
const confirmCancelBtn = document.querySelector("#confirmCancelBtn");
const cancelMessage = document.querySelector("#cancelMessage");

// Common Elements
const toast = document.querySelector("#toast");
const menuButton = document.querySelector("#menuButton");
const desktopNav = document.querySelector("#desktopNav");

/**
 * Format date consistently as: 23 Aug 2026 · 10:00 AM
 */
function formatReadableDateTime(dateStr, timeStr) {
  if (!dateStr) return "N/A";
  try {
    const cleanDateStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const [year, month, day] = cleanDateStr.split("-").map(Number);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedDate = `${day} ${monthNames[month - 1]} ${year}`;

    if (!timeStr) return formattedDate;

    const [hourRaw, minuteRaw] = timeStr.split(":");
    let hours = Number(hourRaw);
    const minutes = minuteRaw || "00";
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    return `${formattedDate} · ${formattedTime}`;
  } catch (e) {
    return `${dateStr} ${timeStr || ""}`;
  }
}

/**
 * Format Short Booking Reference: RZ-XXXXXXXX
 */
function formatShortReference(rawId) {
  if (!rawId) return "RZ-00000000";
  if (rawId.startsWith("RZ-")) return rawId;
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `RZ-${cleanId.slice(0, 8)}`;
}

/**
 * Generate skeleton loading cards HTML
 */
function renderSkeletonCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="sk-image skeleton-pulse"></div>
      <div class="sk-title skeleton-pulse"></div>
      <div class="sk-text skeleton-pulse"></div>
      <div class="sk-price skeleton-pulse"></div>
      <div class="sk-btn skeleton-pulse"></div>
    </div>
  `).join("");
}

/**
 * Show skeleton loading in all vehicle grids on the current page
 */
function showLoadingSkeletons() {
  const featuredGrid = document.querySelector("#featuredGrid");
  if (featuredGrid) featuredGrid.innerHTML = renderSkeletonCards(3);
  
  const fleetGrid = document.querySelector("#fleetGrid");
  if (fleetGrid) fleetGrid.innerHTML = renderSkeletonCards(6);
  
  const vehicleGrid = document.querySelector("#vehicleGrid");
  if (vehicleGrid) vehicleGrid.innerHTML = renderSkeletonCards(4);
}

/**
 * Canonical image path normalizer
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "/assets/hunter.png";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return "/" + trimmed;
}

/**
 * Handle broken vehicle images gracefully with two-step fallback
 */
function handleImageError(imgEl, fallbackSrc) {
  if (!imgEl) return;
  imgEl.onerror = null;
  const targetFallback = fallbackSrc ? normalizeImageUrl(fallbackSrc) : "/assets/hunter.png";
  if (imgEl.src !== targetFallback && !imgEl.src.endsWith(targetFallback)) {
    imgEl.src = targetFallback;
    return;
  }
  imgEl.style.display = "none";
  if (imgEl.parentNode && !imgEl.parentNode.querySelector(".img-error-placeholder")) {
    const placeholder = document.createElement("div");
    placeholder.className = "img-error-placeholder";
    placeholder.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="m21 15-5-5L5 21"/>
      </svg>
      <span style="font-size:11.5px; margin-top:4px;">Vehicle Showcase</span>
    `;
    imgEl.parentNode.appendChild(placeholder);
  }
}

/**
 * Fetch vehicle dataset from the backend API and initialize appropriate page view
 */
async function loadVehicles() {
  // Show loading skeletons immediately
  showLoadingSkeletons();
  
  try {
    const response = await fetch("/api/vehicles");
    if (!response.ok) {
      throw new Error(`Failed to load vehicles (HTTP ${response.status})`);
    }

    state.vehicles = await response.json();

    // 1. If on fleet catalog page (vehicles.html)
    if (document.querySelector("#fleetGrid")) {
      renderFleetPage();
    }
    // 2. If on showroom home page (index.html)
    if (document.querySelector("#featuredGrid")) {
      renderFeaturedVehicles();
    }
    if (document.querySelector("#heroBikeImg")) {
      initHeroShowroom();
    }
    // 3. If on vehicle details page (vehicle-details.html)
    if (document.querySelector("#detailsPage") || document.querySelector("#detailsStageImg")) {
      renderDetailsPage();
    }
    // 4. If legacy vehicleGrid is present
    if (document.querySelector("#vehicleGrid")) {
      renderVehicles();
    }
  } catch (error) {
    console.error("Error loading vehicles:", error);
    const targetGrid = document.querySelector("#fleetGrid") || document.querySelector("#vehicleGrid") || document.querySelector("#featuredGrid");
    if (targetGrid) {
      targetGrid.innerHTML = `
        <div class="error-state">
          <p>Unable to load vehicles. ${escapeHtml(error.message)}</p>
          <button class="retry-btn" onclick="loadVehicles()">Try Again</button>
        </div>
      `;
    }
  }
}

/**
 * Check if customer is currently authenticated
 */
async function checkAuthSession() {
  const token = localStorage.getItem("ridezone_token");
  if (!token) {
    state.currentUser = null;
    updateAuthUI();
    return;
  }

  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      state.currentUser = data.user;
      updateAuthUI();
    } else {
      localStorage.removeItem("ridezone_token");
      state.currentUser = null;
      updateAuthUI();
    }
  } catch (err) {
    console.warn("Session verification warning:", err.message);
  }
}

function updateAuthUI() {
  const openAuthEl = document.querySelector("#openAuth");
  const openSignUpEl = document.querySelector("#openSignUp");

  if (state.currentUser) {
    const firstName = state.currentUser.name.split(" ")[0];
    if (openAuthEl) {
      openAuthEl.textContent = `Hi, ${firstName}`;
      openAuthEl.title = "View Customer Profile & Booking History";
    }
    if (openSignUpEl) {
      openSignUpEl.style.display = "none";
    }
  } else {
    if (openAuthEl) {
      openAuthEl.textContent = "Login";
      openAuthEl.title = "Sign In to RideZone";
    }
    if (openSignUpEl) {
      openSignUpEl.style.display = "inline-flex";
    }
  }
}

/**
 * Get CSS modifier class for vehicle category badges
 */
function getBadgeClass(category) {
  const cat = String(category).toLowerCase();
  if (cat.includes("electric")) return "electric";
  if (cat.includes("scooter")) return "scooter";
  if (cat.includes("high")) return "high-end";
  return "bike";
}

/**
 * Render vehicle cards dynamically into the grid
 */
function renderVehicles() {
  if (!vehicleGrid) return;
  const visibleVehicles =
    state.filter === "all"
      ? state.vehicles
      : state.vehicles.filter(
          (vehicle) =>
            vehicle.category.toLowerCase() === state.filter.toLowerCase()
        );

  if (visibleVehicles.length === 0) {
    vehicleGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
        <p style="color: #6E685E; font-size: 15px; font-weight: 600;">
          No vehicles available in category "${state.filter}".
        </p>
      </div>
    `;
    return;
  }

  vehicleGrid.innerHTML = visibleVehicles
    .map(
      (vehicle) => `
        <article class="vehicle-card" data-vehicle="${escapeHtml(vehicle.name)}">
          <!-- 1. Vehicle image -->
          <div class="vehicle-image-wrapper">
            <img
              src="${normalizeImageUrl(vehicle.image)}"
              alt="${escapeHtml(vehicle.name)}"
              loading="lazy"
              onerror="handleImageError(this, '${normalizeImageUrl(vehicle.image)}')"
            >
          </div>

          <!-- 2. Vehicle name + category badge -->
          <div class="vehicle-header-row">
            <h3 class="vehicle-title" title="${escapeHtml(vehicle.name)}">
              ${escapeHtml(vehicle.name)}
            </h3>
            <span class="badge ${getBadgeClass(vehicle.category)}">
              ${escapeHtml(vehicle.category).toUpperCase()}
            </span>
          </div>

          <!-- 3. Price + availability -->
          <div class="vehicle-meta">
            <div class="vehicle-price">
              ₹${vehicle.price}<span>/hour</span>
            </div>
            <div class="vehicle-meta-right">
              <span class="vehicle-availability">Available</span>
              <span class="vehicle-rating"><span class="star">★</span> ${vehicle.rating}</span>
            </div>
          </div>

          <!-- 4 & 5. Card Actions Hierarchy -->
          <div class="vehicle-card-actions">
            <!-- 4. Secondary action: View Details ↗ -->
            <button type="button" class="card-details-btn" data-action="details" aria-label="View Details for ${escapeHtml(vehicle.name)}">
              <span>View Details</span>
              <span class="arrow-icon">↗</span>
            </button>

            <!-- 5. Primary Gold action: Book Now / Reserve Vehicle -->
            <button type="button" class="primary-button card-book-btn" data-action="book" aria-label="Book ${escapeHtml(vehicle.name)} now">
              Book Now
            </button>
          </div>
        </article>
      `
    )
    .join("");

  // Attach click events to card and its action buttons
  document.querySelectorAll(".vehicle-card").forEach((card) => {
    const vName = card.dataset.vehicle;

    // Card background/body click opens vehicle details
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-book-btn") || e.target.closest("[data-action='book']")) {
        return;
      }
      openVehicleDetails(vName);
    });

    // Secondary action: View Details ↗
    const detailsBtn = card.querySelector(".card-details-btn");
    if (detailsBtn) {
      detailsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openVehicleDetails(vName);
      });
    }

    // Primary Gold action: Book Now / Reserve Vehicle
    const bookBtn = card.querySelector(".card-book-btn");
    if (bookBtn) {
      bookBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        initiateBooking(vName);
      });
    }
  });
}

/**
 * Initialize 3-column Hero Showroom Bike Rotation & Spec Card
 */
function initHeroShowroom() {
  const heroBikeImg = document.querySelector("#heroBikeImg");
  if (!heroBikeImg) return;

  const heroVehicle =
    (state.vehicles && state.vehicles.find((v) => v.name === "Royal Enfield Hunter 350")) ||
    (state.vehicles && state.vehicles.find((v) => v.name.toLowerCase().includes("hunter"))) ||
    (state.vehicles && state.vehicles[0]) || {
      id: 8,
      name: "Royal Enfield Hunter 350",
      category: "Bike",
      price: 320,
      rating: 4.9,
      image: "/assets/hunter.png",
      deposit_amount: 2000
    };

  // Dynamically populate hero spec card from real database vehicle record
  const heroSpecTitle = document.querySelector("#heroSpecTitle");
  if (heroSpecTitle) heroSpecTitle.textContent = heroVehicle.name;

  const heroSpecBadge = document.querySelector("#heroSpecBadge");
  if (heroSpecBadge) {
    heroSpecBadge.textContent = heroVehicle.category.toUpperCase();
    heroSpecBadge.className = `badge ${getBadgeClass(heroVehicle.category)}`;
  }

  const heroSpecPrice = document.querySelector("#heroSpecPrice");
  if (heroSpecPrice) heroSpecPrice.textContent = `₹${heroVehicle.price}`;

  const heroSpecDeposit = document.querySelector("#heroSpecDeposit");
  if (heroSpecDeposit) {
    const dep = Number(heroVehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[heroVehicle.name] || 2000;
    heroSpecDeposit.textContent = `₹${dep.toLocaleString("en-IN")}`;
  }

  const heroDepositNote = document.querySelector("#heroDepositNote");
  if (heroDepositNote) {
    const dep = Number(heroVehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[heroVehicle.name] || 2000;
    heroDepositNote.textContent = `₹${dep.toLocaleString("en-IN")}`;
  }

  // Populate dynamic engine/power/speed specs if present in vehicle record
  if (heroVehicle.specs && typeof heroVehicle.specs === "object") {
    const heroSpecMotor = document.querySelector("#heroSpecMotor");
    if (heroSpecMotor && (heroVehicle.specs["Engine"] || heroVehicle.specs["Motor Type"])) {
      heroSpecMotor.textContent = heroVehicle.specs["Engine"] || heroVehicle.specs["Motor Type"];
    }
    const heroSpecPower = document.querySelector("#heroSpecPower");
    if (heroSpecPower && (heroVehicle.specs["Max Power"] || heroVehicle.specs["Peak Power"])) {
      heroSpecPower.textContent = heroVehicle.specs["Max Power"] || heroVehicle.specs["Peak Power"];
    }
    const heroSpecSpeed = document.querySelector("#heroSpecSpeed");
    if (heroSpecSpeed && heroVehicle.specs["Top Speed"]) {
      heroSpecSpeed.textContent = heroVehicle.specs["Top Speed"];
    }
    const heroSpecRange = document.querySelector("#heroSpecRange");
    if (heroSpecRange && (heroVehicle.specs["Fuel Tank"] || heroVehicle.specs["TrueRange (Eco)"])) {
      heroSpecRange.textContent = heroVehicle.specs["Fuel Tank"] || heroVehicle.specs["TrueRange (Eco)"];
    }
  }

  // Initialize True 360° Vehicle Viewer on the hero pedestal
  if (typeof Vehicle360Viewer !== "undefined") {
    if (state.hero360Viewer) {
      state.hero360Viewer.destroy();
    }
    state.hero360Viewer = new Vehicle360Viewer(heroBikeImg, {
      vehicleId: heroVehicle.id,
      vehicleName: heroVehicle.name,
      fallbackImage: heroVehicle.image || "/assets/hunter.png",
      totalFrames: 36,
      assetBaseUrl: "/assets/360/",
      pixelsPerFrame: 10,
      introAutoRotate: true,
      introRotationSpeed: 48,
      introRotationLoops: 1,
      hintEl: document.querySelector("#hero360Hint")
    });
  }

  // Floating spec card book button
  const heroBookBtn = document.querySelector("#heroBookBtn");
  if (heroBookBtn) {
    heroBookBtn.onclick = () => {
      initiateBooking(heroVehicle.id || heroVehicle.name);
    };
  }
}

/**
 * Render exactly 3 Featured Vehicles on the Luxury Showroom Home Page
 */
function renderFeaturedVehicles() {
  const featuredContainer = document.querySelector("#featuredGrid");
  if (!featuredContainer) return;
  if (!state.vehicles || state.vehicles.length === 0) return;

  const featuredNames = ["KTM RC 390", "Bajaj Pulsar NS200", "Ather 450X"];
  const featuredVehicles = featuredNames
    .map((name) => state.vehicles.find((v) => v.name === name))
    .filter(Boolean);

  featuredContainer.innerHTML = featuredVehicles
    .map(
      (vehicle) => `
        <article class="vehicle-card" data-vehicle="${escapeHtml(vehicle.name)}" data-vehicle-id="${vehicle.id}">
          <div class="vehicle-image-wrapper">
            <img src="${normalizeImageUrl(vehicle.image)}" alt="${escapeHtml(vehicle.name)}" loading="lazy" onerror="handleImageError(this, '${normalizeImageUrl(vehicle.image)}')">
          </div>
          <div class="vehicle-header-row">
            <h3 class="vehicle-title" title="${escapeHtml(vehicle.name)}">${escapeHtml(vehicle.name)}</h3>
            <span class="badge ${getBadgeClass(vehicle.category)}">${escapeHtml(vehicle.category).toUpperCase()}</span>
          </div>
          <div class="vehicle-meta">
            <div class="vehicle-price">₹${vehicle.price}<span>/hour</span></div>
            <div class="vehicle-meta-right">
              <span class="vehicle-availability">${vehicle.status === "Active" ? "Available" : escapeHtml(vehicle.status)}</span>
              <span class="vehicle-rating"><span class="star">★</span> ${vehicle.rating}</span>
            </div>
          </div>
          <div class="vehicle-card-actions">
            <a href="/vehicle-details?id=${vehicle.id}&v=${encodeURIComponent(vehicle.name)}" class="card-details-btn" aria-label="View Details for ${escapeHtml(vehicle.name)}">
              <span>View Details</span>
              <span class="arrow-icon">↗</span>
            </a>
            <button type="button" class="primary-button card-book-btn" data-action="book" data-vname="${escapeHtml(vehicle.name)}" data-id="${vehicle.id}" aria-label="Book ${escapeHtml(vehicle.name)} now">
              Book Now
            </button>
          </div>
        </article>
      `
    )
    .join("");

  featuredContainer.querySelectorAll(".card-book-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      initiateBooking(btn.dataset.id || btn.dataset.vname);
    });
  });
}

/**
 * Render Fleet Page (vehicles.html) with Search, Make/Brand ordering, Quick Pills & filters
 */
function renderFleetPage() {
  const fleetGrid = document.querySelector("#fleetGrid");
  if (!fleetGrid) return;
  if (!state.vehicles || state.vehicles.length === 0) return;

  const searchInput = document.querySelector("#fleetSearchInput");
  const searchClearBtn = document.querySelector("#fleetSearchClearBtn");
  const quickFilterPills = document.querySelectorAll(".quick-filter-pill");
  const resultsCountEl = document.querySelector("#fleetResultsCount");
  const catCheckboxes = document.querySelectorAll('input[name="category"]');
  const brandCheckboxes = document.querySelectorAll('input[name="brand"]');
  const priceSlider = document.querySelector("#priceRangeSlider");
  const priceReadout = document.querySelector("#priceReadout");
  const sortSelect = document.querySelector("#fleetSortSelect");

  function matchesSearch(vehicle, rawQuery) {
    if (!rawQuery) return true;
    const cleanQuery = rawQuery.toLowerCase().trim();
    if (!cleanQuery) return true;

    const brand = (vehicle.brand || "").toLowerCase();
    const name = (vehicle.name || "").toLowerCase();
    const model = (vehicle.model || "").toLowerCase();
    const category = (vehicle.category || "").toLowerCase();
    const fuelType = (vehicle.fuel_type || "").toLowerCase();
    const desc = (vehicle.description || "").toLowerCase();
    const regNo = (vehicle.vehicle_reg_no || "").toLowerCase();

    // Combine all user-visible vehicle attributes into unified search target
    const combinedText = `${brand} ${name} ${model} ${category} ${fuelType} ${desc} ${regNo}`;

    // Token-based matching to support multi-word queries like "honda bike" or "ather 450x"
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    return tokens.every((token) => combinedText.includes(token));
  }

  function getSelectedCategories() {
    const checked = Array.from(catCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
    if (checked.includes("all") || checked.length === 0) return "all";
    return checked;
  }

  function getSelectedBrands() {
    const checked = Array.from(brandCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
    if (checked.includes("all") || checked.length === 0) return "all";
    return checked;
  }

  function updateResultCount(matchCount, totalCount) {
    if (!resultsCountEl) return;
    if (matchCount === totalCount) {
      resultsCountEl.innerHTML = `Showing all <span class="count-num">${matchCount}</span> vehicles`;
    } else if (matchCount > 0) {
      resultsCountEl.innerHTML = `Showing <span class="count-num">${matchCount}</span> of <span class="count-num">${totalCount}</span> vehicles`;
    } else {
      resultsCountEl.innerHTML = `<span class="count-num">0</span> vehicles found`;
    }
  }

  function syncQuickPillsFromCheckboxes() {
    if (!quickFilterPills || quickFilterPills.length === 0) return;
    const selected = getSelectedCategories();
    if (selected === "all" || (Array.isArray(selected) && selected.length !== 1)) {
      quickFilterPills.forEach((p) => {
        const isAll = p.dataset.category.toLowerCase() === "all";
        p.classList.toggle("is-active", isAll);
        p.setAttribute("aria-pressed", isAll ? "true" : "false");
      });
    } else if (Array.isArray(selected) && selected.length === 1) {
      const single = selected[0].toLowerCase();
      quickFilterPills.forEach((p) => {
        const match = p.dataset.category.toLowerCase() === single;
        p.classList.toggle("is-active", match);
        p.setAttribute("aria-pressed", match ? "true" : "false");
      });
    }
  }

  function resetAllSearchAndFilters() {
    // 1. Clear Search Query
    if (searchInput) {
      searchInput.value = "";
      if (searchClearBtn) searchClearBtn.style.display = "none";
    }

    // 2. Reset Categories to 'all'
    catCheckboxes.forEach((cb) => {
      cb.checked = cb.value === "all";
    });

    // 3. Reset Brands to 'all'
    brandCheckboxes.forEach((cb) => {
      cb.checked = cb.value === "all";
    });

    // 4. Reset Price Slider to max
    if (priceSlider) {
      priceSlider.value = priceSlider.max;
      if (priceReadout) priceReadout.textContent = `Up to ₹${priceSlider.value}`;
    }

    // 5. Reset Sort to Default
    if (sortSelect) {
      sortSelect.value = "default";
    }

    // 6. Sync Quick Pills and Re-filter
    syncQuickPillsFromCheckboxes();
    filterAndSortVehicles();
    if (searchInput) searchInput.focus();
  }

  function filterAndSortVehicles() {
    let list = [...state.vehicles];

    // 1. Search filter
    const query = searchInput ? searchInput.value : "";
    if (query && query.trim()) {
      list = list.filter((v) => matchesSearch(v, query));
    }

    // 2. Category filter
    const selectedCats = getSelectedCategories();
    if (selectedCats !== "all") {
      list = list.filter((v) =>
        selectedCats.some((cat) => cat.toLowerCase() === v.category.toLowerCase())
      );
    }

    // 3. Make / Brand filter
    const selectedBrands = getSelectedBrands();
    if (selectedBrands !== "all") {
      list = list.filter((v) => {
        const vBrand = (v.brand || v.name.split(" ")[0]).toLowerCase();
        return selectedBrands.some((b) => vBrand.includes(b.toLowerCase()) || v.name.toLowerCase().includes(b.toLowerCase()));
      });
    }

    // 4. Price slider filter
    if (priceSlider) {
      const maxPrice = Number(priceSlider.value);
      list = list.filter((v) => Number(v.price) <= maxPrice);
    }

    // 5. Sort order
    if (sortSelect) {
      const sortVal = sortSelect.value;
      if (sortVal === "default") {
        list.sort((a, b) => Number(a.id) - Number(b.id));
      } else if (sortVal === "brand-asc") {
        list.sort((a, b) => {
          const brandA = a.brand || a.name.split(" ")[0];
          const brandB = b.brand || b.name.split(" ")[0];
          return brandA.localeCompare(brandB) || a.name.localeCompare(b.name);
        });
      } else if (sortVal === "brand-desc") {
        list.sort((a, b) => {
          const brandA = a.brand || a.name.split(" ")[0];
          const brandB = b.brand || b.name.split(" ")[0];
          return brandB.localeCompare(brandA) || b.name.localeCompare(a.name);
        });
      } else if (sortVal === "price-asc") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (sortVal === "price-desc") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
      } else if (sortVal === "rating-desc") {
        list.sort((a, b) => Number(b.rating) - Number(a.rating));
      } else if (sortVal === "name-asc") {
        list.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortVal === "name-desc") {
        list.sort((a, b) => b.name.localeCompare(a.name));
      }
    }

    // 6. Update Result Count Badge
    updateResultCount(list.length, state.vehicles.length);

    // 7. Render fleet cards or empty state
    renderFleetCards(list);
  }

  function renderFleetCards(vehiclesToRender) {
    if (vehiclesToRender.length === 0) {
      fleetGrid.innerHTML = `
        <div class="empty-state fleet-empty-state">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <h3>No vehicles found</h3>
          <p>We couldn't find a vehicle matching your search or filters. Try adjusting your search query, category, or brand selections.</p>
          <button type="button" class="primary-button btn-clear-all-filters" id="fleetClearAllBtn">
            Clear Search & Filters
          </button>
        </div>
      `;

      const clearAllBtn = fleetGrid.querySelector("#fleetClearAllBtn");
      if (clearAllBtn) {
        clearAllBtn.addEventListener("click", resetAllSearchAndFilters);
      }
      return;
    }

    fleetGrid.innerHTML = vehiclesToRender
      .map(
        (vehicle) => {
          const brandName = vehicle.brand || vehicle.name.split(" ")[0];
          const isInactive = vehicle.status === "Inactive";
          return `
          <article class="vehicle-card ${isInactive ? "vehicle-inactive-card" : ""}" data-vehicle="${escapeHtml(vehicle.name)}" data-vehicle-id="${vehicle.id}">
            <div class="vehicle-image-wrapper">
              <img src="${normalizeImageUrl(vehicle.image)}" alt="${escapeHtml(vehicle.name)}" loading="lazy" onerror="handleImageError(this, '${normalizeImageUrl(vehicle.image)}')">
            </div>
            <div class="vehicle-header-row">
              <div>
                <span class="vehicle-card-brand-tag">${escapeHtml(brandName)}</span>
                <h3 class="vehicle-title" title="${escapeHtml(vehicle.name)}">${escapeHtml(vehicle.name)}</h3>
              </div>
              <span class="badge ${getBadgeClass(vehicle.category)}">${escapeHtml(vehicle.category).toUpperCase()}</span>
            </div>
            <div class="vehicle-meta">
              <div class="vehicle-price">₹${vehicle.price}<span>/hour</span></div>
              <div class="vehicle-meta-right">
                <span class="vehicle-availability ${isInactive ? "text-danger" : ""}">${isInactive ? "Unavailable" : "Available"}</span>
                <span class="vehicle-rating"><span class="star">★</span> ${vehicle.rating}</span>
              </div>
            </div>
            <div class="fleet-card-meta-row">
              <span>Deposit: ₹${(Number(vehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[vehicle.name] || 1000).toLocaleString("en-IN")}</span>
              <span>Reg: ${escapeHtml(vehicle.vehicle_reg_no || RIDEZONE_CONFIG.vehicleRegMap[vehicle.name] || "TS 09 RZ 1001")}</span>
            </div>
            <div class="vehicle-card-actions">
              <a href="/vehicle-details?id=${vehicle.id}&v=${encodeURIComponent(vehicle.name)}" class="card-details-btn" aria-label="View Details for ${escapeHtml(vehicle.name)}">
                <span>View Details</span>
                <span class="arrow-icon">↗</span>
              </a>
              <button type="button" class="primary-button card-book-btn" data-action="book" data-vname="${escapeHtml(vehicle.name)}" data-id="${vehicle.id}" ${isInactive ? "disabled" : ""} aria-label="Book ${escapeHtml(vehicle.name)} now">
                ${isInactive ? "Unavailable" : "Book Now"}
              </button>
            </div>
          </article>
        `;
        }
      )
      .join("");

    fleetGrid.querySelectorAll(".card-book-btn:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        initiateBooking(btn.dataset.id || btn.dataset.vname);
      });
    });
  }

  // 1. Search Input Event Listeners
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const hasText = searchInput.value.trim().length > 0;
      if (searchClearBtn) {
        searchClearBtn.style.display = hasText ? "inline-flex" : "none";
      }
      filterAndSortVehicles();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (searchInput.value) {
          searchInput.value = "";
          if (searchClearBtn) searchClearBtn.style.display = "none";
          filterAndSortVehicles();
        }
      }
    });
  }

  // 2. Search Clear Button (clears ONLY the search query)
  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchClearBtn.style.display = "none";
        searchInput.focus();
        filterAndSortVehicles();
      }
    });
  }

  // 3. Quick Category Filter Pills Click Listeners
  quickFilterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const targetCat = pill.dataset.category;
      if (targetCat.toLowerCase() === "all") {
        catCheckboxes.forEach((cb) => {
          cb.checked = cb.value === "all";
        });
      } else {
        catCheckboxes.forEach((cb) => {
          cb.checked = cb.value.toLowerCase() === targetCat.toLowerCase();
        });
      }
      syncQuickPillsFromCheckboxes();
      filterAndSortVehicles();
    });
  });

  // 4. Category checkbox event binding (sidebar)
  catCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.value === "all" && cb.checked) {
        catCheckboxes.forEach((other) => {
          if (other !== cb) other.checked = false;
        });
      } else if (cb.value !== "all" && cb.checked) {
        const catAll = document.querySelector("#catAll");
        if (catAll) catAll.checked = false;
      }
      syncQuickPillsFromCheckboxes();
      filterAndSortVehicles();
    });
  });

  // 5. Make / Brand checkbox event binding (sidebar)
  brandCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.value === "all" && cb.checked) {
        brandCheckboxes.forEach((other) => {
          if (other !== cb) other.checked = false;
        });
      } else if (cb.value !== "all" && cb.checked) {
        const makeAll = document.querySelector("#makeAll");
        if (makeAll) makeAll.checked = false;
      }
      filterAndSortVehicles();
    });
  });

  // 6. Price range slider event binding & dynamic bounds
  if (priceSlider && state.vehicles.length > 0) {
    const maxVehiclePrice = Math.max(...state.vehicles.map((v) => Number(v.price) || 0));
    const sliderMax = Math.max(1000, Math.ceil(maxVehiclePrice / 100) * 100);
    priceSlider.max = String(sliderMax);
    if (!priceSlider.value || Number(priceSlider.value) < maxVehiclePrice) {
      priceSlider.value = String(sliderMax);
    }
    if (priceReadout) priceReadout.textContent = `Up to ₹${priceSlider.value}`;

    priceSlider.addEventListener("input", () => {
      if (priceReadout) priceReadout.textContent = `Up to ₹${priceSlider.value}`;
      filterAndSortVehicles();
    });
  }

  // 7. Sort dropdown event binding
  if (sortSelect) {
    sortSelect.addEventListener("change", filterAndSortVehicles);
  }

  // Initial render
  syncQuickPillsFromCheckboxes();
  filterAndSortVehicles();
}

/**
 * Render Dedicated Vehicle Details Page (vehicle-details.html)
 */
async function renderDetailsPage() {
  const detailsPage = document.querySelector("#detailsPage");
  if (!detailsPage) return;

  const params = new URLSearchParams(window.location.search);
  let vehicle = null;
  const idParam = params.get("id");
  if (idParam && state.vehicles && state.vehicles.length > 0) {
    vehicle = state.vehicles.find((v) => String(v.id) === String(idParam));
  }
  const vName = params.get("v");
  if (!vehicle && vName && state.vehicles && state.vehicles.length > 0) {
    vehicle = state.vehicles.find((v) => v.name.toLowerCase() === vName.toLowerCase());
  }
  if (!vehicle) {
    vehicle = (state.vehicles && state.vehicles.length > 0) ? state.vehicles[0] : {
      id: 1,
      name: "Ather 450X",
      category: "Electric",
      price: 220,
      deposit_amount: 1000,
      rating: 4.8,
      image: "/assets/ather.png"
    };
  }

  state.selectedVehicle = vehicle;
  const vehicleDesc = getVehicleDescription(vehicle);
  const vehicleSpecs = getVehicleSpecs(vehicle);
  const vehicleGallery = getVehicleGallery(vehicle);

  // Update Breadcrumb & Header Meta
  const breadcrumbEl = document.querySelector("#detailsBreadcrumbVehicle");
  if (breadcrumbEl) breadcrumbEl.textContent = vehicle.name;

  const titleEl = document.querySelector("#detailsPageTitle");
  if (titleEl) titleEl.textContent = vehicle.name;

  const badgeEl = document.querySelector("#detailsPageBadge");
  if (badgeEl) {
    badgeEl.textContent = vehicle.category.toUpperCase();
    badgeEl.className = `badge ${getBadgeClass(vehicle.category)}`;
  }

  const regNoEl = document.querySelector("#detailsPageRegNo");
  if (regNoEl) regNoEl.textContent = vehicle.vehicle_reg_no || RIDEZONE_CONFIG.vehicleRegMap[vehicle.name] || "TS 09 RZ 1001";

  const ratingEl = document.querySelector("#detailsPageRatingNum");
  if (ratingEl) ratingEl.textContent = vehicle.rating;

  const descEl = document.querySelector("#detailsPageDesc");
  if (descEl) descEl.textContent = vehicleDesc;

  // Initialize True 360° Vehicle Viewer on details stage
  const stageImg = document.querySelector("#detailsStageImg");
  if (stageImg) {
    if (typeof Vehicle360Viewer !== "undefined") {
      if (state.details360Viewer) {
        state.details360Viewer.destroy();
      }
      state.details360Viewer = new Vehicle360Viewer(stageImg, {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        fallbackImage: vehicle.image || "/assets/ather.png",
        totalFrames: 36,
        assetBaseUrl: "/assets/360/",
        pixelsPerFrame: 10,
        introAutoRotate: true,
        introRotationSpeed: 48,
        introRotationLoops: 1,
        hintEl: document.querySelector("#details360Hint")
      });
    } else {
      stageImg.src = vehicle.image || "/assets/ather.png";
    }
  }

  // Pricing Tiers (Hourly, Half-day 6h, 24 Hours)
  const hourly = Number(vehicle.price);
  const halfDay = hourly * 6;
  const fullDay = hourly * 24;

  const hourlyEl = document.querySelector("#detailsPageHourlyRate");
  if (hourlyEl) hourlyEl.textContent = `₹${hourly}`;

  const halfDayEl = document.querySelector("#detailsPageHalfDayRate");
  if (halfDayEl) halfDayEl.textContent = `₹${halfDay.toLocaleString("en-IN")}`;

  const fullDayEl = document.querySelector("#detailsPageFullDayRate");
  if (fullDayEl) fullDayEl.textContent = `₹${fullDay.toLocaleString("en-IN")}`;

  // Deposit & Cancellation Fee (Zero fee within 1hr under 100% full refund policy)
  const deposit = Number(vehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[vehicle.name] || 1000;
  const cancelFee = 0;

  const depositEl = document.querySelector("#detailsPageDeposit");
  if (depositEl) depositEl.textContent = `₹${deposit.toLocaleString("en-IN")}`;

  const cancelFeeEl = document.querySelector("#detailsPageCancelFee");
  if (cancelFeeEl) cancelFeeEl.textContent = `₹${cancelFee}`;

  // Key Specifications Grid (Dynamic from MySQL API)
  const specsGrid = document.querySelector("#detailsPageSpecsGrid");
  if (specsGrid) {
    specsGrid.innerHTML = vehicleSpecs
      .map(
        (item) => `
          <div class="spec-key-pair">
            <span class="spec-k">${item.label}</span>
            <span class="spec-v">${item.value}</span>
          </div>
        `
      )
      .join("");
  }

  // Sticky Reserve Bar
  const barPriceEl = document.querySelector("#detailsBarPrice");
  if (barPriceEl) barPriceEl.textContent = `₹${hourly} / hour`;

  const reserveBtn = document.querySelector("#detailsReserveBtn");
  if (reserveBtn) {
    reserveBtn.onclick = () => initiateBooking(vehicle.id || vehicle.name);
  }

  // Load Real Availability from MySQL for this vehicle and render calendar
  await loadVehicleAvailability(vehicle.name);
  renderAvailabilityCalendar(state.calendarYear, state.calendarMonth);
}

// ------------------------------------------------------------
// AVAILABILITY CALENDAR CONTROLLER (MySQL Connected)
// ------------------------------------------------------------

/**
 * Fetch real booking records from MySQL for the viewed vehicle
 */
async function loadVehicleAvailability(vehicleName) {
  try {
    const response = await fetch(`/api/vehicles/${encodeURIComponent(vehicleName)}/availability`);
    if (response.ok) {
      const data = await response.json();
      state.currentVehicleBookings = data.bookings || [];
    } else {
      state.currentVehicleBookings = [];
    }
  } catch (err) {
    console.warn("Could not load vehicle availability:", err);
    state.currentVehicleBookings = [];
  }
}

/**
 * Check if a given calendar date (YYYY-MM-DD) is occupied by any MySQL booking
 */
function isDateOccupied(dateStr) {
  if (!state.currentVehicleBookings || state.currentVehicleBookings.length === 0) {
    return false;
  }

  const targetDate = new Date(`${dateStr}T00:00:00`);
  const targetDateEnd = new Date(`${dateStr}T23:59:59`);

  return state.currentVehicleBookings.some((b) => {
    const pDate = b.pickup_date ? (b.pickup_date.includes("T") ? b.pickup_date.split("T")[0] : b.pickup_date) : b.date;
    const pTime = b.pickup_time || "00:00:00";
    const start = new Date(`${pDate}T${pTime.length === 5 ? pTime + ":00" : pTime}`);
    const end = new Date(start.getTime() + (Number(b.hours) || 1) * 3600 * 1000);

    return start <= targetDateEnd && end >= targetDate;
  });
}

/**
 * Render the interactive monthly calendar
 */
function renderAvailabilityCalendar(year, month) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (calMonthLabel) {
    calMonthLabel.textContent = `${monthNames[month]} ${year}`;
  }

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = "";

  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div class="cal-day-cell empty"></div>`;
  }

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);

    const isPast = cellDate < today;
    const isToday = cellDate.getTime() === today.getTime();
    const isBooked = isDateOccupied(dateStr);
    const isSelected = state.selectedDate === dateStr;

    if (isPast || isBooked) {
      html += `
        <button type="button" class="cal-day-cell booked ${isToday ? "today" : ""}" 
                data-date="${dateStr}" 
                aria-disabled="true" 
                title="${isPast ? "Past Date" : "Vehicle Booked on this date"}">
          ${day}
        </button>
      `;
    } else {
      html += `
        <button type="button" class="cal-day-cell available ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}" 
                data-date="${dateStr}" 
                aria-label="Select ${day} ${monthNames[month]} ${year}">
          ${day}
        </button>
      `;
    }
  }

  calendarGrid.innerHTML = html;

  calendarGrid.querySelectorAll(".cal-day-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const dateStr = cell.dataset.date;
      if (cell.classList.contains("booked")) {
        showToast("Sorry, this vehicle is already booked for this date.");
        return;
      }

      state.selectedDate = dateStr;
      renderAvailabilityCalendar(state.calendarYear, state.calendarMonth);

      if (calSelectedDateHint) {
        calSelectedDateHint.textContent = `Selected: ${formatReadableDateTime(dateStr)}`;
      }
    });
  });
}

// Calendar Month Navigation
if (calPrevMonth) {
  calPrevMonth.addEventListener("click", () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
    renderAvailabilityCalendar(state.calendarYear, state.calendarMonth);
  });
}

if (calNextMonth) {
  calNextMonth.addEventListener("click", () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    }
    renderAvailabilityCalendar(state.calendarYear, state.calendarMonth);
  });
}

/**
 * Open Vehicle Details Experience
 */
async function openVehicleDetails(vehicleName) {
  // If vehicleDetailsModal is not present (or on multi-page showroom), navigate to dedicated vehicle details page
  if (!document.querySelector("#vehicleDetailsModal")) {
    window.location.href = `/vehicle-details?v=${encodeURIComponent(vehicleName)}`;
    return;
  }

  const vehicle = state.vehicles.find((v) => v.name === vehicleName) || state.vehicles[0];
  if (!vehicle) return;

  state.selectedVehicle = vehicle;
  const vehicleDesc = getVehicleDescription(vehicle);
  const vehicleSpecs = getVehicleSpecs(vehicle);
  const images = getVehicleGallery(vehicle);

  // Populate Header
  detailsTitle.textContent = vehicle.name;
  detailsBadge.textContent = vehicle.category.toUpperCase();
  detailsBadge.className = `badge ${getBadgeClass(vehicle.category)}`;
  detailsRatingNum.textContent = vehicle.rating;

  // Populate Main Image & Thumbnails
  detailsMainImage.src = images[0];
  detailsMainImage.alt = vehicle.name;

  galleryThumbs.innerHTML = images
    .map(
      (imgSrc, idx) => `
        <button type="button" class="gallery-thumb-btn ${idx === 0 ? "active" : ""}" data-img="${imgSrc}" aria-label="View angle ${idx + 1}">
          <img src="${imgSrc}" alt="${vehicle.name} view ${idx + 1}" loading="lazy">
        </button>
      `
    )
    .join("");

  galleryThumbs.querySelectorAll(".gallery-thumb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      galleryThumbs.querySelectorAll(".gallery-thumb-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      detailsMainImage.src = btn.dataset.img;
    });
  });

  // Populate Specifications Table
  specsList.innerHTML = vehicleSpecs
    .map(
      (item) => `
        <div class="spec-row">
          <dt class="spec-name">${item.label}</dt>
          <dd class="spec-value">${item.value}</dd>
        </div>
      `
    )
    .join("");

  // Populate Description
  detailsDescription.textContent = vehicleDesc;

  // Dynamic Pricing Breakdown (Half Day = 6h, 24 Hours = 24h)
  const hourly = Number(vehicle.price);
  const halfDay = hourly * 6;
  const fullDay = hourly * 24;

  detailsHourlyPrice.textContent = `₹${hourly}`;
  detailsHalfDayPrice.textContent = `₹${halfDay.toLocaleString("en-IN")}`;
  detailsFullDayPrice.textContent = `₹${fullDay.toLocaleString("en-IN")}`;

  // Default selected date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  state.selectedDate = tomorrow.toISOString().split("T")[0];
  state.calendarYear = tomorrow.getFullYear();
  state.calendarMonth = tomorrow.getMonth();

  if (calSelectedDateHint) {
    calSelectedDateHint.textContent = `Selected: ${formatReadableDateTime(state.selectedDate)}`;
  }

  // Load Real Availability from MySQL for this vehicle and render calendar
  await loadVehicleAvailability(vehicle.name);
  renderAvailabilityCalendar(state.calendarYear, state.calendarMonth);

  openModal(vehicleDetailsModal);
}

// "Book This Vehicle" action inside details modal
if (detailsBookBtn) {
  detailsBookBtn.addEventListener("click", () => {
    if (!state.selectedVehicle) return;

    const vehicleId = state.selectedVehicle.id;
    closeModal(vehicleDetailsModal);
    initiateBooking(vehicleId || state.selectedVehicle.name);
  });
}

/**
 * Initiate booking flow (checks authentication first, then opens reservation modal)
 */
function initiateBooking(vehicleIdentifier) {
  let vehicle = null;
  if (typeof vehicleIdentifier === "number" || /^\d+$/.test(String(vehicleIdentifier))) {
    vehicle = state.vehicles.find((v) => v.id === Number(vehicleIdentifier));
  }
  if (!vehicle && vehicleIdentifier) {
    vehicle = state.vehicles.find((v) => v.name.toLowerCase() === String(vehicleIdentifier).toLowerCase());
  }
  if (!vehicle) vehicle = state.selectedVehicle || state.vehicles[0];
  if (!vehicle) return;

  state.selectedVehicle = vehicle;

  if (!state.currentUser) {
    state.pendingBookingVehicleName = vehicle.id || vehicle.name;
    if (authMessage) authMessage.textContent = "Please log in to complete your vehicle reservation.";
    switchAuthTab("login");
    openModal(authModal);
  } else {
    openBooking(vehicle.id || vehicle.name);
  }
}

/**
 * Open Booking Modal (Reserve a Vehicle)
 */
function openBooking(vehicleIdentifier, isBackNav = false) {
  let vehicle = null;
  if (typeof vehicleIdentifier === "number" || /^\d+$/.test(String(vehicleIdentifier))) {
    vehicle = state.vehicles.find((v) => v.id === Number(vehicleIdentifier));
  }
  if (!vehicle && vehicleIdentifier) {
    vehicle = state.vehicles.find((v) => v.name.toLowerCase() === String(vehicleIdentifier).toLowerCase());
  }
  if (!vehicle) vehicle = state.selectedVehicle || state.vehicles[0];
  if (!vehicle) return;

  state.selectedVehicle = vehicle;

  if (bookingVehicleInput) bookingVehicleInput.value = vehicle.name;
  if (bookingVehicleDisplay) bookingVehicleDisplay.value = vehicle.name;

  if (isBackNav && state.pendingBookingData && state.pendingBookingData.vehicle === vehicle.name) {
    // Preserve selected dates, times, hours from pending booking
    if (bookingDateInput && state.pendingBookingData.date) {
      bookingDateInput.value = state.pendingBookingData.date;
    }
    if (bookingTimeInput && state.pendingBookingData.time) {
      bookingTimeInput.value = state.pendingBookingData.time;
    }
    if (bookingHoursInput && state.pendingBookingData.hours) {
      bookingHoursInput.value = String(state.pendingBookingData.hours);
    }
    // Preserve accepted conditions state
    const checkboxes = document.querySelectorAll(".rental-condition-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = !!state.pendingBookingData.conditionsAccepted;
    });
  } else {
    // Fresh booking initialization
    if (bookingDateInput) {
      bookingDateInput.value = state.selectedDate || new Date(Date.now() + 86400000).toISOString().split("T")[0];
    }
    if (bookingTimeInput) {
      bookingTimeInput.value = "10:00";
    }

    if (bookingHoursInput) bookingHoursInput.value = "2";
    if (durationPresets) {
      durationPresets.querySelectorAll(".duration-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === "custom");
      });
    }

    // Reset mandatory condition checkboxes
    const checkboxes = document.querySelectorAll(".rental-condition-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
  }

  updateBookingPriceSummary();
  updateProceedButtonState();

  if (bookingMessage) {
    bookingMessage.textContent = "";
    bookingMessage.className = "form-message";
  }

  const list = document.querySelector("#mandatoryConditionsList");
  if (list) list.classList.remove("has-error");

  openModal(bookingModal);
}

/**
 * Update Proceed to Payment Button state based on Mandatory Conditions
 */
function updateProceedButtonState() {
  const checkboxes = Array.from(document.querySelectorAll(".rental-condition-checkbox"));
  const allChecked = checkboxes.length > 0 && checkboxes.every((cb) => cb.checked);

  if (bookingProceedBtn) {
    bookingProceedBtn.disabled = !allChecked;
    bookingProceedBtn.classList.toggle("is-disabled", !allChecked);
    bookingProceedBtn.innerHTML = allChecked ? "Proceed to Payment &rarr;" : "Proceed to Payment";
  }

  const legacyTermsCb = document.querySelector("#termsAgreementCheckbox");
  if (legacyTermsCb) legacyTermsCb.checked = allChecked;

  checkboxes.forEach((cb) => {
    const row = cb.closest(".mandatory-condition-row");
    if (row) row.classList.toggle("is-checked", cb.checked);
  });

  if (allChecked) {
    if (bookingMessage && bookingMessage.textContent.includes("conditions")) {
      bookingMessage.textContent = "";
      bookingMessage.className = "form-message";
    }
    const list = document.querySelector("#mandatoryConditionsList");
    if (list) list.classList.remove("has-error");
  }
}

// Bind change listeners to all mandatory condition checkboxes
document.querySelectorAll(".rental-condition-checkbox").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    updateProceedButtonState();
  });
});

/**
 * Update Live Price Summary in Booking Modal
 */
function updateBookingPriceSummary() {
  if (!state.selectedVehicle) return;

  const hourlyPrice = Number(state.selectedVehicle.price) || 280;
  const deposit = Number(state.selectedVehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[state.selectedVehicle.name] || 1000;

  let hours = Number(bookingHoursInput.value) || 2;
  if (hours < 1) hours = 1;
  if (hours > 24) hours = 24;

  const rentalAmount = hourlyPrice * hours;
  const totalPayable = rentalAmount + deposit;

  if (summaryRate) summaryRate.textContent = `₹${hourlyPrice}/hr`;
  if (summaryDuration) summaryDuration.textContent = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (summaryRentalAmount) summaryRentalAmount.textContent = `₹${rentalAmount.toLocaleString("en-IN")}`;
  if (summaryDepositAmount) summaryDepositAmount.textContent = `₹${deposit.toLocaleString("en-IN")}`;
  if (summaryTotal) summaryTotal.textContent = `₹${totalPayable.toLocaleString("en-IN")}`;

  const policyDepositDisplay = document.querySelector("#policyDepositDisplay");
  if (policyDepositDisplay) {
    policyDepositDisplay.textContent = `₹${deposit.toLocaleString("en-IN")}`;
  }

  updateProceedButtonState();
}

// Duration Preset buttons listener
if (durationPresets) {
  durationPresets.querySelectorAll(".duration-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      durationPresets.querySelectorAll(".duration-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (btn.dataset.mode === "custom") {
        bookingHoursInput.value = "2";
      } else {
        bookingHoursInput.value = btn.dataset.hours;
      }
      updateBookingPriceSummary();
    });
  });
}

// Recalculate price on hours input change
if (bookingHoursInput) {
  bookingHoursInput.addEventListener("input", () => {
    if (durationPresets) {
      durationPresets.querySelectorAll(".duration-btn").forEach((b) => b.classList.remove("active"));
      const customBtn = durationPresets.querySelector('[data-mode="custom"]');
      if (customBtn) customBtn.classList.add("active");
    }
    updateBookingPriceSummary();
  });
}

// Booking Form Submit: Validates mandatory conditions and transitions to Payment Screen
if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!state.currentUser) {
      closeModal(bookingModal);
      switchAuthTab("login");
      openModal(authModal);
      return;
    }

    // Mandatory Rental Conditions Agreement Validation
    const checkboxes = Array.from(document.querySelectorAll(".rental-condition-checkbox"));
    const allChecked = checkboxes.length > 0 && checkboxes.every((cb) => cb.checked);
    if (!allChecked) {
      if (bookingMessage) {
        bookingMessage.textContent = "Please accept the required rental conditions before continuing.";
        bookingMessage.className = "form-message error";
      }
      const list = document.querySelector("#mandatoryConditionsList");
      if (list) list.classList.add("has-error");
      showToast("Please accept the required rental conditions before continuing.", true);

      const firstUnchecked = checkboxes.find((cb) => !cb.checked);
      if (firstUnchecked) firstUnchecked.focus();
      return;
    }

    const vehicleName = bookingVehicleInput.value;
    const vehicle = state.vehicles.find((v) => v.name === vehicleName) || state.selectedVehicle;
    if (!vehicle) return;

    const date = bookingDateInput.value;
    const time = bookingTimeInput.value;
    const hours = Number(bookingHoursInput.value) || 2;
    const rentalAmount = Number(vehicle.price) * hours;
    const depositAmount = Number(vehicle.deposit_amount) || RIDEZONE_CONFIG.deposits[vehicle.name] || 1000;
    const totalPayable = rentalAmount + depositAmount;

    state.pendingBookingData = {
      vehicle: vehicle.name,
      category: vehicle.category,
      date,
      time,
      hours,
      rentalPrice: rentalAmount,
      depositAmount,
      totalPrice: totalPayable,
      conditionsAccepted: true,
      termsAccepted: true
    };

    closeModal(bookingModal);
    openPayment(state.pendingBookingData);
  });
}

/**
 * Open Payment Screen
 */
function openPayment(bookingData) {
  if (!bookingData || !bookingData.conditionsAccepted) {
    showToast("Please accept the required rental conditions before continuing.", true);
    openBooking(bookingData ? bookingData.vehicle : null);
    return;
  }

  payVehicleName.textContent = bookingData.vehicle;
  paySchedule.textContent = formatReadableDateTime(bookingData.date, bookingData.time);
  payDuration.textContent = `${bookingData.hours} ${bookingData.hours === 1 ? "Hour" : "Hours"}`;
  payRentalAmount.textContent = `₹${bookingData.rentalPrice.toLocaleString("en-IN")}`;
  payDepositAmount.textContent = `₹${bookingData.depositAmount.toLocaleString("en-IN")}`;
  payTotalAmount.textContent = `₹${bookingData.totalPrice.toLocaleString("en-IN")}`;

  paymentSubmitBtn.textContent = `Pay ₹${bookingData.totalPrice.toLocaleString("en-IN")} (Demo)`;
  if (paymentMessage) paymentMessage.textContent = "";

  switchPaymentMethod("UPI");
  openModal(paymentModal);
}

function switchPaymentMethod(method) {
  state.selectedPaymentMethod = method;

  if (paymentTabs) {
    paymentTabs.querySelectorAll(".pay-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.method === method);
    });
  }

  if (upiForm) upiForm.classList.toggle("hidden", method !== "UPI");
  if (cardForm) cardForm.classList.toggle("hidden", method !== "Credit / Debit Card");
  if (netbankingForm) netbankingForm.classList.toggle("hidden", method !== "Net Banking");
}

if (paymentTabs) {
  paymentTabs.querySelectorAll(".pay-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchPaymentMethod(tab.dataset.method);
    });
  });
}

// Back to Booking Form from Payment (Preserves accepted conditions and form state)
if (paymentBackBtn) {
  paymentBackBtn.addEventListener("click", () => {
    closeModal(paymentModal);
    if (state.pendingBookingData) {
      openBooking(state.pendingBookingData.vehicle, true);
    }
  });
}

// Execute Demo Payment & Confirm Booking (with double click prevention)
if (paymentSubmitBtn) {
  paymentSubmitBtn.addEventListener("click", async () => {
    if (!state.pendingBookingData || !state.pendingBookingData.conditionsAccepted) {
      showToast("Please accept the required rental conditions before continuing.", true);
      return;
    }

    const token = localStorage.getItem("ridezone_token");
    if (!token) {
      closeModal(paymentModal);
      switchAuthTab("login");
      openModal(authModal);
      return;
    }

    // Double Submission Lock
    paymentSubmitBtn.disabled = true;
    paymentBackBtn.disabled = true;
    const originalText = paymentSubmitBtn.textContent;
    paymentSubmitBtn.textContent = "Processing Demo Payment...";

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const payload = {
        vehicle: state.pendingBookingData.vehicle,
        date: state.pendingBookingData.date,
        time: state.pendingBookingData.time,
        hours: state.pendingBookingData.hours,
        payment_method: state.selectedPaymentMethod,
        terms_accepted: true
      };

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Payment and reservation failed.");
      }

      closeModal(paymentModal);
      state.pendingBookingData = null;

      // Populate Verified Booking Confirmation Modal
      const b = result.booking;
      const shortRef = formatShortReference(b.id);
      const formattedSchedule = formatReadableDateTime(b.pickup_date || b.date, b.pickup_time || b.time);

      confirmDetailsBox.innerHTML = `
        <div class="confirm-row">
          <span class="confirm-label">Booking Reference</span>
          <span class="confirm-value confirm-ref">${shortRef}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Vehicle</span>
          <span class="confirm-value"><strong>${b.vehicle_name || b.vehicle}</strong></span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Vehicle Registration</span>
          <span class="confirm-value"><span class="confirm-ref">${b.vehicle_reg_no || "TS 09 RZ 1001"}</span></span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Pickup Date & Time</span>
          <span class="confirm-value">${formattedSchedule}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Rental Duration</span>
          <span class="confirm-value">${b.hours} ${b.hours === 1 ? "Hour" : "Hours"}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Rental Amount</span>
          <span class="confirm-value">₹${Number(b.rental_price || 0).toLocaleString("en-IN")}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Refundable Deposit</span>
          <span class="confirm-value">₹${Number(b.deposit_amount || 0).toLocaleString("en-IN")}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="confirm-row confirm-row-total">
          <span class="confirm-label">Total Amount Paid</span>
          <strong class="confirm-value confirm-price">₹${Number(b.total_price || b.total).toLocaleString("en-IN")}</strong>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Payment Method</span>
          <span class="confirm-value">${b.payment_method || "UPI"} (Paid)</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Customer</span>
          <span class="confirm-value">${b.customer_name || b.user_name}</span>
        </div>
      `;

      openModal(confirmationModal);
      showToast("Booking & Payment Confirmed!");
    } catch (error) {
      if (paymentMessage) paymentMessage.textContent = error.message;
      showToast(error.message);
    } finally {
      paymentSubmitBtn.disabled = false;
      paymentBackBtn.disabled = false;
      paymentSubmitBtn.textContent = originalText;
    }
  });
}

// "View in Profile" from Booking Confirmation
if (confirmViewProfileBtn) {
  confirmViewProfileBtn.addEventListener("click", () => {
    closeModal(confirmationModal);
    openUserProfile();
  });
}

// ------------------------------------------------------------
// CUSTOMER PROFILE & EDIT PROFILE CONTROLLER
// ------------------------------------------------------------

/**
 * Render Avatar for Current User
 */
function renderUserAvatar() {
  const avatarBox = document.querySelector("#profileAvatarBox");
  if (!avatarBox) return;

  if (state.currentUser && state.currentUser.profile_photo) {
    avatarBox.innerHTML = `<img src="${state.currentUser.profile_photo}" alt="${state.currentUser.name}">`;
  } else {
    avatarBox.innerHTML = `
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    `;
  }
}

/**
 * Open Customer Profile & Booking History Experience
 */
async function openUserProfile() {
  if (!state.currentUser) {
    switchAuthTab("login");
    openModal(authModal);
    return;
  }

  // Populate User Meta
  if (profileUserName) profileUserName.textContent = state.currentUser.name;
  if (profileUserEmail) profileUserEmail.textContent = state.currentUser.email;
  if (profileUserPhone) profileUserPhone.textContent = state.currentUser.phone || "+91 (Not Provided)";

  // Render User Avatar
  renderUserAvatar();

  // Reset Edit Mode to View Mode
  if (profileViewCard) profileViewCard.classList.remove("hidden");
  if (profileEditForm) profileEditForm.classList.add("hidden");
  if (toggleEditProfileBtn) toggleEditProfileBtn.textContent = "Edit Profile";
  if (editProfileMessage) editProfileMessage.textContent = "";

  // Fetch Customer's Bookings
  const token = localStorage.getItem("ridezone_token");
  try {
    const response = await fetch("/api/user/bookings", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      state.userBookings = data.bookings || [];
      renderUserProfileBookings(state.userBookings);
    } else {
      state.userBookings = [];
      renderUserProfileBookings([]);
    }
  } catch (err) {
    console.error("Error fetching user bookings:", err);
    state.userBookings = [];
    renderUserProfileBookings([]);
  }

  // Set default view to Upcoming / Active Rental tab
  switchAccountTab("upcoming");

  openModal(userProfileModal);
}

// Direct Avatar Photo Picker (#userProfilePhotoInput)
const userProfilePhotoInput = document.querySelector("#userProfilePhotoInput");
if (userProfilePhotoInput) {
  userProfilePhotoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const token = localStorage.getItem("ridezone_token");
    if (!token) return;

    showToast("Uploading profile photo from device...");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result, filename: file.name })
        });
        const uploadData = await uploadRes.json();
        const photoUrl = uploadData.url || reader.result;

        const updateRes = await fetch("/api/user/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: state.currentUser.name,
            email: state.currentUser.email,
            phone: state.currentUser.phone,
            profile_photo: photoUrl
          })
        });

        const updateResult = await updateRes.json();
        if (updateRes.ok) {
          localStorage.setItem("ridezone_token", updateResult.token);
          state.currentUser = updateResult.user;
          renderUserAvatar();
          updateAuthUI();
          showToast("Profile photo updated successfully!");
        } else {
          showToast(updateResult.error || "Failed to update profile photo.");
        }
      } catch (err) {
        showToast("Error uploading photo: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  });
}

// Edit Form Photo Picker (#editProfilePhotoInput)
const editProfilePhotoInput = document.querySelector("#editProfilePhotoInput");
const editProfilePhotoUrl = document.querySelector("#editProfilePhotoUrl");
const editProfilePhotoFileName = document.querySelector("#editProfilePhotoFileName");

if (editProfilePhotoInput) {
  editProfilePhotoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (editProfilePhotoFileName) editProfilePhotoFileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result, filename: file.name })
        });
        const uploadData = await uploadRes.json();
        if (editProfilePhotoUrl) {
          editProfilePhotoUrl.value = uploadData.url || reader.result;
        }
        showToast("Photo uploaded. Click 'Save Changes' to apply.");
      } catch (err) {
        if (editProfilePhotoUrl) editProfilePhotoUrl.value = reader.result;
      }
    };
    reader.readAsDataURL(file);
  });
}

// Toggle Edit Profile View
if (toggleEditProfileBtn) {
  toggleEditProfileBtn.addEventListener("click", () => {
    const isEditing = !profileEditForm.classList.contains("hidden");
    if (isEditing) {
      profileEditForm.classList.add("hidden");
      profileViewCard.classList.remove("hidden");
      toggleEditProfileBtn.textContent = "Edit Profile";
    } else {
      profileViewCard.classList.add("hidden");
      profileEditForm.classList.remove("hidden");
      toggleEditProfileBtn.textContent = "Cancel";

      if (editProfileName) editProfileName.value = state.currentUser.name || "";
      if (editProfileEmail) editProfileEmail.value = state.currentUser.email || "";
      if (editProfilePhone) editProfilePhone.value = state.currentUser.phone || "";
      if (editProfilePhotoUrl) editProfilePhotoUrl.value = state.currentUser.profile_photo || "";
      if (editProfilePhotoFileName) editProfilePhotoFileName.textContent = state.currentUser.profile_photo ? "Current photo attached" : "No photo selected";
      if (editProfileMessage) editProfileMessage.textContent = "";
    }
  });
}

if (cancelEditProfileBtn) {
  cancelEditProfileBtn.addEventListener("click", () => {
    profileEditForm.classList.add("hidden");
    profileViewCard.classList.remove("hidden");
    toggleEditProfileBtn.textContent = "Edit Profile";
  });
}

// Submit Profile Changes
if (profileEditForm) {
  profileEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("ridezone_token");
    if (!token) return;

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saving...";
    if (editProfileMessage) editProfileMessage.textContent = "";

    try {
      const payload = {
        name: editProfileName.value.trim(),
        email: editProfileEmail.value.trim(),
        phone: editProfilePhone.value.trim(),
        profile_photo: (editProfilePhotoUrl && editProfilePhotoUrl.value) ? editProfilePhotoUrl.value : (state.currentUser.profile_photo || null)
      };

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update profile.");
      }

      localStorage.setItem("ridezone_token", result.token);
      state.currentUser = result.user;
      updateAuthUI();
      renderUserAvatar();

      profileUserName.textContent = result.user.name;
      profileUserEmail.textContent = result.user.email;
      profileUserPhone.textContent = result.user.phone || "+91 (Not Provided)";

      profileEditForm.classList.add("hidden");
      profileViewCard.classList.remove("hidden");
      toggleEditProfileBtn.textContent = "Edit Profile";

      showToast("Profile updated successfully.");
    } catch (err) {
      if (editProfileMessage) editProfileMessage.textContent = err.message;
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = "Save Changes";
    }
  });
}

/**
 * Customer Account Tab Navigation Controller
 */
function switchAccountTab(targetTab) {
  const tabs = document.querySelectorAll(".account-nav-tab");
  const panels = document.querySelectorAll(".account-view-panel");

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === targetTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  panels.forEach((panel) => {
    const panelId = `account${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}View`;
    panel.classList.toggle("active", panel.id === panelId);
  });
}

// Attach Tab Navigation Event Listeners
document.querySelectorAll(".account-nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    switchAccountTab(tab.dataset.tab);
  });
});

/**
 * Render Bookings inside Customer Account with distinct Upcoming / Active and History Views
 */
function renderUserProfileBookings(bookings) {
  const now = new Date();

  // Helper to resolve vehicle image
  const getVehicleImg = (b) => {
    if (state.vehicles && state.vehicles.length > 0) {
      const matched = state.vehicles.find((v) => v.id === b.vehicle_id || v.name === b.vehicle_name);
      if (matched && matched.image) return normalizeImageUrl(matched.image);
    }
    return normalizeImageUrl(b.vehicle_image || "/assets/hunter.png");
  };

  // Filter 1: Upcoming / Active Rentals (Pending, Confirmed, Upcoming, Active)
  const upcomingBookings = bookings.filter((b) => {
    if (b.booking_status === "Cancelled" || b.booking_status === "Completed" || b.actual_return) {
      return false;
    }
    return b.booking_status === "Active" || b.booking_status === "Upcoming" || b.booking_status === "Confirmed" || b.booking_status === "Pending";
  });

  // Filter 2: Booking History (Completed, Cancelled)
  const historyBookings = bookings.filter((b) => {
    if (b.booking_status === "Cancelled" || b.booking_status === "Completed" || b.actual_return) {
      return true;
    }
    return false;
  });

  // Update dynamic count badges on tabs
  const upcomingTab = document.getElementById("accountTabUpcoming");
  const historyTab = document.getElementById("accountTabHistory");
  if (upcomingTab) {
    upcomingTab.innerHTML = `Upcoming / Active Rental <span class="tab-badge" style="font-size:11px; padding:2px 7px; border-radius:10px; background:var(--surface-soft); border:1px solid var(--line); margin-left:6px;">${upcomingBookings.length}</span>`;
  }
  if (historyTab) {
    historyTab.innerHTML = `Booking History <span class="tab-badge" style="font-size:11px; padding:2px 7px; border-radius:10px; background:var(--surface-soft); border:1px solid var(--line); margin-left:6px;">${historyBookings.length}</span>`;
  }

  // 1. Render Upcoming / Active Rentals View
  if (activeRentalBox) {
    if (upcomingBookings.length > 0) {
      activeRentalBox.innerHTML = upcomingBookings
        .map((b) => {
          const pDate = b.pickup_date ? (b.pickup_date.includes("T") ? b.pickup_date.split("T")[0] : b.pickup_date) : b.date;
          const pTime = b.pickup_time || "10:00:00";
          const start = new Date(`${pDate}T${pTime.length === 5 ? pTime + ":00" : pTime}`);
          const end = new Date(start.getTime() + (Number(b.hours) || 1) * 3600 * 1000);

          const createdAt = new Date(b.created_at || b.createdAt);
          const elapsedMs = now.getTime() - createdAt.getTime();
          const isWithinOneHour = elapsedMs >= 0 && elapsedMs < 3600 * 1000;
          const canCancel = now < start && isWithinOneHour && (b.booking_status === "Pending" || b.booking_status === "Confirmed" || b.booking_status === "Upcoming");

          let stateLabel = "Upcoming Booking";
          let stateClass = "state-upcoming";
          let statusNotice = "Scheduled for pickup at RideZone Showroom Hub.";

          if (b.booking_status === "Pending") {
            stateLabel = "Pending Confirmation";
            stateClass = "state-upcoming";
            statusNotice = "Booking submitted and awaiting admin confirmation.";
          } else if (b.booking_status === "Active") {
            stateLabel = "Active Rental";
            stateClass = "state-active";
            statusNotice = "Vehicle handed over. Return scheduled by expected time.";
          } else if (b.booking_status === "Confirmed") {
            stateLabel = "Confirmed Booking";
            stateClass = "state-upcoming";
            statusNotice = "Confirmed! Present booking reference at hub desk for pickup.";
          }

          const readablePickup = formatReadableDateTime(pDate, pTime);
          const returnDateStr = end.toISOString().split("T")[0];
          const returnTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
          const readableReturn = formatReadableDateTime(returnDateStr, returnTimeStr);
          const shortRef = formatShortReference(b.id);
          const imgUrl = getVehicleImg(b);

          return `
            <div class="upcoming-booking-card">
              <div class="upcoming-card-top">
                <div class="upcoming-thumb-wrap">
                  <img src="${imgUrl}" alt="${escapeHtml(b.vehicle_name)}" onerror="handleImageError(this, '/assets/hunter.png')">
                </div>
                <div class="upcoming-top-info">
                  <div class="upcoming-vehicle-title">${escapeHtml(b.vehicle_name)}</div>
                  <div class="upcoming-meta-badges">
                    <span class="booking-state-badge ${stateClass}">${stateLabel}</span>
                    <span class="active-reg-no">${escapeHtml(b.vehicle_reg_no || "TS 09 RZ 1001")}</span>
                  </div>
                </div>
              </div>

              <div style="font-size:12px; color:var(--text-secondary); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-xs); padding:8px 12px;">
                ${statusNotice}
              </div>

              <div class="upcoming-details-grid">
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Booking Reference</span>
                  <span class="upcoming-detail-val">${shortRef}</span>
                </div>
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Duration</span>
                  <span class="upcoming-detail-val">${b.hours} Hours</span>
                </div>
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Pickup Schedule</span>
                  <span class="upcoming-detail-val">${readablePickup}</span>
                </div>
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Expected Return</span>
                  <span class="upcoming-detail-val">${readableReturn}</span>
                </div>
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Rental Amount</span>
                  <span class="upcoming-detail-val">₹${Number(b.rental_price || (Number(b.total_price) - (Number(b.deposit_amount) || 1000))).toLocaleString("en-IN")} (${b.payment_status || "Paid"})</span>
                </div>
                <div class="upcoming-detail-cell">
                  <span class="upcoming-detail-label">Security Deposit</span>
                  <span class="upcoming-detail-val">₹${Number(b.deposit_amount || 1000).toLocaleString("en-IN")} (Refundable)</span>
                </div>
              </div>

              <div class="upcoming-card-footer">
                <div style="font-size: 11.5px; color: var(--text-secondary);">
                  ✓ Helmet & Fuel Inclusive &bull; Total Paid: ₹${Number(b.total_price).toLocaleString("en-IN")}
                </div>
                <div class="upcoming-card-actions">
                  <a href="/vehicle-details?id=${b.vehicle_id || 1}" class="btn-upcoming-details">View Details</a>
                  ${canCancel ? `<button type="button" class="cancel-trigger-btn" data-cancel-id="${b.id}">Cancel Booking</button>` : ""}
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      activeRentalBox.innerHTML = `
        <div class="account-empty-state">
          <div class="account-empty-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
            </svg>
          </div>
          <h3>No upcoming rentals</h3>
          <p>You have no active or upcoming motorcycle reservations.</p>
          <a href="/vehicles" class="primary-button empty-btn">Browse Fleet</a>
        </div>
      `;
    }
  }

  // 2. Render Booking History View
  if (bookingHistoryList) {
    if (historyBookings.length > 0) {
      bookingHistoryList.innerHTML = historyBookings
        .map((b) => {
          const pDate = b.pickup_date ? (b.pickup_date.includes("T") ? b.pickup_date.split("T")[0] : b.pickup_date) : b.date;
          const pTime = b.pickup_time || "10:00:00";
          const shortRef = formatShortReference(b.id);
          const readableSchedule = formatReadableDateTime(pDate, pTime);
          const isCancelled = b.booking_status === "Cancelled";
          const imgUrl = getVehicleImg(b);

          let cancelTagLabel = "Cancelled";
          if (b.cancelled_by === "Admin" || b.cancelled_by === "RideZone Admin") {
            cancelTagLabel = "Cancelled by RideZone Admin";
          } else if (b.cancelled_by === "Customer") {
            cancelTagLabel = "Cancelled by Customer";
          }

          return `
            <div class="history-item-card">
              <div class="history-thumb-wrap">
                <img src="${imgUrl}" alt="${escapeHtml(b.vehicle_name)}" onerror="handleImageError(this, '/assets/hunter.png')">
              </div>
              <div class="history-card-body">
                <div class="history-title-row">
                  <span class="history-vehicle-name">${escapeHtml(b.vehicle_name)}</span>
                  <span class="history-ref">${shortRef}</span>
                </div>
                <div class="history-meta-sub">
                  ${readableSchedule} · ${b.hours} Hours
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                  <span class="history-status-tag ${isCancelled ? "state-cancelled" : "state-completed"}">${isCancelled ? cancelTagLabel : "Completed"}</span>
                  <span class="history-price-tag">₹${Number(b.total_price).toLocaleString("en-IN")}</span>
                </div>
                ${isCancelled && (b.cancelled_by === "Admin" || b.cancelled_by === "RideZone Admin") ? `
                  <div class="customer-admin-cancel-notice" style="background:#FAF5E8; border:1px solid #EFE4BF; border-radius:8px; padding:12px 14px; margin-top:10px; font-size:12.5px; color:#6E5A18;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                      <strong style="color:#5C4304; font-size:13px; display:flex; align-items:center; gap:6px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="#D99800"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        RideZone Admin cancelled your booking.
                      </strong>
                      <span class="font-mono" style="font-size:11px; font-weight:700; color:#8A6508;">${shortRef}</span>
                    </div>
                    
                    <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                      <div>
                        <span style="font-weight:700; color:#5C4304;">Cancellation Reason:</span>
                        <span style="color:#1A1A1A; font-weight:600; margin-left:4px;">${escapeHtml(b.cancellation_reason || 'Vehicle unavailable')}</span>
                      </div>
                      ${b.cancellation_details ? `
                        <div style="margin-top:2px;">
                          <span style="font-weight:700; color:#5C4304;">Cancellation Details:</span>
                          <div style="color:#2B2518; background:#FFFBF2; padding:6px 10px; border-radius:4px; border:1px solid #EFE4BF; margin-top:3px; font-size:12px; line-height:1.4;">
                            ${escapeHtml(b.cancellation_details)}
                          </div>
                        </div>
                      ` : ''}
                      <div style="margin-top:4px; padding-top:4px; border-top:1px dashed #E6D6A8; font-size:11.5px; color:#5C4304;">
                        <strong>Refund:</strong> ₹${Number(b.refund_amount || b.total_price).toLocaleString("en-IN")} processed according to the applicable refund policy.
                      </div>
                    </div>
                  </div>
                ` : (isCancelled && b.cancelled_by === "Customer" ? `
                  <div style="background:#FDF0EE; border:1px solid #F8CCC5; border-radius:6px; padding:8px 10px; margin-top:8px; font-size:12px; color:#C0392B;">
                    <strong>Cancelled by you within 1-hour window.</strong>
                    <div style="font-size:11px; margin-top:2px;">
                      Refund of <strong>₹${Number(b.refund_amount || b.total_price).toLocaleString("en-IN")}</strong> processed to your account.
                    </div>
                  </div>
                ` : (isCancelled && b.refund_amount ? `<div style="font-size: 11px; color: #C0392B; margin-top: 2px;">Refund: ₹${Number(b.refund_amount).toLocaleString("en-IN")} processed</div>` : ""))}
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      bookingHistoryList.innerHTML = `
        <div class="account-empty-state">
          <div class="account-empty-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
          </div>
          <h3>No booking history yet</h3>
          <p>Your completed and historical rentals will appear here.</p>
          <a href="/vehicles" class="secondary-button empty-btn">Explore Fleet</a>
        </div>
      `;
    }
  }

  // Attach cancellation trigger listeners
  document.querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCancellationModal(btn.dataset.cancelId);
    });
  });
}

// ------------------------------------------------------------
// CANCELLATION MODAL CONTROLLER
// ------------------------------------------------------------

function openCancellationModal(bookingId) {
  const booking = state.userBookings.find((b) => b.id === bookingId);
  if (!booking) return;

  state.cancellingBookingId = bookingId;

  const createdAt = new Date(booking.created_at || booking.createdAt);
  const now = new Date();
  const elapsedMs = now.getTime() - createdAt.getTime();

  // Strict 1-Hour Verification Check from creation
  if (elapsedMs < 0 || elapsedMs >= 3600 * 1000) {
    showToast("Cancellation is available only within 1 hour of booking. This booking is no longer eligible for cancellation or refund.", true);
    return;
  }

  const pDate = booking.pickup_date ? (booking.pickup_date.includes("T") ? booking.pickup_date.split("T")[0] : booking.pickup_date) : booking.date;
  const pTime = booking.pickup_time || "10:00:00";

  const rentalAmount = Number(booking.rental_price) || 0;
  const depositAmount = Number(booking.deposit_amount) || 0;
  const cancelFee = 0; // ₹0 under final RideZone policy
  const refundableRental = rentalAmount;
  const totalRefund = rentalAmount + depositAmount;

  cancelBookingRef.textContent = formatShortReference(booking.id);
  cancelVehicleName.textContent = booking.vehicle_name;
  cancelPickupSchedule.textContent = formatReadableDateTime(pDate, pTime);
  cancelRentalAmount.textContent = `₹${rentalAmount.toLocaleString("en-IN")}`;
  cancelFeeAmount.textContent = "₹0";
  cancelRefundableRental.textContent = `₹${refundableRental.toLocaleString("en-IN")}`;
  cancelDepositAmount.textContent = `₹${depositAmount.toLocaleString("en-IN")}`;
  cancelTotalRefund.textContent = `₹${totalRefund.toLocaleString("en-IN")}`;

  if (cancelMessage) cancelMessage.textContent = "";
  openModal(cancelBookingModal);
}

// Confirm Booking Cancellation
if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener("click", async () => {
    if (!state.cancellingBookingId) return;

    const token = localStorage.getItem("ridezone_token");
    if (!token) return;

    confirmCancelBtn.disabled = true;
    confirmCancelBtn.textContent = "Processing Cancellation...";

    try {
      const response = await fetch(`/api/user/bookings/${state.cancellingBookingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to cancel booking.");
      }

      closeModal(cancelBookingModal);
      state.cancellingBookingId = null;

      // Reload user profile bookings
      await openUserProfile();
      showToast("Booking cancelled successfully. Refund processed.");
    } catch (err) {
      if (cancelMessage) cancelMessage.textContent = err.message;
      showToast(err.message);
    } finally {
      confirmCancelBtn.disabled = false;
      confirmCancelBtn.textContent = "Confirm Cancellation";
    }
  });
}

// Log Out Button in Profile Modal -> Opens Logout Confirmation Modal
if (profileLogoutBtn) {
  profileLogoutBtn.addEventListener("click", () => {
    closeModal(userProfileModal);
    openModal(logoutModal);
  });
}

// Confirm Logout Action
if (confirmLogoutBtn) {
  confirmLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("ridezone_token");
    state.currentUser = null;
    updateAuthUI();
    closeModal(logoutModal);
    showToast("Logged out successfully.");
  });
}

/**
 * Modal Management Helpers
 */
function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  if (modal.classList.contains("fullpage-screen")) {
    modal.scrollTop = 0;
  }
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");

  const modals = [
    authModal,
    bookingModal,
    vehicleDetailsModal,
    paymentModal,
    confirmationModal,
    userProfileModal,
    cancelBookingModal,
    logoutModal
  ];
  const anyOpen = modals.some((m) => m && !m.classList.contains("hidden"));
  if (!anyOpen) {
    document.body.style.overflow = "";
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

// Contextual Back Button Navigation for Full-Page Application Screens
document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.back;
    if (target === "booking") {
      closeModal(bookingModal);
    } else if (target === "payment") {
      closeModal(paymentModal);
      if (state.pendingBookingData) {
        openBooking(state.pendingBookingData.vehicle, true);
      }
    } else if (target === "confirm") {
      closeModal(confirmationModal);
      window.location.href = "/vehicles";
    } else if (target === "profile") {
      closeModal(userProfileModal);
    }
  });
});

// Done button on Confirmation screen
document.querySelectorAll(".confirm-done-btn").forEach((button) => {
  button.addEventListener("click", () => {
    closeModal(confirmationModal);
    window.location.href = "/vehicles";
  });
});

// ------------------------------------------------------------
// AUTHENTICATION TAB SWITCHING
// ------------------------------------------------------------

function switchAuthTab(mode) {
  if (authMessage) authMessage.textContent = "";
  if (mode === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    authTitle.textContent = "Login to RideZone";
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    authTitle.textContent = "Create Customer Account";
  }
}

if (tabLogin && tabRegister) {
  tabLogin.addEventListener("click", () => switchAuthTab("login"));
  tabRegister.addEventListener("click", () => switchAuthTab("register"));
}

// ------------------------------------------------------------
// NAVIGATION & SCROLL SPY
// ------------------------------------------------------------

// Header Account Button (Opens Profile or Auth Modal)
if (openAuthBtn) {
  openAuthBtn.addEventListener("click", () => {
    if (state.currentUser) {
      openUserProfile();
    } else {
      if (authMessage) authMessage.textContent = "";
      switchAuthTab("login");
      openModal(authModal);
    }
  });
}

const openSignUpBtn = document.querySelector("#openSignUp");
if (openSignUpBtn) {
  openSignUpBtn.addEventListener("click", () => {
    if (authMessage) authMessage.textContent = "";
    switchAuthTab("register");
    openModal(authModal);
  });
}

// Close modal buttons
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetModal = document.getElementById(button.dataset.close);
    if (targetModal) closeModal(targetModal);
  });
});

// Backdrop click closes popup modal (does not dismiss fullpage application screens)
document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal && !modal.classList.contains("fullpage-screen")) {
      closeModal(modal);
    }
  });
});

// Escape key closes open modals
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(authModal);
    closeModal(bookingModal);
    closeModal(vehicleDetailsModal);
    closeModal(paymentModal);
    closeModal(confirmationModal);
    closeModal(userProfileModal);
    closeModal(cancelBookingModal);
    closeModal(logoutModal);
  }
});

// Category filter buttons
document.querySelectorAll(".category-card").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    if (state.filter === filter) {
      state.filter = "all";
      button.classList.remove("selected");
    } else {
      document.querySelectorAll(".category-card").forEach((card) => {
        card.classList.remove("selected");
      });
      button.classList.add("selected");
      state.filter = filter;
    }

    renderVehicles();
    const vehSec = document.querySelector("#vehicles");
    if (vehSec) vehSec.scrollIntoView({ behavior: "smooth" });
  });
});

// View All Button
if (viewAllButton) {
  viewAllButton.addEventListener("click", () => {
    state.filter = "all";
    document.querySelectorAll(".category-card").forEach((card) => {
      card.classList.remove("selected");
    });
    renderVehicles();
    const vehSec = document.querySelector("#vehicles");
    if (vehSec) vehSec.scrollIntoView({ behavior: "smooth" });
  });
}

// Mobile menu toggle
if (menuButton && desktopNav) {
  menuButton.addEventListener("click", () => {
    desktopNav.classList.toggle("open");
  });

  desktopNav.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      desktopNav.classList.remove("open");
    });
  });
}

// Contact CTA button
const contactButton = document.querySelector("#contactButton");
if (contactButton) {
  contactButton.addEventListener("click", () => {
    openVehicleDetails(state.vehicles[0]?.name || "Ather 450X");
  });
}

// Contact Form submission (Demo feedback)
const contactForm = document.querySelector("#contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast("Thank you for reaching out! In this academic demo, your inquiry has been recorded.");
    contactForm.reset();
  });
}

// Highlight active nav link based on URL pathname
function highlightActiveNavLink() {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinksList = document.querySelectorAll(".desktop-nav .nav-link");

  navLinksList.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    link.classList.remove("active");

    if ((currentPath === "/" || currentPath === "" || currentPath.endsWith("/index.html")) && (href === "/" || href === "/index.html")) {
      link.classList.add("active");
    } else if (currentPath.includes("vehicle") && href.includes("vehicle")) {
      link.classList.add("active");
    } else if (currentPath.includes("how-it-works") && href.includes("how-it-works")) {
      link.classList.add("active");
    } else if (currentPath.includes("about") && href.includes("about")) {
      link.classList.add("active");
    } else if (currentPath.includes("contact") && href.includes("contact")) {
      link.classList.add("active");
    }
  });
}

// ------------------------------------------------------------
// FORM SUBMISSIONS
// ------------------------------------------------------------

// Unified Login Submission (Customer or Administrator)
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Login failed.");
      }

      // Role-based routing check (Automated Administrator Routing)
      if (result.role === "admin" || (result.user && result.user.role === "admin")) {
        localStorage.setItem("ridezone_admin_token", result.token);
        localStorage.setItem("ridezone_admin_user", JSON.stringify(result.user));
        loginForm.reset();
        closeModal(authModal);
        showToast(`Administrator authenticated. Routing to Admin Portal...`);
        setTimeout(() => {
          window.location.href = "/admin";
        }, 700);
        return;
      }

      // Standard Customer Authentication
      localStorage.setItem("ridezone_token", result.token);
      state.currentUser = result.user;
      updateAuthUI();

      loginForm.reset();
      closeModal(authModal);

      if (state.pendingBookingVehicleName) {
        const vName = state.pendingBookingVehicleName;
        state.pendingBookingVehicleName = null;
        showToast(`Welcome back, ${result.user.name.split(" ")[0]}! Proceeding to booking.`);
        setTimeout(() => openBooking(vName), 300);
      } else {
        showToast(result.message);
      }
    } catch (error) {
      if (authMessage) authMessage.textContent = error.message;
    }
  });
}

// Customer Register Submission
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(registerForm));

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Registration failed.");
      }

      localStorage.setItem("ridezone_token", result.token);
      state.currentUser = result.user;
      updateAuthUI();

      registerForm.reset();
      closeModal(authModal);

      if (state.pendingBookingVehicleName) {
        const vName = state.pendingBookingVehicleName;
        state.pendingBookingVehicleName = null;
        showToast(`Welcome, ${result.user.name.split(" ")[0]}! Proceeding to booking.`);
        setTimeout(() => openBooking(vName), 300);
      } else {
        showToast(result.message);
      }
    } catch (error) {
      if (authMessage) authMessage.textContent = error.message;
    }
  });
}

// Contact Form Submission Controller
const contactFormEl = document.getElementById("contactForm");
if (contactFormEl) {
  contactFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("contactName");
    const emailInput = document.getElementById("contactEmail");
    const subjectInput = document.getElementById("contactSubject");
    const messageInput = document.getElementById("contactMessage");
    const msgEl = document.getElementById("contactFormMessage");
    const submitBtn = document.getElementById("contactSubmitBtn");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const subject = subjectInput ? subjectInput.value.trim() : "";
    const message = messageInput ? messageInput.value.trim() : "";

    if (msgEl) {
      msgEl.textContent = "";
      msgEl.className = "form-message hidden";
      msgEl.style = "";
    }

    if (!name || !email || !subject || !message) {
      if (msgEl) {
        msgEl.textContent = "Please fill in all required fields.";
        msgEl.style.cssText = "font-size:13.5px; padding:10px 14px; border-radius:6px; margin-top:4px; background:#FDF2F2; color:#B3261E; border:1px solid #F8CCC5;";
        msgEl.classList.remove("hidden");
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      const btnText = submitBtn.querySelector(".btn-text");
      if (btnText) btnText.textContent = "Sending Message...";
      const spinner = submitBtn.querySelector(".btn-spinner");
      if (spinner) spinner.classList.remove("hidden");
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send message. Please try again.");
      }

      if (msgEl) {
        msgEl.textContent = data.message || "Thank you! Your message has been sent successfully.";
        msgEl.style.cssText = "font-size:13.5px; padding:10px 14px; border-radius:6px; margin-top:4px; background:#EBF5ED; color:#1A7032; border:1px solid #CBEAD2;";
        msgEl.classList.remove("hidden");
      }
      showToast("Thank you! Your message has been sent.");
      contactFormEl.reset();
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = err.message;
        msgEl.style.cssText = "font-size:13.5px; padding:10px 14px; border-radius:6px; margin-top:4px; background:#FDF2F2; color:#B3261E; border:1px solid #F8CCC5;";
        msgEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const btnText = submitBtn.querySelector(".btn-text");
        if (btnText) btnText.textContent = "Send Message \u2192";
        const spinner = submitBtn.querySelector(".btn-spinner");
        if (spinner) spinner.classList.add("hidden");
      }
    }
  });
}

// Initialize on page load
highlightActiveNavLink();
loadVehicles();
checkAuthSession();

// Automatic Auth Modal Trigger via URL Query Params (?auth=login / ?auth=signup)
const urlParams = new URLSearchParams(window.location.search);
const authAction = urlParams.get("auth");
if (authAction === "login" || authAction === "signin") {
  setTimeout(() => {
    switchAuthTab("login");
    openModal(authModal);
  }, 100);
} else if (authAction === "signup" || authAction === "register") {
  setTimeout(() => {
    switchAuthTab("register");
    openModal(authModal);
  }, 100);
}

// Header Scroll state management
const siteHeaderEl = document.querySelector(".site-header");
if (siteHeaderEl) {
  const handleScroll = () => {
    if (window.scrollY > 20) {
      siteHeaderEl.classList.add("scrolled");
    } else {
      siteHeaderEl.classList.remove("scrolled");
    }
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}
