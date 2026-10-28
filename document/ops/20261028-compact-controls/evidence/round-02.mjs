const task=await taskSpace(8), page=task.page('p1');
const results=[];
for(const width of [800,736,699,667,320]){
 await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:false});
 for(const view of ['rank','settings','camera','ride']){
  await page.click(`loc=css:[data-view="${view}"]`);
  results.push(await page.evaluate((view)=>{
   const phone=document.querySelector('.phone'),panel=document.querySelector('.popover.'+view),p=phone.getBoundingClientRect();
   const r=panel?.getBoundingClientRect();
   const escaping=panel?[...panel.querySelectorAll('button,input,label,small,strong')].filter(e=>{const c=e.getBoundingClientRect();return c.width&&c.height&&(c.left<r.left-1||c.right>r.right+1||c.top<r.top-1||c.bottom>r.bottom+1)}).map(e=>e.textContent.trim()||e.getAttribute('aria-label')):[];
   return {width:innerWidth,view,phone:{width:p.width,height:p.height},panel:r?{width:r.width,height:r.height}:null,inside:!r||(r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom),scroll:panel?panel.scrollHeight>panel.clientHeight:false,escaping};
  },view));
 }
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:736,height:450,deviceScaleFactor:1,mobile:false});
await page.click('loc=css:[data-view="settings"]');
console.log({results});
console.log({screenshot:await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/settings-736.png'})});
const fs=await import('node:fs/promises');
await fs.writeFile('C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/layout-checks.json',JSON.stringify(results,null,2));
console.log(await page.snapshot());
