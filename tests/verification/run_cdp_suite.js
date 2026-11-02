const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'd:\\temp_chrome_prof';

  console.log('[Runner] Spawning Chrome headless with remote debugging port 9222...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check'
  ], {
    detached: false,
    stdio: 'ignore'
  });

  // Wait 3 seconds for Chrome to bind port 9222
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await fetch('http://localhost:9222/json/version');
      if (res.ok) {
        console.log('[Runner] Chrome CDP is ready!');
        break;
      }
    } catch (e) {}
  }

  try {
    // Run browser test script
    require('./browser_cdp_test.js');
  } catch (err) {
    console.error('[Runner Error]:', err);
    chrome.kill('SIGKILL');
    process.exit(1);
  }

  // Allow test script to finish
  process.on('exit', () => {
    chrome.kill('SIGKILL');
  });
}

main();
