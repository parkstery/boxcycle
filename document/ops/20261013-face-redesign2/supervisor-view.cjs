const fs=require('node:fs'); const path=require('node:path'); const cp=require('node:child_process');
const {chromium}=require('C:/20.HDev/boxcycle/node_modules/playwright');
const root='C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle';
const out=process.env.AUDIT_OUT||'C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-shots';
fs.mkdirSync(out,{recursive:true});
const git=args=>cp.execFileSync('git',['-c',`safe.directory=${root}`,'-C',root,...args],{encoding:'utf8'});
const css={};for(const f of git(['diff','--name-only','e3c4fcc','--','apps/web/src']).trim().split('\n').filter(f=>f.endsWith('.css')))css[root+'/'+f]=git(['show','e3c4fcc:'+f]);
if(process.env.AUDIT_PROFILE_BASELINE){for(const key of Object.keys(css))delete css[key];css[root+'/apps/web/src/components/ProfileEditSheet.css']=fs.readFileSync(process.env.AUDIT_PROFILE_BASELINE,'utf8');}
if(process.env.AUDIT_ACCOUNT_BASELINE){for(const key of Object.keys(css))delete css[key];css[root+'/apps/web/src/components/UserInfoSheet.css']=fs.readFileSync(process.env.AUDIT_ACCOUNT_BASELINE,'utf8');}
if(process.env.AUDIT_MAP_BASELINE){for(const key of Object.keys(css))delete css[key];css[root+'/apps/web/src/components/map/MapViewSheet.css']=fs.readFileSync(process.env.AUDIT_MAP_BASELINE,'utf8');}
if(process.env.AUDIT_FIRST_BASELINE){for(const key of Object.keys(css))delete css[key];css[root+'/apps/web/src/components/ride/LocalFirstEntryCard.css']=fs.readFileSync(process.env.AUDIT_FIRST_BASELINE,'utf8');}
if(process.env.AUDIT_PICK_BASELINE){for(const key of Object.keys(css))delete css[key];css[root+'/apps/web/src/components/map/MapView.css']=fs.readFileSync(process.env.AUDIT_PICK_BASELINE,'utf8');}
const units=process.argv.slice(2);
(async()=>{
 const viewport={width:Number(process.env.AUDIT_WIDTH||800),height:Number(process.env.AUDIT_HEIGHT||360)};
 const browser=await chromium.launch({headless:true}); const context=await browser.newContext({viewport}); const page=await context.newPage(); page.setDefaultTimeout(30000);const runtime=[];page.on('pageerror',e=>runtime.push(String(e)));
 const rows=[];
 try{for(const unit of units){
  try{
   await page.goto('http://127.0.0.1:5013/',{waitUntil:'commit',timeout:30000});
   const gate=page.getByRole('dialog',{name:'시작',exact:true});
   await Promise.race([gate.waitFor({state:'visible',timeout:15000}),page.locator('.hud-account').waitFor({state:'visible',timeout:15000})]).catch(()=>{});
   if(unit!=='auth'&&await gate.isVisible()){await gate.getByRole('button',{name:'시작',exact:true}).click();await gate.waitFor({state:'hidden',timeout:30000});}
   await page.locator('.mapboxgl-canvas').first().waitFor({state:'visible'});
   if(unit!=='auth')await page.locator('.hud-account').waitFor({state:'visible',timeout:30000});
   if(['sensor-chip','route-dock'].includes(unit)){
    await page.locator('.mapboxgl-canvas').first().click({position:{x:480,y:180}});
    await page.locator('.map-view__pick').getByRole('button',{name:'Set start',exact:true}).click();
   }
   let sel='body';
   if(unit==='rotate'){await page.setViewportSize({width:360,height:800});await page.addStyleTag({content:'.rotate-overlay__icon { animation: none !important; }'});sel='.rotate-overlay';}
   else if(unit==='hud'){sel='.map-hud';}
   else if(unit==='first'){sel='.local-first__card';}
   else if(unit==='pick'){await page.locator('.mapboxgl-canvas').first().click({position:{x:480,y:180}});sel='.map-view__pick';}
   else if(unit==='auth'){sel='.auth-gate__card';}
   else if(unit==='sensor-chip'){sel='.hud-cadence';}
   else if(unit==='route-dock'){await page.locator('.route-dock__caret').click();sel='.route-dock__shell';}
   else if(unit==='sensor'){await page.locator('.route-dock__caret').click();sel='.cadence-sheet__panel';}
   else if(unit==='map'){await page.locator('.hud-bc-trigger').click();sel='.map-view-sheet__panel';}
   else if(['account','profile','history'].includes(unit)){
    await page.getByRole('button',{name:'사용자 정보',exact:true}).click();sel='.user-info-sheet';
    if(unit==='profile'){await page.getByRole('button',{name:'프로필 수정',exact:true}).click();sel='.profile-edit-sheet .ride-settings-sheet__panel';}
    if(unit==='history'){await page.locator('.user-info-sheet__last-ride').click();sel='.user-info-sheet';}
   }
   else if(['menu','settings','search','official','saved','public'].includes(unit)){
    await page.getByRole('button',{name:'Trail 메뉴',exact:true}).click();sel='.menu-panel';
    if(unit==='settings'){await page.locator('.menu-panel').getByRole('button',{name:'주행 설정',exact:true}).click();sel='.ride-settings-sheet__panel';}
    if(unit==='search'){await page.locator('.menu-panel').getByRole('button',{name:'지명 검색',exact:true}).click();sel='.place-search-panel';}
    if(unit==='official'){await page.locator('.menu-panel').getByRole('button',{name:/^입문/}).click();sel='.oc-modal';}
    if(unit==='saved'){await page.locator('.menu-panel').getByRole('button',{name:/^내 경로/}).click();sel='.oc-modal';}
    if(unit==='public'){await page.locator('.menu-panel').getByRole('button',{name:/^퍼블릭/}).click();sel='.oc-modal';}
   }
   const target=page.locator(sel).first();await target.waitFor({state:'visible'});await page.waitForTimeout(600);await page.mouse.move(799,359);
   const measure=()=>target.evaluate(el=>[el,...el.querySelectorAll('*')].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cls:e.className,x:Math.round(r.x*100)/100,y:Math.round(r.y*100)/100,w:Math.round(r.width*100)/100,h:Math.round(r.height*100)/100,sw:e.scrollWidth,sh:e.scrollHeight};}));
   const accountMeasure=()=>target.evaluate(el=>{const b=el.querySelector('.user-info-sheet__scroll-body');if(!b)return null;const r=b.getBoundingClientRect();const children=[...b.children].map(e=>{const q=e.getBoundingClientRect();return {cls:e.className,y:q.y,h:q.height,bottom:q.bottom};});return {clientH:b.clientHeight,scrollH:b.scrollHeight,excess:b.scrollHeight-b.clientHeight,naturalHeight:children.length?children.at(-1).bottom-children[0].y:0,rect:{y:r.y,h:r.height},children};});
   const measureFonts=()=>target.evaluate(el=>[el,...el.querySelectorAll('*')].map(e=>({cls:e.className,font:getComputedStyle(e).fontSize})));
   const after=await measure();const afterFonts=await measureFonts();const accountAfter=await accountMeasure();const style=await target.evaluate(el=>{let c=getComputedStyle(el);return {bg:c.backgroundColor,fg:c.color,border:c.borderColor};});
   const controls=await target.evaluate(el=>[...el.querySelectorAll('button,input')].map(e=>{let c=getComputedStyle(e);const r=e.getBoundingClientRect();return {cls:e.className,text:e.textContent.trim(),bg:c.backgroundColor,fg:c.color,border:c.borderColor,fontSize:c.fontSize,x:r.x,y:r.y,w:r.width,h:r.height};}));
   const overflow=await target.evaluate(el=>({clientW:el.clientWidth,clientH:el.clientHeight,scrollW:el.scrollWidth,scrollH:el.scrollHeight}));
   let hover;
   if(unit==='map'){const chip=target.locator('.map-view-sheet__chip.is-active').first();await chip.hover();hover=await chip.evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,fg:c.color};});await page.mouse.move(799,359);}
   await page.screenshot({path:path.join(out,unit+(viewport.width===800?'':'-'+viewport.width+'x'+viewport.height)+'-after.png')});
   await page.evaluate(css=>{window.__supervisorStyleBackup=[];for(const el of document.querySelectorAll('style[data-vite-dev-id]')){const id=el.getAttribute('data-vite-dev-id').replaceAll('\\','/');if(css[id]!==undefined){window.__supervisorStyleBackup.push([el,el.textContent]);el.textContent=css[id];}}},css);
   await page.waitForTimeout(300);const before=await measure();const beforeFonts=await measureFonts();const accountBefore=await accountMeasure();await page.screenshot({path:path.join(out,unit+(viewport.width===800?'':'-'+viewport.width+'x'+viewport.height)+'-before.png')});
   await page.evaluate(()=>{for(const [el,text]of window.__supervisorStyleBackup||[])el.textContent=text;delete window.__supervisorStyleBackup;});
   let functionality;
   if(unit==='map'){
    await target.getByRole('button',{name:'free',exact:true}).click();
    const selected=await target.getByRole('button',{name:'free',exact:true}).evaluate(el=>el.classList.contains('is-active'));
    const zoomBefore=await target.locator('.map-view-sheet__zoom-readout').textContent();
    await target.getByRole('button',{name:'줌 한 단계 확대',exact:true}).click();
    await page.waitForTimeout(350);const zoomAfter=await target.locator('.map-view-sheet__zoom-readout').textContent();
    await page.getByRole('button',{name:'맵 뷰 닫기',exact:true}).click();await target.waitFor({state:'hidden'});
    await page.locator('.hud-bc-trigger').click();await target.waitFor({state:'visible'});
    functionality={selected,zoomBefore,zoomAfter,closeAndReopen:true};
   }
   const geometryDifferences=after.map((a,i)=>JSON.stringify(a)===JSON.stringify(before[i])?null:{index:i,before:before[i],after:a}).filter(Boolean);
   rows.push({unit,sel,viewport:page.viewportSize(),geometryIdentical:JSON.stringify(before)===JSON.stringify(after),geometryDifferences,elements:after.length,style,controls,overflow,hover,functionality,beforeFonts,afterFonts,accountBefore,accountAfter,beforeRect:before[0],afterRect:after[0]});
  }catch(e){rows.push({unit,error:String(e)});}
 }}finally{await browser.close();}
 const result={viewport,rows,runtimeErrors:runtime};fs.writeFileSync(path.join(out,'latest-'+units.join('-')+'-'+viewport.width+'x'+viewport.height+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
