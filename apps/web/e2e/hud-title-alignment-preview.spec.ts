import {test,expect} from '@playwright/test';
test('타이틀 정렬 시안 — 안내 유무에 관계없이 여섯 타이틀 높이 동일',async({page})=>{
 await page.setViewportSize({width:760,height:560});
 await page.goto('/scripts/hud-title-alignment-preview.html');
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(f=>f.dataset.ready==='true'));
 const tops=()=>page.evaluate(()=>[...document.querySelector<HTMLIFrameElement>('#after')!.contentDocument!.querySelectorAll('.hud-metrics__label')].map(el=>el.getBoundingClientRect().top));
 const before=await tops();expect(before).toHaveLength(6);expect(Math.max(...before)-Math.min(...before)).toBeLessThan(.1);
 await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261119-hud-title-alignment/preview.png'});
 await page.locator('#toggle').click();
 expect(await tops()).toEqual(before);
});
