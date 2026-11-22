const task=await taskSpace(10);const page=task.page('p1');
await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(f=>f.dataset.ready==='true'));
console.log(await page.evaluate(()=>[...document.querySelector('#after').contentDocument.querySelectorAll('.hud-metrics__label')].map(el=>({label:el.textContent,top:el.getBoundingClientRect().top}))));
