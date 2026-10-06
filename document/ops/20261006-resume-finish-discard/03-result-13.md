# 결과 13 — 이어 달리기 마지막 구간 완주가 폐기되는 교착

- 담당: Developer(Cursor CLI) · 지시: [02-task-13.md](02-task-13.md)
- 시각: 2026-10-06 · 커밋 **안 함**
- RideSummarySheet.* **미터치** — `lastRideResult` 를 폐기+진행 증가 시에도 채우면 거리쌍·진행률 배지가 복구됨
- 병행 11·12 허용 파일 밖 **미터치**

## 판정

**DEVELOPMENT_DONE** — 운동 기록 폐기와 저장 경로 진행 반영을 분리. 짧은 이어 달리기(≤100m)로 rides 가 폐기돼도 진행률·완주는 반영. 재현 e2e·단위·사보타주·tsc·eslint·menu-a 통과. `test:e2e:ride-continuation` 은 알려진 「열기」 헬퍼 결함으로 RC1/RC2 실패(본 변경과 무관).

## 원인 → 조치

|  قبل | 후 |
|---|---|
| `discardRecord` 이면 결과 시트 null · 진행률 낙관/persist 전부 스킵 | `resolveRideEndDisposition`: 폐기여도 `completionRatio > previous` 이면 `applySavedRouteProgress` |
| 95%→100%·22m → 영원히 95% | promote / progress update 수행 · 완주 시 카드 해제 |

## rideId 관례

폐기된 주행은 Firestore `rides` 문서가 없다. `promote` / `updateSavedRouteProgress` 의 `rideId` 는 **`""`(빈 문자열)** — `useSavedRoutesWorkspace` ad-hoc 저장 promote(`rideId ?? ""`)와 동일. `lastRideId` 에 빈 문자열이 기록될 수 있으나 진행·완주 반영이 우선.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/ride/rideRecordPolicy.ts` | `resolveRideEndDisposition` 추가(임계값 불변) |
| `apps/web/src/lib/ride/rideEndPersistence.ts` | `persistDiscardedRideSavedRouteProgress` — rides 저장 없이 진행만 |
| `apps/web/src/hooks/useRideEndAndPersistence.ts` | 폐기/반영 분기 · 결과 시트(rideSaveStatus `"n/a"`) |
| `apps/web/src/lib/ride/rideEndResult.ts` | `rideSaveStatus` 에 `"n/a"` · 주석 |
| `apps/web/scripts/ride-result/ride-end-disposition-contract.test.ts` | (a)(b)(c)(d)·사보타주 |

임시 e2e `_tmp-resume-finish-discard-13.spec.ts` 는 검증 후 **삭제**.

## 검증

| 명령 | 결과 |
|---|---|
| `cd apps/web && npx tsc -b --noEmit` | 0 |
| `node … --test scripts/ride-result/ride-end-disposition-contract.test.ts` | **6 pass** (사보타주 포함) |
| eslint 허용 파일 | 증가 0 |
| 재현 e2e `_tmp-resume-finish-discard-13` | **1 passed** (25.1s) |
| `npm run test:e2e:menu-a` | **1 passed** (13.5s) |
| `npm run test:e2e:ride-continuation` | RC1 타임아웃 → RC2: `getByRole('button',{name:'열기'}).first()` 가 센서 「열기」로 해석·모달 오버레이 가로막음 — **지시가 명시한 알려진 실패**. 그 외 본 묶음 신설 실패 없음(재현 e2e는 NextRide 카드 경로로 「열기」 미사용). |

### 재현 수치 (`shots-13/metrics.json`)

| 항목 | 값 |
|---|---|
| shortLengthM | 449.9 |
| seededProgress | 0.95 |
| remainingMApprox | 22.5 |
| 결과 시트 거리쌍 | `0.45 / 0.45` |
| completed | 1 |

### 촬영 (`shots-13/`)

- `01-resume-card-95.png` — 95% 이어 달리기 카드
- `02-summary-completed.png` — 결과 시트 거리쌍(완주)
- `03-after-close-no-resume.png` — 닫은 뒤 이어달리기 카드 없음

## 남은 이슈

- `ride-continuation` 헬퍼 `loadSavedRouteFromMenu` 의 「열기」 셀렉터는 본 묶음 범위 밖(지시 명시 알려진 실패).
- 출시 전 폐기 임계(200m·3분)는 지시대로 **변경하지 않음**.
