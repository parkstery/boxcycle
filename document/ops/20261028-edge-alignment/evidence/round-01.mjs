const task = await taskSpace('Spinatlas edge alignment 20261028');
console.log({ spaceId: task.spaceId });
const page = task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 699, height: 273, deviceScaleFactor: 1, mobile: false });
await page.goto('http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding');
console.log(await page.snapshot());
