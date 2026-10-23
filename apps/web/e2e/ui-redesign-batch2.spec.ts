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

test('카메라 메뉴는 6개 시점을 유지하고 ESC·바깥 클릭으로 닫힌다', async ({ page }) => {
  await page.goto(`${preview}?state=riding`);
  const trigger = page.locator('.camera-view-menu__trigger');
  await expect(trigger).toBeVisible();
  await expect(page.locator('.hud-quick-camera__btn')).toHaveCount(0);
  for (let index = 0; index < 6; index++) {
    await trigger.click();
    const menu = page.getByRole('menu', { name: '카메라 시점' });
    await expect(menu.getByRole('menuitemradio')).toHaveCount(6);
    await menu.getByRole('menuitemradio').nth(index).click();
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await expect(page.getByRole('menuitemradio').nth(index)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  }
  await trigger.click();
  await page.locator('.audit-map').click({ position: { x: 400, y: 200 } });
  await expect(page.getByRole('menu', { name: '카메라 시점' })).toHaveCount(0);
});
