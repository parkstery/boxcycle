import fs from 'node:fs/promises';
import {test,expect} from '@playwright/test';

for(const size of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
 for(const state of ['riding','paused','summary']) {
  test(`실제 RPM 포함 타이틀6개 정렬 ${state} ${size.width}`,async({page})=>{
   await page.setViewportSize(size);
   await page.goto(`/scripts/ui-800x360/preview.html?state=${state}&ownedHint&completed`);
   const labels=page.locator('.map-hud__tl-row .hud-metrics__label');
   await expect(labels).toHaveText(['RPM','거리','시간','속도','새 도로','평균']);
   const positions=()=>labels.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
   const tops=await positions();
   expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(.1);
   const values=await page.locator('.map-hud__tl-row .hud-metrics__value').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));
   expect(Math.max(...values)-Math.min(...values)).toBeLessThan(.1);
   await expect(page.locator('.hud-metrics__conquest-owned-hint')).toBeVisible();
   await page.locator('.hud-metrics__conquest-owned-hint').evaluate(el=>el.remove());
   expect(await positions()).toEqual(tops);
   const sensor=page.getByRole('button',{name:/^케이던스 센서:/});
   expect((await sensor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
   expect((await sensor.locator('.hud-cadence__knob').boundingBox())!.height).toBe(30);
   if(size.width===800){
    await fs.mkdir('C:/20.HDev/boxcycle/tmp/hud-title-alignment-20261119',{recursive:true});
    await page.screenshot({path:`C:/20.HDev/boxcycle/tmp/hud-title-alignment-20261119/${state}.png`});
   }
   if(state!=='summary'){
    await sensor.click();
    await expect(page.getByRole('dialog',{name:'케이던스 센서',exact:true})).toBeVisible();
   }
  });
 }
}
