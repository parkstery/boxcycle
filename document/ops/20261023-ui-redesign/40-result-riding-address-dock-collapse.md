# 결과 40 — 주행 시작 때 주소창 접기(› 펼치기)

2026-10-24 · Cursor CLI · 지시 [39-task-riding-address-dock-collapse.md](./39-task-riding-address-dock-collapse.md)

## 구현 요약

- 주행·일시정지 진입 시 RouteDock 을 **접힌 상태**로 두고, `경로 패널 펼치기`(›)로 다시 본다. 주행 종료 후 대기 화면은 **펼침** 유지.
- `riding` ↔ `paused` 전환은 사용자가 펼쳐 둔 선택을 바꾸지 않는다.
- 정책: `routeDockUiPolicy` 에 `collapseOnRideStart: true`, `routeDockDefaultExpanded` / `isRouteDockActiveRide` 추가. 주석을 2026-10-24 Chief 결정에 맞게 수정.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.tsx` | 초기·stage 전환에 따른 접기/펼침 |
| `apps/web/src/lib/route/routeDockUiPolicy.ts` | `collapseOnRideStart`, 헬퍼, 주석 |
| `apps/web/scripts/ride-hierarchy/route-dock-riding-contract.test.ts` | 정책 키·접힘 계약 |
| `apps/web/e2e/ui-800x360.spec.ts` | Chief 고정 목록 11 단언·캡처 |
| `apps/web/e2e/address-minimap-width.spec.ts` | riding 진입 후 펼치기 클릭 |
| `apps/web/e2e/route-dock-riding-content.spec.ts` | 실앱 계약(에뮬) 단언·주석 |
| `document/ops/HANDOFF.md` | 인계 한 줄 |

고정 목록 1~10·묶음3 미커밋 파일·`tmp/deploy35`·금지 JSON 등은 손대지 않음.

## 시험 단언 before → after (이유)

| 위치 | before | after | 이유 |
|---|---|---|---|
| `ui-800x360` 목록 11 | riding/paused 에서 출발·도착 **즉시 보임** | **접힘**(`경로 패널 펼치기`, `.route-dock__stops` hidden) → 펼친 뒤 출발·도착·미니맵 폭 정렬 | Chief 11: 숨기지 말고 접는다 |
| `address-minimap-width` | riding URL 직후 폭 측정 | **펼치기** 후 측정 | 접힌 기본 상태 |
| `route-dock-riding-content` | 주행 후 `경로 패널 접기` 보임(펼침 유지) | 주행 후 `경로 패널 펼치기`·stops hidden → 펼친 뒤 경유지·라벨 | 동일 Chief 결정 |
| `route-dock-riding-contract` | `autoCollapse` 없음만 검사 | `collapseOnRideStart` 키·true 단언 | 정책 SoT |

참고: 접힌 상태에서도 DOM 에 「출발」 텍스트가 남아 Playwright `getByText` count 는 1이 될 수 있어, 가시성은 `.route-dock__stops` **hidden** 으로 검사한다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| # | 명령 | 결과 |
|---|---|---|
| 1 | `npx tsc -b --noEmit` | PASS |
| 2 | `npx eslint` (변경 6파일) | PASS (오류 0) |
| 3 | `npm run test:quick` | PASS **1355/1355** (계약 +1) |
| 4 | `node scripts/ride-verify/verify-selectors.mjs` | PASS 19/19 |
| 5 | `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort` 후 `$env:RTW_DEV_PORT='5020'; npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` | **1차** 39/40 (`ui-800x360` 목록 11 — `getByText('출발')` count). **2차** RTW_DEV_PORT 없이 38/40 (inline-history 캡처 파일 오류·baseURL 5000 거부). **3차** `RTW_DEV_PORT=5020` 동일 명령 **40/40 PASS**. 로그: `document/ops/20261023-ui-redesign/evidence/riding-address-dock-collapse/ui.log` 마지막 줄 `40 passed` |
| 6 | 루트 `node scripts/check-code-tidy.mjs` 등 4건 | PASS (`git diff --check` 경고만: 기존 dirty JSON/README CRLF) |
| 7 | 5020 종료 | `taskkill /PID 23196 /F` (vite LISTEN). `netstat -ano \| findstr ":5020.*LISTENING"` **출력 없음** (TIME_WAIT 만 남을 수 있음) |

## 캡처 (지시 절대 경로)

`C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\riding-address-dock-collapse\`

- `riding-collapsed-667x300.png`
- `riding-collapsed-800x360.png`
- `riding-expanded-800x360.png`
- `paused-collapsed-800x360.png`
- `ready-800x360.png`
- `ui.log`

## 못 한 것

- `npm run test:e2e:route-dock` (Firebase 에뮬레이터·`RIDE_VERIFY_LIVE=1`) — 지시서상 Supervisor 실행. 단언 파일만 갱신·로컬 미실행.
- OpenCode `nemotron-3-ultra-free` 독립 감리 — 미실행.

## Chief 재현

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

브라우저: `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready` → 주행 시작 → 좌하단 › 펼치기 확인. `?state=riding` 으로도 접힌 상태로 진입 확인.

---

## 재작업 41

2026-10-24 · Cursor CLI · 지시 [41-task-riding-address-dock-collapse-rework.md](./41-task-riding-address-dock-collapse-rework.md)

### 원인·수정

- 접힘에서 `.route-dock__caret` 이 `position: absolute` 로 카드 밖(250px 띠 안 오른쪽)으로 밀려 Chief 실화면에 빈 흰 띠만 보였다.
- `.map-bottom-left-stack > .route-dock-anchor { width: min(250px…) }` 와 `.route-dock-anchor:not(--open) { width: auto }` 가 동일 specificity 로 **CSS 로드 순서**에 따라 실 App 에서 250px 이 이겼다.

**CSS (`RouteDock.css`)**

- 접힘: caret `position: static`, **32×32px**, `#fff` 배경·`#121417` ›(16px), 카드 패딩 0·flex 로 카드가 버튼 크기만 차지.
- 펼침: caret 기존 오른쪽 위 ‹ 유지.
- 접힘 시 카드 안 footer 는 숨기고, 대기 화면 센서 칩은 anchor 직속 footer 로 유지.

**CSS (`MapBottomLeftStack.css`)**

- `.map-bottom-left-stack > .route-dock-anchor:not(.route-dock-anchor--open)` 에 `width: auto; max-width: none` — 스택 250px 규칙보다 specificity 로 이김.

**TSX (`RouteDock.tsx`)**

- 센서 footer: 펼침은 카드 안, 접힘은 카드 밖(anchor 자식)으로 렌더 — 접힌 32px 칩과 케이던스 조작 공존.

### 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/route-dock/RouteDock.css` | 접힘 칩·caret·footer 분리 |
| `apps/web/src/features/map-overlays/MapBottomLeftStack.css` | 접힘 anchor 폭 우선 |
| `apps/web/src/components/route-dock/RouteDock.tsx` | 접힘 시 센서 footer 위치 |
| `apps/web/e2e/ui-800x360.spec.ts` | `assertCollapsedRouteDockChip`·CSS 늦게 주입·캡처·ready-collapsed |
| `apps/web/e2e/address-minimap-width.spec.ts` | 접힘 폭 28~44px |

### 시험 (로드 순서)

`assertCollapsedRouteDockChip`: 카드·caret 28~44px, caret 이 카드·뷰포트 안, `elementFromPoint`·흰 배경·어두운 ›, 「경로 패널 펼치기」. riding/paused/667×300·대기 ‹ 접기 후 동일. 시험 중 `MapBottomLeftStack` 250px 규칙을 `<style>` 로 문서 끝에 한 번 더 넣은 뒤에도 기하 동일.

### 검증 (`C:\20.HDev\boxcycle\apps\web`)

| # | 명령 | 결과 |
|---|---|---|
| 1 | `npx tsc -b --noEmit` | PASS |
| 2 | `npx eslint` (변경 TS/TSX) | PASS |
| 3 | `RTW_DEV_PORT=5020` dev harness + Playwright 40건 (지시 명령) | **40/40 PASS**. 로그: `evidence/riding-address-dock-collapse/ui-rework.log` 마지막 `40 passed` |
| 4 | `C:\20.HDev\boxcycle` `node scripts/check-code-tidy.mjs` | PASS |
| 5 | `git diff --check` | 기존 JSON/README CRLF 경고만 |
| 6 | 5020 종료 | `taskkill` PID 23636·27860. `netstat -ano \| findstr ":5020.*LISTENING"` **출력 없음** |

### 캡처 (`C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\riding-address-dock-collapse\`)

- `riding-collapsed-800x360.png`, `riding-collapsed-667x300.png`, `paused-collapsed-800x360.png`
- `ready-collapsed-800x360.png` (대기에서 ‹ 접음)
- `riding-expanded-800x360.png`
- `riding-collapsed-zoom.png` (120×120 clip)
- `ui-rework.log`

### Chief 재현 (실 App, 포트 5000)

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost
```

`http://127.0.0.1:5000/` — 주행 시작 후 좌하단 미니맵 위 **32px 흰 ›** 버튼(250px 빈 띠 아님). `?state=riding` 프리뷰(5020 harness)도 동일 기하 단언으로 확인 가능.

## 실앱 접힘 기하 단언

`e2e/route-dock-riding-content.spec.ts` — `RIDE_VERIFY_LIVE=1` 에뮬레이터 주행 시 「경로 패널 펼치기」 visible 직후 재지시 41 §2 기하(카드 28~44px·caret in card/viewport·elementFromPoint·카드 배경 흰색) 및 `apps/web/.out/route-dock/riding-collapsed.png` 캡처.

## 감리 (Supervisor Claude Code, 2026-10-24 15:0x KST) — **PASS / LOCAL_VERIFIED**

- 지시 39 1차: 자동 접힘 동작만 넣고 접힌 모습 CSS 0줄 → **FAIL**(프리뷰 8×5px 흰 점, Chief 실화면 250px 흰 띠·› 없음). 원인: caret `position:absolute` 가 빈 카드 밖으로 밀림 + 스택 250px 규칙과 접힘 `width:auto` 규칙이 같은 우선순위라 로드 순서로 승부. → [재지시 41](41-task-riding-address-dock-collapse-rework.md).
- 재작업 41 캡처 직접 확인(`evidence/riding-address-dock-collapse/`): riding/paused 접힘 = 미니맵 위 왼쪽 32px 흰 › 버튼(`riding-collapsed-zoom.png`), 펼침 = 미니맵과 같은 폭 주소 카드, 대기 펼침 250px 그대로, 대기 접힘 = › 버튼 + 센서 칩 아래 유지. 스택 접힘 규칙 `.map-bottom-left-stack > .route-dock-anchor:not(.route-dock-anchor--open)` 로 우선순위 확보.
- **실 App(에뮬레이터)**: `ride-entry` 7 + `route-dock-riding-content` 1 = **8/8 PASS**(접힘 기하 단언 28~44px·뷰포트 안·elementFromPoint·흰 바탕 포함). 캡처 `live-riding-collapsed-1280x900.png`(› 버튼), `live-riding-expanded-1280x900.png`. 로그 `live.log`.
- Supervisor 재실행: `tsc -b --noEmit` PASS, `test:quick` **1360/0**, selector 19, 변경 파일 eslint 오류 0(경고 9 = MapView 기존), tidy·dep-direction·document-system·`git diff --check` PASS.
- 독립 감리: Nemotron 3 Ultra 가 문서 읽기 중 무료 한도 소진으로 중단(44 미작성). GLM·DeepSeek 도 한도 소진. diff 감리는 Supervisor 직접.
- LOW(후속 후보): 접힘 전환이 `useEffect` 안 `setExpanded` 라 주행 시작 순간 펼친 카드가 한 프레임 보였다 접힐 수 있다. 렌더 중 이전 stage 비교로 바꾸면 없어진다. 기능·잠금 시험에는 영향 없음.
