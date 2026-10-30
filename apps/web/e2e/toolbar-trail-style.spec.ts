import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
const evidence = process.env.TOOLBAR_TRAIL_EVIDENCE;
test.use({ reducedMotion: 'reduce' });
for (const size of [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}]) {
  test(`도구A 그룹·분리·클릭 ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready&long=1`);
    const style = page.locator('.hud-ride-map-controls__style');
    const plus = page.getByRole('button',{name:'줌 확대',exact:true});
    const minus = page.getByRole('button',{name:'줌 축소',exact:true});
    const account = page.getByRole('button',{name:'사용자 정보',exact:true});
    await expect(style).toBeVisible();
    const layout = await page.evaluate(() => {
      const box=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();
      return {group:box('.hud-ride-map-controls'),account:box('.hud-account'),
        buttons:[...document.querySelectorAll('.hud-ride-map-controls button')].map(el=>el.getBoundingClientRect().toJSON()),
        name:document.querySelector('.hud-account__name')!.textContent};
    });
    expect(layout.group.height).toBe(32);
    expect(layout.account.height).toBe(32);
    expect(layout.account.x-layout.group.right).toBe(8);
    expect(layout.account.right).toBeCloseTo(size.width,0);
    expect(layout.account.y).toBe(0);
    expect(layout.group.y).toBe(0);
    const clouds=await page.evaluate(()=>[...document.querySelectorAll('.hud-ride-map-controls button,.hud-account')].map(el=>({
      mask:getComputedStyle(el,'::before').maskImage,
      background:getComputedStyle(el).backgroundColor,
      border:getComputedStyle(el).borderTopWidth,
    })));
    // 10-30 Chief: 정사각 버튼(지도·±)은 정사각 구름, 계정은 넓은 구름 — 넓은 구름을 눌러 넣으면 혹이 뾰족해진다.
    clouds.forEach((cloud,i)=>expect(cloud.mask).toContain(i<3?"viewBox='0 0 32 32'":"viewBox='0 0 120 32'"));
    for(const cloud of clouds){expect(cloud.mask).toContain('data:image/svg+xml');expect(cloud.background).toBe('rgba(0, 0, 0, 0)');expect(cloud.border).toBe('0px');}
    for(const b of layout.buttons) expect(b.width).toBe(32);
    // 셀 경계에서도 옆 버튼의 투명 타깃이 클릭을 가로채지 않는다.
    const hits=await page.evaluate(()=>[...document.querySelectorAll('.hud-ride-map-controls button')].map(el=>{
      const r=el.getBoundingClientRect();return [r.left+2,r.right-2].every(x=>document.elementFromPoint(x,r.top+r.height/2)?.closest('button')===el);
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

  for (const riding of [false,true]) test(`Trail 한줄·표시행·끝행·권한 ${size.width} ${riding?'주행':'대기'}`, async ({page})=>{
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready&trailPreview=1${riding?'&trailRiding=1':''}`);
    await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
    const list=page.locator('.trail-hub__list');
    await expect(list.locator('li')).toHaveCount(12);
    await page.locator('.menu-panel').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
    const layout=await list.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const rows=[...el.querySelectorAll('li')].map(li=>li.getBoundingClientRect());
      return {height:r.height,visible:rows.filter(b=>b.top>=r.top-1&&b.bottom<=r.bottom+1).length,
        overflow:el.scrollWidth-el.clientWidth,rowHeight:rows[0].height};
    });
    expect(layout.visible).toBeGreaterThanOrEqual(size.height>=360?8:5);
    expect(layout.overflow).toBe(0);
    expect(layout.rowHeight).toBe(26);
    if(riding){
      await expect(list.locator('[aria-current="true"]')).toHaveCount(1);
      for(const button of await list.getByRole('button').all()) await expect(button).toBeDisabled();
      await page.getByRole('button',{name:'비공개',exact:true}).click();
      await expect(page.locator('#trail-preview-calls')).toHaveAttribute('data-visibility','private');
    } else {
      await expect(page.getByRole('group',{name:'Trail 공개 설정'})).toHaveCount(0);
      await list.getByRole('button').first().click();
      await expect(page.locator('#trail-preview-calls')).toHaveAttribute('data-joined','preview-trail-0');
    }
    if(evidence){
      await fs.mkdir(evidence,{recursive:true});
      await page.screenshot({path:path.join(evidence,`trail-${size.width}-${riding?'riding':'idle'}.png`)});
      await fs.writeFile(path.join(evidence,`trail-${size.width}-${riding?'riding':'idle'}.json`),JSON.stringify(layout,null,2));
    }
    await list.locator('li').last().scrollIntoViewIfNeeded();
    const accessible=await list.locator('li').last().evaluate(el=>{
      const row=el.getBoundingClientRect();const list=el.parentElement!.getBoundingClientRect();return row.top>=list.top-1&&row.bottom<=list.bottom+1;
    });
    expect(accessible).toBe(true);
  });

  for(const stage of ['riding','paused']) test(`주행 도구·긴닉네임·카메라 비겹침 ${size.width} ${stage}`,async({page})=>{
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=${stage}&long=1`);
    await expect(page.locator('.hud-account')).toBeVisible();
    await expect(page.locator('.camera-view-menu__trigger')).toBeVisible();
    const groups=await page.evaluate(()=>{
      const selectors=['.hud-account','.hud-ride-map-controls','.camera-view-menu','.hud-metrics__capsule'];
      return selectors.map(selector=>({selector,rect:document.querySelector(selector)!.getBoundingClientRect().toJSON()}));
    });
    for(const g of groups){ expect(g.rect.x).toBeGreaterThanOrEqual(0);expect(g.rect.right).toBeLessThanOrEqual(size.width+1); }
    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const a=groups[i].rect,b=groups[j].rect;
      expect(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1,`${groups[i].selector} / ${groups[j].selector}`).toBe(false);
    }
    const name=page.locator('.hud-account__name');
    expect(await name.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.getByRole('button',{name:/카메라 메뉴/}).click();
    await expect(page.locator('.camera-view-menu__panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.camera-view-menu__panel')).toHaveCount(0);
    if(evidence)await page.screenshot({path:path.join(evidence,`toolbar-${size.width}-${stage}.png`)});
  });
}
