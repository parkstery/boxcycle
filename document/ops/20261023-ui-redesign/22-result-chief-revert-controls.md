# 결과 22 — Chief 지정 조작부 되돌리기 4건 + 잠금 시험

지시: [21-task-chief-revert-controls.md](./21-task-chief-revert-controls.md) · 고정 목록: [261024-RTW-Chief-지정-디자인-고정.md](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) 1~4번

## 구현 요약

| # | 내용 | 조치 |
|---|---|---|
| 1 | 주행 시작 — 녹색 원형 `ride-media-button--play`, 글자 없음 | `5671a014` 판으로 `RideControlBar.tsx`·`RideControlBar.css`·`RideMediaButton.css` 복원 |
| 2 | 일시정지 조작 — 아이콘만(재개·종료·⋯ 옵션) | 동일 복원. 일시정지 옵션 메뉴는 `경로 변경`·`닫기` |
| 3 | 지도 야외/위성·줌 — 주행·일시정지에도 표시 | `MapHud.tsx` `showMapControls`에서 `&& !activeRide` 제거 |
| 4 | 순위 칩 — 글자 없는 40px 원형 + 그래프 SVG | `LeaderboardGlance.tsx`·`LeaderboardGlance.css` — 순위 문구는 `aria-label`·`title`만 |

묶음 2 유지 항목(센서 칩·이어 달리기·경로 카드·카메라 메뉴·코칭 등)은 이번 diff에서 건드리지 않음. 고정 목록 5~9번 파일도 변경 없음.

## 변경 파일

- `apps/web/src/components/ride/RideControlBar.tsx`
- `apps/web/src/components/ride/RideControlBar.css`
- `apps/web/src/components/ride/RideMediaButton.css`
- `apps/web/src/components/maphud/MapHud.tsx`
- `apps/web/src/components/leaderboard/LeaderboardGlance.tsx`
- `apps/web/src/components/leaderboard/LeaderboardGlance.css`
- `apps/web/e2e/ui-800x360.spec.ts` — `Chief 고정 — 261024 목록 1~4` describe 추가
- `apps/web/e2e/ui-redesign-batch2.spec.ts`
- `apps/web/e2e/ui-redesign-batch2-live.spec.ts`
- `apps/web/scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts`
- `apps/web/scripts/ride-verify/entry-contract.mjs`

`scripts/ui-800x360/preview.tsx` — 지도 조작은 `MapHud` 수정만으로 주행·일시정지 프리뷰에서도 표시됨. 별도 diff 없음.

## 시험 단언 before → after

| 파일 | before | after |
|---|---|---|
| `e2e/ui-redesign-batch2.spec.ts` (riding) | 일시정지 버튼 높이 `56` | `44` (HEAD `ride-media-button--pause`) |
| `e2e/ui-redesign-batch2.spec.ts` (paused) | `경로 바꾸기\|경로 변경` 버튼 visible | `일시정지 옵션` (⋯) visible |
| `e2e/ui-redesign-batch2-live.spec.ts` (paused) | `경로 바꾸기` visible | `일시정지 옵션` visible |
| `scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` | `aria-label="주행 시작"`, `disabled={startDisabled}` | `aria-label={paused ? "재개" : "주행 시작"}`, `일시정지`·`주행 종료` aria, `disabled={ready && startDisabled}` |
| `scripts/ride-verify/entry-contract.mjs` (start-ride) | 별도 `aria-label="주행 시작"` / `"재개"` 앵커 | `aria-label={paused ? "재개" : "주행 시작"}` 단일 앵커 |

## 검증 (실행 위치 `C:\20.HDev\boxcycle\apps\web`, 1 worker)

| # | 명령 | 결과 |
|---|---|---|
| 1 | `npx tsc -b --noEmit` | 통과 |
| 2 | 변경 TS/TSX eslint | 오류 0 (CSS 3건 ignored warning) |
| 3 | `npm run test:quick` | 최초 1 실패(`sensor-chip-slot-contract` — 위 앵커 수정 후 재실행) → **통과 1354 / 실패 0** |
| 4 | `node scripts/ride-verify/verify-selectors.mjs` | 19단계 전부 통과 |
| 5 | `$env:RTW_DEV_PORT='5020'; $env:BATCH2_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\chief-revert'; npx playwright test ui-800x360 ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | **23 passed** — 로그 `document/ops/20261023-ui-redesign/evidence/chief-revert/ui.log` |
| 6 | 캡처 | 아래 경로 생성됨 |
| 7 | 루트 `node scripts/check-code-tidy.mjs` | 통과 |
| 7 | `node scripts/check-dep-direction.mjs --check` | 통과 |
| 7 | `git diff --check` | 통과 (CRLF 경고만) |

## 캡처 (`evidence/chief-revert/`)

Chief 잠금 시험:

- `ready-667x300.png`, `ready-800x360.png`
- `paused-667x300.png`, `paused-800x360.png`
- `riding-800x360.png`

묶음 2 Playwright 스크린샷(동일 폴더): `batch2-{ready|riding|paused}-{667x300|800x360|844x390}.png`

## 미실행·한계

- `ui-redesign-batch2-live.spec.ts` — 지시 검증 목록에 없어 Playwright 묶음 실행에는 포함하지 않음. 단언만 Chief 모습에 맞게 수정함.
- `ride-entry` 등 실앱 에뮬레이터 시험 — Supervisor 담당(지시서 명시).
- 커밋·푸시·worktree·restore·checkout·clean·stash — 수행하지 않음.

## Chief 로컬 확인 (선택)

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
$env:BATCH2_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\chief-revert'
npx playwright test ui-800x360.spec.ts -g "Chief 고정" --workers=1 --retries=0
```

프리뷰: dev 서버 기동 후 `http://localhost:5020/scripts/ui-800x360/preview.html?state=ready` · `?state=paused` · `?state=riding` · 순위 칩 `?state=glance-ready`

## 감리 (Claude Code, 2026-10-24 08:0x)

판정 **PASS.** 고정 목록 1~4번이 캡처와 잠금 시험으로 확인되고, 5~9번 파일은 diff 에 없다.

- 캡처 직접 확인 `evidence/chief-revert/`: ready — 녹색 원형 재생(글자 없음)·원형 순위 칩(그래프 아이콘). riding — 파랑 pause·빨강 stop 아이콘, 위성/+/− 보임. paused — 녹색 재생·빨강 stop·⋯, 위성/+/− 보임.
- 바뀐 시험 단언은 묶음 2가 바꾸기 전(HEAD) 모습으로 돌아간 것뿐(위 표). 다른 단언 완화 없음.
- 실앱 에뮬레이터 (`C:\20.HDev\boxcycle\apps\web`, functions 5019 임시 설정): 1차 `ride-entry`+`ui-redesign-batch2-live` 7 PASS·1 FAIL — `ride-entry.spec.ts:70` 첫 시험에서 「어디에서 시작할까요?」 위치 창이 늦게 떠 시작 버튼 클릭이 30초 대기 초과(`live.log`). 2차 `ride-entry` 단독 **7/7 PASS** (`live-rerun.log`). 첫 시험 위치 창 타이밍 흔들림으로 기록(다음 담당이 다시 보이면 조사). `ui-redesign-batch2-live` 1차에서 PASS.
- 보존 JSON SHA256 `4CAFA2A2…` 그대로.
