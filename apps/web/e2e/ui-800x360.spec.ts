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
      expect(dimensions.rowHeight).toBeLessThanOrEqual(29);
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
