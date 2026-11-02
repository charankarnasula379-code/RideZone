const fs = require('fs');
const path = require('path');

const vehicles = [
  { id: 1, name: "Ather 450X", slug: "ather" },
  { id: 2, name: "Honda Activa 6G", slug: "honda" },
  { id: 3, name: "Suzuki Access 125", slug: "suzuki" },
  { id: 4, name: "Yamaha MT-15 V2", slug: "yamaha" },
  { id: 5, name: "Bajaj Pulsar NS200", slug: "bajaj" },
  { id: 6, name: "KTM RC 390", slug: "ktm" },
  { id: 7, name: "Kawasaki Ninja 300", slug: "kawasaki" }
];

const projectRoot = path.join(__dirname, '..', '..');
const basePath = fs.existsSync(path.join(projectRoot, 'public', 'assets', '360'))
  ? path.join(projectRoot, 'public', 'assets', '360')
  : path.join(__dirname, 'assets', '360');

console.log("==========================================================");
console.log("RIDEZONE 360 ASSET AUDIT REPORT (252 EXPECTED FRAMES)");
console.log("==========================================================");

let grandTotal = 0;

vehicles.forEach(v => {
  const dir = path.join(basePath, v.slug);
  let found = 0;
  const missing = [];

  for (let i = 1; i <= 36; i++) {
    const frameName = String(i).padStart(2, '0') + '.png';
    const filePath = path.join(dir, frameName);
    if (fs.existsSync(filePath)) {
      found++;
      grandTotal++;
    } else {
      missing.push(frameName);
    }
  }

  const status = found === 36 ? "✓ COMPLETE" : `(Missing ${missing.length} frames: 01.png..36.png)`;
  console.log(`${v.name.padEnd(20)}: ${found}/36 frames ${status}`);
});

console.log("----------------------------------------------------------");
console.log(`Total: ${grandTotal}/252 frames`);
console.log("==========================================================");
