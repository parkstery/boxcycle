// Actual React component with local mock props; not a real authenticated/save flow.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const out=process.env.AUDIT_OUT||'C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/profile-05-shots';
fs.mkdirSync(out,{recursive:true});
const baseline=fs.readFileSync(process.env.AUDIT_PROFILE_BASELINE||'C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/profile-before-05.css','utf8');
(async()=>{const browser=await chromium.launch({headless:true});const page=await browser.newPage();const rows=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{for(const viewport of [{width:800,height:360},{width:740,height:300},{width:667,height:300},{width:844,height:390}]){
await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:5013/',{waitUntil:'domcontentloaded'});
await page.locator('.mapboxgl-canvas').first().waitFor({state:'visible',timeout:30000});
await page.evaluate(async()=>{const src=await(await fetch('/src/components/ProfileEditSheet.tsx')).text(),main=await(await fetch('/src/main.tsx')).text();
const reactURL=src.match(/from "([^"]*\/react\.js[^\"]*)"/)[1],domURL=main.match(/from "([^"]*react-dom_client[^\"]*)"/)[1];
const React=(await import(reactURL)).default,dom=await import(domURL),comp=await import('/src/components/ProfileEditSheet.tsx');
document.getElementById('root').style.display='none';const mount=document.createElement('div');document.body.append(mount);window.__qaRoot=(dom.createRoot||dom.default.createRoot)(mount);
window.__qaRender=locked=>window.__qaRoot.render(React.createElement(comp.ProfileEditSheet,{key:String(locked),open:true,user:{isAnonymous:false,displayName:'테스트라이더'},weightKg:65,intensityId:'medium',nicknameChangedAtMs:locked?Date.now():null,onClose:()=>{},onChangeNickname:async()=>{throw Error('Mock only');},onWeightKg:()=>{},onIntensityId:()=>{}}));});
for(const state of ['account','locked','error']){
await page.evaluate(s=>window.__qaRender(s==='locked'),state);const panel=page.locator('.profile-edit-sheet .ride-settings-sheet__panel');await panel.waitFor({state:'visible'});await page.waitForTimeout(250);
if(state==='error'){await panel.locator('input[type=number]').fill('9999');await panel.getByRole('button',{name:'저장',exact:true}).click();await panel.getByRole('alert').waitFor();}
const measure=()=>panel.evaluate(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,clientH:el.clientHeight,scrollH:el.scrollHeight,clientW:el.clientWidth,scrollW:el.scrollWidth,controls:[...el.querySelectorAll('button,input')].map(e=>{const c=getComputedStyle(e),a=e.getBoundingClientRect();return {text:e.textContent||e.getAttribute('aria-label')||e.type,w:a.width,h:a.height,y:a.y,font:c.fontSize,disabled:e.disabled};})};});
const after=await measure();await page.screenshot({path:path.join(out,`mock-${state}-${viewport.width}x${viewport.height}-after.png`)});
await page.evaluate(b=>{const s=[...document.querySelectorAll('style[data-vite-dev-id]')].find(s=>s.getAttribute('data-vite-dev-id').endsWith('/ProfileEditSheet.css'));window.__qaCSS=[s,s.textContent];s.textContent=b;},baseline);await page.waitForTimeout(50);
const before=await measure();await page.screenshot({path:path.join(out,`mock-${state}-${viewport.width}x${viewport.height}-before.png`)});await page.evaluate(()=>{window.__qaCSS[0].textContent=window.__qaCSS[1];});rows.push({viewport,state,fixture:'real component/mock User and callbacks, no Firebase save',before,after});
}}}finally{await browser.close();}fs.writeFileSync(path.join(out,'mock-states.json'),JSON.stringify({rows,errors},null,2));console.log(JSON.stringify({rows:rows.map(r=>({viewport:r.viewport,state:r.state,beforeH:r.before.h,afterH:r.after.h,overflowY:r.after.scrollH-r.after.clientH,overflowX:r.after.scrollW-r.after.clientW,minHeight:Math.min(...r.after.controls.map(c=>c.h))})),errors},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
