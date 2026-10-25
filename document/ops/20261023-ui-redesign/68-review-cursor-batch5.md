# 독립감리68 — 묶음5 diff (지시65)

| 항목 | 값 |
|---|---|
| 갱신 | 2026-10-25 KST |
| 감리 | **Cursor CLI** (독립, diff·문서만) |
| 범위 | `git diff HEAD` 기준 **묶음5 Codex 제품** + Cursor fixture·시험(참고만, 미수정) |
| 금지 준수 | 제품·시험·HANDOFF·PROGRESS 수정 없음, 서버·Playwright·커밋·배포 없음 |
| 시안 | `mockups/05-RoutePick.png` · [지시65](65-task-batch5.md) |

## 총판정

**DIFF_OK (동작·고정 문자열) / SCREEN_PENDING (시안05·픽셀·드래그) / GATE_UNRUN / E2E_MIXED**

- Codex 제품 diff는 **`RoutePickPopup.css` 신규 + `mapPopupElements.ts` import·`title` 6곳 한국어**뿐이다. DOM·콜백·탭/핀 문구·주행 시작 결선은 TS diff에 없음.
- 고정13·고정1·순차 강조·토큰/거리 UI·드래그 차단 코드는 **diff로 제거되지 않음** (일부는 `MapView.css`에만 존재, 아래 CSS).
- 시안05 픽셀·300px 판·닫기 형태·폰 세로 공간은 **캡처 없이 PASS 불가** → Codex 화면 검증 대기.
- 기존 e2e 2파일: `route-media-controls.spec.ts`는 **출력 경로만** 변경. `distance-direction-attention.spec.ts`는 **기대값·신규 시나리오 변경** → 묶음5 “evidence 경로만” 원칙과 불일치(근거위험).

---

## diff 소유 구분

| 구분 | 경로 (미커밋) |
|---|---|
| Codex 제품 (지시65) | `apps/web/src/components/map/RoutePickPopup.css` (untracked), `mapPopupElements.ts` (import + profile/clear `title`) |
| Cursor (지시65, 본 감리 범위 밖 참고) | `scripts/ui-redesign-batch5/*`, `e2e/ui-redesign-batch5.spec.ts`, [결과66](66-result-cursor-batch5.md) |
| 묶음1~4·동시 dirty (손대지 않음) | `NextRideCard.*`, `RideSummarySheet.*`, `RouteDock.tsx`, `ui-800x360` preview, batch1~4 e2e 등 — 본 감리에서 되돌리지 않음 |

`MapView.css`는 **HEAD 대비 diff 없음**. 팝업 스타일은 기존 규칙 + `RoutePickPopup.css` **추가 레이어**로 겹친다.

---

## Codex 제품 diff 요약

| 파일 | 변경 |
|---|---|
| `mapPopupElements.ts` | L13 `import "./RoutePickPopup.css"` · L283–284, L319, L369–372 profile/clear **`title` 영어→한국어** (`aria-label`은 원래 한국어) |
| `RoutePickPopup.css` | 시안05: 300px 흰 판, 18px radius, 원형 32px 닫기, 탭·거리 파란 숫자(26px/#2457d6), ± 원형 32px, 칩 5열, 수단·재생 28px 원 |

**미포함(지시65 준수 쪽):** 시안의 자동주행/회귀 문구·정책을 TS에 추가한 흔적 없음. `onStartRide`/`getCanStartRide`·`setInlinePhase`·탭 전환·`pointerdown` `stopPropagation`(탭 L822, 경로삭제 L337) 유지.

---

## 고정13 · Start·End 탭 · WP

| 검사 | 판정 | 근거 |
|---|---|---|
| 핀 행 문자열 | **DIFF_OK** | `textContent` 그대로 `Start` / `+WP` / `End` (L180, L206, L224) |
| 탭 표시 | **DIFF_OK** | `Start·End` / `거리·방향`, `aria-label` `출발·도착` (L830–831) |
| 영어 통일 | **DIFF_OK** | 출발·도착 한글 버튼 라벨 없음; `title`만 한국어 툴팁으로 정렬 |

**SCREEN_PENDING:** 주소 카드 S·E 기호(고정13의 카드 쪽)는 본 제품 diff 범위 밖.

---

## 고정1 · 팝업 내 녹색 재생 28px

| 검사 | 판정 | 근거 |
|---|---|---|
| 클래스·aria | **DIFF_OK** | `ride-media-button ride-media-button--play map-view__pick-start-ride`, `aria-label` `주행 시작` (L396–399) |
| 크기 | **DIFF_OK** | `RoutePickPopup.css` L94 `28×28`; `MapView.css` L248–252 동일(중복·일치) |
| 자동 주행 | **DIFF_OK** | 팝업이 `onStartRide`만 호출; 시안 자동시작 문구/정책 diff 없음 |

색·아이콘 픽셀은 `RideMediaButton.css` + **SCREEN_PENDING**.

---

## 이동수단 · 토큰 · 거리 · 순차 강조 · 닫기·드래그

| 검사 | 판정 | 근거 |
|---|---|---|
| 이동수단 3종·선택 로직 | **DIFF_OK** | `profileSpecs`·`onRouteProfile`/`onSetRouteProfileOnly`·`syncProfileUi` TS diff 없음 |
| 토큰 행 | **DIFF_OK** | `mountRouteTokenPopupFeedback`·`setRouteStartPinned`·계약 문구 주석(L385–388) 유지 |
| 거리 ±/칩/DOM 순서 | **DIFF_OK** | `distanceRow` 구성·`DISTANCE_AUTO_ROUTE_CHIP_KM`·hidden slider TS 동일; 시각만 CSS grid/order |
| 순차 강조 | **DIFF_OK** | `map-view__pick--awaiting-profile`·`map-view-route-profile-attention-*`는 **`MapView.css` L912–957**; `RoutePickPopup`이 animation 제거 안 함. `prefers-reduced-motion` 시 animation none 유지 |
| 탭·닫기·드래그 | **DIFF_OK (코드)** / **SCREEN_PENDING (UX)** | 탭 `pointerdown` stopPropagation L822; dock/popup 닫기는 MapView 쪽. `pick-drag-handle`·`touch-action: none`은 `MapView.css` L206–209. **pin-row `position: static`** (`RoutePickPopup.css` L52) → 기존 sticky 핀 행(L261–272 `MapView.css`) **무효** — 스크롤 시 핀 고정 변화 가능, 화면 미검 |

---

## CSS 범위 · 우선순위 · 모바일 높이

| 항목 | 내용 |
|---|---|
| 범위 | 선택자 대부분 `.map-view .map-view__pick…` / dock·popup close — **지도 팝업만**. RouteDock·HUD·주소 카드 미접촉 |
| 로드 순서 | `mapPopupElements.ts`가 `RoutePickPopup.css` import → 번들에서 `MapView.css` 뒤에 올 가능성 높음 |
| 우선순위 | `.map-view .map-view__pick`(0,2,1)이 `.map-view__pick`(0,1,0)보다 강함 → **폭 220→300px**, 탭·거리·주소 타이포 등 **신규 파일이 이김** |
| dock max-height | `MapView.css` L69–73: `.map-view__pick-dock-panel .map-view__pick` → `min(100dvh-18px, 26rem)` + `overflow-y: auto`. `RoutePickPopup.css` L9: `.map-view .map-view__pick` → `max-height: calc(100dvh - 24px)` (**특이성 더 높음**, 26rem 상한은 이 속성에서 사라짐) |
| popup shell | `MapView.css` L147–149 `max-height: min(70vh, 26rem)` vs `RoutePickPopup.css` L11–12 `100dvh-24px` — **둘 다 적용 가능**(content vs inner `.map-view__pick`) |
| 잔존 MapView | blur·border가 안 잡힌 dock 속성, `overflow-y: auto`, 거리 row `order`, awaiting-profile animation 등 **미오버라이드 규칙 유지** |

**근거위험:** ~275px 폰 가로에서 300px·다행 판 + `26rem` 상한 제거 → **세로 overflow·지도 가림**은 diff만으로 안전 단정 불가 (**SCREEN_PENDING**). `route-media-controls` geometry(패널 `bottom ≤ viewport`, 핀 `width≥44`)는 **잠금 시험 미실행**.

---

## 기존 e2e 2파일 (지시 확인)

| 파일 | diff | 판정 |
|---|---|---|
| `route-media-controls.spec.ts` | L63 `page.screenshot` 경로: `../../.out` → `process.env.BATCH5_EVIDENCE_DIR ?? '../../.out'` | **DIFF_OK** — 기대값·시나리오 동일 |
| `distance-direction-attention.spec.ts` | 신규 시나리오「출발·도착 확정 후…순차 강조」+ 거리 흐름에서 `awaiting-profile`·animation·`requestedProfile` 기대 **변경** | **근거위험** — 출력 폴더만 바꾼 diff가 **아님**. batch5 Cursor 소유 범위(결과66)에도 **미기재** |

---

## fixture · `ui-redesign-batch5.spec.ts` (가짜 PASS 여부)

| 항목 | 판정 | 근거 |
|---|---|---|
| `buildPickPopup` 실제 사용 | **DIFF_OK** | `fixture.ts` L164–217 실제 import·deps |
| 콜백 카운터 | **부분 DIFF_OK** | `data-route-profile-calls`·`select-point`·`close`·`start-ride`·`clear-route` — 클릭 후 증가 검사 (spec L116–120, L147–158, L172–175) |
| `onSetRouteProfileOnly` | **근거위험** | L191 빈 함수 — End 없이 수단만 고르는 경로는 **미검** |
| `searching` / `failed` | **근거위험** | L249–251 `setInlinePhase`만 호출 — **탐색 콜백·토큰 차감·bridge 진행 없음**. UI 문구 일치 시험용 |
| `token-empty` | **DIFF_OK** | `setSubscribedRouteBalance(0)` + `getRouteTokenInsufficient` + disabled/`route-profile-calls` 0 (spec L125–129) |
| `ready-start` | **근거위험** | `getCanStartRide: () => state === 'ready-start'` (L211) — **App·RouteDock 동기화 대체 아님**. 재생 클릭 카운터는 **fixture 결선** 검증 수준 |
| 드래그·키보드 | **미검** | batch5 spec에 없음 |
| 실행 | **GATE_UNRUN** | 결과66·본 감리 모두 Playwright 미실행 — 로그 PASS 인용 없음 |

---

## Chief 고정 1~14 (batch5 제품 diff만)

| # | 판정 |
|---|---|
| 1 | **부분** — 팝업 내 재생은 고정1 형태 유지; 우하단 HUD는 미접촉 |
| 2~12, 14 | **미접촉** |
| 13 | **DIFF_OK** — 팝업 Start/+WP/End·Start·End 탭 |
| 8 | **DIFF_OK** — `km` 단위 DOM 유지 |

---

## 게이트

| 항목 | 상태 |
|---|---|
| `ui-redesign-batch5` · 회귀 · instruction65 캡처 | **GATE_UNRUN** (Codex 전담) |
| tsc · eslint · quick · selector | **GATE_UNRUN** |
| 화면·시안05 before/after | **SCREEN_PENDING** |

---

## Codex 화면 검증 시 우선 확인

1. 800×360·667×300·844×390 — 팝업 `bottom`·닫기 32px·토큰 행과 ✕ 겹침 없음  
2. dock 스크롤 시 pin-row sticky 해제 체감  
3. `route-media-controls` 3뷰포트 geometry·`distance-direction-attention` **수정된** 기대와 실제 화면  
4. 시안05 대비 자동주행 문구 **없음** 확인(정책 유지)

본 감리는 **diff 근거만** — 최종 승인은 Codex 캡처·시험 로그 후.

## Supervisor 대조·보충 (Codex)

Cursor가 HEAD와 비교하여 지적한 distance-direction-attention.spec.ts 기대값 변경은 **이번 묶음5 변경이 아니다**. 지시50에서 이미 수정·검증해 보존 중인 dirty다. instruction65/initial-file-hashes.json의 시작 SHA256과 현재 파일이 정확히 일치한다. 이번 기존 시험 수정은 route-media-controls.spec.ts와 route-pick-popup-title.spec.ts **두 파일의 증거 경로 env 대체뿐**이며 기대값 변경0. Cursor가 두 번째 파일 대신 이전 dirty를 집어 E2E_MIXED로 본 부분은 이 시작 baseline 대조로 해소한다.

신규 fixture의 탐색/실패/ready 상태는 UI 표시·콜백 시험을 위한 메모리 입력이며 실제 탐색/저장 성공을 주장하지 않는다. 실제 거리확정→방향→수단 재탐색 및 준비동기화는 기존 distance-direction-attention·route-media-controls 실행으로 별도 확인. 키보드 탭·직접 숫자 입력·준비 전 비활성·닫힌DOM 소멸 단언은 Supervisor가 추가. 이 감리의 정적 한계와 원문은 보존한다.
