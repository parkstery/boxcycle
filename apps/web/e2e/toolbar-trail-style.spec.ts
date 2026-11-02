import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
const evidence = process.env.TOOLBAR_TRAIL_EVIDENCE;
test.use({ reducedMotion: 'reduce' });
for (const size of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  // Chief 11-02 v4: 오른쪽 아래 2열 4줄 묶음 — 흰 원(구름 아님), 오른쪽 끝·아래 8px, 계정 버튼(오른쪽 위, 넓은 구름) 아래.
  test(`묶음 대기·계정 구석·클릭 ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready&long=1`);
    const style = page.locator('.hud-ride-map-controls__style');
    const plus = page.getByRole('button',{name:'줌 확대',exact:true});
    const minus = page.getByRole('button',{name:'줌 축소',exact:true});
    const account = page.getByRole('button',{name:'사용자 정보',exact:true});
    await expect(style).toBeVisible();
    const layout = await page.evaluate(() => ({
      account:document.querySelector('.hud-account')!.getBoundingClientRect().toJSON(),
      rail:document.querySelector('.map-hud__rail')!.getBoundingClientRect().toJSON(),
      buttons:[...document.querySelectorAll<HTMLElement>('.map-hud__rail button')].map(el=>({w:el.offsetWidth,h:el.offsetHeight})),
    }));
    expect(layout.account.height).toBe(32);
    expect(layout.account.right).toBeCloseTo(size.width,0);
    expect(layout.account.y).toBe(0);
    // 주행 전: 지도 스타일·＋·－·INT·순위·▶ (카메라·⏹ 칸은 빈 칸)
    expect(layout.buttons).toHaveLength(6);
    expect(layout.rail.top).toBeGreaterThanOrEqual(layout.account.bottom);
    expect(layout.rail.right).toBeCloseTo(size.width-8,0);
    expect(layout.rail.bottom).toBeCloseTo(size.height-8,0);
    for (const b of layout.buttons) { expect(b.w).toBe(b.h); expect(b.w).toBeLessThanOrEqual(64); expect(b.w).toBeGreaterThanOrEqual(44); }
    const looks=await page.evaluate(()=>[...document.querySelectorAll('.hud-ride-map-controls button')].map(el=>({
      before:getComputedStyle(el,'::before').display,
      radius:getComputedStyle(el).borderTopLeftRadius,
      background:getComputedStyle(el).backgroundColor,
    })));
    // 11-02 Chief: 묶음 버튼은 흰 원 — 구름 마스크(::before)는 끈다. 계정은 넓은 구름 그대로.
    for(const look of looks){expect(look.before).toBe('none');expect(look.radius).toBe('50%');expect(look.background).toBe('rgba(255, 255, 255, 0.96)');}
    expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.hud-account')!,'::before').maskImage)).toContain("viewBox='0 0 120 32'");
    // 버튼 가운데는 자기 버튼 — 옆 버튼·순위 목록이 가로채지 않는다.
    const hits=await page.evaluate(()=>[...document.querySelectorAll('.map-hud__rail button')].map(el=>{
      const r=el.getBoundingClientRect();
      return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===el;
    }));
    expect(hits.every(Boolean)).toBe(true);
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

  // Chief 11-02 v4: 주행·일시정지에도 계정은 오른쪽 위에 보이고, 묶음 1줄 [카메라][지도 스타일]은 모든 폰에서 보인다.
  // 카메라 메뉴는 묶음 왼쪽 8px, 묶음 아래 끝에서 위로 펼쳐 낮은 폰에서도 화면 안.
  for(const stage of ['riding','paused']) test(`묶음 주행·계정 보임·카메라 메뉴 ${size.width} ${stage}`,async({page})=>{
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=${stage}&long=1`);
    await expect(page.locator('.camera-view-menu__trigger')).toBeVisible();
    await expect(page.locator('.hud-account')).toBeVisible();
    await expect(page.locator('.hud-ride-map-controls__style')).toBeVisible();
    const rail=await page.evaluate(()=>({
      box:document.querySelector('.map-hud__rail')!.getBoundingClientRect().toJSON(),
      buttons:[...document.querySelectorAll('.map-hud__rail button')].filter(el=>el.getClientRects().length>0&&!el.matches('.ride-control-bar__more')).map(el=>el.getBoundingClientRect().toJSON()),
      metrics:document.querySelector('.hud-metrics__capsule')!.getBoundingClientRect().toJSON(),
    }));
    expect(rail.buttons).toHaveLength(stage==='paused'?8:7);
    for(const b of rail.buttons) expect(Math.min(b.right,rail.metrics.right)-Math.max(b.left,rail.metrics.left)>1&&Math.min(b.bottom,rail.metrics.bottom)-Math.max(b.top,rail.metrics.top)>1).toBe(false);
    expect(rail.box.bottom).toBeLessThanOrEqual(size.height);
    await expect(page.locator('.edge-panel-tab--right')).toHaveCount(0);
    await page.getByRole('button',{name:/카메라 메뉴/}).click();
    const panel=page.locator('.camera-view-menu__panel');
    await expect(panel).toBeVisible();
    const menu=await panel.evaluate(el=>{const r=el.getBoundingClientRect();const t=document.querySelector('.camera-view-menu__trigger')!.getBoundingClientRect();const g=document.querySelector('.map-hud__rail')!.getBoundingClientRect();return {gap:t.left-r.right,bottom:r.bottom-g.bottom,top:r.top,left:r.left};});
    expect(menu.gap).toBe(8);
    expect(Math.abs(menu.bottom)).toBeLessThanOrEqual(1);
    expect(menu.top).toBeGreaterThanOrEqual(0);
    expect(menu.left).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    if(evidence)await page.screenshot({path:path.join(evidence,`toolbar-${size.width}-${stage}.png`)});
  });
}
