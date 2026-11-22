const task=await taskSpace('Spinatlas HUD title alignment 20261119');const page=task.page('p1');
await page.goto('http://127.0.0.1:5000/scripts/hud-title-alignment-preview.html');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:760,height:560,deviceScaleFactor:1,mobile:false});
await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(f=>f.dataset.ready==='true'));
console.log({spaceId:task.spaceId});
console.log(await page.evaluate(()=>Object.fromEntries(['before','after'].map(id=>[id,[...document.getElementById(id).contentDocument.querySelectorAll('.hud-metrics__label')].map(el=>({label:el.textContent,top:el.getBoundingClientRect().top}))]))));
console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261119-hud-title-alignment/preview.png'}));
