const task = await taskSpace('Spinatlas compact controls 20261028');
const page = task.page('p1');
await page.goto('file:///C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/preview-qa.html');
console.log({spaceId:task.spaceId});
console.log(await page.snapshot());
