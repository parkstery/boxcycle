import { test, expect, type Page } from '@playwright/test';

// Chief 11-02 D3·v4: 주행 중 5초 무입력 → 오른쪽 2열 4줄 묶음(⏸·⏹ 포함) 숨김, 화면을 누르면 다시.
// 순위 목록은 오른쪽 가장자리 고정(묶음이 그 위에 겹친다). 순위 버튼으로 목록을 열면 2초 만에 숨김. 첫 숨김에 한 번 안내.
const preview = '/scripts/ui-800x360/preview.html';

// 숨김 전환엔 0.3초 지연이 있어 「보임」 검사만으론 막 숨은 상태를 못 잡는다 — 숨김 표식으로 판정한다.
async function expectShown(page: Page) {
  await expect(page.locator('body')).not.toHaveAttribute('data-ride-controls', 'hidden');
  await expect(page.locator('.map-hud__rail')).toBeVisible();
}

/**
 * 시계를 멈춘다 — install 만 하면 가짜 시계가 실시간으로도 흘러, 기다리는 단정(toBeHidden 등)이
 * 몇 초를 기다리는 동안 타이머가 저절로 터져 「2초」·「5초」를 구분하지 못한다(사보타주로 확인).
 * 멈춘 뒤엔 runFor 만 시간을 움직인다.
 */
async function freezeClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 100);
}

async function listRight(page: Page) {
  return page.locator('#lb-glance-panel').evaluate((el) => Math.round(window.innerWidth - el.getBoundingClientRect().right));
}

for (const size of [{ width: 800, height: 360 }, { width: 699, height: 273 }]) {
  test(`주행 중 5초 뒤 숨김·누르면 표시, 왼쪽 아래는 그대로 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`${preview}?state=riding`);
    await freezeClock(page);
    const rail = page.locator('.map-hud__rail');
    const row = page.locator('.route-dock__card');
    const pause = page.getByRole('button', { name: '일시정지', exact: true });
    await page.clock.runFor(4000);
    await expectShown(page);
    await expect(pause).toBeVisible();
    await page.clock.runFor(1500);
    await expect(rail).toBeHidden();
    await expect(pause).toBeHidden();
    // v4: 왼쪽 아래(LED·미니맵 줄)는 숨기지 않는다.
    await expect(row).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '화면을 누르면 버튼이 나타나요' })).toBeVisible();

    await page.mouse.click(size.width / 2, size.height / 2);
    await expect(rail).toBeVisible();
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible();
  });

  test(`순위 버튼으로 목록을 열면 2초 뒤 숨김, 목록은 가장자리 고정 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`${preview}?state=riding`);
    await freezeClock(page);
    const rank = page.getByRole('button', { name: '순위 열기', exact: true });
    await rank.click();
    await expect(page.locator('#lb-glance-panel')).toBeVisible();
    await expect.poll(() => listRight(page)).toBe(8);
    await page.clock.runFor(1800);
    await expectShown(page);
    await page.clock.runFor(400);
    await expect(page.locator('.map-hud__rail')).toBeHidden();
    // 숨어도 목록 자리는 그대로.
    await expect.poll(() => listRight(page)).toBe(8);
    // 다시 보이면 순위 버튼으로 닫을 수 있다(닫을 땐 숨김 예약 없음).
    await page.mouse.click(size.width / 2, size.height / 2);
    await page.getByRole('button', { name: '순위 닫기', exact: true }).click();
    await expect(page.locator('#lb-glance-panel')).toBeHidden();
    await page.clock.runFor(2500);
    await expectShown(page);
  });
}

test('일시정지·카메라 메뉴·펼친 경로 카드가 열려 있으면 숨지 않는다, 안내는 한 번만', async ({ page }) => {
  await page.clock.install();
  await page.goto(`${preview}?state=paused`);
  await page.clock.runFor(10000);
  await expectShown(page);
  await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible();

  await page.goto(`${preview}?state=riding`);
  await page.getByRole('button', { name: /카메라 메뉴/ }).click();
  await page.clock.runFor(10000);
  await expect(page.locator('.camera-view-menu__panel')).toBeVisible();
  await expectShown(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  await page.clock.runFor(10000);
  await expect(page.locator('.route-dock-anchor--open')).toBeVisible();
  await expectShown(page);
  await page.getByRole('button', { name: '경로 패널 접기' }).click();
  await page.clock.runFor(6000);
  await expect(page.locator('.map-hud__rail')).toBeHidden();
  await expect(page.locator('.ride-controls-hint')).toHaveCount(1);

  // 같은 브라우저에서 다시 숨을 땐 안내 없음.
  await page.goto(`${preview}?state=riding`);
  await page.clock.runFor(6000);
  await expect(page.locator('.map-hud__rail')).toBeHidden();
  await expect(page.locator('.ride-controls-hint')).toHaveCount(0);
});
