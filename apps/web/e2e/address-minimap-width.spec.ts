import { test, expect } from '@playwright/test';

test('긴 주소는 펼친 미니맵의 폭을 따르고 두 패널 접기가 독립적이다', async ({ page }) => {
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&long&waypoints=3');
  await expect(page.locator('.route-dock-anchor')).toBeVisible();
  await page.evaluate(async () => {
    const styleUrl = '/src/features/map-overlays/MapBottomLeftStack.css';
    await import(styleUrl);
    const dock = document.querySelector('.route-dock-anchor')!;
    const stack = document.createElement('div');
    stack.className = 'map-bottom-left-stack';
    dock.before(stack);
    stack.append(dock);
    const mini = document.createElement('div');
    mini.className = 'route-minimap';
    mini.style.cssText = 'width:235px;height:105px;background:#d3e9d5';
    stack.append(mini);
  });
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    for (const width of [235, 210, 180]) {
      await page.locator('.route-minimap').evaluate((e, w) => { (e as HTMLElement).style.width = `${w}px`; }, width);
      const geometry = await page.evaluate(() => {
        const dock = document.querySelector('.route-dock__shell')!.getBoundingClientRect();
        const mini = document.querySelector('.route-minimap')!.getBoundingClientRect();
        return { width: dock.width - mini.width, left: dock.left - mini.left, right: dock.right - mini.right };
      });
      for (const difference of Object.values(geometry)) expect(Math.abs(difference)).toBeLessThan(0.1);
    }
  }
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  expect((await page.locator('.route-dock__shell').boundingBox())!.width).toBeLessThan(30);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  expect((await page.locator('.route-dock__shell').boundingBox())!.width).toBe(180);
  await page.locator('.route-minimap').evaluate(e => {
    e.classList.add('route-minimap--collapsed');
    (e as HTMLElement).style.width = '24px';
  });
  expect((await page.locator('.route-dock__shell').boundingBox())!.width).toBe(170);
});
