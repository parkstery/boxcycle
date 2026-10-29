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
  // 10-28 후속: 접힌 카드에는 LED 옆 주행 제어도 남는다.
  const ledWidth = (await page.getByRole('button', { name: '경로 패널 펼치기' }).boundingBox())!.width;
  expect(ledWidth).toBe(28);
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
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

test('RouteDock LED와 미니맵 접기는 독립적으로 접힌다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&waypoints=3');

  const routeExpand = page.getByRole('button', { name: '경로 패널 펼치기' });
  const minimapCollapse = page.getByRole('button', { name: '미니맵 접기' });
  await expect(routeExpand).toBeVisible();
  await expect(minimapCollapse).toBeVisible();
  await expect(routeExpand).toHaveAttribute('aria-expanded', 'false');
  await expect(minimapCollapse).toHaveAttribute('data-fold-kind', 'map');
  await expect(minimapCollapse).toHaveAttribute('aria-expanded', 'true');
  await expect(minimapCollapse.locator('.route-overview-fold-toggle__identity')).toHaveCount(0);
  await expect(minimapCollapse.locator('.route-overview-fold-toggle__chevron')).toHaveCount(1);
  await expect(page.locator('.route-dock__led-toggle')).toHaveCount(1);

  await routeExpand.click();
  const routeCollapse = page.getByRole('button', { name: '경로 패널 접기' });
  await expect(routeCollapse).toBeVisible();
  await expect(page.getByRole('button', { name: /^케이던스 센서:/ })).toHaveCount(1);
  await page.mouse.move(400, 200);

  const mapBox = await minimapCollapse.boundingBox();
  expect(mapBox!.width).toBe(28);
  expect(mapBox!.height).toBe(28);

  // 주소 패널만 접어도 미니맵은 유지된다.
  await routeCollapse.click();
  await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await expect(minimapCollapse).toHaveAttribute('aria-expanded', 'true');

  // 둘 다 접혀도 서로 겹치지 않는다.
  await minimapCollapse.click();
  const collapsed = await page.evaluate(() => {
    const led = document.querySelector('.route-dock__led-toggle')!.getBoundingClientRect();
    const map = document.querySelector('[data-fold-kind="map"]')!.getBoundingClientRect();
    return {
      led: { left: led.left, right: led.right, top: led.top, bottom: led.bottom },
      map: { left: map.left, right: map.right, top: map.top, bottom: map.bottom },
    };
  });
  const overlaps = collapsed.led.left < collapsed.map.right && collapsed.led.right > collapsed.map.left
    && collapsed.led.top < collapsed.map.bottom && collapsed.led.bottom > collapsed.map.top;
  expect(overlaps).toBe(false);
  await expect(page.getByRole('button', { name: '미니맵 펼치기' })).toHaveAttribute('aria-expanded', 'false');
  const minimapExpand = page.getByRole('button', { name: '미니맵 펼치기' });
  await expect(minimapExpand.locator('.route-overview-fold-toggle__identity')).toHaveCount(1);
  await expect(minimapExpand.locator('.route-overview-fold-toggle__chevron')).toHaveCount(0);
  await minimapExpand.click();
  await expect(minimapCollapse.locator('.route-overview-fold-toggle__identity')).toHaveCount(0);
  await expect(minimapCollapse.locator('.route-overview-fold-toggle__chevron')).toHaveCount(1);
});
