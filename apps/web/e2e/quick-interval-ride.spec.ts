import {test,expect,type Page} from '@playwright/test';
import {stubMapboxStyle} from './mapbox-stub';
import fs from 'node:fs/promises';
import path from 'node:path';
import {resolveQuickIntervalTargetKm} from '../src/lib/ride/quickIntervalRoute';
import {getRideIntervalTotalSec,RIDE_INTERVAL_PRESETS} from '../src/lib/ride/rideInterval';

// 간편 인터벌 주행 1단계 — 실제 hook/MapView/인터벌 운동 창 통합. 경로 API(getDistanceAutoRoute)·prewarm만 대체한다.
const harness='/scripts/quick-interval/quick-interval-runtime.html';
const evidence=process.env.QUICK_INTERVAL_EVIDENCE_DIR??path.resolve('../../document/ops/20261029-quick-interval-ride/evidence');

type Req={start:[number,number];targetRoadPoint:[number,number];targetDistanceMeters:number;profile:string};

async function setup(page:Page,mode:'found'|'fail'){
  await page.setViewportSize({width:800,height:360});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route(/\/src\/services\/routeFunctionsPrewarm\.ts/,r=>r.fulfill({contentType:'text/javascript',body:'export function prewarmRouteFunctions() {}'}));
  await page.route(/\/getDistanceAutoRoute(?:\?|$)/,async route=>{
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});return;}
    const input=route.request().postDataJSON().data;
    await page.evaluate(input=>{
      // @ts-expect-error HTTP fixture capture
      (window.__distanceRequests??=[]).push(input);
    },input);
    if(mode==='fail'){
      await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({result:{status:'failed',message:'경로를 찾지 못했습니다.',routeTokenBalance:100}})});
      return;
    }
    const end=[input.start[0]+0.012,input.start[1]+0.008];
    await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({result:{status:'found',outcome:'exact',end,distance:input.targetDistanceMeters,duration:900,routeTokenBalance:99,
      geometry:{type:'LineString',coordinates:[input.start,end]},summary:'간편 인터벌 검수 경로'}})});
  });
}
const requests=(page:Page)=>page.evaluate(()=>
  // @ts-expect-error HTTP fixture capture
  (window.__distanceRequests??[]) as Req[]);
const stateOf=async(page:Page)=>JSON.parse((await page.locator('#quick-runtime-state').textContent())??'{}');
const haversineKm=(a:[number,number],b:[number,number])=>{
  const r=(d:number)=>d*Math.PI/180;const dLat=r(b[1]-a[1]);const dLng=r(b[0]-a[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a[1]))*Math.cos(r(b[1]))*Math.sin(dLng/2)**2;
  return 2*6371.0088*Math.asin(Math.sqrt(h));
};

const intervalSheet=(page:Page)=>page.getByRole('dialog',{name:'인터벌 운동 설정',exact:true});
async function openQuick(page:Page){
  await page.getByRole('button',{name:'인터벌 운동 설정',exact:true}).click();
  const quick=intervalSheet(page).getByRole('button',{name:'간편 인터벌 주행',exact:true});
  await expect(quick).toBeEnabled();
  return quick;
}

test('(a) 마지막 주행이 있으면 클릭 없이 경로 적용·인터벌 켜짐·주행 미시작',async({page})=>{
  test.setTimeout(60_000);
  await setup(page,'found');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${harness}?history=1`);
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  // 10-30 Chief: 메뉴 행은 없어지고 인터벌 운동 창 하단 「설정 적용」 왼쪽으로 옮겼다.
  const quick=await openQuick(page);
  const apply=intervalSheet(page).getByRole('button',{name:'설정 적용',exact:true});
  const qb=(await quick.boundingBox())!;const ab=(await apply.boundingBox())!;
  expect(qb.x+qb.width).toBeLessThanOrEqual(ab.x);
  expect(Math.abs((qb.y+qb.height/2)-(ab.y+ab.height/2))).toBeLessThan(1);
  await fs.mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'a-interval-sheet-800x360.png'),animations:'disabled'});
  await quick.click();
  await expect(intervalSheet(page)).toHaveCount(0);
  await expect.poll(async()=>(await stateOf(page)).applied).toBe(1);
  const state=await stateOf(page);
  expect(state.intervalOn).toBe(true);
  expect(state.starts).toBe(0);
  expect(state.targetKm).toBeGreaterThan(0.5);
  const reqs=await requests(page);
  expect(reqs).toHaveLength(1);
  expect(reqs[0]!.start).toEqual([127.02,37.5]);
  expect(reqs[0]!.targetDistanceMeters).toBeCloseTo(state.targetKm*1000,0);
  // 방향 지점은 안내 원 반지름(=목표 거리)만큼 떨어져 있다.
  expect(haversineKm(reqs[0]!.start,reqs[0]!.targetRoadPoint)).toBeCloseTo(state.targetKm,1);
  await expect(page.locator('[data-quick-interval-status]')).toHaveCount(0);
  await page.screenshot({path:path.join(evidence,'a-route-applied-800x360.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

test('(a2) 창에서 프리셋을 바꾸고 바로 누르면 그 길이로 적용·탐색한다',async({page})=>{
  test.setTimeout(60_000);
  await setup(page,'found');
  await page.goto(`${harness}?history=1`);
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  const quick=await openQuick(page);
  await intervalSheet(page).getByRole('combobox',{name:'운동 프리셋',exact:true}).selectOption('10min');
  await quick.click();
  await expect.poll(async()=>(await stateOf(page)).applied).toBe(1);
  const preset=RIDE_INTERVAL_PRESETS.find(p=>p.id==='10min')!;
  const expectedKm=resolveQuickIntervalTargetKm(getRideIntervalTotalSec(preset.config));
  const reqs=await requests(page);
  expect(reqs).toHaveLength(1);
  expect(reqs[0]!.targetDistanceMeters).toBeCloseTo(expectedKm*1000,0);
  expect((await stateOf(page)).targetKm).toBeCloseTo(expectedKm,3);
});

test('(b) 기록이 없으면 안내 후 지도 클릭 → 바로 탐색·경로 적용',async({page})=>{
  test.setTimeout(60_000);
  await setup(page,'found');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${harness}?history=0`);
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  await (await openQuick(page)).click();
  const status=page.locator('[data-quick-interval-status]');
  await expect(status).toHaveText('출발 위치를 맵에서 클릭하세요');
  await expect(page.locator('#quick-runtime-state')).toContainText('"mode":"start"');
  expect(await requests(page)).toHaveLength(0);
  await fs.mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'b-pick-start-800x360.png'),animations:'disabled'});
  expect(await page.evaluate(()=>document.elementFromPoint(500,200)?.className)).toContain('mapboxgl-canvas');
  await page.mouse.click(500,200);
  await expect.poll(async()=>(await stateOf(page)).applied).toBe(1);
  const state=await stateOf(page);
  expect(state.intervalOn).toBe(true);
  expect(state.starts).toBe(0);
  const reqs=await requests(page);
  expect(reqs).toHaveLength(1);
  // 클릭한 지점이 출발지이고 방향 클릭 단계는 없었다.
  expect(state.start).toEqual(reqs[0]!.start);
  expect(reqs[0]!.start).not.toEqual([127.02,37.5]);
  expect(haversineKm(reqs[0]!.start,reqs[0]!.targetRoadPoint)).toBeCloseTo(state.targetKm,1);
  await expect(status).toHaveCount(0);
  await page.screenshot({path:path.join(evidence,'b-route-applied-800x360.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

test('(c) 3회 연속 실패 → 실패 안내·요청 정확히 3회·방위는 서로 90° 이상',async({page})=>{
  test.setTimeout(60_000);
  await setup(page,'fail');
  await page.goto(`${harness}?history=1`);
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  await (await openQuick(page)).click();
  const status=page.locator('[data-quick-interval-status]');
  await expect(status).toHaveText(/이 근처에서 경로를 찾지 못했어요\. 출발지를 바꿔 다시 시도하세요/);
  const reqs=await requests(page);
  expect(reqs).toHaveLength(3);
  const state=await stateOf(page);
  expect(state.applied).toBe(0);
  expect(state.intervalOn).toBe(false);
  const bearings=reqs.map(r=>Math.atan2(r.targetRoadPoint[0]-r.start[0],r.targetRoadPoint[1]-r.start[1])*180/Math.PI);
  for(let i=0;i<3;i+=1)for(let j=i+1;j<3;j+=1){
    const d=Math.abs(((bearings[i]!-bearings[j]!)%360+360)%360);
    expect(Math.min(d,360-d)).toBeGreaterThanOrEqual(89);
  }
  await fs.mkdir(evidence,{recursive:true});
  await page.screenshot({path:path.join(evidence,'c-failed-800x360.png'),animations:'disabled'});
  await status.getByRole('button',{name:'안내 닫기',exact:true}).click();
  await expect(status).toHaveCount(0);
  expect(await requests(page)).toHaveLength(3);
});
