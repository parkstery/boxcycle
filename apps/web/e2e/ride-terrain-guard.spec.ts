import { test, expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';

declare global {
  interface Window {
    terrainDemo: { snapshot: () => { raw: number; shown: number; flat: boolean; buildings: boolean; terrain: unknown; requested: boolean; pitch: number; bearing: number; zoom: number; altitude: number; center: { lng: number; lat: number } }; fault: (enabled: boolean) => void; reload: () => void; off: () => void; on: () => void; end: () => void; dispose: () => void };
  }
}
// Constant 100m Terrain-RGB PNG, no token or external network needed.
function png() {
  const crc=(b:Buffer)=>{let c=0xffffffff;for(const v of b){c^=v;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  const chunk=(type:string,data:Buffer)=>{const name=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([len,name,data,sum]);};
  const head=Buffer.alloc(13);head.writeUInt32BE(512);head.writeUInt32BE(512,4);head[8]=8;head[9]=6;
  const rows=Buffer.alloc((512*4+1)*512);for(let y=0;y<512;y++)for(let x=0;x<512;x++){const p=y*(512*4+1)+1+x*4;rows[p]=1;rows[p+1]=138;rows[p+2]=136;rows[p+3]=255;}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
test('real Mapbox keeps raw DEM at zero exaggeration, recovers and ends in 2D',async({page})=>{
  test.setTimeout(45000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.mapbox.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route('https://events.mapbox.com/**',r=>r.fulfill({status:204}));
  await page.route('**/fixture-dem/**',r=>r.fulfill({contentType:'image/png',body:png()}));
  await page.route('**/fixture-vector/**',r=>r.fulfill({status:204}));
  await page.goto('/scripts/terrain-guard/preview.html');
  await page.waitForFunction(()=>!!window.terrainDemo);
  const snapshot=()=>page.evaluate(()=>window.terrainDemo.snapshot());
  await expect.poll(async()=>(await snapshot()).raw).toBe(100);
  await expect.poll(async()=>(await snapshot()).shown).toBe(0);
  await expect.poll(async()=>(await snapshot()).flat,{timeout:10000}).toBe(false);
  expect((await snapshot()).shown).toBe(130);
  await page.evaluate(()=>window.terrainDemo.fault(true));
  await expect.poll(async()=>(await snapshot()).flat,{timeout:6000}).toBe(true);
  expect((await snapshot()).raw).toBe(100);
  expect((await snapshot()).shown).toBe(0);
  expect((await snapshot()).buildings).toBe(false);
  await page.evaluate(()=>window.terrainDemo.reload());
  expect((await snapshot()).shown).toBe(0);
  await page.evaluate(()=>window.terrainDemo.fault(false));
  await expect.poll(async()=>(await snapshot()).flat,{timeout:10000}).toBe(false);
  expect((await snapshot()).shown).toBe(130);
  await page.evaluate(()=>window.terrainDemo.off());
  await expect.poll(async()=>(await snapshot()).terrain).toBe(null);
  await page.waitForTimeout(4500);
  expect((await snapshot()).requested).toBe(false);
  expect((await snapshot()).terrain).toBe(null);
  await page.evaluate(()=>window.terrainDemo.on());
  await expect.poll(async()=>(await snapshot()).flat,{timeout:10000}).toBe(false);
  const before=await snapshot();
  await page.evaluate(()=>window.terrainDemo.end());
  const after=await snapshot();
  expect(after.terrain).toBe(null);expect(after.buildings).toBe(false);
  expect(after.pitch).toBe(0);expect(after.bearing).toBe(0);
  expect(after.zoom).toBeLessThan(before.zoom);
  expect(after.altitude).toBeCloseTo(1000,1);
  expect(after.center.lng).toBeCloseTo(before.center.lng,6);
  expect(after.center.lat).toBeCloseTo(before.center.lat,6);
  for (const size of [{width:699,height:273},{width:1920,height:930}]) {
    await page.setViewportSize(size);
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await page.evaluate(()=>window.terrainDemo.end());
    expect((await snapshot()).altitude).toBeCloseTo(1000,1);
  }
  expect(errors).toEqual([]);
  await page.evaluate(()=>window.terrainDemo.dispose());
});


test('automatic 2D label retains user intent and can be switched off',async({page})=>{
  await page.setViewportSize({width:699,height:273});
  await page.goto('/scripts/ui-800x360/preview.html?state=riding&terrainFallback&menuFixture');
  await page.getByRole('button',{name:/카메라 메뉴/}).click();
  await page.getByRole('menuitemcheckbox',{name:'3D 뷰',exact:true}).click();
  const auto=page.getByRole('menuitemcheckbox',{name:'3D 뷰 · 자동 2D로 주행 중',exact:true});
  await expect(auto).toHaveAttribute('aria-checked','true');
  await expect(auto).toContainText('자동 2D');
  await auto.click();
  await expect(page.getByRole('menuitemcheckbox',{name:'3D 뷰',exact:true})).toHaveAttribute('aria-checked','false');
});
