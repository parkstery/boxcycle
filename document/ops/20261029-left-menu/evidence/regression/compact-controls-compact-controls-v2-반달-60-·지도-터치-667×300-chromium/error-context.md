# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: compact-controls.spec.ts >> compact-controls v2 >> 반달 60%·지도 터치 667×300
- Location: e2e\compact-controls.spec.ts:402:5

# Error details

```
Error: left vs .route-dock__card

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- main [ref=e3]:
  - img [ref=e4]
  - generic: 검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음
  - button "메뉴 열기" [ref=e9] [cursor=pointer]:
    - img [ref=e11]
  - button "순위 열기" [ref=e13] [cursor=pointer]:
    - img [ref=e15]
  - generic:
    - generic "경로 보기":
      - generic [ref=e18]:
        - button "경로 패널 펼치기" [ref=e19] [cursor=pointer]
        - group "주행 제어" [ref=e21]:
          - button "일시정지" [ref=e22] [cursor=pointer]
          - button "주행 종료" [ref=e23] [cursor=pointer]
    - group "경로 미니맵" [ref=e24]:
      - img "전체 경로와 현재 위치" [ref=e25]:
        - img [ref=e26]
      - button "미니맵 접기" [expanded] [ref=e43] [cursor=pointer]:
        - img
  - generic "라이딩 HUD":
    - button "Trail 메뉴" [ref=e44] [cursor=pointer]
    - generic:
      - generic:
        - generic:
          - generic:
            - group "주행 지표":
              - generic "주행 누적 거리 / 경로 전체거리":
                - generic: 거리
                - generic "주행 누적 거리":
                  - text: "4.20"
                  - generic: / 10.00
                  - generic: km
              - generic "시간":
                - generic: 시간
                - generic: 24:08
              - generic "속도":
                - generic: 속도
                - generic:
                  - text: "24"
                  - generic: km/h
              - status "이번 주행에서 새로 밟은 도로(이미 내 도로면 0)":
                - generic: 새 도로
                - generic:
                  - text: "+0.42"
                  - generic: km
              - generic "평균":
                - generic: 평균
                - generic:
                  - text: "18.6"
                  - generic: km/h
    - generic [ref=e45]:
      - group "Quick Camera" [ref=e46]:
        - button "카메라 메뉴 · 카메라 1 · 500m 상공" [ref=e47] [cursor=pointer]:
          - generic [ref=e48]: "1"
          - img [ref=e50]
          - generic [ref=e54]: 500m
          - generic [ref=e55]: ▾
      - group "맵 제어" [ref=e56]:
        - button "맵 스타일 위성, 클릭 시 야외" [ref=e57] [cursor=pointer]:
          - img [ref=e58]
        - button "줌 확대" [ref=e61] [cursor=pointer]: +
        - button "줌 축소" [ref=e62] [cursor=pointer]: −
      - group "서비스 기능" [ref=e63]:
        - button "사용자 정보" [ref=e64] [cursor=pointer]:
          - generic [ref=e66]: 게스트 라이더
    - generic:
      - status:
        - generic: 오늘도 내 도로망을 넓혀 볼까요?
  - generic:
    - button
    - dialog:
      - generic:
        - tablist:
          - tab [selected]: 오늘
          - tab: 주간
          - tab: 월간
          - tab: 연간
        - generic:
          - generic: 10월 29일
          - paragraph:
            - generic: 오늘 주행이 없어요
          - paragraph: 달리면 여기에 거리가 쌓여요
      - generic:
        - generic:
          - button:
            - img
        - generic:
          - group:
            - generic:
              - text: 내 도로망
              - generic: 첫 라이딩으로 나만의 길을 남겨보세요.
            - generic:
              - generic: "0.0"
              - generic: km
          - group:
            - button [pressed]: 전체 도로망
            - button [disabled]: 신규 도로만
          - button:
            - generic: 마지막 주행
            - generic:
              - generic: 아직 주행이 없어요
              - generic:
                - img
          - group:
            - generic: 플랜
            - generic: 게스트 · 회원 등록하면 어느 기기에서나 이어져요
        - generic:
          - button: 회원 등록
  - generic:
    - button
    - dialog:
      - generic:
        - generic:
          - generic:
            - img
          - generic: Spinatlas
          - button:
            - img
        - button:
          - img
      - generic:
        - complementary:
          - generic: 경로 선택
          - group:
            - button: 내 경로
            - button: 퍼블릭
            - button: 입문
          - list:
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 인터벌
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 주행 설정
                - img
```

# Test source

```ts
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
  422 |         expect(tab.knob.width, tab.side).toBeCloseTo(20.4, 1);
  423 |         expect(tab.knob.height, tab.side).toBeCloseTo(43.2, 1);
  424 |         expect(tab.tab.width * tab.tab.height).toBeGreaterThanOrEqual(44 * 76 - 1);
  425 |         for (const other of measured.others) {
> 426 |           expect(overlap(tab.knob, other), `${tab.side} vs ${other.sel}`).toBe(false);
      |                                                                           ^ Error: left vs .route-dock__card
  427 |         }
  428 |       }
  429 |       await page.getByRole('button', { name: '순위 열기', exact: true }).click();
  430 |       await expect(page.locator('#lb-glance-panel')).toBeVisible();
  431 |       if (size.width === 699) await saveShot(page, `edges-${size.width}x${size.height}.png`);
  432 |     });
  433 |   }
  434 | 
  435 |   test('우상단 계정·카메라 비겹침', async ({ page }) => {
  436 |     await page.setViewportSize({ width: 667, height: 300 });
  437 |     await page.goto(`${preview}?state=riding`);
  438 |     const hit = await page.evaluate(() => {
  439 |       const a = document.querySelector('.camera-view-menu')!.getBoundingClientRect();
  440 |       const b = document.querySelector('.hud-account')!.getBoundingClientRect();
  441 |       const c = document.querySelector('.hud-ride-map-controls')!.getBoundingClientRect();
  442 |       const overlapBox = (x: DOMRect, y: DOMRect) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
  443 |       return { cameraAccount: overlapBox(a, b), cameraMap: overlapBox(a, c), accountMap: overlapBox(b, c) };
  444 |     });
  445 |     expect(hit).toEqual({ cameraAccount: false, cameraMap: false, accountMap: false });
  446 |   });
  447 | });
  448 | 
  449 | const tapEvidenceDir = process.env.TAP_HANDLES_EVIDENCE_DIR
  450 |   ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../document/ops/20261028-compact-controls/evidence/tap-handles');
  451 | const tapSizes = [
  452 |   { width: 800, height: 360 },
  453 |   { width: 699, height: 273 },
  454 |   { width: 667, height: 300 },
  455 | ] as const;
  456 | const LEFT_CLOSED = 'M2 1.5L5 5L2 8.5';
  457 | const LEFT_OPEN = 'M5 1.5L2 5L5 8.5';
  458 | const RIGHT_CLOSED = 'M5 1.5L2 5L5 8.5';
  459 | const RIGHT_OPEN = 'M2 1.5L5 5L2 8.5';
  460 | 
  461 | async function saveTapShot(page: Page, name: string) {
  462 |   await fs.mkdir(tapEvidenceDir, { recursive: true });
  463 |   await page.screenshot({ path: path.join(tapEvidenceDir, name), animations: 'disabled' });
  464 | }
  465 | 
  466 | async function caretPath(page: Page, side: 'left' | 'right') {
  467 |   return page.locator(`.edge-panel-tab--${side} path`).getAttribute('d');
  468 | }
  469 | 
  470 | async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  471 |   await page.mouse.move(from.x, from.y);
  472 |   await page.mouse.down();
  473 |   await page.mouse.move(to.x, to.y, { steps: 10 });
  474 |   await page.mouse.up();
  475 | }
  476 | 
  477 | async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  478 |   const client = await page.context().newCDPSession(page);
  479 |   const steps = 10;
  480 |   await client.send('Input.dispatchTouchEvent', {
  481 |     type: 'touchStart',
  482 |     touchPoints: [{ x: from.x, y: from.y, id: 0 }],
  483 |   });
  484 |   for (let i = 1; i <= steps; i++) {
  485 |     const x = from.x + ((to.x - from.x) * i) / steps;
  486 |     const y = from.y + ((to.y - from.y) * i) / steps;
  487 |     await client.send('Input.dispatchTouchEvent', {
  488 |       type: 'touchMove',
  489 |       touchPoints: [{ x, y, id: 0 }],
  490 |     });
  491 |   }
  492 |   await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  493 | }
  494 | 
  495 | function knobCenter(box: { x: number; y: number; width: number; height: number }) {
  496 |   return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  497 | }
  498 | 
  499 | test.describe('compact-controls tap handles', () => {
  500 |   for (const size of tapSizes) {
  501 |     test(`양쪽 탭 열고닫기·위치·캐럿 ${size.width}×${size.height}`, async ({ page }) => {
  502 |       await page.setViewportSize(size);
  503 |       await page.goto(`${preview}?state=ready`);
  504 |       const menuBtn = page.getByRole('button', { name: '메뉴 열기', exact: true });
  505 |       const rankBtn = page.getByRole('button', { name: '순위 열기', exact: true });
  506 |       const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  507 |       const rank = page.locator('#lb-glance-panel');
  508 | 
  509 |       const leftClosed = (await page.locator('.edge-panel-tab--left').boundingBox())!;
  510 |       const rightClosed = (await page.locator('.edge-panel-tab--right').boundingBox())!;
  511 |       expect(await caretPath(page, 'left')).toBe(LEFT_CLOSED);
  512 |       expect(await caretPath(page, 'right')).toBe(RIGHT_CLOSED);
  513 | 
  514 |       await menuBtn.click();
  515 |       await expect(menu).toBeVisible();
  516 |       const leftOpen = (await page.locator('.edge-panel-tab--left').boundingBox())!;
  517 |       expect(Math.abs(leftOpen.x - leftClosed.x), '왼쪽 x').toBeLessThanOrEqual(1);
  518 |       expect(Math.abs(leftOpen.y - leftClosed.y), '왼쪽 y').toBeLessThanOrEqual(1);
  519 |       expect(await caretPath(page, 'left')).toBe(LEFT_OPEN);
  520 |       const knob = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  521 |       const hit = await page.evaluate(({ x, y }) => {
  522 |         const el = document.elementFromPoint(x, y);
  523 |         return Boolean(el?.closest('.edge-panel-tab--left'));
  524 |       }, knobCenter(knob));
  525 |       expect(hit, '열린 왼쪽 반달이 메뉴·스크림 위').toBe(true);
  526 |       await menuBtn.click();
```