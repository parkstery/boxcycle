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
      const titleLine = panel.locator('.map-view__pick-title');
      await expect(titleLine).toBeVisible();
      const titleSize = parsePx(await titleLine.evaluate((el) => getComputedStyle(el).fontSize));
      expect(titleSize).toBeGreaterThanOrEqual(11);
      await shot(page, `batch5-${state}`, size.width, size.height);
    });
  }
}

test('Chief 고정13 — Start · +WP · End와 아이콘 탭', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=location`);
  const popup = pick(page);
  await expect(popup.locator('.map-view__pick-actions--pin-row button')).toHaveText(['Start', '+WP', 'End']);
  const locationTab = popup.getByRole('tab', { name: '출발·도착', exact: true });
  const distanceTab = popup.getByRole('tab', { name: '거리·방향', exact: true });
  await expect(locationTab).toHaveAttribute('aria-selected', 'true');
  await expect(locationTab).toHaveAttribute('title', '출발·도착');
  await expect(distanceTab).toHaveAttribute('title', '거리·방향');
  await expect(locationTab.locator('svg')).toHaveCount(1);
  await expect(distanceTab.locator('svg')).toHaveCount(2);
  await expect(locationTab).not.toHaveText(/Start|End|출발|도착/);
  await expect(distanceTab).not.toHaveText(/거리|방향/);
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

test('Chief 고정15 — 하단 삭제·녹색 주행·주행은 버튼으로만', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${fixtureUrl}?state=ready-start`);
  const host = pickHost(page);
  const popup = pick(page);
  const play = popup.getByRole('button', { name: '주행 시작', exact: true });
  await expect(host).toHaveAttribute('data-start-ride-calls', '0');
  await expect(play).toBeEnabled();
  // Chief 10-29: 맨 아래 줄 오른쪽 끝 녹색 원 재생, 삭제는 바로 왼쪽.
  expect((await play.textContent())?.trim()).toBe('');
  const look = await popup.evaluate((el) => {
    const ride = el.querySelector<HTMLElement>('.map-view__pick-btn--start-ride')!;
    const clear = el.querySelector<HTMLElement>('.map-view__pick-btn--clear-route')!;
    const icon = ride.querySelector<HTMLElement>('.map-view__pick-start-ride-icon')!;
    const r = ride.getBoundingClientRect(), c = clear.getBoundingClientRect();
    const row = el.querySelector<HTMLElement>('.map-view__pick-profile-bottom-row')!.getBoundingClientRect();
    return { iconBg: getComputedStyle(icon).backgroundImage, rideBorderW: parseFloat(getComputedStyle(ride).borderTopWidth),
      rideBg: getComputedStyle(ride).backgroundColor, rightGap: row.right - r.right,
      clearInFooter: !!clear.closest('.map-view__pick-profile-bottom-row'), clearBorder: getComputedStyle(clear).borderTopColor, clearBefore: c.right < r.left && Math.abs(c.top + c.height / 2 - r.top - r.height / 2) < 1 };
  });
  expect(look.iconBg).toContain('rgb(35, 214, 92)');
  expect(look.rideBorderW).toBe(0);
  expect(look.rideBg).toBe('rgba(0, 0, 0, 0)');
  expect(look.rightGap).toBeLessThan(1);
  expect(look.clearInFooter).toBe(true);
  expect(look.clearBorder).toBe('rgb(220, 38, 38)');
  expect(look.clearBefore).toBe(true);
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

const compactSizes = [
  { width: 800, height: 360 },
  { width: 736, height: 300 },
  { width: 699, height: 273 },
  { width: 667, height: 300 },
  { width: 320, height: 568 },
];

test('승인 시안 — 두 모드 228·헤더 한줄·하단 삭제·66px 지점', async ({ page }) => {
  for (const size of compactSizes) {
    for (const state of ['location', 'distance', 'no-start'] as const) {
      await page.setViewportSize(size);
      await page.goto(`${fixtureUrl}?state=${state}`);
      await expect(pickHost(page)).toHaveAttribute('data-fixture-ready', '1');
      const popup = pick(page);
      await expect(popup).toBeVisible();
      if (state === 'no-start') {
        await expect(pickHost(page).locator('.map-view__pick-popup')).toBeVisible();
      } else {
        await expect(pickHost(page).locator('.map-view__pick-dock-panel')).toBeVisible();
      }
      const geom = await popup.evaluate((el) => {
        const rect = (node: Element | null) => {
          if (!node) return null;
          const b = node.getBoundingClientRect();
          return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, btm: b.bottom };
        };
        const overlap = (a: DOMRect, b: DOMRect) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const sizeOf = (n: HTMLElement) => ({ w: n.offsetWidth, h: n.offsetHeight });
        const tabs = [...el.querySelectorAll<HTMLElement>('.map-view__pick-route-tab')].map(sizeOf);
        const pins = [...el.querySelectorAll<HTMLElement>('.map-view__pick-actions--pin-row .map-view__pick-btn')].map(sizeOf);
        const chips = [...el.querySelectorAll<HTMLElement>('.map-view__pick-distance-chip')].map(sizeOf);
        const clear = el.querySelector<HTMLElement>('.map-view__pick-btn--clear-route')!.getBoundingClientRect();
        const tabsBox = el.querySelector<HTMLElement>('.map-view__pick-route-tabs')!.getBoundingClientRect();
        const tabsRow = el.querySelector<HTMLElement>('.map-view__pick-tabs-row')!.getBoundingClientRect();
        const footer = el.querySelector<HTMLElement>('.map-view__pick-profile-bottom-row')!.getBoundingClientRect();
        const profiles = [...el.querySelectorAll<HTMLElement>('.map-view__pick-btn--profile')].map(sizeOf);
        const playEl = el.querySelector<HTMLElement>('.map-view__pick-btn--start-ride')!;
        const playBox = playEl.getBoundingClientRect();
        const play = { w: playEl.offsetWidth, h: playEl.offsetHeight, r: playBox.right };
        const distanceRow = el.querySelector<HTMLElement>('.map-view__pick-distance-row');
        const caption = el.querySelector<HTMLElement>('.map-view__pick-distance-caption');
        const minus = el.querySelector<HTMLElement>('.map-view__pick-distance-step--minus');
        const number = el.querySelector<HTMLElement>('.map-view__pick-distance-number');
        const unit = el.querySelector<HTMLElement>('.map-view__pick-distance-unit');
        const plus = el.querySelector<HTMLElement>('.map-view__pick-distance-step--plus');
        return {
          panel: rect(el)!,
          overflowX: el.scrollWidth - el.clientWidth,
          tabs,
          pins,
          chips,
          clearInFooter: !!el.querySelector('.map-view__pick-profile-bottom-row .map-view__pick-btn--clear-route'),
          clearBefore: clear.right < playBox.left && Math.abs(clear.top + clear.height / 2 - playBox.top - playBox.height / 2) < 1,
          heading: rect(el.querySelector('.map-view__pick-title'))!,
          header: rect(el.querySelector('.map-view__pick-header-row'))!,
          tabsBox: rect(el.querySelector('.map-view__pick-route-tabs'))!,
          close: rect(el.parentElement!.querySelector('.map-view__pick-dock-close, .mapboxgl-popup-close-button'))!,
          captionFont: caption ? getComputedStyle(caption).fontSize : '',
          tabsClearOverlap: overlap(tabsBox, clear),
          tabsRowWrap: tabsRow.height > 40,
          footerWrap: footer.height > 40,
          profiles,
          play,
          footerRight: footer.right,
          distanceVisible: distanceRow ? getComputedStyle(distanceRow).display !== 'none' && !(distanceRow as HTMLElement).hidden : false,
          distanceRow: distanceRow && !distanceRow.hidden ? {
            row: rect(distanceRow),
            caption: rect(caption),
            minus: rect(minus),
            number: rect(number),
            unit: rect(unit),
            plus: rect(plus),
          } : null,
        };
      });
      expect(Math.abs(geom.panel.w - 228), `${state} ${size.width} 폭`).toBeLessThanOrEqual(1);
      expect(geom.overflowX, `${state} ${size.width} overflow`).toBeLessThanOrEqual(1);
      expect(geom.tabs).toHaveLength(2);
      // 10-30 Chief: 모드 버튼 38→57px(1.5배), 창 228 유지
      expect(geom.tabs.every((t) => Math.abs(t.w - 57) <= 1 && Math.abs(t.h - 26) <= 1)).toBe(true);
      expect(geom.clearInFooter).toBe(true);
      expect(geom.clearBefore).toBe(true);
      expect(geom.heading.r).toBeLessThanOrEqual(geom.tabsBox.x);
      expect(geom.tabsBox.r).toBeLessThanOrEqual(geom.close.x);
      expect(geom.header.h).toBeLessThanOrEqual(32);
      // 10-30 Chief A안: 보이는 건 지도 핀 아이콘, 낭독 이름은 「경로」
      await expect(popup.getByRole('heading', { name: '경로', exact: true })).toBeVisible();
      await expect(popup.locator('.map-view__pick-title > svg.map-view__pick-title-ico')).toBeVisible();
      expect(geom.heading.w).toBeLessThanOrEqual(24);
      expect(geom.tabsClearOverlap).toBe(false);
      expect(geom.tabsRowWrap).toBe(false);
      expect(geom.footerWrap).toBe(false);
      expect(geom.profiles, `${state} ${size.width} 수단 ${JSON.stringify(geom.profiles)}`).toHaveLength(3);
      expect(geom.profiles.every((p) => Math.abs(p.w - 28) <= 1 && Math.abs(p.h - 28) <= 1), `${state} ${size.width} 수단 ${JSON.stringify(geom.profiles)}`).toBe(true);
      expect(Math.abs(geom.play.w - 32) <= 1 && Math.abs(geom.play.h - 32) <= 1).toBe(true);
      expect(geom.footerRight - geom.play.r).toBeLessThan(1);
      if (state !== 'distance') {
        expect(geom.pins).toHaveLength(3);
        expect(geom.pins.every((p) => Math.abs(p.w - 66) <= 1 && Math.abs(p.h - 28) <= 1)).toBe(true);
      } else {
        expect(geom.chips).toHaveLength(5);
        expect(geom.chips.every((c) => Math.abs(c.w - 30) <= 1 && Math.abs(c.h - 28) <= 1)).toBe(true);
        expect(geom.distanceVisible).toBe(true);
        expect(geom.captionFont).toBe('14px');
        const row = geom.distanceRow!;
        expect(row.row!.w).toBeLessThanOrEqual(204 + 1);
        expect(row.caption!.btm - 1).toBeLessThanOrEqual(row.minus!.y + row.minus!.h);
        expect(row.minus!.r).toBeLessThanOrEqual(row.number!.x + 1);
        expect(row.number!.r).toBeLessThanOrEqual(row.unit!.x + 1);
        expect(row.unit!.r).toBeLessThanOrEqual(row.plus!.x + 1);
      }
      await shot(page, `compact-${state}`, size.width, size.height);
    }
  }
});

test('긴 주소·큰 거리 입력은 228 안에서 줄바꿈·서식 유지', async ({ page }) => {
  await page.setViewportSize({ width: 699, height: 273 });
  await page.goto(`${fixtureUrl}?state=location`);
  const popup = pick(page);
  await popup.evaluate((el) => {
    const address = el.querySelector<HTMLElement>('.map-view__pick-address')!;
    address.textContent = '서울특별시 종로구 세종대로 209 서울특별시청 본관 앞';
    address.title = address.textContent;
  });
  const locGeom = await popup.evaluate((el) => {
    const address = el.querySelector<HTMLElement>('.map-view__pick-address')!;
    return { overflowX: el.scrollWidth - el.clientWidth, wrap: address.scrollHeight > 18, title: address.title };
  });
  expect(locGeom.overflowX).toBeLessThanOrEqual(1);
  expect(locGeom.wrap).toBe(true);
  expect(locGeom.title).toContain('세종대로');

  await page.goto(`${fixtureUrl}?state=distance`);
  const dist = pick(page);
  const number = dist.getByRole('textbox', { name: '목표거리 km', exact: true });
  await number.fill('120');
  await number.press('Enter');
  await expect(number).toHaveValue('120.0');
  const distGeom = await dist.evaluate((el) => {
    const row = el.querySelector<HTMLElement>('.map-view__pick-distance-row')!;
    const numberEl = el.querySelector<HTMLElement>('.map-view__pick-distance-number')!;
    const plus = el.querySelector<HTMLElement>('.map-view__pick-distance-step--plus')!;
    return {
      overflowX: el.scrollWidth - el.clientWidth,
      rowW: row.getBoundingClientRect().width,
      numberRight: numberEl.getBoundingClientRect().right,
      plusLeft: plus.getBoundingClientRect().left,
    };
  });
  expect(distGeom.overflowX).toBeLessThanOrEqual(1);
  expect(distGeom.rowW).toBeLessThanOrEqual(204 + 1);
  expect(distGeom.numberRight).toBeLessThanOrEqual(distGeom.plusLeft + 1);
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


test('재배치 후 토큰 안내·양끝 정렬·시안 높이', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 300 });
  for (const state of ['location', 'distance']) {
    await page.goto(`${fixtureUrl}?state=${state}`);
    const popup = pick(page);
    await expect(popup).toBeVisible();
    const geometry = await popup.evaluate((el, state) => {
      const row = el.querySelector(state === 'location' ? '.map-view__pick-actions--pin-row' : '.map-view__pick-distance-chips')!;
      const buttons = [...row.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      const r = row.getBoundingClientRect();
      return { h: el.getBoundingClientRect().height, left: buttons[0].left - r.left, right: r.right - buttons.at(-1)!.right };
    }, state);
    expect(geometry.h).toBe(state === 'location' ? 160 : 194);
    expect(Math.abs(geometry.left)).toBeLessThan(1);
    expect(Math.abs(geometry.right)).toBeLessThan(1);
  }
  await page.evaluate(() => { window.__rtwForceGenerateCostBase = 1; });
  const popup = pick(page);
  const feedback = popup.getByTestId('route-token-popup-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('잔여 토큰 8개');
  const bounds = await popup.evaluate(el => {
    const header = el.querySelector('.map-view__pick-header-row')!.getBoundingClientRect();
    const feedback = el.querySelector('.map-view__pick-token')!.getBoundingClientRect();
    return { headerBottom: header.bottom, feedbackTop: feedback.top, overflow: el.scrollWidth - el.clientWidth };
  });
  expect(bounds.feedbackTop).toBeGreaterThanOrEqual(bounds.headerBottom);
  expect(bounds.overflow).toBe(0);
  await expect(popup.getByRole('tab', { name: '거리·방향', exact: true })).toBeVisible();
});

test('10-30 Chief — 출발 없음에서 모드를 바꿔도 창 높이 같음', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto(`${fixtureUrl}?state=no-start`);
    await expect(pickHost(page)).toHaveAttribute('data-fixture-ready', '1');
    const popup = pick(page);
    const location = await popup.evaluate((el) => el.getBoundingClientRect().height);
    await popup.getByRole('tab', { name: '거리·방향', exact: true }).click();
    await expect(popup.locator('.map-view__pick-route-distance-prereq')).toBeVisible();
    const distance = await popup.evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(distance - location), `${size.width} 출발/도착 ${location} · 거리/방향 ${distance}`).toBeLessThanOrEqual(0.5);
  }
});
