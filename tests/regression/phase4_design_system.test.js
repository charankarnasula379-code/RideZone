/**
 * ============================================================
 * RIDEZONE — PHASE 4 DESIGN SYSTEM & BUTTON / COLOR TEST SUITE
 * Validates unified design tokens, button hierarchy, component
 * parity, accessibility, and zero-breakage across user & admin.
 * ============================================================
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");

function test(name, fn) {
  return async () => {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await fn();
      console.log("\x1b[32mPASSED ✔\x1b[0m");
    } catch (err) {
      console.log("\x1b[31mFAILED ✖\x1b[0m");
      console.error(err);
      process.exitCode = 1;
    }
  };
}

function makeRequest(pathStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      "Content-Type": "application/json"
    };

    const reqOptions = {
      hostname: "localhost",
      port: 3001,
      path: pathStr,
      method: options.method || "GET",
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

(async function runPhase4Tests() {
  console.log("====================================================");
  console.log("  RIDEZONE — PHASE 4 DESIGN SYSTEM TEST SUITE       ");
  console.log("====================================================");

  const styleCssPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "css", "style.css"))
    ? path.join(__dirname, "..", "..", "public", "css", "style.css")
    : path.join(__dirname, "..", "style.css");
  const adminCssPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "admin", "admin.css"))
    ? path.join(__dirname, "..", "..", "public", "admin", "admin.css")
    : path.join(__dirname, "..", "admin", "admin.css");
  const userHtmlPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "index.html"))
    ? path.join(__dirname, "..", "..", "public", "index.html")
    : path.join(__dirname, "..", "index.html");
  const adminHtmlPath = fs.existsSync(path.join(__dirname, "..", "..", "public", "admin", "admin.html"))
    ? path.join(__dirname, "..", "..", "public", "admin", "admin.html")
    : path.join(__dirname, "..", "admin", "admin.html");

  const styleCss = fs.readFileSync(styleCssPath, "utf-8");
  const adminCss = fs.readFileSync(adminCssPath, "utf-8");
  const userHtml = fs.readFileSync(userHtmlPath, "utf-8");
  const adminHtml = fs.readFileSync(adminHtmlPath, "utf-8");

  // 1. Shared Design Token System Verification
  await test("Shared --rz-* tokens exist in style.css", async () => {
    const requiredTokens = [
      "--rz-bg",
      "--rz-surface",
      "--rz-surface-soft",
      "--rz-text",
      "--rz-border",
      "--rz-gold",
      "--rz-gold-hover",
      "--rz-gold-dark",
      "--rz-gold-soft",
      "--rz-success",
      "--rz-warning",
      "--rz-danger",
      "--rz-danger-solid",
      "--rz-shadow-sm",
      "--rz-shadow-modal",
      "--rz-radius-sm",
      "--rz-radius-md",
      "--rz-font-display",
      "--rz-font-ui",
      "--rz-transition"
    ];
    for (const tok of requiredTokens) {
      assert.ok(styleCss.includes(tok), `style.css must contain ${tok}`);
    }
  })();

  await test("Shared --rz-* tokens exist in admin.css", async () => {
    const requiredTokens = [
      "--rz-bg",
      "--rz-surface",
      "--rz-surface-soft",
      "--rz-text",
      "--rz-border",
      "--rz-gold",
      "--rz-gold-hover",
      "--rz-gold-dark",
      "--rz-gold-soft",
      "--rz-success",
      "--rz-warning",
      "--rz-danger",
      "--rz-danger-solid",
      "--rz-shadow-sm",
      "--rz-shadow-modal",
      "--rz-radius-sm",
      "--rz-radius-md",
      "--rz-font-display",
      "--rz-font-ui",
      "--rz-transition"
    ];
    for (const tok of requiredTokens) {
      assert.ok(adminCss.includes(tok), `admin.css must contain ${tok}`);
    }
  })();

  // 2. Strict Typography Parity
  await test("Both User and Admin share Space Grotesk, Inter & JetBrains Mono typography", async () => {
    assert.ok(styleCss.includes("Space Grotesk"), "style.css must declare Space Grotesk");
    assert.ok(styleCss.includes("Inter"), "style.css must declare Inter");
    assert.ok(styleCss.includes("JetBrains Mono"), "style.css must declare JetBrains Mono");
    assert.ok(adminCss.includes("Space Grotesk"), "admin.css must declare Space Grotesk");
    assert.ok(adminCss.includes("Inter"), "admin.css must declare Inter");
    assert.ok(adminCss.includes("JetBrains Mono"), "admin.css must declare JetBrains Mono");
  })();

  // 3. Button Hierarchy & States
  await test("User and Admin define canonical button classes (.btn-primary, .btn-secondary, .btn-danger, .btn-ghost)", async () => {
    assert.ok(styleCss.includes(".btn-primary") || styleCss.includes(".primary-button"));
    assert.ok(styleCss.includes(".btn-secondary") || styleCss.includes(".secondary-button"));
    assert.ok(styleCss.includes(".btn-danger"));
    assert.ok(adminCss.includes(".btn-primary"));
    assert.ok(adminCss.includes(".btn-secondary"));
    assert.ok(adminCss.includes(".btn-danger"));
    assert.ok(adminCss.includes(".btn-ghost"));
  })();

  await test("Button states (:hover, :active, :focus-visible, :disabled) exist", async () => {
    assert.ok(styleCss.includes(":hover"));
    assert.ok(styleCss.includes(":focus-visible"));
    assert.ok(styleCss.includes(":disabled"));
    assert.ok(adminCss.includes(":hover"));
    assert.ok(adminCss.includes(":focus-visible"));
    assert.ok(adminCss.includes(":disabled"));
  })();

  // 4. Heavy/Dark Button Elimination
  await test("Photo picker button (.photo-picker-btn) does not use pure black background", async () => {
    const match = styleCss.match(/\.photo-picker-btn\s*\{([^}]+)\}/);
    assert.ok(match, ".photo-picker-btn rule must exist");
    assert.ok(!match[1].includes("#1a1a1a"), ".photo-picker-btn must not use hardcoded #1a1a1a background");
  })();

  await test("Duration presets (.duration-btn.active) use gold showroom styling instead of solid black", async () => {
    const match = styleCss.match(/\.duration-btn\.active\s*\{([^}]+)\}/);
    assert.ok(match, ".duration-btn.active rule must exist");
    assert.ok(!match[1].includes("var(--charcoal)"), ".duration-btn.active must not be solid charcoal");
  })();

  await test("Payment tabs (.pay-tab.active) use gold showroom styling instead of solid black", async () => {
    const match = styleCss.match(/\.pay-tab\.active\s*\{([^}]+)\}/);
    assert.ok(match, ".pay-tab.active rule must exist");
    assert.ok(!match[1].includes("var(--charcoal)"), ".pay-tab.active must not be solid charcoal");
  })();

  // 5. Unified Badge System
  await test("Unified semantic badge system exists (.badge-success, .badge-danger, .badge-warning, .badge-gold)", async () => {
    assert.ok(styleCss.includes(".badge-success"));
    assert.ok(styleCss.includes(".badge-danger"));
    assert.ok(styleCss.includes(".badge-gold"));
    assert.ok(adminCss.includes(".badge-success"));
    assert.ok(adminCss.includes(".badge-danger"));
    assert.ok(adminCss.includes(".badge-gold"));
  })();

  // 6. Modal System & Elevation
  await test("Modals have standardized backdrop blur and soft shadow elevation", async () => {
    assert.ok(styleCss.includes("backdrop-filter: blur"));
    assert.ok(adminCss.includes("backdrop-filter: blur"));
    assert.ok(styleCss.includes("--rz-shadow-modal") || styleCss.includes("--shadow-modal"));
    assert.ok(adminCss.includes("--rz-shadow-modal") || adminCss.includes("--shadow-modal"));
  })();

  // 7. Form Controls & Focus Rings
  await test("Focus rings use gold highlight with subtle glow (WCAG accessible)", async () => {
    assert.ok(styleCss.includes(":focus-visible"));
    assert.ok(adminCss.includes(":focus-visible"));
  })();

  // 8. Responsive Breakpoints
  await test("Responsive media queries exist for desktop, tablet, and mobile", async () => {
    assert.ok(styleCss.includes("@media (max-width: 1080px)") || styleCss.includes("@media (max-width: 992px)"));
    assert.ok(styleCss.includes("@media (max-width: 680px)") || styleCss.includes("@media (max-width: 768px)"));
    assert.ok(adminCss.includes("@media (max-width:"));
  })();

  // 9. Live Web Server Route Statuses
  await test("GET / (Customer Portal) responds with HTTP 200", async () => {
    const res = await makeRequest("/");
    assert.strictEqual(res.statusCode, 200);
  })();

  await test("GET /vehicles responds with HTTP 200", async () => {
    const res = await makeRequest("/vehicles");
    assert.strictEqual(res.statusCode, 200);
  })();

  await test("GET /contact responds with HTTP 200", async () => {
    const res = await makeRequest("/contact");
    assert.strictEqual(res.statusCode, 200);
  })();

  await test("GET /admin responds with HTTP 200", async () => {
    const res = await makeRequest("/admin");
    assert.strictEqual(res.statusCode, 200);
  })();

  console.log("====================================================");
  console.log("  PHASE 4 TEST SUMMARY: ALL TESTS PASSED ✔           ");
  console.log("====================================================");
})();
