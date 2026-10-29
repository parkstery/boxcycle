# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: compact-controls.spec.ts >> compact-controls v2 >> 설정 스트레스 긴 값 699×273
- Location: e2e\compact-controls.spec.ts:295:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: '인터벌 운동 설정', exact: true }).getByText(/600초 \/ 600초 ×30/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('dialog', { name: '인터벌 운동 설정', exact: true }).getByText(/600초 \/ 600초 ×30/)

```

```yaml
- main:
  - text: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - button "메뉴 열기"
  - button "순위 열기"
  - 'button "케이던스 센서: 연결 안 됨"': 센서
  - button "인터벌 운동 설정": INT
  - button "경로 패널 접기" [expanded]
  - group "주행 제어":
    - button "주행 시작"
  - list:
    - listitem:
      - button "Start 남산공원 입구": S 남산공원 입구
      - button "Start 삭제"
    - listitem:
      - button "End 남산 순환로 전망대": E 남산 순환로 전망대
      - button "End 삭제"
  - button "Start·End 바꾸기"
  - button "Trail 메뉴"
  - group "주행 지표": 경로 2.02 km 고도 4630 m
  - group "맵 제어":
    - button "맵 스타일 위성, 클릭 시 야외"
    - button "줌 확대": +
    - button "줌 축소": −
  - group "서비스 기능":
    - button "사용자 정보": 게스트 라이더
  - dialog "인터벌 운동 설정":
    - button "인터벌 운동 설정 배경 닫기"
    - heading "인터벌 운동" [level=2]
    - text: 사용
    - switch "인터벌"
    - combobox "운동 프리셋":
      - option "10분"
      - option "15분"
      - option "20분"
      - option "25분"
      - option "30분"
      - option "회복형 1:2"
      - option "균형형 1:1"
      - option "짧은 반복 20:10"
      - option "직접 설정" [selected]
    - button "인터벌 운동 설정 닫기"
    - group "운동 시간과 반복 수":
      - text: 준비 초
      - button "준비 30초 줄이기": −
      - spinbutton "준비 시간 초": "1800"
      - button "준비 30초 늘리기": +
      - text: 고강도 초
      - button "고강도 5초 줄이기": −
      - spinbutton "고강도 시간 초": "600"
      - button "고강도 5초 늘리기": +
      - text: 저강도 초
      - button "저강도 5초 줄이기": −
      - spinbutton "저강도 시간 초": "600"
      - button "저강도 5초 늘리기": +
      - text: 반복 회
      - button "반복 1회 줄이기": −
      - spinbutton "반복 수": "30"
      - button "반복 1회 늘리기": +
      - text: 마무리 초
      - button "마무리 30초 줄이기": −
      - spinbutton "마무리 시간 초": "1800"
      - button "마무리 30초 늘리기": +
      - text: 라운드 회
      - button "라운드 1회 줄이기": −
      - spinbutton "라운드 수": "3"
      - button "라운드 1회 늘리기": +
      - text: 사이 휴식 초
      - button "사이 휴식 30초 줄이기": −
      - spinbutton "라운드 사이 휴식 시간 초": "1800"
      - button "사이 휴식 30초 늘리기": +
    - button "접기"
    - text: 총
    - strong: 1920:00
    - button "설정 적용"
```

# Test source

```ts
  221 |     await expect(usesList).toContainText('4명');
  222 |     await expect(sheet.getByText('이름에 올려')).toHaveCount(0);
  223 | 
  224 |     await page.goto(`${preview}?state=leaderboard&lb=twenty`);
  225 |     await sheet.getByRole('button', { name: '개척', exact: true }).click();
  226 |     await sheet.getByText('내 길 이용 · 새 도로').click();
  227 |     await expect(sheet.getByRole('list', { name: '참가자 길 이용' })).toContainText('northend');
  228 | 
  229 |     await page.goto(`${preview}?state=leaderboard&lb=around`);
  230 |     await sheet.getByRole('button', { name: '개척', exact: true }).click();
  231 |     await sheet.getByText('내 길 이용 · 새 도로').click();
  232 |     const aroundList = sheet.getByRole('list', { name: '참가자 길 이용' });
  233 |     await expect(aroundList).toContainText('cityloop');
  234 |     await expect(aroundList).toContainText('parkway');
  235 |   });
  236 | 
  237 |   for (const size of sizes) {
  238 |     test(`주행 설정 두 열 스크롤 0 ${size.width}×${size.height}`, async ({ page }) => {
  239 |       await page.setViewportSize(size);
  240 |       await page.goto(`${preview}?state=settings`);
  241 |       const dialog = page.getByRole('dialog', { name: '주행 설정', exact: true });
  242 |       const panel = dialog.locator('.ride-settings-sheet__panel');
  243 |       await panel.evaluate(async (el) => {
  244 |         await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
  245 |       });
  246 |       const geometry = await panel.evaluate((el) => {
  247 |         const box = el.getBoundingClientRect();
  248 |         const labels = [...el.querySelectorAll('.ride-settings-panel__choice span > span, .ride-settings-panel__choice .ride-settings-panel__copy > span')].map((n) => n.textContent?.trim());
  249 |         return {
  250 |           width: box.width,
  251 |           height: box.height,
  252 |           scroll: el.scrollHeight,
  253 |           client: el.clientHeight,
  254 |           overflow: getComputedStyle(el).overflowY,
  255 |           inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
  256 |           labels,
  257 |         };
  258 |       });
  259 |       expect(geometry.inside).toBe(true);
  260 |       expect(geometry.width).toBeLessThanOrEqual(460 + 1);
  261 |       expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
  262 |       expect(geometry.labels).toEqual(expect.arrayContaining(['코칭 문구', '음성 안내', '배경 음악', '페이서', '효과음']));
  263 |       await expect(dialog.getByRole('button', { name: '운동 설정', exact: true })).toHaveCount(0);
  264 |       await expect(dialog.getByRole('switch', { name: '인터벌' })).toHaveCount(0);
  265 |       await expect(dialog.getByRole('button', { name: '프로필 수정', exact: true })).toBeVisible();
  266 |       if (size.width === 699) await saveShot(page, `settings-${size.width}x${size.height}.png`);
  267 |     });
  268 |   }
  269 | 
  270 |   test('설정 토글·긴 값·운동/프로필 왕복', async ({ page }) => {
  271 |     await page.setViewportSize({ width: 699, height: 273 });
  272 |     await page.goto(`${preview}?state=settings`);
  273 |     const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  274 |     await settings.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
  275 |     await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  276 |     await page.keyboard.press('Enter');
  277 |     await page.getByRole('button', { name: '인터벌', exact: true }).click();
  278 |     const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
  279 |     await expect(editor).toBeVisible();
  280 |     await editor.getByRole('switch', { name: '인터벌' }).check();
  281 |     await expect(editor.getByRole('switch', { name: '인터벌' })).toBeChecked();
  282 |     await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
  283 |     await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  284 |     await page.keyboard.press('Enter');
  285 |     await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  286 |     await expect(settings).toBeVisible();
  287 |     await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
  288 |     const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  289 |     await expect(profile).toBeVisible();
  290 |     await profile.locator('.settings-surface__close').click();
  291 |     await expect(settings).toBeVisible();
  292 |   });
  293 | 
  294 |   for (const size of [{ width: 699, height: 273 }, { width: 667, height: 300 }] as const) {
  295 |     test(`설정 스트레스 긴 값 ${size.width}×${size.height}`, async ({ page }) => {
  296 |       await page.setViewportSize(size);
  297 |       await page.goto(`${preview}?state=settings&settingsStress`);
  298 |       const settings = page.getByRole('dialog', { name: '주행 설정', exact: true });
  299 |       const panel = settings.locator('.ride-settings-sheet__panel');
  300 |       await panel.evaluate(async (el) => {
  301 |         await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {})));
  302 |       });
  303 |       const geometry = await settingsGeometry(panel);
  304 |       expect(geometry.inside).toBe(true);
  305 |       expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
  306 |       expect(geometry.nestedScroll).toBe(false);
  307 |       expect(geometry.clipped).toEqual([]);
  308 |       await expect(settings.getByRole('switch', { name: '배경 음악' })).toBeDisabled();
  309 |       await expect(settings.getByText('준비 중')).toBeVisible();
  310 |       await expect(settings.getByText('고도 프로필 로드 중…')).toBeVisible();
  311 |       await expect(settings.getByText('프로필에 체중을 입력하세요')).toBeVisible();
  312 |       await expect(settings.getByText(/체력을 선택하세요/)).toBeVisible();
  313 |       if (size.width === 699) await saveShot(page, 'settings-stress-699x273.png');
  314 | 
  315 |       await settings.getByRole('button', { name: '주행 설정 닫기', exact: true }).click();
  316 |       await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  317 |       await page.keyboard.press('Enter');
  318 |       await page.getByRole('button', { name: '인터벌', exact: true }).click();
  319 |       const editor = page.getByRole('dialog', { name: '인터벌 운동 설정', exact: true });
  320 |       await expect(editor).toBeVisible();
> 321 |       await expect(editor.getByText(/600초 \/ 600초 ×30/)).toBeVisible();
      |                                                          ^ Error: expect(locator).toBeVisible() failed
  322 |       await expect(editor.getByText(/3라운드/)).toBeVisible();
  323 |       await expect(editor.getByText(/준비 30분/)).toBeVisible();
  324 |       await expect(editor.getByText(/마무리 30분/)).toBeVisible();
  325 |       const editorBox = await editor.locator('.ride-interval-settings__panel').evaluate((el) => {
  326 |         const box = el.getBoundingClientRect();
  327 |         return {
  328 |           inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
  329 |           scroll: el.scrollHeight,
  330 |           client: el.clientHeight,
  331 |         };
  332 |       });
  333 |       expect(editorBox.inside).toBe(true);
  334 |       await editor.getByRole('button', { name: '인터벌 운동 설정 닫기', exact: true }).click();
  335 |       await page.getByRole('button', { name: 'Trail 메뉴', exact: true }).focus();
  336 |       await page.keyboard.press('Enter');
  337 |       await page.getByRole('button', { name: '주행 설정', exact: true }).click();
  338 |       await expect(settings).toBeVisible();
  339 | 
  340 |       await settings.getByRole('button', { name: '프로필 수정', exact: true }).click();
  341 |       const profile = page.getByRole('dialog', { name: '프로필 수정', exact: true });
  342 |       await expect(profile).toBeVisible();
  343 |       const profileBox = await profile.locator('.settings-surface__panel').evaluate((el) => {
  344 |         const box = el.getBoundingClientRect();
  345 |         const clipped = [...el.querySelectorAll('button, input, label, p, h2')].filter((node) => {
  346 |           const rect = node.getBoundingClientRect();
  347 |           if (rect.width === 0 || rect.height === 0) return false;
  348 |           return rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
  349 |         }).map((node) => (node.textContent ?? '').trim().slice(0, 40));
  350 |         return {
  351 |           inside: box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
  352 |           scroll: el.scrollHeight,
  353 |           client: el.clientHeight,
  354 |           clipped,
  355 |         };
  356 |       });
  357 |       expect(profileBox.inside).toBe(true);
  358 |       expect(profileBox.clipped).toEqual([]);
  359 |       expect(profileBox.scroll).toBeLessThanOrEqual(profileBox.client + 2);
  360 |       await profile.locator('.settings-surface__close').click();
  361 |       await expect(settings).toBeVisible();
  362 |     });
  363 |   }
  364 | 
  365 |   for (const size of sizes) {
  366 |     test(`단일 카메라 두 열 ${size.width}×${size.height}`, async ({ page }) => {
  367 |       await page.setViewportSize(size);
  368 |       await page.goto(`${preview}?state=riding`);
  369 |       const trigger = page.getByRole('button', { name: /카메라 메뉴/ });
  370 |       await expect(trigger).toHaveCount(1);
  371 |       await trigger.click();
  372 |       const menu = page.getByRole('menu', { name: '카메라 선택' });
  373 |       await expect(menu).toBeVisible();
  374 |       const box = await menu.evaluate((el) => {
  375 |         const r = el.getBoundingClientRect();
  376 |         const flat = el.querySelector('.camera-view-menu__unit--flat')!.getBoundingClientRect();
  377 |         const six = el.querySelector('[data-camera-slot="6"]')!.getBoundingClientRect();
  378 |         const terrain = el.querySelector('.camera-view-menu__item--terrain')!.getBoundingClientRect();
  379 |         return {
  380 |           width: r.width,
  381 |           inside: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
  382 |           flatWidth: flat.width,
  383 |           terrainBelow: terrain.top >= six.bottom - 1,
  384 |         };
  385 |       });
  386 |       expect(box.width).toBeCloseTo(154, 0);
  387 |       expect(box.flatWidth).toBeCloseTo(62, 0);
  388 |       expect(box.inside).toBe(true);
  389 |       expect(box.terrainBelow).toBe(true);
  390 |       if (size.width === 699) await saveShot(page, `camera-open-${size.width}x${size.height}.png`);
  391 |       await menu.getByRole('menuitemradio', { name: /^카메라 4/ }).click();
  392 |       await expect(menu).toHaveCount(0);
  393 |       await expect(trigger).toContainText('4');
  394 |       await trigger.click();
  395 |       await page.keyboard.press('Escape');
  396 |       await expect(menu).toHaveCount(0);
  397 |       await expect(trigger).toBeFocused();
  398 |     });
  399 |   }
  400 | 
  401 |   for (const size of sizes) {
  402 |     test(`반달 60%·지도 터치 ${size.width}×${size.height}`, async ({ page }) => {
  403 |       await page.setViewportSize(size);
  404 |       await page.goto(`${preview}?state=riding`);
  405 |       const measured = await page.evaluate(() => {
  406 |         const knobs = ['left', 'right'].map((side) => {
  407 |           const tab = document.querySelector(`.edge-panel-tab--${side}`)!;
  408 |           const knob = tab.querySelector('.edge-panel-tab__knob')!;
  409 |           return { side, tab: tab.getBoundingClientRect().toJSON(), knob: knob.getBoundingClientRect().toJSON() };
  410 |         });
  411 |         const others = ['.route-dock__card', '.route-minimap'].flatMap((sel) => {
  412 |           const el = document.querySelector(sel);
  413 |           if (!el) return [];
  414 |           const r = el.getBoundingClientRect();
  415 |           if (r.width <= 0) return [];
  416 |           if (sel === '.route-dock__card' && r.width <= 32 && r.height <= 32) return [];
  417 |           return [{ sel, ...r.toJSON() }];
  418 |         });
  419 |         return { knobs, others };
  420 |       });
  421 |       for (const tab of measured.knobs) {
```