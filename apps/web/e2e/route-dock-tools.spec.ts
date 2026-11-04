import { expect, test, type Page } from '@playwright/test';

// Chief 11-02 v4 — 오른쪽 아래 2열 4줄 묶음(칸마다 한 기능, 없는 기능의 칸은 비움)과 왼쪽 메뉴 머리줄.
//   1-1 카메라 | 1-2 지도 스타일 / 2-1 ＋ | 2-2 － / 3-1 INT | 3-2 순위 / 4-1 ⏹ | 4-2 ⏸·▶
// INT 는 주행 중엔 없다(10-30 결정, 일시정지에서). 지도 핀(경로 목록)·⚙(주행 설정)은 메뉴 머리줄, 핀은 주행 전만.
// RouteDock 머리줄엔 센서 LED·접기만 남는다(종전 10-30 도구줄은 이 묶음·메뉴로 옮김).
const preview = '/scripts/ui-800x360/preview.html';
const sizes = [{ width: 800, height: 360 }, { width: 699, height: 273 }, { width: 667, height: 300 }];

const CELLS: [RegExp, number, number][] = [
  [/^카메라 메뉴/, 0, 0], [/^맵 스타일/, 1, 0],
  [/^줌 확대$/, 0, 1], [/^줌 축소$/, 1, 1],
  [/^인터벌 운동 설정$/, 0, 2], [/^순위 (열기|닫기)$/, 1, 2],
  [/^주행 종료$/, 0, 3], [/^(주행 시작|일시정지|재개)$/, 1, 3],
];

async function railCells(page: Page) {
  // 배치 좌표(offset*)로 잰다 — ▶ 펄스(scale)가 화면 상자를 흔들어도 칸은 그대로다.
  return page.locator('.map-hud__rail').evaluate((rail) =>
    [...rail.querySelectorAll<HTMLElement>('button')]
      .filter((b) => b.offsetWidth > 0 && !b.matches('.ride-control-bar__more, .ride-control-bar__resume-trigger'))
      .map((b) => ({
        name: b.getAttribute('aria-label') ?? '', parent: b.offsetParent === rail,
        x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight, radius: getComputedStyle(b).borderTopLeftRadius,
      })));
}

test('오른쪽 2열 4줄: 기능마다 정해진 칸·흰 원·같은 크기, 상태별로 빈 칸', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const state of ['ready', 'riding', 'paused'] as const) {
      await page.goto(`${preview}?state=${state}`);
      const label = `${size.width} ${state}`;
      const cells = await railCells(page);
      const s = cells[0]!.w;
      expect(s, label).toBeGreaterThanOrEqual(44);
      expect(s, label).toBeLessThanOrEqual(64);
      const gap = size.height >= 312 ? 8 : 6;
      for (const c of cells) {
        const rule = CELLS.find(([re]) => re.test(c.name));
        expect(rule, `${label} ${c.name}`).toBeTruthy();
        const [, col, row] = rule!;
        expect(c.parent, `${label} ${c.name} 칸 기준`).toBe(true);
        // 칸 크기가 소수(699 높이 ≈50.6px)라 offset 반올림 1px 은 허용한다.
        expect(Math.abs(c.x - col * (s + gap)), `${label} ${c.name} x`).toBeLessThanOrEqual(1.5);
        expect(Math.abs(c.y - row * (s + gap)), `${label} ${c.name} y`).toBeLessThanOrEqual(1.5);
        expect(c.w, `${label} ${c.name}`).toBeCloseTo(s, 0);
        expect(c.h, `${label} ${c.name}`).toBeCloseTo(s, 0);
        expect(c.radius, `${label} ${c.name}`).toMatch(/^(50%|\d{2,}px)$/);
      }
      const names = cells.map((c) => c.name);
      const has = (re: RegExp) => names.some((n) => re.test(n));
      expect(has(/^줌 확대$/) && has(/^줌 축소$/) && has(/^맵 스타일/) && has(/^순위/), label).toBe(true);
      if (state === 'ready') {
        expect(names, label).toContain('주행 시작');
        expect(names, label).toContain('인터벌 운동 설정');
        expect(has(/^카메라 메뉴/) || names.includes('주행 종료'), label).toBe(false);
      } else if (state === 'riding') {
        expect(names, label).toEqual(expect.arrayContaining(['일시정지', '주행 종료']));
        expect(has(/^카메라 메뉴/), label).toBe(true);
        expect(names, label).not.toContain('인터벌 운동 설정');
      } else {
        expect(names.length, label).toBe(8);
        expect(names, label).toContain('재개');
      }
      // RouteDock 머리줄엔 옮긴 버튼이 없다.
      const dock = await page.locator('.route-dock__head').evaluate((h) => [...h.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? ''));
      for (const gone of ['인터벌 운동 설정', '경로 목록', '주행 설정', '주행 시작', '일시정지', '재개', '주행 종료']) expect(dock, `${label} dock`).not.toContain(gone);
    }
  }
});

test('묶음은 오른쪽 위 계정 버튼 아래, 오른쪽 아래 끝 8px', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const state of ['ready', 'riding'] as const) {
      await page.goto(`${preview}?state=${state}`);
      const label = `${size.width} ${state}`;
      const rail = (await page.locator('.map-hud__rail').boundingBox())!;
      const acct = (await page.locator('.hud-account').boundingBox())!;
      expect(Math.round(size.width - rail.x - rail.width), label).toBe(8);
      expect(Math.round(size.height - rail.y - rail.height), label).toBe(8);
      // 계정은 주행 중에도 보인다(Chief 11-02 v4).
      expect(rail.y, label).toBeGreaterThanOrEqual(acct.y + acct.height);
    }
  }
});

// 10-30 Chief: RouteDock 접기 버튼은 미니맵(고정53)처럼 캐럿만 — 경로 지점 도안 없이 가운데.
test('경로 패널 접기 버튼은 캐럿 하나만 가운데에 보인다', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const state of ['ready', 'riding'] as const) {
      await page.goto(`${preview}?state=${state}`);
      const fold = page.getByRole('button', { name: '경로 패널 접기', exact: true });
      if (!(await fold.count())) await page.getByRole('button', { name: '경로 패널 펼치기', exact: true }).click();
      const label = `${size.width} ${state}`;
      await expect(fold.locator('.route-overview-fold-toggle__identity'), label).toHaveCount(0);
      await expect(fold.locator('.route-overview-fold-toggle__chevron'), label).toHaveCount(1);
      const offset = await fold.evaluate((btn) => {
        const b = btn.getBoundingClientRect(), c = btn.querySelector('.route-overview-fold-toggle__chevron')!.getBoundingClientRect();
        return Math.abs((c.left + c.width / 2) - (b.left + b.width / 2));
      });
      expect(offset, label).toBeLessThan(1);
    }
  }
});

// Chief 11-02 v4(B단계): 센서는 RouteDock 이 아니라 계기판 맨 앞 칸 — 「RPM」 + LED 13px + 회전수(신호 없으면 「--」).
test('센서는 계기판 맨 앞 칸, RouteDock 머리줄엔 센서가 없다', async ({ page }) => {
  for (const state of ['ready', 'riding'] as const) {
    await page.goto(`${preview}?state=${state}`);
    if (state === 'riding') await page.getByRole('button', { name: '경로 패널 펼치기', exact: true }).click();
    await expect(page.locator('.route-dock__head').getByRole('button', { name: /^케이던스 센서/ })).toHaveCount(0);
    const cell = page.locator('.map-hud__tl-row .hud-metrics__cell--sensor');
    await expect(cell).toHaveCount(1);
    await expect(cell.locator('.hud-metrics__label')).toHaveText('RPM');
    await expect(cell.locator('.hud-metrics__sensor-rpm')).toHaveText('--');
    const led = await cell.locator('.hud-cadence__led').evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    expect(led).toEqual([13, 13]);
  }
});

test('메뉴 머리줄: 지도 핀은 「내 경로」 창(주행 전만), ⚙ 는 주행 설정 창', async ({ page }) => {
  await page.goto(`${preview}?state=idle`);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const menu = page.locator('#menu-panel');
  await menu.getByRole('button', { name: '내 경로 목록', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 경로', exact: true })).toBeVisible();
  await expect(page.locator('.oc-modal__sources button[aria-pressed=true]')).toHaveText('내 경로');
  await page.locator('.oc-modal__close').click();
  await menu.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await expect(menu.getByRole('button', { name: '내 경로 목록', exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=menu`);
  await expect(menu.getByRole('group', { name: '경로 목록 열기' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '인터벌', exact: true })).toHaveCount(0);
});

// 11-04 Chief 「메뉴 센서 버튼을 기존 센서 LED 버튼과 동일한 형태로, 깜빡임도 동일하게」 —
// 메뉴 단추·LED 크기·색·LED 깜빡임·단추 깜빡임이 계기판 RPM 칸과 같아야 한다.
test('메뉴 센서 버튼은 계기판 센서 단추와 같은 꼴·같은 깜빡임', async ({ page }) => {
  const read = (sel: string) =>
    page.locator(sel).evaluate((el) => {
      const knob = el.querySelector<HTMLElement>('.hud-cadence__knob')!;
      const led = el.querySelector<HTMLElement>('.hud-cadence__led')!;
      const k = knob.getBoundingClientRect();
      const l = led.getBoundingClientRect();
      const ks = getComputedStyle(knob);
      const ls = getComputedStyle(led);
      return {
        knob: [Math.round(k.width), Math.round(k.height)],
        knobBg: ks.backgroundColor,
        knobBorder: ks.borderTopColor,
        knobShadow: ks.boxShadow,
        led: [Math.round(l.width), Math.round(l.height)],
        ledBg: ls.backgroundColor,
        ledShadow: ls.boxShadow,
        ledAnim: ls.animationName,
        ledDur: ls.animationDuration,
        btnAnim: getComputedStyle(el).animationName,
        btnDur: getComputedStyle(el).animationDuration,
      };
    });
  for (const query of ['state=idle', 'state=ready-to-start&blocked', 'state=sensor-connected']) {
    await page.goto(`${preview}?${query}`);
    const sheet = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
    if (await sheet.isVisible()) {
      await sheet.getByRole('button', { name: '센서 설정 닫기' }).click();
      await expect(sheet).toBeHidden();
    }
    // 깜빡임 중간값을 비교하지 않도록 애니메이션 위상과 무관한 값만 읽는다(이름·주기·크기·색).
    await page.addStyleTag({ content: '.hud-cadence__led, .menu-panel__sensor, .hud-metrics__cell--sensor { animation-play-state: paused !important; animation-delay: 0s !important; }' });
    const hud = await read('.hud-metrics__cell--sensor');
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    const menu = await read('#menu-panel .menu-panel__sensor');
    expect(menu, query).toEqual(hud);
  }
});

// Chief 11-03 「센서 메뉴를 메인메뉴 안에 추가」 — 머리줄 ⚙ 오른쪽, 계기판 RPM 칸과 같은 센서 창. 주행 전·중 모두.
test('메뉴 머리줄: 센서 버튼은 센서 창을 열고, 머리줄 버튼이 메뉴 판 안에 든다', async ({ page }) => {
  const menu = page.locator('#menu-panel');
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const state of ['idle', 'riding']) {
      await page.goto(`${preview}?state=${state}`);
      await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
      const sensor = menu.getByRole('button', { name: '센서', exact: true });
      await expect(sensor).toBeVisible();
      const box = await menu.locator('.menu-panel__head').evaluate((head) => {
        const panel = head.closest('.menu-panel')!.getBoundingClientRect();
        const btns = [...head.querySelectorAll<HTMLElement>('button')].map((b) => b.getBoundingClientRect());
        const ys = btns.map((r) => Math.round(r.top));
        const overlap = btns.some((a, i) => btns.some((b, j) => i < j && a.left < b.right - 0.5 && b.left < a.right - 0.5));
        return { left: panel.left, right: panel.right, minX: Math.min(...btns.map((r) => r.left)), maxX: Math.max(...btns.map((r) => r.right)), oneRow: new Set(ys).size === 1, minW: Math.min(...btns.map((r) => r.width)), overlap };
      });
      expect(box.minX, `${size.width} ${state} 왼쪽`).toBeGreaterThanOrEqual(box.left);
      expect(box.maxX, `${size.width} ${state} 오른쪽(닫기)`).toBeLessThanOrEqual(box.right);
      expect(box.oneRow, `${size.width} ${state} 한 줄`).toBe(true);
      expect(box.minW, `${size.width} ${state} 버튼 폭`).toBeGreaterThanOrEqual(30);
      expect(box.overlap, `${size.width} ${state} 버튼끼리 겹침`).toBe(false);
      await sensor.click();
      await expect(page.getByRole('dialog', { name: '케이던스 센서', exact: true })).toBeVisible();
    }
  }
});
