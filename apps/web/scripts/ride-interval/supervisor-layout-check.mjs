import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('../../document/ops/20261028-ui-moments/evidence/supervisor-final');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
try {
  const page = await browser.newPage();
  for (const [width, height] of [[800, 360], [736, 360], [699, 273], [667, 300]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&interval&intervalMs=330000');
    await page.locator('[aria-label="주행 지표"]').waitFor();
    await page.locator('.edge-panel-tab--right').click();
    await page.locator('#lb-glance-panel').waitFor({ state: 'visible' });
    const result = await page.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect();
      const rank = box('.lb-glance__panel');
      const controls = box('.map-hud__tr');
      const list = box('.lb-glance__list');
      const interval = box('.ride-interval-hud');
      const metrics = box('[aria-label="주행 지표"]');
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const cellOverflows = [...document.querySelectorAll('.hud-metrics__cell')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
      return {
        hudFraction: metrics.width / innerWidth,
        rankControlOverlap: overlap(rank, controls),
        rankIntervalOverlap: overlap(rank, interval),
        listHeight: list.height,
        rowHeight: box('.lb-glance__row').height,
        controlsBottom: controls.bottom,
        rankTop: rank.top,
        cellOverflows,
      };
    });
    checks.push({ width, height, ...result });
    await page.screenshot({ path: path.join(output, `riding-${width}x${height}.png`), animations: 'disabled' });
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(output, 'layout.json'), JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks));
process.exitCode = checks.every(c => c.hudFraction <= .5 && !c.rankControlOverlap && !c.rankIntervalOverlap && c.listHeight >= c.rowHeight && c.cellOverflows.length === 0) ? 0 : 1;
