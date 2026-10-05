# 결과 — 칼로리 MET-gross-v1 구현

| 항목 | 내용 |
|---|---|
| 유형 | execution |
| 날짜 | 2026-10-06 |
| 지시 | [10-task-calorie-implementation.md](10-task-calorie-implementation.md) |
| Git | 커밋·push·배포 없음(지시) |

## 구현 요약

- SoT: `apps/web/src/lib/ride/caloriesEstimate.ts` — gross kcal = MET × weightKg × activeSec/3600. 거리×30 폐기.
- 활동초: 기존 conquest `pedalActiveSecRef`(cadence>0, running만). null=센서 미연결→kcal null. RPM0→0증가. 끊김→증가중단·`signalGap`.
- 체중·강도: uid별 `calorieProfileLocal` + `useCalorieProfile`. 클라우드 체중 없음. 30–300kg, MET 4/6/8. 세션 시작 스냅샷 고정.
- 저장: `caloriesEstimate: number\|null` + `caloriesMeta`(version/met/activeSec/inputMethod/estimated/signalGap, 체중 제외).
- UI: RideSettingsSheet 추정 kcal 입력. Summary「추정 N kcal」/「—」+「체중·강도 설정」. UserInfo 합계는 known만 + 미산정 N회.
- resume 슬롯 파일·nextRideTarget 로직 미변경(동시 재개 작업 보존). App/UserInfo 칼로리 부분만 추가 패치.

## 검증

| 항목 | 결과 |
|---|---|
| `70kg·30min·6MET=210` 등 pure 계약 | **PASS** — `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-calories/calories-estimate-contract.test.ts scripts/ride-stats/ride-stats-aggregate-contract.test.ts` (18 pass) |
| ride-result 계약 일부 | **PASS** — contract-0b / summary-close / f1-id-link (40 pass) |
| `tsc -p tsconfig.json --noEmit` (apps/web) | **PASS** |
| `test:entry-selectors` | **PASS** (15) |
| functions calorie 재계산 | **없음**(rg 0) — 클라이언트 값 저장만 |
| dep-layers | calorie 파일 assign 추가. 게이트는 **기존** 미등록 3파일(activity/debug)로 M0 FAIL — 본 작업 원인 아님 |
| 740×300 설정 UI 캡처 | **미실행** — Browser 인증 우회·실데이터 변경 금지 준수, 시각 검증은 Chief/로컬 확인 |
| pause/재개 offset/user切替 E2E | **미실행**(단위·배선 계약으로 대체). offset은 pedalSec·스냅샷이 세션 단위라 거리 offset과 분리 |

## 변경 파일(칼로리)

신규: `caloriesEstimate.ts`, `repo/calorieProfileLocal.ts`, `hooks/useCalorieProfile.ts`, `scripts/ride-calories/calories-estimate-contract.test.ts`

수정: `useRideEndAndPersistence`, `rideSessionsStorage`, `rideEndResult`, `rideStatsAggregate`, `firestoreRides`, `RideSettingsSheet/Panel/css`, `RideSummarySheet/css`, `UserInfoSheet/css`, `App.tsx`(칼로리 import·스냅샷·settings/summary props), `dep-layers.json`

## 잔여

- 설정 UI 실기 캡처·줄넘침 Chief 확인
- dep-layers 기존 미등록 3파일은 별도 정리
- 통계 도움말에 legacy 거리환산 vs MET-gross 문구는 최소(meta 유무·라벨「추정」) — 긴 FAQ 미추가
