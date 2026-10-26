import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const preview = '/scripts/ui-800x360/preview.html';

const sizes = [
  { width: 800, height: 360 },
  { width: 667, height: 300 },
  { width: 844, height: 390 },
];

function parsePx(value: string): number {
  return Number.parseFloat(value) || 0;
}

async function shot(page: import('@playwright/test').Page, name: string, w: number, h: number) {
  if (!process.env.BATCH4_EVIDENCE_DIR) return;
  const dir = process.env.BATCH4_EVIDENCE_DIR;
  await fs.mkdir(dir, { recursive: true });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({
    path: path.join(dir, `${name}-${w}x${h}.png`),
    animations: 'disabled',
  });
}

const batch4Panels = [
  { state: 'sensor', dialog: '케이던스 센서', panel: '.cadence-sheet__panel' },
  { state: 'settings', dialog: '주행 설정', panel: '.ride-settings-sheet__panel' },
  { state: 'map', dialog: '맵 뷰', panel: '.map-view-sheet__panel' },
  { state: 'profile', dialog: '프로필 수정', panel: '.ride-settings-sheet__panel' },
];

for (const size of sizes) {
  for (const { state, dialog, panel } of batch4Panels) {
    test(`묶음4 ${state} 패널 경계·글자 ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${preview}?state=${state}`);
      const sheet = page.getByRole('dialog', { name: dialog, exact: true });
      await expect(sheet).toBeVisible();
      const box = await sheet.locator(panel).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
      const title = sheet.locator('.settings-surface__title').first();
      const titleSize = parsePx(await title.evaluate((el) => getComputedStyle(el).fontSize));
      // 프로필 수정은 Chief 10-26 지시로 70%(폭 364px·제목 12px)
      expect(titleSize).toBeGreaterThanOrEqual(state === 'profile' ? 12 : 14);
      if (state === 'profile') expect(box!.width).toBeLessThanOrEqual(365);
      await shot(page, `batch4-${state}`, size.width, size.height);
    });
  }
}

test('센서 연결·수동·단절 콜백과 주행 자동 시작 없음', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=sensor`);
  const fixture = page.locator('#batch4-fixture');
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '센서 연결', exact: true }).click();
  await expect(dialog.getByText('검색·연결 중…', { exact: true })).toBeVisible();
  await expect(fixture).toHaveAttribute('data-sensor-connect-calls', '1');
  await expect(fixture).toHaveAttribute('data-ui-stage', 'ready-to-start');
  await dialog.getByRole('button', { name: '센서 없음', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-sensor-manual-calls', '1');
  await expect(dialog.getByRole('slider', { name: '세션 속도 km/h' })).toBeVisible();
  await dialog.getByRole('button', { name: '속도 증가', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-manual-speed-kmh', '19');
  await page.goto(`${preview}?state=sensor-connected`);
  const connected = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await connected.getByRole('button', { name: '연결 해제', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-sensor-disconnect-calls', '1');
});

test('주행 중 수동 입력은 최초 센서 연결을 제공하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=sensor-riding-manual`);
  const fixture = page.locator('#batch4-fixture');
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '센서 연결', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('체험 속도로 주행 중입니다', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '센서 없음', exact: true })).toBeVisible();
  await expect(fixture).toHaveAttribute('data-ui-stage', 'riding');
});

test('연결된 케이던스 82rpm·cadence 모드', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=sensor-connected`);
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await expect(dialog.getByText('82 rpm', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '센서 없음', exact: true })).toBeVisible();
  await expect(dialog.getByRole('slider', { name: '세션 속도 km/h' })).toHaveCount(0);
});

test('BLE 미지원 브라우저 안내', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=sensor-unsupported`);
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await expect(dialog.getByText('Web Bluetooth', { exact: false })).toBeVisible();
});

test('센서·속도 접근성 이름 유지', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=sensor`);
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await dialog.getByRole('button', { name: '센서 없음', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '센서 설정 닫기', exact: true })).toBeVisible();
  await expect(dialog.getByRole('spinbutton', { name: '속도 km/h', exact: true })).toBeVisible();
});

test('프로필 게스트·닉네임 잠금·체중 저장', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=profile-guest`);
  const guest = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  await expect(guest.getByText('게스트는 닉네임이 없습니다', { exact: false })).toBeVisible();
  await expect(guest.getByRole('textbox', { name: '닉네임', exact: true })).toHaveCount(0);

  await page.goto(`${preview}?state=profile-locked`);
  const locked = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  const nickname = locked.getByRole('textbox', { name: '닉네임', exact: true });
  await expect(nickname).toBeDisabled();
  await expect(locked.getByText('닉네임은', { exact: false })).toBeVisible();

  await page.goto(`${preview}?state=profile`);
  const fixture = page.locator('#batch4-fixture');
  const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  await expect(fixture).toHaveAttribute('data-weight-kg', '64');
  await expect(fixture).toHaveAttribute('data-intensity-id', 'moderate');
  await profile.getByRole('spinbutton', { name: '체중(kg)', exact: true }).fill('65');
  const moderate = profile.getByRole('button', { name: '체력 3', exact: true });
  await expect(moderate).toHaveAttribute('aria-pressed', 'true');
  await profile.getByRole('group', { name: /^체력/ }).getByRole('button', { name: '체력 4', exact: true }).click();
  await profile.getByRole('button', { name: '저장', exact: true }).click();
  await expect(profile).toBeHidden();
  await expect(fixture).toHaveAttribute('data-weight-kg', '65');
  await expect(fixture).toHaveAttribute('data-intensity-id', 'hard');
  await expect(fixture).toHaveAttribute('data-profile-weight-calls', '1');
});

test('체중이 비어 있으면 70kg 에서 시작하고 체력은 약함 1~5 강함(Chief 10-26)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=profile&variant=no-calorie`);
  const fixture = page.locator('#batch4-fixture');
  const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  await expect(profile.getByRole('spinbutton', { name: '체중(kg)', exact: true })).toHaveValue('70');
  await expect(profile.getByRole('slider', { name: '체중 슬라이더' })).toHaveValue('70');
  await expect(profile.getByText('운동 강도')).toHaveCount(0);
  const scale = profile.locator('.profile-edit-sheet__fitness-scale');
  await expect(scale).toHaveText('약함12345강함');
  await expect(profile.getByRole('group', { name: /^체력/ }).getByRole('button')).toHaveText(['1', '2', '3', '4', '5']);
  await profile.getByRole('button', { name: '체력 2', exact: true }).click();
  await profile.getByRole('button', { name: '저장', exact: true }).click();
  await expect(profile).toBeHidden();
  await expect(fixture).toHaveAttribute('data-weight-kg', '70');
  await expect(fixture).toHaveAttribute('data-intensity-id', 'light');
});

test('주행 설정은 체중·체력 편집 없이 switch·프로필 진입', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=settings`);
  const fixture = page.locator('#batch4-fixture');
  const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  await expect(settings.getByRole('spinbutton')).toHaveCount(0);
  await expect(settings.getByRole('group', { name: /^체력/ })).toHaveCount(0);
  await expect(settings.getByText('체중 64 kg', { exact: false })).toBeVisible();
  await expect(settings.getByText('체력 3', { exact: false })).toBeVisible();
  const switches = settings.getByRole('switch');
  await expect(switches).toHaveCount(4);
  await switches.nth(0).click();
  await switches.nth(1).click();
  await switches.nth(2).click();
  await switches.nth(3).click();
  await expect(fixture).toHaveAttribute('data-ride-coaching', '0');
  await expect(fixture).toHaveAttribute('data-ride-tts', '0');
  await expect(fixture).toHaveAttribute('data-ride-bgm', '0');
  await expect(fixture).toHaveAttribute('data-pacer', '0');
  await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-settings-profile-nav-calls', '1');
  await expect(page.getByRole('dialog', { name: '프로필 수정', exact: true })).toBeVisible();
});

test('맵 뷰 기본 높이·고급·Chief 고정9', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto(`${preview}?state=map`);
  const fixture = page.locator('#batch4-fixture');
  const map = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  expect((await page.locator('.map-view-sheet__panel').boundingBox())!.height).toBeLessThanOrEqual(210);
  await expect(map.getByText('free', { exact: true })).toBeHidden();
  await expect(map.getByText('OSRM', { exact: true })).toBeHidden();
  await expect(map.getByText('Spinatlas Dark', { exact: true })).toBeHidden();
  await expect(map.getByText('야외', { exact: true })).toHaveCount(0);
  await expect(map.getByText('위성', { exact: true })).toHaveCount(0);
  await expect(map.getByRole('button', { name: '맵 뷰 닫기', exact: true })).toBeVisible();
  await map.locator('.map-view-sheet__check input[role="switch"]').click();
  await expect(fixture).toHaveAttribute('data-map-enable3d', '1');
  await map.locator('summary').filter({ hasText: '고급 설정' }).click();
  await map.getByRole('button', { name: '도로 비교', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-map-coverage', 'osrm');
  await map.getByRole('button', { name: '전체 도로망', exact: true }).click();
  await map.getByRole('button', { name: '신규 도로만', exact: true }).click();
  await expect(fixture).toHaveAttribute('data-map-conquest', 'recent');

  await page.goto(`${preview}?state=map&riding`);
  const ridingMap = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  await ridingMap.locator('summary').filter({ hasText: '고급 설정' }).click();
  const initialDistance = Number(await fixture.getAttribute('data-map-camera-m'));
  await ridingMap.getByRole('button', { name: '거리 한 눈금 멀게', exact: true }).click();
  await expect.poll(async () => Number(await fixture.getAttribute('data-map-camera-m'))).toBeGreaterThan(initialDistance);
});


test('센서 선택 완료는 준비 상태로 닫히며 주행하지 않는다', async ({ page }) => {
  await page.goto(`${preview}?state=sensor-connected`);
  const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  await dialog.getByRole('button', { name: '이 센서로 달리기', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-ui-stage', 'ready-to-start');
});
