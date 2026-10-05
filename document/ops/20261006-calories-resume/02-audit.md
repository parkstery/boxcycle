# 조사 — 칼로리 경로 · 단일 이어달리기 슬롯

| 항목 | 내용 |
|---|---|
| 유형 | execution — 읽기 전용 |
| 날짜 | 2026-10-06 |
| 범위 | `01-task-audit.md` 3항. 앱코드 미변경. 칼로리 구현 없음 |
| 재사용 | [20261005 …/02-result-and-proposal.md](../20261005-product-value-name-calories/02-result-and-proposal.md) calorie 절 |

## 1. Calorie 경로 (제안만)

| 단계 | 근거 | 사실 |
|---|---|---|
| 계산 | `useRideEndAndPersistence.ts:151–161`, `App.tsx:2370` | `round((sessionDistanceMeters/1000)*30)`. offset 제외 세션 거리만 |
| 시간 | `useVirtualRideSession.ts:90–118` | `elapsedSec`=`accumulatedMs` — **running일 때만** 증가(pause면 RAF 정지 → pause 제외에 가깝다). 칼로리에 미사용 |
| 페달 활성 | `App.tsx:1020–1038` → conquest `pedalSec`만 | cadence rpm>0 초. 칼로리 미사용 |
| 체중 | — | **미수집** (users 프로필에 weight 없음) |
| power/HR | — | **미수집**. cadence→가상속도만 (`cadenceRideInput.ts:16–29`, 고정 0.32) |
| 저장 | `rideSessionsStorage` · `firestoreRides.ts:164/246` | `caloriesEstimate` 그대로 |
| 집계 | `rideStatsAggregate.ts:115–124` | 기간 합산. **서버 재계산 없음**(functions에 calorie 없음) |
| UI | `RideSummarySheet.tsx:299`, `UserInfoSheet` | 표시만 |

개선 후보(구현 범위 밖): 체중(선택)+활동시간(running/pedal 정책 확정)+stationary MET. power는 **실측 watts 있을 때만** 후속. HR/RPM/virtualSpeed를 실강도 MET로 쓰지 말 것(기존 제안과 동일).

## 2. 이어달리기 — 경로·eligibility (file:line)

### 진입

| 경로 | 배선 |
|---|---|
| 다음 카드 | `resolveNextRideView` → `handleResumeNextRide` → `handleResumeSavedRouteById` → `handleLoadSavedRoute` (`App.tsx:1749–1857`, `nextRideTarget.ts:100–138`) |
| 내 경로 load | `onSavedRouteRideEntry` → `setResumeCandidateId(route.id)` (`App.tsx:607–610`) |
| 최근 주행 | `resolveRecentRideActions` → `resumeRouteId` (`nextRideTarget.ts:151–169`) |
| Go | `resumeRatio` + `resumeOffsetMetersFrom` (`App.tsx:1271–1305`, `rideRecordPolicy.ts:47–55`) |

### Eligibility / 수치

| 규칙 | 값 | 근거 |
|---|---|---|
| 완주 | ≥ **0.98** | `ROUTE_COMPLETION_RATIO_THRESHOLD` `rideRecordPolicy.ts:33–37` |
| 재개 오프셋 상한 | **0.97** | `ROUTE_RESUME_MAX_RATIO` · `resumeOffsetMetersFrom` `:44–55` |
| 재개 가능 진행 | `0 < lastProgressRatio < 0.98` · `completed≠1` · geometry anchor 가능 | `App.tsx:1275–1278`, `nextRideTarget.ts:109–125` |
| record 폐기 | ≤100m **또는** ≤5s | `isDiscardableRideRecord` `:21–26` — 폐기면 로컬/카드 후보에 안 남음 |
| progress 진실 | **SavedRoute.lastProgressRatio**(단조 max) | `savedRouteProgressPolicy.ts:39–51`, `firestoreSavedRoutes.ts:544–576` transaction |
| TTL | 미완주 **90일** `expiresAt`; 완주 `null` | `firestoreSavedRoutes.ts:31–36,537–538` |
| ownership | `savedRoutes.userId==uid` 로드; Guest는 local (`savedRoutesLocal`) | load `firestoreSavedRoutes.ts:587–595` |
| history 한도 | recent merge **50** | `rideSessionsStorage.ts:72–76`, end `useRideEndAndPersistence.ts:290` |
| 카드 dismiss | `nextRideDismissedRideId` **세션 state만** | `App.tsx:387,1765` — progress 삭제 아님 |
| 종료 갱신 | `progressToSave=max(completion, previous)`; ≥0.98면 promote | `useRideEndAndPersistence.ts:200–211` |

문서 주석 명시: v1은 `users/{uid}.nextRide` pointer **없음** — Ride+SavedRoute **파생** (`nextRideTarget.ts:10–11`).

### 「후보 소실」구분

| 현상 | 실제 | 근거 |
|---|---|---|
| B를 탄 뒤 카드가 B/연장만 보임 | A의 `lastProgressRatio`는 유지. 카드는 **최신 유효 Ride 순** 1개만 파생 → A 안내 배선 소실 | `nextRideTarget.ts:104–127` |
| 카드 닫기·앱 재시작 | dismiss는 메모리; 재시작 시 파생 재계산. progress 유지 | `App.tsx:1765` |
| A 관련 Ride가 50건에서 eviction | 카드/최근행 재개 CTA 소실 가능. SavedRoute progress는 남음(TTL·삭제 전) | sessions 50 + 파생 루프 |
| 삭제·완주·TTL·geometry 불능 | **진행/기회 자체 무효** | completed/TTL/anchor null |
| 로드만 하고 Go 전 다른 경로 로드 | `resumeCandidateId`가 새 경로로 교체; A progress는 DB에 잔존 | `App.tsx:607–610` |

→ Chief 정책(B 타도 A 유지·슬롯1)과 **현행 파생 모델이 불일치**. 대부분 「progress 삭제」가 아니라 「단일 파생 안내/로드 배선」 문제.

## 3. 단일 슬롯 — Supervisor용 최소안

**현황 갭:** sticky slot·포기 tombstone 없음. 파생=최신 Ride 우선이라 B 주행이 A 카드를 밀어냄. 2슬롯 금지·자동덮어쓰기 금지는 데이터 모델로 강제되지 않음.

**최소 저장 후보(1안):** `users/{uid}` optional 필드 하나.

```
continueSlot?: {
  routeId: string;
  /** 명시 포기 시에만 set — 재부트스트랩 억제 */
  abandonedAt?: string | null;
}
```

| 질문 | 조사 결과 |
|---|---|
| users 쓰기 | self update 허용, routeToken/tier 보호 필드만 금지 (`firestore.rules:154–170`) — optional pointer는 규칙 추가 없이 merge 가능 **추정**(필드명 whitelist 없음) |
| 구독 | 전역 `users` onSnapshot 상시 구독 없음. nickname/tier는 get 위주 (`firestoreUser.ts`) — pointer는 **필요 시 get/merge write**로 충분, 비용 작음 |
| schema | `buildUserProfileWrite`에 route 필드 없음 — 새 optional은 백엔드 CF 스키마 강제 없음(클라이언트 merge) |
| SavedRoute에 두기 | progress는 이미 route별. 「사용자당 1슬롯」은 user-level pointer가 맞음 |
| client-only(localStorage) | **한계 필수 표기:** 타기기 불일치 · Guest↔로그인 · history eviction과 동일 계열 실패 · 정책 enforc 불가 |

**동작(설계 판정용, 구현 금지):**

1. Bootstrap: 활성 slot 없고 abandoned 아니면 — 미완주(`0<progress<0.98`) SavedRoute 중 **관련성 최신 1개**(예: lastRide/updatedAt)만 seed. **자동 교체 금지**.
2. B 선택/주행/카드 닫기/앱 재시작 → slot 유지(포기 아님).
3. 해제: 명시 「이어달리기 종료/포기」(tombstone) · 해당 경로 완주 · 삭제 · 무효(TTL/geometry)만.
4. 「처음부터」= 이번 회차 restart(`fromStart`) — 포기 버튼과 분리 (`App.tsx:1296–1305` 기존 restart와 정렬).
5. 카드·최근주행·공용 재개 함수는 **slot.routeId만** resume CTA. enforcement 범위·데이터모델 의미 변경은 Supervisor/Chief 판정.

**필요 결정만**

1. pointer를 `users` vs 전용 1-doc — 비용·Rules 단순함은 users optional이 최소.
2. Guest: 로컬 slot vs 로그인 후만 sticky — client-only 한계 수용 여부.
3. Bootstrap 정렬키(lastRideId vs updatedAt)와 abandoned TTL 유무.

## 범위 / 테스트 추천 (구현 전)

- **In:** 슬롯 정책 설계 확정·배선(카드/최근/Go)이 파생→slot을 보도록 바꾸는 범위는 Supervisor 지시 후.
- **Out:** 칼로리 수식 변경, 새 architecture 독단, 다슬롯.

기존 검증(재실행 권장, 이번 미실행):

- `apps/web/scripts/ride-result/ride-result-f2-card-resume.test.ts` (0.97 공유)
- `apps/web/scripts/ride-result/ride-result-n2-persistence.test.ts` (progress 실패 축)
- `apps/web/e2e/ride-continuation.spec.ts`
- 단위: `nextRideTarget` / `savedRouteProgressPolicy` / `resumeOffsetMetersFrom` — slot 도입 시 **파생→slot** 케이스 추가 필요

## 완료

3항 근거·file:line·최소안1+결정3·테스트 추천 충족. 코드 변경 없음.
