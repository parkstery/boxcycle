import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
test.use({ viewport: {width:800,height:360} });

test('800×360 준비·주행의 지표가 읽히고 계정/카메라와 겹치지 않는다', async ({page}) => {
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
  await page.setViewportSize(size);
  for (const state of ['ready','riding','paused']) {
    await page.goto(`${preview}?state=${state}&long`);
    await expect(page.getByRole('group',{name:'주행 지표'})).toBeVisible();
    const geometry = await page.evaluate(() => {
      const rect = (selector:string) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
      const metrics=rect('.map-hud__tl-metrics');
    const groups=['.hud-ride-map-controls','.camera-view-menu__trigger','.hud-account']
        .map(sel=>rect(sel)).filter(Boolean) as DOMRect[];
      return { labels:[...document.querySelectorAll('.hud-metrics__label')].map(e=>parseFloat(getComputedStyle(e).fontSize)),
        values:[...document.querySelectorAll('.hud-metrics__value')].map(e=>parseFloat(getComputedStyle(e).fontSize)),
        metrics,groups,top:rect('.map-hud__tl') };
    });
    expect(geometry.labels.length).toBeGreaterThanOrEqual(state === 'ready' ? 2 : 4);
    expect(geometry.values.length).toBeGreaterThanOrEqual(state === 'ready' ? 2 : 4);
    expect(Math.min(...geometry.labels)).toBeGreaterThanOrEqual(11);
    expect(Math.min(...geometry.values)).toBeGreaterThanOrEqual(18);
    expect(geometry.top!.top).toBeLessThanOrEqual(8);
    await expect(page.locator('.hud-brand')).toHaveCount(0);
    await expect(page.locator('.hud-bc-trigger')).toHaveCount(0);
    for(const [i,group] of geometry.groups.entries()){
      const a=geometry.metrics!;
      const b=group as {x:number;right:number;y:number;bottom:number};
      expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,
        `${state}@${size.width}×${size.height}: metrics vs control group ${i}`).toBeTruthy();
    }
    expect(geometry.metrics!.right).toBeLessThanOrEqual(size.width);
    const textBounds=await page.locator('.hud-metrics__cell').evaluateAll(cells=>cells.map(cell=>{
      const range=document.createRange();range.selectNodeContents(cell.querySelector('.hud-metrics__value')!);
      const text=range.getBoundingClientRect(),box=cell.getBoundingClientRect();
      return text.left>=box.left-1&&text.right<=box.right+1;
    }));
    expect(textBounds.every(Boolean),'metric text stays in its own cell').toBeTruthy();
  }
  }
});

test('Chief 고정30 — 우상단 지도 조작과 서비스 기능은 간격으로 구획된다', async ({ page }) => {
  await page.goto(`${preview}?state=glance-riding`);
  const mapControls = page.getByRole('group', { name: '맵 제어' });
  const serviceActions = page.getByRole('group', { name: '서비스 기능' });
  await expect(mapControls).toBeVisible();
  await expect(serviceActions).toBeVisible();

  const spacing = await page.evaluate(() => {
    const map = document.querySelector('.hud-ride-map-controls')!.getBoundingClientRect();
    const service = document.querySelector('.map-hud__service-actions')!.getBoundingClientRect();
    const account = document.querySelector('.hud-account')!.getBoundingClientRect();
    return {
      outer: service.left - map.right,
      account,
      centerDelta: Math.abs(service.top + service.height / 2 - (map.top + map.height / 2)),
    };
  });
  expect(spacing.outer).toBeGreaterThanOrEqual(8);
  expect(spacing.centerDelta).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 667, height: 300 });
  await page.goto(`${preview}?state=glance-riding`);
  const compact = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const map = rect('.hud-ride-map-controls');
    const service = rect('.map-hud__service-actions');
    const children = [...document.querySelectorAll('.map-hud__service-actions > *')].map((el) => el.getBoundingClientRect());
    const overlaps = map.left < service.right && map.right > service.left && map.top < service.bottom && map.bottom > service.top;
    const inside = [map, service, ...children].every((box) =>
      box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
    );
    const childrenInsideGroup = children.every((box) =>
      box.left >= service.left && box.right <= service.right && box.top >= service.top && box.bottom <= service.bottom,
    );
    return { overlaps, inside, childrenInsideGroup };
  });
  expect(compact).toEqual({ overlaps: false, inside: true, childrenInsideGroup: true });
});

test('Chief 고정27 — 단일 카메라 메뉴, 1열 62px 우측 정렬, 2~6 파란 화살표 세로', async ({ page }) => {
  await page.goto(`${preview}?state=riding`);

  const trigger = page.getByRole('button', { name: /카메라 메뉴/ });
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  const panel = page.getByRole('menu', { name: '카메라 선택' });
  await expect(panel).toBeVisible();
  const heightMenu = page.getByRole('group', { name: '평면 카메라 높이' });
  const viewMenu = page.getByRole('group', { name: '시점 카메라' });
  const [flatBox, perspectiveBox] = await Promise.all([heightMenu.boundingBox(), viewMenu.boundingBox()]);
  expect(flatBox!.x + flatBox!.width).toBeLessThanOrEqual(perspectiveBox!.x + 1);
  expect((await panel.boundingBox())!.width).toBeCloseTo(154, 0);

  await expect(heightMenu.getByRole('menuitemradio')).toHaveCount(7);
  for (const label of ['전체 경로', '20m 상공', '200m 상공', '300m 상공', '400m 상공', '500m 상공', '1000m 상공']) {
    await expect(heightMenu.getByRole('menuitemradio', { name: `평면 카메라 · ${label}` })).toBeVisible();
  }
  const flatGeometry = await heightMenu.evaluate(menu => {
    const box = menu.getBoundingClientRect();
    const labels = [...menu.querySelectorAll<HTMLElement>('.camera-view-menu__item-label')];
    return {
      width: box.width,
      alignments: labels.map(label => getComputedStyle(label).textAlign),
      rightEdges: labels.map(label => label.getBoundingClientRect().right),
    };
  });
  expect(flatGeometry.width).toBeCloseTo(62, 0);
  expect(flatGeometry.alignments.every(value => value === 'right')).toBeTruthy();
  expect(Math.max(...flatGeometry.rightEdges) - Math.min(...flatGeometry.rightEdges)).toBeLessThanOrEqual(0.1);
  await heightMenu.getByRole('menuitemradio', { name: '평면 카메라 · 1000m 상공' }).click();
  await expect(trigger).toContainText('1000m');

  await trigger.click();
  await expect(viewMenu.getByRole('menuitemradio')).toHaveCount(5);
  await expect(viewMenu.locator('svg')).toHaveCount(5);
  await expect(viewMenu.locator('.camera-view-menu__item-label')).toHaveCount(0);
  const viewGeometry = await viewMenu.evaluate(menu => {
    const items = [...menu.querySelectorAll<HTMLElement>('.camera-view-menu__item--icon')].map(item => item.getBoundingClientRect());
    return {
      oneColumn: items.every(item => Math.abs(item.x - items[0]!.x) <= 0.1),
      ordered: items.every((item, index) => index === 0 || item.y > items[index - 1]!.y),
    };
  });
  expect(viewGeometry).toEqual({ oneColumn: true, ordered: true });
  for (const slot of [2, 3, 4, 5, 6]) {
    const item = viewMenu.getByRole('menuitemradio', { name: new RegExp(`^카메라 ${slot}`) });
    await expect(item).toBeVisible();
    await expect(item.locator(`[data-camera-direction="${slot}"]`)).toHaveCount(1);
  }
});

test('RouteDock 시안의 250px 판이고 시작 전에는 일시정지/종료가 없다', async ({page}) => {
  await page.goto(`${preview}?state=ready`);
  const shell = page.locator('.route-dock__card');
  const box = await shell.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(250.5);
  expect(box!.height).toBeLessThanOrEqual(130);
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
});

test('주소는 한 면으로 연결되고 경유지 추가만큼 패널이 늘어나며 내부 스크롤이 없다', async ({page}) => {
  for (const size of [{width:800,height:360},{width:667,height:300}]) {
    await page.setViewportSize(size);
    let previous = 0;
    for (const count of [0,1,2,3]) {
      await page.goto(`${preview}?state=ready&waypoints=${count}`);
      await expect(page.locator('.route-dock__stops > li')).toHaveCount(count+2);
      const dimensions=await page.locator('.route-dock-anchor').evaluate(root=>{
        const list=root.querySelector('.route-dock__stops') as HTMLElement;
        const rows=[...list.children].map(e=>e.getBoundingClientRect());
        const bounds=root.getBoundingClientRect();
        return {height:bounds.height, scroll:list.scrollHeight, client:list.clientHeight,
          visible:rows.every(r=>r.top>=bounds.top&&r.bottom<=bounds.bottom),
          boxes:[...root.querySelectorAll('.route-dock__stop,.route-dock__remove')].map(e=>({border:getComputedStyle(e).borderTopWidth, background:getComputedStyle(e).backgroundColor})),
          rowHeight:rows[0].height};
      });
      expect(dimensions.visible).toBeTruthy();
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
      // 2026-10-24 Chief 제안 A: S·E 기호 사이에 ⇅ 가 들어가도록 줄 30px(+경계선 1px) — 종전 29 이하에서 2px 늘림
      expect(dimensions.rowHeight).toBeLessThanOrEqual(31);
      expect(dimensions.boxes.every(x=>x.border==='0px'&&x.background==='rgba(0, 0, 0, 0)')).toBeTruthy();
      if(previous) expect(dimensions.height-previous).toBeGreaterThanOrEqual(23);
      previous=dimensions.height;
    }
  }
});

test('시작·센서·접기는 조작 가능하고 시작→정지→재개→결과로 이어진다', async ({page}) => {
  await page.goto(`${preview}?state=ready`);
  for(const locator of [page.getByRole('button',{name:'주행 시작',exact:true}),page.getByRole('button',{name:/^케이던스 센서:/}),page.getByRole('button',{name:'경로 패널 접기'})]){
    const r=await locator.boundingBox();
    expect(r!.height).toBeGreaterThanOrEqual(26);
    expect(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBeTruthy();
  }
  expect(await page.getByRole('button',{name:'주행 시작',exact:true}).evaluate(el=>{
    const height=el.getBoundingClientRect().height;
    const transform=getComputedStyle(el).transform;
    const scale=transform.startsWith('matrix(')?Number.parseFloat(transform.slice(7)):1;
    return height/(Number.isFinite(scale)&&scale>0?scale:1);
  })).toBeCloseTo(44,0);
  await page.getByRole('button',{name:'경로 패널 접기'}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'경로 패널 펼치기'})).toBeVisible();
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(0);
  await page.getByRole('button',{name:'주행 시작',exact:true}).click();
  await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','riding');
  await page.getByRole('button',{name:'일시정지',exact:true}).click();
  await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','paused');
  await page.getByRole('button',{name:'재개',exact:true}).first().click();
  await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage','riding');
  await page.getByRole('button',{name:'주행 종료',exact:true}).click();
  await expect(page.getByRole('region',{name:'주행 결과'})).toBeVisible();
  await expect(page.locator('.ride-control-bar')).toHaveCount(0);
});

test('주행 설정의 기본 표면은 사용자 언어와 명시적 닫기를 제공한다', async ({page}) => {
  await page.goto(`${preview}?state=settings`);
  const settings=page.getByRole('dialog',{name:'주행 설정',exact:true});
  await expect(settings.getByText('음성 안내',{exact:true})).toBeVisible();
  await expect(settings.getByText('배경 음악',{exact:true})).toBeVisible();
  await expect(settings.getByText(/No 센서/)).toHaveCount(0);
  await settings.getByRole('button',{name:'주행 설정 닫기'}).click();
  await expect(settings).toBeHidden();
});

test('800 기준 및 좁고 여유 있는 가로 화면에서 패널을 닫고 조작할 수 있다', async ({page}) => {
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const state of ['sensor','settings','routes','summary','account']){
      await page.goto(`${preview}?state=${state}`);
      const panels=page.locator('.cadence-sheet__panel,.map-view-sheet__panel,.ride-settings-sheet__panel,.oc-modal,.ride-summary__sheet,.user-info-sheet-root.is-open .user-info-sheet');
      await expect(panels.first()).toBeVisible();
      await expect.poll(async()=>{
        const box=await panels.first().boundingBox();
        if(!box)return Infinity;
        return Math.max(-box.x,-box.y,box.x+box.width-size.width,box.y+box.height-size.height);
      },{message:`${state} ${size.width}×${size.height} settles inside viewport`,timeout:3000}).toBeLessThanOrEqual(1);
      const r=await panels.first().boundingBox();
      expect(r!.x).toBeGreaterThanOrEqual(-1);
      expect(r!.y).toBeGreaterThanOrEqual(-1);
      expect(r!.x+r!.width).toBeLessThanOrEqual(size.width+1);
      expect(r!.y+r!.height).toBeLessThanOrEqual(size.height+1);
      await page.keyboard.press('Escape');
    }
  }
});

test('Guest의 확인된 0km와 아직 읽지 않은 도로망을 구별한다', async({page})=>{
  await page.goto(`${preview}?state=account`);
  const account=page.getByRole('dialog',{name:'사용자 정보',exact:true});
  await expect(account.getByLabel('내 도로망',{exact:true})).toContainText('0.0');
  await expect(account.getByText('첫 라이딩으로 나만의 길을 남겨보세요.',{exact:true})).toBeVisible();
  await expect(account.getByText('미구독',{exact:true})).toHaveCount(0);
  await page.goto(`${preview}?state=account&loading`);
  const loading=page.getByRole('dialog',{name:'사용자 정보',exact:true});
  await expect(loading.getByText('첫 라이딩으로 나만의 길을 남겨보세요.',{exact:true})).toHaveCount(0);
});

test('결과의 진행 숫자와 보조 설명은 잘리지 않고 읽힌다',async({page})=>{
  await page.goto(`${preview}?state=summary`);
  const result=page.getByRole('region',{name:'주행 결과',exact:true});
  await expect(result).toBeVisible();
  const geometry=await page.locator('.ride-summary__progress-text').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.client+1);
  expect(await page.locator('.ride-summary__story-detail').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10);
  await expect(result.getByText('시간',{exact:true})).toBeVisible();
  await expect(result.getByText('평균',{exact:true})).toBeVisible();
});

test('메뉴는 Tab 포커스를 가두고 Escape 후 트리거로 돌려준다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  const trigger=page.getByRole('button',{name:'Trail 메뉴',exact:true});
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu=page.getByRole('dialog',{name:'메뉴',exact:true});
  await expect(menu).toBeVisible();
  for(let i=0;i<18;i++){
    await page.keyboard.press('Tab');
    expect(await menu.evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
  }
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toHaveCount(0);
});

test('왼쪽 에지 띠는 20px·화면0에 붙고 빈 가장자리 드래그로는 열리지 않는다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  const handle=page.locator('.edge-panel-handle--left');
  const r=(await handle.boundingBox())!;
  expect(r.width).toBeGreaterThanOrEqual(18);
  expect(r.width).toBeLessThanOrEqual(21);
  expect(r.x).toBeLessThanOrEqual(0.5);
  const x=10,y=80;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+110,y,{steps:8});await page.mouse.up();
  await expect(page.getByRole('dialog'),'빈 가장자리 드래그는 열지 않는다').toHaveCount(0);
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'메뉴',exact:true});
  await expect(dialog).toBeVisible();
  await expect.poll(async()=>{const b=(await page.locator('.menu-panel').boundingBox())!;return Math.max(-b.x,0);}).toBeLessThanOrEqual(1);
  const head=page.locator('.menu-panel__head');
  const h=(await head.boundingBox())!;
  await page.mouse.move(h.x+Math.min(80,h.width/2),h.y+h.height/2);await page.mouse.down();
  await page.mouse.move(h.x+Math.min(80,h.width/2)-100,h.y+h.height/2,{steps:8});await page.mouse.up();
  await expect(dialog).toHaveCount(0);
  await page.mouse.click(x,40);
  await expect(page.getByRole('dialog'),'20px 띠 클릭은 열지 않는다').toHaveCount(0);
});

// Chief 고정14(2026-10-28 후속): 측면 메뉴는 보이는 흰 반투명 반원 탭으로만 연다 — 슬라이드 금지, 위치 고정.
test('Chief 고정14 — 왼쪽 흰 반투명 반원 탭: 계기판 아래 빈 자리, 누르면 열리고 끌어도 열리지 않는다',async({page})=>{
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const state of ['ready','riding','paused'] as const){
      await page.goto(`${preview}?state=${state}`);
      const g=await page.evaluate(()=>{
        const tabs=['left'].map(side=>{
          const tab=document.querySelector(`.edge-panel-tab--${side}`)!;
          const knob=tab.querySelector('.edge-panel-tab__knob')!;
          const t=tab.getBoundingClientRect(),k=knob.getBoundingClientRect();
          const hit=document.elementFromPoint(k.x+k.width/2,k.y+k.height/2);
          return {side,t:t.toJSON(),k:k.toJSON(),bg:getComputedStyle(knob).backgroundColor,hitOk:Boolean(hit?.closest(`.edge-panel-tab--${side}`))};
        });
        const others=[
          ['.map-hud__tl-metrics','계기'],
          ['.map-hud__tr','우상단'],
          ['.ride-control-bar','주행제어'],
          ['.hud-ride-map-controls','맵제어'],
          ['.camera-view-menu__trigger','카메라'],
          ['.hud-account','계정'],
          ['.route-dock__card','경로카드'],
          ['.route-minimap','미니맵'],
        ].flatMap(([sel,name])=>{
          const el=document.querySelector(sel);
          if(!el) return [];
          const r=el.getBoundingClientRect();
          if(r.width<=0||r.height<=0) return [];
          if(sel==='.route-dock__card' && r.width<=32 && r.height<=32) return [];
          return [{name, ...r.toJSON()}];
        });
        return {tabs,others,vw:innerWidth,vh:innerHeight};
      });
      for(const tab of g.tabs){
        const label=`${size.width}×${size.height} ${state} ${tab.side}`;
        expect(tab.k.width,label).toBeCloseTo(20.4,1);
        expect(tab.k.height,label).toBeCloseTo(43.2,1);
        expect(tab.t.width*tab.t.height,label).toBeGreaterThanOrEqual(44*76-1);
        expect(tab.bg,label).toBe('rgba(255, 255, 255, 0.78)');
        expect(tab.hitOk,label).toBe(true);
        if(tab.side==='left') expect(tab.k.x,label).toBeLessThanOrEqual(0.5);
        else expect(tab.k.x+tab.k.width,label).toBeGreaterThanOrEqual(g.vw-0.5);
        for(const o of g.others){
          const overlap=tab.k.x<o.right&&tab.k.right>o.left&&tab.k.y<o.bottom&&tab.k.bottom>o.top;
          expect(overlap,`${label} vs ${o.name}`).toBe(false);
        }
      }
    }
  }
  await page.setViewportSize({width:800,height:360});
  const dialog=page.getByRole('dialog',{name:'메뉴',exact:true});
  await page.goto(`${preview}?state=ready`);
  const closedTab=(await page.locator('.edge-panel-tab--left').boundingBox())!;
  await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
  await expect(dialog,'누르면 열림').toBeVisible();
  const openTab=(await page.locator('.edge-panel-tab--left').boundingBox())!;
  expect(Math.abs(openTab.x-closedTab.x),'열린 뒤 x 유지').toBeLessThanOrEqual(1);
  expect(Math.abs(openTab.y-closedTab.y),'열린 뒤 y 유지').toBeLessThanOrEqual(1);
  await expect(page.locator('.edge-panel-tab--left'),'열어도 탭은 남는다').toHaveCount(1);
  await page.goto(`${preview}?state=ready`);
  const k=(await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  const x=k.x+k.width/2,y=k.y+k.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+120,y,{steps:10});await page.mouse.up();
  await expect(dialog,'탭에서 끌어도 열리지 않는다').toHaveCount(0);
});

test('포커스 대안·빈 가장자리 짧은/반대 드래그는 열지 않는다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  for(const movement of [{dx:24,dy:0},{dx:-24,dy:0},{dx:0,dy:24}]){
    const x=10,y=40;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+movement.dx,y+movement.dy,{steps:5});
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('빈 가장자리 드래그 취소·화면 크기 변경 후에도 중앙 지도는 가리지 않는다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  const x=10,y=40;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:5});
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:5});
  await page.setViewportSize({width:844,height:390});await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Trail 메뉴',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.audit-map').evaluate(el=>el.addEventListener('pointerdown',()=>el.setAttribute('data-audit-hit','yes')));
  await page.mouse.move(420,180);await page.mouse.down();await page.mouse.move(480,195,{steps:6});await page.mouse.up();
  await expect(page.locator('.audit-map')).toHaveAttribute('data-audit-hit','yes');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('경로 모달에서 세 출처를 전환해도 목록은 하나이며 닫으면 메뉴로 돌아온다', async ({page})=>{
  await page.goto(`${preview}?state=menu`);
  await page.getByRole('button',{name:'내 경로',exact:true}).click();
  const savedDefault=page.getByRole('dialog',{name:'내 경로',exact:true});
  await expect(savedDefault).toBeVisible();
  const sourceButtons=savedDefault.getByRole('navigation',{name:'경로 출처'}).getByRole('button');
  await expect(sourceButtons).toHaveText(['내 경로','퍼블릭','입문']);
  await savedDefault.getByRole('button',{name:'입문',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const intro=page.getByRole('dialog',{name:'입문 경로',exact:true});
  await intro.getByRole('button',{name:'퍼블릭',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toHaveCount(0);
  await page.getByRole('dialog',{name:'퍼블릭 경로',exact:true}).getByRole('button',{name:'내 경로',exact:true}).click();
  const saved=page.getByRole('dialog',{name:'내 경로',exact:true});
  await expect(saved).toBeVisible();
  await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(saved).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
});

// Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
test.describe('Chief 고정 — 261024 목록 1~4', () => {
  const greenBottom = 'rgb(0, 150, 39)';

  test('준비·일시정지 조작부와 순위 칩·주행 중 지도 조작', async ({ page }) => {
    const evidenceDir = process.env.BATCH2_EVIDENCE_DIR;
    if (evidenceDir) await fs.mkdir(evidenceDir, { recursive: true });

    for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }]) {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=ready`);
      const start = page.getByRole('button', { name: '주행 시작', exact: true });
      await expect(start).toBeVisible();
      expect((await start.innerText()).trim()).toBe('');
      const startBox = await start.boundingBox();
      expect(startBox!.width).toBeCloseTo(startBox!.height, 0);
      const startBg = await start.evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(startBg).toContain(greenBottom);

      await page.goto(`${preview}?state=glance-ready`);
      const rank = page.getByRole('button', { name: '순위 열기', exact: true });
      await expect(rank).toBeVisible();
      const rankBox = await rank.boundingBox();
      expect(rankBox!.height).toBeGreaterThanOrEqual(44);
      await expect(rank).toHaveAttribute('aria-controls', 'lb-glance-panel');

      if (evidenceDir && size.width === 667) {
        await page.screenshot({ path: path.join(evidenceDir, 'ready-667x300.png'), animations: 'disabled' });
      }
      if (evidenceDir && size.width === 800) {
        await page.screenshot({ path: path.join(evidenceDir, 'ready-800x360.png'), animations: 'disabled' });
      }

      await page.goto(`${preview}?state=paused`);
      const controls = page.getByRole('group', { name: '주행 제어' });
      const mediaTexts = await controls.locator('.ride-media-button, button[aria-label="일시정지 옵션"]').evaluateAll(
        (buttons) => buttons.map((b) => (b.textContent ?? '').trim()),
      );
      expect(mediaTexts.every((t) => t === '' || t === '⋯' || t === '...')).toBeTruthy();
      await expect(page.getByText('주행 끝내기', { exact: true })).toHaveCount(0);
      await expect(page.getByText('다시 달리기', { exact: true })).toHaveCount(0);
      const resume = page.getByRole('button', { name: '재개', exact: true });
      const resumeBg = await resume.evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(resumeBg).toContain(greenBottom);

      if (evidenceDir && size.width === 667) {
        await page.screenshot({ path: path.join(evidenceDir, 'paused-667x300.png'), animations: 'disabled' });
      }
      if (evidenceDir && size.width === 800) {
        await page.screenshot({ path: path.join(evidenceDir, 'paused-800x360.png'), animations: 'disabled' });
      }
    }

    await page.setViewportSize({ width: 800, height: 360 });
    for (const state of ['riding', 'paused'] as const) {
      await page.goto(`${preview}?state=${state}`);
      await expect(page.locator('.hud-ride-map-controls')).toBeVisible();
      await expect(page.getByRole('button', { name: /야외|위성/ })).toBeVisible();
      const style = page.locator('.hud-ride-map-controls__style');
      await expect(style).toHaveText('');
      await expect(style.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'satellite');
      await style.click();
      await expect(style).toHaveAccessibleName('맵 스타일 야외, 클릭 시 위성');
      await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'outdoors');
      await style.click();
      await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'satellite');
      await expect(page.locator('.hud-ride-map-controls__zoom').first()).toBeVisible();
    }
    if (evidenceDir) {
      await page.goto(`${preview}?state=riding`);
      await page.screenshot({ path: path.join(evidenceDir, 'riding-800x360.png'), animations: 'disabled' });
    }
  });
});

// Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
// 2026-10-28 Chief: 접힌 RouteDock 은 흰/녹 점멸 LED 하나. 펼치면 접기 LED + 센서 알약.
async function assertCollapsedRouteDockChip(page: import('@playwright/test').Page) {
  const card = page.locator('.route-dock__card');
  const expand = page.getByRole('button', { name: '경로 패널 펼치기' });
  await expect(expand).toBeVisible();
  await expect(page.getByRole('button', { name: /^케이던스 센서:/ })).toHaveCount(0);
  const cardBox = (await card.boundingBox())!;
  expect(cardBox.width).toBeGreaterThanOrEqual(28);
  expect(cardBox.width).toBeLessThanOrEqual(44);
  expect(cardBox.height).toBeGreaterThanOrEqual(28);
  expect(cardBox.height).toBeLessThanOrEqual(44);

  const geometry = await page.evaluate(() => {
    const cardEl = document.querySelector('.route-dock__card')!;
    const ledEl = document.querySelector('.route-dock__led-toggle')!;
    const cardR = cardEl.getBoundingClientRect();
    const ledR = ledEl.getBoundingClientRect();
    const cx = ledR.x + ledR.width / 2;
    const cy = ledR.y + ledR.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const cardStyle = getComputedStyle(cardEl);
    const inViewport =
      ledR.left >= 0 &&
      ledR.top >= 0 &&
      ledR.right <= window.innerWidth &&
      ledR.bottom <= window.innerHeight;
    const ledInsideCard =
      ledR.left >= cardR.left - 0.5 &&
      ledR.top >= cardR.top - 0.5 &&
      ledR.right <= cardR.right + 0.5 &&
      ledR.bottom <= cardR.bottom + 0.5;
    const hitOk = hit === ledEl || ledEl.contains(hit);
    return {
      inViewport,
      ledInsideCard,
      hitOk,
      cardBg: cardStyle.backgroundColor,
    };
  });
  expect(geometry.inViewport).toBe(true);
  expect(geometry.ledInsideCard).toBe(true);
  expect(geometry.hitOk).toBe(true);
  expect(geometry.cardBg === 'rgba(0, 0, 0, 0)' || geometry.cardBg === 'transparent').toBeTruthy();
}

test.describe('Chief 고정 — 목록 11 주행·일시정지 중 주소창', () => {
  // 2026-10-24 Chief: 「주행 전 routedock 가로길이를 주행 중과 같은 길이로」(종전 250px 고정 대체).
  test('대기 화면 펼친 주소 카드 폭은 주행 중 펼친 주소 카드(=미니맵) 폭과 같다', async ({ page }) => {
    for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=ready`);
      await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
      const readyWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
      await page.goto(`${preview}?state=riding`);
      await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
      await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
      const ridingWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
      expect(Math.abs(readyWidth - ridingWidth), `${size.width}×${size.height}`).toBeLessThanOrEqual(1);
    }
  });

  test('주행·일시정지는 접힌 상태로 시작하고 펼치면 출발·도착이 보이며 미니맵과 너비가 같다', async ({ page }, testInfo) => {
    const evidenceDir = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? testInfo.outputPath('route-dock-evidence');
    await fs.mkdir(evidenceDir, { recursive: true });

    for (const state of ['riding', 'paused'] as const) {
      await page.setViewportSize({ width: 800, height: 360 });
      await page.goto(`${preview}?state=${state}&long&waypoints=1`);
      await expect(page.locator('.route-dock-anchor')).toBeVisible();
      await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toHaveCount(0);
      const expand = page.getByRole('button', { name: '경로 패널 펼치기' });
      await assertCollapsedRouteDockChip(page);
      await expect(page.locator('.route-dock__stops')).toBeHidden();

      await page.evaluate(() => {
        const style = document.createElement('style');
        style.setAttribute('data-testid', 'late-map-bottom-left-stack-width');
        style.textContent = `
.map-bottom-left-stack > .route-dock-anchor {
  width: min(250px, calc(100vw - 16px));
  max-width: min(250px, calc(100vw - 16px));
}`;
        document.head.appendChild(style);
      });
      await assertCollapsedRouteDockChip(page);

      if (state === 'riding') {
        const expandBox = (await expand.boundingBox())!;
        await page.screenshot({
          path: path.join(evidenceDir, 'riding-collapsed-800x360.png'),
          animations: 'disabled',
        });
        await page.screenshot({
          path: path.join(evidenceDir, 'riding-collapsed-zoom.png'),
          animations: 'disabled',
          clip: {
            x: Math.max(0, expandBox.x + expandBox.width / 2 - 60),
            y: Math.max(0, expandBox.y + expandBox.height / 2 - 60),
            width: 120,
            height: 120,
          },
        });
      }
      if (state === 'paused') {
        await page.screenshot({
          path: path.join(evidenceDir, 'paused-collapsed-800x360.png'),
          animations: 'disabled',
        });
      }

      await expand.click();
      await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
      await expect(page.locator('.route-dock__badge--start')).toHaveText('S');
      await expect(page.locator('.route-dock__badge--end')).toHaveText('E');
      await expect(page.locator('.route-dock__remove')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Start·End 바꾸기' })).toHaveCount(0);
      if (state === 'riding') {
        await page.screenshot({
          path: path.join(evidenceDir, 'riding-expanded-800x360.png'),
          animations: 'disabled',
        });
      }

      const geometry = await page.evaluate(() => {
        const dock = document.querySelector('.route-dock__card')!.getBoundingClientRect();
        const mini = document.querySelector('.map-bottom-left-stack .route-minimap')!.getBoundingClientRect();
        return {
          width: dock.width - mini.width,
          left: dock.left - mini.left,
          right: dock.right - mini.right,
        };
      });
      for (const difference of Object.values(geometry)) {
        expect(Math.abs(difference)).toBeLessThan(0.1);
      }
    }

    await page.setViewportSize({ width: 667, height: 300 });
    await page.goto(`${preview}?state=riding&long&waypoints=1`);
    await assertCollapsedRouteDockChip(page);
    await page.screenshot({
      path: path.join(evidenceDir, 'riding-collapsed-667x300.png'),
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto(`${preview}?state=ready`);
    await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
    await page.getByRole('button', { name: '경로 패널 접기' }).click();
    await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toHaveCount(0);
    await assertCollapsedRouteDockChip(page);
    await page.screenshot({
      path: path.join(evidenceDir, 'ready-collapsed-800x360.png'),
      animations: 'disabled',
    });
  });
});

test('Chief 고정12 — 주소 카드 버튼은 선 아이콘·흰 알약 센서(제안 A)다', async ({ page }) => {
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready`);
    await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
    const look = await page.evaluate(() => {
      const box = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
      const swap = document.querySelector('.route-dock__swap');
      const sensor = document.querySelector('.route-dock__head .hud-cadence');
      const led = document.querySelector('.route-dock__head .hud-cadence__led');
      const sensorStyle = sensor ? getComputedStyle(sensor) : null;
      return {
        swapSvg: Boolean(swap?.querySelector('svg path')),
        swapBg: swap ? getComputedStyle(swap).backgroundColor : null,
        glyphButtons: [...document.querySelectorAll('.route-dock__remove')].map((b) => ({
          text: (b.textContent ?? '').trim(),
          svg: Boolean(b.querySelector('svg path')),
        })),
        sensorH: box(sensor)?.height ?? 0,
        sensorBg: sensorStyle?.backgroundColor,
        sensorBorder: sensorStyle ? `${sensorStyle.borderTopWidth} ${sensorStyle.borderTopColor}` : null,
        sensorRadius: sensorStyle ? parseFloat(sensorStyle.borderTopLeftRadius) : 0,
        sensorFont: sensorStyle ? `${sensorStyle.fontSize} ${sensorStyle.fontWeight}` : null,
        ledW: box(led)?.width ?? 0,
      };
    });
    expect(look.swapSvg, '⇅ 는 선 아이콘(CSS 막대 금지)').toBe(true);
    expect(look.swapBg).toBe('rgb(242, 243, 245)');
    expect(look.glyphButtons.length).toBeGreaterThanOrEqual(2);
    for (const b of look.glyphButtons) {
      expect(b.text, '✕ ‹ 글자 기호 금지').toBe('');
      expect(b.svg).toBe(true);
    }
    expect(look.sensorH).toBeCloseTo(30, 0);
    expect(look.sensorBg).toBe('rgb(255, 255, 255)');
    expect(look.sensorBorder).toBe('1px rgb(201, 214, 238)');
    expect(look.sensorRadius).toBeGreaterThanOrEqual(15);
    expect(look.sensorFont).toBe('12px 700');
    expect(look.ledW).toBeCloseTo(7, 0);
  }
});

test('Chief 고정12 — ⇅ 는 주소 목록 앞쪽, 기호(S·1·2·3·E) 열 위 세로 가운데에 있고 기호·주소를 가리지 않는다', async ({ page }) => {
  for (const waypoints of [0, 2]) {
    for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=ready&waypoints=${waypoints}`);
      await expect(page.getByRole('button', { name: 'Start·End 바꾸기' })).toBeVisible();
      const g = await page.evaluate(() => {
        const r = (el: Element) => el.getBoundingClientRect();
        const swap = r(document.querySelector('.route-dock__swap')!);
        const disc = { left: swap.left + 7, right: swap.right - 7, top: swap.top + 7, bottom: swap.bottom - 7 };
        const dots = [...document.querySelectorAll('.route-dock__badge')].map(r);
        const labels = [...document.querySelectorAll('.route-dock__label')].map(r);
        const list = r(document.querySelector('.route-dock__stops')!);
        const hit = document.elementFromPoint(swap.left + swap.width / 2, swap.top + swap.height / 2);
        const overlaps = (a: { left: number; right: number; top: number; bottom: number }, b: DOMRect) =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        return {
          cx: swap.left + swap.width / 2,
          cy: swap.top + swap.height / 2,
          listMid: list.top + list.height / 2,
          startDotX: dots[0]!.left + dots[0]!.width / 2,
          discOverDot: dots.some((d) => overlaps(disc, d)),
          discOverLabel: labels.some((l) => overlaps(disc, l)),
          hitOk: Boolean(hit?.closest('.route-dock__swap')),
          discW: disc.right - disc.left,
        };
      });
      expect(Math.abs(g.cx - g.startDotX), '기호 열 위').toBeLessThanOrEqual(1);
      expect(Math.abs(g.cy - g.listMid), '목록 세로 가운데').toBeLessThanOrEqual(1);
      expect(g.discOverDot, '기호를 가리지 않는다').toBe(false);
      expect(g.discOverLabel, '주소 글자를 가리지 않는다').toBe(false);
      expect(g.hitOk).toBe(true);
      expect(g.discW).toBeCloseTo(14, 0);
      const badges = await page.locator('.route-dock__badge').allTextContents();
      expect(badges, '지도 핀과 같은 기호').toEqual(['S', ...Array.from({ length: waypoints }, (_, i) => String(i + 1)), 'E']);
      // 「출발·경유·도착」 이름표 칸 없음 — 줄 = 기호 + 주소뿐(주소 자체에 「경유지」가 들어갈 수 있어 글자 검색은 하지 않는다)
      const rowParts = await page.locator('.route-dock__stop').evaluateAll((rows) =>
        rows.map((row) => [...row.children].map((c) => c.className.split(' ')[0])),
      );
      for (const parts of rowParts) expect(parts).toEqual(['route-dock__badge', 'route-dock__label']);
    }
  }
});

test('Chief 고정12 — 대기 화면은 센서·접기가 맨 위 한 줄, ✕ 는 오른쪽 끝, 경유 줄은 대기·주행 모두 들여 쓴다', async ({ page }) => {
  for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }]) {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready&waypoints=2`);
    await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
    const g = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const card = r('.route-dock__card');
      const sensor = r('.route-dock__head .hud-cadence');
      const caret = r('.route-dock__fold');
      const firstRow = r('.route-dock__row');
      const removes = [...document.querySelectorAll('.route-dock__remove')].map((e) => e.getBoundingClientRect());
      const dots = [...document.querySelectorAll('.route-dock__row')].map((row) => ({
        kind: [...row.classList].find((c) => c.startsWith('route-dock__row--'))!.replace('route-dock__row--', ''),
        left: row.querySelector('.route-dock__badge')!.getBoundingClientRect().left,
      }));
      return { card, sensor, caret, firstRow, removes, dots };
    });
    expect(Math.abs(g.sensor.y + g.sensor.height / 2 - (g.caret.y + g.caret.height / 2)), '센서·접기 같은 줄').toBeLessThanOrEqual(2);
    expect(g.sensor.bottom, '센서는 주소 첫 줄 위').toBeLessThanOrEqual(g.firstRow.top + 0.5);
    expect(g.caret.bottom, '접기는 주소 첫 줄 위').toBeLessThanOrEqual(g.firstRow.top + 0.5);
    for (const rm of g.removes) expect(g.card.right - rm.right, '✕ 는 오른쪽 끝').toBeLessThanOrEqual(10);
    const start = g.dots.find((d) => d.kind === 'start')!.left;
    for (const wp of g.dots.filter((d) => d.kind === 'waypoint')) expect(wp.left - start).toBeGreaterThanOrEqual(12);
  }
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=riding&waypoints=2`);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const riding = await page.evaluate(() =>
    [...document.querySelectorAll('.route-dock__row')].map((row) => ({
      waypoint: row.classList.contains('route-dock__row--waypoint'),
      left: row.querySelector('.route-dock__badge')!.getBoundingClientRect().left,
    })),
  );
  const startLeft = riding[0]!.left;
  const wps = riding.filter((d) => d.waypoint);
  expect(wps.length).toBe(2);
  for (const wp of wps) expect(wp.left - startLeft, '주행 중 경유 들여쓰기').toBeGreaterThanOrEqual(12);
});

test('Chief 고정10 — 주행 기록은 계정 패널 안에서 인라인 펼침·접기를 유지한다', async ({ page }, testInfo) => {
  const outDir = process.env.ENTRY_CARD_HISTORY_EVIDENCE ?? testInfo.outputPath('inline-history-evidence');
  await fs.mkdir(outDir, { recursive: true });
  for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }]) {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=account&historyPreview=1`);
    const account = page.getByRole('dialog', { name: '사용자 정보', exact: true });
    await expect(account).toBeVisible();
    await page.screenshot({
      path: path.join(outDir, `final-account-${size.width}x${size.height}.png`),
      animations: 'disabled',
    });
    const trigger = account.getByRole('button', { name: /마지막 주행/ });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    const history = account.locator('#user-info-sheet-history-list');
    await expect(history).toBeVisible();
    await expect(history.locator('li')).toHaveCount(3);
    await expect(account.getByRole('tablist', { name: '통계 기간' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: '주행 기록', exact: true })).toHaveCount(0);
    await page.screenshot({
      path: path.join(outDir, `final-inline-${size.width}x${size.height}.png`),
      animations: 'disabled',
    });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(history).toHaveCount(0);
    await expect(account).toBeVisible();
  }
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=ready`);
  await expect(page.locator('.local-first__card')).toHaveCount(0);
  await page.screenshot({
    path: path.join(outDir, 'after-first-visit-800x360.png'),
    animations: 'disabled',
  });
});
