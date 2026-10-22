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
    expect(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.className,[x,y])).toContain('mapboxgl-canvas');
    await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
    await expect(popup).toBeVisible();
  };
  const readState=async()=>JSON.parse((await state.textContent())!) as {waypoints:number[][];starts:number};
  await hold(400,170);
  await expect(popup.locator('.map-view__pick-actions--pin-row button')).toHaveText(['출발','W1','W2','W3','도착']);
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
  for(const [slot,y] of [100,170,240].entries()){
    await hold(400,y);
    await popup.getByRole('button',{name:`경유지 ${slot+1}`,exact:true}).click();
    await expect.poll(async()=>(await readState()).waypoints.length).toBe(slot+1);
  }
  const before=(await readState()).waypoints;
  await hold(350,260);
  await popup.getByRole('button',{name:'경유지 2',exact:true}).click();
  const after=(await readState()).waypoints;
  expect(after).toHaveLength(3);expect(after[0]).toEqual(before[0]);expect(after[2]).toEqual(before[2]);expect(after[1]).not.toEqual(before[1]);
  await hold(400,170);
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    const geometry=await popup.evaluate(el=>{
      const buttons=[...el.querySelectorAll<HTMLElement>('.map-view__pick-actions--pin-row button')].map(b=>b.getBoundingClientRect());
      const play=el.querySelector('.map-view__pick-start-ride')!.getBoundingClientRect();
      const clear=el.querySelector('.map-view__pick-btn--clear-route')!.getBoundingClientRect();
      const panel=el.getBoundingClientRect();
      return {buttons:buttons.map(b=>({width:b.width,height:b.height,top:b.top,right:b.right})),play:play.toJSON(),clear:clear.toJSON(),panel:panel.toJSON()};
    });
    expect(geometry.buttons).toHaveLength(5);
    expect(geometry.buttons.every(b=>b.width>=44&&b.height>=44)).toBe(true);
    expect(new Set(geometry.buttons.map(b=>b.top)).size).toBe(1);
    expect(geometry.play.right).toBeLessThan(geometry.clear.left);
    const leftPadding=await popup.evaluate(e=>parseFloat(getComputedStyle(e).paddingLeft));
    expect(Math.abs(geometry.play.x-geometry.panel.x-leftPadding)).toBeLessThan(1);
    expect(Math.abs(geometry.play.y+geometry.play.height/2-geometry.clear.y-geometry.clear.height/2)).toBeLessThan(1);
    expect(geometry.panel.right).toBeLessThanOrEqual(size.width);
    expect(geometry.panel.bottom).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:path.resolve('../..','.out',`step29-popup-${size.width}.png`)});
  }
});
