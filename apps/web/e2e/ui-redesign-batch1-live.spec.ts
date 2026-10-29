import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './open-meteo-stub';
import { guestStart } from './rideEntryHelpers';

// This spec can create a Guest only inside the Firebase emulator bundle.
test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Firebase 에뮬레이터 전용');
test.use({ viewport: { width: 800, height: 360 } });

test('실제 App에서 MENU와 세 경로 출처를 열고 캡처한다', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const capture = async (name: string) => {
    const directory = process.env.BATCH1_EVIDENCE_DIR;
    if (directory) await fs.mkdir(directory, { recursive: true });
    const file = directory ? path.join(directory, name) : testInfo.outputPath(name);
    await page.screenshot({ path: file, animations: 'disabled' });
    await testInfo.attach(name, { path: file, contentType: 'image/png' });
  };

  await page.goto('/');
  await guestStart(page);
  await expect(page.locator('.mapboxgl-canvas').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: '지명 검색', exact: true })).toBeVisible();
  // 10-30 Chief: 메뉴는 Trail 전용 — 경로 선택·주행 설정은 RouteDock 지도 핀·⚙.
  await expect(menu.getByRole('button', { name: '주행 설정', exact: true })).toHaveCount(0);
  await expect(menu.locator('.menu-route-nav > li')).toHaveCount(0);
  await capture('batch1-live-menu-800x360.png');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await page.getByRole('button', { name: '경로 목록', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 경로', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '경로 출처' }).getByRole('button', { name: '입문', exact: true }).click();
  const intro = page.getByRole('dialog', { name: '입문 경로', exact: true });
  await expect(intro).toBeVisible();
  await expect(intro.locator('.oc-modal__item')).toHaveCount(4);
  await capture('batch1-live-intro-800x360.png');
  await intro.getByRole('button', { name: '퍼블릭', exact: true }).click();
  const publicList = page.getByRole('dialog', { name: '퍼블릭 경로', exact: true });
  await expect(publicList).toBeVisible();
  await capture('batch1-live-public-800x360.png');
  await publicList.getByRole('button', { name: '내 경로', exact: true }).click();
  const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
  await expect(saved).toBeVisible();
  await capture('batch1-live-saved-800x360.png');
  await page.keyboard.press('Escape');
  await expect(saved).toHaveCount(0);
});
