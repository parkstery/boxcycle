# S2/N2: Production Hook Integration — 상태 업데이트

> ⚠ **식별자 혼동 방지**: 이 파일의 "N2" / "S2" 는 hook integration 레이어 레이블이다.  
> 이어달리기 e2e 시나리오 `RC1–RC5, RC13` / `CF-LIVE` (`apps/web/e2e/ride-continuation.spec.ts`) 와 다른 공간이다.  
> §6 원문 C1–C14 전체 매핑: `document/archive/260910-RTW-0B-CLOSEOUT-C1-C14-matrix.md`

## 완료 (N2: 2026-09-10)

N2 (`ride-result-n2-persistence.test.ts`) 가 S2 의 honest-TODO 를 해소했다.

### N2 에서 추가된 증거

- ✅ **실제 `persistRideEndCore` 경로** — hook 이 직접 호출하는 함수 (`src/lib/rideEndPersistence.ts`)
- ✅ **4개 케이스** via real `setLastRideResult` 상태 전이:
  - save reject (cascade pending→failed)
  - save null (cascade pending→failed)
  - save success + progress fail (독립 축)
  - normal save success + progress success
- ✅ **시트 문구** — `getRideSaveStatusLabel` / `getSavedRouteProgressStatusLabel` (`src/lib/rideStatusCopy.ts`)
  - `RideSummarySheet` 가 이 함수를 import 해 사용 → 어서트 = 실제 렌더 증명
- ✅ **end sample vs stale UI** — `record` (end snapshot) 의 `distanceMeters`·`sessionEndLngLat` 이 저장됨
- ✅ **지연 응답 격리** — `recordId` guard (`prev.recordId === record.id`) 증명
- ✅ **max-progress 정책** — `progressToSave = Math.max(completionRatio, prev)` 가 Firestore 에 전달됨
- ✅ **sessionEndLngLat** — `computeRideSessionAnchors` 결과가 저장 session 에 반영됨

### 생산 변경 (minimal)

- `src/lib/rideEndPersistence.ts` (신규) — async IIFE 에서 저장 커널 추출, injectable deps
- `src/lib/rideStatusCopy.ts` (신규) — 시트 문구 builder
- `src/hooks/useRideEndAndPersistence.ts` — 3 optional injectable deps 추가, `persistRideEndCore` 위임
- `src/components/ride/RideSummarySheet.tsx` — 문구를 `rideStatusCopy.ts` 에서 import

### N2 가 커버하지 않는 것 (S1 파일 담당)

- controller/hook 배선: `ride-result-s1-subscription.test.ts`
- 15s 지연 상태 + 60s 구독 종료: `ride-result-s1-timers.test.ts`
- stale callback (A→B 전환 후 A 차단): `ride-result-s1-subscription.test.ts`

### 기존 S2 파일 상태

- `ride-result-s2-real-persistence.test.ts` — inline fake 임을 명시한 주석으로 퇴역, N2 링크
- `ride-result-s2-persistence.test.ts` — placeholder/todo 그대로 (이미 honest BLOCK 표시)
- `ride-result-s2-end-snapshot.test.ts` — 동기 capture 개념 테스트 유효, 유지
- `ride-result-s2-production-imports.test.ts` — leaf helpers 유효, 유지
