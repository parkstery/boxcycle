import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
for (const size of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  test(`종료 계기판 유지·닉네임·두 줄 주소·닫힘 ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=summary&completed`);
    const sheet = page.getByRole('dialog',{name:'주행 결과',exact:true});
    const hud = page.getByRole('group',{name:'주행 지표',exact:true});
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('07:00');
    await expect(hud).toContainText('18.0');
    await expect(hud).toContainText('+4.86');
    await expect(hud.locator('[aria-label="주행 누적 거리"]')).toContainText('5.00');
    await expect(sheet.locator('.ride-summary__story-headline')).toHaveText('완주했어요. 내 도로망이 4.86 km 더 늘어났어요.');
    await expect(sheet.locator('.ride-summary__rider')).toHaveText('Ridingman12');
    await expect(sheet.locator('.ride-summary__point')).toHaveCount(2);
    await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
    const cellShape = await hud.locator('.hud-metrics__cell').evaluateAll(cells=>cells.map(el=>({
      top:Math.round(el.getBoundingClientRect().top),
      label:getComputedStyle(el.querySelector('.hud-metrics__label')!).fontSize,
      value:getComputedStyle(el.querySelector('.hud-metrics__value')!).fontSize,
    })));
    expect(new Set(cellShape.map(cell=>cell.top)).size).toBe(1);
    const hb=(await hud.boundingBox())!, sb=(await sheet.boundingBox())!;
    expect(sb.y).toBeGreaterThanOrEqual(hb.y+hb.height);
    expect(sb.y+sb.height).toBeLessThanOrEqual(size.height);
    expect(await sheet.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    // 기존 계기판 글꼴·배경·칸 형태는 주행 중과 동일하다.
    const style = await hud.evaluate(el=>({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor,cols:el.children.length}));
    const evidence = 'C:/20.HDev/boxcycle/tmp/ride-summary-20261119';
    await fs.mkdir(evidence,{recursive:true});
    await page.screenshot({path:`${evidence}/completed-${size.width}.png`});
    await sheet.getByRole('button',{name:'저장 안 함',exact:true}).click();
    await expect(sheet).toBeHidden();
    await expect(hud).toBeHidden();
    await page.goto(`${preview}?state=riding`);
    expect(await page.getByRole('group',{name:'주행 지표',exact:true}).evaluate(el=>({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor,cols:el.children.length}))).toEqual(style);
    expect(await page.getByRole('group',{name:'주행 지표',exact:true}).locator('.hud-metrics__cell').evaluateAll(cells=>cells.map(el=>({
      top:Math.round(el.getBoundingClientRect().top),
      label:getComputedStyle(el.querySelector('.hud-metrics__label')!).fontSize,
      value:getComputedStyle(el.querySelector('.hud-metrics__value')!).fontSize,
    })))).toEqual(cellShape);
  });
}

test('미완주·확인 중·새 도로 없음은 완주나 증가를 꾸며내지 않는다', async ({page}) => {
  await page.goto(`${preview}?state=summary`);
  await expect(page.locator('.ride-summary__story-headline')).toHaveText('주행을 마쳤어요. 내 도로망이 4.86 km 더 늘어났어요.');
  await page.goto(`${preview}?state=summary&completed&variant=zero`);
  await expect(page.locator('.ride-summary__story-headline')).toHaveText('완주했어요.');
  await page.goto(`${preview}?state=summary&completed&variant=pending`);
  await expect(page.locator('.ride-summary__story-headline')).toHaveText('완주했어요.');
  await expect(page.locator('.ride-summary__conquest-status')).toHaveText('새 도로 확인 중…');
});

for (const close of ['save','escape','backdrop','button'] as const) {
  test(`결과창 닫는 경로 ${close}에서 계기판 함께 해제`, async ({page}) => {
    await page.goto(`${preview}?state=summary&completed${close==='button'?'&variant=closed':''}`);
    if (close==='save') await page.getByRole('button',{name:'내 경로로 저장',exact:true}).click();
    if (close==='escape') await page.keyboard.press('Escape');
    if (close==='backdrop') await page.locator('.ride-summary__scrim').click({position:{x:5,y:5}});
    if (close==='button') await page.locator('.ride-summary__close').click();
    await expect(page.getByRole('dialog',{name:'주행 결과',exact:true})).toBeHidden();
    await expect(page.getByRole('group',{name:'주행 지표',exact:true})).toBeHidden();
  });
}
