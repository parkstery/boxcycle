# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-800x360.spec.ts >> Chief 고정 — 목록 11 주행·일시정지 중 주소창 >> 주행·일시정지는 접힌 상태로 시작하고 펼치면 출발·도착이 보이며 미니맵과 너비가 같다
- Location: e2e\ui-800x360.spec.ts:563:3

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 44
Received:    130
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
                  - text: "1234.56"
                  - generic: / 9999.99
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
          - generic [ref=e66]: 아주긴닉네임라이더테스트
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
  410 |   await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toBeVisible();
  411 |   await expect(page.getByRole('dialog')).toHaveCount(1);
  412 |   const intro=page.getByRole('dialog',{name:'입문 경로',exact:true});
  413 |   await intro.getByRole('button',{name:'퍼블릭',exact:true}).click();
  414 |   await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toBeVisible();
  415 |   await expect(page.getByRole('dialog',{name:'입문 경로',exact:true})).toHaveCount(0);
  416 |   await page.getByRole('dialog',{name:'퍼블릭 경로',exact:true}).getByRole('button',{name:'내 경로',exact:true}).click();
  417 |   const saved=page.getByRole('dialog',{name:'내 경로',exact:true});
  418 |   await expect(saved).toBeVisible();
  419 |   await expect(page.getByRole('dialog',{name:'퍼블릭 경로',exact:true})).toHaveCount(0);
  420 |   await page.keyboard.press('Escape');
  421 |   await expect(saved).toHaveCount(0);
  422 |   await expect(page.getByRole('dialog',{name:'메뉴',exact:true})).toBeVisible();
  423 | });
  424 | 
  425 | // Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
  426 | test.describe('Chief 고정 — 261024 목록 1~4', () => {
  427 |   const greenBottom = 'rgb(0, 150, 39)';
  428 | 
  429 |   test('준비·일시정지 조작부와 순위 칩·주행 중 지도 조작', async ({ page }) => {
  430 |     const evidenceDir = process.env.BATCH2_EVIDENCE_DIR;
  431 |     if (evidenceDir) await fs.mkdir(evidenceDir, { recursive: true });
  432 | 
  433 |     for (const size of [{ width: 667, height: 300 }, { width: 800, height: 360 }]) {
  434 |       await page.setViewportSize(size);
  435 |       await page.goto(`${preview}?state=ready`);
  436 |       const start = page.getByRole('button', { name: '주행 시작', exact: true });
  437 |       await expect(start).toBeVisible();
  438 |       expect((await start.innerText()).trim()).toBe('');
  439 |       const startBox = await start.boundingBox();
  440 |       expect(startBox!.width).toBeCloseTo(startBox!.height, 0);
  441 |       const startBg = await start.evaluate((el) => getComputedStyle(el).backgroundImage);
  442 |       expect(startBg).toContain(greenBottom);
  443 | 
  444 |       await page.goto(`${preview}?state=glance-ready`);
  445 |       const rank = page.getByRole('button', { name: '순위 열기', exact: true });
  446 |       await expect(rank).toBeVisible();
  447 |       const rankBox = await rank.boundingBox();
  448 |       expect(rankBox!.height).toBeGreaterThanOrEqual(44);
  449 |       await expect(rank).toHaveAttribute('aria-controls', 'lb-glance-panel');
  450 | 
  451 |       if (evidenceDir && size.width === 667) {
  452 |         await page.screenshot({ path: path.join(evidenceDir, 'ready-667x300.png'), animations: 'disabled' });
  453 |       }
  454 |       if (evidenceDir && size.width === 800) {
  455 |         await page.screenshot({ path: path.join(evidenceDir, 'ready-800x360.png'), animations: 'disabled' });
  456 |       }
  457 | 
  458 |       await page.goto(`${preview}?state=paused`);
  459 |       const controls = page.getByRole('group', { name: '주행 제어' });
  460 |       const mediaTexts = await controls.locator('.ride-media-button, button[aria-label="일시정지 옵션"]').evaluateAll(
  461 |         (buttons) => buttons.map((b) => (b.textContent ?? '').trim()),
  462 |       );
  463 |       expect(mediaTexts.every((t) => t === '' || t === '⋯' || t === '...')).toBeTruthy();
  464 |       await expect(page.getByText('주행 끝내기', { exact: true })).toHaveCount(0);
  465 |       await expect(page.getByText('다시 달리기', { exact: true })).toHaveCount(0);
  466 |       const resume = page.getByRole('button', { name: '재개', exact: true });
  467 |       const resumeBg = await resume.evaluate((el) => getComputedStyle(el).backgroundImage);
  468 |       expect(resumeBg).toContain(greenBottom);
  469 | 
  470 |       if (evidenceDir && size.width === 667) {
  471 |         await page.screenshot({ path: path.join(evidenceDir, 'paused-667x300.png'), animations: 'disabled' });
  472 |       }
  473 |       if (evidenceDir && size.width === 800) {
  474 |         await page.screenshot({ path: path.join(evidenceDir, 'paused-800x360.png'), animations: 'disabled' });
  475 |       }
  476 |     }
  477 | 
  478 |     await page.setViewportSize({ width: 800, height: 360 });
  479 |     for (const state of ['riding', 'paused'] as const) {
  480 |       await page.goto(`${preview}?state=${state}`);
  481 |       await expect(page.locator('.hud-ride-map-controls')).toBeVisible();
  482 |       await expect(page.getByRole('button', { name: /야외|위성/ })).toBeVisible();
  483 |       const style = page.locator('.hud-ride-map-controls__style');
  484 |       await expect(style).toHaveText('');
  485 |       await expect(style.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  486 |       await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'satellite');
  487 |       await style.click();
  488 |       await expect(style).toHaveAccessibleName('맵 스타일 야외, 클릭 시 위성');
  489 |       await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'outdoors');
  490 |       await style.click();
  491 |       await expect(style.locator('svg')).toHaveAttribute('data-map-style', 'satellite');
  492 |       await expect(page.locator('.hud-ride-map-controls__zoom').first()).toBeVisible();
  493 |     }
  494 |     if (evidenceDir) {
  495 |       await page.goto(`${preview}?state=riding`);
  496 |       await page.screenshot({ path: path.join(evidenceDir, 'riding-800x360.png'), animations: 'disabled' });
  497 |     }
  498 |   });
  499 | });
  500 | 
  501 | // Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요
  502 | // 2026-10-28 Chief: 접힌 RouteDock 은 흰/녹 점멸 LED 하나. 펼치면 접기 LED + 센서 알약.
  503 | async function assertCollapsedRouteDockChip(page: import('@playwright/test').Page) {
  504 |   const card = page.locator('.route-dock__card');
  505 |   const expand = page.getByRole('button', { name: '경로 패널 펼치기' });
  506 |   await expect(expand).toBeVisible();
  507 |   await expect(page.getByRole('button', { name: /^케이던스 센서:/ })).toHaveCount(0);
  508 |   const cardBox = (await card.boundingBox())!;
  509 |   expect(cardBox.width).toBeGreaterThanOrEqual(28);
> 510 |   expect(cardBox.width).toBeLessThanOrEqual(44);
      |                         ^ Error: expect(received).toBeLessThanOrEqual(expected)
  511 |   expect(cardBox.height).toBeGreaterThanOrEqual(28);
  512 |   expect(cardBox.height).toBeLessThanOrEqual(44);
  513 | 
  514 |   const geometry = await page.evaluate(() => {
  515 |     const cardEl = document.querySelector('.route-dock__card')!;
  516 |     const ledEl = document.querySelector('.route-dock__led-toggle')!;
  517 |     const cardR = cardEl.getBoundingClientRect();
  518 |     const ledR = ledEl.getBoundingClientRect();
  519 |     const cx = ledR.x + ledR.width / 2;
  520 |     const cy = ledR.y + ledR.height / 2;
  521 |     const hit = document.elementFromPoint(cx, cy);
  522 |     const cardStyle = getComputedStyle(cardEl);
  523 |     const inViewport =
  524 |       ledR.left >= 0 &&
  525 |       ledR.top >= 0 &&
  526 |       ledR.right <= window.innerWidth &&
  527 |       ledR.bottom <= window.innerHeight;
  528 |     const ledInsideCard =
  529 |       ledR.left >= cardR.left - 0.5 &&
  530 |       ledR.top >= cardR.top - 0.5 &&
  531 |       ledR.right <= cardR.right + 0.5 &&
  532 |       ledR.bottom <= cardR.bottom + 0.5;
  533 |     const hitOk = hit === ledEl || ledEl.contains(hit);
  534 |     return {
  535 |       inViewport,
  536 |       ledInsideCard,
  537 |       hitOk,
  538 |       cardBg: cardStyle.backgroundColor,
  539 |     };
  540 |   });
  541 |   expect(geometry.inViewport).toBe(true);
  542 |   expect(geometry.ledInsideCard).toBe(true);
  543 |   expect(geometry.hitOk).toBe(true);
  544 |   expect(geometry.cardBg === 'rgba(0, 0, 0, 0)' || geometry.cardBg === 'transparent').toBeTruthy();
  545 | }
  546 | 
  547 | test.describe('Chief 고정 — 목록 11 주행·일시정지 중 주소창', () => {
  548 |   // 2026-10-24 Chief: 「주행 전 routedock 가로길이를 주행 중과 같은 길이로」(종전 250px 고정 대체).
  549 |   test('대기 화면 펼친 주소 카드 폭은 주행 중 펼친 주소 카드(=미니맵) 폭과 같다', async ({ page }) => {
  550 |     for (const size of [{ width: 800, height: 360 }, { width: 667, height: 300 }, { width: 1280, height: 720 }]) {
  551 |       await page.setViewportSize(size);
  552 |       await page.goto(`${preview}?state=ready`);
  553 |       await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
  554 |       const readyWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  555 |       await page.goto(`${preview}?state=riding`);
  556 |       await page.getByRole('button', { name: '경로 패널 펼치기' }).click();
  557 |       await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toBeVisible();
  558 |       const ridingWidth = (await page.locator('.route-dock__card').boundingBox())!.width;
  559 |       expect(Math.abs(readyWidth - ridingWidth), `${size.width}×${size.height}`).toBeLessThanOrEqual(1);
  560 |     }
  561 |   });
  562 | 
  563 |   test('주행·일시정지는 접힌 상태로 시작하고 펼치면 출발·도착이 보이며 미니맵과 너비가 같다', async ({ page }, testInfo) => {
  564 |     const evidenceDir = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? testInfo.outputPath('route-dock-evidence');
  565 |     await fs.mkdir(evidenceDir, { recursive: true });
  566 | 
  567 |     for (const state of ['riding', 'paused'] as const) {
  568 |       await page.setViewportSize({ width: 800, height: 360 });
  569 |       await page.goto(`${preview}?state=${state}&long&waypoints=1`);
  570 |       await expect(page.locator('.route-dock-anchor')).toBeVisible();
  571 |       await expect(page.locator('.route-dock-anchor.route-dock-anchor--open')).toHaveCount(0);
  572 |       const expand = page.getByRole('button', { name: '경로 패널 펼치기' });
  573 |       await assertCollapsedRouteDockChip(page);
  574 |       await expect(page.locator('.route-dock__stops')).toBeHidden();
  575 | 
  576 |       await page.evaluate(() => {
  577 |         const style = document.createElement('style');
  578 |         style.setAttribute('data-testid', 'late-map-bottom-left-stack-width');
  579 |         style.textContent = `
  580 | .map-bottom-left-stack > .route-dock-anchor {
  581 |   width: min(250px, calc(100vw - 16px));
  582 |   max-width: min(250px, calc(100vw - 16px));
  583 | }`;
  584 |         document.head.appendChild(style);
  585 |       });
  586 |       await assertCollapsedRouteDockChip(page);
  587 | 
  588 |       if (state === 'riding') {
  589 |         const expandBox = (await expand.boundingBox())!;
  590 |         await page.screenshot({
  591 |           path: path.join(evidenceDir, 'riding-collapsed-800x360.png'),
  592 |           animations: 'disabled',
  593 |         });
  594 |         await page.screenshot({
  595 |           path: path.join(evidenceDir, 'riding-collapsed-zoom.png'),
  596 |           animations: 'disabled',
  597 |           clip: {
  598 |             x: Math.max(0, expandBox.x + expandBox.width / 2 - 60),
  599 |             y: Math.max(0, expandBox.y + expandBox.height / 2 - 60),
  600 |             width: 120,
  601 |             height: 120,
  602 |           },
  603 |         });
  604 |       }
  605 |       if (state === 'paused') {
  606 |         await page.screenshot({
  607 |           path: path.join(evidenceDir, 'paused-collapsed-800x360.png'),
  608 |           animations: 'disabled',
  609 |         });
  610 |       }
```