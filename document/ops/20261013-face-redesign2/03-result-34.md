# 결과34 — 위치/거리 별도 화면(routePickView 단일 상태)

- 시작: branch `face-redesign2`, HEAD `8fdedae`, dirty(선행 29/30/31/32·타 담당자, 되돌림 없음):
  `MenuPanel.css`, `UserInfoSheet.css/.tsx`, `MapView.css`, `MapView.tsx`(32 observer),
  `mapPopupElements.ts`(30/31), `MapHud.css`, `LocalFirstEntryCard.css`,
  `OfficialCourseListModal.css`, `SavedRoutesPanel.css`, `PROGRESS.md`, `README.md`,
  + `document/ops/20261013-face-redesign2/` untracked.
- 소유: `mapPopupElements.ts` + `MapView.css`의 pick 관련만. 32 ResizeObserver·33 높이 상한 유지,
  토큰 mount 공용인터페이스·라우팅 알고리즘·Firebase·센서·다른 UI·MapView.tsx 미접촉.
- commit/push/merge/deploy/server/하위agent 없음. mobile-ui-redesign은 읽기만(해당 UI 제목 1선 참조).

## 수정 (`mapPopupElements.ts`)

1. `routeLocationExpanded/routeDistanceExpanded`·두 토글·toolbar·양쪽 펼침 제거 →
   `let routePickView: "location" | "distance"` 단일 상태. 초기값은
   `pins.start && (distanceDirectionChecked || autoSessionActive) ? "distance" : "location"`.
   신규 식별자는 route 계열(`routePickView/routeLocationView/routeDistanceHead·BackBtn·Title·
   Summary·EnterBtn·Caption·Unit`, `ROUTE_PROFILE_KO`) — course 미도입.
2. 위치 화면: `routeLocationView`에 pinRow → profileSection 순서로 조립, wrap은
   `dragHandle, routeLocationView, autoRouteSection`. 거리 화면에선
   `routeLocationView`·`addressEl`·`metaEl` hidden, `profileSection`은 위치뷰 안에만 존재.
   토큰 제목행(dragHandle)은 양쪽 공통 표시. 출발 전엔 기존 Start 버튼 그대로, 진입 버튼은
   `profileSection` hidden으로 함께 hidden(Start 후 접근).
3. 진입 버튼 `거리 ›`는 rowProfile 끝(`map-view__pick-btn--route-enter`, min 44×44, 별도 행 없음).
   경로 삭제 이동은 생략 — 계약(3D-2 `rowProfile.appendChild(clearRouteBtn)`)이 rowProfile에 고정했고
   지시는 "가능하면"이라 계약을 우선. 5개 1행의 폭 산정은 아래 정적 감사 참조.
4. 거리 화면 = `autoRouteSection`(계약 `autoRouteSection.append(distanceRow, autoRouteStatusSlot)` 유지):
   `‹ 위치 선택` 복귀 + `목표 거리로 경로 만들기` 제목 1행, `출발 설정됨 · 자동차/자전거/보행` 요약
   (`ROUTE_PROFILE_KO[currentProfile]`, profile 클릭·토큰 구독·Start/End에서 `syncRoutePickView`로 동기화,
   클릭 지점 주소 오표시 없음). 긴 2문단 가이드 없음 — 기존 방향 status 그대로.
   한행 `목표 거리 −/숫자/km/＋`은 DOM 순서(계약 `distanceRow.append(modeField, …)` 고정) 유지 +
   CSS `order`로만 시각 배열, sr-only label은 AT용 유지·보이는 캡션/단위는 `aria-hidden`.
   프리셋 1/3/5/10/20·ETA·status 기존 경로 유지. checkbox DOM(계약 클래스·aria 상수)은
   `modeField.hidden`으로 내부 동기화만(조작·탭 불가).
5. 진입 `applyDistanceDirectionMode(true)` = bridge 방향대기 활성화 + distance뷰.
   원격탐색·토큰차감·핀초기화·경로삭제 없음(`previewCircle`+`tryArm` 기존 경로만).
   복귀 `applyDistanceDirectionMode(false)` = disarm/원·디버그마커 정리 + `setInlinePhase("idle")`
   (기존 mode-off) 후 location뷰. 핀·목표거리·수단·기생성 경로 임의초기화 없음.
   `startBtn.onclick` 첫 줄을 `onClearAutoRouteClickDebugMarker?.()`로 복원(아래 계약 복구).
6. 하단 bridge microtask·토큰 구독도 같은 단일 view로 동기화. `setInlinePhase`는 문구/class만
   갱신(화면 리셋 없음) → searching/failed/found 전부 거리 화면에서 읽힘.
   `syncProfileUi` 본문·`manualRouteReady` disabled 로직 불변.
7. 단일 `syncRoutePickView()`가 hidden/버튼/요약 갱신. `syncAutoRouteUi()` 함수명·호출·
   `pins.start && typeof onArmDirectionPick`식은 계약상 유지하고, 전제 상실 시에만 location 복귀+
   idle 정리 후 `syncRoutePickView()`에 위임(값 리셋 없음). TDZ: 함수 선언 호이스팅 + 첫 호출은
   모든 DOM 정의 뒤(`syncAutoRouteUi(); syncDistanceModeUi(); syncDistanceInputs(targetKm);`).

## 수정 (`MapView.css`, pick 관련만)

- 토글 전용 dead 규칙 삭제(`.map-view__pick-route-panel*`, `.map-view__pick-route-toolbar*`,
  `.map-view__pick-route-toggle*` 10선). 기존 전체 `.map-view__pick [hidden]` 유지.
- 추가: `.map-view__pick-route-view(--location)`, `--route-enter/--route-back`(44px는 이 둘만),
  `-route-distance-head/-title/-summary`, `-distance-caption/-unit` + row `order` 0~6.
  기존 버튼/폰트/칩/ETA/status/높이상한 규칙 불변, `min-width: 40px` 미도입(계약), 새 row/card/큰여백 없음.

## 검증 (Developer, 서버·브라우저 미사용)

- `git diff --check`: 통과(출력 없음).
- `npx tsc -b --pretty false` (apps/web): 통과(출력 없음).
- 거리 계약 스위트 141/141 통과:
  `distance-auto-route-{contract,exact-clip,click-intent,reach-offer-session,clip-boundary,
  slider-snap,too-close,eta}.test.ts`.
  - 기준선(작업 전): 30/31 dirty로 2건 실패 —
    `3D-2-R1 상태 메시지 단일 슬롯`(append 구조 변경),
    `click-intent 방향 클릭만 marker`(startBtn 첫 줄 순서 변경).
  - 본 구현이 두 계약 문자열을 복원해 141/141. 계약 고정 문자열 전부 보존(append 3선·checkbox·
    slider/number/step·arm/preview/validation·disarm·phases·grid columns·`--pick-distance-control-height`).
- 정적 치수 감사(브라우저 실측은 Supervisor 몫):
  - 팝업 cap `min(300px, 100vw-1.5rem)`. profile 1행 최악 ≈ 3×37.6+삭제60+진입72+gap18+패딩18 ≈ 281px < 300px.
    667/740/844/PC 모두 cap 300px → 가로 overflow 없음.
  - 거리 1행 ≈ 캡션55+−26+숫자42+km20+＋26+gap14 ≈ 183px. 헤더(복귀+제목)·프리셋 1행 기존 유지.
  - 높이: 위치 ≈ 150px, 거리 ≈ 180px. dock cap(33, `100dvh-18px`)·팝업 cap(70vh) 안, 초과분은 기존 내부 스크롤 정책.

## Supervisor 독립 검수 요청 (본 Developer 미실행)

1. `pick-34-qa.cjs` 실행(위치/거리 전환·값보존·44px·overflow0·searching/failed/found·재개·Start·blocked 전 구간).
2. 667/740x300/844x390/PC에서 rect·컨트롤 잘림·스크롤 실측, drag/close 정상 여부.
3. 기지 영향(별도 지시 필요, 허용파일 밖): e2e `ride-summary-compact.spec.ts`의
   `getByRole("checkbox", {name: "거리와 방향으로 Route 찾기"})` + `uncheck()`는 hidden checkbox에서
   동작하지 않음 — 지시34가 hidden을 확정했으므로 해당 e2e 갱신은 Chief/Supervisor 판단에 위임.
4. 실기기·원격탐색 미실시(구분).
