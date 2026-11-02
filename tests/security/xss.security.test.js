/**
 * RideZone Security Test Suite: XSS Sanitization & HTML Entity Encoding
 */

function escapeHtml(unsafeStr) {
  if (unsafeStr === null || unsafeStr === undefined) return "";
  return String(unsafeStr)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function runXssTests() {
  console.log("==================================================");
  console.log("   TEST SUITE: XSS SANITIZATION & HTML IMMUNITY   ");
  console.log("==================================================\n");

  const testVectors = [
    {
      name: "Script tag injection",
      input: "<script>alert('XSS')</script>",
      expected: "&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt;"
    },
    {
      name: "Image onerror event handler",
      input: "<img src=x onerror=alert(document.cookie)>",
      expected: "&lt;img src=x onerror=alert(document.cookie)&gt;"
    },
    {
      name: "Attribute breakout vector",
      input: "\"><script>alert(1)</script>",
      expected: "&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"
    },
    {
      name: "SVG onload payload",
      input: "<svg/onload=alert('pwn')>",
      expected: "&lt;svg/onload=alert(&#039;pwn&#039;)&gt;"
    },
    {
      name: "Body onload with quotes",
      input: "<body onload=\"alert('admin')\">",
      expected: "&lt;body onload=&quot;alert(&#039;admin&#039;)&quot;&gt;"
    },
    {
      name: "Null and undefined safety",
      input: null,
      expected: ""
    }
  ];

  let passed = 0;
  let failed = 0;

  testVectors.forEach((v) => {
    const result = escapeHtml(v.input);
    if (result === v.expected && !result.includes("<") && !result.includes(">")) {
      console.log(`[PASS] ${v.name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${v.name} -> Expected: "${v.expected}", Got: "${result}"`);
      failed++;
    }
  });

  console.log("\n==================================================");
  console.log(`XSS SANITIZATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
}

runXssTests();
