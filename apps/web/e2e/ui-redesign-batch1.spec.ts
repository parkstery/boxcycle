import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test';

const preview = '/scripts/ui-redesign-batch1/preview.html';

function evidenceDirectory() {
  return process.env.ROUTE_LIST_ONE_LINE_EVIDENCE_DIR || process.env.BATCH1_EVIDENCE_DIR;
}

function listPreviewShot(kind: 'intro' | 'public' | 'saved', width: number, height: number) {
  if (process.env.ROUTE_LIST_ONE_LINE_EVIDENCE_DIR) {
    return `preview-${kind}-${width}x${height}.png`;
  }
  return `batch1-preview-${kind}-${width}x${height}.png`;
}

async function assertOneLineRouteRow(row: Locator) {
  const box = await row.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.height).toBeLessThanOrEqual(40);
  await expect(row.locator('.oc-modal__item-subline, .saved-routes__map-subline')).toHaveCount(0);
  await expect(row.locator('svg.route-list__profile-icon')).toHaveCount(1);
  await expect(row.getByRole('img', { name: /^(자동차|자전거|도보)$/ })).toHaveCount(1);
  const name = row.locator('.oc-modal__item-name, .saved-routes__name').first();
  await expect(name).toHaveCSS('white-space', 'nowrap');
  const visibleText = await row.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('svg.route-list__profile-icon, .oc-modal__item-detail-sr')
      .forEach((node) => node.remove());
    return clone.innerText;
  });
  expect(visibleText).not.toMatch(/자동차|자전거|도보|보행/);
}

async function openMenu(page: Page, query = '') {
  await page.goto(preview + query);
  await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

async function capture(page: Page, info: TestInfo, name: string) {
  const directory = evidenceDirectory();
  if (directory) await fs.mkdir(directory, { recursive: true });
  const file = directory ? path.join(directory, name) : info.outputPath(name);
  await page.screenshot({ path: file, animations: 'disabled' });
}

async function countFullyVisibleSavedRows(saved: Locator) {
  return saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').evaluateAll((els) => {
    const list = els[0]?.closest('[role="listbox"]') as HTMLElement | null;
    if (!list) return 0;
    const listRect = list.getBoundingClientRect();
    return els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.top >= listRect.top - 0.5 && r.bottom <= listRect.bottom + 0.5;
    }).length;
  });
}

async function assertSavedFilterAndToolbarSameLine(saved: Locator) {
  const filter = saved.locator('.saved-routes__filter-btn').first();
  const tool = saved.getByRole('toolbar').getByRole('button', { name: '공개', exact: true });
  await expect(filter).toBeVisible();
  await expect(tool).toBeVisible();
  const filterTop = await filter.evaluate((el) => el.getBoundingClientRect().top);
  const toolTop = await tool.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(filterTop - toolTop)).toBeLessThanOrEqual(4);
}

async function withinViewport(locator: Locator, width: number, height: number) {
  // 메뉴 슬라이드 애니메이션이 끝난 배치에 대해 검사한다.
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    return !!box && box.x >= -1 && box.y >= -1 &&
      box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
  }).toBe(true);
  expect(await locator.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy();
}

for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }, { width: 844, height: 390 }]) {
  test(`메뉴·출처·검색·저장 경로 관리 ${size.width}×${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    const menu = await openMenu(page);
    await expect(menu.locator('.menu-route-nav > li')).toHaveCount(2);
    await expect(menu.getByRole('group', { name: '경로 목록 열기' }).getByRole('button')).toHaveText(['내 경로', '퍼블릭', '입문']);
    await expect(menu.locator('.trail-hub__live-join')).toHaveCount(2);
    await withinViewport(menu, size.width, size.height);
    expect((await menu.boundingBox())!.width).toBe(300);
    if (size.height >= 360) await expect(menu.locator('.trail-hub__live-join').last()).toBeInViewport({ ratio: 1 });
    await capture(page, info, `batch1-preview-menu-${size.width}x${size.height}.png`);
    await menu.getByRole('button', { name: '내 경로', exact: true }).click();
    const sourceNav = page.getByRole('navigation', { name: '경로 출처' });
    await expect(sourceNav.getByRole('button')).toHaveText(['내 경로', '퍼블릭', '입문']);
    await expect(page.getByRole('dialog', { name: '내 경로', exact: true })).toBeVisible();
    await sourceNav.getByRole('button', { name: '입문', exact: true }).click();
    const intro = page.getByRole('dialog', { name: '입문 경로', exact: true });
    await expect(intro.locator('#oc-modal-title')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await withinViewport(intro, size.width, size.height);
    if (size.width === 800) {
      const bounds = await intro.boundingBox();
      expect(bounds!.width).toBe(740);
      expect(bounds!.height).toBe(324);
    }
    await expect(intro).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(intro.locator('.oc-modal__item-name').first()).toHaveCSS('text-shadow', 'none');
    const search = intro.getByRole('searchbox', { name: '경로 이름 검색' });
    await search.fill('없는 경로');
    await expect(intro.locator('.oc-modal__item')).toHaveCount(0);
    await search.fill('파리');
    await expect(intro.locator('.oc-modal__item')).toHaveCount(1);
    await search.clear();
    await expect(intro.locator('.oc-modal__item')).toHaveCount(4);
    await assertOneLineRouteRow(intro.locator('.oc-modal__item--map-row').first());
    await capture(page, info, listPreviewShot('intro', size.width, size.height));
    await intro.getByRole('button', { name: '퍼블릭', exact: true }).click();
    const publicList = page.getByRole('dialog', { name: '퍼블릭 경로', exact: true });
    await expect(publicList).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await publicList.getByRole('combobox', { name: '정렬 기준' }).selectOption('distance');
    await expect(publicList.locator('.oc-modal__item').first()).toContainText('5.00');
    await assertOneLineRouteRow(publicList.locator('.oc-modal__item--map-row').first());
    await capture(page, info, listPreviewShot('public', size.width, size.height));
    await publicList.getByRole('button', { name: '내 경로', exact: true }).click();
    const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
    await expect(saved).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option')).toHaveCount(6);
    const minVisibleRows = size.width <= 667 ? 4 : 6;
    expect(await countFullyVisibleSavedRows(saved)).toBeGreaterThanOrEqual(minVisibleRows);
    await saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').first().click();
    await assertSavedFilterAndToolbarSameLine(saved);
    expect(await saved.locator('.saved-routes__row--map').first().evaluate(el =>
      getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
    expect(await saved.locator('.saved-routes__name').first().evaluate(el =>
      getComputedStyle(el).webkitTextFillColor)).toBe('rgb(23, 34, 56)');
    await saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').filter({ hasText: '한강 이어달리기' }).click();
    await expect(saved.getByRole('button', { name: '이어 달리기', exact: true })).toBeEnabled();
    await withinViewport(saved.getByRole('toolbar'), size.width, size.height);
    const listHeight = await saved.getByRole('listbox').evaluate(el => el.clientHeight);
    expect(listHeight).toBeGreaterThanOrEqual(44);
    await assertOneLineRouteRow(saved.locator('.saved-routes__row--map').first());
    await capture(page, info, listPreviewShot('saved', size.width, size.height));
    await saved.getByRole('button', { name: '이름', exact: true }).click();
    await saved.locator('.saved-routes__rename-input').fill('새 한강 경로');
    await saved.getByRole('button', { name: '저장', exact: true }).click();
    await expect(saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').filter({ hasText: '새 한강 경로' })).toHaveCount(1);
    page.once('dialog', dialog => dialog.accept());
    await saved.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Trail 메뉴', exact: true })).toBeFocused();
  });
}

test('긴 이름·빈 목록·로딩에도 출처 전환과 닫기가 가능하다', async ({ page }, info) => {
  await page.setViewportSize({ width: 667, height: 300 });
  for (const query of ['?long', '?empty', '?loading']) {
    const menu = await openMenu(page, query);
    await menu.getByRole('button', { name: '퍼블릭', exact: true }).click();
    await page.getByRole('navigation', { name: '경로 출처' }).getByRole('button', { name: '퍼블릭', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '퍼블릭 경로', exact: true });
    await withinViewport(dialog, 667, 300);
    if (query === '?empty') await expect(dialog).toContainText('퍼블릭 경로 없음');
    if (query === '?loading') await expect(dialog).toContainText('불러오는 중');
    await capture(page, info, `batch1-preview-public-${query.slice(1)}.png`);
    await dialog.getByRole('button', { name: '내 경로', exact: true }).click();
    const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
    await withinViewport(saved, 667, 300);
    if (query === '?empty') await expect(saved).toContainText('사용자 경로가 없습니다');
    if (query === '?long') {
      const row = saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').filter({ hasText: '대한민국 서울특별시' });
      await row.click();
      await expect(saved.getByRole('button', { name: '열기', exact: true })).toBeEnabled();
      await withinViewport(saved.getByRole('toolbar'), 667, 300);
    }
    await capture(page, info, `batch1-preview-saved-${query.slice(1)}.png`);
    await saved.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(menu).toBeVisible();
  }
});

test('행 선택·이어달리기·합류·설정 콜백을 실제 제품 버튼으로 호출한다', async ({ page }) => {
  const menu = await openMenu(page);
  await menu.locator('.trail-hub__live-join').first().click();
  await expect(page.getByRole('status', { name: '검증 결과' })).toContainText('합류');
  await menu.getByRole('button', { name: '주행 설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  await expect(settings).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  await page.keyboard.press('Enter');
  await menu.getByRole('button', { name: '입문', exact: true }).click();
  await page.getByRole('dialog', { name: '입문 경로', exact: true }).getByRole('button', { name: '입문', exact: true }).click();
  await page.getByRole('dialog', { name: '입문 경로', exact: true }).locator('.oc-modal__item').first().click();
  await expect(page.getByRole('dialog', { name: '입문 경로', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  await page.keyboard.press('Enter');
  await menu.getByRole('button', { name: '내 경로', exact: true }).click();
  const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
  await saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').filter({ hasText: '한강 이어달리기' }).click();
  await saved.getByRole('button', { name: '이어 달리기', exact: true }).click();
  await expect(page.getByRole('status', { name: '검증 결과' })).toHaveText('이어 달리기');
});
