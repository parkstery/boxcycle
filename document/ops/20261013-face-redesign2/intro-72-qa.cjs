const {chromium}=require('../../../node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(__dirname,'intro-72-shots');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();const rows=[];
 try{
 await page.route('**/src/main.tsx*',r=>r.fulfill({contentType:'application/javascript',body:'export {};'}));
 await page.goto('http://127.0.0.1:5014/intro-72-qa');
 await page.evaluate(async()=>{
  await import('/src/tokens.css');await import('/src/index.css');await import('/src/App.css');await import('/src/boxcycle-theme.css');
  const R=await import('/node_modules/.vite/deps/react.js');const D=await import('/node_modules/.vite/deps/react-dom_client.js');const I=await import('/src/components/auth/AppIntroScreen.tsx');const G=await import('/src/components/auth/GuestEntryCard.tsx');
  const React=R.default||R;const host=document.createElement('div');document.body.append(host);window.root72=(D.createRoot||D.default.createRoot)(host);window.starts72=0;
  window.render72=()=>window.root72.render(React.createElement(I.AppIntroScreen,{onStart:()=>{window.starts72++;window.root72.render(React.createElement(G.GuestEntryCard,{busy:false,error:null,onStartGuest:()=>{},onGoogleSignIn:()=>{}}))}}));
  const map=document.createElement('div');map.style.cssText='position:fixed;inset:0;background:#354f50;';map.innerHTML='<button id="map72" style="position:absolute;right:20px;top:20px;min-width:44px;min-height:44px">+</button><span id="attribution72" style="position:absolute;right:5px;bottom:0;color:white">Map attribution fixture</span>';document.body.prepend(map);window.mapClicks72=0;document.getElementById('map72').onclick=()=>window.mapClicks72++;
 });
 for(const viewport of [{width:667,height:300},{width:740,height:300},{width:800,height:360},{width:844,height:390},{width:1366,height:768},{width:740,height:180}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>window.render72());const intro=page.getByRole('region',{name:'앱 소개'});await intro.waitFor();
  const cta=page.getByRole('button',{name:'시작하기'});await cta.focus();
  const measured=await cta.evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:document.documentElement.scrollWidth>innerWidth}});
  assert(measured.width>=44&&measured.height>=44);assert(measured.x>=0&&measured.y>=0&&measured.x+measured.width<=viewport.width&&measured.y+measured.height<=viewport.height);assert(measured.hit);assert(!measured.overflow);
  await page.locator('#map72').click();assert(await page.evaluate(()=>window.mapClicks72>0));
  await page.screenshot({animations:'disabled',path:path.join(out,`${viewport.width}x${viewport.height}.png`)});
  await cta.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'시작',exact:true}).waitFor();assert.equal(await intro.count(),0);assert(await page.getByRole('button',{name:'시작',exact:true}).isVisible());assert(await page.getByRole('button',{name:'Google로 시작',exact:true}).isVisible());rows.push({viewport,measured,transition:'PASS'});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.render72());await page.getByRole('region',{name:'앱 소개'}).waitFor();assert.equal(await page.locator('.app-intro').evaluate(e=>getComputedStyle(e).animationName),'none');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,reducedMotion:'PASS',fixture:'real components, simulated map; no Firebase writes'},null,2));console.log(JSON.stringify({states:rows.length,reducedMotion:'PASS',transition:'PASS',mapHit:'PASS'}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
