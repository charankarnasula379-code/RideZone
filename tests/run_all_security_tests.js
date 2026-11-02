/**
 * RideZone Master Security & Concurrency Test Runner
 * Executes all 9 security test suites and outputs an executive audit summary.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testSuites = [
  { name: "1. Authentication, Tokens & Password Lifecycle", file: "auth.security.test.js" },
  { name: "2. Admin Route Authorization & RBAC Audit", file: "admin.authorization.test.js" },
  { name: "3. IDOR & Tenant Isolation", file: "idor.security.test.js" },
  { name: "4. 50-Client Booking Concurrency & Overlap Prevention", file: "booking.concurrency.test.js" },
  { name: "5. 20-Client Atomic Cancellation & Double-Refund Prevention", file: "cancellation.concurrency.test.js" },
  { name: "6. Upload Security & Binary Magic-Byte Verification", file: "upload.security.test.js" },
  { name: "7. Frontend XSS Sanitization & HTML Immunity", file: "xss.security.test.js" },
  { name: "8. Database Migrations & Fresh Schema Audit", file: "database.migrations.test.js" },
  { name: "9. Security Headers & Error Response Hardening", file: "security.headers.test.js" }
];

console.log("================================================================================");
console.log("             RIDEZONE MASTER SECURITY & CONCURRENCY TEST RUNNER                 ");
console.log("================================================================================\n");

let suitesPassed = 0;
let suitesFailed = 0;

for (const suite of testSuites) {
  const filePath = fs.existsSync(path.join(__dirname, 'security', suite.file))
    ? path.join(__dirname, 'security', suite.file)
    : path.join(__dirname, suite.file);
  console.log(`>>> RUNNING: ${suite.name} (${suite.file})`);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8' });
    console.log(output);
    if (output.includes("[FAIL]")) {
      suitesFailed++;
    } else {
      suitesPassed++;
    }
  } catch (err) {
    console.error(err.stdout || err.message);
    suitesFailed++;
  }
}

console.log("\n================================================================================");
console.log(`                     MASTER AUDIT EXECUTION SUMMARY                             `);
console.log("================================================================================");
console.log(`Total Test Suites Executed: ${testSuites.length}`);
console.log(`Suites Passed:              ${suitesPassed}`);
console.log(`Suites Failed:              ${suitesFailed}`);
console.log("================================================================================");

if (suitesFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
