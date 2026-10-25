# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ride-continuation.spec.ts >> 다음 주행 · 이어 달리기 >> RC3 — 완주 끝점에서 새 Route 를 연결하고 이전 경로는 불변이다
- Location: e2e\ride-continuation.spec.ts:497:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: '주행 시작' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('button', { name: '주행 시작' })
    13 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic:
        - region "Map" [ref=e6]
        - img "출발 (Start)":
          - img:
            - generic:
              - generic: S
      - generic:
        - generic:
          - generic:
            - status "카메라 고도(해수면 기준)": 고도 3.0 km
          - generic:
            - generic: 300 m
        - link "Mapbox homepage" [ref=e8] [cursor=pointer]:
          - /url: https://www.mapbox.com/
      - generic [ref=e9]:
        - button "닫기" [ref=e10] [cursor=pointer]: ×
        - generic [ref=e11]:
          - generic [ref=e12]:
            - generic [ref=e13]:
              - status [ref=e14]:
                - paragraph [ref=e15]: 경로 생성
              - tablist "경로 생성 방식" [ref=e16]:
                - tab "출발·도착" [ref=e17] [cursor=pointer]: Start·End
                - tab "거리·방향" [selected] [ref=e18] [cursor=pointer]
            - generic [ref=e19]: 대한민국 서울특별시 강남구 테헤란로7길 12
          - tabpanel "거리·방향" [ref=e20]:
            - generic [ref=e21]:
              - generic [ref=e22]: 목표거리(km)
              - button "목표 거리 0.5km 감소" [ref=e23] [cursor=pointer]: −
              - button "목표 거리 0.5km 증가" [ref=e24] [cursor=pointer]: +
              - textbox "목표거리 km" [ref=e25]: "1.0"
              - generic [ref=e26]: 목표 거리
              - generic [ref=e27]: km
              - generic [ref=e28]:
                - button "목표 거리 1km" [ref=e29] [cursor=pointer]: "1"
                - button "목표 거리 3km" [ref=e30] [cursor=pointer]: "3"
                - button "목표 거리 5km" [ref=e31] [cursor=pointer]: "5"
                - button "목표 거리 10km" [ref=e32] [cursor=pointer]: "10"
                - button "목표 거리 20km" [ref=e33] [cursor=pointer]: "20"
          - generic [ref=e35]:
            - button "주행 시작" [disabled] [ref=e36]
            - button "경로 전체 삭제" [ref=e37] [cursor=pointer]: 경로 삭제
    - generic:
      - generic "경로 보기":
        - generic [ref=e38]:
          - generic [ref=e39]:
            - 'button "케이던스 센서: 연결 안 됨" [ref=e40] [cursor=pointer]':
              - generic [ref=e42]: 센서
            - button "경로 패널 접기" [expanded] [ref=e43] [cursor=pointer]:
              - img
          - list [ref=e46]:
            - listitem [ref=e47]:
              - button "Start 대한민국 서울특별시 강남구 테헤란로7길 12" [ref=e48] [cursor=pointer]:
                - generic "Start" [ref=e49]: S
                - generic "대한민국 서울특별시 강남구 테헤란로7길 12" [ref=e50]
              - button "Start 삭제" [ref=e51] [cursor=pointer]:
                - img
    - generic "라이딩 HUD":
      - button "Trail 메뉴" [ref=e52] [cursor=pointer]
      - button "맵 뷰 설정" [ref=e53] [cursor=pointer]: 맵 뷰
      - complementary "Trail·동행" [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]:
            - generic [ref=e59]: 접속
            - generic "default" [ref=e60]: Trailhead
          - list [ref=e61]:
            - listitem [ref=e62]: 게스트-7h5l
            - listitem [ref=e63]: 게스트-ECVA (나)
            - listitem [ref=e64]: 게스트-gf15
      - generic [ref=e65]:
        - group "맵 제어" [ref=e66]:
          - button "맵 스타일 야외, 클릭 시 위성" [ref=e67] [cursor=pointer]: 야외
          - button "줌 확대" [ref=e68] [cursor=pointer]: +
          - button "줌 축소" [ref=e69] [cursor=pointer]: −
        - button "순위" [ref=e71] [cursor=pointer]:
          - img [ref=e72]
        - button "사용자 정보" [active] [ref=e74] [cursor=pointer]:
          - generic [ref=e75]: G
          - generic [ref=e76]:
            - generic [ref=e77]: 게스트-ECVA
            - generic [ref=e78]: 2 km
      - time: 26.10.24 / 22:07:10
  - button "메뉴 열기" [ref=e79] [cursor=pointer]:
    - img [ref=e81]
  - button "맵 뷰 열기" [ref=e83] [cursor=pointer]:
    - img [ref=e85]
  - generic:
    - button
    - dialog:
      - banner:
        - generic:
          - generic: Spinatlas
        - button:
          - img
      - generic:
        - complementary:
          - generic: 경로
          - list:
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 입문 경로
                - generic: 처음이라면
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 퍼블릭 경로
                - generic: 다른 라이더가 만든 길
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 내 경로
                - generic: "1"
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 지명 검색
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 순위
                - img
            - listitem:
              - button:
                - generic:
                  - img
                - generic: 주행 설정
                - img
          - status: 마지막 종료 지점에서 거리·방향 자동 Route — 지도에서 방향을 클릭하세요.
        - region:
          - generic: 지금 달리는 Trail
          - paragraph: 없음
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
          - generic: 10월 24일 · 주행 2회
          - paragraph:
            - strong: "1.99"
            - generic: km
          - generic:
            - generic: 2분
            - generic: ·평균 44.3km/h
            - generic:
              - text: 칼로리는
              - button: 체중 입력
              - text: 후 표시
      - generic:
        - banner:
          - generic:
            - strong: 게스트-ECVA
            - generic: 게스트로 이용 중
          - button:
            - img
        - generic:
          - group:
            - generic: 내 도로망
            - generic:
              - generic: "1.0"
              - generic: km
          - group:
            - generic: 누적
            - generic:
              - generic: "2.0"
              - generic: km
              - generic: ·
              - generic: "2"
              - generic: 회
              - generic: ·
              - generic: "2"
              - generic: 분
          - button:
            - generic:
              - text: 마지막 주행
              - generic: 방금
            - generic:
              - generic: "1.00"
              - generic: km
              - generic: ·
              - generic: "1"
              - generic: 분
              - generic: ·
              - generic: "44.3"
              - generic: km/h
              - generic:
                - img
          - group:
            - generic: 플랜
            - generic: 게스트 · 회원 등록하면 어느 기기에서나 이어져요
        - generic:
          - button: 프로필 수정
          - button: 회원 등록
          - button: 로그아웃
```

# Test source

```ts
  436 |       const cumulativeKm = await readHudCumulativeKm(page)
  437 |       const sessionKm = cumulativeKm - resumeBaselineKm
  438 |       expect(cumulativeKm, '누적 위치가 세션 거리보다 작다').toBeGreaterThan(sessionKm)
  439 |       expect(resumeBaselineKm, '재개 기준선이 offset 시드에 못 미친다').toBeGreaterThanOrEqual(
  440 |         (resumeOffsetM * 0.85) / 1000,
  441 |       )
  442 |       fs.mkdirSync(path.dirname(U4_HUD_EVIDENCE_PATH), { recursive: true })
  443 |       await page.screenshot({ path: U4_HUD_EVIDENCE_PATH })
  444 |       await page.screenshot({ path: testInfo.outputPath('u4-hud-resume-dual.png') })
  445 |     })
  446 | 
  447 |     const summary2 = page.getByRole('region', { name: '주행 결과' })
  448 |     await expect(summary2).toBeVisible({ timeout: 20_000 })
  449 |     const progressText = await summary2.getByLabel('전체 진행').innerText()
  450 |     const [fromPct, toPct] = (progressText.match(/(\d+)%/g) ?? []).map((v) => Number(v.replace('%', '')))
  451 |     expect(fromPct, `이전 진행률이 재개 지점과 다르다: ${progressText}`).toBe(resumePct)
  452 |     expect(toPct, `누적 진행률이 늘지 않았다: ${progressText}`).toBeGreaterThan(resumePct)
  453 | 
  454 |     // 서버 문서도 누적 진행률로 올라간다.
  455 |     // 결과 시트는 로컬 record 로 낙관 표시되므로 Firestore 반영은 조금 뒤에 온다 — 폴링한다.
  456 |     await expect
  457 |       .poll(async () => fieldNumber(await readSavedRoute(routeId), 'lastProgressRatio'), {
  458 |         timeout: 30_000,
  459 |         message: '서버 진행률이 재개 지점보다 올라가지 않았다',
  460 |       })
  461 |       .toBeGreaterThan(resumePct / 100)
  462 |   })
  463 | 
  464 |   // ── RC2: 이어달리기 e2e — stale 낮은 진행률 write 방어 (원문 §6 C2 와 무관) ──
  465 |   test('RC2 — 늦은 낮은 진행률 write 가 높은 진행률을 되돌리지 않는다', async ({ page }) => {
  466 |     await enterAsGuest(page)
  467 |     const uid = await readGuestUid(page)
  468 |     const routeId = `fixture-rc2-${Date.now()}`
  469 |     // 앱이 20% 를 캐시한 상태에서 서버가 43% 로 올라간 상황을 만든다.
  470 |     await seedSavedRoute({ uid, routeId, name: 'RC2 stale 픽스처', lastProgressRatio: 0.2 })
  471 | 
  472 |     await reloadAtDefaultLocation(page)
  473 |     await prepareManualRideInput(page)
  474 |     await loadSavedRouteFromMenu(page, 'RC2 stale 픽스처', '이어 달리기')
  475 | 
  476 |     // 로드 이후 다른 탭이 43% 로 올린다(클라이언트는 여전히 20% 를 들고 있다)
  477 |     await forceSavedRouteProgress(routeId, 0.43)
  478 | 
  479 |     // 처음부터 달려 약 31% 에서 종료 → 클라이언트 요청값은 43% 보다 낮다
  480 |     await page.getByRole('button', { name: '이어 달리기 선택', exact: true }).click()
  481 |     await page.getByRole('radio', { name: /처음부터/ }).check()
  482 |     await page.getByRole('button', { name: '주행 시작' }).click()
  483 |     await rideUntilSessionMeters(page, FIXTURE_LENGTH_M * 0.31)
  484 |     await expect(page.getByRole('region', { name: '주행 결과' })).toBeVisible({ timeout: 20_000 })
  485 | 
  486 |     await expect
  487 |       .poll(async () => fieldNumber(await readSavedRoute(routeId), 'lastProgressRatio'), {
  488 |         timeout: 20_000,
  489 |         message: 'stale write 가 진행률을 되돌렸다',
  490 |       })
  491 |       .toBeGreaterThanOrEqual(0.43)
  492 | 
  493 |     await reloadAtDefaultLocation(page)
  494 |     const card = nextRideCard(page)
  495 |     await expect(card).toBeVisible({ timeout: 30_000 })
  496 |     await expect(card.getByRole('button', { name: /43%에서 이어 달리기/ })).toBeVisible()
  497 |   })
  498 | 
  499 |   // ── RC3: 이어달리기 e2e — 완주 후 새 Route 연결 (원문 §6 C3 와 무관) ──
  500 |   test('RC3 — 완주 끝점에서 새 Route 를 연결하고 이전 경로는 불변이다', async ({ page }) => {
  501 |     await enterAsGuest(page)
  502 |     const uid = await readGuestUid(page)
  503 |     const routeId = `fixture-rc3-${Date.now()}`
  504 |     await seedSavedRoute({ uid, routeId, name: 'RC3 완주 픽스처', lastProgressRatio: 0 })
  505 |     const before = await readSavedRoute(routeId)
  506 |     const geometryBefore = (before.geometryCoordsJson as { stringValue?: string })?.stringValue
  507 | 
  508 |     await reloadAtDefaultLocation(page)
  509 |     await prepareManualRideInput(page)
  510 |     await loadSavedRouteFromMenu(page, 'RC3 완주 픽스처')
  511 |     await page.getByRole('button', { name: '주행 시작' }).click()
  512 |     // 끝까지 달린다 — 경로 끝에 닿으면 도착 자동 종료가 결과 시트를 연다(버튼을 누르지 않는다).
  513 |     await expect(page.getByRole('button', { name: '주행 종료' })).toBeEnabled({ timeout: 30_000 })
  514 |     const summary = page.getByRole('region', { name: '주행 결과' })
  515 |     await expect(summary).toBeVisible({ timeout: 240_000 })
  516 |     /*
  517 |      * 완주 표시의 변천: 「경로를 완주했습니다」 문단 → 「완주」 배지 → **배지도 제거**
  518 |      * (2026-09-17 Chief: "사용자는 주행을 마치는 순간에 완주를 인식하고, 결과의 숫자로
  519 |      * 다시 확인한다"). 이제 완주의 증거는 **주행거리 = 총거리** 그 자체다.
  520 |      */
  521 |     const donePair = summary.getByLabel('주행 거리 / 경로 전체거리')
  522 |     await expect(donePair).toBeVisible({ timeout: 15_000 })
  523 |     // 2026-10-08 — 진행 블록으로 바뀌어 숫자는 data-* 로 읽는다
  524 |     const doneRidden = Number(await donePair.getAttribute('data-ridden-km'))
  525 |     const doneTotal = Number(await donePair.getAttribute('data-total-km'))
  526 |     const doneText = `${doneRidden} / ${doneTotal}`
  527 |     expect(doneTotal, `총거리를 읽지 못했다: ${doneText}`).toBeGreaterThan(0)
  528 |     expect(doneRidden, `완주인데 주행거리≠총거리: ${doneText}`).toBeCloseTo(doneTotal, 2)
  529 |     // 미완주 진행률 배지는 완주 시 뜨지 않는다
  530 |     await expect(summary.getByLabel('전체 진행')).toHaveCount(0)
  531 |     // 「끝점에서 새 경로」 버튼도 사라졌다(Chief 지시, 되살리지 않는다) — 살아있는 진입점
  532 |     // (사용자 정보 → 최근 주행 → 「여기서 새 경로」)으로 다시 겨눈다. 시트를 먼저 닫아야
  533 |     // 한다 — 전체화면 scrim 이 HUD 클릭을 막는다.
  534 |     await closeRideResult(page)
  535 |     await expect(summary).toBeHidden({ timeout: 15_000 })
> 536 |     await extendFromRecentRideRow(page)
      |                                                               ^ Error: expect(locator).toHaveCount(expected) failed
  537 | 
  538 |     // R1 §4 — 자동 Route 가 1급 진입: Go 없이 pick dock 이 열리고 거리·방향 모드가 켜진다
  539 |     await expect(page.getByRole('button', { name: '주행 시작' })).toHaveCount(0)
  540 |     const extendDock = page.locator('.map-view__pick-dock-panel, .map-view__pick-popup').last()
  541 |     await expect(extendDock).toBeVisible({ timeout: 15_000 })
  542 |     await expect(
  543 |       extendDock.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' }),
  544 |     ).toBeChecked()
  545 | 
  546 |     // 이전 SavedRoute geometry 는 mutate 되지 않는다
  547 |     const after = await readSavedRoute(routeId)
  548 |     expect((after.geometryCoordsJson as { stringValue?: string })?.stringValue).toBe(geometryBefore)
  549 |     expect(fieldNumber(after, 'completed')).toBe(1)
  550 |   })
  551 | 
  552 |   // ── RC4: 이어달리기 e2e — ad-hoc 주행 후 다음 출발점 (원문 §6 C4·C5 와 무관) ──
  553 |   test('RC4 — ad-hoc 주행은 저장하지 않아도 다음 출발점이 남는다', async ({ page }) => {
  554 |     await enterAsGuest(page)
  555 |     await prepareManualRideInput(page)
  556 | 
  557 |     // 입문 코스는 SavedRoute 가 아니다 → 종료 시 ad-hoc 컨텍스트가 된다
  558 |     await openTrailMenu(page)
  559 |     await page.getByRole('button', { name: '입문' }).click()
  560 |     const modal = page.getByRole('dialog').filter({ has: page.locator('#oc-modal-title') })
  561 |     await expect(modal).toBeVisible()
  562 |     await modal.locator('button.oc-modal__item').first().click()
  563 | 
  564 |     await page.getByRole('button', { name: '주행 시작' }).click()
  565 |     // 입문 경로는 0.5 km 미만이라 도착 자동 종료가 먼저 온다 — 결과 시트를 기다린다.
  566 |     await expect(page.getByRole('button', { name: '주행 종료' })).toBeEnabled({ timeout: 30_000 })
  567 |     const summary = page.getByRole('region', { name: '주행 결과' })
  568 |     await expect(summary).toBeVisible({ timeout: 180_000 })
  569 |     // 「다음 출발점이 저장되었습니다」 문구는 컴팩트 재설계로 제거됐다(Chief 지시, 되살리지
  570 |     // 않는다) — 같은 사실은 아래 reload 후 「다음 주행」 카드 등장으로 이미 증명된다.
  571 |     // 저장하지 않고 닫는다 — 경고 없이 즉시 닫혀야 한다
  572 |     await summary.getByRole('button', { name: '저장 안 함' }).click()
  573 |     await closeRideResult(page)
  574 | 
  575 |     await reloadAtDefaultLocation(page)
  576 |     const card = nextRideCard(page)
  577 |     await expect(card).toBeVisible({ timeout: 30_000 })
  578 |     await expect(card.getByRole('button', { name: '여기에서 계속' })).toBeVisible()
  579 |     await card.getByRole('button', { name: '여기에서 계속' }).click()
  580 |     const extendDock = page.locator('.map-view__pick-dock-panel, .map-view__pick-popup').last()
  581 |     await expect(extendDock).toBeVisible({ timeout: 15_000 })
  582 |     await expect(
  583 |       extendDock.getByRole('checkbox', { name: '거리와 방향으로 Route 찾기' }),
  584 |     ).toBeChecked()
  585 |   })
  586 | 
  587 |   // ── RC5: 이어달리기 e2e — legacy Ride CTA 없음 (원문 §6 C5 와 무관) ──
  588 |   test('RC5 — legacy Ride 는 기록만 보이고 잘못된 CTA·Null Island 이동이 없다', async ({ page }) => {
  589 |     await enterAsGuest(page)
  590 |     const uid = await readGuestUid(page)
  591 |     await seedLegacyRide(uid, `legacy-${Date.now()}`)
  592 | 
  593 |     const pageErrors: string[] = []
  594 |     page.on('pageerror', (err) => pageErrors.push(String(err)))
  595 | 
  596 |     await reloadAtDefaultLocation(page)
  597 |     // 좌표도 Route 도 없는 Ride 뿐이므로 「다음 주행」 카드는 뜨지 않는다
  598 |     await expect(nextRideCard(page)).toHaveCount(0)
  599 | 
  600 |     // 기록 자체는 최근 주행 목록에 남는다.
  601 |     // 목록을 여는 토글의 화면 문구는 「마지막 주행」이다 — 「최근 주행」은 소스 주석에만 있고
  602 |     // 버튼 접근명이 아니다. 종전 셀렉터가 그 주석 표현을 쓰고 있어 이 시험은 **이미 깨져 있었다**
  603 |     // (2026-09-17 확인, 이번 컴팩트 재설계와 무관한 기존 결함).
  604 |     await page.getByRole('button', { name: '사용자 정보' }).click()
  605 |     const history = page.getByRole('button', { name: '마지막 주행' })
  606 |     await expect(history).toBeVisible({ timeout: 15_000 })
  607 |     await history.click()
  608 |     await expect(page.getByText('5.20 km').first()).toBeVisible({ timeout: 15_000 })
  609 |     // legacy 행에는 이어 달리기·새 경로 CTA 가 없다
  610 |     await expect(page.getByRole('button', { name: '이어 달리기' })).toHaveCount(0)
  611 |     await expect(page.getByRole('button', { name: '여기서 새 경로' })).toHaveCount(0)
  612 | 
  613 |     expect(pageErrors, `스크립트 예외: ${pageErrors.join(' | ')}`).toEqual([])
  614 |   })
  615 | 
  616 |   /**
  617 |    * RC13 — §6 C13 e2e: reload 없이 종료→카드→이어 달리기 Go 까지 완주한다.
  618 |    *
  619 |    * RC1 은 결과 시트를 닫은 뒤 **재진입(page.reload)**해 재개를 검증한다 (§6 C1 과 무관).
  620 |    * RC13 은 같은 세션에서 reload 없이 카드 → resume → 센서 준비 → Go → HUD 를 검증한다.
  621 |    * 핵심 가설: 첫 번째 reload 이후 mapLoaded=true 가 유지되므로
  622 |    *            resume-marker 가 reload 없이도 렌더링되어야 한다.
  623 |    */
  624 |   test('RC13 — reload 없이 종료→카드→이어 달리기 Go 까지 완주한다', async ({ page }) => {
  625 |     await enterAsGuest(page)
  626 |     const uid = await readGuestUid(page)
  627 |     const routeId = `fixture-rc13-${Date.now()}`
  628 |     await seedSavedRoute({ uid, routeId, name: 'RC13 이어달리기 픽스처', lastProgressRatio: 0 })
  629 | 
  630 |     // 첫 번째 reload: 씨드된 경로를 앱에 반영
  631 |     await reloadAtDefaultLocation(page)
  632 |     await prepareManualRideInput(page)
  633 |     await loadSavedRouteFromMenu(page, 'RC13 이어달리기 픽스처')
  634 | 
  635 |     // 1차 주행 — 전체의 약 20%
  636 |     await page.getByRole('button', { name: '주행 시작' }).click()
```