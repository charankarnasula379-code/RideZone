/**
 * Automated Verification Suite for RideZone Featured Vehicles Section Redesign
 * ("Our Premium Collection")
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function verifyFeaturedCollection() {
  console.log('=== VERIFYING FEATURED VEHICLES REDESIGN ("OUR PREMIUM COLLECTION") ===\n');

  const publicDir = path.join(__dirname, '..', '..', 'public');
  const homeHtmlPath = path.join(publicDir, 'screens', 'home', 'index.html');
  const rootHtmlPath = path.join(publicDir, 'index.html');
  const homeCssPath = path.join(publicDir, 'screens', 'home', 'home.css');
  const homeJsPath = path.join(publicDir, 'screens', 'home', 'home.js');

  let passed = 0;
  function pass(desc) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  }

  // 1. Files & Parity Check
  console.log('1. Structure & HTML Parity:');
  assert(fs.existsSync(homeHtmlPath), 'home/index.html exists');
  assert(fs.existsSync(rootHtmlPath), 'root index.html exists');
  assert(fs.existsSync(homeCssPath), 'home.css exists');
  assert(fs.existsSync(homeJsPath), 'home.js exists');
  pass('All core modular files exist');

  const homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
  const rootHtml = fs.readFileSync(rootHtmlPath, 'utf8');

  // Verify section ID and classes
  assert(homeHtml.includes('id="featuredCollectionSection"'), 'home HTML contains #featuredCollectionSection');
  assert(rootHtml.includes('id="featuredCollectionSection"'), 'root HTML contains #featuredCollectionSection');
  pass('#featuredCollectionSection present in both index files');

  // Verify Eyebrow, Heading, Subtitle
  assert(homeHtml.includes('FEATURED VEHICLES'), 'home HTML contains FEATURED VEHICLES eyebrow');
  assert(homeHtml.includes('Our Premium Collection'), 'home HTML contains "Our Premium Collection" heading');
  assert(homeHtml.includes('Hand-picked vehicles for an exceptional rental experience'), 'home HTML contains subtitle');
  pass('Header titles and subtitles intact');

  // Verify Header Controls
  assert(homeHtml.includes('id="featuredPrevBtn"'), 'home HTML contains #featuredPrevBtn');
  assert(homeHtml.includes('id="featuredNextBtn"'), 'home HTML contains #featuredNextBtn');
  assert(homeHtml.includes('href="/vehicles"'), 'home HTML contains link to /vehicles');
  assert(homeHtml.includes('View All Vehicles'), 'home HTML contains "View All Vehicles"');
  pass('Header navigation buttons and View All Vehicles link intact');

  // Verify Carousel Track and Skeletons
  assert(homeHtml.includes('id="featuredCarouselTrack"'), 'home HTML contains #featuredCarouselTrack');
  assert(homeHtml.includes('class="featured-card-skeleton"'), 'home HTML contains initial skeleton cards');
  assert(homeHtml.includes('id="featuredErrorState"'), 'home HTML contains error state container');
  assert(homeHtml.includes('id="featuredRetryBtn"'), 'home HTML contains retry button');
  pass('Carousel track, skeletons, and error retry state intact');

  // 2. CSS Design System Verification
  console.log('\n2. CSS Design System Verification in home.css:');
  const homeCss = fs.readFileSync(homeCssPath, 'utf8');

  const requiredSelectors = [
    '.featured-collection-section',
    '.featured-collection-container',
    '.featured-header-row',
    '.featured-eyebrow',
    '.featured-heading',
    '.featured-subtitle',
    '.featured-header-controls',
    '.featured-carousel-nav',
    '.carousel-arrow-btn',
    '.featured-view-all-btn',
    '.featured-carousel-track',
    '.featured-card',
    '.featured-card-visual',
    '.featured-category-badge',
    '.badge-cat-superbike',
    '.badge-cat-bike',
    '.badge-cat-electric',
    '.badge-cat-scooter',
    '.featured-card-img',
    '.featured-card-body',
    '.featured-card-name',
    '.featured-card-meta',
    '.featured-card-price',
    '.featured-availability',
    '.status-available',
    '.status-unavailable',
    '.featured-rating',
    '.featured-star-icon',
    '.featured-card-actions',
    '.featured-btn-details',
    '.featured-btn-book',
    '.featured-card-skeleton',
    '.featured-error-state',
    '.featured-retry-btn'
  ];

  for (const sel of requiredSelectors) {
    assert(homeCss.includes(sel), `home.css defines selector ${sel}`);
  }
  pass(`All ${requiredSelectors.length} required CSS selectors defined in home.css`);

  // Verify responsive media queries
  assert(homeCss.includes('@media (max-width: 1279px)'), 'home.css includes 4-card desktop/laptop breakpoint');
  assert(homeCss.includes('@media (max-width: 1023px)'), 'home.css includes 3-card tablet breakpoint');
  assert(homeCss.includes('@media (max-width: 767px)'), 'home.css includes 2-card small tablet breakpoint');
  assert(homeCss.includes('@media (max-width: 559px)'), 'home.css includes mobile single-card/stacked breakpoint');
  pass('Responsive carousel breakpoints verified');

  // 3. Controller Logic in home.js
  console.log('\n3. Controller Logic in home.js:');
  const homeJs = fs.readFileSync(homeJsPath, 'utf8');

  assert(homeJs.includes('featuredCarouselTrack'), 'home.js binds featuredCarouselTrack');
  assert(homeJs.includes('featuredPrevBtn'), 'home.js binds featuredPrevBtn');
  assert(homeJs.includes('featuredNextBtn'), 'home.js binds featuredNextBtn');
  assert(homeJs.includes('loadFeaturedVehicles'), 'home.js defines loadFeaturedVehicles');
  assert(homeJs.includes('renderFeaturedVehicles'), 'home.js defines renderFeaturedVehicles');
  assert(homeJs.includes('updateArrowStates'), 'home.js defines updateArrowStates');
  assert(homeJs.includes('getCategoryBadgeClass'), 'home.js maps categories to badge classes');
  assert(homeJs.includes('featured-btn-book'), 'home.js queries and handles .featured-btn-book');
  assert(homeJs.includes('initiateBooking'), 'home.js integrates with RideZone initiateBooking');
  assert(homeJs.includes('/vehicle-details?id='), 'home.js creates real vehicle details URLs');
  assert(homeJs.includes('featuredRetryBtn'), 'home.js binds retry action');
  pass('All controller logic functions verified in home.js');

  // 4. API & Real Vehicle Integration Check
  console.log('\n4. Live API Data Verification:');
  const apiRes = await fetch('http://localhost:3001/api/vehicles');
  assert(apiRes.ok, 'API /api/vehicles returns HTTP 200');
  const vehicles = await apiRes.json();
  assert(Array.isArray(vehicles) && vehicles.length === 9, `API returns 9 real vehicles (received ${vehicles.length})`);
  
  for (const v of vehicles) {
    assert(v.id, `Vehicle ${v.name} has real database ID`);
    assert(v.name, `Vehicle ID ${v.id} has real name`);
    assert(v.price && typeof v.price === 'number', `Vehicle ${v.name} has real price ₹${v.price}`);
    assert(v.category, `Vehicle ${v.name} has real category ${v.category}`);
    assert(v.image, `Vehicle ${v.name} has real image ${v.image}`);
    assert(v.status, `Vehicle ${v.name} has status ${v.status}`);
  }
  pass('All 9 real vehicles validated with valid attributes');

  // 5. Check Legacy Isolation
  console.log('\n5. Architecture & File Isolation Verification:');
  const scriptJs = fs.readFileSync(path.join(publicDir, 'js', 'script.js'), 'utf8');
  const styleCss = fs.readFileSync(path.join(publicDir, 'css', 'style.css'), 'utf8');

  assert(!styleCss.includes('featured-collection-section'), 'style.css does NOT contain home-specific featured styling');
  assert(!styleCss.includes('featured-carousel-track'), 'style.css does NOT contain carousel track styling');
  pass('Modular isolation: style.css not polluted');

  assert(!scriptJs.includes('loadFeaturedVehicles'), 'script.js does NOT contain new featured vehicles loader');
  pass('Modular isolation: script.js not polluted');

  console.log(`\n========================================`);
  console.log(`FEATURED REDESIGN AUDIT: ${passed} CHECKS PASSED, 0 FAILED`);
  console.log(`========================================\n`);
}

verifyFeaturedCollection().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
