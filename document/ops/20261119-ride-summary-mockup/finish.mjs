const task=await taskSpace(8);const page=task.page('p1');
console.log(await page.evaluate(()=>({title:document.title,nickname:document.querySelector('.identity').textContent,summaryVisible:!document.querySelector('.stage').classList.contains('closed')})));
