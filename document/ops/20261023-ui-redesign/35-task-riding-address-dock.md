# 지시 35 — 주행 중 출발·도착 주소창 되살리기

2026-10-24 Chief 지시 · 발주 Claude Code · 구현 **Cursor CLI** · 결과 파일 `36-result-riding-address-dock.md` · 독립 감리 OpenCode `nemotron-3-ultra-free`

> Chief 원문: 「주행 중에 출발, 도착 주소창이 보이지 않고 있다.」 (실화면: 대기 화면에는 좌하단 흰 주소창 [출발/도착 + 센서]가 보이고, 주행 시작 뒤에는 미니맵만 남고 주소창이 사라짐)

먼저 [Chief 지정 디자인 고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md)을 읽는다. 1~10번 모두 건드리지 않는다.

## 원인 (Supervisor 조사)

- 묶음 2(커밋 `c533dd5d`)가 `apps/web/src/components/route-dock/RouteDock.tsx:42` 에 `|| isActiveRide` 를 더해 **주행·일시정지 중 RouteDock 을 통째로 숨겼다**(주석 「hidden during active ride (minimap)」). 그 전 판(`git show 5671a014:apps/web/src/components/route-dock/RouteDock.tsx`)은 주행 중에도 보였다.
- 이건 Chief 가 앞서 직접 정한 모습을 묶음 2가 덮어쓴 것이다:
  - 2026-09-28 Chief: 주행 시작해도 주소창을 자동으로 접지 않는다, 정보는 숨기지 않는다(`lib/route/routeDockUiPolicy.ts` 주석, `e2e/route-dock-riding-content.spec.ts`).
  - 2026-10-22 Chief: 주행 중 주소창 너비를 바로 아래 미니맵과 같게(`document/ops/20261020-ui-800x360/02-task-15.md`·`02-task-16.md`, `features/map-overlays/MapBottomLeftStack.css` 「펼친 미니맵의 실제 너비에 주소창의 좌우 끝을 맞춘다」, `e2e/address-minimap-width.spec.ts`).
- 묶음 2가 RouteDock 마크업을 `.route-dock__shell/__body/__panel` → `.route-dock__card/__grid` 로 바꾸면서 위 스택 CSS 선택자와 두 시험의 선택자가 **헛돌고** 있다(대상 없음).

## 할 일

1. **주행·일시정지 중 주소창 표시**: `RouteDock.tsx` 의 `|| isActiveRide` 숨김을 없앤다. 주석도 사실대로 고친다.
   - 주행 중 모습: 지금 대기 화면의 흰 주소 카드와 같은 모양(출발·경유·도착 줄). **조작은 잠금** — ✕ 삭제·⇅ 바꾸기 없음(`lockStopEditing` 그대로). 센서 줄은 주행 중엔 조작부 쪽이므로 주소 카드에 없음(`sensorChipSlot` 그대로). 잠금일 때 바꾸기 버튼 자리(32px 빈 칸)가 남아 주소가 잘린다면 빈 칸을 없애 주소에 폭을 준다.
   - 접기 버튼(‹/›)은 주행 중에도 그대로. 주행 시작 때 자동으로 접지 않는다.
   - 줄 누르기(지도에서 보기)는 주행 중에도 동작해도 된다 — 기존 HEAD 판 동작.
2. **미니맵과 너비 맞춤 복구**: 좌하단 스택에서 주소 카드가 **미니맵 바로 위**, 펼친 미니맵과 **좌우 끝이 같게**(2026-10-22 Chief). `MapBottomLeftStack.css` 의 해당 규칙 선택자를 새 마크업(`.route-dock__card` 등)에 맞게 고친다. RouteDock.css 의 고정 `width: min(250px, …)` 가 스택 규칙을 이기면 스택 안·미니맵 펼침일 때만 풀리게 한다. 미니맵을 접었을 때는 주소 카드가 자기 폭으로 돌아간다. 대기 화면(미니맵 없음)의 주소 카드 모양·폭은 바꾸지 않는다.
3. **폰 가로에서 겹침 없음**: 667×300·800×360·844×390 주행/일시정지에서 주소 카드+미니맵이 계기판(좌상단)·코칭 문구(하단 가운데)·조작부(우하단)·Mapbox 로고·저작권과 겹치지 않는다. 667×300 에서 위로 넘치면 주소 카드 줄 높이·여백을 줄이는 쪽으로(미니맵 크기는 건드리지 말 것). 그래도 안 되면 결과에 실측값과 함께 보고하고 멈춘다.
4. **헛도는 시험 되살리기** (기대값은 그대로, 선택자만 새 마크업으로):
   - `e2e/address-minimap-width.spec.ts`: 프리뷰 `state=riding` 에서 주소 카드 좌우 끝 = 미니맵 좌우 끝(±0.1px), 3폭 × 미니맵 3너비, 접기·미니맵 접힘 동작. 프리뷰가 실제 `MapBottomLeftStack` 으로 감싸 그린다면 시험 안의 임시 DOM 조립을 지우고 실제 구조로 잰다. 고정 숫자(180/170 등)가 새 카드 구조에서 의미가 바뀌면, 왜 바뀌는지 결과에 적고 같은 계약(「미니맵 폭을 따른다 / 미니맵 접히면 자기 폭」)을 재는 값으로 바꾼다. 느슨하게 하지 말 것.
   - `e2e/route-dock-riding-content.spec.ts`(에뮬레이터, Supervisor 가 돌림): `.route-dock__stop-label`·`.route-dock__stop-remove` 등 옛 선택자를 새 마크업으로. 「주행 중 삭제 잠금」 단언은 ✕ 가 아예 없으면 `toHaveCount(0)` 으로 바꿔 빈 반복으로 통과하지 않게 한다.
5. **잠금 시험 추가**: `e2e/ui-800x360.spec.ts` 의 「Chief 고정」 describe 안(또는 바로 아래 같은 머리 주석)에 「목록 11 — 주행·일시정지 중 주소창 보임」: 프리뷰 `state=riding`·`state=paused` 에서 출발·도착 주소 줄이 보이고, ✕·⇅ 가 없고, 주소 카드 좌우 끝이 미니맵과 같다(펼침일 때).
6. 프리뷰(`scripts/ui-800x360/preview.tsx`)의 riding/paused 상태가 주소창을 그리지 않게 바뀌어 있으면 실앱과 같게 되돌린다. **주의: 이 파일에는 묶음 3 미커밋 변경이 있다 — 그 변경은 지우거나 되돌리지 말고 주소창 관련 부분만 더한다.**

## 금지

- 고정 목록 1~10 변경 금지. 특히 3(주행 중 야외/위성·줌 보임), 7(계기판 바탕 없는 윤곽선 글자) — 주소 카드를 넣느라 지도 조작이나 계기판을 옮기거나 숨기지 말 것.
- 미니맵 크기·모양·동작 변경 금지. 데이터·Firestore·주행 로직·경로 계산 변경 금지.
- **묶음 3 미커밋 변경 보존**: `NextRideCard.*`, `RideSummarySheet.*`, `e2e/ride-continuation.spec.ts`, `e2e/rideEntryHelpers.ts`, `scripts/next-ride/resume-slot-ui-fixture-main.tsx`, `scripts/ui-800x360/preview.tsx`, `e2e/ui-redesign-batch3*.spec.ts` 의 기존 변경을 되돌리지 말 것.
- `git worktree`·`restore`·`checkout`·`clean`·`stash`·브랜치 전환·커밋·푸시 금지.
- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`, `.out/`, `cdbox.bat` 손대지 말 것. 포트 3000·5000·5040 서버 끄지 말 것. 운영 Firebase 쓰기 금지. 띄운 dev 서버는 끝나면 끈다.
- 시험 조건·기준선 완화 금지. 「Chief 고정」 기존 잠금 시험 기대값 변경 금지.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 순서대로, 1 worker)

1. `npx tsc -b --noEmit`
2. 변경 파일 eslint (오류 0)
3. `npm run test:quick` — 실패가 있으면 그 파일만 같은 플래그로 단독 재실행해 함께 적는다.
4. `node scripts/ride-verify/verify-selectors.mjs`
5. 프리뷰 서버 5020(`$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`) → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` → 로그 `evidence/riding-address-dock/ui.log`.
6. 캡처 `evidence/riding-address-dock/`: **before**(작업 전 먼저) `before-riding-800x360.png`, after `after-ready-800x360.png`(대기 화면 그대로인지), `after-riding-{667x300,800x360,844x390}.png`, `after-paused-800x360.png`, `after-riding-minimap-collapsed-800x360.png`.
7. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`, `node scripts/check-document-system.mjs`, `git diff --check`.

실앱 에뮬레이터 시험(`ride-entry`, `test:e2e:route-dock`)은 Supervisor 가 돌린다.

## 결과 파일 `36-result-riding-address-dock.md`

바꾼 파일, 고친 시험 단언 before→after(이유), 검증 명령별 통과·실패(실패 원문), 667×300 겹침 실측값, 캡처 경로, 못 한 것. 사실만.
