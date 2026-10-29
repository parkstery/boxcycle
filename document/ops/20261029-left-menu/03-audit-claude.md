# 03 감리 — 왼쪽 메뉴 정비 (Claude Code 인수)

2026-10-29 Claude Code(Opus 5.5) Supervisor. Chief 「코덱스 작업을 이어받아서 처리」로 Codex에서 인수. 대상은 [02 Cursor 결과](02-result-cursor.md)(17:04). 증거는 `evidence/audit-claude/`.

## 판정: PASS (2026-10-29 Chief 「1. A 2. 따로」 반영 후)

A안 반영(Claude Code 직접): 「사용」을 알약 스위치(46×28)로 바꾸고, 직접 조절 중에는 프리셋 칸을 숨긴다. `RideIntervalSettingsSheet.tsx/.css`를 고쳤다. `ride-interval-settings.spec.ts`는 「직접 조절 중 프리셋 없음 → 접기 뒤 『직접 설정』」으로 바꾸었고, 확인 항목은 하나 늘었다. 재검증: tsc PASS, eslint 0, 인터벌 관련 7 spec 61/61 PASS(`pw-A.log`). 그림 7~9. 고정 32에 A안을 추가했다. 커밋은 묶음별로 했다(지도 아이콘 100 → 미니맵 접기 102 → 왼쪽 메뉴).

### 결정 전 판정(기록): 조건부 PASS — 인터벌 창 「사용」 스위치 배치 1건은 Chief 결정 대기

메뉴 본체는 Chief 승인 시안과 같다(그림 1). 돋보기·닫기, 「경로 선택」 아래 내 경로/퍼블릭/입문, 주행 설정 위 「인터벌」 순서가 맞다. 기능 회귀도 없다. 남은 것은 인터벌 창 머리줄 배치 하나다.

## 직접 실행한 검증 (`C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS, 출력 0줄 |
| `node scripts/ride-verify/verify-selectors.mjs` | 20/20 PASS |
| `npx eslint` 바뀐 제품 TS 13개 + left-menu spec | 오류 0, 경고 7(기존 `App.tsx` hooks) |
| `npm run build` | PASS(청크 크기 경고만, 기존) |
| Playwright 관련 9개 spec 116건, 포트 5043, 1 worker, 0 retry | 106 PASS / 10 FAIL → 아래 분석 |

## 실패 10건 분석 — HEAD 기준선 비교

커밋된 코드(HEAD `53a357cf`)를 `apps/web/tmp/base`(gitignore 대상, git archive, 링크 없음)에 풀고 같은 10건을 포트 5044로 실행했다(`pw-head-baseline.log`). 실행 뒤 복제본은 삭제했다.

| 시험 | HEAD | 현재 | 판정 |
|---|---|---|---|
| compact-controls 반달 60%·지도 터치 ×4 | FAIL | FAIL | **기존 실패**(반달이 경로 카드와 겹침) |
| compact-controls 탭으로 열고 반달… | FAIL | FAIL | 기존 실패 |
| ui-800x360 고정30 우상단 간격 | FAIL | FAIL | 기존 실패(2.69 < 8 px) |
| ui-800x360 시작·센서·접기 | FAIL | FAIL | 기존 실패(32 ≠ 44 px) |
| ui-800x360 고정14 반달 탭 | FAIL | FAIL | 기존 실패(경로 카드와 겹침) |
| ui-800x360 목록11 주소창 | FAIL | FAIL | 기존 실패(130 > 44 px) |
| ride-interval 「기본은 끔이며…」 | PASS | FAIL | **이번 변경으로 깨짐**: 시험이 옮겨지기 전 경로(주행 설정 안 스위치)를 찾음 |

- 기존 실패 9건은 메뉴 정비와 무관하다. 다만 고정 14·30·목록11 같은 Chief 고정 항목 시험이 HEAD에서 이미 실패하고 있다. 별도 묶음으로 원인을 조사해야 한다(아래 「후속」).
- ride-interval 1건은 Cursor가 고치지 않은 시험이다. 감리자가 **진입 경로만** 메뉴 「인터벌」 → 인터벌 운동 설정 창으로 바꿨고, 확인 내용은 그대로 두었다(`e2e/ride-interval.spec.ts`). 수정 후 6/6 PASS(`pw-ride-interval-fixed.log`). 감리자가 시험 코드를 고친 것이므로 여기에 명시한다.

## 디자인 결함 — 인터벌 창 「사용」 스위치 (Chief 결정 필요)

- 그림 3: 「사용」이 앱의 알약 스위치가 아니라 브라우저 기본 네모 체크박스(32×32)다. 주행 설정의 다른 스위치와 모양이 다르다.
- 그림 4: 「직접 조절」을 펼친 창(폭 230px 고정)에서는 머리줄에 제목·사용·프리셋·닫기 네 개가 들어간다. 그래서 프리셋 칸이 「직」 정도로 잘린다. 변경 전(그림 2)에는 스위치가 없어서 잘리지 않았다.
- 감리자가 시도했다가 되돌린 것(제품 파일은 Cursor 상태 그대로):
  - 알약 스위치(그림 5): 보통 창은 좋다. 그러나 직접 조절 창에서는 프리셋 칸이 21px로 줄어 터치 32px 계약에 FAIL(`pw-pill-attempt.log`).
  - 프리셋을 둘째 줄로 내리기(그림 6): 글자는 보인다. 그러나 창 높이가 329px가 되어 고정 32의 「300px 이하」 계약에 FAIL(`pw-wrap-attempt.log`).
- 선택지:
  - **A (권장):** 알약 스위치를 쓰고, 직접 조절 화면에서만 프리셋 칸을 숨긴다(「접기」 후 선택). 높이·폭·터치 계약을 모두 지킨다. 직접 조절 중 프리셋 칸에는 어차피 「직접 설정」만 보인다.
  - B: 알약 스위치를 쓰고 프리셋을 둘째 줄로 내린다. 고정 32의 높이 기준을 약 330px로 완화해야 한다.
  - C: 현재 그대로 둔다(네모 체크박스, 직접 조절에서 프리셋 글자 잘림).

## 범위·보존

- 다른 묶음의 미커밋 변경과 섞여 있다. `MapHud.tsx`(지도 스타일 아이콘 100 + 메뉴 title), `RouteOverviewFoldToggle.tsx`(미니맵 접기 102 + title), `MapHud.css`(100)가 그렇다. 커밋 분리 방법은 Chief 결정이 필요하다.
- 범위 밖에 남은 것: `scripts/perf/run-real-gpu.mjs`와 `scripts/ride-continue/phase-a-verify.mjs`가 옛 「경로 선택」 단일 버튼을 아직 누른다(게이트 아닌 개발 스크립트).
- 서버 3000·5031·5041은 유지했다. 시험 캡처는 scratchpad에 저장했다. 단 `left-menu-supervisor.spec.ts`는 저장 경로가 고정이라 이 묶음의 `evidence/menu-*.png`, `interval-custom-699x273.png`를 다시 만들었다(이전 파일은 scratchpad `leftmenu-evidence-backup`에 백업). 다른 묶음 증거는 바뀌지 않았다.
- 미실행: 에뮬레이터 실주행(`npm run test:e2e:ride`), 실폰, 전체 e2e.

## 후속

1. Chief: 인터벌 「사용」 배치 A/B/C 결정 → 감리자가 직접 반영·재검증(디자인 맞춤은 Supervisor 직접, 2026-10-24 Chief)
2. Chief: 커밋 분리 방식 결정 → 승인 후 커밋
3. 별도 묶음: HEAD에서 이미 실패 중인 고정 14·30·목록11 등 9건 원인 조사
4. 이후 [인터벌 경로 계획](../20261029-quick-interval-ride/00-plan.md) 2단계(거리 부족 안내) 착수
