const { chromium } = require('C:/20.HDev/boxcycle/node_modules/@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 699, height: 300 } });
    await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding');
    await page.locator('.hud-account').waitFor();
    await page.screenshot({ path: 'C:/20.HDev/boxcycle/document/ops/20261028-edge-alignment/evidence/account-699x300.png' });
  } finally { await browser.close(); }
})();
