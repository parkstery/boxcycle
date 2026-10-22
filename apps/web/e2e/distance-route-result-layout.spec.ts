import {test,expect} from '@playwright/test';
import {stubMapboxStyle} from './mapbox-stub';
import path from 'node:path';

for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
  test(`거리 결과 ${size.width}: 적용 수단·두 줄 메시지·폭 고정·한 행 제어`,async({page})=>{
    await page.setViewportSize(size);
    await stubMapboxStyle(page);
    await page.route(/https:\/\/api\.mapbox\.com\/(?!styles)/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.route(/\/src\/services\/routeFunctionsPrewarm\.ts/,r=>r.fulfill({contentType:'text/javascript',body:'export function prewarmRouteFunctions() {}'}));
    const requested:string[]=[];
    await page.route(/\/getDistanceAutoRoute(?:\?|$)/,async route=>{
      if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});return;}
      const input=route.request().postDataJSON().data;
      requested.push(input.profile);
      const end=[input.start[0]+0.004,input.start[1]+0.002];
      await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({result:{status:'found',outcome:'offered',directRoadMeters:800,end,distance:input.targetDistanceMeters,duration:60,routeTokenBalance:100-requested.length,
        geometry:{type:'LineString',coordinates:[input.start,end]},summary:'검수 경로'}})});
    });
    await page.goto('/scripts/ui-800x360/distance-route-runtime.html');
    await page.getByRole('button',{name:'여기에서 계속',exact:true}).click();
    const popup=page.locator('.map-view__pick');
    const before=(await popup.boundingBox())!;
    await expect(popup.locator('.map-view__pick-btn--profile.is-active')).toHaveCount(0);
    await popup.getByRole('textbox',{name:'목표거리 km',exact:true}).fill('0.5');
    await popup.getByRole('textbox',{name:'목표거리 km',exact:true}).press('Enter');
    await page.mouse.click(size.width-35,size.height*.55);
    const status=popup.locator('.map-view__pick-auto-route-status');
    const message='클릭 지점까지 도로로 0.8km\n목표 0.5 km 지점에서 종료.';
    await expect(status).toHaveAttribute('data-phase','found');
    expect(await status.textContent()).toBe(message);
    for(const [index,name] of ['자전거 경로','자동차 경로','보행 경로'].entries()){
      const button=popup.getByRole('button',{name,exact:true});
      if(index>0)await button.click();
      await page.mouse.move(size.width/2,35);
      await expect(page.locator('#distance-runtime-state')).toContainText(`"applied":${index+1}`);
      await expect(button).toHaveAttribute('aria-pressed','true');
      await expect(button).toHaveClass(/is-active/);
      await expect(popup.locator('.map-view__pick-btn--profile.is-active')).toHaveCount(1);
      await expect(button).toHaveCSS('background-color','rgb(37, 99, 235)');
      const after=(await popup.boundingBox())!;
      expect(Math.abs(after.width-before.width)).toBeLessThan(1);
    }
    expect(requested).toEqual(['cycling','driving','walking']);
    // 결과 높이 변경 뒤 기존 ResizeObserver의 viewport clamp가 반영될 때까지 확인한다.
    await expect.poll(async()=>(await popup.boundingBox())!.y+(await popup.boundingBox())!.height).toBeLessThanOrEqual(size.height);
    const layout=await popup.evaluate(el=>{
      const status=el.querySelector('.map-view__pick-auto-route-status')!;
      const controls=[...el.querySelectorAll('.map-view__pick-profile-bottom-row button')].map(b=>b.getBoundingClientRect().toJSON());
      const box=status.getBoundingClientRect();
      return {lineCount:box.height/parseFloat(getComputedStyle(status).lineHeight),controls,overflow:el.scrollWidth>el.clientWidth,box:el.getBoundingClientRect().toJSON()};
    });
    expect(layout.lineCount).toBeCloseTo(2,1);
    expect(layout.controls).toHaveLength(5);
    const centers=layout.controls.map(b=>b.y+b.height/2);
    expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(1);
    expect(layout.overflow).toBe(false);
    expect(layout.box.right).toBeLessThanOrEqual(size.width);
    expect(layout.box.bottom).toBeLessThanOrEqual(size.height);
    await page.screenshot({path:path.resolve('../..','.out',`step30-distance-${size.width}.png`)});
    await page.locator('.map-view__pick-dock-close').click();
    await page.getByRole('button',{name:'검수 경로창 열기',exact:true}).click();
    await expect(popup.getByRole('button',{name:'보행 경로',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(requested).toHaveLength(3);
  });
}
