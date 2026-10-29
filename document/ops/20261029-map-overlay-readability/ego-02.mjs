const task = await taskSpace(14);
const page = task.page('p1');
const results=[];
for (const [width,height] of [[1040,475],[800,360],[736,300],[699,273],[667,300]]) {
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=glance-riding&interval&noSensor');
 await page.waitForSelector('.lb-glance__row');
 results.push(await page.evaluate(()=>{
  const panel=document.querySelector('.lb-glance__panel'), list=panel.querySelector('ol');
  const p=panel.getBoundingClientRect(), l=list.getBoundingClientRect(), knob=document.querySelector('.edge-panel-tab--right .edge-panel-tab__knob').getBoundingClientRect();
  const hit=document.elementFromPoint(knob.x+knob.width/2,knob.y+knob.height/2);
  return {width:innerWidth,height:innerHeight,panel:{x:p.x,y:p.y,width:p.width,height:p.height,rightGap:innerWidth-p.right},rows:list.children.length,visible:[...list.children].filter(el=>el.getBoundingClientRect().bottom<=l.bottom+.5).length,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,background:getComputedStyle(panel).backgroundColor,knobHit:!!hit?.closest('.edge-panel-tab--right'),intervalBackground:getComputedStyle(document.querySelector('.ride-interval-hud')).backgroundColor};
 }));
 if(width===800) console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261029-map-overlay-readability/implemented-800x360.png'}));
}
console.log(JSON.stringify(results));
