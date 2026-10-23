# 지시 21 — Chief 지정 조작부 되돌리기 4건 + 잠금 시험

2026-10-24 Chief 지시 · 발주 Claude Code · 구현 **Cursor CLI** · 결과 파일 `22-result-chief-revert-controls.md`

> Chief 원문 요약: ① 우하단 「주행 시작」 파란 글자 버튼 → 원래 채택한 **녹색 버튼(글자 없음)**으로. ② 일시정지 때 「주행 끝내기」「다시 달리기」 글자 버튼 → 이전의 **글자 없는 버튼**으로. ③ 지도 스타일(야외/위성) 버튼이 주행이 시작되면 사라진다 → **계속 유지**. ④ 순위 칩 「이번 주 1위」 글자 제거 → **원형 버튼, 안에 그래프 이미지 유지**. 그리고 Chief 가 직접 지시한 디자인을 수퍼바이저가 다시 임의로 바꾸지 못하게 하라.

**먼저 읽을 것:** [Chief 지정 디자인 고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md). 이 작업의 결과가 그 목록 1~4번이다. 목록 5~9번은 건드리지 않는다.

## 원인 (Supervisor 조사)

- ①② 묶음 2(지시 08)가 시안 04/09 를 따르며 `RideControlBar.tsx`·`RideControlBar.css`·`RideMediaButton.css`를 바꿨다(파란 44px 「주행 시작」, 56px pause, 일시정지 직접 글자 버튼 3개). 커밋 `5671a014`(HEAD) 판이 Chief 가 채택했던 모습이다.
- ③ 묶음 2가 `apps/web/src/components/maphud/MapHud.tsx:339` `showMapControls`에 `&& !activeRide`를 더했다. HEAD 는 `Boolean(mapControls) && !isGate && !isSummary`.
- ④ `apps/web/src/components/leaderboard/LeaderboardGlance.tsx` 칩이 `이번 주 N위`/`N위`/`예상 N위` 글자를 그린다(배포판, 이번 미커밋 변경 없음). 아이콘 `RankChipIcon`.

## 할 일

1. **주행 시작·재개·일시정지·종료·일시정지 옵션 버튼**: `git show 5671a014:<경로>`로 HEAD 판을 읽고, 이 버튼들의 마크업·클래스(`ride-media-button--play/--pause/--stop`, `⋯` 옵션)·스타일을 HEAD 그대로 되돌린다. 모양·색·크기·글자 없음이 HEAD 와 같아야 한다. 접근성 이름(「주행 시작」「재개」「일시정지」「주행 종료」「일시정지 옵션」)과 동작·cue 애니메이션은 HEAD 대로.
   - 묶음 2의 다른 변경(센서 칩 배치, 이어 달리기 선택, 경로 카드, 출발 전 거리·고도, 카메라 메뉴, 한국어 코칭)은 **유지**한다. 그것들과 얽힌 부분만 최소로 맞춘다.
2. **지도 조작 유지**: `showMapControls`에서 `!activeRide` 제거. 주행 중·일시정지에도 [야외/위성][+][−]가 보이고 눌린다. CSS 에서 주행 중 숨기는 규칙이 있으면 같이 제거. 카메라 메뉴·계정 버튼과 겹치지 않는지 667×300·800×360·844×390 확인.
3. **순위 칩 = 글자 없는 원형 아이콘 버튼**: 모든 상태(지도 대기·Guest·주행 중)에서 칩 안에 글자·숫자를 그리지 않는다. 지름 40px 안팎 정원, 안에 기존 그래프 아이콘(`RankChipIcon`), 기존 파란 배경 유지. 순위 문구(「이번 주 1위」「주행 중 3위」「예상 5위」)는 `aria-label`·`title`로 옮긴다. 펼침 표시(⌃)는 빼거나 원 안에 넣지 말 것. 칩을 눌러 여는 순위판·주행 중 앞뒤 목록은 바꾸지 않는다.
4. **잠금 시험**: `apps/web/e2e/ui-800x360.spec.ts`에 `test.describe('Chief 고정 — 261024 목록 1~4')`를 추가한다.
   - 준비 상태 「주행 시작」 버튼: 보이는 글자 없음(`innerText` 공백), 배경이 녹색 계열(HEAD CSS 의 실제 계산값과 일치), 정원(가로=세로).
   - 일시정지 상태: 조작부 버튼에 보이는 글자 없음, 「주행 끝내기」「다시 달리기」 글자 없음, 재개 버튼 녹색.
   - 주행 중·일시정지: 「야외」/「위성」 버튼과 +/− 가 보임.
   - 순위 칩: 보이는 글자 없음, 가로=세로(±1px), `border-radius` ≥ 절반, svg 아이콘 존재, 접근성 이름에 「위」 포함.
   - 이 describe 머리에 주석: 「Chief 지정 — 바꾸려면 Chief 지시와 document/reference/product/261024-RTW-Chief-지정-디자인-고정.md 갱신 필요」.
5. 묶음 2가 바꿨던 시험(`ui-800x360.spec.ts`의 시작44/pause56 검사, `ui-redesign-batch2.spec.ts`, `ui-redesign-batch2-live.spec.ts`, `scripts/ui-800x360/preview.tsx`)에서 파란 글자 버튼·글자 일시정지 버튼·주행 중 지도 조작 숨김을 기대하는 단언은 **Chief 지정 모습**을 기대하도록 고친다. 고친 단언마다 결과 파일에 before→after 를 적는다. 다른 단언은 느슨하게 하지 않는다.

## 금지

- [고정 목록](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) 5~9번 변경 금지(경로 목록 흰 박스·한 줄 행, 윤곽선 HUD, 소문자 km, 지도 스타일 2종).
- 데이터·Firestore·함수·인증·주행 로직·순위 계산 변경 금지. 표시만.
- `git worktree`·`restore`·`checkout`·`clean`·`stash`·브랜치 전환·커밋·푸시 금지(HEAD 판은 `git show`로 읽기만). 다른 미커밋 변경을 되돌리지 말 것.
- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`, `.out/`, `cdbox.bat`, `firebase.route-list-qa.json` 손대지 말 것. 포트 3000·5000·5001·5021 서버 끄지 말 것. 운영 Firebase 쓰기 금지.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 순서대로, 1 worker)

1. `npx tsc -b --noEmit`
2. 변경 파일 eslint (오류 0)
3. `npm run test:quick` — 실패가 있으면 그 파일만 같은 플래그로 단독 재실행해 결과를 함께 적는다.
4. `node scripts/ride-verify/verify-selectors.mjs`
5. PowerShell: `$env:RTW_DEV_PORT='5020'; $env:BATCH2_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\chief-revert'; npx playwright test ui-800x360 ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` → 로그 `evidence/chief-revert/ui.log`.
6. 캡처 `evidence/chief-revert/`: `ready-{667x300,800x360}.png`(녹색 시작·순위 칩), `riding-800x360.png`(지도 조작 보임), `paused-{667x300,800x360}.png`. 프리뷰 상태를 써서 찍는다.
7. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`, `git diff --check`.

실앱 에뮬레이터 시험(`ride-entry` 등)은 Supervisor 가 돌린다.

## 결과 파일 `22-result-chief-revert-controls.md`

바꾼 파일, 고친 시험 단언 before→after, 검증 명령별 통과·실패(실패 원문), 캡처 경로, 못 한 것. 사실만.
