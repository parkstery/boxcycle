const { chromium } = require('C:/20.HDev/boxcycle/node_modules/@playwright/test');
const fs = require('node:fs/promises');
const out = 'C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const page = await browser.newPage();
    for (const [width, height] of [[800,360],[736,300],[699,273],[667,300]]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding');
      const trigger = page.locator('.camera-view-menu__trigger');
      await trigger.waitFor();
      if (await trigger.locator('.camera-view-menu__video-icon').count()) throw new Error('Camera 1 changed');
      for (const slot of [2,3,4,5,6]) {
        await trigger.click();
        await page.locator(`.camera-view-menu__item[data-camera-slot="${slot}"]`).click();
        const result = await trigger.evaluate((el, slot) => {
          const r = el.getBoundingClientRect();
          const account = document.querySelector('.hud-account').getBoundingClientRect();
          const icon = el.querySelector('.camera-view-menu__video-icon');
          const direction = el.querySelector(`[data-camera-direction="${slot}"]`);
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            icon: !!icon && icon.getBoundingClientRect().width > 0,
            direction: !!direction,
            number: el.querySelector('.camera-view-menu__item-num').textContent,
            inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0,
            overlap: r.left < account.right && r.right > account.left && r.top < account.bottom && r.bottom > account.top,
            hit: el.contains(hit),
          };
        }, slot);
        const pass = result.icon && result.direction && result.number === String(slot) && result.inside && !result.overlap && result.hit;
        results.push({ width, height, slot, pass, ...result });
        if (!pass) throw new Error(JSON.stringify(results.at(-1)));
      }
      if (width === 699) {
        await trigger.click();
        await page.locator('.camera-view-menu__item[data-camera-slot="2"]').click();
        await trigger.click();
        await page.screenshot({ path: `${out}/camera-icon-699x273.png` });
      }
    }
    await fs.writeFile(`${out}/camera-icon-check.json`, JSON.stringify(results, null, 2));
    console.log(`${results.length} checks PASS`);
  } finally { await browser.close(); }
})();
