import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
const evidence = process.env.TOOLBAR_TRAIL_EVIDENCE;
test.use({ reducedMotion: 'reduce' });
for (const size of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  // Chief 11-02 D1·D2: 오른쪽 조작 레일 — 64px 정사각 구름 세로 한 줄, 화면 끝에서 26px(반달 탭 자리), 간격 8px.
  // 대기 화면은 계정이 위 구석(고정43)이고 레일은 그 아래 8px 부터.
  test(`레일 대기·계정 구석·클릭 ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready&long=1`);
    const style = page.locator('.hud-ride-map-controls__style');
    const plus = page.getByRole('button',{name:'줌 확대',exact:true});
    const minus = page.getByRole('button',{name:'줌 축소',exact:true});
    const account = page.getByRole('button',{name:'사용자 정보',exact:true});
    await expect(style).toBeVisible();
    const layout = await page.evaluate(() => ({
      account:document.querySelector('.hud-account')!.getBoundingClientRect().toJSON(),
      buttons:[...document.querySelectorAll('.map-hud__rail button')].map(el=>el.getBoundingClientRect().toJSON()),
    }));
    expect(layout.account.height).toBe(32);
    expect(layout.account.right).toBeCloseTo(size.width,0);
    expect(layout.account.y).toBe(0);
    expect(layout.buttons).toHaveLength(3);
    expect(layout.buttons[0].y).toBe(layout.account.bottom+8);
    layout.buttons.forEach((b,i)=>{
      expect([b.width,b.height]).toEqual([64,64]);
      expect(b.right).toBeCloseTo(size.width-26,0);
      if(i) expect(b.y-layout.buttons[i-1].bottom).toBe(8);
    });
    expect(layout.buttons[2].bottom).toBeLessThanOrEqual(size.height);
    const clouds=await page.evaluate(()=>[...document.querySelectorAll('.hud-ride-map-controls button,.hud-account')].map(el=>({
      mask:getComputedStyle(el,'::before').maskImage,
      background:getComputedStyle(el).backgroundColor,
      border:getComputedStyle(el).borderTopWidth,
    })));
    // 10-30 Chief: 정사각 버튼(지도·±)은 정사각 구름, 계정은 넓은 구름 — 넓은 구름을 눌러 넣으면 혹이 뾰족해진다.
    clouds.forEach((cloud,i)=>expect(cloud.mask).toContain(i===0?"viewBox='0 0 120 32'":"viewBox='0 0 32 32'"));
    for(const cloud of clouds){expect(cloud.mask).toContain('data:image/svg+xml');expect(cloud.background).toBe('rgba(0, 0, 0, 0)');expect(cloud.border).toBe('0px');}
    // 버튼 네 모서리 안쪽이 모두 자기 버튼 — 옆 버튼·반달 탭이 가로채지 않는다.
    const hits=await page.evaluate(()=>[...document.querySelectorAll('.map-hud__rail button')].map(el=>{
      const r=el.getBoundingClientRect();
      return [[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2]].every(([x,y])=>document.elementFromPoint(x,y)?.closest('button')===el);
    }));
    expect(hits).toEqual([true,true,true]);
    await style.click();
    await expect(style.locator('svg')).toHaveAttribute('data-map-style','outdoors');
    await style.click();
    await expect(style.locator('svg')).toHaveAttribute('data-map-style','satellite');
    await plus.click(); await minus.click();
    await expect(page.locator('#toolbar-preview-calls')).toHaveAttribute('data-zoom-in','1');
    await expect(page.locator('#toolbar-preview-calls')).toHaveAttribute('data-zoom-out','1');
    if(evidence) {
      await fs.mkdir(evidence,{recursive:true});
      await page.screenshot({path:path.join(evidence,`toolbar-${size.width}.png`)});
    }
    await account.click();
    await expect(page.getByRole('dialog',{name:'사용자 정보',exact:true})).toBeVisible();
  });

  // Chief 11-02: Trail 목록은 메뉴 패널 밖, 지도 오른쪽 목록의 「Trail」 탭(순위와 같은 자리·같은 줄)으로. 10줄, 넘치면 「외 N개」.
  for (const riding of [false,true]) test(`Trail 탭 공유·10줄·권한 ${size.width} ${riding?'주행':'대기'}`, async ({page})=>{
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=${riding?'riding':'ready'}&trailPreview=1${riding?'&trailRiding=1':''}`);
    // 낮은 폰 주행 중엔 왼쪽 반달 탭을 RouteDock 머리가 가린다(기존 결함, 배치 계획 3단계에서 정리). 여기선 키보드로 연다.
    const menuButton=page.getByRole('button',{name:'메뉴 열기',exact:true});
    await menuButton.focus();
    await page.keyboard.press('Enter');
    const show=page.locator('.trail-hub__show-list');
    await expect(show).toContainText('지금 달리는 Trail');
    await expect(show).toContainText('12개');
    await expect(page.locator('.menu-panel .trail-hub__list')).toHaveCount(0);
    if(riding){
      await page.getByRole('button',{name:'비공개',exact:true}).click();
      await expect(page.locator('#trail-preview-calls')).toHaveAttribute('data-visibility','private');
    } else {
      await expect(page.getByRole('group',{name:'Trail 공개 설정'})).toHaveCount(0);
    }
    await show.click();
    const panel=page.locator('#lb-glance-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-label','지금 달리는 Trail');
    await expect(panel.getByRole('tab',{name:/^Trail/})).toHaveAttribute('aria-selected','true');
    const list=panel.locator('.lb-glance__list--trail');
    await expect(list.locator('li')).toHaveCount(10);
    await expect(panel.locator('.lb-glance__footer')).toHaveText('외 2개');
    const layout=await list.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const rows=[...el.querySelectorAll('li')].map(li=>li.getBoundingClientRect());
      return {visible:rows.filter(b=>b.top>=r.top-1&&b.bottom<=r.bottom+1&&b.bottom<=innerHeight).length,
        overflow:el.scrollWidth-el.clientWidth,names:[...el.querySelectorAll('.lb-glance__name')].map(n=>n.scrollWidth<=n.clientWidth+1||getComputedStyle(n).textOverflow==='ellipsis')};
    });
    expect(layout.overflow).toBe(0);
    expect(layout.names.every(Boolean)).toBe(true);
    if(riding){
      // 주행 중: 10줄이 모두 화면 안, 내 Trail 은 맨 위 파란 줄, 합류 버튼 없음.
      expect(layout.visible).toBe(10);
      await expect(list.locator('[aria-current="true"]')).toHaveCount(1);
      await expect(list.locator('li').first()).toHaveAttribute('aria-current','true');
      await expect(list.getByRole('button')).toHaveCount(0);
    } else {
      // 주행 전 지도도 10줄 모두 화면 안(11-02 Chief: 사라진 우하단 시계·버튼 자리 예약 제거).
      expect(layout.visible).toBe(10);
      await list.getByRole('button').first().click();
      await expect(page.locator('#trail-preview-calls')).toHaveAttribute('data-joined','preview-trail-0');
    }
    await panel.getByRole('tab',{name:'순위',exact:true}).click();
    await expect(panel.locator('.lb-glance__list--trail')).toHaveCount(0);
    await expect(panel).toHaveAttribute('aria-label',riding?'주행 중 순위':'이번 주 순위');
    // 11-02: 주행 중 점(●)이 있는 줄도 이름이 줄 가운데 — 점 칸의 글자 줄 높이가 13px 줄을 밀어 다음 줄과 겹쳤다.
    const offsets=await panel.evaluate(el=>[...el.querySelectorAll('.lb-glance__row')].map(r=>{
      const b=r.getBoundingClientRect(),n=r.querySelector('.lb-glance__name')!.getBoundingClientRect();
      return Math.abs(n.top+n.height/2-(b.top+b.height/2));
    }));
    expect(offsets.length).toBeGreaterThan(0);
    for(const o of offsets) expect(o).toBeLessThanOrEqual(1);
    if(evidence){
      await fs.mkdir(evidence,{recursive:true});
      await panel.getByRole('tab',{name:/^Trail/}).click();
      await page.screenshot({path:path.join(evidence,`trail-${size.width}-${riding?'riding':'idle'}.png`)});
    }
  });

  // Chief 11-02: 주행·일시정지 중엔 계정을 숨기고 레일이 위 8px 부터 [카메라][지도 스타일][＋][－].
  // 네 칸(8+64×4+8×3+아래 24 = 312px)이 안 들어가는 낮은 폰은 지도 스타일을 빼고 ⚙ 주행 설정 창에서 바꾼다.
  for(const stage of ['riding','paused']) test(`레일 주행·계정 숨김·카메라 메뉴 ${size.width} ${stage}`,async({page})=>{
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=${stage}&long=1`);
    await expect(page.locator('.camera-view-menu__trigger')).toBeVisible();
    await expect(page.locator('.hud-account')).toHaveCount(0);
    const fourCells = size.height >= 312;
    await expect(page.locator('.hud-ride-map-controls__style')).toBeVisible({visible:fourCells});
    const rail=await page.evaluate(()=>({
      buttons:[...document.querySelectorAll('.map-hud__rail button')].filter(el=>el.getClientRects().length>0).map(el=>el.getBoundingClientRect().toJSON()),
      metrics:document.querySelector('.hud-metrics__capsule')!.getBoundingClientRect().toJSON(),
      knob:document.querySelector('.edge-panel-tab--right .edge-panel-tab__knob')!.getBoundingClientRect().toJSON(),
    }));
    expect(rail.buttons).toHaveLength(fourCells?4:3);
    expect(rail.buttons[0].y).toBe(8);
    rail.buttons.forEach((b,i)=>{
      expect([b.width,b.height]).toEqual([64,64]);
      expect(b.right).toBeCloseTo(size.width-26,0);
      if(i) expect(b.y-rail.buttons[i-1].bottom).toBe(8);
      expect(Math.min(b.right,rail.metrics.right)-Math.max(b.left,rail.metrics.left)>1&&Math.min(b.bottom,rail.metrics.bottom)-Math.max(b.top,rail.metrics.top)>1).toBe(false);
    });
    expect(rail.buttons.at(-1)!.bottom).toBeLessThanOrEqual(size.height-24);
    // 반달 탭의 보이는 손잡이는 레일 오른쪽에 그대로 남아 눌린다.
    expect(rail.knob.left).toBeGreaterThanOrEqual(rail.buttons[0].right);
    expect(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.edge-panel-tab--right')),{x:rail.knob.left+rail.knob.width/2,y:rail.knob.top+rail.knob.height/2})).toBe(true);
    await page.getByRole('button',{name:/카메라 메뉴/}).click();
    const panel=page.locator('.camera-view-menu__panel');
    await expect(panel).toBeVisible();
    const menu=await panel.evaluate(el=>{const r=el.getBoundingClientRect();const t=document.querySelector('.camera-view-menu__trigger')!.getBoundingClientRect();return {gap:t.left-r.right,top:r.top-t.top,bottom:r.bottom,left:r.left};});
    expect(menu.gap).toBe(8);
    expect(menu.top).toBe(0);
    expect(menu.left).toBeGreaterThanOrEqual(0);
    expect(menu.bottom).toBeLessThanOrEqual(size.height);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    if(!fourCells){
      // 주행·일시정지 모두 접힌 64px 줄의 ⚙ 주행 설정에서 바꾼다(3단계: 일시정지에도 ⚙).
      await page.getByRole('button',{name:'주행 설정',exact:true}).click();
      const moved=page.locator('.ride-settings-panel__map-style-btn');
      await expect(moved).toBeVisible();
      await moved.click();
      await expect(page.locator('.hud-ride-map-controls__style svg')).toHaveAttribute('data-map-style','outdoors');
    }
    if(evidence)await page.screenshot({path:path.join(evidence,`toolbar-${size.width}-${stage}.png`)});
  });
}
