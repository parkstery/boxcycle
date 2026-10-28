const task = await taskSpace(9);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const results = [];
for (const [width, height] of [[800,360],[736,360],[699,273],[667,300],[1280,720]]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  for (const state of ['ready', 'riding', 'paused']) {
    await page.goto(`http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=${state}`);
    await page.waitForSelector('.hud-account');
    const geometry = await page.evaluate(() => {
      const read = selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const account = read('.hud-account');
      const controls = read('.hud-ride-map-controls');
      const accountEl = document.querySelector('.hud-account');
      const hit = document.elementFromPoint(account.right - account.width / 2, account.y + account.height / 2);
      return { account, controls, vw: innerWidth, hit: accountEl.contains(hit), overlap: controls && account.x < controls.right && account.right > controls.x && account.y < controls.bottom && account.bottom > controls.y };
    });
    const pass = Math.abs(geometry.account.y) < 0.5 && Math.abs(geometry.account.right - geometry.vw) < 0.5 && geometry.hit && !geometry.overlap;
    results.push({ width, height, state, pass, ...geometry });
  }
}
console.log(results);
await fs.writeFile('C:/20.HDev/boxcycle/document/ops/20261028-edge-alignment/evidence/geometry.json', JSON.stringify(results, null, 2));
if (results.some(r => !r.pass)) throw new Error('Account edge alignment failed');
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 699, height: 273, deviceScaleFactor: 1, mobile: false });
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding');
await page.click('loc=css:.hud-account', { label: '계정 메뉴 열기' });
console.log(await page.snapshot());
