import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const output = new URL('../../../document/ops/20261029-map-overlay-readability/', import.meta.url);
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const results=[];
const contentCases=[];
try {
 for(const [width,height] of [[1040,475],[800,360],[736,300],[699,273],[667,300]]) {
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=glance-riding&interval&noSensor');
  await page.locator('.lb-glance__row').last().waitFor();
  const result = await page.evaluate(()=>{
   const panel=document.querySelector('.lb-glance__panel'),list=panel.querySelector('ol'),p=panel.getBoundingClientRect(),l=list.getBoundingClientRect(),knob=document.querySelector('.edge-panel-tab--right .edge-panel-tab__knob').getBoundingClientRect();
   const hit=document.elementFromPoint(knob.x+knob.width/2,knob.y+knob.height/2);
   const hud=document.querySelector('.ride-interval-hud'), h=hud.getBoundingClientRect();
   return {width:innerWidth,height:innerHeight,panel:{x:p.x,y:p.y,width:p.width,height:p.height,rightGap:innerWidth-p.right},rows:list.children.length,visible:[...list.children].filter(el=>el.getBoundingClientRect().bottom<=l.bottom+.5).length,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,background:getComputedStyle(panel).backgroundColor,knobHit:!!hit?.closest('.edge-panel-tab--right'),hitClass:hit?.closest('section')?.className,intervalBackground:getComputedStyle(hud).backgroundColor,intervalInside:h.x>=0&&h.right<=innerWidth&&h.bottom<=innerHeight};
  });
  results.push(result);
  await page.screenshot({path:new URL(`implemented-${width}x${height}.png`,output).pathname.replace(/^\/([A-Z]:)/,'$1')});
  if(result.knobHit){ const knob=await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox(); await page.mouse.click(knob.x+knob.width/2,knob.y+knob.height/2); if(await page.locator('#lb-glance-panel').isVisible()) throw Error('close failed'); }
 }
 await page.setViewportSize({width:800,height:360});
 await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=glance-ready');
 await page.locator('.lb-glance__row').last().waitFor();
 contentCases.push(await page.evaluate(()=>{
  const panel=document.querySelector('.lb-glance__panel'),list=panel.querySelector('ol');
  const seeds=[...list.children];
  for(let i=0;i<10;i++) list.append(seeds[i].cloneNode(true));
  list.scrollTop=list.scrollHeight;
  const l=list.getBoundingClientRect(),last=list.lastElementChild.getBoundingClientRect();
  return {case:'20-row-scroll-css-fixture',rows:list.children.length,scrollTop:list.scrollTop,lastVisible:last.bottom<=l.bottom+.5,panelHeight:panel.getBoundingClientRect().height};
 }));
 contentCases.push(await page.evaluate(()=>{
  const panel=document.querySelector('.lb-glance__panel'),list=panel.querySelector('ol'),before=panel.getBoundingClientRect().height;
  while(list.children.length>5) list.lastElementChild.remove();
  return {case:'5-row-content-height-css-fixture',before,after:panel.getBoundingClientRect().height,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};
 }));
 console.log(JSON.stringify(results,null,2));
 console.log(JSON.stringify(contentCases,null,2));
 await fs.writeFile(new URL('geometry.json',output),JSON.stringify(results,null,2));
 await fs.writeFile(new URL('content-cases.json',output),JSON.stringify(contentCases,null,2));
 if(results.some(r=>r.visible!==10||!r.knobHit||!r.intervalInside)) process.exitCode=1;
 if(!contentCases[0].lastVisible||contentCases[0].scrollTop<=0||contentCases[1].after>=contentCases[1].before) process.exitCode=1;
} finally {await browser.close();}
