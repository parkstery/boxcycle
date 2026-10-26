import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './open-meteo-stub';
import { guestStart, prepareManualRideInput } from './rideEntryHelpers';

// Supervisor integration check: real App + Mapbox, Firebase writes only to local emulators.
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const evidence = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? path.resolve('..', '..', '.out', 'ui-edge-20261021');

test('실제 지도 800×360: 에지 열기·상단 지표·조밀한 도크·중앙 pan', async ({ page }) => {
  test.skip(!enabled, '로컬 Firebase 에뮬레이터 전용');
  test.setTimeout(120_000);
  page.setDefaultTimeout(12_000);
  fs.mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 800, height: 360 });
  const forbidden: string[] = [];
  await page.route(/https:\/\/[^/]*(?:googleapis\.com|firebaseio\.com|cloudfunctions\.net)\//, async route => {
    const url = new URL(route.request().url());
    if (/firestore|identitytoolkit|securetoken|firebaseio|cloudfunctions/.test(url.hostname)) {
      forbidden.push(url.origin + url.pathname);
      await route.abort();
    } else await route.continue();
  });
  await page.goto('/');
  await guestStart(page);
  const location = page.getByRole('dialog', { name: '어디에서 시작할까요?', exact: true });
  if (await location.waitFor({ state: 'visible', timeout: 8000 }).then(()=>true).catch(()=>false)) {
    await location.getByRole('button', { name: '기본 위치', exact: true }).click();
    await expect(location).toBeHidden();
  }
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible();
  await expect(page.locator('.mapboxgl-ctrl-top-right button')).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'actual-idle-800.png'), animations: 'disabled' });
  async function edge(side: 'left' | 'right') {
    const width = page.viewportSize()!.width;
    const x = side === 'left' ? 3 : width - 3;
    const dx = side === 'left' ? 115 : -115;
    await page.mouse.move(x, 155);
    await page.mouse.down();
    await page.mouse.move(x + dx, 155, { steps: 12 });
    await page.mouse.up();
  }
  await prepareManualRideInput(page);
  await page.getByRole('button',{name:/^케이던스 센서:/}).click();
  const inputSheet=page.getByRole('dialog',{name:'케이던스 센서',exact:true});
  await inputSheet.getByRole('spinbutton',{name:'속도 km/h',exact:true}).fill('30');
  await inputSheet.getByRole('spinbutton',{name:'속도 km/h',exact:true}).press('Enter');
  await inputSheet.getByRole('button',{name:'센서 설정 닫기',exact:true}).click();
  await expect(page.locator('.edge-panel-handle--left')).toBeAttached();
  await edge('left');
  const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.locator('.map-view__pick-popup')).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'actual-menu-800.png'), animations: 'disabled' });
  await menu.getByRole('button', { name: '경로 선택', exact: true }).click();
  await page.getByRole('button', { name: '입문', exact: true }).click();
  const routes = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') });
  await expect(routes).toBeVisible();
  await routes.locator('button.oc-modal__item').first().click();
  await expect(page.getByRole('button', { name: '주행 시작', exact: true })).toBeEnabled();
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(evidence, 'actual-ready-800.png'), animations: 'disabled' });
  const rows: unknown[] = [];
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => {
      const b = await page.locator('.hud-metrics__capsule').boundingBox();
      return b?.y ?? Infinity;
    }).toBeLessThanOrEqual(8);
    const geometry = await page.evaluate(() => {
      const rect = (s: string) => document.querySelector(s)?.getBoundingClientRect().toJSON();
      return { metrics: rect('.hud-metrics__capsule'), dock: rect('.route-dock-anchor'), controls: rect('.map-hud__tr'),
        canvas: rect('.mapboxgl-canvas'), brand: document.querySelector('.hud-brand')?.getBoundingClientRect().toJSON(),
        mapTrigger: document.querySelector('.hud-bc-trigger')?.getBoundingClientRect().toJSON() };
    });
    // Chief 고정11·12: 대기 카드 폭 29.4vw, 센서·접기 맨 위 줄과 S/E 주소 두 줄.
    expect(geometry.dock!.width).toBeCloseTo(size.width * 0.294, 0);
    await expect(page.locator('.route-dock__head')).toBeVisible();
    await expect(page.locator('.route-dock__stops > li')).toHaveCount(2);
    await expect(page.locator('.route-dock__badge')).toHaveText(['S', 'E']);
    const rideBar = await page.locator('.ride-control-bar').boundingBox();
    // Chief 고정1: 글자 없는 녹색 원형 재생 버튼 44px.
    const start = page.getByRole('button', { name: '주행 시작', exact: true });
    const startBox = (await start.boundingBox())!;
    expect(startBox.width).toBe(44);
    expect(startBox.height).toBe(44);
    expect((await start.innerText()).trim()).toBe('');
    await expect(start).toHaveCSS('border-radius', '50%');
    expect(await start.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('rgb(0, 150, 39)');
    expect(rideBar!.height).toBe(44);
    expect(rideBar!.x).toBeGreaterThan(size.width / 2);
    const clock = await page.locator('.hud-clock').boundingBox();
    if(clock) expect(rideBar!.y + rideBar!.height).toBeLessThanOrEqual(clock.y + 1);
    const a = geometry.metrics!, b = geometry.controls!;
    expect(a.right <= b.left || a.bottom <= b.top || b.bottom <= a.top).toBeTruthy();
    rows.push({ size, geometry });
    await page.screenshot({ path: path.join(evidence, `actual-ready-${size.width}.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 800, height: 360 });
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeEnabled();
  // Chief 고정11: 주행 시작 직후 접힘. 펼치기는 남아 있어야 한다.
  await expect(page.getByRole('button', { name: '경로 패널 펼치기', exact: true })).toBeVisible();
  await expect(page.locator('.route-dock__stops')).toBeHidden();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^케이던스 센서:/ })).toHaveCount(1);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(page.getByRole('button', { name: '재개', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '재개', exact: true }).click();
  await page.getByRole('button', { name: '경로 패널 펼치기', exact: true }).click();
  await expect(page.locator('.route-dock__stops')).toBeVisible();
  await expect(page.locator('.route-dock__remove,.route-dock__swap')).toHaveCount(0);
  await page.waitForTimeout(700);
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const metrics = document.querySelector('.hud-metrics__capsule')!.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.hud-quick-camera,.hud-ride-map-controls,.hud-account')].map(e => e.getBoundingClientRect().toJSON());
      const hits = [...document.querySelectorAll('.mapboxgl-ctrl-top-right button,.route-dock__caret,.hud-account')].filter(e => (e as HTMLElement).offsetWidth > 0).map(e => {
        const r = e.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { label: e.getAttribute('aria-label') ?? e.className, target: e.contains(hit), rect: r.toJSON(), hit: hit?.className };
      });
      return { metrics: metrics.toJSON(), controls, hits };
    });
    for (const b of geometry.controls) {
      const a = geometry.metrics;
      expect(a.right <= b.left || a.bottom <= b.top || b.bottom <= a.top, `running ${size.width} controls`).toBeTruthy();
    }
    expect(geometry.hits.every(h => h.target), JSON.stringify(geometry.hits)).toBeTruthy();
    rows.push({ state: 'riding', size, geometry });
    await page.screenshot({ path: path.join(evidence, `actual-riding-${size.width}.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 800, height: 360 });
  await edge('right');
  const map = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  await expect(map).toBeVisible();
  await expect(page.locator('.map-view__pick-popup')).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'actual-map-panel-800.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  // Chromium touch input uses the same real App edge path, rather than synthetic component events.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 3, y: 155 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 3 + i * 12, y: 155 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('dialog', { name: '메뉴', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 3, y: 155 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 35, y: 155 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 35, y: 155 }, { id: 2, x: 60, y: 185 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 135, y: 155 }, { id: 2, x: 160, y: 185 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('dialog', { name: '메뉴', exact: true })).toHaveCount(0);
  await cdp.detach();
  const canvas = page.locator('.mapboxgl-canvas').first();
  await canvas.evaluate(el => el.addEventListener('pointerdown', () => el.setAttribute('data-audit-central-pan', 'yes')));
  await page.mouse.move(420, 180);
  await page.mouse.down();
  await page.mouse.move(490, 195, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-audit-central-pan', 'yes');
  await expect(page.getByRole('dialog', { name: '메뉴', exact: true })).toHaveCount(0);
  expect(forbidden).toEqual([]);
  await expect.poll(async()=>Number.parseFloat(await page.getByLabel('주행 누적 거리',{exact:true}).innerText()),{timeout:25000}).toBeGreaterThan(0.11);
  await page.getByRole('button', {name:'주행 종료',exact:true}).click();
  await expect(page.getByRole('region',{name:'주행 결과',exact:true})).toBeVisible();
  await expect(page.locator('.ride-control-bar')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toHaveCount(0);
  await expect(page.locator('.route-dock-anchor')).toHaveCount(0);
  await page.screenshot({path:path.join(evidence,'actual-ended-idle-800.png'),animations:'disabled'});
  fs.writeFileSync(path.join(evidence, 'actual-geometry.json'), JSON.stringify(rows, null, 2));
});
