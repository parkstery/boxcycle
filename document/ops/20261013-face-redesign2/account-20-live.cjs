const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const out=path.join(__dirname,'account-20-live');fs.mkdirSync(out,{recursive:true});const rows=[],errors=[];
(async()=>{const browser=await chromium.launch({headless:true});
try{for(const viewport of [{width:740,height:300},{width:800,height:360}]){
const page=await browser.newPage({viewport});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5013/',{waitUntil:'commit'});const gate=page.getByRole('dialog',{name:'시작',exact:true});await gate.waitFor({state:'visible'});await gate.getByRole('button',{name:'시작',exact:true}).click();await gate.waitFor({state:'hidden'});
await page.locator('.hud-account').click();const panel=page.locator('.user-info-sheet');await panel.waitFor({state:'visible'});await page.waitForTimeout(700);
const m=await panel.evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},b=el.querySelector('.user-info-sheet__scroll-body');return {panel:rect(el),left:rect(el.querySelector('.user-info-sheet__col--account')),right:rect(el.querySelector('.user-info-sheet__col--stats')),scroll:b.scrollHeight-b.clientHeight,xOverflow:b.scrollWidth-b.clientWidth};});
assert.equal(m.panel.w,460);assert(m.right.x>m.left.x);assert.equal(m.scroll,0);assert.equal(m.xOverflow,0);await page.screenshot({path:path.join(out,`${viewport.width}-after.png`)});
const tabs=panel.getByRole('tab');for(let i=0;i<await tabs.count();i++){await tabs.nth(i).click();assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');}
await panel.locator('.user-info-sheet__last-ride').click();assert.equal(await panel.locator('.user-info-sheet__last-ride').getAttribute('aria-expanded'),'true');await panel.locator('.user-info-sheet__last-ride').click();
await panel.getByRole('button',{name:'로그아웃',exact:true}).click();await panel.getByRole('group',{name:'로그아웃 확인',exact:true}).waitFor({state:'visible'});await panel.getByRole('button',{name:'취소',exact:true}).click();
await page.keyboard.press('Escape');await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
await page.locator('.hud-account').click();await panel.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
await page.locator('.hud-account').click();await page.locator('.user-info-sheet__scrim').click({position:{x:15,y:viewport.height-15}});await page.locator('.user-info-sheet-root.is-open').waitFor({state:'hidden'});
rows.push({viewport,...m,functions:{periodTabs:true,historyToggle:true,logoutConfirmCancel:true,escape:true,closeButton:true,scrim:true}});await page.close();
}assert.equal(errors.length,0);}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}console.log(JSON.stringify({PASS:true,rows,errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
