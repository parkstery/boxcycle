import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const preview = '/scripts/ui-800x360/preview.html';
const evidenceDir = process.env.COMPACT_CONTROLS_EVIDENCE_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../document/ops/20261028-compact-controls/evidence/rework');
const sizes = [
  { width: 800, height: 360 },
  { width: 736, height: 300 },
  { width: 699, height: 273 },
  { width: 667, height: 300 },
] as const;

async function saveShot(page: Page, name: string) {
  await fs.mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, name), animations: 'disabled' });
}

async function panelBounds(panel: ReturnType<Page['locator']>) {
  return panel.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const parent = el.parentElement;
    return {
      width: box.width,
      height: box.height,
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      scroll: el.scrollHeight,
      client: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      parentOverflow: parent ? getComputedStyle(parent).overflow : '',
      inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
    };
  });
}

async function assertReachable(locator: ReturnType<Page['locator']>) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  const visible = await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.height > 0 && box.top >= -1 && box.bottom <= innerHeight + 1 && box.left >= -1 && box.right <= innerWidth + 1;
  });
  expect(visible, await locator.textContent()).toBe(true);
}

async function settingsGeometry(panel: ReturnType<Page['locator']>) {
  return panel.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const interesting = [...el.querySelectorAll('h2, button, [role="switch"], label, small, p, .ride-settings-panel__interval, .ride-settings-panel__calories')];
    const clipped = interesting.filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
    }).map((node) => (node.textContent ?? '').trim().slice(0, 48));
    const nestedScroll = [...el.querySelectorAll('*')].some((node) => {
      if (node === el) return false;
      const style = getComputedStyle(node);
      const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
      return scrolls && node.scrollHeight > node.clientHeight + 1;
    });
    return {
      width: box.width,
      height: box.height,
      scroll: el.scrollHeight,
      client: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
      clipped,
      nestedScroll,
    };
  });
}

function overlap(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe('compact-controls v2', () => {
  for (const size of sizes) {
    test(`순위 10명 440×236 두 열 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=leaderboard`);
      const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('status')).toHaveCount(0);
      const panel = sheet.locator('.leaderboard-sheet__panel');
      const geometry = await panel.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const rows = [...el.querySelectorAll<HTMLElement>('.leaderboard-sheet__list > .leaderboard-sheet__row')];
        const names = rows.map((row) => row.querySelector('.leaderboard-sheet__name')?.textContent ?? '');
        return {
          width: box.width,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          scroll: el.scrollHeight,
          client: el.clientHeight,
          rowCount: rows.length,
          names,
          inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
          rowsInside: rows.every((row) => {
            const r = row.getBoundingClientRect();
            return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
          }),
          columns: rows.slice(0, 5).every((row, i) => {
            const left = row.getBoundingClientRect();
            const right = rows[i + 5]?.getBoundingClientRect();
            return !right || left.right <= right.left + 1;
          }),
        };
      });
      expect(geometry.rowCount, '가짜 행 없이 데이터 10명').toBe(10);
      expect(geometry.names.some((name) => name.startsWith('placeholder') || name.includes('예시'))).toBe(false);
      expect(geometry.width).toBeLessThanOrEqual(440 + 1);
      expect(geometry.height).toBeCloseTo(236, 0);
      expect(geometry.inside).toBe(true);
      expect(geometry.rowsInside).toBe(true);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      expect(geometry.columns).toBe(true);
      expect(geometry.right).toBeGreaterThan(size.width * 0.45);
      await expect(sheet.getByRole('button', { name: '같이 달리기' })).toHaveCount(1);
      if (size.width === 699) await saveShot(page, `rank-10-${size.width}x${size.height}.png`);
    });
  }

  test('순위 20·3·0·게스트·오류·내 주변', async ({ page }) => {
    await page.setViewportSize({ width: 699, height: 273 });
    await page.goto(`${preview}?state=leaderboard&lb=twenty`);
    const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
    await expect(sheet.locator('.leaderboard-sheet__list > .leaderboard-sheet__row')).toHaveCount(10);
    await sheet.getByText('10위 이후 · 내 주변').click();
    await expect(sheet.locator('.leaderboard-sheet__more-list .leaderboard-sheet__row')).toHaveCount(10);

    await page.goto(`${preview}?state=leaderboard&lb=three`);
    await expect(sheet.locator('.leaderboard-sheet__list > .leaderboard-sheet__row')).toHaveCount(3);

    await page.goto(`${preview}?state=leaderboard&lb=empty`);
    await expect(sheet.getByText('기록이 없습니다')).toBeVisible();
    await expect(sheet.locator('.leaderboard-sheet__row')).toHaveCount(0);

    await page.goto(`${preview}?state=leaderboard&lb=guest`);
    await expect(sheet.getByRole('button', { name: 'Google 계정으로 회원 등록' })).toBeVisible();

    await page.goto(`${preview}?state=leaderboard&lb=unranked`);
    await expect(sheet.getByText('순위 없음')).toBeVisible();

    await page.goto(`${preview}?state=leaderboard&lb=error`);
    await expect(sheet.getByRole('alert')).toContainText('리더보드를 불러오지 못했습니다');

    await page.goto(`${preview}?state=leaderboard&lb=nologin`);
    await expect(sheet.getByRole('alert')).toContainText('로그인이 필요합니다');

    await page.goto(`${preview}?state=leaderboard&lb=around`);
    await expect(sheet.locator('.leaderboard-sheet__list > .leaderboard-sheet__row')).toHaveCount(10);
    await sheet.getByText('10위 이후 · 내 주변').click();
    await expect(sheet.locator('.leaderboard-sheet__more-list .leaderboard-sheet__row')).toHaveCount(5);
  });

  test('개척 보조 정보와 긴 닉네임 툴팁', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto(`${preview}?state=leaderboard`);
    const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
    await sheet.getByRole('button', { name: '개척', exact: true }).click();
    await expect(sheet.getByText('내 길 이용 · 새 도로')).toBeVisible();
    await sheet.getByText('내 길 이용 · 새 도로').click();
    await expect(sheet.getByText('내 길을')).toBeVisible();
    const longName = sheet.locator('.leaderboard-sheet__name', { hasText: '아주긴닉네임' });
    await expect(longName).toHaveAttribute('title', '아주긴닉네임라이더테스트넘침확인용');
    await sheet.getByRole('button', { name: '같이 달리기' }).click();
    await expect(page.locator('#lb-fixture')).toHaveAttribute('data-lb-join-calls', '1');
  });

  test('개척 보조·추가 순위·게스트 경계와 최하단 접근', async ({ page }) => {
    await page.setViewportSize({ width: 699, height: 273 });
    await page.goto(`${preview}?state=leaderboard`);
    const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
    const panel = sheet.locator('.leaderboard-sheet__panel');
    await sheet.getByRole('button', { name: '개척', exact: true }).click();
    await sheet.getByText('내 길 이용 · 새 도로').click();
    expect((await panelBounds(panel)).inside).toBe(true);
    expect((await panelBounds(panel)).parentOverflow).not.toContain('hidden');
    await assertReachable(sheet.locator('.leaderboard-sheet__footnote'));
    await saveShot(page, 'pioneer-uses-open-699x273.png');

    await page.goto(`${preview}?state=leaderboard&lb=twenty`);
    await sheet.getByText('10위 이후 · 내 주변').click();
    expect((await panelBounds(panel)).inside).toBe(true);
    await assertReachable(sheet.locator('.leaderboard-sheet__more-list .leaderboard-sheet__row').last());
    await assertReachable(sheet.locator('.leaderboard-sheet__footnote'));
    await saveShot(page, 'rank-extra-open-699x273.png');

    await page.goto(`${preview}?state=leaderboard&lb=guest`);
    expect((await panelBounds(panel)).inside).toBe(true);
    await assertReachable(sheet.getByRole('button', { name: 'Google 계정으로 회원 등록' }));
    await assertReachable(sheet.locator('.leaderboard-sheet__footnote'));
    await saveShot(page, 'guest-699x273.png');

    await page.goto(`${preview}?state=leaderboard&lb=unranked`);
    expect((await panelBounds(panel)).inside).toBe(true);
    await assertReachable(sheet.getByText('순위 없음'));
    await assertReachable(sheet.locator('.leaderboard-sheet__footnote'));
  });

  test('행별 개척 이용은 접기에서 터치로 확인', async ({ page }) => {
    await page.setViewportSize({ width: 699, height: 273 });
    await page.goto(`${preview}?state=leaderboard`);
    const sheet = page.getByRole('dialog', { name: '리더보드', exact: true });
    await sheet.getByRole('button', { name: '개척', exact: true }).click();
    await sheet.getByText('내 길 이용 · 새 도로').click();
    const usesList = sheet.getByRole('list', { name: '참가자 길 이용' });
    await expect(usesList).toBeVisible();
    await expect(usesList).toContainText('geum');
    await expect(usesList).toContainText('8명');
    await expect(usesList).toContainText('homeeg');
    await expect(usesList).toContainText('4명');
    await expect(sheet.getByText('이름에 올려')).toHaveCount(0);

    await page.goto(`${preview}?state=leaderboard&lb=twenty`);
    await sheet.getByRole('button', { name: '개척', exact: true }).click();
    await sheet.getByText('내 길 이용 · 새 도로').click();
    await expect(sheet.getByRole('list', { name: '참가자 길 이용' })).toContainText('northend');

    await page.goto(`${preview}?state=leaderboard&lb=around`);
    await sheet.getByRole('button', { name: '개척', exact: true }).click();
    await sheet.getByText('내 길 이용 · 새 도로').click();
    const aroundList = sheet.getByRole('list', { name: '참가자 길 이용' });
    await expect(aroundList).toContainText('cityloop');
    await expect(aroundList).toContainText('parkway');
  });

  for (const size of sizes) {
    test(`주행 설정 두 열 스크롤 0 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=settings`);
      const dialog = page.getByRole('dialog', { name: '주행 설정', exact: true });
      const panel = dialog.locator('.ride-settings-sheet__panel');
      await panel.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
      });
      const geometry = await panel.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const labels = [...el.querySelectorAll('.ride-settings-panel__choice span > span, .ride-settings-panel__choice .ride-settings-panel__copy > span')].map((n) => n.textContent?.trim());
        return {
          width: box.width,
          height: box.height,
          scroll: el.scrollHeight,
          client: el.clientHeight,
          overflow: getComputedStyle(el).overflowY,
          inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
          labels,
        };
      });
      expect(geometry.inside).toBe(true);
      expect(geometry.width).toBeLessThanOrEqual(460 + 1);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      expect(geometry.labels).toEqual(expect.arrayContaining(['코칭 문구', '음성 안내', '배경 음악', '페이서', '효과음']));
      await expect(dialog.getByRole('button', { name: '운동 설정', exact: true })).toHaveCount(0);
      await expect(dialog.getByRole('switch', { name: '인터벌' })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: '프로필 수정', exact: true })).toBeVisible();
      if (size.width === 699) await saveShot(page, `settings-${size.width}x${size.height}.png`);
    });
  }

  test('설정 토글·긴 값·운동/프로필 왕복', async ({ page }) => {
    await page.setViewportSize({ width: 699, height: 273 });
    await page.goto(`${preview}?state=settings`);
    const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
    await settings.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
    await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '인터벌', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('switch', { name: '인터벌' }).check();
    await expect(editor.getByRole('switch', { name: '인터벌' })).toBeChecked();
    await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
    await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '주행 설정', exact: true }).click();
    await expect(settings).toBeVisible();
    await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
    const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
    await expect(profile).toBeVisible();
    await profile.locator('.settings-surface__close').click();
    await expect(settings).toBeVisible();
  });

  for (const size of [{ width: 699, height: 273 }, { width: 667, height: 300 }] as const) {
    test(`설정 스트레스 긴 값 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=settings&settingsStress`);
      const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
      const panel = settings.locator('.ride-settings-sheet__panel');
      await panel.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
      });
      const geometry = await settingsGeometry(panel);
      expect(geometry.inside).toBe(true);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      expect(geometry.nestedScroll).toBe(false);
      expect(geometry.clipped).toEqual([]);
      await expect(settings.getByRole('switch', { name: '배경 음악' })).toBeDisabled();
      await expect(settings.getByText('준비 중')).toBeVisible();
      await expect(settings.getByText('고도 프로필 로드 중…')).toBeVisible();
      await expect(settings.getByText('프로필에 체중을 입력하세요')).toBeVisible();
      await expect(settings.getByText(/체력을 선택하세요/)).toBeVisible();
      if (size.width === 699) await saveShot(page, 'settings-stress-699x273.png');

      await settings.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
      await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '인터벌', exact: true }).click();
      const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
      await expect(editor).toBeVisible();
      const fold = editor.getByRole('button', { name: '접기', exact: true });
      if (await fold.count()) await fold.click();
      await expect(editor.getByText(/600초 \/ 600초 ×30/)).toBeVisible();
      await expect(editor.getByText(/3라운드/)).toBeVisible();
      await expect(editor.getByText(/준비 30분/)).toBeVisible();
      await expect(editor.getByText(/마무리 30분/)).toBeVisible();
      await editor.getByRole('button', { name: '직접 조절', exact: true }).click();
      const editorBox = await editor.locator('.ride-interval-settings__panel').evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
          scroll: el.scrollHeight,
          client: el.clientHeight,
        };
      });
      expect(editorBox.inside).toBe(true);
      await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
      await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '주행 설정', exact: true }).click();
      await expect(settings).toBeVisible();

      await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
      const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
      await expect(profile).toBeVisible();
      const profileBox = await profile.locator('.settings-surface__panel').evaluate((el) => {
        const box = el.getBoundingClientRect();
        const clipped = [...el.querySelectorAll('button, input, label, p, h2')].filter((node) => {
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
        }).map((node) => (node.textContent ?? '').trim().slice(0, 40));
        return {
          inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
          scroll: el.scrollHeight,
          client: el.clientHeight,
          clipped,
        };
      });
      expect(profileBox.inside).toBe(true);
      expect(profileBox.clipped).toEqual([]);
      expect(profileBox.scroll).toBeLessThanOrEqual(profileBox.client + 2);
      await profile.locator('.settings-surface__close').click();
      await expect(settings).toBeVisible();
    });
  }

  for (const size of sizes) {
    test(`단일 카메라 두 열 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=riding`);
      const trigger = page.getByRole('button', { name: /카메라 메뉴/ });
      await expect(trigger).toHaveCount(1);
      await trigger.click();
      const menu = page.getByRole('menu', { name: '카메라 선택' });
      await expect(menu).toBeVisible();
      const box = await menu.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const flat = el.querySelector('.camera-view-menu__unit--flat')!.getBoundingClientRect();
        const six = el.querySelector('[data-camera-slot="6"]')!.getBoundingClientRect();
        const terrain = el.querySelector('.camera-view-menu__item--terrain')!.getBoundingClientRect();
        return {
          width: r.width,
          inside: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
          flatWidth: flat.width,
          terrainBelow: terrain.top >= six.bottom - 1,
        };
      });
      expect(box.width).toBeCloseTo(154, 0);
      expect(box.flatWidth).toBeCloseTo(62, 0);
      expect(box.inside).toBe(true);
      expect(box.terrainBelow).toBe(true);
      if (size.width === 699) await saveShot(page, `camera-open-${size.width}x${size.height}.png`);
      await menu.getByRole('menuitemradio', { name: /^카메라 4/ }).click();
      await expect(menu).toHaveCount(0);
      await expect(trigger).toContainText('4');
      await trigger.click();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }

  for (const size of sizes) {
    test(`반달 60%·지도 터치 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=riding`);
      const measured = await page.evaluate(() => {
        const knobs = ['left', 'right'].map((side) => {
          const tab = document.querySelector(`.edge-panel-tab--${side}`)!;
          const knob = tab.querySelector('.edge-panel-tab__knob')!;
          return { side, tab: tab.getBoundingClientRect().toJSON(), knob: knob.getBoundingClientRect().toJSON() };
        });
        const others = ['.route-dock__card', '.route-minimap'].flatMap((sel) => {
          const el = document.querySelector(sel);
          if (!el) return [];
          const r = el.getBoundingClientRect();
          if (r.width <= 0) return [];
          if (sel === '.route-dock__card' && r.width <= 32 && r.height <= 32) return [];
          return [{ sel, ...r.toJSON() }];
        });
        return { knobs, others };
      });
      for (const tab of measured.knobs) {
        expect(tab.knob.width, tab.side).toBeCloseTo(20.4, 1);
        expect(tab.knob.height, tab.side).toBeCloseTo(43.2, 1);
        expect(tab.tab.width * tab.tab.height).toBeGreaterThanOrEqual(44 * 76 - 1);
        for (const other of measured.others) {
          expect(overlap(tab.knob, other), `${tab.side} vs ${other.sel}`).toBe(false);
        }
      }
      await page.getByRole('button', { name: '순위 열기', exact: true }).click();
      await expect(page.locator('#lb-glance-panel')).toBeVisible();
      if (size.width === 699) await saveShot(page, `edges-${size.width}x${size.height}.png`);
    });
  }

  test('우상단 계정·카메라 비겹침', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 300 });
    await page.goto(`${preview}?state=riding`);
    const hit = await page.evaluate(() => {
      const a = document.querySelector('.camera-view-menu')!.getBoundingClientRect();
      const b = document.querySelector('.hud-account')!.getBoundingClientRect();
      const c = document.querySelector('.hud-ride-map-controls')!.getBoundingClientRect();
      const overlapBox = (x: DOMRect, y: DOMRect) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
      return { cameraAccount: overlapBox(a, b), cameraMap: overlapBox(a, c), accountMap: overlapBox(b, c) };
    });
    expect(hit).toEqual({ cameraAccount: false, cameraMap: false, accountMap: false });
  });
});

const tapEvidenceDir = process.env.TAP_HANDLES_EVIDENCE_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../document/ops/20261028-compact-controls/evidence/tap-handles');
const tapSizes = [
  { width: 800, height: 360 },
  { width: 699, height: 273 },
  { width: 667, height: 300 },
] as const;
const LEFT_CLOSED = 'M2 1.5L5 5L2 8.5';
const LEFT_OPEN = 'M5 1.5L2 5L5 8.5';
const RIGHT_CLOSED = 'M5 1.5L2 5L5 8.5';
const RIGHT_OPEN = 'M2 1.5L5 5L2 8.5';

async function saveTapShot(page: Page, name: string) {
  await fs.mkdir(tapEvidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(tapEvidenceDir, name), animations: 'disabled' });
}

async function caretPath(page: Page, side: 'left' | 'right') {
  return page.locator(`.edge-panel-tab--${side} path`).getAttribute('d');
}

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const client = await page.context().newCDPSession(page);
  const steps = 10;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y, id: 0 }],
  });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 0 }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

function knobCenter(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('compact-controls tap handles', () => {
  for (const size of tapSizes) {
    test(`양쪽 탭 열고닫기·위치·캐럿 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=ready`);
      const menuBtn = page.getByRole('button', { name: '메뉴 열기', exact: true });
      const rankBtn = page.getByRole('button', { name: '순위 열기', exact: true });
      const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
      const rank = page.locator('#lb-glance-panel');

      const leftClosed = (await page.locator('.edge-panel-tab--left').boundingBox())!;
      const rightClosed = (await page.locator('.edge-panel-tab--right').boundingBox())!;
      expect(await caretPath(page, 'left')).toBe(LEFT_CLOSED);
      expect(await caretPath(page, 'right')).toBe(RIGHT_CLOSED);

      await menuBtn.click();
      await expect(menu).toBeVisible();
      const leftOpen = (await page.locator('.edge-panel-tab--left').boundingBox())!;
      expect(Math.abs(leftOpen.x - leftClosed.x), '왼쪽 x').toBeLessThanOrEqual(1);
      expect(Math.abs(leftOpen.y - leftClosed.y), '왼쪽 y').toBeLessThanOrEqual(1);
      expect(await caretPath(page, 'left')).toBe(LEFT_OPEN);
      const knob = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return Boolean(el?.closest('.edge-panel-tab--left'));
      }, knobCenter(knob));
      expect(hit, '열린 왼쪽 반달이 메뉴·스크림 위').toBe(true);
      await menuBtn.click();
      await expect(menu).toHaveCount(0);
      expect(await caretPath(page, 'left')).toBe(LEFT_CLOSED);

      await rankBtn.click();
      await expect(rank).toBeVisible();
      const rightOpen = (await page.locator('.edge-panel-tab--right').boundingBox())!;
      expect(Math.abs(rightOpen.x - rightClosed.x), '오른쪽 x').toBeLessThanOrEqual(1);
      expect(Math.abs(rightOpen.y - rightClosed.y), '오른쪽 y').toBeLessThanOrEqual(1);
      expect(await caretPath(page, 'right')).toBe(RIGHT_OPEN);
      await rankBtn.click();
      await expect(rank).toBeHidden();
      expect(await caretPath(page, 'right')).toBe(RIGHT_CLOSED);

      if (size.width === 699) {
        await saveTapShot(page, `tap-closed-${size.width}x${size.height}.png`);
        await menuBtn.click();
        await saveTapShot(page, `tap-left-open-${size.width}x${size.height}.png`);
        await menuBtn.click();
        await rankBtn.click();
        await saveTapShot(page, `tap-right-open-${size.width}x${size.height}.png`);
      }
    });
  }

  test('Enter·Space로 왼쪽 열고 닫기', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto(`${preview}?state=ready`);
    const menuBtn = page.getByRole('button', { name: '메뉴 열기', exact: true });
    const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
    await menuBtn.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await menuBtn.focus();
    await expect(menuBtn).toBeFocused();
    await page.keyboard.press('Space');
    await expect(menu).toHaveCount(0);
  });

  test('마우스: 닫힌/열린 반달·빈 가장자리 드래그는 상태 불변', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto(`${preview}?state=ready`);
    const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
    const rank = page.locator('#lb-glance-panel');
    const left = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    const right = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
    await mouseDrag(page, knobCenter(left), { x: left.x + 140, y: left.y + left.height / 2 });
    await expect(menu, '닫힌 왼쪽 반달 드래그').toHaveCount(0);
    await mouseDrag(page, knobCenter(right), { x: right.x - 140, y: right.y + right.height / 2 });
    await expect(rank, '닫힌 오른쪽 반달 드래그').toBeHidden();
    await mouseDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
    await expect(menu, '닫힌 빈 가장자리 드래그').toHaveCount(0);

    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await expect(menu).toBeVisible();
    const leftOpen = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    await mouseDrag(page, knobCenter(leftOpen), { x: leftOpen.x + 140, y: leftOpen.y + leftOpen.height / 2 });
    await expect(menu, '열린 왼쪽 반달 드래그').toBeVisible();
    await mouseDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
    await expect(menu, '열린 빈 가장자리 드래그').toBeVisible();
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();

    await page.getByRole('button', { name: '순위 열기', exact: true }).click();
    await expect(rank).toBeVisible();
    const rightOpen = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
    await mouseDrag(page, knobCenter(rightOpen), { x: rightOpen.x - 140, y: rightOpen.y + rightOpen.height / 2 });
    await expect(rank, '열린 오른쪽 반달 드래그').toBeVisible();
  });
});

test.describe('compact-controls tap handles touch', () => {
  test.use({ hasTouch: true });

  test('터치: 탭으로 열고 반달·빈 가장자리 드래그는 상태 불변', async ({ page }) => {
    await page.setViewportSize({ width: 699, height: 273 });
    await page.goto(`${preview}?state=ready`);
    const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
    const rank = page.locator('#lb-glance-panel');
    const left = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    const right = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;

    await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
    await expect(menu).toBeVisible();
    await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
    await expect(menu).toHaveCount(0);

    await page.touchscreen.tap(right.x + right.width / 2, right.y + right.height / 2);
    await expect(rank).toBeVisible();
    await page.touchscreen.tap(right.x + right.width / 2, right.y + right.height / 2);
    await expect(rank).toBeHidden();

    await touchDrag(page, knobCenter(left), { x: left.x + 140, y: left.y + left.height / 2 });
    await expect(menu, '터치 왼쪽 반달 드래그').toHaveCount(0);
    await touchDrag(page, knobCenter(right), { x: right.x - 140, y: right.y + right.height / 2 });
    await expect(rank, '터치 오른쪽 반달 드래그').toBeHidden();
    await touchDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
    await expect(menu, '터치 빈 가장자리 드래그').toHaveCount(0);

    await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
    await expect(menu).toBeVisible();
    const leftOpen = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
    await touchDrag(page, knobCenter(leftOpen), { x: leftOpen.x + 140, y: leftOpen.y + leftOpen.height / 2 });
    await expect(menu, '터치 열린 왼쪽 반달 드래그').toBeVisible();
    await touchDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
    await expect(menu, '터치 열린 빈 가장자리 드래그').toBeVisible();
  });
});
