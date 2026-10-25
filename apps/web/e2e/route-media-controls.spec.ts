import {test,expect} from '@playwright/test';
import {stubMapboxStyle} from './mapbox-stub';
import path from 'node:path';

test.use({viewport:{width:800,height:360},hasTouch:true});
test('다섯 위치의 추가·교체 및 열린 경로창의 시작 준비상태 동기화',async({page})=>{
  await stubMapboxStyle(page);
  await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('/scripts/ui-800x360/map-route-runtime.html');
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
  const popup=page.locator('.map-view__pick');
  const state=page.locator('#runtime-state');
  const hold=async(x:number,y:number)=>{
    // 지시65: 넓어진 팝업이 다음 지정 좌표를 덮을 수 있다. 닫고 실제 지도를 누른다.
    if (await popup.isVisible()) {
      await page.locator('.map-view__pick-dock-close, .mapboxgl-popup-close-button').last().click();
      await expect(popup).toBeHidden();
    }
    expect(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.className,[x,y])).toContain('mapboxgl-canvas');
    await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
    await expect(popup).toBeVisible();
  };
  const readState=async()=>JSON.parse((await state.textContent())!) as {waypoints:number[][];starts:number};
  await hold(400,170);
  await expect(popup.locator('.map-view__pick-actions--pin-row button')).toHaveText(['Start','+WP','End']);
  const play=popup.getByRole('button',{name:'주행 시작',exact:true});
  await expect(play).toBeDisabled();
  await popup.getByRole('button',{name:'출발 지점으로 설정',exact:true}).click();
  await hold(400,220);
  await popup.getByRole('button',{name:'도착 지점으로 설정',exact:true}).click();
  await expect(play).toBeDisabled();
  await page.getByRole('button',{name:'검수 입력 준비',exact:true}).click();
  await expect(play).toBeEnabled();
  expect((await play.textContent())?.trim()).toBe('');
  await play.click();
  await expect(state).toContainText('"starts":1');
  await page.getByRole('button',{name:'검수 입력 준비',exact:true}).click();
  await expect(play).toBeDisabled();
  // 10-23 Chief: 「+WP」 하나 — 누를 때마다 다음 칸에 추가, 3개가 차면 비활성
  for(const [slot,y] of [100,170,240].entries()){
    await hold(400,y);
    await popup.getByRole('button',{name:'경유지 추가',exact:true}).click();
    await expect.poll(async()=>(await readState()).waypoints.length).toBe(slot+1);
  }
  await hold(250,120);
  await expect(popup.getByRole('button',{name:'경유지 추가',exact:true})).toBeDisabled();
  await hold(520,150);
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    const geometry=await popup.evaluate(el=>{
      const buttons=[...el.querySelectorAll<HTMLElement>('.map-view__pick-actions--pin-row button')].map(b=>b.getBoundingClientRect());
      const play=el.querySelector('.map-view__pick-start-ride')!.getBoundingClientRect();
      const clear=el.querySelector('.map-view__pick-btn--clear-route')!.getBoundingClientRect();
      const profiles=[...el.querySelectorAll('.map-view__pick-btn--profile')].map(b=>b.getBoundingClientRect().toJSON());
      const panel=el.getBoundingClientRect();
      return {buttons:buttons.map(b=>({width:b.width,height:b.height,top:b.top,right:b.right})),profiles,play:play.toJSON(),clear:clear.toJSON(),panel:panel.toJSON()};
    });
    expect(geometry.buttons).toHaveLength(3);
    expect(geometry.buttons.every(b=>b.width>=44&&b.height>=28&&b.height<=30)).toBe(true);
    expect(new Set(geometry.buttons.map(b=>b.top)).size).toBe(1);
    expect(geometry.play.right).toBeLessThan(geometry.clear.left);
    expect(geometry.profiles).toHaveLength(3);
    expect(geometry.profiles[2].right).toBeLessThan(geometry.play.x);
    for(const profile of geometry.profiles)expect(Math.abs(profile.y+profile.height/2-geometry.play.y-geometry.play.height/2)).toBeLessThan(1);
    expect(Math.abs(geometry.play.y+geometry.play.height/2-geometry.clear.y-geometry.clear.height/2)).toBeLessThan(1);
    expect(geometry.panel.width).toBe(300);
    expect(geometry.panel.right).toBeLessThanOrEqual(size.width);
    expect(geometry.panel.bottom).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:path.resolve(process.env.BATCH5_EVIDENCE_DIR ?? '../../.out',`step30-manual-${size.width}.png`)});
  }
});
