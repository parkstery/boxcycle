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
  await expect(hud.locator('.ride-interval-hud__progress')).toHaveAttribute('aria-label','5회 중 3회째');
  await expect(hud.locator('.ride-interval-hud__progress')).toHaveAttribute('viewBox','0 0 44 44');
  await expect(hud.locator('.ride-interval-hud__progress path[data-seg]')).toHaveCount(5);
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
  // Chief 11-02: 재개 뒤 5초 넘게 손대지 않아 주행 버튼이 숨었다 — 화면을 한 번 누르면 다시 나온다.
  await page.mouse.click(400, 200);
  await page.getByRole('button', { name: '주행 종료', exact: true }).click();
  await expect(hud).toHaveCount(0);
});

test('센서 없이도 단계가 진행되고 완료 뒤 주행 제어는 유지된다', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=riding&interval&intervalMs=1499000&noSensor`);
  const hud = page.getByRole('group', { name: '인터벌 안내' });
  // Chief 11-03: 「페달 강도 직접 조절」 문구는 없다.
  await expect(hud).not.toContainText('페달 강도 직접 조절');
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

// Chief 11-01 D안(고정58 대체): 흰70%·폭은 내용만큼·바깥 반복 도넛+안쪽 남은 시간 링·아래 전체 진도 막대, 초·「전체」 생략, 라운드→세트.
for(const size of [{width:1000,height:455},{width:800,height:360},{width:699,height:273},{width:667,height:300}]) {
  test(`순위 줄배경·인터벌 D안 두 도넛·진도 막대 ${size.width}`,async({page})=>{
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
      const ringEl=hud.querySelector('svg.ride-interval-hud__progress')!;
      const box=hud.getBoundingClientRect(),ring=ringEl.getBoundingClientRect(),time=hud.querySelector('.ride-interval-hud__time')!.getBoundingClientRect();
      const text=hud.querySelector('.ride-interval-hud__text')!,bar=hud.querySelector('.ride-interval-hud__bar')!.getBoundingClientRect();
      const inside=(el:Element)=>{const r=el.getBoundingClientRect();return r.left>=box.left-0.5&&r.right<=box.right+0.5&&r.top>=box.top-0.5&&r.bottom<=box.bottom+0.5;};
      const geometry={w:box.width,h:box.height,ring:ring.width,timeCenterX:time.left+time.width/2-(ring.left+ring.width/2),timeCenterY:time.top+time.height/2-(ring.top+ring.height/2),
        ringInside:inside(ringEl),textInside:[...text.children].every(inside),textOverflow:[...text.children].some(el=>el.scrollWidth>el.clientWidth+1),
        barBelowRing:bar.top>=ring.top+ring.height*0.9,barFull:bar.width>box.width-20,barInside:bar.bottom<=box.bottom+0.5};
      const remain=hud.querySelector('.ride-interval-hud__remain')!,fill=hud.querySelector('.ride-interval-hud__fill')!;
      return {background:getComputedStyle(panel).backgroundColor,border:getComputedStyle(panel).borderTopWidth,
        rows:[...panel.querySelectorAll('.lb-glance__row')].map(el=>getComputedStyle(el).backgroundColor),
        interval:getComputedStyle(hud).backgroundColor,opacity:getComputedStyle(hud).opacity,pointer:getComputedStyle(hud).pointerEvents,intervalShadow:getComputedStyle(hud).textShadow,styles,rowBands,geometry,
        remainOffset:parseFloat(getComputedStyle(remain).strokeDashoffset),remainColor:getComputedStyle(remain).stroke,fillOffset:parseFloat(getComputedStyle(fill).strokeDashoffset),
        doneClip:getComputedStyle(hud.querySelector('.ride-interval-hud__bar-done')!).clipPath,barSegs:hud.querySelectorAll('.ride-interval-hud__bar-done > span').length,
        hudText:(hud as HTMLElement).innerText};
    });
    expect(appearance.background).toBe('rgba(0, 0, 0, 0)');expect(appearance.border).toBe('0px');
    for(const row of appearance.rows)expect(row).toBe('rgba(0, 0, 0, 0)');
    for(const text of appearance.styles)expect(text.shadow).toBe('none');
    expect(appearance.rowBands.filter(r=>r.me)).toHaveLength(1);
    for(const band of appearance.rowBands){expect(band.bg).toBe(band.me?'rgba(222, 233, 255, 0.8)':'rgba(255, 255, 255, 0.7)');expect(band.h).toBeLessThan(band.rowH);}
    for(const text of appearance.styles)expect(['rgb(20, 44, 70)','rgb(36, 87, 214)']).toContain(text.color);
    await expect(panel.locator('.lb-glance__row')).toHaveCount(10);
    expect(appearance.interval).toBe('rgba(255, 255, 255, 0.7)');expect(appearance.opacity).toBe('1');expect(appearance.pointer).toBe('none');
    expect(appearance.intervalShadow).toContain('rgb(255, 255, 255)');
    const g=appearance.geometry,wide=size.height>340;
    // 폭은 글자 칸+도넛만큼(옛 205/150보다 좁거나 같은 수준), 높이는 막대 한 줄만큼 늘었다.
    // Chief 11-03 C1+P1: 접기 버튼 줄(+13)·진도 막대는 아래 테두리 띠(−13) — 창 높이 104(낮은 폰 92).
    expect(g.w).toBeLessThan(wide?190:160);expect(g.h).toBeCloseTo(wide?104:92,1);
    expect(g.ring).toBe(wide?88:74);expect(g.ringInside).toBe(true);expect(g.textInside).toBe(true);expect(g.textOverflow).toBe(false);
    expect(Math.abs(g.timeCenterX)).toBeLessThan(2);expect(Math.abs(g.timeCenterY)).toBeLessThan(2);
    expect(g.barBelowRing).toBe(true);expect(g.barFull).toBe(true);expect(g.barInside).toBe(true);
    // 713s 기본 설정: 2반복 끝·3번째 운동 53초 지남(남은 7초) → 안쪽 링 7/60, 바깥 진행 칸 53/180, 막대 713/1500.
    expect(appearance.remainOffset).toBeCloseTo(-(1-7/60),2);expect(appearance.remainColor).toBe('rgb(212, 32, 32)');
    expect(appearance.fillOffset).toBeCloseTo(1-53/180,2);
    expect(appearance.barSegs).toBe(12);
    const clipRight=parseFloat(appearance.doneClip.replace(/^inset\(0(px)? /,''));
    expect(clipRight).toBeCloseTo(100-100*713/1500,1);
    expect(appearance.hudText).not.toContain('라운드');expect(appearance.hudText).not.toContain('전체');
    await expect(hud.locator('.ride-interval-hud__time')).toHaveText('7');
    await expect(hud.locator('.ride-interval-hud__total')).toHaveText('11:53 / 25:00');
    const ring=hud.locator('svg.ride-interval-hud__progress');
    await expect(ring).toHaveAttribute('aria-label','5회 중 3회째');
    await expect(ring.locator('path[data-seg]')).toHaveCount(5);
    await expect(ring.locator('[data-done="true"]')).toHaveCount(2);
    await expect(ring.locator('[data-active="true"]')).toHaveCount(1);
    const gap=await hud.evaluate(el=>{const a=el.getBoundingClientRect(),b=document.querySelector('.lb-glance__panel')!.getBoundingClientRect();return a.right<=b.left;});
    expect(gap).toBe(true);
    if(process.env.INTERVAL_EVIDENCE_DIR){await fs.mkdir(process.env.INTERVAL_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INTERVAL_EVIDENCE_DIR,`d-donut-${size.width}.png`)});}
    await page.goto(`${preview}?state=riding&interval&intervalMs=0`);
    await expect(hud.locator('.ride-interval-hud__progress [data-done="true"]')).toHaveCount(0);
    await expect(hud.locator('.ride-interval-hud__progress [data-active="true"]')).toHaveCount(0);
    await expect(hud.locator('.ride-interval-hud__fill')).toHaveCount(0);
    await expect(hud.locator('.ride-interval-hud__time')).toHaveText('5:00');
    await page.goto(`${preview}?state=riding&interval&intervalMs=1499000`);
    await expect(hud.locator('.ride-interval-hud__progress [data-done="true"]')).toHaveCount(5);
  });
}

// 라운드가 있는 설정은 「세트」로 표기한다(Chief 11-01).
// 최대치 설정(10분×30회×3세트, 총 1920분)에서도 글자가 칸을 넘지 않는다.
for (const size of [{width:800,height:360},{width:699,height:273}]) {
  test(`세트 표기·최대 설정 글자 칸 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`${preview}?state=riding&interval&settingsStress&intervalMs=2400000`);
    const hud = page.getByRole('group', { name: '인터벌 안내' });
    await expect(hud.locator('.ride-interval-hud__round')).toHaveText('1/3세트');
    await expect(hud).not.toContainText('라운드');
    await expect(hud.locator('.ride-interval-hud__total')).toHaveText('40:00 / 1920:00');
    const overflow = () => hud.evaluate(el => {
      const box = el.getBoundingClientRect();
      return [...el.querySelectorAll('.ride-interval-hud__text > *')].filter(c => { const r = c.getBoundingClientRect(); return c.scrollWidth > c.clientWidth + 1 || r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5; }).map(c => c.className);
    });
    expect(await overflow()).toEqual([]);
    // 「일시정지」·「주행 재개 시 이어서」가 가장 긴 글자다.
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await expect(hud.locator('.ride-interval-hud__phase')).toHaveText('일시정지');
    expect(await overflow()).toEqual([]);
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
      expect(geometry.background).toBe('rgba(255, 255, 255, 0.7)');
      if (process.env.INTERVAL_EVIDENCE_DIR) {
        await fs.mkdir(process.env.INTERVAL_EVIDENCE_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.INTERVAL_EVIDENCE_DIR,`${state}-${size.width}x${size.height}.png`)});
      }
    }
  });
}

// 인터벌 중 미니맵·경로 카드 규칙(고정62 대체)은 e2e/ride-left-panels.spec.ts.

