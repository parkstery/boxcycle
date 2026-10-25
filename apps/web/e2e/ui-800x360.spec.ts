import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  expect((await page.getByRole('button',{name:'주행 시작',exact:true}).boundingBox())!.height).toBe(44);
  await page.getByRole('button',{name:'경로 패널 접기'}).click();
  await expect(page.getByRole('button',{name:'주행 시작',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^케이던스 센서:/})).toHaveCount(1);
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

test('맵과 주행 설정의 기본 표면은 사용자 언어와 명시적 닫기를 제공한다', async ({page}) => {
  await page.goto(`${preview}?state=map`);
  const map=page.getByRole('dialog',{name:'맵 뷰',exact:true});
  expect((await page.locator('.map-view-sheet__panel').boundingBox())!.height).toBeLessThanOrEqual(210);
  await expect(map.getByText('free',{exact:true})).toBeHidden();
  await expect(map.getByText('OSRM',{exact:true})).toBeHidden();
  await map.getByRole('button',{name:'맵 뷰 닫기'}).click();
  await expect(map).toBeHidden();
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
    for(const state of ['sensor','map','settings','routes','summary','account']){
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
  expect(await page.locator('.ride-summary__story-detail').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
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

test('좌우 에지 띠는 20px·화면0에 붙고 안쪽 드래그로만 열린다',async({page})=>{
  const size=page.viewportSize()??{width:800,height:360};
  for(const side of ['left','right'] as const){
    await page.goto(`${preview}?state=ready`);
    const handle=page.locator(`.edge-panel-handle--${side}`);
    const r=(await handle.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(18);
    expect(r.width).toBeLessThanOrEqual(21);
    if(side==='left') expect(r.x).toBeLessThanOrEqual(0.5);
    else expect(r.x+r.width).toBeGreaterThanOrEqual(799);
    const x=side==='left'?10:790,y=155,dir=side==='left'?1:-1;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+dir*(side==='left'?36:80),y,{steps:8});
    const selector=side==='left'?'.menu-panel':'.map-view-sheet__panel';
    const previewBox=(await page.locator(selector).boundingBox())!;
    expect(previewBox.x+previewBox.width>0&&previewBox.x<size.width,`${side} partial reveal`).toBeTruthy();
    await page.mouse.move(x+dir*110,y,{steps:8});await page.mouse.up();
    const dialog=page.getByRole('dialog',{name:side==='left'?'메뉴':'맵 뷰',exact:true});
    await expect(dialog).toBeVisible();
    await expect.poll(async()=>{const b=(await page.locator(selector).boundingBox())!;return Math.max(-b.x,b.x+b.width-800);}).toBeLessThanOrEqual(1);
    const title=page.locator(side==='left'?'.menu-panel__brand':'.map-view-sheet__head-title');
    const h=(await title.boundingBox())!;
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
    await page.mouse.move(h.x+h.width/2-dir*100,h.y+h.height/2,{steps:8});await page.mouse.up();
    await expect(dialog).toHaveCount(0);
    await page.mouse.click(x,y);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

// Chief 고정14(2026-10-24): 측면 메뉴는 보이는 흰 반투명 반원 탭으로 연다 — 누르거나 탭에서 끌어서.
test('Chief 고정14 — 좌우 흰 반투명 반원 탭: 계기판 아래 빈 자리, 누르면·끌면 열린다',async({page})=>{
  for(const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const [state,expand] of [['ready',false],['riding',true],['paused',true]] as const){
      await page.goto(`${preview}?state=${state}&waypoints=3&long`);
      if(expand) await page.getByRole('button',{name:'경로 패널 펼치기'}).click();
      const g=await page.evaluate(()=>{
        const boxes=(sel:string)=>[...document.querySelectorAll(sel)].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
        const tabs=['left','right'].map(side=>{
          const tab=document.querySelector(`.edge-panel-tab--${side}`)!;
          const knob=tab.querySelector('.edge-panel-tab__knob')!;
          const t=tab.getBoundingClientRect(),k=knob.getBoundingClientRect();
          const hit=document.elementFromPoint(k.x+k.width/2,k.y+k.height/2);
          return {side,t:t.toJSON(),k:k.toJSON(),bg:getComputedStyle(knob).backgroundColor,hitOk:Boolean(hit?.closest(`.edge-panel-tab--${side}`))};
        });
        const others=boxes('.map-hud__tl,.route-dock__card,.route-minimap,.map-hud__tr,.ride-control-bar,.hud-ride-map-controls,.camera-view-menu__trigger,.hud-account').map(r=>r.toJSON());
        return {tabs,others,vw:innerWidth,vh:innerHeight};
      });
      for(const tab of g.tabs){
        const label=`${size.width}×${size.height} ${state} ${tab.side}`;
        expect(tab.k.width,label).toBeCloseTo(14,0);
        expect(tab.k.height,label).toBeCloseTo(48,0);
        expect(tab.t.width*tab.t.height,label).toBeGreaterThanOrEqual(28*64-1);
        expect(tab.bg,label).toBe('rgba(255, 255, 255, 0.78)');
        expect(tab.hitOk,label).toBe(true);
        if(tab.side==='left') expect(tab.k.x,label).toBeLessThanOrEqual(0.5);
        else expect(tab.k.x+tab.k.width,label).toBeGreaterThanOrEqual(g.vw-0.5);
        for(const o of g.others){
          const overlap=tab.k.x<o.right&&tab.k.right>o.left&&tab.k.y<o.bottom&&tab.k.bottom>o.top;
          expect(overlap,`${label} 탭이 다른 조작부·카드와 겹치지 않는다`).toBe(false);
        }
      }
    }
  }
  await page.setViewportSize({width:800,height:360});
  for(const side of ['left','right'] as const){
    const dialog=page.getByRole('dialog',{name:side==='left'?'메뉴':'맵 뷰',exact:true});
    await page.goto(`${preview}?state=ready`);
    await page.getByRole('button',{name:side==='left'?'메뉴 열기':'맵 뷰 열기',exact:true}).click();
    await expect(dialog,`${side} 누르면 열림`).toBeVisible();
    await page.goto(`${preview}?state=ready`);
    const k=(await page.locator(`.edge-panel-tab--${side} .edge-panel-tab__knob`).boundingBox())!;
    const x=k.x+k.width/2,y=k.y+k.height/2,dir=side==='left'?1:-1;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+dir*120,y,{steps:10});await page.mouse.up();
    await expect(dialog,`${side} 탭에서 끌면 열림`).toBeVisible();
    await expect(page.locator(`.edge-panel-tab--${side}`),'열리면 그 쪽 탭은 사라진다').toHaveCount(0);
  }
});

test('포커스 대안·짧은/반대 드래그 취소가 동작한다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  await page.getByRole('button',{name:'맵 뷰 설정',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'맵 뷰',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  for(const side of ['left','right'] as const){
    for(const movement of [{dx:24,dy:0},{dx:-24,dy:0},{dx:0,dy:24}]){
      const x=side==='left'?10:790,y=155;
      await page.mouse.move(x,y);await page.mouse.down();
      await page.mouse.move(x+(side==='left'?1:-1)*movement.dx,y+movement.dy,{steps:5});
      await page.waitForTimeout(200);
      await page.mouse.up();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  }
});

test('드래그 취소·화면 크기 변경 후 복구되며 중앙 지도는 가리지 않는다',async({page})=>{
  await page.goto(`${preview}?state=ready`);
  await page.evaluate(() => {
    document.addEventListener('pointerdown', (event) => {
      if ((event as PointerEvent).clientX >= window.innerWidth - 20) {
        document.body.setAttribute('data-audit-pointer', String((event as PointerEvent).pointerId));
      }
    }, true);
  });
  const x=790,y=155;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-30,y,{steps:5});
  const pointerId=Number(await page.evaluate(()=>document.body.getAttribute('data-audit-pointer')));
  await page.evaluate((id)=>{document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,pointerType:'mouse',bubbles:true}));},pointerId);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-30,y,{steps:5});
  await page.setViewportSize({width:844,height:390});await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'맵 뷰 설정',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'맵 뷰',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.audit-map').evaluate(el=>el.addEventListener('pointerdown',()=>el.setAttribute('data-audit-hit','yes')));
  await page.mouse.move(420,180);await page.mouse.down();await page.mouse.move(480,195,{steps:6});await page.mouse.up();
  await expect(page.locator('.audit-map')).toHaveAttribute('data-audit-hit','yes');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('경로 모달에서 세 출처를 전환해도 목록은 하나이며 닫으면 메뉴로 돌아온다', async ({page})=>{
  await page.goto(`${preview}?state=menu`);
  await page.getByRole('button',{name:'입문',exact:true}).click();
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
      const chip = page.locator('.lb-glance__chip');
      await expect(chip).toBeVisible();
      expect((await chip.innerText()).trim()).toBe('');
      const chipBox = await chip.boundingBox();
      expect(Math.abs(chipBox!.width - chipBox!.height)).toBeLessThanOrEqual(1);
      const radius = await chip.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
      expect(radius).toBeGreaterThanOrEqual(chipBox!.width / 2 - 1);
      await expect(chip.locator('svg')).toHaveCount(1);
      const chipLabel = await chip.getAttribute('aria-label');
      expect(chipLabel).toMatch(/위/);

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
      await expect(page.locator('.hud-ride-map-controls__zoom').first()).toBeVisible();
    }
    if (evidenceDir) {
      await page.goto(`${preview}?state=riding`);
      await page.screenshot({ path: path.join(evidenceDir, 'riding-800x360.png'), animations: 'disabled' });
    }
  });
});

// Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
// 2026-10-24 Chief: 대기 화면은 센서·접기가 한 줄 — 접으면 그 한 줄(센서 + ›)만 남는다(withSensor).
async function assertCollapsedRouteDockChip(
  page: import('@playwright/test').Page,
  { withSensor = false }: { withSensor?: boolean } = {},
) {
  const card = page.locator('.route-dock__card');
  const caret = page.getByRole('button', { name: '경로 패널 펼치기' });
  await expect(caret).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  expect(cardBox.width).toBeGreaterThanOrEqual(28);
  expect(cardBox.width).toBeLessThanOrEqual(withSensor ? 140 : 44);
  if (withSensor) {
    const sensorBox = (await page.locator('.route-dock__head .hud-cadence').boundingBox())!;
    const caretBox = (await caret.boundingBox())!;
    expect(Math.abs(sensorBox.y + sensorBox.height / 2 - (caretBox.y + caretBox.height / 2))).toBeLessThanOrEqual(2);
    expect(sensorBox.x).toBeLessThan(caretBox.x);
  }
  expect(cardBox.height).toBeGreaterThanOrEqual(28);
  expect(cardBox.height).toBeLessThanOrEqual(44);

  const geometry = await page.evaluate(() => {
    const cardEl = document.querySelector('.route-dock__card')!;
    const caretEl = document.querySelector('.route-dock__caret')!;
    const cardR = cardEl.getBoundingClientRect();
    const caretR = caretEl.getBoundingClientRect();
    const cx = caretR.x + caretR.width / 2;
    const cy = caretR.y + caretR.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const caretStyle = getComputedStyle(caretEl);
    const cardStyle = getComputedStyle(cardEl);
    const parseRgb = (s: string) => {
      const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
    };
    const caretRgb = parseRgb(caretStyle.color);
    const caretBrightness = (caretRgb[0]! + caretRgb[1]! + caretRgb[2]!) / 3;
    const bg =
      caretStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
        ? cardStyle.backgroundColor
        : caretStyle.backgroundColor;
    const bgRgb = parseRgb(bg);
    const inViewport =
      caretR.left >= 0 &&
      caretR.top >= 0 &&
      caretR.right <= window.innerWidth &&
      caretR.bottom <= window.innerHeight;
    const caretInsideCard =
      caretR.left >= cardR.left &&
      caretR.top >= cardR.top &&
      caretR.right <= cardR.right &&
      caretR.bottom <= cardR.bottom;
    const hitOk = hit === caretEl || caretEl.contains(hit);
    return {
      inViewport,
      caretInsideCard,
      hitOk,
      bgRgb,
      caretBrightness,
    };
  });
  expect(geometry.inViewport).toBe(true);
  expect(geometry.caretInsideCard).toBe(true);
  expect(geometry.hitOk).toBe(true);
  expect(geometry.bgRgb).toEqual([255, 255, 255]);
  expect(geometry.caretBrightness).toBeLessThan(100);
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

  test('주행·일시정지는 접힌 상태로 시작하고 펼치면 출발·도착이 보이며 미니맵과 너비가 같다', async ({ page }) => {
    const evidenceDir = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? path.resolve(
      fileURLToPath(import.meta.url),
      '../../../../document/ops/20261023-ui-redesign/evidence/riding-address-dock-collapse',
    );
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
    await assertCollapsedRouteDockChip(page, { withSensor: true });
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
        glyphButtons: [...document.querySelectorAll('.route-dock__remove,.route-dock__caret')].map((b) => ({
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
    expect(look.glyphButtons.length).toBeGreaterThanOrEqual(3);
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
      const caret = r('.route-dock__caret');
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

const entryCardHistoryEvidence = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../../document/ops/20261023-ui-redesign/evidence/inline-history',
);

test('Chief 고정10 — 주행 기록은 계정 패널 안에서 인라인 펼침·접기를 유지한다', async ({ page }) => {
  const outDir = process.env.ENTRY_CARD_HISTORY_EVIDENCE ?? entryCardHistoryEvidence;
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
