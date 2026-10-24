import { test, expect } from '@playwright/test';

test('긴 주소는 펼친 미니맵의 폭을 따르고 두 패널 접기가 독립적이다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&long&waypoints=3');
  await expect(page.locator('.route-dock-anchor')).toBeVisible();
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
  const minimap = page.locator('.map-bottom-left-stack .route-minimap');
  await expect(minimap).toBeVisible();

  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    for (const width of [235, 210, 180]) {
      await minimap.evaluate((e, w) => {
        (e as HTMLElement).style.width = `${w}px`;
      }, width);
      const geometry = await page.evaluate(() => {
        const dock = document.querySelector('.route-dock__card')!.getBoundingClientRect();
        const mini = document.querySelector('.map-bottom-left-stack .route-minimap')!.getBoundingClientRect();
        return { width: dock.width - mini.width, left: dock.left - mini.left, right: dock.right - mini.right };
      });
      for (const difference of Object.values(geometry)) expect(Math.abs(difference)).toBeLessThan(0.1);
    }
  }
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  const collapsedWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  expect(collapsedWidth).toBeGreaterThanOrEqual(28);
  expect(collapsedWidth).toBeLessThanOrEqual(44);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const expandedWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  expect(expandedWidth).toBeCloseTo((await minimap.boundingBox())!.width, 0);
  await minimap.evaluate((e) => {
    (e as HTMLElement).style.width = '';
  });
  await page.getByRole('button', { name: '미니맵 접기' }).click();
  await expect(minimap).toHaveClass(/route-minimap--collapsed/);
  const collapsedDockWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  // 대기 화면과 동일 — 29.4vw(펼친 미니맵 폭 비율, 2026-10-24 Chief). 접힌 미니맵 폭은 따르지 않는다.
  const vw = page.viewportSize()!.width;
  expect(Math.abs(collapsedDockWidth - 0.294 * vw)).toBeLessThanOrEqual(1);
});
