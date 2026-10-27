import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }, { width: 844, height: 390 }]) {
  test(`대기·주행·일시정지 시안과 조작 ${size.width}×${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    for (const state of ['ready', 'riding', 'paused']) {
      await page.goto(`${preview}?state=${state}`);
      if (state === 'ready') {
        await expect(page.getByRole('group', { name: '주행 지표' }).getByText('경로', { exact: true })).toBeVisible();
        await expect(page.getByRole('group', { name: '주행 지표' }).getByText('고도', { exact: true })).toBeVisible();
        await expect(page.getByRole('group', { name: '주행 지표' }).getByText('평균', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: '주행 시작', exact: true })).toBeEnabled();
      }
      if (state === 'paused') {
        await expect(page.getByText('잠깐 멈췄어요', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '일시정지 옵션', exact: true })).toBeVisible();
      }
      const controls = page.getByRole('group', { name: '주행 제어' });
      const bounds = await controls.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
      const buttons = await controls.locator('button:visible').evaluateAll(elements => elements.map(el => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { h: r.height, hit: hit === el || el.contains(hit) };
      }));
      expect(buttons.every(button => button.hit)).toBeTruthy();
      if (state === 'riding') {
        expect((await page.getByRole('button', { name: '일시정지', exact: true }).boundingBox())!.height).toBe(44);
        expect((await page.getByRole('button', { name: '주행 종료', exact: true }).boundingBox())!.height).toBe(44);
      }
      if (process.env.BATCH2_EVIDENCE_DIR) {
        await fs.mkdir(process.env.BATCH2_EVIDENCE_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.BATCH2_EVIDENCE_DIR, `batch2-${state}-${size.width}x${size.height}.png`), animations: 'disabled' });
      } else await page.screenshot({ path: info.outputPath(`${state}.png`), animations: 'disabled' });
    }
  });
}

test('카메라 메뉴는 평면 높이와 시점 2~6으로 나뉘고 ESC·바깥 클릭으로 닫힌다', async ({ page }) => {
  await page.goto(`${preview}?state=riding`);
  const flatTrigger = page.getByRole('button', { name: /평면 카메라/ });
  const perspectiveTrigger = page.locator('.camera-view-menu__trigger--perspective');
  await expect(flatTrigger).toBeVisible();
  await expect(perspectiveTrigger).toBeVisible();
  await expect(page.locator('.hud-quick-camera__btn')).toHaveCount(0);
  await flatTrigger.click();
  const flatMenu = page.getByRole('menu', { name: '평면 카메라 높이' });
  await expect(flatMenu.getByRole('menuitemradio')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await expect(flatMenu).toHaveCount(0);
  for (let index = 0; index < 5; index++) {
    await perspectiveTrigger.click();
    const menu = page.getByRole('menu', { name: '시점 카메라' });
    await expect(menu.getByRole('menuitemradio')).toHaveCount(5);
    await menu.getByRole('menuitemradio').nth(index).click();
    await expect(menu).toHaveCount(0);
    await page.getByRole('button', { name: new RegExp(`^카메라 ${index + 2}`) }).click();
    await expect(page.getByRole('menuitemradio').nth(index)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  }
  await page.getByRole('button', { name: /^카메라 6/ }).click();
  await page.locator('.audit-map').click({ position: { x: 400, y: 200 } });
  await expect(page.getByRole('menu', { name: '시점 카메라' })).toHaveCount(0);
});

test('우하단 주행 버튼은 경로 확정 뒤 5회 펄싱하며 펄스 중에도 시작된다', async ({ page }) => {
  await page.goto(`${preview}?state=ready`);
  const start = page.getByRole('group', { name: '주행 제어' }).getByRole('button', { name: '주행 시작' });
  await expect(start).toHaveClass(/ride-start-ready-pulse/);
  const pulse = await start.evaluate(el => {
    const style = getComputedStyle(el);
    return { name: style.animationName, count: style.animationIterationCount, pointerEvents: style.pointerEvents };
  });
  expect(pulse).toEqual({ name: 'ride-start-ready-pulse', count: '5', pointerEvents: 'auto' });
  await page.waitForTimeout(180);
  await start.click();
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
});
