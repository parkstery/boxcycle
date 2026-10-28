import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evidence', 'final-screen');
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
  await page.clock.install();
  const url = 'http://127.0.0.1:5031/scripts/ui-800x360/preview.html';
  await page.goto(url + '?state=riding&interval&intervalMs=330000');
  await page.locator('.ride-interval-hud').waitFor();
  await page.locator('.edge-panel-tab--right').click();
  await page.locator('#lb-glance-panel').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(dir, 'riding-800x360.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 699, height: 273 });
  await page.screenshot({ path: path.join(dir, 'riding-699x273.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(url + '?state=settings');
  await page.getByRole('button', { name: '운동 설정', exact: true }).click();
  await page.getByRole('combobox', { name: '운동 프리셋' }).selectOption('recovery');
  await page.screenshot({ path: path.join(dir, 'workout-basic-800x360.png'), animations: 'disabled' });
  await page.getByRole('combobox', { name: '운동 프리셋' }).selectOption('short');
  await page.getByRole('button', { name: '직접 조절', exact: true }).click();
  await page.screenshot({ path: path.join(dir, 'workout-custom-800x360.png'), animations: 'disabled' });
  await page.goto(url + '?state=summary&variant=completed');
  await page.locator('.ride-summary__sheet').waitFor();
  await page.screenshot({ path: path.join(dir, 'result-800x360.png'), animations: 'disabled' });
  console.log(dir);
} finally {
  await browser.close();
}
