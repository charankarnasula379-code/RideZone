/**
 * RideZone Comprehensive DOM, Screen & Asset Audit Suite
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function verifyScreens() {
  console.log('=== RIDEZONE FULL SCREEN, DOM & ASSET AUDIT SUITE ===\n');

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
  const publicDir = fs.existsSync(path.join(projectRoot, 'public')) ? path.join(projectRoot, 'public') : projectRoot;

  // 1. Asset Files Verification on Disk
  console.log('1. Generated & Existing Vehicle Images Verification:');
  const requiredAssets = [
    'assets/ather.png',
    'assets/honda.png',
    'assets/suzuki.png',
    'assets/yamaha.png',
    'assets/bajaj.png',
    'assets/ktm.png',
    'assets/kawasaki.png',
    'assets/hunter.png',
    'assets/hunter-2.png',
    'assets/hunter-3.png',
    'assets/tvs.png',
    'assets/tvs-2.png',
    'assets/tvs-3.png'
  ];

  for (const asset of requiredAssets) {
    const fullPath = path.join(publicDir, asset);
    const exists = fs.existsSync(fullPath);
    const stats = exists ? fs.statSync(fullPath) : null;
    assert(exists && stats.size > 1000, `Asset ${asset} exists (${Math.round((stats?.size || 0) / 1024)} KB)`);
  }

  // 2. HTTP Route Checks
  console.log('\n2. HTTP Endpoint Availability:');
  const pagesToTest = [
    { url: '/', title: 'Home Page' },
    { url: '/vehicles', title: 'Vehicles Fleet Page' },
    { url: '/vehicle-details?id=8', title: 'Vehicle Details (Hunter 350)' },
    { url: '/vehicle-details?id=9', title: 'Vehicle Details (Apache RR 310)' },
    { url: '/about', title: 'About Us Page' },
    { url: '/contact', title: 'Contact Us Page' },
    { url: '/how-it-works', title: 'How It Works Page' },
    { url: '/terms', title: 'Terms & Conditions Page' },
    { url: '/admin', title: 'Admin Management Portal' }
  ];

  for (const p of pagesToTest) {
    const res = await fetch(`${BASE_URL}${p.url}`);
    assert(res.ok, `${p.title} (${p.url}) returns HTTP 200`);
  }

  // 3. User Login Modal & Admin Switch Link Verification
  console.log('\n3. Login Switching Navigation Verification:');
  const userHtmlFiles = [
    'index.html',
    'vehicles.html',
    'vehicle-details.html',
    'about.html',
    'contact.html',
    'how-it-works.html'
  ];

  for (const file of userHtmlFiles) {
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
    const hasAdminSwitch = content.includes('href="/admin"') && content.includes('btn-auth-switch-admin');
    assert(hasAdminSwitch, `${file} contains Admin login switch link pointing strictly to /admin`);
  }

  // 4. Admin Login Screen & User Switch Link Verification
  const adminHtml = fs.readFileSync(path.join(publicDir, 'admin', 'admin.html'), 'utf8');
  const hasUserSwitch = adminHtml.includes('href="/?auth=login"') && adminHtml.includes('btn-admin-switch-user');
  assert(hasUserSwitch, 'admin.html contains User login switch link pointing strictly to /?auth=login');

  const hasImagePresetHunter = adminHtml.includes('value="/assets/hunter.png"');
  const hasImagePresetTvs = adminHtml.includes('value="/assets/tvs.png"');
  assert(hasImagePresetHunter && hasImagePresetTvs, 'admin.html Add Vehicle modal includes Hunter 350 and TVS Apache RR 310 image presets');

  // 5. script.js Dynamic DB Source of Truth Verification
  console.log('\n4. Script.js & Admin.js Integrity Verification:');
  const scriptPath = fs.existsSync(path.join(publicDir, 'js', 'script.js'))
    ? path.join(publicDir, 'js', 'script.js')
    : path.join(publicDir, 'script.js');
  const adminJsPath = fs.existsSync(path.join(publicDir, 'admin', 'admin.js'))
    ? path.join(publicDir, 'admin', 'admin.js')
    : path.join(publicDir, 'admin.js');
  const scriptJs = fs.readFileSync(scriptPath, 'utf8');
  assert(scriptJs.includes('getVehicleSpecs'), 'script.js defines getVehicleSpecs for dynamic spec extraction');
  assert(scriptJs.includes('getVehicleGallery'), 'script.js defines getVehicleGallery for dynamic gallery extraction');
  assert(scriptJs.includes('getVehicleDescription'), 'script.js defines getVehicleDescription for dynamic description extraction');
  assert(scriptJs.includes('urlParams.get("auth")'), 'script.js handles ?auth=login parameter to auto-open login modal');

  const adminJs = fs.readFileSync(adminJsPath, 'utf8');
  assert(adminJs.includes('openPaymentReceiptModal'), 'admin.js defines openPaymentReceiptModal');
  assert(adminJs.includes('customer_name') && adminJs.includes('customer_email'), 'admin.js references real customer metadata');

  console.log(`\n========================================`);
  console.log(`SCREEN AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

verifyScreens().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
