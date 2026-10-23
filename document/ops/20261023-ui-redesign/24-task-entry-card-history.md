# 지시 24 — 「어디에서 첫 라이딩을 할까요?」 카드 삭제 + 주행 기록 화면을 계정 패널에 연결

2026-10-24 Chief 지시 · 발주 Claude Code · 구현 **Cursor CLI** · 결과 파일 `25-result-entry-card-history.md`

> Chief 원문: 「「어디에서 첫 라이딩을 할까요?」 카드 지워. 주행 기록 화면: 계정 패널에 연결해. 현재의 인터페이스 상태와 어떻게 달라지는지 내가 확인한 후 유지할지 제거할지 결정할게.」

먼저 [Chief 지정 디자인 고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md)을 읽는다. 1~9번 모두 건드리지 않는다.

## A. `LocalFirstEntryCard` 삭제

- 위치: `apps/web/src/App.tsx` `firstRideIntroCard`(≈2597행), `apps/web/src/components/ride/LocalFirstEntryCard.tsx`(354줄), `components/ride/index.ts` export, 캡처 spec `apps/web/e2e/local-first-card-shots.spec.ts`.
- 카드와 그 렌더링을 지운다. **카드에서만 쓰이던** 상태·핸들러·hook·lib 함수·CSS·시험도 함께 지운다(예: Local First 지역 검색/확정/해제 핸들러, Ready Ride 생성 UI 상태가 다른 곳에서 안 쓰이면). 다른 곳에서도 쓰이면 남긴다. 판단 근거(쓰는 곳 grep)를 결과에 적는다.
- 위치 선택 창(`EntryLocationDialog`, 「출발 위치」)·입문 경로 목록·RouteDock 은 그대로. 첫 방문자가 카드 없이도 위치 선택 → 지도 → MENU 입문으로 주행까지 갈 수 있어야 한다.
- 결과 파일에 **카드와 함께 사라지는 기능 목록**(예: Ready Ride 2/3/5/10 km 자동 생성 버튼 등)을 사실대로 적는다. Chief 가 확인한다.
- `dep-layers.json`·knip 기준선은 줄어드는 쪽만 허용. 늘리지 말 것.

## B. 주행 기록 화면(`RideHistoryPanel`)을 계정 패널에 연결

- 지금: 계정 패널(`apps/web/src/components/UserInfoSheet.tsx` ≈589행) 「마지막 주행」 줄을 누르면 패널 안에서 짧은 목록(`historyOpen`, `#user-info-sheet-history-list`)이 펼쳐진다. `components/ride/RideHistoryPanel.tsx`(Firestore `rides` 최근 50건)는 앱 어디에서도 열리지 않는다.
- 바꿀 것: 「마지막 주행 ›」을 누르면 **`RideHistoryPanel`이 열린다**(흰 판, 닫기 → 계정 패널로 복귀). 계정 패널 안 펼침 목록은 이 동작으로 대체한다. 단, Chief 가 「유지/제거」를 결정할 수 있게 **되돌리기 쉬운 형태**로: 펼침 목록 코드는 지우지 말고 플래그 상수 하나(`ACCOUNT_HISTORY_MODE = "panel" | "inline"`, 기본 `"panel"`)로 갈리게 하고, 결과 파일에 되돌리는 법을 적는다.
- `RideHistoryPanel` 판 모양은 디자인 규칙의 「판 = 흰 바탕」, 소문자 km, 폰 가로 667×300 에서 닫기·목록 스크롤 가능. 데이터 쿼리·Firestore 경로는 바꾸지 않는다. Guest 안내 문구 유지.
- 프리뷰 `scripts/ui-800x360/preview.tsx`에 계정 패널·주행 기록 상태가 있으면 쓰고, 없으면 메모리 예시 데이터(가짜 rides 3~5건)로 상태를 더한다. 운영 데이터 금지.

## 캡처 (Chief 비교용) — `evidence/entry-card-history/`

- **before(변경 전)**: 작업을 시작하기 전에 먼저 찍는다. `before-account-inline-{667x300,800x360}.png`(계정 패널에서 「마지막 주행」을 눌러 펼친 모습), `before-first-visit-card-800x360.png`(카드가 보이는 첫 방문 상태, 프리뷰나 기존 `local-first-card-shots.spec.ts`로).
- **after**: `after-account-{667x300,800x360}.png`(계정 패널), `after-history-panel-{667x300,800x360}.png`(「마지막 주행 ›」을 누른 뒤), `after-first-visit-800x360.png`(카드 없는 첫 방문).

## 금지

- 고정 목록 1~9 변경 금지. 데이터·Firestore 쿼리·함수·인증·주행 로직 변경 금지.
- `git worktree`·`restore`·`checkout`·`clean`·`stash`·브랜치 전환·커밋·푸시 금지.
- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`, `.out/`, `cdbox.bat` 손대지 말 것. 포트 3000 서버 끄지 말 것. 운영 Firebase(5000 정상 앱 포함)에 시험 데이터 쓰기 금지. 띄운 dev 서버는 끝나면 끈다.
- 시험 조건·기준선 완화 금지. 「Chief 고정」 잠금 시험 기대값 변경 금지.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 순서대로, 1 worker)

1. `npx tsc -b --noEmit`
2. 변경 파일 eslint (오류 0)
3. `npm run test:quick` — 실패가 있으면 그 파일만 같은 플래그로 단독 재실행해 함께 적는다.
4. `node scripts/ride-verify/verify-selectors.mjs`
5. 프리뷰 서버 5020 을 띄워(`$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`) `npx playwright test ui-800x360 ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` → 로그 `evidence/entry-card-history/ui.log`. 계정 패널 → 「마지막 주행 ›」 → 주행 기록 판 열림·닫기 복귀 단언을 `ui-800x360.spec.ts`에 추가.
6. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`, `node scripts/check-document-system.mjs`, `git diff --check`.

실앱 에뮬레이터 시험(`ride-entry` 등)은 Supervisor 가 돌린다.

## 결과 파일 `25-result-entry-card-history.md`

바꾼·지운 파일, 카드와 함께 사라진 기능 목록, 주행 기록 연결 방식과 되돌리는 법, 검증 명령별 통과·실패(실패 원문), before/after 캡처 경로, 못 한 것. 사실만.
