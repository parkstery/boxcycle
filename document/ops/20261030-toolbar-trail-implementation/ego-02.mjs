const task=await taskSpace(18);
const page=task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:699,height:273,deviceScaleFactor:1,mobile:false});
await page.click('loc=role:button[name="메뉴 열기"]');
await page.waitForSelector('.trail-hub__list',{state:'visible'});
console.log(await page.evaluate(()=>{
 const list=document.querySelector('.trail-hub__list');const b=list.getBoundingClientRect();
 return {height:b.height,visible:[...list.children].filter(e=>{const r=e.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom;}).length,rows:list.children.length};
}));
await task.finish({keep:[]});
