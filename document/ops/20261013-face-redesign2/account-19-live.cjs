const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const baseline=fs.readFileSync(path.join(__dirname,'account-before-19.css'),'utf8');
const out=path.join(__dirname,'account-19-live');fs.mkdirSync(out,{recursive:true});
const rows=[],errors=[];
(async()=>{const browser=await chromium.launch({headless:true});
try{for(const viewport of [{width:740,height:300},{width:844,height:390}]){
const page=await browser.newPage({viewport});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5013/',{waitUntil:'commit'});
const gate=page.getByRole('dialog',{name:'시작',exact:true});await gate.waitFor({state:'visible'});await gate.getByRole('button',{name:'시작',exact:true}).click();await gate.waitFor({state:'hidden'});
await page.locator('.hud-account').click();const panel=page.locator('.user-info-sheet');await panel.waitFor({state:'visible'});await page.waitForTimeout(1000);
const measure=()=>panel.evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('.user-info-sheet__scroll-body');return {w:r.width,h:r.height,scroll:b.scrollHeight-b.clientHeight,controls:[...el.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),w:r.width,h:r.height,font:getComputedStyle(e).fontSize};})};});
const after=await measure();await page.screenshot({path:path.join(out,`${viewport.width}-after.png`)});
await page.evaluate(b=>{const s=[...document.querySelectorAll('style[data-vite-dev-id]')].find(s=>s.dataset.viteDevId.replaceAll('\\','/').endsWith('/UserInfoSheet.css'));window.account19Style=[s,s.textContent];s.textContent=b;},baseline);
const before=await measure();await page.screenshot({path:path.join(out,`${viewport.width}-before.png`)});
await page.evaluate(()=>{window.account19Style[0].textContent=window.account19Style[1];});
assert(after.h<before.h);assert.deepEqual(after.controls,before.controls);assert(after.scroll<=before.scroll+1);
const tabs=panel.getByRole('tab');for(let i=0;i<await tabs.count();i++){await tabs.nth(i).click();assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');}
await panel.getByRole('button',{name:'로그아웃',exact:true}).click();await panel.getByRole('group',{name:'로그아웃 확인',exact:true}).waitFor({state:'visible'});
await panel.getByRole('button',{name:'취소',exact:true}).click();await panel.getByRole('group',{name:'로그아웃 확인',exact:true}).waitFor({state:'hidden'});
await page.keyboard.press('Escape');await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
await page.locator('.hud-account').click();await panel.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
await page.locator('.hud-account').click();await page.locator('.user-info-sheet__scrim').click({position:{x:15,y:viewport.height-15}});await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
rows.push({viewport,before,after,areaBefore:before.w*before.h/(viewport.width*viewport.height)*100,areaAfter:after.w*after.h/(viewport.width*viewport.height)*100,functions:{periodTabs:true,logoutConfirmCancel:true,escape:true,closeButton:true,scrim:true}});await page.close();
}assert.equal(errors.length,0);}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}
console.log(JSON.stringify({PASS:true,rows,errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
