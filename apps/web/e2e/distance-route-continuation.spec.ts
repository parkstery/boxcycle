import {test,expect} from '@playwright/test';
import {stubMapboxStyle} from './mapbox-stub';
import path from 'node:path';

test('실제 hook: 여기에서 계속→방향 자동생성·수단 변경·삭제→같은 탭에서 출발 재지정',async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize({width:800,height:360});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  // hook/bridge/API adapter/잔액 알림은 실제 사용. HTTP 응답과 prewarm만 대체한다.
  await page.route(/\/src\/services\/routeFunctionsPrewarm\.ts/,r=>r.fulfill({contentType:'text/javascript',body:'export function prewarmRouteFunctions() {}'}));
  await page.route(/\/getDistanceAutoRoute(?:\?|$)/,async route=>{
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});return;}
    const input=route.request().postDataJSON().data;
    const count=await page.evaluate(input=>{
      // @ts-expect-error HTTP fixture capture
      (window.__distanceRequests??=[]).push(input);
      // @ts-expect-error HTTP fixture capture
      return window.__distanceRequests.length;
    },input);
    const hold=await page.evaluate(()=>{
      // @ts-expect-error HTTP fixture control
      const hold=window.__holdDistanceNext;window.__holdDistanceNext=false;return hold;
    });
    if(hold)await page.evaluate(()=>new Promise(resolve=>{
      // @ts-expect-error HTTP fixture control
      window.__releaseDistance=resolve;
    }));
    const end=[input.start[0]+0.012,input.start[1]+0.008];
    await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({result:{status:'found',outcome:'exact',end,distance:input.targetDistanceMeters,duration:600,routeTokenBalance:100-count,
      geometry:{type:'LineString',coordinates:[input.start,end]},summary:'검수 자동 경로'}})});
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/scripts/ui-800x360/distance-route-runtime.html');
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  const state=page.locator('#distance-runtime-state');
  const popup=page.locator('.map-view__pick');
  await page.getByRole('button',{name:'여기에서 계속',exact:true}).click();
  await expect(popup.getByRole('tab',{name:'거리·방향',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(state).toContainText('"mode":"direction"');
  await page.mouse.click(650,210);
  await expect(state).toContainText('"applied":1');
  await expect(state).not.toContainText('"end":null');
  const dock=page.locator('.map-view__pick-dock-panel');
  const initialDock=await dock.boundingBox();
  expect(initialDock).not.toBeNull();
  expect(Math.min(initialDock!.x,800-initialDock!.x-initialDock!.width)).toBeLessThanOrEqual(9);
  await expect(page.locator('.map-view__temporary-pick-marker')).toHaveCount(0);
  await expect(page.locator('.map-view__auto-route-click-debug-host')).toHaveCount(0);
  // 출발·거리 재입력/수단 클릭 없이 다른 방향을 바로 눌러도 다시 생성한다.
  for (const [index,point] of [[300,250],[450,80],[350,300]].entries()) {
    expect(await page.evaluate(point=>document.elementFromPoint(point[0]!,point[1]!)?.className,point)).toContain('mapboxgl-canvas');
    await page.mouse.click(point[0]!,point[1]!);
    await expect(state).toContainText(`"applied":${index+2}`);
    const currentDock=await dock.boundingBox();
    expect(Math.abs(currentDock!.x-initialDock!.x)).toBeLessThanOrEqual(1);
  }
  await page.mouse.move(450,80);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
  await expect(state).toContainText('"applied":5');
  await popup.getByRole('button',{name:'자동차 경로',exact:true}).click();
  await expect(state).toContainText('"applied":6');
  await expect(state).toContainText('"profile":"driving"');
  await popup.getByRole('button',{name:'경로 전체 삭제',exact:true}).click();
  await expect(state).toContainText('"start":null');
  await expect(popup.getByRole('tab',{name:'거리·방향',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(popup.getByRole('button',{name:'출발 지점으로 설정',exact:true})).toBeHidden();
  await expect(popup.getByText('출발 위치를 지도에서 위치 길게 누르세요.',{exact:true})).toBeVisible();
  await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
  await expect(popup.getByRole('button',{name:'출발 지점으로 설정',exact:true})).toBeVisible();
  await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
  await page.mouse.click(300,80);
  await expect(state).toContainText('"start":null');
  await page.screenshot({path:path.resolve('../..','.out','step24-distance-start.png')});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:80,id:1}]});
  await page.waitForTimeout(650);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.map-view__temporary-pick-marker')).toHaveCount(0);
  await expect(popup.getByRole('tab',{name:'거리·방향',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(state).not.toContainText('"start":null');
  await expect(page.locator('.map-view__temporary-pick-marker')).toHaveCount(0);
  await popup.getByRole('button',{name:'목표 거리 5km',exact:true}).click();
  await expect(state).toContainText('"mode":"direction"');
  expect(await page.evaluate(()=>document.elementFromPoint(400,300)?.className)).toContain('mapboxgl-canvas');
  await page.mouse.click(400,300);
  await expect(state).toContainText('"applied":7');
  const requests=await page.evaluate(()=>{
    // @ts-expect-error API fixture capture
    return window.__distanceRequests;
  });
  expect(requests).toHaveLength(7);
  expect(requests.map((r:{profile:string})=>r.profile)).toEqual(['cycling','cycling','cycling','cycling','cycling','driving','driving']);
  expect(requests[6].targetDistanceMeters).toBe(5000);
  expect(requests[6].start).not.toEqual(requests[0].start);
  expect(new Set(requests.slice(0,4).map((r:{targetRoadPoint:number[]})=>JSON.stringify(r.targetRoadPoint))).size).toBe(4);
  await page.screenshot({path:path.resolve('../..','.out','step24-distance-generated.png')});
  // 탐색 도중 삭제해도 즉시 새 출발 선택 가능, 늦은 옛 응답은 결과를 되살리지 않는다.
  await page.evaluate(()=>{
    // @ts-expect-error API fixture control
    window.__holdDistanceNext=true;
  });
  await popup.getByRole('button',{name:'목표 거리 3km',exact:true}).click();
  expect(await page.evaluate(()=>document.elementFromPoint(400,300)?.className)).toContain('mapboxgl-canvas');
  await page.mouse.click(400,300);
  await expect(state).toContainText('"step":"searching"');
  await popup.getByRole('button',{name:'경로 전체 삭제',exact:true}).click();
  await expect(state).toContainText('"start":null');
  await page.mouse.move(300,80);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
  await expect(page.locator('.map-view__temporary-pick-marker')).toHaveCount(0);
  await expect(state).not.toContainText('"start":null');
  await popup.getByRole('button',{name:'목표 거리 5km',exact:true}).click();
  expect(await page.evaluate(()=>document.elementFromPoint(400,300)?.className)).toContain('mapboxgl-canvas');
  await page.mouse.click(400,300);
  await expect(state).toContainText('"applied":8');
  await page.evaluate(()=>{
    // @ts-expect-error API fixture control
    window.__releaseDistance();
  });
  // 옛 응답 완료 microtask까지 소비하고도 적용 횟수가 늘지 않는다.
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  await expect(state).toContainText('"applied":8');
  expect(errors).toEqual([]);
});
