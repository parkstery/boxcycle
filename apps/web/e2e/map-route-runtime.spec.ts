import { test, expect } from '@playwright/test';
import { stubMapboxStyle } from './mapbox-stub';

test.use({viewport:{width:800,height:360},hasTouch:true});
test('실제 MapView: 짧은 탭 무선택·길게누르기 출발/도착·메뉴와 pan 차단', async ({page})=>{
  test.setTimeout(60_000);
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  const canvas=page.locator('.mapboxgl-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.map-view')).toBeVisible();
  const surface=page.locator('.map-view__pick');
  await page.touchscreen.tap(400,170);
  await expect(surface).toHaveCount(0);
  const hold=async(x:number,y:number)=>{await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();};
  await hold(400,170);
  await expect(surface).toHaveCount(1);
  await surface.getByRole('button',{name:'출발 지점으로 설정',exact:true}).click();
  await expect(page.locator('#runtime-state')).not.toContainText('"start":null');
  // 출발 확정 후 같은 설정창이 남아 있어도 새 위치를 길게 눌러 도착을 지정할 수 있다.
  await hold(600,180);
  await expect(surface).toHaveCount(1);
  await surface.getByRole('button',{name:'도착 지점으로 설정',exact:true}).click();
  await expect(page.locator('#runtime-state')).not.toContainText('"end":null');
  const state=await page.locator('#runtime-state').textContent();
  const close=page.locator('.map-view__pick-dock-close,.mapboxgl-popup-close-button');
  if(await close.count())await close.first().click();
  await page.getByRole('button',{name:'검수 메뉴',exact:true}).click();
  await hold(400,170);
  await expect(surface).toHaveCount(0);
  await page.getByRole('button',{name:'메뉴 닫기',exact:true}).click();
  await page.mouse.move(400,170);await page.mouse.down();await page.mouse.move(520,190,{steps:12});await page.mouse.up();
  await expect(surface).toHaveCount(0);
  await expect(page.locator('#runtime-state')).toHaveText(state!);
});

test('실제 MapView: 터치 길게누르기·핀치 취소·열린 경로창에서 명시적 방향 탭', async ({page})=>{
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  const surface=page.locator('.map-view__pick');
  const cdp=await page.context().newCDPSession(page);
  const touches=async(type:string,points:Array<{x:number;y:number;id:number}>)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await touches('touchStart',[{x:400,y:170,id:1}]);
  await page.waitForTimeout(650);
  await touches('touchEnd',[]);
  await expect(surface).toHaveCount(1);
  await page.getByRole('button',{name:'방향 선택 준비',exact:true}).click();
  await page.touchscreen.tap(650,210);
  await expect(page.locator('#runtime-state')).toContainText('"picks":1');
  const close=page.locator('.map-view__pick-dock-close,.mapboxgl-popup-close-button');
  if(await close.count())await close.first().click();
  await touches('touchStart',[{x:400,y:170,id:1}]);
  await touches('touchStart',[{x:400,y:170,id:1},{x:470,y:170,id:2}]);
  await touches('touchMove',[{x:360,y:170,id:1},{x:510,y:170,id:2}]);
  await page.waitForTimeout(650);
  await touches('touchEnd',[]);
  await expect(surface).toHaveCount(0);
  await expect(page.locator('#runtime-state')).toContainText('"picks":1');
});

test('방향 긴 터치 한 번: native contextmenu와 pointercancel이 겹쳐도 요청은 정확히 한 번', async ({page})=>{
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  const canvas=page.locator('.mapboxgl-canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button',{name:'방향 선택 준비',exact:true}).click();
  const cdp=await page.context().newCDPSession(page);
  for(const [index,point] of [[650,210],[450,80]].entries()){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point[0]!,y:point[1]!,id:1}]});
    await page.waitForTimeout(400);
    // 모바일 브라우저가 자체 longpress를 인식해 앱 timer보다 먼저 메뉴/cancel을 보낼 수 있다.
    await canvas.dispatchEvent('contextmenu',{pointerType:'touch',button:0,clientX:point[0]!,clientY:point[1]!});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await expect(page.locator('#runtime-state')).toContainText(`"picks":${index+1}`);
    await page.waitForTimeout(600);
    await expect(page.locator('#runtime-state')).toContainText(`"picks":${index+1}`);
  }
});
