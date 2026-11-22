import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// 경로 거리 부족 안내(2026-10-29 Chief) — 실제 훅·안내창·인터벌 운동 창. 경로 적용만 버튼으로 대신한다.
const harness = '/scripts/interval-route-hint/interval-route-hint-runtime.html';
const evidence = process.env.INTERVAL_ROUTE_HINT_EVIDENCE_DIR ?? path.resolve('../../document/ops/20261029-interval-route-hint/evidence');

const hint = (page: Page) => page.getByRole('dialog', { name: '경로가 짧아요', exact: true });
const sheet = (page: Page) => page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
const stateOf = async (page: Page) => JSON.parse((await page.locator('#hint-runtime-state').textContent()) ?? '{}');
const shot = async (page: Page, name: string) => {
  await fs.mkdir(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, name), animations: 'disabled' });
};
async function open(page: Page) {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(harness);
  await expect(page.getByRole('button', { name: '경로 4 km' })).toBeVisible();
}
/** 인터벌 운동 창에서 스위치로 켜고 닫는다(15분 프리셋이 기본) */
async function turnIntervalOn(page: Page) {
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  await sheet(page).getByRole('switch', { name: '인터벌', exact: true }).check();
  await expect.poll(async () => (await stateOf(page)).intervalOn).toBe(true);
}
const closeSheet = (page: Page) => page.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();

test('(a) 인터벌 15분을 켠 뒤 4 km 경로 → 경우 1 안내, 확인 뒤 같은 조합은 다시 안 뜬다', async ({ page }) => {
  await open(page);
  await turnIntervalOn(page);
  await closeSheet(page);
  expect((await stateOf(page)).intervalSec).toBe(900);
  await expect(hint(page)).toHaveCount(0); // 경로가 없으면 안내 없음
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-variant', 'route');
  await expect(hint(page)).toContainText('인터벌 운동(15:00)을 마치려면 경로가 최소 6.3 km 필요해요. 지금 경로는 4.0 km예요. 경로를 더 길게 잡아 주세요.');
  await expect(hint(page)).toContainText('시속 25 km 기준');
  // 버튼은 「확인」 하나, 창은 화면 안(고정48 과 같은 흰 창)
  await expect(hint(page).locator('.interval-route-confirm__actions button')).toHaveText(['확인']);
  const box = (await hint(page).locator('.interval-route-confirm__panel').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(330);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(360);
  await shot(page, 'a-route-after-interval-800x360.png');
  await hint(page).getByRole('button', { name: '확인', exact: true }).click();
  await expect(hint(page)).toHaveCount(0);
  // 같은 (경로 + 인터벌) 조합: 경로를 다시 적용해도, 지웠다 다시 잡아도 안 뜬다.
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await page.getByRole('button', { name: '경로 지우기' }).click();
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await expect.poll(async () => (await stateOf(page)).meters).toBe(4000);
  await expect(hint(page)).toHaveCount(0);
  // Esc 로도 닫힌다(다른 조합에서 확인) — 7 km 는 안 뜨고, 스위치를 껐다 켜면 조합이 같아 여전히 안 뜬다.
  await page.getByRole('button', { name: '경로 7 km' }).click();
  await expect(hint(page)).toHaveCount(0);
});

test('(b) 4 km 경로를 먼저 잡고 인터벌 15분을 켬 → 설정 창이 닫힌 뒤 경우 2 안내', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await expect(hint(page)).toHaveCount(0); // 인터벌이 꺼져 있으면 안내 없음
  await turnIntervalOn(page);
  // 창이 열려 있는 동안은 겹치지 않는다.
  await expect(sheet(page)).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
  await closeSheet(page);
  await expect(sheet(page)).toHaveCount(0);
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveAttribute('data-variant', 'interval');
  await expect(hint(page)).toContainText('이 인터벌 설정(15:00)에는 6.3 km 이상의 경로를 권해요. 지금 경로는 4.0 km예요.');
  await expect(hint(page)).toContainText('시속 25 km 기준');
  await shot(page, 'b-interval-after-route-800x360.png');
  await page.keyboard.press('Escape');
  await expect(hint(page)).toHaveCount(0);
  // 설정을 바꿔 적용하면(10분 → 최소 4.2 km) 새 조합이라 다시 안내한다.
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  await sheet(page).getByRole('combobox', { name: '운동 프리셋' }).selectOption({ label: '10분' });
  await sheet(page).getByRole('button', { name: '설정 적용', exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(hint(page)).toContainText('이 인터벌 설정(10:00)에는 4.2 km 이상의 경로를 권해요. 지금 경로는 4.0 km예요.');
});

test('(c) 7 km 경로 + 15분 → 안내 없음, 간편 인터벌이 만든 경로에도 안내 없음', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '경로 7 km' }).click();
  await turnIntervalOn(page);
  await closeSheet(page);
  await expect.poll(async () => (await stateOf(page)).intervalOn).toBe(true);
  await expect(hint(page)).toHaveCount(0);
  await shot(page, 'c-long-route-no-hint-800x360.png');
  // 주행 시작 경고도 없다.
  await page.getByRole('button', { name: '주행 시작' }).click();
  await expect.poll(async () => (await stateOf(page)).status).toBe('running');

  // 간편 인터벌 경로(짧게 돌아와도)는 안내하지 않는다.
  await open(page);
  await page.getByRole('button', { name: '간편 탐색 시작' }).click();
  await page.getByRole('button', { name: '간편 경로 적용' }).click();
  await expect.poll(async () => (await stateOf(page)).intervalOn).toBe(true);
  expect((await stateOf(page)).meters).toBe(4000);
  await expect(hint(page)).toHaveCount(0);
  // 그 뒤 사용자가 직접 다시 잡은 짧은 경로에는 안내한다(간편 표시가 새어 남지 않는다).
  await page.getByRole('button', { name: '경로 지우기' }).click();
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await expect(hint(page)).toBeVisible();
});

test('(d) 주행 시작 경고는 25 km/h 기준으로 뜬다', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '경로 4 km' }).click();
  await turnIntervalOn(page);
  await closeSheet(page);
  await hint(page).getByRole('button', { name: '확인', exact: true }).click();
  await page.getByRole('button', { name: '주행 시작' }).click();
  const warn = page.getByRole('dialog', { name: '운동시간이 더 길어요', exact: true });
  await expect(warn).toBeVisible();
  await expect(warn).toContainText('예상 속도 25.0 km/h 기준');
  await expect(hint(page)).toHaveCount(0); // 두 창이 겹치지 않는다
  await shot(page, 'd-start-warning-25kmh-800x360.png');
  await warn.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect.poll(async () => (await stateOf(page)).status).toBe('running');
  await expect(hint(page)).toHaveCount(0); // 주행 중에는 안내 없음
});
