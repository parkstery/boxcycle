import { test, expect, type Page } from '@playwright/test';

// Chief 11-02 v4 C단계(고정62 대체) — 주행 화면 왼쪽 세 패널.
// 인터벌이 시작되면 인터벌 펼침·미니맵 펼침·경로 카드 접힘. 인터벌이 펼쳐져 있는 동안 경로 카드·미니맵은 하나만 —
// 나중에 펼친 쪽이 남고 먼저 펼친 쪽이 접힌다. 인터벌을 접으면(알약) 둘 다 펼칠 수 있고, 다시 펼치면 먼저 펼친 쪽을 접는다.
const preview = '/scripts/ui-800x360/preview.html';

async function state(page: Page) {
  return page.evaluate(() => ({
    interval: document.querySelector('.ride-interval-hud--folded') ? 'folded' : document.querySelector('.ride-interval-hud') ? 'open' : 'none',
    dock: document.querySelector('.route-dock-anchor--open') ? 'open' : 'folded',
    minimap: document.querySelector('.route-minimap--collapsed') ? 'folded' : document.querySelector('.route-minimap') ? 'open' : 'none',
  }));
}

function overlap(a: DOMRect | null, b: DOMRect | null) {
  return Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
}

for (const size of [{ width: 800, height: 360 }, { width: 699, height: 273 }]) {
  test(`인터벌 중 하나만 펼치기·나중 쪽 우선·접힌 인터벌 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
    await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'folded', minimap: 'open' });

    await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'open', minimap: 'folded' });
    // 펼친 카드는 인터벌 패널과 겹치지 않는다(접힌 미니맵 버튼은 카드 옆).
    const boxes = await page.evaluate(() => [
      document.querySelector('.ride-interval-hud')!.getBoundingClientRect().toJSON(),
      document.querySelector('.route-dock__card')!.getBoundingClientRect().toJSON(),
    ]);
    expect(overlap(boxes[0], boxes[1])).toBe(false);

    await page.getByRole('button', { name: '미니맵 펼치기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'folded', minimap: 'open' });

    await page.getByRole('button', { name: '인터벌 패널 접기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'folded', dock: 'folded', minimap: 'open' });
    const chip = page.getByRole('button', { name: '인터벌 패널 펼치기' });
    await expect(chip).toContainText('운동');
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(32);
    // Chief 11-03: 접힌 알약은 왼쪽 원형 메뉴 버튼과 겹치지 않는다(버튼 오른쪽).
    const menuBtn = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    const chipBox = (await chip.boundingBox())!;
    expect(chipBox.x, '알약은 메뉴 버튼 오른쪽').toBeGreaterThanOrEqual(menuBtn.x + menuBtn.width);

    await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'folded', dock: 'open', minimap: 'open' });

    // 둘 다 펼친 채 인터벌을 다시 펼치면 먼저 펼친 미니맵이 접힌다.
    await chip.click();
    await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'open', minimap: 'folded' });
  });
}

// Chief 11-03: 접힌 미니맵 버튼은 늘 세로(손잡이·펼친 카드 아래, 왼쪽 끝 같음).
// 예외: 높이 340px 이하에서 인터벌 창이 펼쳐져 있고 카드를 펼쳤을 때만 카드 오른쪽 옆(인터벌 창과 겹치지 않게).
for (const size of [{ width: 800, height: 360 }, { width: 699, height: 273 }]) {
  test(`접힌 미니맵 버튼은 세로, 낮은 폰+인터벌+카드 펼침만 옆 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=riding`);
    await page.getByRole('button', { name: '미니맵 접기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'none', dock: 'folded', minimap: 'folded' });
    const both = await page.evaluate(() => [
      document.querySelector('.route-dock__card')!.getBoundingClientRect().toJSON(),
      document.querySelector('.route-minimap')!.getBoundingClientRect().toJSON(),
    ]);
    expect(Math.abs(both[0].left - both[1].left), '왼쪽 끝 같음').toBeLessThanOrEqual(0.5);
    expect(both[1].top, '미니맵 버튼은 손잡이 아래').toBeGreaterThanOrEqual(both[0].bottom);
    await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
    const open = await page.evaluate(() => [
      document.querySelector('.route-dock__card')!.getBoundingClientRect().toJSON(),
      document.querySelector('.route-minimap')!.getBoundingClientRect().toJSON(),
    ]);
    expect(Math.abs(open[1].left - open[0].left), '인터벌 없음: 카드 펼쳐도 세로').toBeLessThanOrEqual(0.5);
    expect(open[1].top).toBeGreaterThanOrEqual(open[0].bottom);

    // 인터벌 창이 펼쳐진 채 카드를 펼치면(미니맵 접힘): 341px 이상은 세로, 340px 이하만 옆 — 어느 쪽이든 인터벌 창과 안 겹침.
    await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
    await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
    await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'open', minimap: 'folded' });
    const iv = await page.evaluate(() => [
      document.querySelector('.ride-interval-hud')!.getBoundingClientRect().toJSON(),
      document.querySelector('.route-dock__card')!.getBoundingClientRect().toJSON(),
      document.querySelector('.route-minimap')!.getBoundingClientRect().toJSON(),
    ]);
    expect(overlap(iv[0], iv[1]), '카드 vs 인터벌 창').toBe(false);
    expect(overlap(iv[0], iv[2]), '미니맵 버튼 vs 인터벌 창').toBe(false);
    if (size.height > 340) expect(iv[2].top, '높은 화면: 세로').toBeGreaterThanOrEqual(iv[1].bottom);
    else expect(iv[2].left, '낮은 폰: 카드 오른쪽').toBeGreaterThanOrEqual(iv[1].right);
  });
}

// Chief 11-03: 펼친 미니맵 안 캐럿 = 펼친 경로 카드 안 캐럿(28px 같은 모양). 접힌 버튼은 40px 그대로.
test('펼친 미니맵 캐럿은 경로 카드 캐럿과 같은 크기·모양', async ({ page }) => {
  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  const look = (sel: string) => page.locator(sel).evaluate((el) => {
    const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { w: Math.round(b.width), h: Math.round(b.height), radius: cs.borderRadius, border: cs.borderTopWidth, left: Math.round(b.left) };
  });
  const dock = await look('.route-dock__card .route-overview-fold-toggle');
  const mini = await look('.route-minimap__toggle');
  expect(mini).toEqual(dock);
  expect(dock.w).toBe(28);
  await page.getByRole('button', { name: '미니맵 접기' }).click();
  const folded = await look('.route-minimap__toggle');
  expect([folded.w, folded.h]).toEqual([40, 40]);
});

// Chief 11-03: 운동·회복 진행 중이면 도넛의 지금 칸이 1초 주기로 깜빡인다(일시정지엔 멈춤).
test('도넛 지금 칸 1초 깜빡임, 일시정지엔 멈춤', async ({ page }) => {
  await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
  const anim = () => page.evaluate(() => [...document.querySelectorAll('.ride-interval-hud__progress [data-active="true"], .ride-interval-hud__fill')]
    .map((el) => { const cs = getComputedStyle(el); return `${cs.animationName} ${cs.animationDuration}`; }));
  await expect.poll(anim).toEqual(['ride-interval-seg-blink 1s', 'ride-interval-seg-blink 1s']);
  const others = await page.evaluate(() => [...document.querySelectorAll('.ride-interval-hud__progress [data-seg]:not([data-active="true"])')]
    .map((el) => getComputedStyle(el).animationName));
  expect(new Set(others)).toEqual(new Set(['none']));
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await expect.poll(async () => (await anim()).every((a) => a.startsWith('none'))).toBe(true);
});

test('인터벌을 접은 동안 미니맵을 나중에 펼쳤으면 다시 펼칠 때 경로 카드가 접힌다', async ({ page }) => {
  await page.goto(`${preview}?state=riding&interval&intervalMs=330000`);
  await page.getByRole('button', { name: '인터벌 패널 접기' }).click();
  await page.getByRole('button', { name: '미니맵 접기' }).click();
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  await page.getByRole('button', { name: '미니맵 펼치기' }).click();
  await expect.poll(() => state(page)).toEqual({ interval: 'folded', dock: 'open', minimap: 'open' });
  await page.getByRole('button', { name: '인터벌 패널 펼치기' }).click();
  await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'folded', minimap: 'open' });
});

test('인터벌이 없으면 미니맵·경로 카드는 서로 접지 않고, 인터벌이 시작되면 처음 규칙으로', async ({ page }) => {
  await page.goto(`${preview}?state=riding`);
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toHaveCount(0);
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  await expect.poll(() => state(page)).toEqual({ interval: 'none', dock: 'open', minimap: 'open' });
  // 일시정지에서 인터벌을 켜면 시작 규칙(미니맵 펼침·경로 카드 접힘).
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  await page.getByRole('button', { name: '인터벌 운동 설정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
  await editor.getByRole('switch', { name: /^인터벌/ }).check();
  await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
  await expect(page.getByRole('group', { name: '인터벌 안내' })).toBeVisible();
  await expect.poll(() => state(page)).toEqual({ interval: 'open', dock: 'folded', minimap: 'open' });
});
