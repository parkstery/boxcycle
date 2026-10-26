# 결과 85 — 경로 선택 통합(지시84) · 계기판 거리 한 줄 · 계정 이름 복구

2026-10-26 · Supervisor Claude Code(지시84는 Codex 구현분 인수) · 구현·감리·캡처 Claude Code 직접

## 1. 지시84 — MENU 「경로 선택」 한 줄

- Codex 가 10:10 까지 구현(`RideRoutePanel` 세 행 → `경로 선택` 한 행·기본 `saved`, `RouteListModalShell` 출처 순서 내 경로→퍼블릭→입문, 시험 6·스크립트 2)하고 결과·검증 없이 멈춘 상태를 Chief 지시(「B로 진행」)로 인수했다. Codex 제품 diff 는 그대로 두었다.
- **인수 후 보완**: MENU 에서 `입문` 버튼을 바로 누르던 e2e 30개 파일(공용 `rideEntryHelpers.ts`·`ride-entry`·`route-dock-riding-content` 포함)과 `scripts/perf/run-real-gpu.mjs` 가 깨질 상태였다 → 「경로 선택 → 입문」 두 단계로 기계적 교체(32곳), 메뉴 열림 신호를 `입문`으로 보던 2개 파일은 `경로 선택`으로. `ui-redesign-batch1-live` 의 메뉴 행 수 6→4. 퍼블릭 행 전용 CSS `.menu-route-nav__aside--wrap` 삭제. 추적되지 않는 `scripts/rider-preserve/.out/**` 사본은 손대지 않음.

## 2. 계기판 거리 「누적 / 전체 km」 아랫줄 떨어짐

- Chief 10-26 캡처: `13.15 /` 아래 줄에 `17.86`.
- **원인**: 폰 가로(`max-height: 560px`) 블록에는 `white-space: nowrap` 이 있으나 높이 560px 초과 화면(PC·태블릿) 기본 규칙에는 없었다. 기본 칸 폭 6.45rem(루트 16px 에서 103px)보다 `13.15 / 17.86 km`(111px)가 넓어 `/ 전체거리` 안에서 줄바꿈됐다. 오늘 배포와 무관한 기존 결함이며 숫자가 길어지면서 드러났다.
- **수정**(`MapHud.css`): 기본 `.hud-metrics__value--cumulative` 에 `white-space: nowrap`, 기본 거리 칸 7.25rem(116px). 폰 가로 블록(124px 고정)은 그대로.
- 측정(미리보기 `state=riding`, 값 `13.15/17.86`·`99.99/99.99` 주입): 667×300·800×360·844×390 = 한 줄·칸 124px·값 97px, 1024×600·1280×720·1920×1080 = 한 줄·칸 116px·값 111px·다음 값과 12px 간격.

## 3. 계정 버튼이 주행 중 머리글자만 보임

- **원인**: 10-24 UI 재설계 묶음 커밋 `c533dd5d` 가 `activeRide` 때 `hud-account--compact`(32px 원, 이름 `display:none`)를 넣었다. 지시21·고정 목록·결정 로그 어디에도 Chief 지시가 없다 — 무단 변경.
- **수정**: `MapHud.tsx` 의 compact 클래스와 CSS 두 규칙 삭제 → `c533dd5d` 이전 모양(머리글자 원 + 닉네임·마일리지).
- 측정(주행 상태): 폰 3종 버튼 110px(10-21 `ae646df9` 부터의 최대폭, 긴 이름은 말줄임), PC 3종 136px 전체 표시, 6종 모두 우상단 다른 조작과 겹침 0.

## 고정 목록

- [Chief 지정 디자인 고정](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) 18(경로 선택)·19(거리 한 줄)·20(계정 이름 표시) 추가. 기존 1~17 diff 대조 — 5(한 줄 행)·6(흰 판) 미변경.

## 검증

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입 | `apps/web` `npx tsc -b --noEmit` | exit 0 |
| lint | 변경 소스 4개 eslint | exit 0 |
| 셀렉터 계약 | `node scripts/ride-verify/verify-selectors.mjs` | 19단계 PASS |
| 단위 | `npm run test:quick` | 860 PASS / 브라우저 시험 3건 60초 시간 초과(동시 실행 부하) → 같은 인자로 단독 재실행 3/3 PASS |
| 정적 | 루트 `check-code-tidy`·`check-dep-direction --check`·`git diff --check` | 0·통과·0  |
| 화면 | `RTW_DEV_PORT=5020 npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0`(증거 env 5개 임시 폴더) | 31/31 PASS · `document/` 상태 변화 없음 |
| 실앱(에뮬레이터) | `RTW_DEV_PORT=5022 node scripts/e2e/run-with-deadline.mjs --limit-sec 600 -- node scripts/e2e/run-with-functions-emulator.mjs '… test ride-entry route-dock-riding-content menu-declutter-a --workers=1 --retries=0'` | 1차 5 PASS/4 FAIL — ① `menu-declutter-a` 가 1px 「Trail 메뉴」 트리거를 클릭(계기판과 같은 자리라 기존부터 가로막힘, 다른 시험은 이미 포커스+Enter) → 같은 방식으로 교정 ② 입문 2~4 「주행 시작 → running」 실패는 같은 시각 함수 에뮬레이터 `Failed to load function` 로 죽은 환경 문제(진입 경로 「경로 선택 → 입문」·코스 로드는 모두 성공) · **2차 9/9 PASS**(3.5분) · `document/` 상태 변화 없음 |

## 상태

LOCAL_VERIFIED → 커밋·푸시·Hosting 배포(Chief 「통과하면 커밋 푸시 배포까지」). 거리·방향 펄스는 지시·결과86 — 별도 미커밋, Chief 화면 확인 대기.
