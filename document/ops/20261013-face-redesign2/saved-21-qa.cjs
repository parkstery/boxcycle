const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const out=path.join(__dirname,'saved-21-shots');fs.mkdirSync(out,{recursive:true});
const baseline=fs.readFileSync(path.join(__dirname,'saved-before-21.css'),'utf8');const rows=[],errors=[];
(async()=>{const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));
try{for(const viewport of [{width:740,height:300},{width:667,height:300},{width:800,height:360},{width:844,height:390},{width:1366,height:768}]){
await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:5013/',{waitUntil:'domcontentloaded'});
await page.evaluate(async()=>{const src=await(await fetch('/src/components/ride/SavedRoutesModal.tsx')).text(),main=await(await fetch('/src/main.tsx')).text();
const reactURL=src.match(/from "([^"]*\/react\.js[^\"]*)"/)[1],domURL=main.match(/from "([^"]*react-dom_client[^\"]*)"/)[1];const React=(await import(reactURL)).default,dom=await import(domURL),comp=await import('/src/components/ride/SavedRoutesModal.tsx');
document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);window.__qaRoot=(dom.createRoot||dom.default.createRoot)(mount);window.__qaEvents=[];
window.__qaRender=state=>{const count=state==='empty'?0:state==='one'?1:state==='two'?2:20;
const routes=Array.from({length:count},(_,i)=>({id:'r'+i,name:'원주시 경로 '+String(i).padStart(2,'0')+' · 대한민국 강원특별자치도 긴 경로 이름 비교',profile:['cycling','driving','walking'][i%3],startLngLat:[127,37],endLngLat:[127.01,37.01],waypoints:[],geometry:{type:'LineString',coordinates:[[127,37],[127.01,37.01]]},distanceMeters:1000*(i+1),durationSec:600,createdAtIso:'2026-10-14T00:00:00Z',updatedAtIso:new Date(Date.UTC(2026,9,14,0,i)).toISOString(),completed:i%3===0?1:0,completedAtIso:null,expiresAtIso:null,lastRideId:null,lastProgressRatio:i%3===1?0.4:0}));
window.__qaRoot.render(React.createElement(comp.SavedRoutesModal,{key:state,routes,loading:state==='loading',guestNotice:true,sessionIdle:true,quotaNotice:state==='quota'?'미완주 경로 저장 한도를 초과했습니다. 경로를 완주하거나 정리한 뒤 다시 시도하세요. '.repeat(5):null,onDismissQuotaNotice:()=>window.__qaEvents.push('dismiss'),onLoadRoute:r=>window.__qaEvents.push('load:'+r.id),onResumeRoute:r=>window.__qaEvents.push('resume:'+r.id),onRenameRoute:async()=>{if(state==='error')throw new Error('긴 오류 안내: 경로 이름을 저장하지 못했습니다. '.repeat(15));window.__qaEvents.push('rename');},onDeleteRoute:async()=>window.__qaEvents.push('delete'),onClose:()=>window.__qaEvents.push('close')}));};});
for(const state of ['empty','one','two','many','selected','rename','quota','error','loading']){
await page.evaluate(s=>window.__qaRender(s),state);const modal=page.getByRole('dialog',{name:'내 경로',exact:true});await modal.waitFor({state:'visible'});await page.waitForTimeout(300);
if(['selected','rename','error'].includes(state))await modal.locator('.saved-routes__row').first().click();
if(['rename','error'].includes(state))await modal.getByRole('button',{name:'이름',exact:true}).click();
if(state==='error'){await modal.locator('.saved-routes__rename-input').fill('오류검증');await modal.getByRole('button',{name:'저장',exact:true}).click();await modal.getByRole('alert').waitFor({state:'visible'});}
const measure=()=>modal.evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},list=el.querySelector('.saved-routes__list'),header=el.querySelector('.oc-modal__head'),items=[...el.querySelectorAll('.saved-routes__item')],lr=list?.getBoundingClientRect();
return {panel:rect(el),list:list?{...rect(list),scrollH:list.scrollHeight,clientH:list.clientHeight,overflow:getComputedStyle(list).overflowY}:null,header:rect(header),xOverflow:el.scrollWidth-el.clientWidth,bodyOverflow:el.querySelector('.oc-modal__body').scrollHeight-el.querySelector('.oc-modal__body').clientHeight,savedOverflow:el.querySelector('.saved-routes').scrollHeight-el.querySelector('.saved-routes').clientHeight,visibleFullRows:lr?items.filter(e=>{const r=e.getBoundingClientRect();return r.top>=lr.top-1&&r.bottom<=lr.bottom+1}).length:0,selection:el.querySelector('.saved-routes__item.is-selected')?.textContent,toolbar:getComputedStyle(el.querySelector('.saved-routes__toolbar')||el).display,text:el.textContent,controls:[...el.querySelectorAll('button,input,select,.saved-routes__row')].map(e=>({text:e.getAttribute('aria-label')||e.textContent.trim(),...rect(e),font:getComputedStyle(e).fontSize}))};});
const after=await measure();if(viewport.width===740||viewport.width===800)await page.screenshot({path:path.join(out,`${state}-${viewport.width}-after.png`)});
await page.evaluate(b=>{const s=[...document.querySelectorAll('style[data-vite-dev-id]')].find(s=>s.dataset.viteDevId.replaceAll('\\','/').endsWith('/SavedRoutesPanel.css'));window.__savedCSS=[s,s.textContent];s.textContent=b;},baseline);await page.waitForTimeout(100);const before=await measure();if(viewport.width===740)await page.screenshot({path:path.join(out,`${state}-${viewport.width}-before.png`)});
await page.evaluate(()=>{window.__savedCSS[0].textContent=window.__savedCSS[1];});
assert.equal(after.text,before.text);assert(after.panel.h<=viewport.height-15);assert.equal(after.xOverflow,0);
if(!['quota','error','loading'].includes(state))assert(after.visibleFullRows>=before.visibleFullRows);
for(const control of after.controls.filter(c=>c.h>0)){const old=before.controls.find(c=>c.text===control.text);assert(old);assert.equal(control.font,old.font);if(!control.text.startsWith('원주시 경로'))assert(control.h>=old.h-1);}
for(const option of after.controls.filter(c=>c.text.startsWith('원주시 경로')))assert(option.h>=44);
if(state==='many')assert.equal(after.toolbar,'none');if(state==='selected')assert.notEqual(after.toolbar,'none');
rows.push({viewport,state,before,after});
}
await page.evaluate(()=>window.__qaRender('functions'));await page.waitForTimeout(350);const modal=page.getByRole('dialog',{name:'내 경로',exact:true});
for(const [label,count] of [['완주',7],['미완주',7],['대기',6],['전체',20]]){await modal.getByRole('tab',{name:new RegExp('^'+label)}).click();assert.equal(await modal.locator('.saved-routes__row').count(),count);}
for(const sort of ['name','distance','recent'])await modal.getByLabel('정렬 기준').selectOption(sort);
await modal.locator('.saved-routes__row').first().focus();await page.keyboard.press('Enter');assert.equal(await modal.locator('.saved-routes__row').first().getAttribute('aria-selected'),'true');await page.keyboard.press(' ');assert.equal(await modal.locator('.saved-routes__row').first().getAttribute('aria-selected'),'false');
await modal.locator('.saved-routes__row').first().click();await modal.getByRole('button',{name:'이어 달리기',exact:true}).click();assert((await page.evaluate(()=>window.__qaEvents)).includes('resume:r19'));
await modal.getByRole('button',{name:'이름',exact:true}).click();await modal.locator('.saved-routes__rename-input').fill('변경검증');await modal.getByRole('button',{name:'저장',exact:true}).click();assert((await page.evaluate(()=>window.__qaEvents)).includes('rename'));
await modal.getByRole('searchbox',{name:'경로 이름 검색',exact:true}).fill('없는경로');await modal.getByText('검색 결과가 없습니다.',{exact:true}).waitFor({state:'visible'});
await modal.getByRole('searchbox',{name:'경로 이름 검색',exact:true}).fill('원주시 경로 03');assert.equal(await modal.locator('.saved-routes__row').count(),1);await modal.locator('.saved-routes__row').click();await modal.getByRole('button',{name:'열기',exact:true}).click();assert((await page.evaluate(()=>window.__qaEvents)).includes('load:r3'));
rows.push({viewport,functionality:true,events:await page.evaluate(()=>window.__qaEvents)});
}assert.equal(errors.length,0);}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}
console.log(JSON.stringify({PASS:true,rows:rows.filter(r=>r.state).map(r=>({viewport:r.viewport,state:r.state,before:r.before.panel,after:r.after.panel,rowsBefore:r.before.visibleFullRows,rowsAfter:r.after.visibleFullRows,listBefore:r.before.list?.clientH,listAfter:r.after.list?.clientH})),errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});

