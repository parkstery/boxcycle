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
  // 10-28 후속: 접힌 카드에는 LED 옆 주행 제어도 남는다. Chief 11-02: 접힌 줄은 64px.
  const ledWidth = (await page.getByRole('button', { name: '경로 패널 펼치기' }).boundingBox())!.width;
  expect(ledWidth).toBe(64);
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const expandedWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  expect(expandedWidth).toBeCloseTo((await minimap.boundingBox())!.width, 0);
  await minimap.evaluate((e) => {
    (e as HTMLElement).style.width = '';
  });
  // Chief 11-02: 미니맵 접기는 접힌 64px 줄 끝 버튼 — 접으면 미니맵이 통째로 빠진다.
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  await page.getByRole('button', { name: '미니맵 접기' }).click();
  await expect(minimap).toHaveCount(0);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const collapsedDockWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  // 대기 화면과 동일 — 29.4vw(펼친 미니맵 폭 비율, 2026-10-24 Chief). 접힌 미니맵 폭은 따르지 않는다.
  const vw = page.viewportSize()!.width;
  expect(Math.abs(collapsedDockWidth - 0.294 * vw)).toBeLessThanOrEqual(1);
});

// Chief 11-02: 미니맵 접기·펼치기는 미니맵 위 28px 버튼 대신 RouteDock 접힌 줄 끝 64px 버튼(지도 아이콘, 펼침이면 파랑).
test('RouteDock LED와 미니맵 접기는 독립적으로 접힌다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&waypoints=3');

  const routeExpand = page.getByRole('button', { name: '경로 패널 펼치기' });
  const minimapCollapse = page.getByRole('button', { name: '미니맵 접기' });
  const minimap = page.locator('.map-bottom-left-stack .route-minimap');
  await expect(routeExpand).toBeVisible();
  await expect(minimapCollapse).toBeVisible();
  await expect(page.locator('.route-minimap__toggle')).toHaveCount(0);
  await expect(routeExpand).toHaveAttribute('aria-expanded', 'false');
  await expect(minimapCollapse).toHaveAttribute('aria-expanded', 'true');
  const mapBox = (await minimapCollapse.boundingBox())!;
  expect([mapBox.width, mapBox.height]).toEqual([64, 64]);
  expect(await minimapCollapse.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(36, 87, 214)');

  // 미니맵만 접어도 경로 패널은 접힌 그대로, 다시 펴면 돌아온다.
  await minimapCollapse.click();
  await expect(minimap).toHaveCount(0);
  await expect(routeExpand).toHaveAttribute('aria-expanded', 'false');
  const minimapExpand = page.getByRole('button', { name: '미니맵 펼치기' });
  await expect(minimapExpand).toHaveAttribute('aria-expanded', 'false');
  await minimapExpand.click();
  await expect(minimap).toBeVisible();

  // 경로 패널을 펴도 미니맵은 유지된다(펼친 카드엔 미니맵 버튼 없음).
  await routeExpand.click();
  await expect(page.getByRole('button', { name: '경로 패널 접기' })).toBeVisible();
  await expect(minimap).toBeVisible();
  await expect(page.getByRole('button', { name: /^미니맵/ })).toHaveCount(0);
});
