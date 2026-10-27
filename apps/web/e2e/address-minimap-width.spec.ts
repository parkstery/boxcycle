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

test('RouteDock과 미니맵은 같은 왼쪽 위 접기 버튼을 쓰되 독립적으로 접힌다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&waypoints=3');

  const routeExpand = page.getByRole('button', { name: '경로 패널 펼치기' });
  const minimapCollapse = page.getByRole('button', { name: '미니맵 접기' });
  await expect(routeExpand).toBeVisible();
  await expect(minimapCollapse).toBeVisible();
  await expect(routeExpand).toHaveAttribute('data-fold-kind', 'route');
  await expect(minimapCollapse).toHaveAttribute('data-fold-kind', 'map');
  await expect(routeExpand).toHaveAttribute('aria-expanded', 'false');
  await expect(minimapCollapse).toHaveAttribute('aria-expanded', 'true');

  await routeExpand.click();
  const routeCollapse = page.getByRole('button', { name: '경로 패널 접기' });
  await expect(routeCollapse).toBeVisible();
  await page.mouse.move(400, 200);

  const appearance = await page.evaluate(() => {
    const route = document.querySelector<HTMLButtonElement>('[data-fold-kind="route"]')!;
    const map = document.querySelector<HTMLButtonElement>('[data-fold-kind="map"]')!;
    const routePanel = document.querySelector<HTMLElement>('.route-dock__card')!;
    const mapPanel = document.querySelector<HTMLElement>('.route-minimap')!;
    const read = (button: HTMLButtonElement, panel: HTMLElement) => {
      const buttonBox = button.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      const style = getComputedStyle(button);
      const svgStyle = getComputedStyle(button.querySelector('svg')!);
      return {
        width: buttonBox.width,
        height: buttonBox.height,
        left: buttonBox.left - panelBox.left,
        top: buttonBox.top - panelBox.top,
        background: style.backgroundColor,
        border: style.borderTop,
        radius: style.borderRadius,
        shadow: style.boxShadow,
        strokeWidth: svgStyle.strokeWidth,
      };
    };
    return { route: read(route, routePanel), map: read(map, mapPanel) };
  });

  expect(appearance.route.width).toBe(28);
  expect(appearance.route.height).toBe(28);
  expect(appearance.map.width).toBe(28);
  expect(appearance.map.height).toBe(28);
  expect(appearance.route.left).toBe(4);
  expect(appearance.route.top).toBe(4);
  expect(appearance.map.left).toBe(4);
  expect(appearance.map.top).toBe(4);
  expect(appearance.route.background).toBe(appearance.map.background);
  expect(appearance.route.border).toBe(appearance.map.border);
  expect(appearance.route.radius).toBe(appearance.map.radius);
  expect(appearance.route.shadow).toBe(appearance.map.shadow);
  expect(appearance.route.strokeWidth).toBe(appearance.map.strokeWidth);

  // 주소 패널만 접어도 미니맵은 유지된다.
  await routeCollapse.click();
  await expect(page.getByRole('button', { name: '경로 패널 펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await expect(minimapCollapse).toHaveAttribute('aria-expanded', 'true');

  // 둘 다 접혀도 각 식별 도안이 남고 버튼끼리 겹치지 않는다.
  await minimapCollapse.click();
  const collapsed = await page.locator('.route-overview-fold-toggle').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }),
  );
  expect(collapsed).toHaveLength(2);
  const [a, b] = collapsed;
  const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  expect(overlaps).toBe(false);
  await expect(page.getByRole('button', { name: '미니맵 펼치기' })).toHaveAttribute('aria-expanded', 'false');
});
