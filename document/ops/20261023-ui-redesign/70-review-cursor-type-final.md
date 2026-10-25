# 독립감리70 — 묶음5 최종마감·타입·clamp (읽기)

| 항목 | 값 |
|---|---|
| 갱신 | 2026-10-25 KST |
| 감리 | **Cursor CLI** (독립, diff·문서·로그 읽기만) |
| 대조 | [지시65](65-task-batch5.md) · [결과67](67-result-batch5.md) · [감리69](69-review-cursor-popup-bounds.md) · [감리68](68-review-cursor-batch5.md) |
| 범위 | `mountPickPopupViewportClamp.ts`(신규) · `MapView.tsx` import/호출 · instruction65 로그·`live-bounds/measurements-phone-landscape.json` |
| 금지 준수 | **코드·제품·HANDOFF·PROGRESS·기존 문서 수정 없음** (본 파일만) · 서버·Playwright·캡처·tsc 재실행 없음 |

## 총판정

**DIFF_OK (clamp·결선·고정/도메인)** / **LOG_OK (지정 로그 4건)** / **TSC_LOG_UNVERIFIED** (`type-final.log` 빈 파일 — 결과67의 tsc PASS는 본 감리가 로그로 재확인하지 못함)

---

## `mountPickPopupViewportClamp.ts` (69 이후 정적)

| 검사 | 판정 | 근거 |
|---|---|---|
| RO 전 `getElement` | **DIFF_OK** | L29–30 `const element = popup.getElement(); if (!element) return;` — 69의 null·`observe` 예외 가능성에 대한 **조기 종료** 반영. |
| observe 대상 | **DIFF_OK** | `container` + 위에서 확보한 **동일 `element`** 만 관찰(L31–33). |
| close 정리 | **DIFF_OK** | `popup.once("close")` → `observer.disconnect()` · `cancelAnimationFrame(frame)`(L34–37). MapView `pickPopupCloseHandler`(L1544–1555)와 **별도** — 69와 동일 판단. |
| 타입 | **DIFF_OK (정적)** | `import type { Popup } from "mapbox-gl"` · `anchor` 리터럴 유니온 · `offset: [number, number]` — 도메인 API·콜백 시그니처 diff 없음. `clamp` 내 `element?.isConnected`는 재측정 시 null 안전. |

**본 감리 한계:** pan/zoom만으로 재clamp 없음(69 **RUN_UNVERIFIED** 유지). 실측은 로그·JSON만 인용.

---

## `MapView.tsx`

| 검사 | 판정 |
|---|---|
| import L178 | **DIFF_OK** |
| 호출 L1543 | **DIFF_OK** — `addTo(map)` 직후, floating 분기만; dock 경로 미호출(69 동일) |
| 고정13·1·도메인 | **DIFF_OK** — 본 diff는 import+한 줄; `onStartRide`/`getCanStartRide`/탭·핀 TS 변경 없음(68·69·67 정합) |

---

## TypeScript 오류 해결 근거 (실행 없음)

| 근거 | 내용 |
|---|---|
| 정적 | 신규 모듈은 mapbox `Popup` 타입과 DOM `HTMLElement`만 사용; `getElement()` nullable에 대해 RO 생성 **전** return으로 `observe` 인자를 `HTMLElement`로 한정. |
| 런타임 증거(읽기) | `evidence/instruction65/type-fix-runtime.log` — `ui-redesign-batch5.spec.ts` L206 **1 passed (28.4s)** (실지도 첫 팝업 경계 단언). **tsc 출력 아님.** |
| tsc | `type-final.log` **0바이트** — 본 감리는 **tsc PASS를 로그로 확인하지 못함**. 결과67 문장만 이력으로 남김. |

---

## 로그·실측 JSON (읽기만)

| 파일 | 기록된 결과 | 본 감리 |
|---|---|---|
| `popup-live-bounds-final.log` | `route-pick-popup-title.spec.ts` **2 passed**, script exit **0** | **LOG_OK** |
| `popup-bounds-final.log` | **36 passed** (distance-direction·route-media·ui-redesign-batch5 포함) | **LOG_OK** |
| `quick-final.log` | 합계 통과 **1360** · 실패 **0** | **LOG_OK** |
| `live-bounds/measurements-phone-landscape.json` | viewport 690×275 · `beforeBounds.y` **8** · `popup.y` **73** · `close` y **83** (top≈−72 이전 이슈 대비 **양수 insets**) | **측정치 인용** — 단언 PASS 문구는 위 Playwright 로그에 의존, JSON 단독 PASS 아님 |

에뮬레이터 종료 시 functions 경고( popup-live-bounds-final.log L82–93 )는 시험 **2 passed / exit 0** 이후 shutdown 노이즈로 구분.

---

## 요약 (6문장)

지시65 범위·고정1~14·도메인 정책에 대해 68·69와 같이 batch5 제품 diff는 CSS·clamp·MapView 한 줄 결선이며 Start/+WP/End·녹색 재생·기존 탐색/토큰 결선은 TS에서 바뀌지 않았다. `mountPickPopupViewportClamp`는 ResizeObserver 전 `getElement()` 없으면 return하고, container와 확보한 popup 루트만 observe하며 close 시 observer·rAF를 정리한다. MapView는 floating `addTo` 직후만 clamp를 호출하고 기존 `pickPopupCloseHandler`와 충돌하지 않는다. 타입은 mapbox `Popup`·anchor 유니온·nullable DOM 가드로 정적 타당; `type-fix-runtime.log`는 실지도 e2e 1건 PASS만 증명하고 `type-final.log`는 비어 있어 tsc는 본 감리 미검증이다. `popup-live-bounds-final.log`·`popup-bounds-final.log`·`quick-final.log`는 각각 기록상 PASS/exit 0이며, 690×275 `measurements-phone-landscape.json`은 팝업 top이 8px inset 안쪽으로 잡힌 실측을 보여준다. pan/zoom 경계 이탈·전체 101건 회귀·픽셀 시안05는 로그에 없거나 결과67 IN_PROGRESS 이력으로 남기며 본 읽기감리에서 보강 추정하지 않는다.


Supervisor 보충(Codex): tsc 실제 실행 session12761 완료 도구 결과의 exit_code=0을 직접 확인했다. 성공 시 빈 stdout과 별개로 type-final-exit.json에 명령·작업폴더·실제 실행세션·exit0 근거를 기록했다. Cursor의 빈 로그만으로 성공을 추정하지 않은 판정은 적절하며, 최종 타입 PASS는 Supervisor의 실제 종료코드에 근거한다.
