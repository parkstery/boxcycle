import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
for (const viewport of [{ width: 800, height: 360 }, { width: 736, height: 300 }, { width: 699, height: 273 }, { width: 667, height: 300 }]) {
  test(`RouteDock 한 줄·간격·10명 ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/scripts/ui-800x360/preview.html?state=ready');
    const dock = page.locator('.route-dock__card');
    const geometry = () => dock.evaluate(el => {
      const sensor = el.querySelector('.hud-cadence--dock')!.getBoundingClientRect();
      const bar = el.querySelector('.ride-control-bar')!.getBoundingClientRect();
      return { right: el.getBoundingClientRect().right - bar.right, gap: bar.left - sensor.right, center: Math.abs(sensor.y + sensor.height / 2 - bar.y - bar.height / 2), height: bar.height, x: bar.x - el.getBoundingClientRect().x };
    });
    const ready = await geometry();
    await dock.getByRole('button', { name: '주행 시작', exact: true }).click();
    const gap = await dock.evaluate(el => el.querySelector('.ride-control-bar')!.getBoundingClientRect().left - el.querySelector('.route-dock__led-toggle')!.getBoundingClientRect().right);
    expect(gap).toBe(32);
    await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
    const riding = await geometry();
    expect(Math.abs(riding.x - ready.x)).toBeLessThan(1);
    await dock.getByRole('button', { name: '일시정지', exact: true }).click();
    const paused = await geometry();
    for (const value of [ready, riding, paused]) {
      expect(value.right).toBe(8);
      expect(value.gap).toBeGreaterThanOrEqual(6);
      expect(value.center).toBeLessThan(1);
      expect(value.height).toBe(32);
    }
    await dock.getByRole('button', { name: '재개', exact: true }).click();
    await dock.getByRole('button', { name: '주행 종료', exact: true }).click();
    await page.goto('/scripts/ui-800x360/preview.html?state=glance-riding');
    const rows = page.locator('.lb-glance__row');
    await expect(rows).toHaveCount(10);
    const bounds = await page.locator('.lb-glance__list').evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, tenth: el.children[9].getBoundingClientRect().bottom }));
    expect(bounds.tenth).toBeLessThanOrEqual(bounds.bottom + 0.5);
    await expect(page.locator('.hud-clock')).toHaveCount(0);
  });
}

test('접기·펼치기 뒤 이어달리기 선택 유지·짧은 종료 후 같은 경로 재시작', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=ready&resume&short');
  await page.getByRole('button', { name: '이어 달리기 선택', exact: true }).click();
  await page.getByLabel('처음부터', { exact: true }).check();
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  await expect(page.getByLabel('처음부터', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
});
