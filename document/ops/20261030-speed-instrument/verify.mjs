import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire('C:/20.HDev/boxcycle/apps/web/package.json');
const { chromium } = require('@playwright/test');
const evidence = new URL('./evidence/', import.meta.url);
await mkdir(evidence, {recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({reducedMotion:'reduce'});
const base='http://127.0.0.1:5031/scripts/ui-800x360/preview.html';
const results=[];
try {
  for (const [width,height] of [[800,360],[736,300],[699,273],[667,300],[320,568]]) {
    await page.setViewportSize({width,height});
    for (const state of ['sensor','manual','sensor-connected','sensor-disconnected','sensor-unsupported','sensor-riding-manual']) {
      await page.goto(`${base}?state=${state==='manual'?'sensor':state}`);
      const sheet=page.getByRole('dialog',{name:'케이던스 센서',exact:true});
      await sheet.waitFor();
      if(state==='manual') await sheet.getByRole('button',{name:'센서 없음',exact:true}).click();
      if(state==='manual' || state==='sensor-riding-manual') {
        const number=sheet.getByRole('spinbutton',{name:'속도 km/h',exact:true});
        await number.fill('35'); await number.press('Enter');
        await sheet.getByRole('button',{name:'속도 증가',exact:true}).click();
        assert.equal(await number.inputValue(),'36');
        await sheet.getByRole('button',{name:'속도 감소',exact:true}).click();
        assert.equal(await number.inputValue(),'35');
        const slider=sheet.getByRole('slider',{name:'세션 속도 km/h',exact:true});
        await slider.focus(); await slider.press('Home');
        assert.equal(await number.inputValue(),'5');
        assert.equal(await sheet.getByRole('button',{name:'속도 감소',exact:true}).isDisabled(),true);
        assert.equal(await sheet.locator('.ride-speed-gauge path[stroke="#2457d6"]').count(),0);
        await slider.press('End');
        assert.equal(await number.inputValue(),'50');
        assert.equal(await sheet.getByRole('button',{name:'속도 증가',exact:true}).isDisabled(),true);
        assert.equal(await sheet.locator('.ride-speed-gauge path[stroke="#2457d6"]').count(),6);
        await number.fill('99'); await number.press('Enter'); assert.equal(await number.inputValue(),'50');
        await number.fill(''); await number.press('Enter'); assert.equal(await number.inputValue(),'5');
        await number.fill('25'); await number.press('Enter');
      }
      const layout=await sheet.locator('.cadence-sheet__panel').evaluate(el=>{
        const rect=el.getBoundingClientRect();
        const detail=el.querySelector('.cadence-sheet__detail');
        return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,
          overflow:el.scrollWidth-el.clientWidth, detailOverflow:detail.scrollWidth-detail.clientWidth,
          children:[...detail.children].map(e=>({cls:e.className,height:e.getBoundingClientRect().height,gap:getComputedStyle(e).gap})),
          clipped:[...el.querySelectorAll('button,input')].filter(e=>{
            const r=e.getBoundingClientRect();return r.width && (r.x<rect.x-1||r.right>rect.right+1||r.y<rect.y-1||r.bottom>rect.bottom+1);
          }).map(e=>e.getAttribute('aria-label')||e.textContent)};
      });
      assert.ok(layout.x>=-1 && layout.y>=-1 && layout.x+layout.width<=width+1 && layout.y+layout.height<=height+1,JSON.stringify({width,height,state,layout}));
      assert.equal(layout.overflow,0); assert.equal(layout.detailOverflow,0); assert.deepEqual(layout.clipped,[]);
      results.push({width,height,state,layout});
      await page.evaluate(async()=>{await document.fonts.ready; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      await page.screenshot({path:new URL(`${state}-${width}x${height}.png`,evidence).pathname.replace(/^\//,''),animations:'disabled'});
      await sheet.getByRole('button',{name:'센서 설정 닫기',exact:true}).click();
      assert.equal(await sheet.count(),0);
    }
  }
  await writeFile(new URL('qa.json',evidence),JSON.stringify(results,null,2));
  console.log(`PASS ${results.length} layouts, manual input/steps/slider/bounds/gauge/close`);
} finally {await browser.close();}
