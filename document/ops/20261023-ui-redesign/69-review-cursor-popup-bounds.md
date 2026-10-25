# 독립감리69 — 팝업 뷰포트 보정·CSS scope (묶음5 추가)

| 항목 | 값 |
|---|---|
| 갱신 | 2026-10-25 KST |
| 감리 | **Cursor CLI** (독립, diff·문서만) |
| 대조 | [지시65](65-task-batch5.md) · [감리68](68-review-cursor-batch5.md) Supervisor 대조(§ distance-direction baseline · route-media/route-pick-popup-title 경로만) |
| 범위 | `git diff HEAD` — `RoutePickPopup.css` · `mountPickPopupViewportClamp.ts` · `MapView.tsx` import/호출 1곳 · (참고) e2e `route-media-controls` · `route-pick-popup-title` diff |
| 금지 준수 | **제품·시험·HANDOFF·PROGRESS 수정 없음**(본 파일만 신규) · 서버·Playwright·캡처·커밋 없음 |

## 총판정

**DIFF_OK (보정·scope·콜백·고정 문자열)** / **RUN_UNVERIFIED** (690×275에서 top −72 등 실측·시험 로그는 본 감리 미실행)

- Codex가 68 이후 추가한 diff는 **CSS ancestor 보완** + **floating 팝업 clamp 모듈** + **MapView 한 줄 결선**이 핵심이다. `mapPopupElements.ts`의 지시65 변경( import · `title` 한국어)은 68과 동일·추가 TS 로직 없음.
- **실제 코드 결함으로 단정할 diff 지적 없음.** 아래는 정적 한계·시험 매핑만 기록한다.

---

## 배경 (Supervisor·증거 맥락, 미실행)

- **690×275** 첫 **floating** 지점 팝업에서 내용/래퍼 **top ≈ −72** 실측 → `mountPickPopupViewportClamp` 추가( Codex 작업 중 트리 ).
- 보정은 `map.getContainer()` rect 대비 **8px 안쪽**에 맞추고, MapView `anchor` + **`offset: 18`** 과 동일한 anchor별 기준 벡터(`top [0,18]` … `right [-18,0]`)에서 **누적 `setOffset`**.
- 68 Supervisor: `distance-direction-attention.spec.ts` 기대값 변경은 **지시50 dirty·instruction65 시작 해시 일치** → **본 감리에서 묶음5 회귀로 보지 않음.**

---

## `RoutePickPopup.css` — `:is(.map-view, .map-view-shell)` DOM scope

| 검사 | 판정 | 근거 |
|---|---|---|
| 실제 DOM | **DIFF_OK** | `MapView.tsx` L3350–3360: `.map-view-shell` > `.map-view`(map container) + `.map-view__pick-dock-layer`(형제). dock 패널은 **shell 직계 자식 레이어**에만 붙음(`mountDockedRoutePanel` L1363). floating popup은 Mapbox가 **`.map-view` container** 안에 붙음. |
| 68 대비 | **개선** | 68은 `.map-view .map-view__pick…`만 언급 — dock은 `.map-view` 조상 **없음**. `:is(.map-view, .map-view-shell)`는 dock·floating **둘 다** 스타일 적용 가능. |
| 형제 오해 | **해당 없음** | `.map-view`와 `.map-view-shell`은 형제가 아니라 **포함**; 선택자는 “두 클래스 중 하나를 조상으로 가진 하위”이며, floating은 shell·map-view 경로 모두 매칭되나 **의도에 부합**. |

---

## `mountPickPopupViewportClamp.ts` — bounds · 18px · RO/RAF/close

| 검사 | 판정 | 근거 |
|---|---|---|
| bounds 기준 | **DIFF_OK** | `container` = `map.getContainer()` — `MapView` L1543와 동일. 지도 캔버스 영역(`.map-view` 내부 Mapbox root)에 맞춤. shell 위 hint/dock 레이어는 clamp 밖(지도 클릭 영역과 일치). |
| 18px 기준 | **DIFF_OK (정적)** | anchor별 `base`가 MapView `offset: 18` + `pickPickPopupAnchor` 방향과 대응; 초과분만 `offset`에 누적. **실측 −72 해소 여부는 RUN_UNVERIFIED.** |
| clamp 로직 | **DIFF_OK** | `getBoundingClientRect()`로 좌·우·상·하 한 축씩 보정; `\|dx\|,\|dy\| < 0.5` 스킵. 코너는 RO/RAF 재진입으로 수렴 가능. |
| ResizeObserver | **DIFF_OK** | `container` + `popup.getElement()` 관찰 → `schedule()` |
| RAF 공병 | **DIFF_OK** | `frame` 플래그로 rAF 중복 방지 |
| close 정리 | **DIFF_OK** | `popup.once("close")` → `observer.disconnect()` · `cancelAnimationFrame(frame)`. MapView `pickPopupCloseHandler`(L1555)와 **별도** `once` — 이중 등록이나 누수 패턴 없음(정적). |
| 호출 시점 | **DIFF_OK** | `addTo(map)` 직후 L1543; **dock 경로**(`mountDockedRoutePanel`)에는 **미호출** — floating 전용. |
| 정적 한계 | **RUN_UNVERIFIED** | 지도 **pan/zoom**만으로 크기 unchanged 시 재clamp 없음(`closeOnMove: false` 유지). pan 중 경계 이탈은 본 diff 범위 밖. |
| `getElement()` null | **미관측** | `addTo` 직후 호출 — 정상 경로에서 null이면 L31 `observe` 예외 가능; diff만으로 발생 단정 안 함. |

---

## `MapView.tsx` — import/호출만

| 검사 | 판정 |
|---|---|
| import L178 | **DIFF_OK** — 모듈만 추가 |
| 호출 L1543 | **DIFF_OK** — `openPickSurface` floating 분기만; `onStartRide`/`getCanStartRide`/`setInlinePhase`/탭·핀 DOM 생성 diff **없음** |
| 도메인 콜백 | **DIFF_OK** — batch5 제품 TS에서 콜백 시그니처·결선 변경 없음 |

---

## 고정 1~14 · 지시65 금지 (본 diff)

| # | 판정 |
|---|---|
| 1·13 | **DIFF_OK** — 팝업 재생·Start/+WP/End·탭 문자열 TS diff 없음(68 동일) |
| 2~12·14 | **미접촉** |
| 자동시작/회귀 정책 | **DIFF_OK** — TS에 신규 문구·정책 없음 |
| `title` 한국어 | **DIFF_OK** — `aria-label`·버튼 `textContent` 계약 문자열 유지 |

---

## 기존 e2e diff (실행 없음 · 기대값만 대조)

| 파일 | 변경 요지 | 판정 |
|---|---|---|
| `route-media-controls.spec.ts` | `hold()` — 팝업 보이면 닫기 → `elementFromPoint` **mapboxgl-canvas** 확인 후 long-press; geometry **`panel.width === 300`**; evidence env | **DIFF_OK** — 넓어진 판·지도 클릭 계약과 정합. **실행·PASS 미주장.** |
| `route-pick-popup-title.spec.ts` | 에뮬레이터 only(`LOCAL_EMULATOR`) · `generateCostBase=1` · `routeTokenBalance=8` seed · stubMapbox · `beforeBounds` 뷰포트 내 단언(핀 전) · 기존 제목/✕ 겹침 기대 유지 | **DIFF_OK** — 위치 안내·토큰 제목 계약 보강. **clamp는 popup 루트 rect, 시험은 `.map-view__pick` rect** → 래퍼만 삐져나오는 케이스는 시험이 덜 볼 수 있음(**시험 한계**, 제품 diff 지적 아님). |
| `distance-direction-attention.spec.ts` | (본 감리 **diff 미열거** — 68 Supervisor baseline 유지 가정) | **판정 보류·회귀 아님** |

---

## 게이트

| 항목 | 상태 |
|---|---|
| 690×275 floating top·clamp 전/후 | **RUN_UNVERIFIED** |
| `route-media` · `route-pick-popup-title` · `distance-direction` | **RUN_UNVERIFIED** |
| instruction65 캡처·batch5 spec | **RUN_UNVERIFIED** (Codex 전담) |

---

## 요약

| 구분 | 결과 |
|---|---|
| **diff 실제 문제** | **없음** (정적) |
| **68 대비 개선** | dock CSS scope(`map-view-shell`) · floating viewport clamp |
| **본 감리가 하지 않은 것** | Playwright·서버·픽셀 실측·화면 PASS |

Codex 화면 검증 시: 690×275 첫 클릭 floating 팝업 `getBoundingClientRect().top ≥ 8`(container 기준) 재측정, `route-pick-popup-title` phone-landscape `beforeBounds` 단언, `route-media` 닫기→canvas→300px geometry 순 확인.
