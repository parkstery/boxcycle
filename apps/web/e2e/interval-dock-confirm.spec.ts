import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });
for (const viewport of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  test(`센서 옆 운동 설정과 경고창 ${viewport.width}×${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/scripts/ui-800x360/preview.html?state=ready&shortIntervalRoute');
    const dock = page.locator('.route-dock__card');
    const interval = dock.getByRole('button',{name:'인터벌 운동 설정',exact:true});
    await expect(interval).toHaveText('INT');
    const sensor = dock.getByRole('button',{name:/^케이던스 센서:/});
    const start = dock.getByRole('button',{name:'주행 시작',exact:true});
    const boxes = await Promise.all([sensor.boundingBox(),interval.boundingBox(),start.boundingBox(),dock.boundingBox(),dock.getByRole('button',{name:'경로 패널 접기'}).boundingBox()]);
    const [s,i,b,d,fold] = boxes;
    expect(s && i && b && d).toBeTruthy();
    expect(s!.x-(fold!.x+fold!.width)).toBeGreaterThanOrEqual(3);
    expect(i!.x-(s!.x+s!.width)).toBeGreaterThanOrEqual(3);
    expect(b!.x).toBeGreaterThanOrEqual(i!.x+i!.width);
    expect(Math.abs((s!.y+s!.height/2)-(i!.y+i!.height/2))).toBeLessThan(1);
    expect(b!.x+b!.width).toBeLessThanOrEqual(d!.x+d!.width);
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
