# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-redesign-batch4.spec.ts >> 맵 뷰 기본 높이·고급·Chief 고정9
- Location: e2e\ui-redesign-batch4.spec.ts:169:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5021/scripts/ui-800x360/preview.html?state=map&riding
Call log:
  - navigating to "http://127.0.0.1:5021/scripts/ui-800x360/preview.html?state=map&riding", waiting until "load"

```

# Test source

```ts
  90  | 
  91  | test('연결된 케이던스 82rpm·cadence 모드', async ({ page }) => {
  92  |   await page.setViewportSize({ width: 800, height: 360 });
  93  |   await page.goto(`${preview}?state=sensor-connected`);
  94  |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  95  |   await expect(dialog.getByText('82 rpm', { exact: false })).toBeVisible();
  96  |   await expect(dialog.getByRole('button', { name: '센서 없음', exact: true })).toBeVisible();
  97  |   await expect(dialog.getByRole('slider', { name: '세션 속도 km/h' })).toHaveCount(0);
  98  | });
  99  | 
  100 | test('BLE 미지원 브라우저 안내', async ({ page }) => {
  101 |   await page.setViewportSize({ width: 800, height: 360 });
  102 |   await page.goto(`${preview}?state=sensor-unsupported`);
  103 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  104 |   await expect(dialog.getByText('Web Bluetooth', { exact: false })).toBeVisible();
  105 | });
  106 | 
  107 | test('센서·속도 접근성 이름 유지', async ({ page }) => {
  108 |   await page.setViewportSize({ width: 800, height: 360 });
  109 |   await page.goto(`${preview}?state=sensor`);
  110 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  111 |   await dialog.getByRole('button', { name: '센서 없음', exact: true }).click();
  112 |   await expect(dialog.getByRole('button', { name: '센서 설정 닫기', exact: true })).toBeVisible();
  113 |   await expect(dialog.getByRole('spinbutton', { name: '속도 km/h', exact: true })).toBeVisible();
  114 | });
  115 | 
  116 | test('프로필 게스트·닉네임 잠금·체중 저장', async ({ page }) => {
  117 |   await page.setViewportSize({ width: 800, height: 360 });
  118 |   await page.goto(`${preview}?state=profile-guest`);
  119 |   const guest = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  120 |   await expect(guest.getByText('게스트는 닉네임이 없습니다', { exact: false })).toBeVisible();
  121 |   await expect(guest.getByRole('textbox', { name: '닉네임', exact: true })).toHaveCount(0);
  122 | 
  123 |   await page.goto(`${preview}?state=profile-locked`);
  124 |   const locked = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  125 |   const nickname = locked.getByRole('textbox', { name: '닉네임', exact: true });
  126 |   await expect(nickname).toBeDisabled();
  127 |   await expect(locked.getByText('닉네임은', { exact: false })).toBeVisible();
  128 | 
  129 |   await page.goto(`${preview}?state=profile`);
  130 |   const fixture = page.locator('#batch4-fixture');
  131 |   const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  132 |   await expect(fixture).toHaveAttribute('data-weight-kg', '64');
  133 |   await expect(fixture).toHaveAttribute('data-intensity-id', 'moderate');
  134 |   await profile.getByRole('spinbutton', { name: '체중(kg)', exact: true }).fill('65');
  135 |   const moderate = profile.getByRole('button', { name: '보통', exact: true });
  136 |   await expect(moderate).toHaveAttribute('aria-pressed', 'true');
  137 |   await profile.getByRole('group', { name: '운동 강도' }).getByRole('button', { name: '강함', exact: true }).click();
  138 |   await profile.getByRole('button', { name: '저장', exact: true }).click();
  139 |   await expect(profile).toBeHidden();
  140 |   await expect(fixture).toHaveAttribute('data-weight-kg', '65');
  141 |   await expect(fixture).toHaveAttribute('data-intensity-id', 'hard');
  142 |   await expect(fixture).toHaveAttribute('data-profile-weight-calls', '1');
  143 | });
  144 | 
  145 | test('주행 설정은 체중·강도 편집 없이 switch·프로필 진입', async ({ page }) => {
  146 |   await page.setViewportSize({ width: 800, height: 360 });
  147 |   await page.goto(`${preview}?state=settings`);
  148 |   const fixture = page.locator('#batch4-fixture');
  149 |   const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  150 |   await expect(settings.getByRole('spinbutton')).toHaveCount(0);
  151 |   await expect(settings.getByRole('group', { name: '운동 강도' })).toHaveCount(0);
  152 |   await expect(settings.getByText('체중 64 kg', { exact: false })).toBeVisible();
  153 |   await expect(settings.getByText('운동 강도 보통', { exact: false })).toBeVisible();
  154 |   const switches = settings.getByRole('switch');
  155 |   await expect(switches).toHaveCount(4);
  156 |   await switches.nth(0).click();
  157 |   await switches.nth(1).click();
  158 |   await switches.nth(2).click();
  159 |   await switches.nth(3).click();
  160 |   await expect(fixture).toHaveAttribute('data-ride-coaching', '0');
  161 |   await expect(fixture).toHaveAttribute('data-ride-tts', '0');
  162 |   await expect(fixture).toHaveAttribute('data-ride-bgm', '0');
  163 |   await expect(fixture).toHaveAttribute('data-pacer', '0');
  164 |   await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
  165 |   await expect(fixture).toHaveAttribute('data-settings-profile-nav-calls', '1');
  166 |   await expect(page.getByRole('dialog', { name: '프로필 수정', exact: true })).toBeVisible();
  167 | });
  168 | 
  169 | test('맵 뷰 기본 높이·고급·Chief 고정9', async ({ page }) => {
  170 |   await page.setViewportSize({ width: 800, height: 360 });
  171 |   await page.goto(`${preview}?state=map`);
  172 |   const fixture = page.locator('#batch4-fixture');
  173 |   const map = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  174 |   expect((await page.locator('.map-view-sheet__panel').boundingBox())!.height).toBeLessThanOrEqual(210);
  175 |   await expect(map.getByText('free', { exact: true })).toBeHidden();
  176 |   await expect(map.getByText('OSRM', { exact: true })).toBeHidden();
  177 |   await expect(map.getByText('Spinatlas Dark', { exact: true })).toBeHidden();
  178 |   await expect(map.getByText('야외', { exact: true })).toHaveCount(0);
  179 |   await expect(map.getByText('위성', { exact: true })).toHaveCount(0);
  180 |   await expect(map.getByRole('button', { name: '맵 뷰 닫기', exact: true })).toBeVisible();
  181 |   await map.locator('.map-view-sheet__check input[role="switch"]').click();
  182 |   await expect(fixture).toHaveAttribute('data-map-enable3d', '1');
  183 |   await map.locator('summary').filter({ hasText: '고급 설정' }).click();
  184 |   await map.getByRole('button', { name: '도로 비교', exact: true }).click();
  185 |   await expect(fixture).toHaveAttribute('data-map-coverage', 'osrm');
  186 |   await map.getByRole('button', { name: '전체 도로망', exact: true }).click();
  187 |   await map.getByRole('button', { name: '신규 도로만', exact: true }).click();
  188 |   await expect(fixture).toHaveAttribute('data-map-conquest', 'recent');
  189 | 
> 190 |   await page.goto(`${preview}?state=map&riding`);
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5021/scripts/ui-800x360/preview.html?state=map&riding
  191 |   const ridingMap = page.getByRole('dialog', { name: '맵 뷰', exact: true });
  192 |   await ridingMap.locator('summary').filter({ hasText: '고급 설정' }).click();
  193 |   const initialDistance = Number(await fixture.getAttribute('data-map-camera-m'));
  194 |   await ridingMap.getByRole('button', { name: '거리 한 눈금 멀게', exact: true }).click();
  195 |   await expect.poll(async () => Number(await fixture.getAttribute('data-map-camera-m'))).toBeGreaterThan(initialDistance);
  196 | });
  197 | 
  198 | 
  199 | test('센서 선택 완료는 준비 상태로 닫히며 주행하지 않는다', async ({ page }) => {
  200 |   await page.goto(`${preview}?state=sensor-connected`);
  201 |   const dialog = page.getByRole('dialog', { name: '케이던스 센서', exact: true });
  202 |   await dialog.getByRole('button', { name: '이 센서로 달리기', exact: true }).click();
  203 |   await expect(dialog).toBeHidden();
  204 |   await expect(page.locator('#batch4-fixture')).toHaveAttribute('data-ui-stage', 'ready-to-start');
  205 | });
  206 | 
```