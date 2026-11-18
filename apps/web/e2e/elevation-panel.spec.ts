import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const preview = '/scripts/ui-800x360/preview.html';
const sizes = [{width:800,height:360},{width:736,height:300},{width:699,height:273},{width:667,height:300}];
const evidence = process.env.ELEVATION_PANEL_EVIDENCE_DIR;
async function box(page: Page) { return (await page.locator('.elevation-overlay').boundingBox())!; }
async function checkClearance(page: Page) {
  const result = await page.evaluate(() => {
    const panel = document.querySelector('.elevation-overlay')!;
    const r = panel.getBoundingClientRect();
    const overlapping = [...document.querySelectorAll('.route-minimap, .route-dock__card, .ride-interval-hud, .map-hud__rail, .hud-coach')]
      .filter(el => { const b=el.getBoundingClientRect(); return b.width && b.height && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; })
      .map(el => el.className);
    return { overlapping, inside:r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight,
      width:r.width, height:r.height, compact:panel.classList.contains('elevation-overlay--folded'), overflow:panel.scrollWidth>panel.clientWidth };
  });
  expect(result.overlapping).toEqual([]);
  expect(result.inside).toBe(true);
  expect(result.width).toBeGreaterThan(result.compact ? 44 : 220);
  expect(result.height).toBeLessThanOrEqual(88);
  expect(result.overflow).toBe(false);
}
for (const size of sizes) {
  test(`표고 고정82: 미니맵·경로·인터벌·버튼 비겹침 ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=riding&elevation=ready&interval&intervalMs=330000`);
    await expect(page.getByRole('img',{name:'경로 표고 그래프'})).toBeVisible();
    await checkClearance(page);
    const initial = await box(page);
    if (evidence) { fs.mkdirSync(evidence,{recursive:true}); await page.screenshot({path:path.join(evidence,`open-${size.width}.png`)}); }
    await page.getByRole('button',{name:'미니맵 접기',exact:true}).click();
    await checkClearance(page);
    expect(await box(page)).toEqual(initial);
    await page.getByRole('button',{name:'경로 패널 펼치기',exact:true}).click();
    await checkClearance(page);
    expect(await box(page)).toEqual(initial);
    await page.getByRole('button',{name:'경로 패널 접기',exact:true}).click();
    await expect(page.locator('body')).toHaveAttribute('data-ride-controls','hidden',{timeout:9000});
    expect(await box(page)).toEqual(initial);
    await page.mouse.click(size.width/2,85);
    await expect(page.locator('body')).not.toHaveAttribute('data-ride-controls','hidden');
    expect(await box(page)).toEqual(initial);
    await page.getByRole('button',{name:'표고 접기',exact:true}).click();
    await expect(page.getByRole('img',{name:'경로 표고 그래프'})).toBeHidden();
    const folded = await box(page);
    expect(folded.x).toBe(initial.x);
    expect(folded.width).toBeLessThan(initial.width);
    expect(folded.width).toBeLessThan(200);
    expect(folded.height).toBe(44);
    await expect(page.locator('.elevation-overlay__current')).toContainText('현재');
    const title = (await page.locator('.elevation-overlay__title').boundingBox())!;
    const current = (await page.locator('.elevation-overlay__current').boundingBox())!;
    expect(current.x - title.x - title.width).toBeLessThanOrEqual(10);
    if (evidence) await page.screenshot({path:path.join(evidence,`folded-${size.width}.png`)});
    const toggle = page.getByRole('button',{name:'표고 펼치기',exact:true});
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button',{name:'표고 접기',exact:true})).toHaveAttribute('aria-expanded','true');
    expect(await box(page)).toEqual(initial);
    if (evidence) await page.screenshot({path:path.join(evidence,`closed-map-${size.width}.png`)});
  });
}

test('표고: 하단 현재 값·시종점 마커, 거리 중복 없음·지도 터치 통과', async ({page}) => {
  await page.setViewportSize(sizes[0]);
  await page.goto(`${preview}?state=paused&elevation=ready`);
  await expect(page.locator('.elevation-overlay__current')).toHaveText(/^현재 \d+\.\d m$/);
  await expect(page.getByLabel('현재 표고',{exact:true})).toHaveText(/^현재 \d+\.\d m$/);
  await expect(page.locator('.elevation-overlay__header .elevation-overlay__current')).toHaveCount(0);
  await expect(page.locator('.elevation-overlay')).not.toContainText('km');
  await expect(page.locator('.elevation-overlay__distance')).toHaveCount(0);
  await expect(page.getByRole('img',{name:'표고 출발점',exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'표고 도착점',exact:true})).toBeVisible();
  const endpoints = await page.evaluate(() => {
    const panel=document.querySelector('.elevation-overlay')!;
    const plot=panel.querySelector('.elevation-overlay__svg') as SVGSVGElement;
    const line=panel.querySelector('.elevation-overlay__line') as SVGPolylineElement;
    const first=line.points.getItem(0), last=line.points.getItem(line.points.numberOfItems-1);
    const rect=plot.getBoundingClientRect();
    const start=panel.querySelector('.route-minimap__endpoint--start')!;
    const startRect=start.getBoundingClientRect();
    const pole=panel.querySelector('.route-minimap__goal-pole')!;
    const poleRect=pole.getBoundingClientRect();
    const miniStart=document.querySelector('.route-minimap .route-minimap__endpoint--start')!;
    const colors=(root:Element)=>[...root.querySelectorAll('.route-minimap__goal-cloth rect:not(.route-minimap__goal-frame)')].map(el=>el.getAttribute('fill'));
    return {startGap:Math.hypot(startRect.x+startRect.width/2-(rect.x+first.x/420*rect.width),startRect.y+startRect.height/2-(rect.y+first.y/100*rect.height)),
      endGap:Math.hypot(poleRect.x-(rect.x+last.x/420*rect.width),poleRect.bottom-(rect.y+last.y/100*rect.height)),
      startFill:getComputedStyle(start).fill,miniStartFill:getComputedStyle(miniStart).fill,
      flagColors:colors(panel),miniFlagColors:colors(document.querySelector('.route-minimap')!),
      flagHeight:poleRect.height};
  });
  expect(endpoints.startGap).toBeLessThan(.5);
  expect(endpoints.endGap).toBeLessThan(.5);
  expect(endpoints.startFill).toBe('rgb(22, 163, 74)');
  expect(endpoints.startFill).toBe(endpoints.miniStartFill);
  expect(endpoints.flagColors).toHaveLength(6);
  expect(endpoints.flagColors).toEqual(endpoints.miniFlagColors);
  expect(endpoints.flagHeight).toBeCloseTo(13,1);
  const surface = await page.locator('.elevation-overlay').evaluate(el => {
    const css=getComputedStyle(el);
    return {background:css.backgroundColor,border:css.borderTopWidth,shadow:css.boxShadow};
  });
  expect(surface).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none'});
  const scan = await page.evaluate(() => {
    const panel=document.querySelector('.elevation-overlay')!;
    const plot=panel.querySelector('.elevation-overlay__plot')!.getBoundingClientRect();
    const marker=panel.querySelector('.elevation-overlay__marker')!.getBoundingClientRect();
    const toggle=panel.querySelector('button')!.getBoundingClientRect();
    const hit=document.elementFromPoint(plot.x+plot.width/2,plot.y+plot.height/2);
    return { blocks:!!hit && panel.contains(hit), toggle:{width:toggle.width,height:toggle.height},
      markerInside:marker.x>=plot.x-6 && marker.right<=plot.right+6 && marker.y>=plot.y-6 && marker.bottom<=plot.bottom+6 };
  });
  expect(scan.blocks).toBe(false); expect(scan.markerInside).toBe(true);
  expect(scan.toggle).toEqual({width:44,height:44});
  await checkClearance(page);
});
for (const [state,message] of [['loading','고도 계산 중…'],['error','고도 데이터를 불러오지 못했습니다.'],['quota','표고 요청 한도에 도달했습니다. 나중에 다시 시도해 주세요.'],['empty','고도 데이터 없음']]) {
  test(`표고 ${state}: 작은 표시만 유지, 눌러야 사유 표시`, async ({page}) => {
    await page.setViewportSize(sizes[2]);
    await page.goto(`${preview}?state=paused&elevation=${state}`);
    await expect(page.getByRole('status').filter({hasText:message})).toBeHidden();
    await expect(page.locator('.elevation-overlay__current')).toHaveText(state==='loading' ? '···' : '—');
    expect((await box(page)).height).toBe(44);
    await expect(page.getByRole('img',{name:'경로 표고 그래프'})).toHaveCount(0);
    await checkClearance(page);
    if (evidence) { fs.mkdirSync(evidence,{recursive:true}); await page.screenshot({path:path.join(evidence,`status-${state}.png`)}); }
    await page.getByRole('button',{name:'표고 펼치기',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:message})).toBeVisible();
    if (evidence) await page.screenshot({path:path.join(evidence,`detail-${state}.png`)});
    await page.getByRole('button',{name:'표고 접기',exact:true}).click();
    await expect(page.getByRole('button',{name:'표고 펼치기',exact:true})).toBeVisible();
  });
}

async function isolateElevationStore(page: Page) {
  // 실제 훅·수동 재시도를 검증하되 Firestore 읽기/쓰기와 외부 HTTP는 모두 격리한다.
  await page.route('**/src/services/routeElevationStore.ts*', route => route.fulfill({
    contentType:'application/javascript',
    body:'export const firestoreElevationStore = { read: async () => null, write: async () => {} };',
  }));
}
test('표고 실제 훅: 실패는 자동 재요청하지 않고 수동 재시도 후 그래프 표시', async ({page}) => {
  await isolateElevationStore(page);
  let calls=0;
  let release!: () => void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('https://api.open-meteo.com/v1/elevation?*', async route => {
    calls++;
    if (calls===1) { await route.fulfill({status:503,body:'unavailable'}); return; }
    await gate;
    const count=new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await route.fulfill({json:{elevation:Array.from({length:count},(_,i)=>40+i)}});
  });
  await page.goto(`${preview}?state=paused&elevation=ready&elevationFetch`);
  await expect(page.locator('.elevation-overlay__current')).toHaveText('—');
  await page.waitForTimeout(400);
  expect(calls).toBe(1);
  await expect(page.getByRole('status').filter({hasText:'고도 데이터를 불러오지 못했습니다.'})).toBeHidden();
  await page.getByRole('button',{name:'표고 펼치기',exact:true}).click();
  await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();
  await expect(page.locator('.elevation-overlay__current')).toHaveText('···');
  expect((await box(page)).height).toBe(44);
  await expect.poll(()=>calls).toBe(2);
  release();
  await expect(page.getByRole('img',{name:'경로 표고 그래프'})).toBeVisible();
  await expect(page.locator('.elevation-overlay__current')).toHaveText(/^현재 \d+\.\d m$/);
  expect(calls).toBe(2);
});
test('표고 실제 훅: 로딩 중 직접 접었다면 수신 후에도 접힘 유지', async ({page}) => {
  await isolateElevationStore(page);
  let release!: () => void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('https://api.open-meteo.com/v1/elevation?*', async route => {
    await gate;
    const count=new URL(route.request().url()).searchParams.get('latitude')!.split(',').length;
    await route.fulfill({json:{elevation:Array(count).fill(42)}});
  });
  await page.goto(`${preview}?state=paused&elevation=ready&elevationFetch`);
  await expect(page.locator('.elevation-overlay__current')).toHaveText('···');
  await page.getByRole('button',{name:'표고 펼치기',exact:true}).click();
  await page.getByRole('button',{name:'표고 접기',exact:true}).click();
  release();
  await expect(page.locator('.elevation-overlay__current')).toHaveText('현재 42.0 m');
  await expect(page.getByRole('img',{name:'경로 표고 그래프'})).toBeHidden();
  await expect(page.getByRole('button',{name:'표고 펼치기',exact:true})).toHaveAttribute('aria-expanded','false');
});
test('표고: 위치 없음은 현재·진행 거리를 미정으로 표시, 경로 없으면 패널 없음', async ({page}) => {
  await page.goto(`${preview}?state=ready&elevation=ready&noPosition`);
  await expect(page.locator('.elevation-overlay__current')).toHaveText('현재 —');
  await expect(page.getByLabel('현재 표고',{exact:true})).toHaveText('현재 —');
  await expect(page.locator('.elevation-overlay__marker')).toHaveCount(0);
  await page.goto(`${preview}?state=idle&elevation=ready`);
  await expect(page.locator('.elevation-overlay')).toHaveCount(0);
});

for (const [position, altitude] of [['atStart','-100.0'], ['atEnd','1500.0']]) {
  test(`표고 ${position}: 최고·최저 위치점과 헤더·표고 행 비겹침`, async ({page}) => {
    await page.setViewportSize(sizes[3]);
    await page.goto(`${preview}?state=paused&elevation=steep&${position}`);
    await expect(page.locator('.elevation-overlay__current')).toHaveText(`현재 ${altitude} m`);
    const marker = (await page.locator('.elevation-overlay__marker').boundingBox())!;
    const header = (await page.locator('.elevation-overlay__header').boundingBox())!;
    const row = (await page.locator('.elevation-overlay__readout').boundingBox())!;
    expect(marker.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(marker.y + marker.height).toBeLessThanOrEqual(row.y);
    await checkClearance(page);
  });
}
