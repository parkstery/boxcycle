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
  expect(box!.height).toBeLessThanOrEqual(27);
  await expect(row.locator('.oc-modal__item-subline, .saved-routes__map-subline')).toHaveCount(0);
  await expect(row.locator('svg.route-list__profile-icon')).toHaveCount(1);
  await expect(row.getByRole('img', { name: /^(자동차|자전거|도보)$/ })).toHaveCount(1);
  const name = row.locator('.oc-modal__item-name, .saved-routes__name').first();
  await expect(name).toHaveCSS('white-space', 'nowrap');
  expect(await name.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(15 - 8 / 3, 2);
  const columns = await row.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').slice(-2));
  expect(columns).toEqual(['64px', '64px']);
  await expect(row).toHaveCSS('column-gap', '4px');
  const sizes = await row.locator('.oc-modal__item-status, .oc-modal__item-distance, .oc-modal__item-distance-unit, .saved-routes__map-status, .saved-routes__map-distance, .saved-routes__map-distance-unit').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
  for (const size of sizes) expect(size).toBeCloseTo(15 - 8 / 3, 2);

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
    // 10-30 Chief: 메뉴는 Trail 전용 — 경로 선택·주행 설정·인터벌 행 없음.
    await expect(menu.locator('.menu-route-nav > li')).toHaveCount(0);
    await expect(menu.getByRole('group', { name: '경로 목록 열기' })).toHaveCount(0);
    await expect(menu.locator('.trail-hub__live-join')).toHaveCount(2);
    await withinViewport(menu, size.width, size.height);
    expect((await menu.boundingBox())!.width).toBe(300);
    if (size.height >= 360) await expect(menu.locator('.trail-hub__live-join').last()).toBeInViewport({ ratio: 1 });
    await capture(page, info, `batch1-preview-menu-${size.width}x${size.height}.png`);
    await menu.getByRole('button', { name: '메뉴 닫기', exact: true }).first().click();
    await page.getByRole('button', { name: '경로 목록', exact: true }).click();
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
      expect(bounds!.width).toBe(690);
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
    await expect(publicList.locator('.oc-modal__list--map')).toHaveCSS('overflow-x', 'hidden');
    await expect(publicList.locator('.oc-modal__list--map')).toHaveCSS('overflow-y', 'auto');
    await publicList.getByRole('combobox', { name: '정렬 기준' }).selectOption('distance');
    await expect(publicList.locator('.oc-modal__item').first()).toContainText('5.00');
    await assertOneLineRouteRow(publicList.locator('.oc-modal__item--map-row').first());
    await capture(page, info, listPreviewShot('public', size.width, size.height));
    await publicList.getByRole('button', { name: '내 경로', exact: true }).click();
    const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
    await expect(saved).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const filterSizing = await saved.locator('.saved-routes__filter-btn').evaluateAll(buttons => buttons.map(button => {
      const el = button as HTMLElement;
      const label = el.querySelector('.saved-routes__filter-label') as HTMLElement;
      const sizing = el.querySelector('.saved-routes__filter-size') as HTMLElement;
      const current = el.getBoundingClientRect().width;
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      el.style.padding = '0 0.38rem';
      el.style.fontSize = '0.68rem';
      label.style.position = 'static';
      sizing.style.display = 'none';
      const original = el.getBoundingClientRect().width;
      el.removeAttribute('style'); label.removeAttribute('style'); sizing.removeAttribute('style');
      return { ratio: current / original, fontSize, current, original };
    }));
    const rootFontSize = await page.locator("html").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    for (const sizing of filterSizing) {
      expect(Math.abs(sizing.ratio - 1.4)).toBeLessThan(0.015);
      expect(sizing.fontSize).toBeCloseTo(rootFontSize * 0.68 + 8 / 3, 2);
    }
    const sortRatio = await saved.locator('.route-sort__select').evaluate(select => {
      const el = select as HTMLElement;
      const current = el.getBoundingClientRect().width;
      el.style.width = 'auto'; el.style.maxWidth = '4.6rem'; el.style.fontSize = '0.68rem';
      const original = el.getBoundingClientRect().width;
      el.removeAttribute('style');
      return current / original;
    });
    expect(sortRatio).toBeCloseTo(1.2, 2);
    const sortFont = await saved.locator('.route-sort__select').evaluate(el => getComputedStyle(el).fontSize);
    await expect(saved.locator('.saved-routes__filter-btn').first()).toHaveCSS('font-size', sortFont);


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
    // 10-30 Chief: 경로 목록은 지도 핀에서 열므로 닫으면 메뉴가 아니라 지도로 돌아온다.
    await expect(menu).toBeHidden();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '경로 목록', exact: true })).toBeFocused();
  });
}

test('긴 이름·빈 목록·로딩에도 출처 전환과 닫기가 가능하다', async ({ page }, info) => {
  await page.setViewportSize({ width: 667, height: 300 });
  for (const query of ['?long', '?empty', '?loading']) {
    const menu = await openMenu(page, query);
    await menu.getByRole('button', { name: '메뉴 닫기', exact: true }).first().click();
    await page.getByRole('button', { name: '경로 목록', exact: true }).click();
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
    await expect(menu).toBeHidden();
  }
});

test('행 선택·이어달리기·합류·설정 콜백을 실제 제품 버튼으로 호출한다', async ({ page }) => {
  const menu = await openMenu(page);
  await menu.locator('.trail-hub__live-join').first().click();
  await expect(page.getByRole('status', { name: '검증 결과' })).toContainText('합류');
  await expect(menu.getByRole('button', { name: '주행 설정', exact: true })).toHaveCount(0);
  await menu.getByRole('button', { name: '메뉴 닫기', exact: true }).first().click();
  await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  await expect(settings).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '경로 목록', exact: true }).click();
  await page.getByRole('navigation', { name: '경로 출처' }).getByRole('button', { name: '입문', exact: true }).click();
  await page.getByRole('dialog', { name: '입문 경로', exact: true }).getByRole('button', { name: '입문', exact: true }).click();
  await page.getByRole('dialog', { name: '입문 경로', exact: true }).locator('.oc-modal__item').first().click();
  await expect(page.getByRole('dialog', { name: '입문 경로', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '경로 목록', exact: true }).click();
  const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
  await saved.getByRole('listbox', { name: '사용자 경로 목록' }).getByRole('option').filter({ hasText: '한강 이어달리기' }).click();
  await saved.getByRole('button', { name: '이어 달리기', exact: true }).click();
  await expect(page.getByRole('status', { name: '검증 결과' })).toHaveText('이어 달리기');
});

for (const viewport of [{ width: 667, height: 300 }, { width: 800, height: 360 }, { width: 1280, height: 720 }]) {
  test(`목록 검수: 실제 개수·조작부 겹침·가림 ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto(preview + '?long');
    await page.getByRole('button', { name: '경로 목록', exact: true }).click();
    const saved = page.getByRole('dialog', { name: '내 경로', exact: true });
    await saved.locator('.saved-routes__filter-btn').evaluateAll(buttons => {
      ['전체 (50)', '완주 (41)', '미완주 (3)', '대기 (6)'].forEach((text, i) => {
        buttons[i].querySelectorAll('span').forEach(span => { span.textContent = text; });
      });
    });
    const filterRight = await saved.locator('.saved-routes__filter-btn').last().evaluate(el => el.getBoundingClientRect().right);
    const actionsLeft = await saved.locator('.saved-routes__controls-actions').evaluate(el => el.getBoundingClientRect().left);
    expect(filterRight, '필터와 정렬/관리 버튼이 겹치지 않음').toBeLessThanOrEqual(actionsLeft);
    await capture(page, info, `audit-saved-${viewport.width}x${viewport.height}.png`);
    await saved.getByRole('button', { name: '퍼블릭', exact: true }).click();
    const publicList = page.getByRole('dialog', { name: '퍼블릭 경로', exact: true });
    const list = publicList.locator('.oc-modal__list--map');
    await expect(list).toHaveCSS('overflow-x', 'hidden');
    const geometry = await list.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return { width: el.clientWidth, scrollWidth: el.scrollWidth,
        distancesVisible: [...el.querySelectorAll('.oc-modal__item-distance')].every(node => {
          const rect = node.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right + 1;
        }) };
    });
    expect(geometry.distancesVisible, '오른쪽 거리 열을 잘라 숨기지 않음').toBe(true);
    expect(geometry.scrollWidth, '실제 가로 넘침 없음').toBeLessThanOrEqual(geometry.width + 1);
    await capture(page, info, `audit-public-${viewport.width}x${viewport.height}.png`);
  });
}
