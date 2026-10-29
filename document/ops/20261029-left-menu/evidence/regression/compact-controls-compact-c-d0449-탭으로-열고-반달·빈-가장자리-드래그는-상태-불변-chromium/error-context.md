# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: compact-controls.spec.ts >> compact-controls tap handles touch >> 터치: 탭으로 열고 반달·빈 가장자리 드래그는 상태 불변
- Location: e2e\compact-controls.spec.ts:599:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: '메뉴', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('dialog', { name: '메뉴', exact: true })

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
```

# Test source

```ts
  525 |       expect(hit, '열린 왼쪽 반달이 메뉴·스크림 위').toBe(true);
  526 |       await menuBtn.click();
  527 |       await expect(menu).toHaveCount(0);
  528 |       expect(await caretPath(page, 'left')).toBe(LEFT_CLOSED);
  529 | 
  530 |       await rankBtn.click();
  531 |       await expect(rank).toBeVisible();
  532 |       const rightOpen = (await page.locator('.edge-panel-tab--right').boundingBox())!;
  533 |       expect(Math.abs(rightOpen.x - rightClosed.x), '오른쪽 x').toBeLessThanOrEqual(1);
  534 |       expect(Math.abs(rightOpen.y - rightClosed.y), '오른쪽 y').toBeLessThanOrEqual(1);
  535 |       expect(await caretPath(page, 'right')).toBe(RIGHT_OPEN);
  536 |       await rankBtn.click();
  537 |       await expect(rank).toBeHidden();
  538 |       expect(await caretPath(page, 'right')).toBe(RIGHT_CLOSED);
  539 | 
  540 |       if (size.width === 699) {
  541 |         await saveTapShot(page, `tap-closed-${size.width}x${size.height}.png`);
  542 |         await menuBtn.click();
  543 |         await saveTapShot(page, `tap-left-open-${size.width}x${size.height}.png`);
  544 |         await menuBtn.click();
  545 |         await rankBtn.click();
  546 |         await saveTapShot(page, `tap-right-open-${size.width}x${size.height}.png`);
  547 |       }
  548 |     });
  549 |   }
  550 | 
  551 |   test('Enter·Space로 왼쪽 열고 닫기', async ({ page }) => {
  552 |     await page.setViewportSize({ width: 800, height: 360 });
  553 |     await page.goto(`${preview}?state=ready`);
  554 |     const menuBtn = page.getByRole('button', { name: '메뉴 열기', exact: true });
  555 |     const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  556 |     await menuBtn.focus();
  557 |     await page.keyboard.press('Enter');
  558 |     await expect(menu).toBeVisible();
  559 |     await menuBtn.focus();
  560 |     await expect(menuBtn).toBeFocused();
  561 |     await page.keyboard.press('Space');
  562 |     await expect(menu).toHaveCount(0);
  563 |   });
  564 | 
  565 |   test('마우스: 닫힌/열린 반달·빈 가장자리 드래그는 상태 불변', async ({ page }) => {
  566 |     await page.setViewportSize({ width: 800, height: 360 });
  567 |     await page.goto(`${preview}?state=ready`);
  568 |     const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  569 |     const rank = page.locator('#lb-glance-panel');
  570 |     const left = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  571 |     const right = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
  572 |     await mouseDrag(page, knobCenter(left), { x: left.x + 140, y: left.y + left.height / 2 });
  573 |     await expect(menu, '닫힌 왼쪽 반달 드래그').toHaveCount(0);
  574 |     await mouseDrag(page, knobCenter(right), { x: right.x - 140, y: right.y + right.height / 2 });
  575 |     await expect(rank, '닫힌 오른쪽 반달 드래그').toBeHidden();
  576 |     await mouseDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
  577 |     await expect(menu, '닫힌 빈 가장자리 드래그').toHaveCount(0);
  578 | 
  579 |     await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  580 |     await expect(menu).toBeVisible();
  581 |     const leftOpen = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  582 |     await mouseDrag(page, knobCenter(leftOpen), { x: leftOpen.x + 140, y: leftOpen.y + leftOpen.height / 2 });
  583 |     await expect(menu, '열린 왼쪽 반달 드래그').toBeVisible();
  584 |     await mouseDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
  585 |     await expect(menu, '열린 빈 가장자리 드래그').toBeVisible();
  586 |     await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  587 | 
  588 |     await page.getByRole('button', { name: '순위 열기', exact: true }).click();
  589 |     await expect(rank).toBeVisible();
  590 |     const rightOpen = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
  591 |     await mouseDrag(page, knobCenter(rightOpen), { x: rightOpen.x - 140, y: rightOpen.y + rightOpen.height / 2 });
  592 |     await expect(rank, '열린 오른쪽 반달 드래그').toBeVisible();
  593 |   });
  594 | });
  595 | 
  596 | test.describe('compact-controls tap handles touch', () => {
  597 |   test.use({ hasTouch: true });
  598 | 
  599 |   test('터치: 탭으로 열고 반달·빈 가장자리 드래그는 상태 불변', async ({ page }) => {
  600 |     await page.setViewportSize({ width: 699, height: 273 });
  601 |     await page.goto(`${preview}?state=ready`);
  602 |     const menu = page.getByRole('dialog', { name: '메뉴', exact: true });
  603 |     const rank = page.locator('#lb-glance-panel');
  604 |     const left = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  605 |     const right = (await page.locator('.edge-panel-tab--right .edge-panel-tab__knob').boundingBox())!;
  606 | 
  607 |     await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
  608 |     await expect(menu).toBeVisible();
  609 |     await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
  610 |     await expect(menu).toHaveCount(0);
  611 | 
  612 |     await page.touchscreen.tap(right.x + right.width / 2, right.y + right.height / 2);
  613 |     await expect(rank).toBeVisible();
  614 |     await page.touchscreen.tap(right.x + right.width / 2, right.y + right.height / 2);
  615 |     await expect(rank).toBeHidden();
  616 | 
  617 |     await touchDrag(page, knobCenter(left), { x: left.x + 140, y: left.y + left.height / 2 });
  618 |     await expect(menu, '터치 왼쪽 반달 드래그').toHaveCount(0);
  619 |     await touchDrag(page, knobCenter(right), { x: right.x - 140, y: right.y + right.height / 2 });
  620 |     await expect(rank, '터치 오른쪽 반달 드래그').toBeHidden();
  621 |     await touchDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
  622 |     await expect(menu, '터치 빈 가장자리 드래그').toHaveCount(0);
  623 | 
  624 |     await page.touchscreen.tap(left.x + left.width / 2, left.y + left.height / 2);
> 625 |     await expect(menu).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
  626 |     const leftOpen = (await page.locator('.edge-panel-tab--left .edge-panel-tab__knob').boundingBox())!;
  627 |     await touchDrag(page, knobCenter(leftOpen), { x: leftOpen.x + 140, y: leftOpen.y + leftOpen.height / 2 });
  628 |     await expect(menu, '터치 열린 왼쪽 반달 드래그').toBeVisible();
  629 |     await touchDrag(page, { x: 10, y: 80 }, { x: 130, y: 80 });
  630 |     await expect(menu, '터치 열린 빈 가장자리 드래그').toBeVisible();
  631 |   });
  632 | });
  633 | 
```