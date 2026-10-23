const task = await taskSpace('Spinatlas 로그인 복구와 UI 검수 20261023');
const page = task.page('p1');
await page.goto('http://localhost:5000/');
console.log({ spaceId: task.spaceId, page: page.label });
console.log(await page.snapshot());
