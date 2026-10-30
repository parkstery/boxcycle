import { expect, test, type Page } from '@playwright/test';

// 10-30 Chief — RouteDock 도구줄.
// 주행 전: [센서 LED] INT · 지도 핀(경로 목록) · ⚙(주행 설정) · ▶ / 주행 중: [센서 LED+rpm] ⚙ · ⏸ · ⏹ (⚙ 가 INT 자리).
// 일시정지: ⚙ 자리에 INT — 인터벌은 멈춘 뒤에만 바꾼다(주행 중 변경 불가는 Chief 의도).
// 센서 칩은 「센서」 글자·테두리 없이 LED 원만(7px 의 세 배 = 21px). 왼쪽 메뉴는 Trail 전용.
const preview = '/scripts/ui-800x360/preview.html';
const sizes = [{ width: 800, height: 360 }, { width: 699, height: 273 }, { width: 667, height: 300 }];

async function headOrder(page: Page) {
  return page.locator('.route-dock__head').evaluate((head) =>
    [...head.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().width > 0 && !b.closest('.ride-control-bar__resume, [aria-label="일시정지 옵션"]'))
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
      .map((b) => b.getAttribute('aria-label') ?? ''),
  );
}

async function expectInsideCard(page: Page, label: string) {
  const r = await page.locator('.route-dock__card').evaluate((card) => {
    const c = card.getBoundingClientRect();
    const open = Boolean(card.closest('.route-dock-anchor--open'));
    const btns = [...card.querySelectorAll('.route-dock__head button')].map((b) => b.getBoundingClientRect()).filter((b) => b.width > 0);
    let overlap = false;
    for (let i = 0; i < btns.length; i += 1) for (let j = i + 1; j < btns.length; j += 1) {
      const a = btns[i]!, b = btns[j]!;
      if (a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) overlap = true;
    }
    return { overlap, outside: open && btns.some((b) => b.right > c.right + 0.5 || b.left < c.left - 0.5) };
  });
  expect(r, label).toEqual({ overlap: false, outside: false });
}

test('주행 전 INT·핀·⚙·주행 시작 순서, 주행 중엔 ⚙·일시정지엔 INT 가 그 자리 — 접힘·펼침 모두', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const state of ['idle', 'setup', 'ready', 'riding', 'paused'] as const) {
      await page.goto(`${preview}?state=${state}`);
      for (let pass = 0; pass < 2; pass += 1) {
        const label = `${size.width} ${state} ${pass}`;
        const order = (await headOrder(page)).filter((name) => !/^경로 패널|^케이던스 센서/.test(name));
        if (state === 'riding') {
          expect(order[0], label).toBe('주행 설정');
          expect(order, label).not.toContain('인터벌 운동 설정');
          expect(order, label).not.toContain('경로 목록');
        } else if (state === 'paused') {
          expect(order[0], label).toBe('인터벌 운동 설정');
          expect(order, label).not.toContain('주행 설정');
          expect(order, label).not.toContain('경로 목록');
        } else {
          expect(order.slice(0, 3), label).toEqual(['인터벌 운동 설정', '경로 목록', '주행 설정']);
          if (state === 'ready') expect(order[3], label).toBe('주행 시작');
        }
        await expectInsideCard(page, label);
        const toggle = page.getByRole('button', { name: /^경로 패널 (펼치기|접기)$/ });
        if (!(await toggle.count())) break;
        await toggle.click();
      }
    }
  }
});

// 10-30 Chief: 폰 가로에서 26×30 이면 접힘의 흰 원이 타원으로 찌그러졌다 — 도구 버튼은 어느 크기에서나 정원.
test('지도 핀·⚙ 도구 버튼은 접힘·펼침 모두 정원(폭=높이)', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto(`${preview}?state=ready`);
    for (let pass = 0; pass < 2; pass += 1) {
      const boxes = await page.locator('.route-dock__tool').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
      expect(boxes.length, `${size.width} ${pass}`).toBeGreaterThan(0);
      for (const b of boxes) expect(b.h, `${size.width} ${pass}`).toBeCloseTo(b.w, 1);
      await page.getByRole('button', { name: /^경로 패널 (펼치기|접기)$/ }).click();
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

test('지도 핀은 「내 경로」 창, ⚙ 는 주행 설정 창을 연다 · 왼쪽 메뉴엔 경로 선택·주행 설정 없음', async ({ page }) => {
  await page.goto(`${preview}?state=idle`);
  await page.getByRole('button', { name: '경로 목록', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 경로', exact: true })).toBeVisible();
  await expect(page.locator('.oc-modal__sources button[aria-pressed=true]')).toHaveText('내 경로');
  await page.locator('.oc-modal__close').click();
  await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '주행 설정', exact: true })).toBeVisible();
  await page.goto(`${preview}?state=menu`);
  const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('group', { name: '경로 목록 열기' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '주행 설정', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: '인터벌', exact: true })).toHaveCount(0);
});
