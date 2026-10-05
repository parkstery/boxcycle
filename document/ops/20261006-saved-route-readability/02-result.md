# 결과 — Edge 내 경로 글자 가독성

상태: DEVELOPMENT_DONE · 커밋/push/배포 없음 · 다른 작업 변경 보존.

## 원인

표면은 **「내 경로」 목록 모달(SavedRoutesPanel)** 이 핵심. 출처 칩(입문/퍼블릭/내 경로)은 동일 `.ride-panel__official-seg` + 명시 `--rp-fg` 라 셋이 같이 보인다.

입문/퍼블릭은 `OfficialCourseListModal.css` 가 `#141820` / `#e8eaef` 를 **명시**한다. 반면 `SavedRoutesPanel.css`·`RouteSortSelect.css` 는 `Canvas` / `CanvasText` / `color-mix(...Canvas...)` 를 썼다. 모달은 `createPortal(... document.body)` 이라 `.ride-panel { color-scheme: dark }` 밖에 있고, `.oc-modal` 에도 `color-scheme` 가 없었다. 이 경우 Chromium/Edge 는 `Canvas` 를 **밝은 시스템 표면**(≈ `#f5f5f5`)으로 푼다. 행 글자는 `color: inherit` 로 모달의 밝은 `#e8eaef` 를 물려 **밝은 글자 × 밝은 카드** → 대비 ~1.1. Guest/disabled 의미와 무관. Chrome 정상·Edge 불량은 OS/브라우저 선호·ClearType 차이로 체감이 갈릴 수 있으나, 레거시 프로브는 **양 채널 light/dark 모두** 동일 붕괴를 재현했다.

## 수정

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/ride/SavedRoutesPanel.css` | Canvas 제거. 다크 명시 팔레트(`#e8eaef`, `rgba(2,6,23,…)`, `color-scheme: dark`). 이름/버튼에 `-webkit-text-fill-color` 명시 |
| `apps/web/src/components/ride/RouteSortSelect.css` | 공용 정렬 select 도 동일 다크 명시(세 모달 공통) |
| `apps/web/src/components/ride/OfficialCourseListModal.css` | `.oc-modal` 에 `color-scheme: dark` + fill, 항목 이름 색 명시(회귀 방지) |

권한·disabled·선택 의미·버튼 enable 변경 없음. TS 변경 없음.

## 검증

| 명령 | exit |
|---|---|
| `node document/ops/20261006-saved-route-readability/.out/verify-contrast.mjs` | **0** |
| `node apps/web/scripts/ride-verify/verify-selectors.mjs` | **0** |
| eslint(CSS) | 설정상 CSS ignore(경고만, 코드 회귀 아님) |
| `node .../.out/live-smoke.mjs` (localhost:5010) | 게스트/인증 dialog 가 MENU 클릭 가로챔 → **실사용 Edge 세션 미검증**. 사용자 브라우저 미조작 |

### 대비 실측 (740×300 fixture, 반투명 배경은 모달 bg에 블렌딩)

| 채널·scheme | 내 경로 이름 | 입문 이름 | 출처 칩 | 레거시 Canvas 이름(수정 전 패턴) |
|---|---|---|---|---|
| msedge light/dark | **15.66** | **15.66** | 15.45 | **1.1** (붕괴) |
| chrome light/dark | **15.66** | **15.66** | 15.45 | **1.1** (붕괴) |

증거: `.out/contrast-report.json`, `.out/msedge-*-740x300.png`, `.out/chrome-*-740x300.png`.

## 한계

- 연결된 UI 도구에 Edge 실창이 없어 **headless channel=msedge/chrome + CSS fixture** 가 본검증. live `:5010` 은 인증 게이트로 MENU 미진입.
- 사용자 Edge 창의 실데이터·이미 연 세션은 건드리지 않음.
- 출처 칩은 당초부터 명시색이라 이번 CSS 변경 대상이 아님(동일성만 확인).
