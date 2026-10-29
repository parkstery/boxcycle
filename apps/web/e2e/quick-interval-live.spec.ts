import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './open-meteo-stub';
import { ensureRideInputReady, guestStart, setSpeedKmh } from './rideEntryHelpers';

// 간편 인터벌 주행 — 실제 App + 실제 Mapbox 지도, Firebase 는 로컬 에뮬레이터만.
// getDistanceAutoRoute 응답만 page.route 로 스텁한다(탐색 결과를 결정적으로 만들기 위해).
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const evidence = path.resolve('..', '..', 'document', 'ops', '20261029-quick-interval-ride', 'evidence', 'live');

test('간편 인터벌 주행 실제 앱 800×360: 기록 없음 → 출발 클릭 → 경로·인터벌, 주행 후 → 클릭 없이 경로', async ({ page }) => {
  test.skip(!enabled, '로컬 Firebase 에뮬레이터 전용');
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  fs.mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 800, height: 360 });

  const requests: Array<{ start: [number, number]; targetRoadPoint: [number, number]; targetDistanceMeters: number }> = [];
  await page.route(/\/getDistanceAutoRoute(?:\?|$)/, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    const input = route.request().postDataJSON()?.data;
    // 연결 예열(prewarm) 요청은 탐색 요청이 아니다 — 세지 않고 빈 응답을 준다.
    if (!input?.targetRoadPoint) {
      await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"result":{}}' });
      return;
    }
    requests.push(input);
    // 요청한 방향 지점까지 직선으로 잇는 경로(길이 = 목표 거리라 「운동시간이 더 길어요」 경고가 뜨지 않는다)
    const end = input.targetRoadPoint;
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        result: {
          status: 'found', outcome: 'exact', end, distance: input.targetDistanceMeters, duration: Math.round(input.targetDistanceMeters / 6), routeTokenBalance: 99,
          targetDistanceMeters: input.targetDistanceMeters,
          geometry: { type: 'LineString', coordinates: [input.start, end] }, summary: '간편 인터벌 검수 경로',
        },
      }),
    });
  });

  await page.goto('/');
  await guestStart(page);
  const location = page.getByRole('dialog', { name: '어디에서 시작할까요?', exact: true });
  if (await location.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await location.getByRole('button', { name: '기본 위치', exact: true }).click();
    await expect(location).toBeHidden();
  }
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible();
  await page.waitForTimeout(2000);

  // (b) 기록 없음
  // 10-30 Chief: 「간편 인터벌」은 인터벌 운동 창 하단 「설정 적용」 왼쪽 — 창은 RouteDock 「INT」로 연다.
  const intervalSheet = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
  const openInterval = () => page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  await openInterval();
  const quick = intervalSheet.getByRole('button', { name: '간편 인터벌 주행', exact: true });
  await expect(quick).toBeVisible();
  await expect(quick).toBeEnabled({ timeout: 20_000 });
  await page.screenshot({ path: path.join(evidence, 'b1-interval-sheet-800x360.png'), animations: 'disabled' });
  await quick.click();
  const status = page.locator('[data-quick-interval-status]');
  await expect(status).toHaveText('출발 위치를 맵에서 클릭하세요', { timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(evidence, 'b2-pick-start-800x360.png'), animations: 'disabled' });
  expect(requests).toHaveLength(0);
  await page.mouse.click(520, 200);
  await expect.poll(() => requests.length).toBe(1);
  await expect(status).toHaveCount(0);
  const dock = page.getByRole('button', { name: '주행 시작', exact: true });
  await expect(dock).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.route-dock__interval--active')).toBeVisible();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toHaveCount(0);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(evidence, 'b3-route-applied-800x360.png'), animations: 'disabled' });

  // (a) 짧게 달려 기록을 만든 뒤 다시 메뉴 → 클릭 없이 경로
  await ensureRideInputReady(page);
  await dock.click();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeEnabled({ timeout: 30_000 });
  // 100 m 이하·5초 이하 주행은 기록하지 않는다(rideRecordPolicy) — 50 km/h 로 15초 달린다.
  await setSpeedKmh(page, 50);
  await page.waitForTimeout(15_000);
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  // 간편 경로는 저장 안 된 경로라 결과 시트가 adhoc 형태(내 경로로 저장 / 저장 안 함)로 뜬다.
  // 「저장 안 함」은 내 경로 저장만 건너뛴다 — Ride 기록과 다음 출발점은 남는다(RideSummarySheet).
  const summary = page.getByRole('region', { name: '주행 결과' });
  const skipSave = summary.getByRole('button', { name: '저장 안 함', exact: true });
  await expect(skipSave).toBeVisible({ timeout: 30_000 });
  // 시트는 뜬 직후 한 번 다시 그려진다 — 버튼이 제자리에 안정될 때까지 기다린 뒤 누른다.
  await skipSave.click({ timeout: 30_000 });
  await expect(summary).toHaveCount(0, { timeout: 20_000 });
  await openInterval();
  const quick2 = intervalSheet.getByRole('button', { name: '간편 인터벌 주행', exact: true });
  await expect(quick2).toBeEnabled({ timeout: 20_000 });
  const before = requests.length;
  await quick2.click();
  await expect.poll(() => requests.length).toBe(before + 1);
  expect(requests[before]!.start).not.toEqual(requests[0]!.start);
  await expect(page.getByRole('button', { name: '주행 시작', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(evidence, 'a1-route-from-last-ride-800x360.png'), animations: 'disabled' });
});

test('간편 인터벌 실패 배너는 한 줄이고 상단 계기판과 겹치지 않는다(800×360·667×300)', async ({ page }) => {
  test.skip(!enabled, '로컬 Firebase 에뮬레이터 전용');
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  fs.mkdirSync(evidence, { recursive: true });
  await page.route(/\/getDistanceAutoRoute(?:\?|$)/, async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    await route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ result: { status: 'failed', message: '경로를 찾지 못했습니다.', routeTokenBalance: 99 } }),
    });
  });
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await guestStart(page);
  const location = page.getByRole('dialog', { name: '어디에서 시작할까요?', exact: true });
  if (await location.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
    await location.getByRole('button', { name: '기본 위치', exact: true }).click();
    await expect(location).toBeHidden();
  }
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  await page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true }).getByRole('button', { name: '간편 인터벌 주행', exact: true }).click();
  await expect(page.locator('[data-quick-interval-status]')).toHaveText('출발 위치를 맵에서 클릭하세요', { timeout: 30_000 });
  await page.mouse.click(520, 200);
  const status = page.locator('[data-quick-interval-status]');
  await expect(status).toContainText('이 근처에서 경로를 찾지 못했어요. 출발지를 바꿔 다시 시도하세요');
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    const box = (await status.boundingBox())!;
    const textBox = (await status.locator('.quick-interval-status__text').boundingBox())!;
    expect(textBox.height, `${size.width}x${size.height} 한 줄`).toBeLessThan(20);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    const others = await page.evaluate(() => {
      const sel = ['.hud-metrics__capsule', '.hud-brand', '.map-hud__tr', '.hud-bc-trigger'];
      return sel.map(s => ({ s, r: document.querySelector(s)?.getBoundingClientRect().toJSON() ?? null }));
    });
    const overlaps = others.filter(o => o.r && !(box.x + box.width <= o.r.x || o.r.x + o.r.width <= box.x || box.y + box.height <= o.r.y || o.r.y + o.r.height <= box.y));
    console.log(`banner ${size.width}x${size.height}`, JSON.stringify(box), 'overlaps', JSON.stringify(overlaps.map(o => o.s)), JSON.stringify(others));
    expect(overlaps, `${size.width}x${size.height} 상단 조작부와 겹침`).toEqual([]);
    await page.screenshot({ path: path.join(evidence, `c1-failed-banner-${size.width}x${size.height}.png`), animations: 'disabled' });
  }
});
