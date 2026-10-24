import { test, expect } from '@playwright/test';

test('긴 주소는 펼친 미니맵의 폭을 따르고 두 패널 접기가 독립적이다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&long&waypoints=3');
  await expect(page.locator('.route-dock-anchor')).toBeVisible();
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
  expect((await page.locator('.route-dock__card').boundingBox())!.width).toBeLessThan(30);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const expandedWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  expect(expandedWidth).toBeCloseTo((await minimap.boundingBox())!.width, 0);
  await minimap.evaluate((e) => {
    (e as HTMLElement).style.width = '';
  });
  await page.getByRole('button', { name: '미니맵 접기' }).click();
  await expect(minimap).toHaveClass(/route-minimap--collapsed/);
  const collapsedDockWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  // 대기 화면과 동일 — min(250px, 100vw-16) 고정(접힌 미니맵 폭을 따르지 않음).
  expect(collapsedDockWidth).toBeCloseTo(250, 0.5);
});
