const task = await taskSpace('route-popup-compact-20261029');
const page = task.page('p1');
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=idle');
console.log({spaceId:task.spaceId});
console.log(await page.snapshot());
