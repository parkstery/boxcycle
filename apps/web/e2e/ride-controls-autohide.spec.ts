import { test, expect, type Page } from '@playwright/test';

// Chief 11-02 D3·D4: 주행 중 5초 무입력 → 오른쪽 레일·왼쪽 아래 접힌 줄(⏸ 포함) 숨김, 화면을 누르면 다시.
// 순위 목록은 숨김 때 오른쪽 가장자리(반달 손잡이 왼쪽 26px), 보일 때 레일 옆(100px). 첫 숨김에 한 번 안내.
const preview = '/scripts/ui-800x360/preview.html';

// 숨김 전환엔 0.3초 지연이 있어 「보임」 검사만으론 막 숨은 상태를 못 잡는다 — 숨김 표식으로 판정한다.
async function expectShown(page: Page) {
  await expect(page.locator('body')).not.toHaveAttribute('data-ride-controls', 'hidden');
  await expect(page.locator('.map-hud__rail')).toBeVisible();
}

async function listRight(page: Page) {
  return page.locator('#lb-glance-panel').evaluate((el) => Math.round(window.innerWidth - el.getBoundingClientRect().right));
}

for (const size of [{ width: 800, height: 360 }, { width: 699, height: 273 }]) {
  test(`주행 중 5초 뒤 숨김·누르면 표시·순위 목록 이동 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.clock.install();
    await page.goto(`${preview}?state=riding`);
    const rail = page.locator('.map-hud__rail');
    const row = page.locator('.route-dock__card');
    const pause = page.getByRole('button', { name: '일시정지', exact: true });
    if (!(await page.locator('#lb-glance-panel:not([hidden])').count())) await page.getByRole('button', { name: '순위 열기', exact: true }).click({ force: true });
    await page.clock.runFor(4000);
    await expectShown(page);
    await expect(pause).toBeVisible();
    await page.clock.runFor(1500);
    await expect(rail).toBeHidden();
    await expect(row).toBeHidden();
    await expect(pause).toBeHidden();
    await expect.poll(() => listRight(page)).toBe(26);
    await expect(page.getByRole('status').filter({ hasText: '화면을 누르면 버튼이 나타나요' })).toBeVisible();
    // 반달 손잡이는 목록에 가리지 않는다.
    const knob = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
    const list = (await page.locator('#lb-glance-panel').boundingBox())!;
    expect(knob.x).toBeGreaterThanOrEqual(list.x + list.width);

    await page.mouse.click(size.width / 2, size.height / 2);
    await expect(rail).toBeVisible();
    await expect(pause).toBeVisible();
    await expect.poll(() => listRight(page)).toBe(100);
    await pause.click();
    await expect(page.getByRole('button', { name: '재개', exact: true })).toBeVisible();
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
