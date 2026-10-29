import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
const evidenceDir = process.env.SENSOR_DOCK_EVIDENCE_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../document/ops/20261028-sensor-dock/evidence/cursor/review-fix');
const sizes = [
  { width: 800, height: 360 },
  { width: 736, height: 300 },
  { width: 699, height: 273 },
  { width: 667, height: 300 },
] as const;

async function shot(page: Page, name: string) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, name), animations: 'disabled' });
}

function led(page: Page) {
  return page.locator('.route-dock__led-toggle');
}
function fold(page: Page) {
  return page.locator('.route-dock__fold');
}
function chip(page: Page) {
  return page.getByRole('button', { name: /^케이던스 센서:/ });
}
function barChip(page: Page) {
  return page.locator('.ride-control-bar .hud-cadence');
}

async function assertLedOnly(page: Page, color: 'white' | 'green') {
  const toggle = led(page);
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-label', '경로 패널 펼치기');
  await expect(toggle).toHaveAttribute('data-led', color);
  await expect(fold(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  await expect(barChip(page)).toHaveCount(0);
  const box = (await toggle.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(28);
  expect(box.height).toBeGreaterThanOrEqual(28);
  expect(box.width).toBeLessThanOrEqual(44);
  expect(box.height).toBeLessThanOrEqual(44);
  // 10-30 Chief: 접혀도 LED 오른쪽에 도구(주행 전 INT·지도 핀·⚙ / 주행 중 ⚙ / 일시정지 INT)가 한 줄로 보인다 — 높이만 LED 한 줄.
  await expect(page.locator('.route-dock__card').locator('.route-dock__tool--settings, .route-dock__interval').first()).toBeVisible();
  const card = (await page.locator('.route-dock__card').boundingBox())!;
  expect(card.height).toBeLessThanOrEqual(44);
}

async function assertExpandedDock(page: Page) {
  await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
  await expect(led(page)).toHaveCount(0);
  await expect(fold(page)).toHaveCount(1);
  await expect(fold(page)).toHaveAttribute('data-fold-kind', 'route');
  await expect(page.getByRole('button', { name: '경로 패널 접기' })).toHaveCount(1);
  await expect(chip(page)).toHaveCount(1);
  await expect(barChip(page)).toHaveCount(0);
}

async function expandAndOpenSheet(page: Page) {
  const expand = page.getByRole('button', { name: '경로 패널 펼치기' });
  if (await expand.isVisible().catch(() => false)) await expand.click();
  await chip(page).click();
  await expect(page.getByRole('dialog', { name: '케이던스 센서', exact: true })).toBeVisible();
}

test.describe('센서 RouteDock 통합', () => {
  test.use({ viewport: { width: 800, height: 360 }, hasTouch: true });

  test('idle LED만 → 펼침 접기캐럿·알약 → 센서 시트 → 접기, 주행바와 중복 없음', async ({ page }) => {
    await page.goto(`${preview}?state=idle`);
    await assertLedOnly(page, 'white');
    await expect(page.locator('.ride-control-bar')).toHaveCount(0);
    await expect(page.locator('.route-dock__stops')).toBeHidden();
    await shot(page, 'idle-led-800x360.png');

    await led(page).click();
    await assertExpandedDock(page);
    await expect(page.getByText('지도를 탭해 Start·End 설정')).toBeVisible();
    await shot(page, 'idle-expanded-fold-800x360.png');

    await chip(page).click();
    const sheet = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: '센서 설정 닫기' }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: '경로 패널 접기' }).click();
    await assertLedOnly(page, 'white');
  });

  test('ready/riding/paused 무중복·펼치면 접기캐럿+알약, 접으면 LED만', async ({ page }) => {
    for (const state of ['ready', 'riding', 'paused'] as const) {
      await page.goto(`${preview}?state=${state}`);
      await expect(barChip(page)).toHaveCount(0);
      if (state === 'ready') {
        await assertExpandedDock(page);
        await page.getByRole('button', { name: '경로 패널 접기' }).click();
      } else {
        await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeVisible();
      }
      await assertLedOnly(page, 'white');
      await led(page).click();
      await assertExpandedDock(page);
      if (state === 'riding') await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible();
      if (state === 'paused') await expect(page.getByRole('button', { name: '재개' })).toBeVisible();
    }
  });

  test('실제 연결만 녹색, 체험 속도는 흰색, 재연결 후 녹색', async ({ page }) => {
    await page.goto(`${preview}?state=idle`);
    await assertLedOnly(page, 'white');

    await page.goto(`${preview}?state=sensor-connected`);
    await page.getByRole('button', { name: '센서 설정 닫기' }).click();
    await assertExpandedDock(page);
    await page.getByRole('button', { name: '경로 패널 접기' }).click();
    await assertLedOnly(page, 'green');
    await shot(page, 'idle-led-connected-800x360.png');

    const sheet = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
    await expandAndOpenSheet(page);
    await sheet.getByRole('button', { name: '연결 해제', exact: true }).click();
    await sheet.getByRole('button', { name: '센서 설정 닫기' }).click();
    await page.getByRole('button', { name: '경로 패널 접기' }).click();
    await assertLedOnly(page, 'white');

    await page.goto(`${preview}?state=sensor-connected`);
    await page.getByRole('button', { name: '센서 설정 닫기' }).click();
    await page.getByRole('button', { name: '경로 패널 접기' }).click();
    await assertLedOnly(page, 'green');

    await page.goto(`${preview}?state=sensor-riding-manual`);
    await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage', 'riding');
    await page.getByRole('button', { name: '센서 설정 닫기' }).click();
    await assertLedOnly(page, 'white');
  });

  test('경로 생김 자동펼침·삭제 후 LED·단일 Start·주행 접힘/종료 펼침', async ({ page }) => {
    await page.goto(`${preview}?state=idle`);
    await assertLedOnly(page, 'white');

    await page.goto(`${preview}?state=setup`);
    await assertExpandedDock(page);
    await expect(page.locator('.route-dock__badge--start')).toHaveText('S');

    await page.goto(`${preview}?state=ready`);
    await assertExpandedDock(page);
    await page.getByRole('button', { name: '주행 시작', exact: true }).click();
    await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeVisible();
    await expect(chip(page)).toHaveCount(0);
    await expect(led(page)).toHaveCount(1);
    await expect(fold(page)).toHaveCount(0);
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeVisible();
    await led(page).click();
    await assertExpandedDock(page);
    await page.getByRole('button', { name: '재개', exact: true }).click();
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await expect(led(page)).toHaveCount(0);
    await page.getByRole('button', { name: '주행 종료', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeVisible();
    await expect(page.locator('.ride-control-bar')).toHaveCount(0);
  });

  test('키보드 Enter/Space 포커스 유지와 reduced-motion', async ({ page }) => {
    await page.goto(`${preview}?state=idle`);
    await led(page).focus();
    await page.keyboard.press('Enter');
    await assertExpandedDock(page);
    await expect(page.getByRole('button', { name: '경로 패널 접기' })).toBeFocused();
    await page.keyboard.press('Space');
    await assertLedOnly(page, 'white');
    await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeFocused();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${preview}?state=idle`);
    const animation = await page.locator('.route-dock__led').evaluate((el) => getComputedStyle(el).animationName);
    expect(animation === 'none' || animation === '').toBeTruthy();
  });

  for (const size of sizes) {
    test(`${size.width}×${size.height} 경계 — idle LED·ready 접기캐럿+알약·riding 접힘`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=idle`);
      await assertLedOnly(page, 'white');
      const idleLed = (await led(page).boundingBox())!;
      expect(idleLed.x).toBeGreaterThanOrEqual(0);
      expect(idleLed.y + idleLed.height).toBeLessThanOrEqual(size.height + 1);

      await page.goto(`${preview}?state=ready`);
      await assertExpandedDock(page);
      const readyChip = (await chip(page).boundingBox())!;
      const readyFold = (await fold(page).boundingBox())!;
      expect(readyChip.x + readyChip.width).toBeLessThanOrEqual(size.width + 1);
      expect(readyChip.height).toBeGreaterThanOrEqual(28);
      expect(readyFold.width).toBeCloseTo(28, 0);
      expect(readyFold.height).toBeCloseTo(28, 0);

      await page.goto(`${preview}?state=riding`);
      await assertLedOnly(page, 'white');
      await led(page).click();
      await assertExpandedDock(page);
      await shot(page, `riding-expanded-fold-${size.width}x${size.height}.png`);
    });
  }
});
