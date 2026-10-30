const task = await taskSpace('도구A·Trail 밀도 검수 20261030');
const page=task.page('p1');
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=ready&trailPreview=1');
console.log({spaceId:task.spaceId});
console.log(await page.snapshot());
