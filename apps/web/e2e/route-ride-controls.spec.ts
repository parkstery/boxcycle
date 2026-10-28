import { test, expect } from './open-meteo-stub';
import path from 'node:path';
import fs from 'node:fs';

const preview='/scripts/ui-800x360/preview.html';
const evidence=process.env.UI_REVALIDATION_EVIDENCE_DIR ?? path.resolve('../..','.out','ui-route-ride-20261021');
test.use({viewport:{width:800,height:360},hasTouch:true});
test('RouteDock 주소/주행바: 세 크기·다섯 상태·지도정보와 겹침 없음',async({page})=>{
  fs.mkdirSync(evidence,{recursive:true});
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const state of ['idle','setup','ready','riding','paused']){
      await page.goto(`${preview}?state=${state}`);
      const bar=page.locator('.ride-control-bar');
      if(state==='idle'||state==='setup')await expect(bar).toHaveCount(0);
      else await expect(bar).toBeVisible();
      if(state==='idle'||state==='riding'||state==='paused'){
        await expect(page.getByRole('button',{name:'경로 패널 펼치기'})).toBeVisible();
        await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(0);
        await page.getByRole('button',{name:'경로 패널 펼치기'}).click();
      }
      await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
      await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toBeVisible();
      if(state==='setup'||state==='idle')await expect(page.locator('.route-dock__head').getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
      const geom=await page.evaluate((state)=>{
        const sensor=document.querySelector('.route-dock__head .hud-cadence') ?? document.querySelector('.route-dock__led-toggle');
        const bar=sensor!.getBoundingClientRect();
        const others=[...document.querySelectorAll(state==='setup'||state==='idle'?'.hud-clock,.map-hud__tr':'.hud-clock,.map-hud__tr')].map(e=>e.getBoundingClientRect());
        const collide=others.filter(b=>b.width>0&&b.height>0&&bar.left<b.right&&bar.right>b.left&&bar.top<b.bottom&&bar.bottom>b.top);
        return {bar:bar.toJSON(),collide:collide.map(b=>b.toJSON())};
      },state);
      expect(geom.bar.height).toBeLessThanOrEqual(44);
      if(state!=='idle'&&state!=='setup')await expect(bar).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
      const media=bar.locator('.ride-media-button');
      for(const button of await media.all()){
        expect((await button.textContent())?.trim()).toBe('');
        await expect(button).toHaveCSS('border-radius','50%');
        // 준비 상태는 주행 버튼이 5회 펄스(1.1배, 지시90·91)한다 — 변형 전 레이아웃 크기를 잰다.
        const box=await button.evaluate(el=>({width:(el as HTMLElement).offsetWidth,height:(el as HTMLElement).offsetHeight}));
        expect(box.width).toBe(32);expect(box.height).toBe(32);
      }
      expect(geom.bar.right).toBeLessThanOrEqual(size.width);
      expect(geom.collide).toEqual([]);
      if(size.width===800)await page.screenshot({path:path.join(evidence,`bar-${state}-800.png`),animations:'disabled'});
    }
  }
});
test('주소 접기 독립·이어달리기·결과 닫기 후 같은 경로 재주행',async({page})=>{
  await page.goto(`${preview}?state=ready&resume&waypoints=3`);
  await expect(page.locator('.route-dock__stops > li')).toHaveCount(5);
  await page.getByRole('button',{name:'경로 패널 접기'}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'이어 달리기 선택',exact:true}).click();
  await page.getByLabel('처음부터',{exact:true}).check();
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await page.getByRole('button',{name:'재개',exact:true}).click();
  await page.getByRole('button',{name:'주행 종료',exact:true}).click();
  await expect(page.locator('.ride-control-bar')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const expandAfterResult = page.getByRole('button',{name:'경로 패널 펼치기'});
  if (await expandAfterResult.isVisible()) await expandAfterResult.click();
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await expect(page.getByRole('button',{name:'일시정지',exact:true})).toBeVisible();
});
test('준비되지 않은 입력으로 시작할 수 없고 경로 없이 센서 접근 가능',async({page})=>{
  await page.goto(`${preview}?state=ready&blocked`);
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeDisabled();
  await page.goto(`${preview}?state=idle`);
  await page.getByRole('button',{name:'경로 패널 펼치기'}).click();
  await page.getByRole('button',{name:/^케이던스 센서:/}).click();
  await expect(page.getByRole('dialog',{name:'케이던스 센서',exact:true})).toBeVisible();
});

for (const paused of [false, true]) {
  test(`종료 후 남은 경로를 반복 주행: ${paused ? '일시정지' : '주행'} 중 종료`, async ({page}) => {
    await page.goto(`${preview}?state=ready&short`);
    const start = page.getByRole('button', {name:'주행 시작', exact:true});
    for (let attempt = 0; attempt < 3; attempt++) {
      await start.click();
      await expect(page.getByRole('button', {name:'일시정지', exact:true})).toBeVisible();
      if (paused) await page.getByRole('button', {name:'일시정지', exact:true}).click();
      await page.getByRole('button', {name:'주행 종료', exact:true}).click();
      await expect(start).toBeEnabled();
      await expect(page.locator('.route-dock__stops > li')).toHaveCount(2);
      await page.getByRole('button', {name:'경로 패널 접기'}).click();
      await expect(start).toBeVisible();
      await page.getByRole('button', {name:'경로 패널 펼치기'}).click();
      await expect(start).toBeVisible();
    }
  });
}

for(const initial of ['empty','start-only','end-only','ready','waypoints'] as const){
  test(`경로 생성 실제 DOM: ${initial} 모드배타·값보존·수단즉시생성`,async({page})=>{
    const hasStart=initial!=='empty'&&initial!=='end-only';
    const routeReady=initial==='ready'||initial==='waypoints';
    await page.goto(`${preview}?state=ready`);
    await page.evaluate(async(initial)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='/src/components/map/MapView.css';document.head.append(css);
      const url='/src/components/map/mapPopupElements.ts';
      const {buildPickPopup}=await import(url);
      const dragUrl='/src/lib/map/mapPickRouteDock.ts';
      const {mountRoutePickDockDrag}=await import(dragUrl);
      const ac=new AbortController();
      const host=document.createElement('div');host.id='popup-audit';host.className='map-view';
      Object.assign(host.style,{position:'absolute',right:'4px',top:'44px',width:'260px',zIndex:'10',border:'0',background:'transparent',minHeight:'0'});
      let count=initial==='waypoints'?3:0;
      let generated=0; let cleared=0; let lastProfile='';
      let tokenBlocked=false;
      host.dataset.generated='0';host.dataset.cleared='0';host.dataset.drags='0';
      const hasStart=initial!=='empty'&&initial!=='end-only';
      const hasEnd=initial==='end-only'||initial==='ready'||initial==='waypoints';
      const popup=buildPickPopup({lngLat:[126.98,37.55],initialStart:hasStart?[126.98,37.55]:null,
        initialHasStart:hasStart,initialHasEnd:hasEnd,routeProfile:'cycling',
        getWaypointCount:()=>count,accessToken:'',signal:ac.signal,
        onSelectPoint:(kind:string)=>{if(kind==='waypoint')count++;host.dataset.count=String(count);},
        onSetRouteProfileOnly:()=>{},onRouteProfile:(p:string)=>{generated++;lastProfile=p;host.dataset.generated=String(generated);host.dataset.profile=lastProfile;},
        getRouteTokenInsufficient:()=>tokenBlocked,
        onClearRoute:()=>{cleared++;host.dataset.cleared=String(cleared);},
        onArmDirectionPick:()=>({ok:true}),onPreviewDistanceAutoRouteCircle:()=>{},closePopup:()=>{host.dataset.closed='true';}});
      (host as HTMLElement & {setTokenBlocked:(v:boolean)=>void}).setTokenBlocked=(v:boolean)=>{tokenBlocked=v;};
      const shell=document.createElement('div');shell.className='map-view__pick-popup';
      const surface=document.createElement('div');surface.className='mapboxgl-popup-content';
      surface.style.position='relative';
      const close=document.createElement('button');close.className='mapboxgl-popup-close-button';close.type='button';close.textContent='×';close.setAttribute('aria-label','팝업 닫기');
      surface.append(popup,close);shell.append(surface);host.append(shell);document.body.append(host);
      mountRoutePickDockDrag({handleEl:popup.querySelector('.map-view__pick-drag-handle')!,panelEl:host,mapCanvas:host,
        getPosition:()=>({left:0,top:0}),onPositionChange:()=>{},
        onDraggingChange:(dragging:boolean)=>{if(dragging)host.dataset.drags=String(Number(host.dataset.drags)+1);}});
    },initial);
    const popup=page.locator('#popup-audit');
    await expect(popup.locator('.map-view__pick-meta-details,.map-view__pick-distance-eta,.map-view__pick-route-distance-summary,.map-view__pick-distance-map-hint')).toHaveCount(0);
    await expect(popup.getByRole('button',{name:'출발·도착 경로 생성',exact:true})).toHaveCount(0);
    await expect(popup.getByRole('button',{name:'경로 전체 삭제',exact:true})).toHaveCount(1);
    const headerLine=await popup.evaluate(()=>{
      const row=document.querySelector('.map-view__pick-header-row')!;
      const token=row.querySelector('.map-view__pick-token')!.getBoundingClientRect();
      const tabs=row.querySelector('.map-view__pick-route-tabs')!.getBoundingClientRect();
      const close=document.querySelector('#popup-audit .mapboxgl-popup-close-button')!.getBoundingClientRect();
      const clearInHeader=row.querySelector('.map-view__pick-btn--clear-route');
      const clearRect=clearInHeader!.getBoundingClientRect();
      const bottomClear=document.querySelector('.map-view__pick-profile-bottom-row .map-view__pick-btn--clear-route');
      const tokenFont=parseFloat(getComputedStyle(row.querySelector('.map-view__pick-token-line')!).fontSize);
      const tab=row.querySelector('.map-view__pick-route-tab')!.getBoundingClientRect();
      const tokenLine=row.querySelector('.map-view__pick-token-line')!.getBoundingClientRect();
      const tabsCloseIntersect=tabs.left<close.right&&tabs.right>close.left&&tabs.top<close.bottom&&tabs.bottom>close.top;
      return {tokenAboveTabs:token.bottom<=tabs.top,tabsShorter:tabs.width<row.getBoundingClientRect().width-40,clearRightOfTabs:clearRect.left>=tabs.right&&Math.abs((clearRect.top+clearRect.bottom)/2-(tabs.top+tabs.bottom)/2)<1,clearBorder:getComputedStyle(clearInHeader!).borderTopColor,bottomClear:!!bottomClear,tokenFont,tabsCloseIntersect,tokenLineClearOfClose:tokenLine.right<=close.left,tabHeight:tab.height,tabsHeight:tabs.height,tokenPadRight:parseFloat(getComputedStyle(row.querySelector('.map-view__pick-token')!).paddingRight),closeWidth:close.width,clearInHeader:!!clearInHeader};
    });
    // 지시65·시안05(묶음5): 토큰 줄 아래 전체 폭 분할 탭(28px), 원형 닫기와 겹치지 않음.
    // 종전 10-21 압축 계약(토큰·탭 한 줄, 탭 22px 이하)을 대체한다 — 감리73.
    expect(headerLine.tokenAboveTabs).toBe(true);
    // 지시94(10-26 Chief): 탭은 줄고 같은 줄 오른쪽에 빨간 테두리 경로 삭제, 제목 17px
    expect(headerLine.tabsShorter).toBe(true);
    expect(headerLine.clearRightOfTabs).toBe(true);
    expect(headerLine.clearBorder).toBe('rgb(220, 38, 38)');
    expect(headerLine.bottomClear).toBe(false);
    expect(headerLine.tokenFont).toBe(17);
    expect(headerLine.tabsCloseIntersect).toBe(false);
    expect(headerLine.tokenLineClearOfClose).toBe(true);
    expect(headerLine.tabHeight).toBe(28);
    expect(headerLine.tabsHeight).toBeLessThanOrEqual(34);
    expect(headerLine.tokenPadRight).toBeGreaterThanOrEqual(headerLine.closeWidth);
    expect(headerLine.clearInHeader).toBe(true);
    await expect(popup.getByRole('tab',{name:'출발·도착',exact:true})).toHaveAttribute('aria-selected','true');
    await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
    await expect(popup.locator('#map-view-pick-location-view')).toBeHidden();
    await expect(popup.locator('#map-view-pick-distance-view')).toBeVisible();
    await expect(popup).toHaveAttribute('data-drags','0');
    if(!hasStart)await expect(popup.getByRole('button',{name:'출발 지점으로 설정',exact:true})).toBeHidden();
    else{
      await popup.getByRole('button',{name:'목표 거리 5km',exact:true}).click();
      await expect(popup.getByRole('textbox',{name:'목표거리 km',exact:true})).toHaveValue('5.0');
      // 10-25 Chief: 거리·방향에도 수단 3개가 늘 보이고 출발이 있으면 쓸 수 있다. 보이기만 해서는 생성하지 않는다.
      await expect(popup.getByRole('button',{name:'보행 경로',exact:true})).toBeEnabled();
      await expect(popup).toHaveAttribute('data-generated','0');
    }
    await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
    const distanceTab=await popup.getByRole('tab',{name:'거리·방향',exact:true}).boundingBox();
    await page.touchscreen.tap(distanceTab!.x+distanceTab!.width/2,distanceTab!.y+distanceTab!.height/2);
    await expect(popup.getByRole('tab',{name:'거리·방향',exact:true})).toHaveAttribute('aria-selected','true');
    await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
    await expect(popup).toHaveAttribute('data-drags','0');
    await expect(popup.locator('#map-view-pick-distance-view')).toBeHidden();
    await popup.getByRole('tab',{name:'출발·도착',exact:true}).focus();
    await page.keyboard.press('End');
    await expect(popup.getByRole('tab',{name:'거리·방향',exact:true})).toHaveAttribute('aria-selected','true');
    await page.keyboard.press('Home');
    await expect(popup.getByRole('tab',{name:'출발·도착',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(popup).toHaveAttribute('data-generated','0');
    if(routeReady){
      await popup.getByRole('button',{name:'보행 경로',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','1');
      await expect(popup).toHaveAttribute('data-profile','walking');
      await popup.getByRole('button',{name:'자동차 경로',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','2');
      await expect(popup).toHaveAttribute('data-profile','driving');
      await popup.getByRole('button',{name:'자전거 경로',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','3');
      await expect(popup).toHaveAttribute('data-profile','cycling');
      await page.evaluate(()=>{(document.getElementById('popup-audit') as HTMLElement & {setTokenBlocked:(v:boolean)=>void}).setTokenBlocked(true);});
      await popup.getByRole('button',{name:'자전거 경로',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','3');
      await page.evaluate(()=>{(document.getElementById('popup-audit') as HTMLElement & {setTokenBlocked:(v:boolean)=>void}).setTokenBlocked(false);});
    }else if(hasStart){
      // 출발·도착 탭은 두 위치가 있어야 이동수단을 쓸 수 있다 — 10-25 Chief 부터 숨기지 않고 끈다.
      await expect(popup.getByRole('button',{name:'자전거 경로',exact:true})).toBeVisible();
      await expect(popup.getByRole('button',{name:'자전거 경로',exact:true})).toBeDisabled();
      await expect(popup).toHaveAttribute('data-generated','0');
    }
    await expect(popup.getByRole('button',{name:'경유지 추가',exact:true})).toHaveCount(1);
    await expect(popup.locator('.map-view__pick-btn--wp')).toHaveText(['+WP']);
    await expect(popup.locator('.map-view__pick-actions--pin-row button')).toHaveCount(3);
    await expect.poll(()=>popup.locator('.map-view__pick-route-tabs').evaluate(e=>getComputedStyle(e).display)).toBe('flex');
    await page.screenshot({path:path.join(evidence,`popup-11-${initial}-800.png`),animations:'disabled'});
    if(initial==='ready')for(const size of [{width:667,height:300},{width:844,height:390}]){
      await page.setViewportSize(size);
      const fit=await popup.evaluate(e=>{
        const box=e.querySelector('.mapboxgl-popup-content')!.getBoundingClientRect();
        const tabs=e.querySelector('.map-view__pick-route-tabs')!.getBoundingClientRect();
        const close=e.querySelector('.mapboxgl-popup-close-button')!.getBoundingClientRect();
        // 감리73: 시안05 는 탭이 닫기 아래 전체 폭이다 — 나란히(tabs.right<=close.left) 대신 겹침 없음.
        const tabsCloseIntersect=tabs.left<close.right&&tabs.right>close.left&&tabs.top<close.bottom&&tabs.bottom>close.top;
        return {right:box.right<=innerWidth,bottom:box.bottom<=innerHeight,tabsClear:!tabsCloseIntersect};
      });
      expect(fit).toEqual({right:true,bottom:true,tabsClear:true});
      await page.screenshot({path:path.join(evidence,`popup-11-ready-${size.width}.png`),animations:'disabled'});
    }
    const handle=await popup.locator('.map-view__pick-address').boundingBox();
    await page.mouse.move(handle!.x+2,handle!.y+2);await page.mouse.down();await page.mouse.move(handle!.x+8,handle!.y+2);await page.mouse.up();
    await expect(popup).toHaveAttribute('data-drags','1');
    await popup.getByRole('button',{name:'경로 전체 삭제',exact:true}).click();
    await expect(popup).toHaveAttribute('data-cleared','1');
    await expect(popup).toHaveAttribute('data-closed','true');
  });
}
