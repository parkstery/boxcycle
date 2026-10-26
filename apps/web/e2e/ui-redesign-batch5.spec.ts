import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { stubMapboxStyle } from './mapbox-stub';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await page.route('https://api.mapbox.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: '서울특별시 중구 남산공원길 · 콜로세움' }] }) }));
});

const fixtureUrl = '/scripts/ui-redesign-batch5/fixture.html';

const sizes = [
  { width: 800, height: 360 },
  { width: 667, height: 300 },
  { width: 844, height: 390 },
];

const panelStates = [
  'location',
  'distance',
  'no-start',
  'token-empty',
  'searching',
  'failed',
  'ready-start',
  'waypoints-max',
] as const;

function parsePx(value: string): number {
  return Number.parseFloat(value) || 0;
}

function pick(page: import('@playwright/test').Page) {
  return page.locator('#batch5-fixture .map-view__pick');
}

function pickHost(page: import('@playwright/test').Page) {
  return page.locator('#batch5-fixture');
}

async function shot(page: import('@playwright/test').Page, name: string, w: number, h: number) {
  if (!process.env.BATCH5_EVIDENCE_DIR) return;
  const dir = process.env.BATCH5_EVIDENCE_DIR;
  await fs.mkdir(dir, { recursive: true });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({
    path: path.join(dir, `${name}-${w}x${h}.png`),
    animations: 'disabled',
  });
}

for (const size of sizes) {
  for (const state of panelStates) {
    test(`묶음5 팝업 경계·제목 글자 ${state} ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${fixtureUrl}?state=${state}`);
      await expect(pickHost(page)).toHaveAttribute('data-fixture-ready', '1');
      const panel = pick(page);
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
      const titleLine = panel.locator('[data-testid="route-token-holding"]');
      await expect(titleLine).toBeVisible();
      const titleSize = parsePx(await titleLine.evaluate((el) => getComputedStyle(el).fontSize));
      expect(titleSize).toBeGreaterThanOrEqual(11);
      await shot(page, `batch5-${state}`, size.width, size.height);
    });
  }
}

test('Chief 고정13 — Start · +WP · End와 Start·End 탭', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=location`);
  const popup = pick(page);
  await expect(popup.locator('.map-view__pick-actions--pin-row button')).toHaveText(['Start', '+WP', 'End']);
  await expect(popup.getByRole('tab', { name: '출발·도착', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(popup.getByRole('tab', { name: '출발·도착', exact: true })).toHaveText('Start·End');
});

test('거리 탭 — ±·숫자·프리셋 칩·파란 거리 숫자', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=distance`);
  const popup = pick(page);
  await expect(popup.getByRole('tab', { name: '거리·방향', exact: true })).toHaveAttribute('aria-selected', 'true');
  const number = popup.getByRole('textbox', { name: '목표거리 km', exact: true });
  await expect(number).toHaveValue('5.0');
  const numberColor = await number.evaluate((el) => getComputedStyle(el).color);
  expect(numberColor).toBe('rgb(36, 87, 214)');
  await popup.getByRole('button', { name: '목표 거리 3km', exact: true }).click();
  await expect(number).toHaveValue('3.0');
  await popup.getByRole('button', { name: '목표 거리 0.5km 감소', exact: true }).click();
  await expect(number).toHaveValue('2.5');
  await popup.getByRole('button', { name: '목표 거리 0.5km 증가', exact: true }).click();
  await expect(number).toHaveValue('3.0');
  for (const km of [1, 3, 5, 10, 20]) {
    await expect(popup.getByRole('button', { name: `목표 거리 ${km}km`, exact: true })).toBeVisible();
  }
  await popup.getByRole('tab', { name: '출발·도착', exact: true }).click();
  await expect(popup.locator('#map-view-pick-distance-view')).toBeHidden();
  await popup.getByRole('tab', { name: '거리·방향', exact: true }).click();
  await expect(popup.locator('#map-view-pick-distance-view')).toBeVisible();
});

test('출발 없음 — popup 닫기·Start 핀·주행 자동 시작 없음', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=no-start`);
  const host = pickHost(page);
  await expect(host.locator('.map-view__pick-popup .mapboxgl-popup-close-button')).toBeVisible();
  const popup = pick(page);
  await popup.getByRole('button', { name: '출발 지점으로 설정', exact: true }).click();
  await expect(host).toHaveAttribute('data-select-point-calls', '1');
  await expect(host).toHaveAttribute('data-last-select-kind', 'start');
  await expect(host).toHaveAttribute('data-start-ride-calls', '0');
  await host.locator('.mapboxgl-popup-close-button').click();
  await expect(host).toHaveAttribute('data-close-calls', '1');
  await expect(pick(page)).toBeHidden();
});

test('토큰 부족·탐색 중·실패 상태', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=token-empty`);
  const tokenPopup = pick(page);
  await expect(tokenPopup.getByRole('button', { name: '자전거 경로', exact: true })).toBeDisabled();
  await tokenPopup.getByRole('button', { name: '자전거 경로', exact: true }).click({ force: true });
  await expect(pickHost(page)).toHaveAttribute('data-route-profile-calls', '0');

  await page.goto(`${fixtureUrl}?state=searching`);
  const searching = pick(page);
  await expect(searching.locator('.map-view__pick-auto-route-status--searching')).toBeVisible();
  await expect(searching.getByText('목표 거리에 맞는 도로 경로를 찾는 중입니다…', { exact: true })).toBeVisible();

  await page.goto(`${fixtureUrl}?state=failed`);
  const failed = pick(page);
  await expect(failed.locator('.map-view__pick-auto-route-status--failed')).toBeVisible();
  await expect(failed.getByText('경로를 찾지 못했습니다.', { exact: true })).toBeVisible();
});

test('이동수단 선택·경유 최대·실제 콜백', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=ready-start`);
  const host = pickHost(page);
  const popup = pick(page);
  await popup.getByRole('button', { name: '보행 경로', exact: true }).click();
  await expect(host).toHaveAttribute('data-route-profile-calls', '1');
  await expect(host).toHaveAttribute('data-last-profile', 'walking');
  await popup.getByRole('button', { name: '경유지 추가', exact: true }).click();
  await expect(host).toHaveAttribute('data-select-point-calls', '1');
  await expect(host).toHaveAttribute('data-last-select-kind', 'waypoint');

  await page.goto(`${fixtureUrl}?state=waypoints-max`);
  const maxPopup = pick(page);
  await expect(maxPopup.getByRole('button', { name: '경유지 추가', exact: true })).toBeDisabled();
  await maxPopup.getByRole('button', { name: '경로 전체 삭제', exact: true }).click();
  await expect(pickHost(page)).toHaveAttribute('data-clear-route-calls', '1');
});

test('Chief 고정15 — 준비 완료 「▶ 주행」 알약·주행은 버튼으로만', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=ready-start`);
  const host = pickHost(page);
  const popup = pick(page);
  const play = popup.getByRole('button', { name: '주행 시작', exact: true });
  await expect(host).toHaveAttribute('data-start-ride-calls', '0');
  await expect(play).toBeEnabled();
  // 10-26 Chief: 녹색 원 재생 아이콘 + 「주행」 글자, 「경로 삭제」와 같은 높이·알약 모양.
  expect((await play.textContent())?.trim()).toBe('주행');
  const look = await popup.evaluate((el) => {
    const ride = el.querySelector<HTMLElement>('.map-view__pick-btn--start-ride')!;
    const clear = el.querySelector<HTMLElement>('.map-view__pick-btn--clear-route')!;
    const icon = ride.querySelector<HTMLElement>('.map-view__pick-start-ride-icon')!;
    const r = ride.getBoundingClientRect(), c = clear.getBoundingClientRect();
    return { iconBg: getComputedStyle(icon).backgroundImage, rideH: r.height, clearH: c.height,
      rideRadius: parseFloat(getComputedStyle(ride).borderTopLeftRadius), clearRadius: parseFloat(getComputedStyle(clear).borderTopLeftRadius),
      rideBorder: getComputedStyle(ride).borderTopColor, clearBorder: getComputedStyle(clear).borderTopColor, gap: c.left - r.right };
  });
  expect(look.iconBg).toContain('rgb(35, 214, 92)');
  expect(look.rideH).toBe(look.clearH);
  expect(look.rideRadius).toBeGreaterThanOrEqual(look.rideH / 2);
  expect(look.clearRadius).toBeGreaterThanOrEqual(look.clearH / 2);
  expect(look.rideBorder).toBe(look.clearBorder);
  expect(look.gap).toBeGreaterThan(0);
  await play.click();
  await expect(host).toHaveAttribute('data-start-ride-calls', '1');
  await popup.getByRole('button', { name: '자전거 경로', exact: true }).click();
  await expect(host).toHaveAttribute('data-start-ride-calls', '1');
});

test('dock 닫기 콜백', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=location`);
  const host = pickHost(page);
  await host.locator('.map-view__pick-dock-close').click();
  await expect(host).toHaveAttribute('data-close-calls', '1');
  await expect(pick(page)).toBeHidden();
});

test('준비 전 재생 비활성·키보드 탭 전환·거리 숫자 입력', async ({ page }) => {
  await page.goto(`${fixtureUrl}?state=location`);
  const popup = pick(page);
  await expect(popup.getByRole('button', { name: '주행 시작', exact: true })).toBeDisabled();
  await expect(pickHost(page)).toHaveAttribute('data-start-ride-calls', '0');
  const tab = popup.getByRole('tab', { name: '출발·도착', exact: true });
  await tab.focus();
  await tab.press('ArrowRight');
  await expect(popup.getByRole('tab', { name: '거리·방향', exact: true })).toBeFocused();
  const number = popup.getByRole('textbox', { name: '목표거리 km', exact: true });
  await number.fill('7.5');
  await number.press('Enter');
  await expect(number).toHaveValue('7.5');
  await expect(pickHost(page)).toHaveAttribute('data-start-ride-calls', '0');
  await expect.poll(async () => Number(await pickHost(page).getAttribute('data-arm-direction-calls'))).toBeGreaterThan(0);
});

test('실제 지도 첫 팝업은 낮은 화면에서도 제목·닫기까지 화면 안', async ({ page }) => {
  for (const size of [{width:800,height:360},{width:667,height:300},{width:690,height:275}]) {
    await page.setViewportSize(size);
    await stubMapboxStyle(page);
    await page.goto('/scripts/ui-800x360/map-route-runtime.html');
    await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
    await page.mouse.move(size.width * .6, size.height / 2);
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    const popup = page.locator('.map-view__pick-popup');
    await expect(popup).toBeVisible();
    await expect.poll(async () => {
      const r = await popup.boundingBox();
      return r != null && r.x >= 0 && r.y >= 0 && r.x + r.width <= size.width && r.y + r.height <= size.height;
    }).toBe(true);
    await expect(popup.locator('.mapboxgl-popup-close-button')).toBeVisible();
    await shot(page, 'batch5-real-first-popup', size.width, size.height);
  }
});
