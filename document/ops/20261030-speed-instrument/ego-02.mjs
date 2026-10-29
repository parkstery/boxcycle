const task = await taskSpace(17);
const page = task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride', {width:800,height:360,deviceScaleFactor:1,mobile:false});
await page.click('loc=role:button[name="센서 없음"]');
await page.fill('input[aria-label="속도 km/h"]', '25');
await page.press('input[aria-label="속도 km/h"]', 'Enter');
console.log(await page.evaluate(() => {
  const p=document.querySelector('.cadence-sheet__panel');
  return {rect:p.getBoundingClientRect().toJSON(), overflow:p.scrollWidth-p.clientWidth, text:p.innerText};
}));
console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261030-speed-instrument/speed-800x360.png'}));
