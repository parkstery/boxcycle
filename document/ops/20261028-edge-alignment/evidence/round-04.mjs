const task = await taskSpace(9);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const results = [];
results.push({ check: 'account pointer opens panel', pass: await page.evaluate(() => document.querySelector('.hud-account')?.getAttribute('aria-expanded') === 'true') });
await page.keyboard.press('Escape');
await page.waitForFunction(() => document.querySelector('.hud-account')?.getAttribute('aria-expanded') === 'false');
await page.focus('.hud-account');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('.hud-account')?.getAttribute('aria-expanded') === 'true');
results.push({ check: 'keyboard Enter opens panel', pass: true });
await page.keyboard.press('Escape');
for (const width of [800, 699]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 300, deviceScaleFactor: 1, mobile: false });
  await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&long');
  await page.waitForSelector('.hud-account');
  const pass = await page.evaluate(() => {
    const a = document.querySelector('.hud-account').getBoundingClientRect();
    const b = document.querySelector('.hud-ride-map-controls').getBoundingClientRect();
    return a.top === 0 && a.right === innerWidth && b.right <= a.left;
  });
  results.push({ check: `long metrics ${width}`, pass });
}
console.log(results);
await fs.writeFile('C:/20.HDev/boxcycle/document/ops/20261028-edge-alignment/evidence/interactions.json', JSON.stringify(results, null, 2));
if (results.some(r => !r.pass)) throw new Error('Interaction check failed');
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding');
await page.waitForSelector('.hud-account');
console.log(await page.screenshot({ path: 'C:/20.HDev/boxcycle/document/ops/20261028-edge-alignment/evidence/account-699x300.png' }));
await task.finish({ keep: [] });
