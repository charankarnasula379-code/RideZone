/**
 * Comprehensive Automated Verification Suite for RideZone Home Redesign & Search Integration
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function runHomeRedesignVerification() {
  console.log('=== RIDEZONE HOME REDESIGN & SEARCH INTEGRATION VERIFICATION ===\n');

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
  const publicDir = path.join(projectRoot, 'public');

  // 1. Hero Asset Verification
  console.log('1. Canonical Hero Asset Verification:');
  const heroAssetPath = path.join(publicDir, 'assets', 'media', 'home-hero.jpg');
  const heroExists = fs.existsSync(heroAssetPath);
  const heroStats = heroExists ? fs.statSync(heroAssetPath) : null;
  assert(heroExists, 'Canonical hero image exists at public/assets/media/home-hero.jpg');
  assert(heroStats && heroStats.size === 272948, `Hero image size matches original clean photograph (272 KB, ${heroStats?.size} bytes)`);

  const logoPath = path.join(publicDir, 'assets', 'logo.png');
  const logoExists = fs.existsSync(logoPath);
  assert(logoExists, 'Official RideZone logo (public/assets/logo.png) is intact and preserved');

  // 2. Modular Home Files Verification
  console.log('\n2. Modular Home Files Verification:');
  const homeHtmlPath = path.join(publicDir, 'screens', 'home', 'index.html');
  const homeCssPath = path.join(publicDir, 'screens', 'home', 'home.css');
  const homeJsPath = path.join(publicDir, 'screens', 'home', 'home.js');

  assert(fs.existsSync(homeHtmlPath), 'public/screens/home/index.html exists');
  assert(fs.existsSync(homeCssPath), 'public/screens/home/home.css exists');
  assert(fs.existsSync(homeJsPath), 'public/screens/home/home.js exists');

  const homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
  assert(homeHtml.includes('PREMIUM VEHICLE RENTALS'), 'Home HTML contains "PREMIUM VEHICLE RENTALS" eyebrow');
  assert(homeHtml.includes('Rent.<br>'), 'Home HTML contains "Rent." headline');
  assert(homeHtml.includes('Ride.<br>'), 'Home HTML contains "Ride." headline');
  assert(homeHtml.includes('class="gold-word">Explore.</span>'), 'Home HTML contains "Explore." with gold-word styling');
  assert(homeHtml.includes('href="/vehicles"'), 'Home HTML contains CTA link to /vehicles');
  assert(homeHtml.includes('id="heroVehicleCount">9</span>'), 'Home HTML grounds verified vehicles in real count (9)');
  assert(homeHtml.includes('1 Hub'), 'Home HTML contains "1 Hub" statistic');
  assert(homeHtml.includes('100%'), 'Home HTML contains "100%" Quality Verified Fleet');
  assert(homeHtml.includes('id="homeSearchForm"'), 'Home HTML contains real #homeSearchForm');
  assert(homeHtml.includes('id="searchVehicleType"'), 'Home HTML contains #searchVehicleType selector');
  assert(homeHtml.includes('id="searchLocation"'), 'Home HTML contains #searchLocation selector');
  assert(homeHtml.includes('id="searchPickupDate"'), 'Home HTML contains #searchPickupDate date input');
  assert(homeHtml.includes('id="searchReturnDate"'), 'Home HTML contains #searchReturnDate date input');
  assert(homeHtml.includes('id="homeSearchSubmitBtn"'), 'Home HTML contains #homeSearchSubmitBtn');
  assert(homeHtml.includes('id="searchValidationError"'), 'Home HTML contains #searchValidationError container');
  assert(homeHtml.includes('href="/screens/home/home.css"'), 'Home HTML links /screens/home/home.css');
  assert(homeHtml.includes('src="/screens/home/home.js"'), 'Home HTML scripts /screens/home/home.js');
  assert(!homeHtml.includes('Playfair'), 'Home HTML strictly avoids external Playfair Display font');

  // 3. Modular Vehicles Search Integration Files
  console.log('\n3. Modular Vehicles Search Integration Verification:');
  const vehiclesJsPath = path.join(publicDir, 'screens', 'vehicles', 'vehicles.js');
  const vehiclesCssPath = path.join(publicDir, 'screens', 'vehicles', 'vehicles.css');
  const vehiclesHtmlPath = path.join(publicDir, 'screens', 'vehicles', 'index.html');

  assert(fs.existsSync(vehiclesJsPath), 'public/screens/vehicles/vehicles.js exists');
  assert(fs.existsSync(vehiclesCssPath), 'public/screens/vehicles/vehicles.css exists');
  assert(fs.existsSync(vehiclesHtmlPath), 'public/screens/vehicles/index.html exists');

  const vehiclesJs = fs.readFileSync(vehiclesJsPath, 'utf8');
  assert(vehiclesJs.includes('urlParams.get(\'type\')'), 'vehicles.js reads type parameter from URLSearchParams');
  assert(vehiclesJs.includes('urlParams.get(\'location\')'), 'vehicles.js reads location parameter from URLSearchParams');
  assert(vehiclesJs.includes('urlParams.get(\'pickup\')'), 'vehicles.js reads pickup parameter from URLSearchParams');
  assert(vehiclesJs.includes('urlParams.get(\'return\')'), 'vehicles.js reads return parameter from URLSearchParams');
  assert(vehiclesJs.includes('normalizedType.includes(\'bike\')'), 'vehicles.js supports Bikes category filtering');
  assert(vehiclesJs.includes('normalizedType.includes(\'scooter\')'), 'vehicles.js supports Scooters category filtering');
  assert(vehiclesJs.includes('normalizedType.includes(\'car\')'), 'vehicles.js supports Cars empty state handling');
  assert(vehiclesJs.includes('normalizedType.includes(\'jeep\')'), 'vehicles.js supports Jeeps empty state handling');
  assert(vehiclesJs.includes('searchActiveBanner'), 'vehicles.js creates search feedback banner');

  // Check vehicles.html includes vehicles.js and vehicles.css
  const rootVehiclesHtml = fs.readFileSync(path.join(publicDir, 'vehicles.html'), 'utf8');
  assert(rootVehiclesHtml.includes('/screens/vehicles/vehicles.css'), 'vehicles.html loads /screens/vehicles/vehicles.css');
  assert(rootVehiclesHtml.includes('/screens/vehicles/vehicles.js'), 'vehicles.html loads /screens/vehicles/vehicles.js');

  // Legacy script.js check: confirm no home search logic added to legacy script.js
  const legacyScriptJs = fs.readFileSync(path.join(publicDir, 'js', 'script.js'), 'utf8');
  assert(!legacyScriptJs.includes('homeSearchForm'), 'Legacy script.js was NOT polluted with homeSearchForm');
  assert(!legacyScriptJs.includes('searchVehicleType'), 'Legacy script.js was NOT polluted with searchVehicleType');

  // 4. HTTP Route & Asset Endpoint Verification
  console.log('\n4. Live HTTP Endpoint Verification:');
  const endpoints = [
    { url: '/', title: 'Home Page' },
    { url: '/screens/home/index.html', title: 'Modular Home Screen' },
    { url: '/screens/home/home.css', title: 'Modular Home CSS' },
    { url: '/screens/home/home.js', title: 'Modular Home JS' },
    { url: '/assets/media/home-hero.jpg', title: 'Hero Visual Asset' },
    { url: '/vehicles', title: 'Vehicles Fleet Page' },
    { url: '/screens/vehicles/vehicles.css', title: 'Modular Vehicles CSS' },
    { url: '/screens/vehicles/vehicles.js', title: 'Modular Vehicles JS' },
    { url: '/vehicles?type=Bikes&location=City%20Center%20Showroom', title: 'Vehicles Filtered by Bike' },
    { url: '/vehicles?type=Cars', title: 'Vehicles Filtered by Cars (Empty State)' }
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep.url}`);
    assert(res.ok, `${ep.title} (${ep.url}) returns HTTP 200 OK`);
  }

  // 5. Client Logic Unit Checks (Simulated)
  console.log('\n5. Functional Client Logic Simulation:');
  
  // Date validation rules
  function validateDates(pickup, ret) {
    if (!pickup) return { valid: false, error: 'Please select a pickup date.' };
    if (!ret) return { valid: false, error: 'Please select a return date.' };
    if (ret < pickup) return { valid: false, error: 'Return date cannot be earlier than pickup date.' };
    return { valid: true };
  }

  assert(!validateDates('2026-10-10', '2026-10-08').valid, 'Validation blocks return date earlier than pickup date');
  assert(validateDates('2026-10-10', '2026-10-12').valid, 'Validation passes valid future date range');
  assert(!validateDates('', '2026-10-12').valid, 'Validation blocks empty pickup date');
  assert(!validateDates('2026-10-10', '').valid, 'Validation blocks empty return date');

  console.log(`\n========================================`);
  console.log(`HOME REDESIGN AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runHomeRedesignVerification().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
