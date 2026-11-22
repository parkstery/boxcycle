const spaces=await listTaskSpaces();const entry=spaces.find(s=>s.name==='Spinatlas HUD title alignment 20261119');console.log(spaces.map(s=>({id:s.id,name:s.name,ownership:s.ownership})));
const task=await taskSpace(entry.id);const page=task.page('p1');await page.reload();
await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(f=>f.dataset.ready==='true'));
console.log(await page.evaluate(()=>Object.fromEntries(['before','after'].map(id=>[id,[...document.getElementById(id).contentDocument.querySelectorAll('.hud-metrics__label')].map(el=>({label:el.textContent,top:el.getBoundingClientRect().top}))]))));
console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261119-hud-title-alignment/preview.png'}));
