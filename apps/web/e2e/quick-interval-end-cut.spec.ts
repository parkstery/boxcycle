import path from 'node:path';
import { test, expect } from './open-meteo-stub';
import { chooseColosseumIfNeeded, ensureRideInputReady, guestStart, loadIntroCourse, openCadenceSheet, closeCadenceSheet } from './rideEntryHelpers';

const routeMeters = 1200;
const evidence = path.resolve('../../tmp/quick-interval-end-cut');
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const emulator = /^(127\.0\.0\.1|localhost):\d+$/.test(host);
const documents = `http://${host}/v1/projects/boxcycle-dc2df/databases/(default)/documents`;
const headers = { Authorization: 'Bearer owner' };

test.use({ viewport: { width: 800, height: 360 } });
test.describe.configure({ timeout: 110_000 });
test.skip(!emulator, '로컬 Firestore 에뮬레이터 전용');

test.beforeEach(async ({ page }, testInfo) => {
  page.setDefaultTimeout(15_000);
  await page.route(/\/getDistanceAutoRoute(?:\?|$)/, async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const input = route.request().postDataJSON()?.data;
    if (!input?.targetRoadPoint) return route.fulfill({ json: { result: {} }, headers: cors });
    const start: [number, number] = input.start;
    const end: [number, number] = [start[0] + 0.02, start[1]];
    return route.fulfill({ headers: cors, json: { result: {
      status: 'found', outcome: 'exact', end, distance: routeMeters, duration: 180,
      routeTokenBalance: 99, targetDistanceMeters: input.targetDistanceMeters,
      geometry: { type: 'LineString', coordinates: [start, end] }, summary: '간편 인터벌 자르기 검수',
    } } });
  });
  await page.goto('/');
  await guestStart(page);
  await chooseColosseumIfNeeded(page, false);
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible();
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
  await settings.getByRole('button', { name: '직접 조절', exact: true }).click();
  for (const [name, value] of [
    ['고강도 시간 초', testInfo.title.includes(' manual:') ? '40' : '15'], ['저강도 시간 초', '5'], ['반복 수', '1'],
    ['라운드 수', '1'], ['라운드 사이 휴식 시간 초', '0'], ['준비 시간 초', '0'], ['마무리 시간 초', '0'],
  ]) await settings.getByRole('spinbutton', { name, exact: true }).fill(value);
  await settings.getByRole('button', { name: '접기', exact: true }).click();
  await settings.getByRole('button', { name: '간편 인터벌 주행', exact: true }).click();
  await expect(page.locator('[data-quick-interval-status]')).toHaveText('출발 위치를 맵에서 클릭하세요');
  await page.mouse.click(520, 200);
  await expect(page.getByRole('button', { name: '주행 시작', exact: true })).toBeVisible();
  await expect(page.locator('.map-hud__rail-int--active')).toBeVisible();
  await ensureRideInputReady(page);
  const sensor = await openCadenceSheet(page);
  await sensor.getByRole('slider', { name: '세션 속도 km/h' }).fill('50');
  await closeCadenceSheet(page);
});

for (const mode of ['auto', 'manual'] as const) {
  test(`간편 인터벌 ${mode}: 실제 움직인 부분만 완주 경로로 저장`, async ({ page, request }) => {
    test.setTimeout(110_000);
    const end = page.getByRole('button', { name: '주행 종료', exact: true });
    await page.getByRole('button', { name: '주행 시작', exact: true }).click();
    await expect(end).toBeVisible();
    if (mode === 'manual') {
      await expect(page.locator('[data-phase="work"] [role="timer"]')).toHaveAttribute('aria-label', /남은 시간 1[5-9]초/, { timeout: 40_000 });
      if (!(await end.isVisible())) await page.mouse.click(520, 200);
      await end.click();
    }
    const summary = page.getByRole('region', { name: '주행 결과' });
    await expect(summary).toBeVisible({ timeout: 35_000 });
    await expect(summary).toContainText(mode === 'auto' ? '프로그램 완료 1/1회' : '프로그램 완료 0/1회');
    await page.screenshot({ path: path.join(evidence, `${mode}-result.png`) });
    const name = `간편 구간 검수 ${mode} ${Date.now()}`;
    const save = summary.getByRole('button', { name: '내 경로로 저장', exact: true });
    await expect(save).toBeVisible({ timeout: 25_000 });
    await summary.getByRole('textbox', { name: '저장할 경로 이름' }).fill(name);
    await save.click();

    let fields: Record<string, Record<string, string | number>> | undefined;
    await expect.poll(async () => {
      const response = await request.get(`${documents}/savedRoutes`, { headers });
      const body = await response.json();
      fields = body.documents?.find((row: { fields: { name?: { stringValue?: string } } }) => row.fields.name?.stringValue === name)?.fields;
      return Number(fields?.completed?.integerValue);
    }, { timeout: 25_000 }).toBe(1);
    const distance = Number(fields?.distanceMeters?.doubleValue ?? fields?.distanceMeters?.integerValue);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(routeMeters);
    expect(Number(fields?.lastProgressRatio?.doubleValue ?? fields?.lastProgressRatio?.integerValue)).toBe(1);
    const coords = JSON.parse(String(fields?.geometryCoordsJson?.stringValue));
    expect(coords).toHaveLength(2);
    expect(coords[1][0] - coords[0][0]).toBeGreaterThan(0);
    expect(coords[1][0] - coords[0][0]).toBeLessThan(0.019);
    const ride = await (await request.get(`${documents}/rides/${fields?.lastRideId?.stringValue}`, { headers })).json();
    expect(Number(ride.fields.routeDistanceMeters.integerValue ?? ride.fields.routeDistanceMeters.doubleValue)).toBe(routeMeters);
    expect(Number(ride.fields.distanceMeters.doubleValue ?? ride.fields.distanceMeters.integerValue)).toBeCloseTo(distance, 2);
  });
}

test('간편 경로를 일반 경로로 교체하면 인터벌 완료 뒤에도 계속 주행한다', async ({ page }) => {
  test.setTimeout(105_000);
  await loadIntroCourse(page);
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.getByRole('timer', { name: '인터벌 완료', exact: true })).toBeVisible({ timeout: 35_000 });
  const end = page.getByRole('button', { name: '주행 종료', exact: true });
  if (!(await end.isVisible())) await page.mouse.click(520, 200);
  await expect(end).toBeVisible();
  await expect(page.getByRole('region', { name: '주행 결과' })).toBeHidden();
  await page.screenshot({ path: path.join(evidence, 'replaced-regular-still-riding.png') });
});
