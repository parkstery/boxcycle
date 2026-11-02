import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
for (const viewport of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  // Chief 11-02 v4: INT 는 오른쪽 2열 묶음 3-1, ▶ 는 4-2 — ▶ 는 INT 다음 줄 오른쪽 칸.
  test(`INT 칸과 경고창 ${viewport.width}×${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/scripts/ui-800x360/preview.html?state=ready&shortIntervalRoute');
    const rail = page.locator('.map-hud__rail');
    const interval = rail.getByRole('button',{name:'인터벌 운동 설정',exact:true});
    await expect(interval).toHaveText('INT');
    const start = rail.getByRole('button',{name:'주행 시작',exact:true});
    const cell = (el: Element) => [(el as HTMLElement).offsetLeft, (el as HTMLElement).offsetTop, (el as HTMLElement).offsetWidth];
    const [i, b] = await Promise.all([interval.evaluate(cell), start.evaluate(cell)]);
    expect(b[0]).toBeGreaterThan(i[0] + i[2] - 1);
    expect(b[1]).toBeGreaterThan(i[1]);
    await interval.click();
    await expect(page.getByRole('dialog',{name:'인터벌 운동 설정'})).toBeVisible();
    await page.getByRole('button',{name:'인터벌 운동 설정 닫기'}).click();
    await expect(page.getByRole('dialog',{name:'주행 설정'})).toHaveCount(0);
    await start.click();
    const dialog=page.getByRole('dialog',{name:'운동시간이 더 길어요'});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('설정된 경로의 예상 주행시간이 인터벌 운동시간보다 짧아요');
    const bounds=await dialog.locator('.interval-route-confirm__panel').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(330);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
    await dialog.getByRole('button',{name:'취소'}).click();
    await expect(start).toBeVisible();
    await start.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await start.click();
    await dialog.getByRole('button',{name:'주행 시작'}).click();
    await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
  });
}
