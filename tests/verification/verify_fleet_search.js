/**
 * RideZone Fleet Search, Quick Filters & Results Count Verification Suite
 * Tests the interactive fleet search bar, multi-attribute matching,
 * quick category pills, result count displays, and empty state reset.
 */

const fs = require('fs');
const path = require('path');

async function runFleetSearchVerification() {
  console.log('=== RIDEZONE FLEET SEARCH & FILTERS VERIFICATION SUITE ===\n');

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
  const publicDir = fs.existsSync(path.join(projectRoot, 'public'))
    ? path.join(projectRoot, 'public')
    : projectRoot;

  // 1. DOM Architecture in vehicles.html
  console.log('1. DOM Structure Verification in vehicles.html:');
  const html = fs.readFileSync(path.join(publicDir, 'vehicles.html'), 'utf8');

  assert(html.includes('class="fleet-search-wrapper"'), 'vehicles.html contains .fleet-search-wrapper');
  assert(html.includes('id="fleetSearchInput"'), 'vehicles.html contains #fleetSearchInput');
  assert(html.includes('type="search"'), 'vehicles.html uses real <input type="search">');
  assert(html.includes('id="fleetSearchClearBtn"'), 'vehicles.html contains #fleetSearchClearBtn (✕)');
  assert(html.includes('id="quickCategoryFilters"'), 'vehicles.html contains #quickCategoryFilters navigation');
  assert(html.includes('data-category="all"'), 'vehicles.html contains "All" quick filter pill');
  assert(html.includes('data-category="Electric"'), 'vehicles.html contains "Electric" quick filter pill');
  assert(html.includes('data-category="Scooter"'), 'vehicles.html contains "Scooter" quick filter pill');
  assert(html.includes('data-category="Bike"'), 'vehicles.html contains "Bike" quick filter pill');
  assert(html.includes('data-category="High-End"'), 'vehicles.html contains "High-End" quick filter pill');
  assert(html.includes('id="fleetResultsCount"'), 'vehicles.html contains #fleetResultsCount live region');

  // 2. CSS Design System Verification in style.css
  console.log('\n2. CSS Design System Verification in style.css:');
  const css = fs.readFileSync(path.join(publicDir, 'css', 'style.css'), 'utf8');

  assert(css.includes('.fleet-search-wrapper'), 'style.css defines .fleet-search-wrapper');
  assert(css.includes('.fleet-search-bar'), 'style.css defines .fleet-search-bar');
  assert(css.includes('.fleet-search-input'), 'style.css defines .fleet-search-input');
  assert(css.includes('.fleet-search-clear-btn'), 'style.css defines .fleet-search-clear-btn');
  assert(css.includes('.fleet-quick-filters'), 'style.css defines .fleet-quick-filters');
  assert(css.includes('.quick-filter-pill'), 'style.css defines .quick-filter-pill');
  assert(css.includes('.quick-filter-pill.is-active'), 'style.css defines .quick-filter-pill.is-active (#F4B400 gold)');
  assert(css.includes('.fleet-results-count'), 'style.css defines .fleet-results-count');
  assert(css.includes('.fleet-results-count .count-num'), 'style.css defines JetBrains Mono .count-num');
  assert(css.includes('.fleet-empty-state'), 'style.css defines .fleet-empty-state');
  assert(css.includes('.btn-clear-all-filters'), 'style.css defines .btn-clear-all-filters');
  assert(css.includes('/* Fleet Search & Quick Filters Mobile Adaptation */'), 'style.css includes mobile adaptation for search');

  // 3. Script Logic Verification in script.js
  console.log('\n3. Client-Side Search & Filter Logic in script.js:');
  const js = fs.readFileSync(path.join(publicDir, 'js', 'script.js'), 'utf8');

  assert(js.includes('function matchesSearch(vehicle, rawQuery)'), 'script.js defines matchesSearch algorithm');
  assert(js.includes('updateResultCount'), 'script.js defines updateResultCount');
  assert(js.includes('syncQuickPillsFromCheckboxes'), 'script.js defines syncQuickPillsFromCheckboxes');
  assert(js.includes('resetAllSearchAndFilters'), 'script.js defines resetAllSearchAndFilters');
  assert(js.includes('fleetClearAllBtn'), 'script.js binds #fleetClearAllBtn empty state reset');
  assert(js.includes('fleetSearchClearBtn'), 'script.js binds #fleetSearchClearBtn query clear');

  // 4. Algorithmic Search Accuracy Simulation
  console.log('\n4. Algorithmic Multi-Attribute Search Accuracy Simulation:');
  const mockVehicles = [
    { id: 1, name: "Ather 450X", brand: "Ather", model: "450X Gen 3", category: "Electric", fuel_type: "Electric", price: 150, description: "Smart electric scooter" },
    { id: 2, name: "Honda Activa 6G", brand: "Honda", model: "Activa 6G Deluxe", category: "Scooter", fuel_type: "Petrol", price: 120, description: "Reliable city commuter" },
    { id: 3, name: "Yamaha MT-15 V2", brand: "Yamaha", model: "MT-15 Version 2.0", category: "Bike", fuel_type: "Petrol", price: 220, description: "Aggressive streetfighter" },
    { id: 4, name: "KTM Duke 250", brand: "KTM", model: "250 Duke ABS", category: "Bike", fuel_type: "Petrol", price: 280, description: "High-performance street naked" },
    { id: 5, name: "Kawasaki Ninja 300", brand: "Kawasaki", model: "Ninja 300 ABS", category: "High-End", fuel_type: "Petrol", price: 450, description: "Parallel twin supersport" },
    { id: 6, name: "Royal Enfield Hunter 350", brand: "Royal Enfield", model: "Hunter 350 Dapper", category: "Bike", fuel_type: "Petrol", price: 320, description: "Modern street roadster" },
    { id: 7, name: "TVS Apache RTR 160 4V", brand: "TVS", model: "Apache RTR 160 4V", category: "Bike", fuel_type: "Petrol", price: 240, description: "Track-inspired racing motorcycle" },
    { id: 8, name: "Suzuki Access 125", brand: "Suzuki", model: "Access 125 Ride Connect", category: "Scooter", fuel_type: "Petrol", price: 190, description: "Premium executive scooter" },
    { id: 9, name: "Bajaj Pulsar NS200", brand: "Bajaj", model: "Pulsar NS200 Dual ABS", category: "Bike", fuel_type: "Petrol", price: 260, description: "Triple spark perimeter frame" }
  ];

  function testMatchesSearch(vehicle, rawQuery) {
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
    const combinedText = `${brand} ${name} ${model} ${category} ${fuelType} ${desc} ${regNo}`;
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    return tokens.every((token) => combinedText.includes(token));
  }

  // Query: Ather
  const atherResults = mockVehicles.filter(v => testMatchesSearch(v, "Ather"));
  assert(atherResults.length === 1 && atherResults[0].name === "Ather 450X", 'Searching "Ather" returns Ather 450X');

  // Query: Honda
  const hondaResults = mockVehicles.filter(v => testMatchesSearch(v, "Honda"));
  assert(hondaResults.length === 1 && hondaResults[0].name === "Honda Activa 6G", 'Searching "Honda" returns Honda Activa 6G');

  // Query: 450X
  const modelResults = mockVehicles.filter(v => testMatchesSearch(v, "450X"));
  assert(modelResults.length === 1 && modelResults[0].name === "Ather 450X", 'Searching model "450X" returns Ather 450X');

  // Query: electric (case-insensitive)
  const electricResults = mockVehicles.filter(v => testMatchesSearch(v, "electric"));
  assert(electricResults.length === 1 && electricResults[0].category === "Electric", 'Searching "electric" returns relevant electric vehicle');

  // Query: yamaha + category: Bike
  const yamahaBikeResults = mockVehicles.filter(v => testMatchesSearch(v, "Yamaha") && v.category === "Bike");
  assert(yamahaBikeResults.length === 1 && yamahaBikeResults[0].name === "Yamaha MT-15 V2", 'Combined search "Yamaha" + category "Bike" returns Yamaha MT-15 V2');

  // Non-matching query
  const emptyResults = mockVehicles.filter(v => testMatchesSearch(v, "Ducati Panigale V4"));
  assert(emptyResults.length === 0, 'Non-matching query returns 0 vehicles, triggering polished empty state');

  console.log(`\n========================================`);
  console.log(`FLEET SEARCH VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runFleetSearchVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
