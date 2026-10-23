# 순위 칩·순위판·주행 결과 줄 — 결과 (2026-10-23)

## 바꾼 파일

| 경로 | 요약 |
|---|---|
| `apps/web/src/components/leaderboard/leaderboardLiveRank.ts` | 실시간 순위·결과 줄 순수 계산(0.1 km·동점 규칙) |
| `apps/web/src/components/leaderboard/leaderboardGlanceSnapshot.ts` | `top`∪`around` → live row |
| `apps/web/scripts/ride-stats/leaderboard-live-rank.test.ts` | 계약 시험 6건 |
| `apps/web/src/hooks/useLeaderboardGlance.ts` | fetch·5분 갱신·visibility·`atRideStart`·패널 localStorage |
| `apps/web/src/components/leaderboard/LeaderboardGlance.tsx` | `LeaderboardGlanceChip` / `LeaderboardGlancePanel` |
| `apps/web/src/components/leaderboard/LeaderboardGlance.css` | 시안 윤곽선·칩·판 스타일 |
| `apps/web/src/components/maphud/MapHud.tsx` | 우상단 칩·판 슬롯 |
| `apps/web/src/components/maphud/MapHud.css` | (기존 `map-hud__tr` 유지) |
| `apps/web/src/App.tsx` | 훅·HUD·요약 `rankChange` 연동 |
| `apps/web/src/components/ride/RideSummarySheet.tsx` | 순위 변화 한 줄(탭 → 큰 리더보드) |
| `apps/web/src/components/ride/RideSummarySheet.css` | 순위 줄 스타일 |
| `apps/web/scripts/ui-800x360/preview.tsx` | 검수용 glance 상태·모의 데이터 |

**구조:** 지시서의 `src/lib/ride/leaderboardLiveRank.ts` 는 `dep-layers.json` 수정 금지 때문에 **`components/leaderboard/`** 로 두었다. `check-dep-direction` 통과.

## 새 시험

- `scripts/ride-stats/leaderboard-live-rank.test.ts` — 추월 / 동점 / 1위 / 목록 밖 진입 / `addedKm` 0 / merge 중복 제거

## 검증

| 항목 | 결과 |
|---|---|
| `npx tsc -b --noEmit` (apps/web) | 통과 |
| `npm run test:quick` | **1353** 통과 · **0** 실패 |
| `node ../../scripts/check-code-tidy.mjs` | 기준선 이내(knip exports 185 · types 44 · duplicates 7) |
| `node ../../scripts/check-dep-direction.mjs --check` | 위반 **0** |
| `npx eslint` (변경 파일) | error **0** (App 기존 warning만) |
| `RTW_DEV_PORT=5019 npx playwright test ui-800x360 --workers=1 --retries=0` | **11** 통과 · **1** 실패 — `ui-800x360.spec.ts:84` RideControlBar 높이 44px (지시서 「기존 :84 1건 허용」). `:156` 재실행 통과 |
| `RTW_DEV_PORT=5017 npm run test:e2e:ride` | **미실행** — Firebase 에뮬레이터·Functions 번들 필요(감리 환경에서 실행 권장) |

## 캡처 (800×360)

| 파일 | 상태 |
|---|---|
| `C:\20.HDev\boxcycle\.out\glance-map.png` | `preview.html?state=glance-map` · LbMap |
| `C:\20.HDev\boxcycle\.out\glance-riding.png` | `?state=glance-riding` · LbRiding |
| `C:\20.HDev\boxcycle\.out\glance-summary.png` | `?state=glance-summary` · LbSummary 순위 줄 |

재현( dev 서버 예: 5018 ):

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT=5018
npm run dev:localhost
# 다른 터미널에서 preview URL 열거나 Playwright screenshot
```

## 시안과 다르게 한 점

1. **주행 결과 시트 레이아웃** — 앱은 기존 하단 컴팩트 `RideSummarySheet`를 유지하고, 시안(LbSummary)의 740×324 두 칸 판 대신 **순위 변화만 한 줄 버튼**으로 추가했다(지시: 다른 요소 변경 금지).
2. **순위 계산 모듈 경로** — `dep-layers.json` 수정 금지로 `lib/ride/` 신규 assign 없이 `components/leaderboard/leaderboardLiveRank.ts`에 두었다(로직·시험 경로는 동일 역할).
3. **실시간 순위 데이터 범위** — 클라이언트는 `top`∪`around`만 갖고 재순위한다. 전체 보드 밖 사용자는 서버 스냅샷에 없으면 반영되지 않는다(주행 중 서버 재호출 없음 — 지시 준수).

## Chief 확인용

- 지도 대기: 우상단 「이번 주 N위」칩 → 순위판(최대 20줄·6줄 스크롤)·「전체 보기」
- 주행 중: 패널 열림 상태 유지 시 5줄·실시간 순위 칩·센서 없으면 하단 문구
- 주행 결과: 순위 줄 탭 → `LeaderboardSheet`

## 감리 (2026-10-23)

- Cursor 실행이 메모리 부족으로 강제 종료됐으나 구현·보고는 그 전에 끝나 있었다. 미실행이던 `test:e2e:ride` 는 감리가 돌렸다.
- **판정: 통과 — 감리 수정 2건.**
  1. `useLeaderboardGlance` — 숨겨진 탭에서 시작하면 `load()` 가 undefined 를 돌려 `settleUnlessCancelled(undefined)` 로 터진다 → `refresh()` 하나로 합쳐 숨김이면 부르지 않게.
  2. 주행 시작 순위 고정을 `running` 에만 걸어 일시정지→재개 때 다시 찍혔다 → `rideStatus !== "idle"`.
- 감리 재검: tsc 0 · test:quick 1353/0 · tidy 기준선 이내(exports 185) · dep 통과 · ui-800x360 12 통과 + 기존 `:84` 1 · **test:e2e:ride 7/7**.
- 캡처 3장 시안 대조: LbMap·LbRiding 일치(윤곽선 글자, 칩, 1~3위 하늘색, 내 줄 강조, 달리는 점). LbSummary 는 기존 하단 결과 시트에 한 줄로 들어감 — 결과 시트 전체 재설계는 별도 단계.
- 남은 점: 주행 직후 몇 분은 지도 칩이 서버 캐시(최대 5분) 기준 옛 순위를 보일 수 있다. 결과 시트 줄은 시작 시점 순위 + 이번 거리로 계산하므로 바로 맞다.
