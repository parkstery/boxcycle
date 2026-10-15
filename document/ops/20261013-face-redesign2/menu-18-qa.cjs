const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/20.HDev/boxcycle/node_modules/playwright');
const out = path.join(__dirname, 'menu-18-shots');
fs.mkdirSync(out, { recursive: true });
const baseline = fs.readFileSync(path.join(__dirname, 'menu-before-18.css'), 'utf8');
const errors = [], rows = [];
async function metrics(page) {
  return page.locator('.menu-panel').evaluate(el => {
    const rect = e => { const r = e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
    const body = el.querySelector('.menu-panel__body');
    const controls = [...el.querySelectorAll('button')].filter(e => e.getBoundingClientRect().width > 0).map(e => ({label:e.getAttribute('aria-label') || e.textContent.trim(),...rect(e),font:getComputedStyle(e).fontSize}));
    const ride=el.querySelector('.ride-panel');
    return {panel:rect(el),head:rect(el.querySelector('.menu-panel__head')),body:{...rect(body),scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollWidth:body.scrollWidth,clientWidth:body.clientWidth},ride:{...rect(ride),scrollHeight:ride.scrollHeight,clientHeight:ride.clientHeight,overflow:getComputedStyle(ride).overflowY},controls,text:el.textContent};
  });
}
async function swap(page, before) {
  await page.evaluate(({baseline,before}) => {
    const style=[...document.querySelectorAll('style[data-vite-dev-id]')].find(e=>e.dataset.viteDevId.replaceAll('\\','/').endsWith('/components/MenuPanel.css'));
    if(!style) throw new Error('MenuPanel style not found');
    if(!window.menu18After) window.menu18After=style.textContent;
    style.textContent=before?baseline:window.menu18After;
  }, {baseline,before});
  await page.waitForTimeout(260);
}
(async () => {
  const browser=await chromium.launch({headless:true});
  try {
    for(const viewport of [{width:740,height:300},{width:667,height:300},{width:844,height:390},{width:1366,height:768}]) {
      const page=await browser.newPage({viewport});
      page.on('pageerror', e=>errors.push(String(e)));
      page.setDefaultTimeout(20000);
      await page.goto('http://127.0.0.1:5013/',{waitUntil:'commit'});
      const gate=page.getByRole('dialog',{name:'시작',exact:true});
      await gate.waitFor({state:'visible',timeout:15000});
      if(await gate.isVisible()) {await gate.getByRole('button',{name:'시작',exact:true}).click();await gate.waitFor({state:'hidden'});}
      const trigger=page.getByRole('button',{name:'Trail 메뉴',exact:true});
      await trigger.click();
      await page.waitForTimeout(700);
      for(const scenario of ['live','summary','long']) {
        if(scenario==='summary') await page.locator('.ride-panel').evaluate(el=>{
          const p=document.createElement('p');p.className='ride-panel__summary';p.dataset.qa='summary';p.textContent='Trail 089 개설 · 대한민국 강원특별자치도 원주시 금대길';el.append(p);
        });
        if(scenario==='long') await page.locator('.ride-panel').evaluate(el=>{
          const fixture=document.createElement('div');fixture.dataset.qa='long';fixture.style.flex='0 0 auto';
          for(let i=0;i<20;i++){const p=document.createElement('p');p.textContent=`Trail ${100+i} · 대한민국 강원특별자치도 원주시 긴 이름 검증`;fixture.append(p);}el.append(fixture);
        });
        await swap(page,true);const before=await metrics(page);
        await page.screenshot({path:path.join(out,`${viewport.width}-${scenario}-before.png`)});
        await swap(page,false);const after=await metrics(page);
        await page.screenshot({path:path.join(out,`${viewport.width}-${scenario}-after.png`)});
        assert.equal(after.text,before.text);
        assert.equal(after.panel.w,before.panel.w);
        assert(after.panel.h<=viewport.height+1);
        assert(after.body.scrollWidth<=after.body.clientWidth+1);
        assert.deepEqual(after.controls.map(({label,w,h,font})=>({label,w,h,font})),before.controls.map(({label,w,h,font})=>({label,w,h,font})));
        let scroll=null;
        if(scenario==='long') {
          assert(after.ride.scrollHeight>after.ride.clientHeight);
          assert.equal(after.ride.overflow,'auto');
          await page.mouse.move(after.ride.x+after.ride.w/2,after.ride.y+after.ride.h/2);
          await page.mouse.wheel(0,10000);await page.waitForTimeout(300);
          scroll=await page.locator('.ride-panel').evaluate(el=>{const r=el.querySelector('[data-qa="long"]').lastElementChild.getBoundingClientRect();return {top:el.scrollTop,lastBottom:r.bottom};});
          assert(scroll.top>0);assert(scroll.lastBottom<=after.panel.y+after.panel.h+1);
          const current=await metrics(page);assert.equal(current.head.y,after.head.y);
        } else assert(after.panel.h<before.panel.h);
        rows.push({viewport,scenario,before,after,scroll,areaBefore:before.panel.w*before.panel.h/(viewport.width*viewport.height)*100,areaAfter:after.panel.w*after.panel.h/(viewport.width*viewport.height)*100});
      }
      await page.locator('[data-qa]').evaluateAll(els=>els.forEach(e=>e.remove()));
      await page.keyboard.press('Escape');await page.locator('.menu-panel-root').evaluate(el=>{if(el.classList.contains('is-open'))throw new Error('Escape did not close');});
      await trigger.click();await page.locator('.menu-panel__head').getByRole('button',{name:'메뉴 닫기',exact:true}).click();
      await trigger.click();await page.locator('.menu-panel__scrim').click({position:{x:viewport.width-15,y:viewport.height-15}});
      await trigger.click();await page.getByRole('button',{name:'내 경로 목록',exact:true}).click();await page.getByRole('dialog',{name:'내 경로',exact:true}).waitFor({state:'visible'});
      rows.push({viewport,functionality:{escape:true,closeButton:true,scrim:true,savedRoutesOpens:true}});
      await page.close();
    }
    assert.equal(errors.length,0);
  } finally {await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}
  console.log(JSON.stringify({PASS:true,scenarios:rows.length,errors,summary:rows.filter(r=>r.scenario).map(r=>({viewport:r.viewport,scenario:r.scenario,before:r.before.panel,after:r.after.panel,areaBefore:r.areaBefore,areaAfter:r.areaAfter,scroll:r.scroll}))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
