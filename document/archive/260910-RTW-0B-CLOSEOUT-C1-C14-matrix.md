# RTW-0B CLOSEOUT: §6 C1–C14 원문 매핑 매트릭스

**작성일**: 2026-09-10  
**대상 브랜치**: `cursor/fix-ride-result-contract-0b-f084` (HEAD bcbd308+)  
**목적**: 작업지시서 §6의 원문 C1–C14 항목을 단일 출처로 추적해, 이어달리기 e2e RC* / CF-LIVE 식별자와의 혼동을 방지한다.

> ⚠ **식별자 분리 원칙**  
> - `C1–C14` = 이 문서의 §6 결과계약 단위 테스트 목록 (단위·통합 수준)  
> - `RC1–RC5, RC13` = `apps/web/e2e/ride-continuation.spec.ts` 이어달리기 e2e 시나리오  
> - `CF-LIVE` = 같은 e2e 파일의 CF `conquestOnRideCreated` 에뮬레이터 라이브 검증  
> 이 두 공간은 이름만 비슷하고 **다른 항목**이다. 파일 상단 주석 참조.

---

## C1–C14 매트릭스

| ID | §6 원문 의미 | Status | 증거 (테스트 파일 + 케이스) | Production 호출 | Command | 비고 |
|---|---|---|---|---|---|---|
| **C1** | local end → save response → server list re-query → 한 행, server ID 사용 가능 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C1 · F1: local end-record ↔ Firestore serverRideId link"` + `ride-result-f1-id-link.test.ts` `"로컬 끝 → 저장 → 서버 목록 재fetch → 한 행"` | `mergeRecentRideSessions` (`src/lib/rideSessionsStorage.ts`) | `npm --prefix apps/web run test:next-ride` | dedup by `serverRideId`; 서버 판이 정본 |
| **C2** | next ride 저장 중 늦은 서버 목록 도착 → 로컬 보존, false merge 없음 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C2 · F1: late server list arrival → in-flight local rows preserved"` | `mergeRecentRideSessions` | `npm --prefix apps/web run test:next-ride` | `serverRideId=null` 로컬 행 미삭제 확인 |
| **C3** | legacy 미매핑 / 계정 A→B → 추정 merge 없음; A 결과가 B에 적용되지 않음 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C3 · F1: no heuristic merge"` + `ride-result-s1-subscription.test.ts` `"late A after B does not mutate B"` + `ride-result-f4-f5-guards.test.ts` `"isRideOwnedByUser: userId 불일치 → 거부"` | `mergeRecentRideSessions`, `isRideOwnedByUser` (`src/lib/rideConquestResult.ts`) | `npm --prefix apps/web run test:next-ride` | 시간+거리 heuristic 없음; 계정 소유권 guard 별도 확인 |
| **C4** | routeDistance vs geometry length 불일치(1000 vs 980 등) → resume/anchor 동일 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C4 · F2: routeDistanceMeters ≠ geometry length"` + `ride-result-f2-card-resume.test.ts` `"CP1: 0.975 saved → card/Go both capped at 0.97"` | `computeRideSessionAnchors` (`src/lib/rideSessionAnchors.ts`), `resumeAnchorForRoute`, `resumeOffsetMetersFrom` | `npm --prefix apps/web run test:next-ride` | 불일치 fixture(geoLen≈6000, routeDist=5000)로 card/Go/anchor 일치 증명 |
| **C5** | 31%→43% 세션 → 세션 거리 offset 차감; geometry 이번 구간만 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C5 · F2: 31%→43% session"` + `ride-result-n2-persistence.test.ts` N2-3 `"saveRideSessionFn이 sessionForPersist(end sample)로 호출"` | `computeRideSessionAnchors` | `npm --prefix apps/web run test:next-ride` | sessionDistanceMeters = end − start; 전체 43%가 아님 |
| **C6** | 이전 max 43%, 재시작 끝 20% → 사실 20%, resume 후보 43%, 서버 max 유지 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C6 · F2: prior max 43%, re-ride ends 20%"` + `ride-result-n2-persistence.test.ts` N2-6 `"max-progress 정책"` | `Math.max(completionRatio, previousProgressRatio)` in `persistRideEndCore` (`src/lib/rideEndPersistence.ts`) | `npm --prefix apps/web run test:next-ride` | N2-6: 실제 `persistRideEndCore`로 0.55 전달 확인 |
| **C7** | ~0.97 / 0.98 완료 / 삭제된 경로 / geometry 없음 → 기존 정책 CTA만 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C7 · F2: 0.97 cap / 0.98 complete / deleted route / missing geometry"` + `ride-result-f2-card-resume.test.ts` `"CP1 0.97 cap"` | `ROUTE_RESUME_MAX_RATIO=0.97`, `ROUTE_COMPLETION_RATIO_THRESHOLD=0.98`, `computeRideSessionAnchors(geometry=null)→null` | `npm --prefix apps/web run test:next-ride` | geometry null → anchor null; Null Island guess 없음 |
| **C8** | Ride A conquest 대기 중 B 계정 총계 증가 → A는 A 문서까지 불변 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C8 · F3: Conquest from ride doc"` `parseConquestResult(null)=none` + `ride-result-s1-subscription.test.ts` `"late A after B does not mutate B"` | `parseConquestResult` (`src/lib/rideConquestResult.ts`), `RideConquestSubscription.activate` | `npm --prefix apps/web run test:next-ride` | per-ride conquestResult 구조(계정 총계 아님); S1-2에서 A 구독 후 B activate→A late push 무시 확인 |
| **C9** | newMeters missing/0/positive/NaN/neg/bad type → wait/0/ok/error; account-total fallback 없음 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C9 · F3: NO account total"` — absence→none, 0→confirmed\_zero, invalid type(string/null/bool)→error, positive→positive | `parseConquestResult`, `formatConquestSummaryLine` | `npm --prefix apps/web run test:next-ride` | absence ≠ confirmed\_zero ≠ error; account-total fallback 구조 없음 |
| **C10** | ride save ok+progress fail; ride save fail → 독립 상태; false complete copy 없음 | ✅ PASS | `ride-result-contract-0b.test.ts` `"C10 · F4: independent axes"` + `ride-result-n2-persistence.test.ts` N2-1 `"save reject → cascade pending→failed"`, N2-3 `"save success + progress fail → independent"` | `persistRideEndCore` → `rideSaveStatus` / `savedRouteProgressStatus` 독립 | `npm --prefix apps/web run test:next-ride` | N2 실제 production 함수 사용; 시트 문구 builder 포함 |
| **C11** | 종료→즉시 다른 경로→지연 응답 → 원래 ride에만 귀속 | ✅ PASS | `ride-result-n2-persistence.test.ts` N2-7 `"지연 응답 격리 — delayed A 완료가 active ride B를 덮어쓰지 않음"` (recordId guard) + `ride-result-contract-0b.test.ts` `"C11/C14 · F5: End snapshot frozen"` | `persistRideEndCore` → `setLastRideResult` functional update guard (`prev.recordId === record.id`) | `npm --prefix apps/web run test:next-ride` | N2-7: 실제 `persistRideEndCore` + 수동 Promise 제어; B 상태 12000m 불변 확인 |
| **C12** | close/new/계정 전환/10× open-close/15/60s/requery → ≤1 active sub; 타이머 정리; 중복 ride write 0 | ✅ PASS | `ride-result-s1-timers.test.ts` S1-3 `"15s delayed status"`, `"60s subscription end"` + `ride-result-s1-subscription.test.ts` S1-2 `"dispose then late callback: activeSubs=0"`, `"account switch"` + `ride-result-f4-f5-guards.test.ts` `"isRideIdMatch"` | `RideConquestSubscription.activate`, `dispose`, setTimeout/clearTimeout | `npm --prefix apps/web run test:next-ride` | activeSubs 0/1 전환 확인; 15s error timer; 60s unsub timer |
| **C13** | 결과 닫기→다음 주행→reload 없이 Go; prepare vs start; auth/센서 준비 | ✅ PASS | `apps/web/e2e/ride-continuation.spec.ts` **RC13** `"reload 없이 종료→카드→이어 달리기 Go 까지 완주한다"` | Full app e2e (signInAnonymously, RouteDock, HUD, `mapLoaded=true` 유지) | `npm --prefix apps/web run test:e2e:ride-continuation` (Firebase emulators required) | 7/7 PASS @ bcbd308; RC13 이름으로 등재됨 |
| **C14** | UI metric tick 사이에 종료 → 종료 샘플 거리/시간/anchor 일관성 **(CF 아님)** | ✅ PASS | `ride-result-n2-persistence.test.ts` N2-3 `"saveRideSessionFn이 end sample로 호출"`, N2-5 `"end sample vs stale UI — distanceMeters/sessionEndLngLat은 record"`, N2-6 `"max-progress 정책"` + `ride-result-contract-0b.test.ts` `"C11/C14 · F5: End snapshot frozen"` | `persistRideEndCore` (`sessionForPersist` = end snapshot); `computeRideSessionAnchors` | `npm --prefix apps/web run test:next-ride` | N2-5: record.distanceMeters=8500, sessionEndLngLat=computeRideSessionAnchors 결과로 저장 확인; stale UI 분리 증명 |

---

## 부록: CF-LIVE (이어달리기 e2e — §6 C14 와 별개)

| ID | 의미 | Status | 증거 | Production 호출 | Command | 비고 |
|---|---|---|---|---|---|---|
| **CF-LIVE** | CF `conquestOnRideCreated`가 에뮬레이터에서 `conquestResult`를 기록한다 (R5/F3 라이브) | ✅ PASS (bcbd308 기준 7/7) | `apps/web/e2e/ride-continuation.spec.ts` **CF-LIVE** `"CF conquestOnRideCreated 가 에뮬레이터에서 conquestResult 를 기록한다"` | App → Firestore `rides/{id}` 생성 → CF Functions emulator trigger → `conquestResult` 기록 | `npm --prefix apps/web run test:e2e:ride-continuation` (auth+firestore+functions emulators) | 이전 이름 C14(e2e); §6 C14(end-sample)와 다른 항목; 60s polled; BLOCK 조건 명시 |

---

## 갭 요약

| 구분 | 내용 |
|---|---|
| ✅ 단위/통합 PASS | C1–C12, C14 — `npm --prefix apps/web run test:next-ride` |
| ✅ e2e PASS | C13(RC13), CF-LIVE — 7/7 @ bcbd308 (Firebase emulators required) |
| BLOCK/TODO | 없음 — 모든 C1–C14 항목이 상기 테스트로 커버됨 |

**실행 근거**:
- `test:next-ride`는 `ride-result-contract-0b.test.ts`, `ride-result-n2-persistence.test.ts`, `ride-result-f1-id-link.test.ts`, `ride-result-s1-subscription.test.ts`, `ride-result-s1-timers.test.ts`, `ride-result-f4-f5-guards.test.ts`, `ride-result-f2-card-resume.test.ts` 를 일괄 실행한다.
- C13/CF-LIVE는 Firebase 에뮬레이터(auth+firestore+functions) 환경이 필요해 CI 단위 테스트와 분리된다.
