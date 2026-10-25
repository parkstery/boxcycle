import {test,expect} from '@playwright/test';
import {stubMapboxStyle} from './mapbox-stub';

test('출발·도착 확정 후 미선택 수단은 기존 순차 강조를 유지한다',async({page})=>{
  await page.goto('/scripts/ui-800x360/preview.html?state=idle');
  await page.evaluate(async()=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/src/components/map/MapView.css';document.head.append(css);
    const moduleUrl='/src/components/map/mapPopupElements.ts';
    const {buildPickPopup}=await import(moduleUrl);
    const popup=buildPickPopup({lngLat:[127,37],initialStart:[127,37],initialHasStart:true,initialHasEnd:true,
      routeProfile:'cycling',getWaypointCount:()=>0,accessToken:'',signal:new AbortController().signal,
      onSelectPoint:()=>{},onRouteProfile:()=>{},closePopup:()=>{}});
    const host=document.createElement('div');host.id='manual-profile-fixture';host.className='map-view';
    Object.assign(host.style,{position:'absolute',top:'60px',right:'20px',zIndex:'30'});
    host.append(popup);document.body.append(host);
  });
  const popup=page.locator('#manual-profile-fixture .map-view__pick');
  await expect(popup).toHaveClass(/map-view__pick--awaiting-profile/);
  const profiles=popup.locator('.map-view__pick-btn--profile');
  await expect(profiles).toHaveCount(3);
  await expect.poll(()=>profiles.evaluateAll(buttons=>buttons.map(b=>getComputedStyle(b).animationName)))
    .toEqual(['map-view-route-profile-attention-1','map-view-route-profile-attention-2','map-view-route-profile-attention-3']);
  await profiles.first().click();
  await expect(popup).not.toHaveClass(/map-view__pick--awaiting-profile/);
  await expect(profiles.first()).toHaveAttribute('aria-pressed','true');
});

test('거리 확정→원 펄스→방향 클릭 자동 탐색→적용 수단 표시·수단 재탐색',async({page})=>{
  await page.setViewportSize({width:800,height:360});
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  await page.mouse.move(400,170);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
  const popup=page.locator('.map-view__pick');
  await popup.getByRole('button',{name:'출발 지점으로 설정',exact:true}).click();
  await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
  const profiles=popup.locator('.map-view__pick-actions--profile');
  // 10-25 Chief: 거리·방향 탭에도 수단 3개가 늘 보인다(출발 있으면 사용 가능). 방향 전에는 아무것도 눌리지 않은 상태.
  const noneChosen=()=>expect(profiles.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(profiles).toBeVisible();
  await expect(profiles.locator('button:disabled')).toHaveCount(0);
  await noneChosen();
  await page.mouse.click(650,210);
  await noneChosen();
  await expect(page.locator('#runtime-state')).toContainText('"picks":0');
  await popup.getByRole('button',{name:'목표 거리 3km',exact:true}).click();
  await noneChosen();
  const width=()=>page.evaluate(()=>{
    // @ts-expect-error MapView 검수 참조
    return window.__RTW_MAP__.getPaintProperty('distance-target-circle-arrows-line','line-width');
  });
  await expect.poll(width).toBeGreaterThan(3.2);
  await page.mouse.click(650,210);
  await expect(profiles).toBeVisible();
  // 10-22 지시24·29/커밋 0ec14853: 방향 클릭으로 탐색이 끝나면 적용 수단을 표시한다.
  await expect(popup).not.toHaveClass(/map-view__pick--awaiting-profile/);
  await expect(page.locator('#runtime-state')).toContainText('"picks":1');
  await expect(page.locator('#runtime-state')).toContainText('"requestedProfile":"cycling"');
  await expect(profiles.getByRole('button',{name:'자전거 경로',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect.poll(width).toBe(3);
  const animations=await profiles.locator('button').evaluateAll(buttons=>buttons.map(b=>getComputedStyle(b).animationName));
  expect(animations).toEqual(['none','none','none']);
  await popup.getByRole('button',{name:'자동차 경로',exact:true}).click();
  await expect(page.locator('#runtime-state')).toContainText('"picks":2');
  await expect(page.locator('#runtime-state')).toContainText('"requestedProfile":"driving"');
  await expect(profiles.getByRole('button',{name:'자동차 경로',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(popup).not.toHaveClass(/map-view__pick--awaiting-profile/);
  const number=popup.getByRole('textbox',{name:'목표거리 km',exact:true});
  await number.fill('5');
  await noneChosen();
  await number.press('Enter');
  await expect.poll(width).toBeGreaterThan(3.2);
  await page.mouse.click(650,210);
  await expect(profiles).toBeVisible();
  await popup.getByRole('button',{name:'보행 경로',exact:true}).click();
  await expect(page.locator('#runtime-state')).toContainText('"picks":4');
  await expect(page.locator('#runtime-state')).toContainText('"requestedProfile":"walking"');
  await number.fill('invalid');await number.press('Enter');
  await noneChosen();
  await expect(page.locator('#runtime-state')).toContainText('"picks":4');
  await number.fill('10');await number.press('Tab');
  await expect.poll(width).toBeGreaterThan(3.2);
  await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
  // 출발·도착 탭은 도착이 없으면 수단을 숨기지 않고 끈다.
  await expect(profiles).toBeVisible();
  await expect(profiles.locator('button:disabled')).toHaveCount(3);
  await page.emulateMedia({reducedMotion:'reduce'});
  await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
  await popup.getByRole('button',{name:'목표 거리 20km',exact:true}).click();
  await expect.poll(width).toBe(3);
  await page.mouse.click(650,210);
  await expect(profiles).toBeVisible();
  expect(await profiles.locator('button').evaluateAll(buttons=>buttons.map(b=>getComputedStyle(b).animationName))).toEqual(['none','none','none']);
  await page.locator('.map-view__pick-dock-close,.mapboxgl-popup-close-button').first().click();
  await expect(popup).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('10-25 Chief — 거리·방향 방향 전 수단 선택은 다음 방향 탐색에 쓰이고, 결과 뒤 선택은 바로 재탐색한다',async({page})=>{
  await page.setViewportSize({width:800,height:360});
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  await page.mouse.move(400,170);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
  const popup=page.locator('.map-view__pick');
  await popup.getByRole('button',{name:'출발 지점으로 설정',exact:true}).click();
  await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
  await popup.getByRole('button',{name:'목표 거리 3km',exact:true}).click();
  const walking=popup.getByRole('button',{name:'보행 경로',exact:true});
  await walking.click();
  await expect(walking).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#runtime-state')).toContainText('"picks":0');
  await page.mouse.click(650,210);
  await expect(page.locator('#runtime-state')).toContainText('"picks":1');
  await expect(page.locator('#runtime-state')).toContainText('"requestedProfile":"walking"');
  await expect(walking).toHaveAttribute('aria-pressed','true');
  await popup.getByRole('button',{name:'자동차 경로',exact:true}).click();
  await expect(page.locator('#runtime-state')).toContainText('"picks":2');
  await expect(page.locator('#runtime-state')).toContainText('"requestedProfile":"driving"');
  // 두 탭의 맨 아래 줄은 같은 구조·같은 자리.
  const bottomRow=()=>popup.evaluate(el=>{
    const box=el.getBoundingClientRect();
    const row=el.querySelector('.map-view__pick-profile-bottom-row')!;
    return [...row.querySelectorAll('button')].filter(b=>b.getClientRects().length>0).map(b=>{
      const r=b.getBoundingClientRect();
      return {label:b.getAttribute('aria-label'),x:Math.round(r.left-box.left),w:Math.round(r.width),h:Math.round(r.height)};
    });
  });
  const distanceRow=await bottomRow();
  expect(distanceRow.map(b=>b.label)).toEqual(['자동차 경로','자전거 경로','보행 경로','주행 시작','경로 전체 삭제']);
  await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
  const locationRow=await bottomRow();
  expect(locationRow.map(b=>b.label)).toEqual(distanceRow.map(b=>b.label));
  for(const [i,b] of locationRow.entries()){
    expect(Math.abs(b.x-distanceRow[i]!.x)).toBeLessThanOrEqual(1);
    expect(b.w).toBe(distanceRow[i]!.w);expect(b.h).toBe(distanceRow[i]!.h);
  }
  await page.screenshot({path:`${process.env.BATCH5_EVIDENCE_DIR ?? '../../.out'}/instruction74-bottom-row-location.png`});
});
