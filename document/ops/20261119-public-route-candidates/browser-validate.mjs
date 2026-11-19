import {getTask} from './browser-session.mjs';
const task=await getTask(),page=(await task.pages())[0]??await task.adopt((await task.tabs())[0].page),fs=await import('node:fs/promises');
const crypto=await import('node:crypto');
const dir='C:/20.HDev/boxcycle/document/ops/20261119-public-route-candidates/evidence/';
for(const id of ['yeouido','richmond','ara','amstel','sunmoon','annecy']){
 await page.goto('http://127.0.0.1:5000/scripts/public-route-review/preview.html?id='+id);
 await page.waitForFunction(()=>!!window.routeReview,undefined,{timeout:25000});
 const samples=[];
 for(const f of [0,.25,.5,.75,1])for(const slot of [2,3]){
  const s=await page.evaluate(async({f,slot})=>await window.routeReview.at(f,slot),{f,slot});
  samples.push({...s,fraction:f});
  console.log(id,f,slot,s.health,s.tilesLoaded,s.inFrame);
  if(f===.5){
   const png=await page.evaluate(()=>new Promise(resolve=>{const m=window.routeReview.map;m.once('render',()=>resolve(m.getCanvas().toDataURL('image/png')));m.triggerRepaint();}));
   await fs.writeFile(dir+id+'-qc'+slot+'.png',Buffer.from(png.split(',')[1],'base64'));
  }
 }
 await page.evaluate(()=>window.routeReview.overview());await page.evaluate(()=>window.routeReview.settle());
 const png=await page.evaluate(()=>new Promise(resolve=>{const m=window.routeReview.map;m.once('render',()=>resolve(m.getCanvas().toDataURL('image/png')));m.triggerRepaint();}));
 await fs.writeFile(dir+id+'-overview.png',Buffer.from(png.split(',')[1],'base64'));
 const geometry=await page.evaluate(()=>window.routeReview.geometry);
 const out={id,at:new Date().toISOString(),geometryHash:crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),method:'local production camera/terrain components + real Mapbox imagery/DEM; marker replaces rider; no Firebase',samples};
 await fs.writeFile(dir+id+'-3d.json',JSON.stringify(out,null,2));
 console.log(id,{samples:samples.length,ready:samples.filter(s=>s.health==='ready').length,inFrame:samples.filter(s=>s.inFrame).length,loaded:samples.filter(s=>s.tilesLoaded).length,errors:[...new Set(samples.flatMap(s=>s.errors))]});
}
