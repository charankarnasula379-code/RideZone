const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('=== RUNNING FINAL PASS AUDIT & VERIFICATION SCRIPT ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

const projectRoot = path.join(__dirname, '..', '..');
const publicDir = fs.existsSync(path.join(projectRoot, 'public')) ? path.join(projectRoot, 'public') : projectRoot;

// 1. Verify CSS Grid in style.css
console.log('1. Checking style.css for Grid and Contact layout:');
const cssPath = fs.existsSync(path.join(publicDir, 'css', 'style.css'))
  ? path.join(publicDir, 'css', 'style.css')
  : path.join(publicDir, 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(!cssContent.includes('.fleet-grid-331 > .vehicle-card:nth-child(7)'), 'No nth-child(7) grid-column overrides in style.css');
assert(cssContent.includes('.contact-form-group'), 'Contact form group styles exist in style.css');
assert(cssContent.includes('.account-nav-tabs'), 'Customer account nav tab styles exist in style.css');
assert(cssContent.includes('.upcoming-booking-card'), 'Upcoming booking card styles exist in style.css');
assert(cssContent.includes('.account-empty-state'), 'Account empty state styles exist in style.css');

// 2. Verify all 6 HTML files for userProfileModal tabbed structure
console.log('\n2. Checking HTML files for Customer Account tabs:');
const htmlFiles = [
  'index.html',
  'vehicles.html',
  'vehicle-details.html',
  'about.html',
  'contact.html',
  'how-it-works.html'
];

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
  assert(content.includes('accountTabUpcoming'), `${file} has accountTabUpcoming button`);
  assert(content.includes('accountTabHistory'), `${file} has accountTabHistory button`);
  assert(content.includes('accountTabProfile'), `${file} has accountTabProfile button`);
  assert(content.includes('accountUpcomingView'), `${file} has accountUpcomingView panel`);
  assert(content.includes('accountHistoryView'), `${file} has accountHistoryView panel`);
  assert(content.includes('accountProfileView'), `${file} has accountProfileView panel`);
});

// 3. Verify Contact Form structure in contact.html
console.log('\n3. Checking contact.html structure:');
const contactHtml = fs.readFileSync(path.join(publicDir, 'contact.html'), 'utf8');
assert(contactHtml.includes('contact-form-styled'), 'contact.html has contact-form-styled class');
assert(contactHtml.includes('contact-form-group'), 'contact.html has contact-form-group divs');
assert(contactHtml.includes('contact-input'), 'contact.html has contact-input classes');
assert(contactHtml.includes('contact-textarea'), 'contact.html has contact-textarea class');

// 4. Verify script.js functions
console.log('\n4. Checking script.js functions:');
const jsPath = fs.existsSync(path.join(publicDir, 'js', 'script.js'))
  ? path.join(publicDir, 'js', 'script.js')
  : path.join(publicDir, 'script.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');
assert(jsContent.includes('function switchAccountTab'), 'script.js defines switchAccountTab');
assert(jsContent.includes('function renderUserProfileBookings'), 'script.js defines renderUserProfileBookings');
assert(jsContent.includes('account-empty-state'), 'script.js generates account-empty-state HTML');
assert(jsContent.includes('btn-upcoming-details'), 'script.js generates btn-upcoming-details action button');

// 5. Verify image assets on disk
console.log('\n5. Checking Vehicle Assets on Disk:');
const assets = [
  'assets/honda.png',
  'assets/ktm.png',
  'assets/bajaj.png',
  'assets/kawasaki.png',
  'assets/ather.png',
  'assets/yamaha.png',
  'assets/suzuki.png',
  'assets/hunter.png',
  'assets/tvs.png'
];

assets.forEach(assetPath => {
  const fullPath = path.join(publicDir, assetPath);
  const exists = fs.existsSync(fullPath);
  assert(exists, `Vehicle asset ${assetPath} exists on disk`);
});

// 6. Verify Mandatory Rental Conditions on Reservation Pages
console.log('\n6. Checking Mandatory Rental Conditions Architecture:');
['index.html', 'vehicles.html', 'vehicle-details.html'].forEach(page => {
  const content = fs.readFileSync(path.join(publicDir, page), 'utf8');
  assert(content.includes('id="mandatoryConditionsCard"'), `${page} has #mandatoryConditionsCard`);
  assert(content.includes('id="condEligibility"'), `${page} has #condEligibility checkbox`);
  assert(content.includes('id="condDepositCancellation"'), `${page} has #condDepositCancellation checkbox`);
  assert(content.includes('id="condSafeUsage"'), `${page} has #condSafeUsage checkbox`);
  assert(content.includes('id="policyDepositDisplay"'), `${page} has dynamic #policyDepositDisplay`);
  assert(content.includes('href="/terms"'), `${page} has supplementary /terms link`);
  assert(/<button[^>]+id="bookingProceedBtn"[^>]*disabled[^>]*>/i.test(content), `${page} has disabled #bookingProceedBtn`);
});
assert(cssContent.includes('.mandatory-conditions-card'), 'style.css defines .mandatory-conditions-card');
assert(cssContent.includes('.mandatory-condition-row'), 'style.css defines .mandatory-condition-row');
assert(cssContent.includes('.mandatory-condition-row.is-checked'), 'style.css defines .is-checked state for conditions');
assert(cssContent.includes('.mandatory-condition-row.has-error'), 'style.css defines .has-error state for conditions');
assert(jsContent.includes('updateProceedButtonState'), 'script.js defines updateProceedButtonState');
assert(jsContent.includes('Please accept the required rental conditions before continuing.'), 'script.js defines mandatory conditions validation message');

// 7. Verify Fleet Search, Quick Filters & Results Count Architecture
console.log('\n7. Checking Fleet Search, Quick Filters & Results Count Architecture:');
const vehiclesHtml = fs.readFileSync(path.join(publicDir, 'vehicles.html'), 'utf8');
assert(vehiclesHtml.includes('id="fleetSearchInput"'), 'vehicles.html has #fleetSearchInput');
assert(vehiclesHtml.includes('id="fleetSearchClearBtn"'), 'vehicles.html has #fleetSearchClearBtn');
assert(vehiclesHtml.includes('id="quickCategoryFilters"'), 'vehicles.html has #quickCategoryFilters');
assert(vehiclesHtml.includes('id="fleetResultsCount"'), 'vehicles.html has #fleetResultsCount');
assert(cssContent.includes('.fleet-search-wrapper'), 'style.css defines .fleet-search-wrapper');
assert(cssContent.includes('.fleet-search-bar'), 'style.css defines .fleet-search-bar');
assert(cssContent.includes('.quick-filter-pill'), 'style.css defines .quick-filter-pill');
assert(cssContent.includes('.quick-filter-pill.is-active'), 'style.css defines .quick-filter-pill.is-active');
assert(cssContent.includes('.fleet-results-count'), 'style.css defines .fleet-results-count');
assert(cssContent.includes('.fleet-empty-state'), 'style.css defines .fleet-empty-state');
assert(cssContent.includes('.btn-clear-all-filters'), 'style.css defines .btn-clear-all-filters');
assert(jsContent.includes('matchesSearch'), 'script.js defines matchesSearch');
assert(jsContent.includes('updateResultCount'), 'script.js defines updateResultCount');
assert(jsContent.includes('syncQuickPillsFromCheckboxes'), 'script.js defines syncQuickPillsFromCheckboxes');
assert(jsContent.includes('resetAllSearchAndFilters'), 'script.js defines resetAllSearchAndFilters');

console.log(`\n========================================`);
console.log(`FINAL PASS AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
