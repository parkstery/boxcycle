import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
for (const viewport of [{ width: 800, height: 360 }, { width: 736, height: 300 }, { width: 699, height: 273 }, { width: 667, height: 300 }]) {
  // Chief 11-02 v4: 접힌 줄 = 경로 손잡이 · 미니맵, 40px·간격 8px(B단계: 센서 LED 는 계기판 칸). 주행 버튼(▶⏸⏹)은 오른쪽 2열 묶음.
  test(`RouteDock 접힌 줄·10명 ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/scripts/ui-800x360/preview.html?state=ready');
    const dock = page.locator('.route-dock__card');
    const rail = page.locator('.map-hud__rail');
    await expect(dock.locator('.ride-control-bar')).toHaveCount(0);
    await rail.getByRole('button', { name: '주행 시작', exact: true }).click();
    const row = await dock.evaluate(el => ['.route-dock__handle', '.route-dock__tool--minimap']
      .map(s => el.querySelector(s)!.getBoundingClientRect()).map(r => ({ x: r.left, right: r.right, y: r.top, w: r.width, h: r.height })));
    for (const b of row) expect([b.w, b.h, b.y]).toEqual([40, 40, row[0].y]);
    expect(Math.round(row[1].x - row[0].right)).toBe(8);
    expect(row[0].x).toBe(48);
    await rail.getByRole('button', { name: '일시정지', exact: true }).click();
    await rail.getByRole('button', { name: '재개', exact: true }).click();
    await rail.getByRole('button', { name: '주행 종료', exact: true }).click();
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
