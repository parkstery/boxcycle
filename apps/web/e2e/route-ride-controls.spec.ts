import { test, expect } from './open-meteo-stub';
import path from 'node:path';
import fs from 'node:fs';

const preview='/scripts/ui-800x360/preview.html';
const evidence=path.resolve('../..','.out','ui-route-ride-20261021');
test.use({viewport:{width:800,height:360}});
test('분리된 주소/주행바: 세 크기·다섯 상태·지도정보와 겹침 없음',async({page})=>{
  fs.mkdirSync(evidence,{recursive:true});
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const state of ['idle','setup','ready','riding','paused']){
      await page.goto(`${preview}?state=${state}`);
      const bar=page.locator('.ride-control-bar');
      await expect(bar).toBeVisible();
      await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
      if(state==='idle')await expect(page.locator('.route-dock-anchor')).toHaveCount(0);
      const geom=await page.evaluate(()=>{
        const bar=document.querySelector('.ride-control-bar')!.getBoundingClientRect();
        const others=[...document.querySelectorAll('.hud-clock,.map-hud__tr,.route-dock-anchor')].map(e=>e.getBoundingClientRect());
        const collide=others.filter(b=>b.width>0&&b.height>0&&bar.left<b.right&&bar.right>b.left&&bar.top<b.bottom&&bar.bottom>b.top);
        return {bar:bar.toJSON(),collide:collide.map(b=>b.toJSON())};
      });
      expect(geom.bar.height).toBeLessThanOrEqual(36);
      expect(geom.bar.right).toBeLessThanOrEqual(size.width);
      expect(geom.collide).toEqual([]);
      if(size.width===800)await page.screenshot({path:path.join(evidence,`bar-${state}-800.png`),animations:'disabled'});
    }
  }
});
test('주소 접기 독립·이어달리기·종료 후 센서만 복귀',async({page})=>{
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
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toHaveCount(0);
});
test('준비되지 않은 입력으로 시작할 수 없고 경로 없이 센서 접근 가능',async({page})=>{
  await page.goto(`${preview}?state=ready&blocked`);
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeDisabled();
  await page.goto(`${preview}?state=idle`);
  await page.getByRole('button',{name:/^케이던스 센서:/}).click();
  await expect(page.getByRole('dialog',{name:'케이던스 센서',exact:true})).toBeVisible();
});

test('짧은 주행 종료도 시작버튼이 되살아나지 않고 새 경로 확정시만 복귀',async({page})=>{
  await page.goto(`${preview}?state=ready&short`);
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await page.getByRole('button',{name:'주행 종료',exact:true}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'주행 종료',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
  await page.getByRole('button',{name:'검수용 새 경로 확정',exact:true}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
});

for(const initial of ['empty','ready','waypoints'] as const){
  test(`경로 생성 실제 DOM: ${initial} 모드배타·값보존·명시생성`,async({page})=>{
    await page.goto(`${preview}?state=ready`);
    await page.evaluate(async(initial)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='/src/components/map/MapView.css';document.head.append(css);
      const url='/src/components/map/mapPopupElements.ts';
      const {buildPickPopup}=await import(url);
      const ac=new AbortController();
      const host=document.createElement('div');host.id='popup-audit';host.className='map-view';
      Object.assign(host.style,{position:'absolute',right:'4px',top:'44px',width:'215px',zIndex:'10',border:'0',background:'transparent',minHeight:'0'});
      let count=initial==='waypoints'?3:0;
      let generated=0; let lastProfile='';
      host.dataset.generated='0';
      const popup=buildPickPopup({lngLat:[126.98,37.55],initialStart:initial==='empty'?null:[126.98,37.55],
        initialHasStart:initial!=='empty',initialHasEnd:initial!=='empty',routeProfile:'cycling',
        getWaypointCount:()=>count,accessToken:'',signal:ac.signal,
        onSelectPoint:(kind:string)=>{if(kind==='waypoint')count++;host.dataset.count=String(count);},
        onSetRouteProfileOnly:()=>{},onRouteProfile:(p:string)=>{generated++;lastProfile=p;host.dataset.generated=String(generated);host.dataset.profile=lastProfile;},
        onArmDirectionPick:()=>({ok:true}),onPreviewDistanceAutoRouteCircle:()=>{},closePopup:()=>{}});
      const shell=document.createElement('div');shell.className='map-view__pick-popup';
      const surface=document.createElement('div');surface.className='mapboxgl-popup-content';
      surface.append(popup);shell.append(surface);host.append(shell);document.body.append(host);
    },initial);
    const popup=page.locator('#popup-audit');
    await expect(popup.getByRole('tab',{name:'출발·도착',exact:true})).toHaveAttribute('aria-selected','true');
    await popup.getByRole('tab',{name:'거리·방향',exact:true}).click();
    await expect(popup.locator('#map-view-pick-location-view')).toBeHidden();
    await expect(popup.locator('#map-view-pick-distance-view')).toBeVisible();
    if(initial==='empty')await expect(popup.getByText(/출발.*설정/).first()).toBeVisible();
    else{
      await popup.getByRole('button',{name:'목표 거리 5km',exact:true}).click();
      await expect(popup.getByRole('textbox',{name:'목표거리 km',exact:true})).toHaveValue('5.0');
    }
    await popup.getByRole('tab',{name:'출발·도착',exact:true}).click();
    await expect(popup.locator('#map-view-pick-distance-view')).toBeHidden();
    await expect(popup).toHaveAttribute('data-generated','0');
    if(initial!=='empty'){
      await popup.getByRole('button',{name:'보행 경로',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','0');
      await popup.getByRole('button',{name:'출발·도착 경로 생성',exact:true}).click();
      await expect(popup).toHaveAttribute('data-generated','1');
      await expect(popup).toHaveAttribute('data-profile','walking');
    }
    if(initial==='waypoints'){
      await expect(popup.getByRole('button',{name:'경유지 추가',exact:true})).toHaveCount(0);
      await expect(popup.locator('.map-view__pick-btn--wp')).toHaveCount(3);
    }else await expect(popup.getByRole('button',{name:'경유지 추가',exact:true})).toHaveCount(1);
    await expect.poll(()=>popup.locator('.map-view__pick-route-tabs').evaluate(e=>getComputedStyle(e).display)).toBe('flex');
    await page.screenshot({path:path.join(evidence,`popup-${initial}-800.png`),animations:'disabled'});
  });
}
