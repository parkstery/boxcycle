import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const preview = '/scripts/ui-800x360/preview.html';
test.use({ viewport: { width: 800, height: 360 } });

test('30초 경계·일시정지·재개는 주행 활동시간을 공유한다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=713000`);
  const hud = page.getByRole('group', { name: '인터벌 안내' });
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('운동');
  await expect(hud.locator('.ride-interval-hud__repeat')).toHaveText('3 / 5');
  await expect(hud.locator('.ride-interval-hud__progress')).toHaveAttribute('viewBox','0 0 44 44');
  await expect(hud.locator('.ride-interval-hud__progress path')).toHaveCount(5);
  await expect(hud.locator('.ride-interval-hud__progress [data-done="true"]')).toHaveCount(2);
  await expect(hud.locator('.ride-interval-hud__progress [data-active="true"]')).toHaveCount(1);
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText('7');
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('일시정지');
  const frozen = await hud.locator('.ride-interval-hud__time').textContent();
  await page.clock.runFor(60_000);
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText(frozen!);
  await page.getByRole('button', { name: '재개', exact: true }).click();
  await page.clock.runFor(7_200);
  await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('회복');
  await expect(hud.locator('.ride-interval-hud__time')).toHaveText('2:00');
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(hud).toHaveCount(0);
});

test('센서 없이도 단계가 진행되고 완료 뒤 주행 제어는 유지된다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=1499000&noSensor`);
  const hud = page.getByRole('group', { name: '인터벌 안내' });
  await expect(hud).toContainText('페달 강도 직접 조절');
  await page.clock.runFor(1_200);
  await expect(hud).toContainText('완료');
  await expect(hud.locator('.ride-interval-hud__progress')).toHaveCount(0);
  await expect(hud).toContainText('자유 주행 계속');
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '주행 종료', exact: true })).toBeVisible();
});

// 2026-10-29 Chief: 인터벌 사용 스위치는 인터벌 운동 설정 창에 있다(고정42).
// 10-30 Chief: 메뉴 「인터벌」 행은 빠졌다 — RouteDock 「INT」에서만 연다.
async function openIntervalEditorFromMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  return page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
}

for(const size of [{width:1000,height:455},{width:800,height:360},{width:699,height:273},{width:667,height:300}]) {
  test(`순위 줄배경·인터벌60% 고정크기 큰도넛 ${size.width}`,async({page})=>{
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`${preview}?state=glance-riding&interval&intervalMs=713000`);
    const panel=page.locator('.lb-glance__panel');
    const hud=page.getByRole('group',{name:'인터벌 안내'});
    await expect(panel).toBeVisible();
    await expect(hud).toBeVisible();
    const appearance=await page.evaluate(()=>{
      const panel=document.querySelector('.lb-glance__panel')!;
      const hud=document.querySelector('.ride-interval-hud')!;
      const styles=[...panel.querySelectorAll('.lb-glance__outline')].map(el=>({shadow:getComputedStyle(el).textShadow,color:getComputedStyle(el).color}));
      const rowBands=[...panel.querySelectorAll('.lb-glance__row')].map(el=>({me:el.classList.contains('lb-glance__row--me'),bg:getComputedStyle(el,'::before').backgroundColor,h:parseFloat(getComputedStyle(el,'::before').height),rowH:el.getBoundingClientRect().height}));
      const box=hud.getBoundingClientRect(),ring=hud.querySelector('svg.ride-interval-hud__progress')!.getBoundingClientRect(),count=hud.querySelector('.ride-interval-hud__repeat')!.getBoundingClientRect();
      const geometry={w:box.width,h:box.height,ring:ring.width,countCenterX:count.left+count.width/2-(ring.left+ring.width/2),countCenterY:count.top+count.height/2-(ring.top+ring.height/2),
        ringInside:ring.left>=box.left-0.5&&ring.right<=box.right+0.5};
      return {background:getComputedStyle(panel).backgroundColor,border:getComputedStyle(panel).borderTopWidth,
        rows:[...panel.querySelectorAll('.lb-glance__row')].map(el=>getComputedStyle(el).backgroundColor),
        interval:getComputedStyle(hud).backgroundColor,opacity:getComputedStyle(hud).opacity,pointer:getComputedStyle(hud).pointerEvents,intervalShadow:getComputedStyle(hud).textShadow,styles,rowBands,geometry};
    });
    expect(appearance.background).toBe('rgba(0, 0, 0, 0)');expect(appearance.border).toBe('0px');
    for(const row of appearance.rows)expect(row).toBe('rgba(0, 0, 0, 0)');
    for(const text of appearance.styles)expect(text.shadow).toBe('none');
    expect(appearance.rowBands.filter(r=>r.me)).toHaveLength(1);
    for(const band of appearance.rowBands){expect(band.bg).toBe(band.me?'rgba(222, 233, 255, 0.8)':'rgba(255, 255, 255, 0.7)');expect(band.h).toBeLessThan(band.rowH);}
    for(const text of appearance.styles)expect(['rgb(20, 44, 70)','rgb(36, 87, 214)']).toContain(text.color);
    await expect(panel.locator('.lb-glance__row')).toHaveCount(10);
    expect(appearance.interval).toBe('rgba(255, 255, 255, 0.6)');expect(appearance.opacity).toBe('1');expect(appearance.pointer).toBe('none');
    expect(appearance.intervalShadow).toContain('rgb(255, 255, 255)');
    const g=appearance.geometry,wide=size.height>340;
    expect(g.w).toBeCloseTo(wide?205:150,1);expect(g.h).toBeCloseTo(wide?89.1875:86.59375,1);
    expect(g.ring).toBe(88);expect(g.ringInside).toBe(true);
    expect(Math.abs(g.countCenterX)).toBeLessThan(2);expect(Math.abs(g.countCenterY)).toBeLessThan(2);
    await expect(hud.locator('.ride-interval-hud__repeat')).toHaveText('3 / 5');
    const ring=hud.locator('svg.ride-interval-hud__progress');
    await expect(ring).toHaveAttribute('aria-label','5회 중 3회째');
    await expect(ring.locator('path')).toHaveCount(5);
    const gap=await hud.evaluate(el=>{const a=el.getBoundingClientRect(),b=document.querySelector('.lb-glance__panel')!.getBoundingClientRect();return a.right<=b.left;});
    expect(gap).toBe(true);
    if(process.env.INTERVAL_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_EVIDENCE_DIR,`cloud-donut-${size.width}.png`)});}
    await page.goto(`${preview}?state=riding&interval&intervalMs=0`);
    await expect(hud.locator('.ride-interval-hud__progress [data-done="true"]')).toHaveCount(0);
    await expect(hud.locator('.ride-interval-hud__progress [data-active="true"]')).toHaveCount(0);
    await page.goto(`${preview}?state=riding&interval&intervalMs=1499000`);
    await expect(hud.locator('.ride-interval-hud__progress [data-done="true"]')).toHaveCount(5);
  });
}

test('기본은 끔이며 설정에서 선택하고, 주행 중엔 못 바꾸며 일시정지에서 다시 켜면 준비부터 시작한다', async ({ page }) => {
  await page.clock.install();
  await page.goto(preview);
  const editor = await openIntervalEditorFromMenu(page);
  const toggle = editor.getByRole('switch', { name: /^인터벌/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');

  await page.goto(`${preview}?state=riding&interval&intervalMs=713000&short`);
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('운동');
  // 10-30 Chief: 주행 중에는 인터벌을 열 수 없다(의도) — 일시정지한 뒤 INT 로 바꾼다.
  await expect(page.getByRole('button', { name: '인터벌 운동 설정', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  const settings = await openIntervalEditorFromMenu(page);
  const ridingToggle = settings.getByRole('switch', { name: /^인터벌/ });
  await expect(ridingToggle).toBeChecked();
  await ridingToggle.uncheck();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await ridingToggle.check();
  await settings.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
  await page.getByRole('button', { name: '재개', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await expect(page.locator('.audit-world')).toHaveAttribute('data-ui-stage', 'ready-to-start');
  await page.getByRole('button', { name: '검수용 새 경로 확정', exact: true }).click();
  await page.getByRole('button', { name: '주행 시작', exact: true }).click();
  await expect(page.locator('.ride-interval-hud__phase')).toHaveText('준비');
  await expect(page.locator('.ride-interval-hud__time')).toHaveText('5:00');
});

for (const size of [{width:800,height:360},{width:667,height:300},{width:844,height:390}]) {
  test(`왼쪽 인터벌은 기존 UI와 겹치지 않고 지도를 막지 않는다 ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    for (const state of ['riding','paused']) {
      await page.goto(`${preview}?state=${state}&interval&intervalMs=330000&long`);
      const hud = page.getByRole('group', { name: '인터벌 안내' });
      await expect(hud).toBeVisible();
      const geometry = await hud.evaluate(el => {
        const a=el.getBoundingClientRect();
        const overlaps=[...document.querySelectorAll('.map-hud__tr,.ride-control-bar,.map-bottom-left-stack,.hud-coach')].filter(other=>{
          const b=other.getBoundingClientRect();
          return b.width>0 && b.height>0 && a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
        }).map(other=>other.className);
        return {overlaps,left:a.left,center:a.x+a.width/2,inside:a.left>=0 && a.right<=innerWidth && a.top>=0 && a.bottom<=innerHeight,pointer:getComputedStyle(el).pointerEvents,background:getComputedStyle(el).backgroundColor};
      });
      expect(geometry.overlaps).toEqual([]);
      expect(geometry.left).toBeLessThan(size.width*0.35);
      expect(geometry.center).toBeLessThan(size.width*0.4);
      expect(geometry.inside).toBe(true);
      expect(geometry.pointer).toBe('none');
      expect(geometry.background).toBe('rgba(255, 255, 255, 0.6)');
      if (process.env.INTERVAL_EVIDENCE_DIR) {
        await fs.mkdir(process.env.INTERVAL_EVIDENCE_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.INTERVAL_EVIDENCE_DIR,`${state}-${size.width}x${size.height}.png`)});
      }
    }
  });
}
