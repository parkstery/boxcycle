# 지시 39 — 주행 시작 때 주소창을 「숨기지 않고 접는다」

2026-10-24 Chief 지시 · 발주 Claude Code · 구현 **Cursor CLI** · 결과 파일 `40-result-riding-address-dock-collapse.md` · 독립 감리 OpenCode `nemotron-3-ultra-free`

> Chief 원문: 「'주소창을 숨긴다'로 하면 다시 보고 싶을 때 볼 수 있는 방법이 없다. 내가 그래서 볼 수 없었고 접기/펼치기 버튼조차 없으니 다시 펼쳐볼 수조차 없었던 것이다. 숨기는게 아니라 '주소창을 접는다'로 해야 한다.」

먼저 [Chief 지정 디자인 고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md)을 읽는다. **11번이 이번 지시로 바뀌었다**(주행 시작 → 접힘, › 로 펼침). 1~10번은 건드리지 않는다. 「일하는 법」 5번 「숨기지 말고 접는다」도 읽는다.

## 지금 (커밋 `db12e785`, 지시 35)

`apps/web/src/components/route-dock/RouteDock.tsx` — 주행·일시정지 중에도 주소 카드가 **펼친 채로** 보이고, ‹ 로 사용자가 접을 수 있다. `expanded` 는 `useState(true)` 로 시작하고 상태 전환에 반응하지 않는다.

## 할 일

1. **주행 시작 때 자동으로 접는다**: stage 가 주행 아님 → `riding` 으로 바뀌는 순간 `expanded = false`. 처음 마운트될 때 이미 `riding`/`paused`(새로고침·이어 달리기 복원 등)여도 접힌 상태로 시작한다.
   - 주행 중 사용자가 › 로 펼치면 그대로 둔다. `riding` ↔ `paused` 전환은 사용자의 선택을 바꾸지 않는다.
   - 주행이 끝나 대기·설정·결과 이후 화면으로 돌아가면 다시 **펼침**(대기 화면 모습은 지금 그대로).
   - React 규칙(react-hooks v7: effect 안 setState 경고 등)에 맞게 구현한다. 이전 stage 를 기억해 렌더 중 조정하는 방식 등 — eslint 오류 0.
2. **접힌 모습이 「찾을 수 있는」 버튼이어야 한다**: 주행 중 접힌 카드는 미니맵 바로 위 왼쪽에 흰 바탕의 › 펼치기 버튼으로 보인다. 터치 영역 최소 28×28px, 지도 위에서 눈에 띄는 대비(지금 대기 화면 ‹ 와 같은 흰 카드 바탕). 접근성 이름 「경로 패널 펼치기」. 펼치면 지시 35 의 모습(미니맵과 같은 폭, ✕·⇅ 없음).
3. `lib/route/routeDockUiPolicy.ts` 머리 주석의 「2026-09-28 Chief: 자동 접힘을 없앤다」 설명을 사실대로 고친다: 그때 이유(dock 헤더에 일시정지·종료 버튼이 있었음)는 조작부가 `RideControlBar` 로 옮겨 사라졌고, 2026-10-24 Chief 가 「숨기지 말고 접는다」로 주행 시작 접힘을 정했다. 정책 값이 필요하면(예: `collapseOnRideStart: true`) 이 파일에 두고 계약 시험 `scripts/ride-hierarchy/route-dock-riding-contract.test.ts` 를 함께 맞춘다.
4. **시험** (Chief 지시로 기대값이 바뀌는 것만 바꾼다. 다른 단언은 느슨하게 하지 말 것):
   - `e2e/ui-800x360.spec.ts` 「Chief 고정 — 목록 11」: `state=riding`·`state=paused` 에서 처음엔 **접힘**(「경로 패널 펼치기」 버튼 보임, 출발·도착 줄 안 보임) → 펼치기 누르면 출발·도착 줄 보임, ✕·⇅ 없음, 미니맵과 좌우 끝 같음(±0.1px). 대기 화면 250px 단언 유지.
   - `e2e/address-minimap-width.spec.ts`: 측정 전에 펼치기를 누르도록. 계약 값은 그대로.
   - `e2e/route-dock-riding-content.spec.ts`(에뮬레이터, Supervisor 가 돌림): 「주행 시작해도 펼친 채로 남는다」 → 「주행 시작하면 접히고, 펼치기를 누르면 경유지 수가 주행 전과 같고 라벨이 비어 있지 않다」. 파일 머리 주석도 2026-10-24 Chief 결정으로 고친다. 일시정지·주행 종료 버튼 단언은 유지.
   - 프리뷰에서 펼치기 버튼이 접힌 상태 그대로 보이는지 캡처로 확인.
5. 캡처 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\riding-address-dock-collapse\` (**이 절대 경로에만 저장**. 지난 두 번 `apps/web/evidence/`·`apps/document/` 에 잘못 저장됨 — Playwright 상대 경로를 쓰지 말고 절대 경로로): `riding-collapsed-{667x300,800x360}.png`, `riding-expanded-800x360.png`, `paused-collapsed-800x360.png`, `ready-800x360.png`.

## 금지

- 고정 목록 1~10 변경 금지. 11번은 이 지시서대로만.
- 미니맵 크기·모양·동작, 주행 로직, 데이터·Firestore 변경 금지.
- **묶음 3 미커밋 변경 보존**: `NextRideCard.*`, `RideSummarySheet.*`, `e2e/ride-continuation.spec.ts`, `e2e/rideEntryHelpers.ts`, `scripts/next-ride/resume-slot-ui-fixture-main.tsx`, `scripts/ui-800x360/preview.tsx`, `e2e/ui-redesign-batch3*.spec.ts` 의 기존 변경을 되돌리지 말 것. 프리뷰를 꼭 고쳐야 하면 주소창 부분만 더한다.
- `git worktree`·`restore`·`checkout`·`clean`·`stash`·브랜치 전환·커밋·푸시 금지. `tmp/deploy35/` 손대지 말 것.
- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`, `.out/`, `cdbox.bat` 손대지 말 것. 포트 3000·5000·5040 서버 끄지 말 것. 운영 Firebase 쓰기 금지.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 순서대로, 1 worker)

1. `npx tsc -b --noEmit`
2. 변경 파일 eslint (오류 0)
3. `npm run test:quick` — 실패가 있으면 그 파일만 같은 플래그로 단독 재실행해 함께 적는다.
4. `node scripts/ride-verify/verify-selectors.mjs`
5. 프리뷰 5020(`$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`) → `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` → 로그 `evidence/riding-address-dock-collapse/ui.log`
6. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`, `node scripts/check-document-system.mjs`, `git diff --check`.
7. **끝나면 5020 을 실제로 끄고** `netstat` 으로 LISTENING 없음을 확인해 결과에 적는다.

## 결과 파일 `40-result-riding-address-dock-collapse.md`

바꾼 파일, 고친 시험 단언 before→after(이유), 검증 명령별 통과·실패(실패 원문), 캡처 절대 경로 목록, 못 한 것. 사실만.
