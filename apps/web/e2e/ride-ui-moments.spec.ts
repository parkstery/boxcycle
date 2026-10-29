import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
const evidenceDir = process.env.UI_MOMENTS_EVIDENCE_DIR;
const sizes = [
  { width: 800, height: 360 },
  { width: 736, height: 360 },
  { width: 699, height: 273 },
  { width: 667, height: 300 },
] as const;

async function saveShot(page: Page, name: string) {
  if (!evidenceDir) return;
  await fs.mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, name), animations: 'disabled' });
}

test.describe('주행 UI 정리 v2', () => {
  for (const size of sizes) {
    test(`HUD 한 행·좌우 탭 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
      const metrics = page.getByRole('group', { name: '주행 지표' });
      await expect(metrics).toBeVisible();
      await expect(metrics.locator('.hud-metrics__label')).toHaveText(['거리', '시간', '속도', '새 도로', '평균']);
      const box = await metrics.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const tr = document.querySelector('.map-hud__tr')!.getBoundingClientRect();
        const interval = document.querySelector('.ride-interval-hud')!.getBoundingClientRect();
        const rank = document.querySelector('.edge-panel-tab--right')!.getBoundingClientRect();
        const menu = document.querySelector('.edge-panel-tab--left')!.getBoundingClientRect();
        const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          width: r.width,
          left: r.left,
          cellTops: [...el.querySelectorAll('.hud-metrics__cell')].map(cell => cell.getBoundingClientRect().top),
          contentWidth: el.scrollWidth,
          vw: innerWidth,
          overlapTr: overlap(r, tr),
          intervalLeft: interval.left,
          intervalRight: interval.right,
          rankLeft: rank.left,
          menuW: menu.width,
          menuH: menu.height,
          rankW: rank.width,
          rankH: rank.height,
        };
      });
      expect(box.width).toBeLessThanOrEqual(box.vw - 228);
      expect(box.left).toBeCloseTo(20, 0);
      expect(Math.max(...box.cellTops) - Math.min(...box.cellTops)).toBeLessThan(1);
      expect(box.contentWidth).toBeLessThanOrEqual(Math.ceil(box.width));
      expect(box.overlapTr).toBe(false);
      expect(box.intervalRight).toBeLessThan(size.width * 0.45);
      expect(box.rankLeft).toBeGreaterThan(size.width * 0.7);
      expect(box.menuW).toBeGreaterThanOrEqual(44);
      expect(box.menuH).toBeGreaterThanOrEqual(44);
      expect(box.rankW).toBeGreaterThanOrEqual(44);
      expect(box.rankH).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.hud-account__avatar')).toHaveCount(0);
      await expect(page.locator('.hud-account__name')).toBeVisible();
      await expect(page.getByRole('button', { name: '순위 열기', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await page.getByRole('button', { name: '순위 열기', exact: true }).click();
      await expect(page.locator('#lb-glance-panel')).toBeVisible();
      await expect(page.getByRole('button', { name: '순위 열기', exact: true })).toHaveAttribute('aria-expanded', 'true');
      const panelOverlap = await page.evaluate(() => {
        const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const panel = document.querySelector('#lb-glance-panel')!.getBoundingClientRect();
        const boxes = [
          ['.hud-ride-map-controls', '맵 제어'],
          ['.camera-view-menu__trigger', '카메라'],
          ['.hud-account', '계정'],
          ['[aria-label="일시정지"]', '일시정지'],
          ['[aria-label="주행 종료"]', '종료'],
        ] as const;
        return boxes.flatMap(([sel, name]) => {
          const el = document.querySelector(sel);
          if (!el) return [];
          const box = el.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) return [];
          return [{ name, hit: overlap(panel, box) }];
        });
      });
      for (const item of panelOverlap) {
        expect(item.hit, `${size.width}×${size.height} 순위판 vs ${item.name}`).toBe(false);
      }
      await saveShot(page, `riding-${size.width}x${size.height}.png`);
    });
  }

  test('좌우 탭 클릭만 열고 스와이프는 열지 않으며 인터벌 설정 3개', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto(`${preview}?state=ready`);
    const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole('button', { name: '메뉴 열기', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await expect(menu).toHaveCount(0);

    await page.goto(`${preview}?state=ready`);
    const left = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
    await page.mouse.down();
    await page.mouse.move(left.x + 140, left.y + left.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(menu, '왼쪽 반달 스와이프는 열지 않는다').toHaveCount(0);

    await page.goto(`${preview}?state=ready`);
    const rank = page.getByRole('button', { name: '순위 열기', exact: true });
    const right = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
    await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
    await page.mouse.down();
    await page.mouse.move(right.x - 140, right.y + right.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('#lb-glance-panel'), '오른쪽 반달 스와이프는 열지 않는다').toBeHidden();
    await rank.click();
    await expect(page.locator('#lb-glance-panel')).toBeVisible();
    await rank.click();
    await expect(page.locator('#lb-glance-panel')).toBeHidden();

    await page.goto(`${preview}?state=menu`);
    await page.getByRole('button', { name: '인터벌', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
    await expect(editor.getByRole('combobox', { name: '운동 프리셋' }).locator('option')).toHaveCount(9);
    await editor.getByRole('button', { name: '직접 조절', exact: true }).click();
    await expect(editor.getByRole('spinbutton', { name: '고강도 시간 초', exact: true })).toBeVisible();
    await editor.getByRole('spinbutton', { name: '고강도 시간 초', exact: true }).fill('45');
    await editor.getByRole('button', { name: '접기', exact: true }).click();
    await expect(editor.getByRole('button', { name: '직접 조절', exact: true })).toBeVisible();
    await editor.getByRole('button', { name: '직접 조절', exact: true }).click();
    await expect(editor.getByRole('spinbutton', { name: '고강도 시간 초', exact: true })).toHaveValue('45');
    await saveShot(page, 'interval-settings-custom-800x360.png');
  });

  test('응원은 코칭 자리를 공유하고 결과 막대를 숨긴다', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.clock.install();
    await page.goto(`${preview}?state=riding`);
    await expect(page.locator('.hud-coach')).toContainText('내 도로망');
    await expect(page.locator('.hud-coach--moment')).toHaveCount(1);
    await page.clock.runFor(2600);
    await expect(page.locator('.hud-coach--moment')).toHaveCount(0);
    await page.goto(`${preview}?state=summary&variant=completed`);
    const sheet = page.locator('.ride-summary__sheet');
    const size = await sheet.evaluate((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
    expect(size.w).toBeLessThanOrEqual(444 + 1);
    expect(size.h).toBeLessThanOrEqual(194 + 8);
    await expect(page.locator('.ride-summary__progress-track')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '내 경로로 저장', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '저장 안 함', exact: true })).toBeVisible();
  });
});
