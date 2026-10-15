const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const out=path.join(__dirname,'saved-21-live');fs.mkdirSync(out,{recursive:true});const rows=[],errors=[];
const baseline=fs.readFileSync(path.join(__dirname,'saved-before-21.css'),'utf8');
async function swap(page,before){await page.evaluate(({css,before})=>{const s=[...document.querySelectorAll('style[data-vite-dev-id]')].find(s=>s.dataset.viteDevId.replaceAll('\\','/').endsWith('/SavedRoutesPanel.css'));window.__savedLiveCSS??=[s,s.textContent];s.textContent=before?css:window.__savedLiveCSS[1];},{css:baseline,before});await page.waitForTimeout(150);}
(async()=>{const browser=await chromium.launch({headless:true});
try{for(const viewport of [{width:740,height:300},{width:800,height:360}]){
const page=await browser.newPage({viewport});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:5013/',{waitUntil:'commit'});
const gate=page.getByRole('dialog',{name:'시작',exact:true});await gate.waitFor({state:'visible'});await gate.getByRole('button',{name:'시작',exact:true}).click();await gate.waitFor({state:'hidden'});
await page.getByRole('button',{name:'Trail 메뉴',exact:true}).click();await page.getByRole('button',{name:'내 경로 목록',exact:true}).click();
const modal=page.getByRole('dialog',{name:'내 경로',exact:true});await modal.waitFor({state:'visible'});await page.waitForTimeout(350);
const measure=()=>page.locator('.oc-modal').evaluate(el=>[el,...el.querySelectorAll('*')].map(e=>{const r=e.getBoundingClientRect();return {cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height};}));
const after=await measure();assert.equal(after[0].w,560);await page.screenshot({path:path.join(out,`${viewport.width}-saved-after.png`)});await swap(page,true);const before=await measure();await swap(page,false);
await modal.getByRole('searchbox',{name:'경로 이름 검색',exact:true}).fill('없는경로');await modal.getByRole('button',{name:'닫기',exact:true}).click();await modal.waitFor({state:'hidden'});
const comparison=[];
for(const [label,dialog] of [['입문','입문 경로'],['퍼블릭','퍼블릭 경로']]){
await page.locator('.menu-panel').getByRole('button',{name:new RegExp('^'+label)}).click();const publicModal=page.getByRole('dialog',{name:dialog,exact:true});await publicModal.waitFor({state:'visible'});await page.waitForTimeout(600);
const original=await measure();await swap(page,true);const reference=await measure();await swap(page,false);assert.deepEqual(original,reference);
comparison.push({dialog,geometryUnchanged:true,rect:original[0]});await publicModal.getByRole('button',{name:'닫기',exact:true}).click();}
rows.push({viewport,before:before[0],after:after[0],publicAndIntro:comparison,functions:{menuEntry:true,search:true,close:true}});await page.close();
}assert.equal(errors.length,0);}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}console.log(JSON.stringify({PASS:true,rows,errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
