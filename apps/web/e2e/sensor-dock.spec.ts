import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

// Chief 11-02 v4(B단계): 센서 LED·RPM 은 계기판 맨 앞 칸 한 곳 — 위 「RPM」, 아래 LED + 회전수(신호 없으면 「--」).
// 경로가 없어도·RouteDock 이 접혀 있어도 같은 자리, 누르면 센서 상세 설정. RouteDock 접힘은 40px 경로 손잡이.
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

function cell(page: Page) {
  return page.getByRole('button', { name: /^케이던스 센서:/ });
}
function handle(page: Page) {
  return page.locator('.route-dock__handle');
}
function fold(page: Page) {
  return page.locator('.route-dock__fold');
}
function sheet(page: Page) {
  return page.getByRole('dialog', { name: '케이던스 센서', exact: true });
}

/** 센서 칸은 언제나 하나, 계기판 맨 앞(왼쪽 위 20px), RouteDock·주행바엔 센서가 없다. */
async function assertSensorCell(page: Page, led: 'white' | 'green', rpm: string) {
  await expect(cell(page)).toHaveCount(1);
  await expect(cell(page)).toHaveAttribute('data-led', led);
  await expect(cell(page).locator('.hud-metrics__label')).toHaveText('RPM');
  await expect(cell(page).locator('.hud-metrics__sensor-rpm')).toHaveText(rpm);
  await expect(page.locator('.route-dock-anchor .hud-cadence, .route-dock-anchor [aria-label^="케이던스 센서"], .ride-control-bar [aria-label^="케이던스 센서"]')).toHaveCount(0);
  const box = (await cell(page).boundingBox())!;
  expect(Math.round(box.x)).toBe(20);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function closeSheet(page: Page) {
  await sheet(page).getByRole('button', { name: '센서 설정 닫기' }).click();
  await expect(sheet(page)).toBeHidden();
}

test.describe('센서 계기판 칸·RouteDock 손잡이', () => {
  test.use({ viewport: { width: 800, height: 360 }, hasTouch: true });

  test('경로 없음: 센서 칸만(RouteDock 없음) → 누르면 센서 시트', async ({ page }) => {
    await page.goto(`${preview}?state=idle`);
    await assertSensorCell(page, 'white', '--');
    await expect(page.locator('.route-dock-anchor')).toHaveCount(0);
    await expect(page.locator('.ride-control-bar')).toHaveCount(0);
    await shot(page, 'b-idle-sensor-800x360.png');
    await cell(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(cell(page)).toHaveAttribute('aria-expanded', 'true');
    await closeSheet(page);
  });

  test('ready/riding/paused: 센서 칸 하나, RouteDock 은 펼치면 접기 캐럿·접으면 40px 손잡이', async ({ page }) => {
    for (const state of ['ready', 'riding', 'paused'] as const) {
      await page.goto(`${preview}?state=${state}`);
      await assertSensorCell(page, 'white', '--');
      if (state === 'ready') {
        await expect(fold(page)).toHaveAttribute('data-fold-kind', 'route');
        await page.getByRole('button', { name: '경로 패널 접기' }).click();
      }
      await expect(handle(page)).toBeVisible();
      const h = (await handle(page).boundingBox())!;
      expect([h.width, h.height]).toEqual([40, 40]);
      await handle(page).click();
      await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
      await expect(handle(page)).toHaveCount(0);
      await assertSensorCell(page, 'white', '--');
    }
  });

  test('실제 연결만 녹색·회전수, 연결 해제·체험 속도는 흰색·「--」', async ({ page }) => {
    await page.goto(`${preview}?state=sensor-connected`);
    await closeSheet(page);
    await assertSensorCell(page, 'green', '82');
    await shot(page, 'b-sensor-connected-800x360.png');

    await cell(page).click();
    await sheet(page).getByRole('button', { name: '연결 해제', exact: true }).click();
    await closeSheet(page);
    await assertSensorCell(page, 'white', '--');

    await page.goto(`${preview}?state=sensor-riding-manual`);
    await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage', 'riding');
    await closeSheet(page);
    await assertSensorCell(page, 'white', '--');
  });

  test('경로가 잡혔는데 주행 입력을 안 골랐으면 센서 칸이 깜빡인다', async ({ page }) => {
    await page.goto(`${preview}?state=ready&blocked`);
    await expect(cell(page)).toHaveClass(/hud-metrics__cell--sensor-attention/);
    await page.goto(`${preview}?state=ready`);
    await expect(cell(page)).not.toHaveClass(/hud-metrics__cell--sensor-attention/);
  });

  test('경로 생김 자동펼침·주행 시작 접힘(손잡이)·종료 펼침', async ({ page }) => {
    await page.goto(`${preview}?state=setup`);
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await expect(page.locator('.route-dock__badge--start')).toHaveText('S');

    await page.goto(`${preview}?state=ready`);
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await page.getByRole('button', { name: '주행 시작', exact: true }).click();
    await expect(handle(page)).toBeVisible();
    await expect(fold(page)).toHaveCount(0);
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await handle(page).click();
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await page.getByRole('button', { name: '재개', exact: true }).click();
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await page.getByRole('button', { name: '주행 종료', exact: true }).click();
    await page.keyboard.press('Escape');
    // 결과를 닫으면 주행 전으로 — 주소 카드가 다시 펼쳐지고 센서 칸은 그대로 하나.
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await expect(cell(page)).toHaveCount(1);
  });

  test('키보드 Enter/Space 포커스 유지와 reduced-motion', async ({ page }) => {
    await page.goto(`${preview}?state=riding`);
    await handle(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
    await expect(page.getByRole('button', { name: '경로 패널 접기' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(handle(page)).toBeVisible();
    await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toBeFocused();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${preview}?state=idle`);
    const animation = await cell(page).locator('.hud-cadence__led').evaluate((el) => getComputedStyle(el).animationName);
    expect(animation === 'none' || animation === '').toBeTruthy();
  });

  for (const size of sizes) {
    test(`${size.width}×${size.height} 경계 — 센서 칸 자리·폭은 주행 전후 같고 계기와 겹치지 않는다`, async ({ page }) => {
      await page.setViewportSize(size);
      const boxes: { x: number; w: number }[] = [];
      for (const state of ['idle', 'ready', 'riding'] as const) {
        await page.goto(`${preview}?state=${state}`);
        const c = (await cell(page).boundingBox())!;
        boxes.push({ x: Math.round(c.x), w: Math.round(c.width) });
        // 경로가 없으면 계기(경로·고도)는 없고 센서 칸만 있다.
        const metricsEl = page.locator('.map-hud__tl-metrics');
        if (await metricsEl.count()) expect((await metricsEl.boundingBox())!.x, state).toBeGreaterThanOrEqual(c.x + c.width);
        if (state === 'riding') {
          const h = (await handle(page).boundingBox())!;
          expect(h.x).toBeGreaterThanOrEqual(0);
          expect(h.y + h.height).toBeLessThanOrEqual(size.height);
          await shot(page, `b-riding-${size.width}x${size.height}.png`);
        }
      }
      expect(new Set(boxes.map((b) => `${b.x}/${b.w}`)).size).toBe(1);
    });
  }
});
