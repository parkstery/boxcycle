const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const out=path.join(__dirname,'account-20-shots');fs.mkdirSync(out,{recursive:true});
const prior=JSON.parse(fs.readFileSync(path.join(__dirname,'account-19-shots/mock-states.json'),'utf8'));
const rows=[],errors=[];
(async()=>{const browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*getSubscriptionMeHttp*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{tier:'registered_free',subscriptionStatus:'none',canCheckout:true,canManagePortal:false}})}));
try{for(const viewport of [{width:740,height:300},{width:667,height:300},{width:800,height:360},{width:844,height:390},{width:1366,height:768}]){
await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:5013/',{waitUntil:'domcontentloaded'});
await page.evaluate(async()=>{const src=await(await fetch('/src/components/UserInfoSheet.tsx')).text(),main=await(await fetch('/src/main.tsx')).text();
const reactURL=src.match(/from "([^"]*\/react\.js[^\"]*)"/)[1],domURL=main.match(/from "([^"]*react-dom_client[^\"]*)"/)[1];
const React=(await import(reactURL)).default,dom=await import(domURL),comp=await import('/src/components/UserInfoSheet.tsx');
document.getElementById('root').style.display='none';const mount=document.createElement('div');mount.id='account-qa';document.body.append(mount);window.__qaRoot=(dom.createRoot||dom.default.createRoot)(mount);
window.__qaRender=state=>{const guest=state.startsWith('guest'),assets=state.startsWith('assets')||state==='rich';window.__qaRoot.render(React.createElement(comp.UserInfoSheet,{key:state,open:true,onClose:()=>{},onEditProfile:()=>{},user:{uid:'',isAnonymous:guest,displayName:'테스트라이더',email:'local@example.invalid',getIdToken:async()=> 'local-mock-only'},recentSessions:[],isGuest:guest,tier:guest?'anonymous':'registered_free',subscriptionStatus:'none',isPaid:false,busy:false,onLinkGoogle:()=>{},onServiceExit:()=>{},conquest:assets?{totalMeters:156800,totalCells:3}:null,mileage:assets?{totalMeters:403200,totalSec:11700,rideCount:430}:null,subscriptionFlash:state==='note'?'검증용 긴 안내입니다. 모든 내용과 버튼에 접근할 수 있어야 합니다. '.repeat(5):null}));};});
for(const state of ['guest','free','assets','note','history','assets-deletion','guest-logout','rich']){
await page.evaluate(s=>window.__qaRender(s),state);const panel=page.locator('#account-qa .user-info-sheet');await panel.waitFor({state:'visible'});await page.waitForTimeout(350);
if(state==='rich')await panel.evaluate(el=>{
el.querySelector('.user-info-sheet__id strong').textContent='아주긴닉네임테스트라이더';
el.querySelector('.user-info-sheet__stats-meta span').textContent='2026년 1월 1일 ~ 12월 31일';
el.querySelector('.user-info-sheet__stats-meta span:last-child').textContent='주행 400회';
el.querySelector('.user-info-sheet__stats-hero strong').textContent='246.77';
const story=document.createElement('p');story.className='user-info-sheet__stats-story';story.textContent='올해 열심히 페달을 돌렸어요. 어느새 245km네요.';el.querySelector('.user-info-sheet__stats-hero').before(story);
const cells=el.querySelectorAll('.user-info-sheet__stats > div');cells[0].querySelector('strong').textContent='24h 13m';cells[1].querySelector('strong').textContent='10.2';cells[2].querySelector('strong').textContent='6418';
const note=document.createElement('span');note.className='user-info-sheet__stat-note';note.textContent='미산정 57회 · 옛=거리환산 · 새=페달·체중';cells[2].append(note);
const summary=el.querySelector('.user-info-sheet__last-ride-v');summary.classList.remove('is-empty');summary.textContent='123.45 km · 12h 34m · 25.6 km/h · —';
});
if(state==='history')await panel.locator('.user-info-sheet__last-ride').click();
if(state.endsWith('logout'))await panel.getByRole('button',{name:'로그아웃',exact:true}).click();
if(state.endsWith('deletion'))await panel.getByRole('button',{name:'계정 탈퇴',exact:true}).click();
const m=await panel.evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},b=el.querySelector('.user-info-sheet__scroll-body');
return {panel:rect(el),body:rect(b),scroll:b.scrollHeight-b.clientHeight,xOverflow:b.scrollWidth-b.clientWidth,left:rect(el.querySelector('.user-info-sheet__col--account')),right:rect(el.querySelector('.user-info-sheet__col--stats')),controls:[...el.querySelectorAll('button,input')].map(e=>({text:e.textContent.trim()||e.getAttribute('aria-label'),...rect(e),font:getComputedStyle(e).fontSize})),nestedOverflow:[...el.querySelectorAll('.user-info-sheet__col,.user-info-sheet__stats > div')].map(e=>({cls:e.className,...rect(e),x:e.scrollWidth-e.clientWidth})),text:el.textContent};});
assert.equal(m.panel.w,460);assert(m.panel.h<=viewport.height+1);assert.equal(m.xOverflow,0);assert(m.right.x>=m.left.x+m.left.w-1);assert(Math.abs(m.left.y-m.right.y)<1);
assert(m.nestedOverflow.every(e=>e.x<=1));
const old=prior.rows.find(r=>r.viewport.width===viewport.width&&r.state===state);
if(old){for(const control of m.controls){const before=old.after.controls.find(c=>c.text===control.text);assert(before,'Existing control label changed: '+control.text);assert.equal(control.font,before.font);assert(control.h>=before.h-1);}assert(m.scroll<=old.after.excess+1);}
if(['guest','free','assets','rich'].includes(state))assert.equal(m.scroll,0,'Default content should fit '+state+' '+viewport.width);
if(viewport.width===740||viewport.width===800||state==='rich')await page.screenshot({path:path.join(out,`${state}-${viewport.width}-after.png`)});
const reachable=await panel.evaluate(el=>{const b=el.querySelector('.user-info-sheet__scroll-body');b.scrollTop=b.scrollHeight;const r=b.getBoundingClientRect(),a=[...b.querySelectorAll('button,input')].at(-1)?.getBoundingClientRect();return !a||a.bottom<=r.bottom+1;});assert(reachable);
rows.push({viewport,state,...m,reachable,baseline:old?{panel:old.after.panel,scroll:old.after.excess}:null,fixture:state==='rich'?'Actual component + mock props + synthetic rich statistics text':'Actual component + mock props/subscription'});
}
}assert.equal(errors.length,0);}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors},null,2));}
console.log(JSON.stringify({PASS:true,rows:rows.map(r=>({viewport:r.viewport,state:r.state,panel:r.panel,scroll:r.scroll,reachable:r.reachable})),errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
