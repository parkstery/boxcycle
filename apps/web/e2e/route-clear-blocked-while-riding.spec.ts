import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stubMapboxStyle } from './mapbox-stub';

// 지시93 — 주행 중 「경로 삭제」: 경로·팝업을 그대로 두고 확인 창만 띄운다. 실제 MapView + 실제 팝업 + 실제 확인 창.
// 증거 캡처는 RTW_ROUTE_CLEAR_SHOT_DIR (리포 밖)로만 쓴다. 없으면 캡처하지 않는다.
test.use({ viewport: { width: 800, height: 360 }, hasTouch: true });

async function openPopupWithRoute(page: import('@playwright/test').Page, url: string) {
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(url);
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  const surface = page.locator('.map-view__pick');
  const hold = async (x: number, y: number) => { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); };
  await hold(400, 170);
  await expect(surface).toHaveCount(1);
  await surface.getByRole('button', { name: '출발 지점으로 설정', exact: true }).click();
  await hold(600, 180);
  await expect(surface).toHaveCount(1);
  await surface.getByRole('button', { name: '도착 지점으로 설정', exact: true }).click();
  await expect(page.locator('#runtime-state')).not.toContainText('"end":null');
  return surface;
}

test('주행 중 경로 삭제: 안내 창만 뜨고 경로·팝업 그대로, 계속 주행/Esc/바깥 클릭은 창만 닫고, 주행 종료 뒤에는 지워진다', async ({ page }) => {
  test.setTimeout(90_000);
  const surface = await openPopupWithRoute(page, '/scripts/ui-800x360/map-route-runtime.html?riding=1');
  const state = page.locator('#runtime-state');
  const dialog = page.getByRole('dialog', { name: '주행 중 경로 삭제 안내' });
  const clearBtn = surface.getByRole('button', { name: '경로 전체 삭제', exact: true });
  const before = await state.textContent();
  const shotDir = process.env.RTW_ROUTE_CLEAR_SHOT_DIR;
  if (shotDir) mkdirSync(shotDir, { recursive: true });

  await clearBtn.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('주행 중에는 경로를 지울 수 없습니다')).toBeVisible();
  await expect(dialog.getByText('주행을 종료한 뒤 경로를 지울 수 있어요.')).toBeVisible();
  // 경로·핀·팝업은 그대로, 주행 계속
  await expect(state).toContainText('"rideStatus":"running"');
  await expect(state).not.toContainText('"start":null');
  await expect(state).not.toContainText('"end":null');
  await expect(surface).toHaveCount(1);
  // 크기·글자 기준: 폭 ≤ 320px, 글자 ≥ 10px
  const panel = dialog.locator('.route-clear-blocked__panel');
  const box = await panel.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(320);
  const fonts = await dialog.locator('*').evaluateAll((els) => els.filter((e) => (e.textContent ?? '').trim() && e.children.length === 0).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(Math.min(...fonts)).toBeGreaterThanOrEqual(10);
  if (shotDir) await page.screenshot({ path: join(shotDir, 'route-clear-blocked-800x360.png') });

  // Esc = 계속 주행
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(surface).toHaveCount(1);
  // 바깥 클릭 = 계속 주행
  await clearBtn.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);
  // 「계속 주행」 버튼
  await clearBtn.click();
  await dialog.getByRole('button', { name: '계속 주행', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(state).toContainText('"endRideCalls":0');
  expect(await state.textContent()).toContain('"rideStatus":"running"');
  expect(JSON.parse((await state.textContent())!)).toMatchObject({ start: JSON.parse(before!).start, end: JSON.parse(before!).end });

  // 「주행 종료」 = 기존 종료 흐름만 호출, 경로는 자동으로 지우지 않는다
  await clearBtn.click();
  await dialog.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(state).toContainText('"endRideCalls":1');
  await expect(state).toContainText('"rideStatus":"idle"');
  await expect(state).not.toContainText('"start":null');
  await expect(state).not.toContainText('"end":null');

  // 종료 뒤에는 평소처럼 지워진다
  await clearBtn.click();
  await expect(state).toContainText('"start":null');
  await expect(state).toContainText('"end":null');
  await expect(dialog).toHaveCount(0);
});

test('주행 중이 아니면 경로 삭제는 확인 창 없이 바로 지운다', async ({ page }) => {
  test.setTimeout(60_000);
  const surface = await openPopupWithRoute(page, '/scripts/ui-800x360/map-route-runtime.html');
  await surface.getByRole('button', { name: '경로 전체 삭제', exact: true }).click();
  await expect(page.locator('#runtime-state')).toContainText('"start":null');
  await expect(page.getByRole('dialog', { name: '주행 중 경로 삭제 안내' })).toHaveCount(0);
});
