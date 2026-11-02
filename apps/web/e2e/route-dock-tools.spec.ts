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

test('센서 칩은 글자·테두리 없이 21px LED, 주행 중 rpm 은 남는다', async ({ page }) => {
  await page.goto(`${preview}?state=ready`);
  const chip = page.locator('.route-dock__head .hud-cadence--dock');
  await expect(chip).toBeVisible();
  await expect(chip.locator('.hud-cadence__text')).toHaveCount(0);
  await expect(chip).not.toContainText('센서');
  const look = await chip.evaluate((el) => {
    const led = el.querySelector('.hud-cadence__led')!.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { led: [Math.round(led.width), Math.round(led.height)], border: cs.borderTopColor };
  });
  expect(look.led).toEqual([21, 21]);
  expect(look.border).toBe('rgba(0, 0, 0, 0)');
  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: '경로 패널 펼치기', exact: true }).click();
  await expect(page.locator('.route-dock__head .hud-cadence--dock .hud-cadence__text')).toContainText('rpm');
});

test('메뉴 머리줄: 지도 핀은 「내 경로」 창(주행 전만), ⚙ 는 주행 설정 창', async ({ page }) => {
  await page.goto(`${preview}?state=idle`);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const menu = page.locator('#menu-panel');
  await menu.getByRole('button', { name: '경로 목록', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 경로', exact: true })).toBeVisible();
  await expect(page.locator('.oc-modal__sources button[aria-pressed=true]')).toHaveText('내 경로');
  await page.locator('.oc-modal__close').click();
  await menu.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await expect(menu.getByRole('button', { name: '경로 목록', exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=menu`);
  await expect(menu.getByRole('group', { name: '경로 목록 열기' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '인터벌', exact: true })).toHaveCount(0);
});
