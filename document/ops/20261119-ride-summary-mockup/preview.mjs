const task = await taskSpace('Spinatlas ride summary mockup 20261119');
const page = task.page('p1');
await page.goto('file:///C:/20.HDev/boxcycle/document/ops/20261119-ride-summary-mockup/mockup.html');
console.log({spaceId:task.spaceId});
console.log(await page.snapshot());
console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261119-ride-summary-mockup/preview.png'}));
