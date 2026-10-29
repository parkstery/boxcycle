const task = await taskSpace('체험 속도 계기판 20261030');
const page = task.page('p1');
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=sensor');
console.log({spaceId: task.spaceId});
console.log(await page.snapshot());
