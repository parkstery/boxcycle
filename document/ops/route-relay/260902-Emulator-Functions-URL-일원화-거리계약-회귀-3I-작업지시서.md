# Emulator Functions URL 일원화 · 목표 거리 계약 회귀 3I 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 긴급 결함 2건 + 단계 B 착수** |
| 최초 작성 | 2026-09-02 |
| 상태 | **즉시 실행 — §2 가 사용자 작업을 막고 있다** |
| 작업 ID | `EMULATOR-FUNCTIONS-URL-3I` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/ride-continue-r1` (현재 `f1e5148`) |
| 선행 | [3H](260902-Token-config-운영반영-및-다음작업-착수-3H-작업지시서.md) — 완료 |

## 1. 3H 검수 결과

| 항목 | 판정 | 확인 내용 |
|---|---|---|
| 3H-1 운영 config | **PASS** | `boxcycle-dc2df` 에 `config/routeTokenEconomy` **없음**(`exists: false`) → 코드 기본값 Guest 10 · 로그인 15 그대로 적용. 갱신 불필요. 조회 결과 JSON 보존 |
| 3H-2 지시서 전달 | **PASS** | `f1e5148` 로 R1·3H 문서와 README 색인 커밋 |
| 3H-3 단계 A | **PASS** | Playwright 실동작 확인 스크립트로 2회 실행, 화면 증거 8장 + report JSON 2건 |

### 1.1 단계 A 결과 — R1 §2 의 3건에 대한 답

| R1 §2 항목 | 결과 | 근거 |
|---|---|---|
| ① 자동 Route 후 `Go` 로 주행 시작 | **된다** | `goEnabled: true`, `rideRunning: true` |
| ② 「내 경로로 저장」 SavedRoute | **된다**(Emulator 한정, §2 참조) | `saveVisibleInList: true` |
| ③ 종료 후 Start | **승계되지 않는다** | `afterEnd.routeDockStops` = `S 봉은사로26길` / `E 도곡로61길` — 주행 전 Start 그대로 |

추가로 확인된 것:

- `rideSummaryOpen: false` — **주행 종료 후 결과 시트가 열리지 않는다.** 260829 §2.4 결함이 그대로 살아 있다. SavedRoute 주행·ad-hoc 주행 **양쪽 모두** `false`.
- `nextRideCardExists: false` — 다음 주행 카드 없음(예상대로).

**결론: R1 §2 의 ①②는 이미 정상이므로 다시 만들지 않는다. 끊긴 곳은 ③ 하나이며, 그 앞에 「결과 시트가 안 열린다」가 막고 있다.** 결과 시트가 다음 행동의 진입점이므로 단계 B-C 가 실질적 관문이다.

## 2. [긴급·차단] Emulator 모드에서 Cloud Functions 호출이 프로덕션으로 나간다

### 2.1 증상

`localhost:5002`(Emulator 모드)에서 주행 결과 시트의 **「내 경로로 저장」이 실패**하고 「유효하지 않은 인증 토큰입니다.」가 뜬다.

### 2.2 원인 (확정)

Emulator 모드에서는 `firebase.ts` 가 `connectAuthEmulator()` 로 **Auth 를 에뮬레이터에 붙인다.** 따라서 클라이언트가 얻는 ID token 은 **에뮬레이터가 발급**한 것이다.

그런데 일부 클라이언트는 `resolveFunctionsHttpUrl()` 을 거치지 않고 **프로덕션 URL 을 하드코딩**해 호출한다. 프로덕션 Functions 의 `verifyIdToken()` 은 에뮬레이터 토큰을 인정하지 않으므로 `unauthenticated` → 「유효하지 않은 인증 토큰입니다.」 가 된다.

| 파일 | 대상 함수 | Emulator 존중 |
|---|---|---|
| `lib/firestoreRouteToken.ts:46` | `ensureRouteTokenOnboardingHttp` | ✅ `emulatorUrl ?? …` |
| `services/distanceAutoRouteApi.ts:94` | `getDistanceAutoRoute` | ✅ |
| `services/mapboxDirections.ts:93` | `getMapboxDirections` | ✅ |
| **`lib/tierQuota.ts:98`** | **`assertTierQuotaHttp`** | ❌ — **이번 저장 실패의 직접 원인** |
| `lib/publicRouteRequests.ts:290` | `autoReviewPublicRouteRequest` | ❌ |
| `lib/subscription.ts:21` | subscription 계열 전부 | ❌ |
| `services/mapillaryImagesFetch.ts:70` | `getMapillaryImages` | ❌ |

토큰 잔액이 8개로 정상 표시되는 것과 모순되지 않는다. 온보딩·경로 생성은 ✅ 목록에 있어 에뮬레이터로 갔고, 저장 경로만 프로덕션으로 나갔다.

**이것은 3F-C-R1 의 회귀가 아니다.** 원래부터 있던 결함이 `e1f525b`(3G 의 emulator dev 모드 신설)로 **처음 드러난** 것이다. Emulator 모드가 미완성인 채로 도입됐다.

### 2.3 수정

개별 파일에 `emulatorUrl ??` 를 하나씩 덧붙이지 말고 **단일 진입점으로 일원화**한다. 지금 방식은 새 Functions 호출이 생길 때마다 같은 실수를 반복한다.

1. `lib/functionsEmulatorUrl.ts` 에 다음을 추가한다.

```ts
/** Functions HTTP 엔드포인트 URL — Emulator 모드면 자동으로 로컬을 가리킨다. */
export function functionsHttpUrl(functionName: string): string
```

   - `resolveFunctionsHttpUrl(functionName)` 이 값을 주면 그것을, 아니면 `https://${region}-${projectId}.cloudfunctions.net/${functionName}` 을 반환한다.
   - region·projectId 해석은 이 함수 한 곳에만 둔다.
2. 위 표의 ❌ 4개 파일과 ✅ 3개 파일을 **전부** `functionsHttpUrl()` 사용으로 바꾼다. ✅ 파일도 옮겨서 패턴을 하나로 만든다.
3. **재발 방지 게이트**: `functionsEmulatorUrl.ts` 밖에서 `cloudfunctions.net` 문자열이 등장하면 실패하는 정적 시험을 `apps/web/scripts/` 에 추가한다. 기존 harness 시험 패턴을 따른다.
4. `subscription.ts` 는 base URL 을 만들므로 함수명 결합 지점을 확인해 같은 helper 를 타게 한다.

### 2.4 검증

- Emulator(`localhost:5002`)에서 Guest 로 ① 자동 Route 생성 → ② 주행 → ③ 종료 후 「내 경로로 저장」 성공을 화면으로 확인한다. 저장된 경로가 「내 경로」 목록에 보여야 한다.
- 프로덕션 dev(`localhost:5000`, `VITE_USE_EMULATOR` 없음)에서도 같은 저장이 되는지 확인해 회귀가 없음을 보인다.
- §2.3-3 정적 시험이 통과하고, 일부러 `cloudfunctions.net` 을 다른 파일에 넣으면 **실패하는지** 확인한다(게이트가 실제로 작동하는지 검산).

## 3. [회귀] 목표 거리 ±5m 계약 위반 — 2회 중 1회

단계 A 두 실행의 자동 Route 응답 `distance`(목표 **5,000m**):

| runId | 응답 distance | 오차 | 3E 계약(±5m) |
|---|---:|---:|---|
| `mtjo49g9` | 4,999.055m | −0.9m | PASS |
| `mtjrdvzn` | **4,975.806m** | **−24.2m** | **FAIL** |

간헐적이므로 계약이 조건부로 깨진다.

**유력 원인**: [3F-C-R1](260902-거리방향-자동Route-실패없는-도달제안-3F-C-R1-작업지시서.md) §4 Stage 1 의 마지막 조항 — 「예산 소진 시 `f ≥ D` 인 후보가 없으면 Stage 0 의 direct Route 를 `offered` 로 반환한다」. 이 경로에서 direct Route 는 **길이가 D 보다 짧다.** 짧은 경로는 D 에서 절단할 수 없으므로 `distance < D` 인 채로 성공 반환된다.

즉 3F-C-R1 의 「실패를 없앤다」 조항이 3E 의 「목표 연장 ±5m」 계약과 충돌한다. **이 충돌은 3F-C-R1 작업지시서가 만든 것이므로 구현 책임이 아니다.** 아래로 계약을 정정한다.

### 3.1 정정된 계약

1. 새 outcome **`shortfall`** 을 추가한다. `distance < D − 5m` 로 반환되는 경우는 반드시 이 outcome 이어야 하며, `exact`·`detoured` 로 보고해서는 안 된다.
2. `shortfall` 이 나오기 **전에** 우회를 한 번 더 시도한다 — 반대 side 로 전환해 최대 4회 추가(총 12회). 실측에서 우회는 3~5회에 수렴했으므로 예산 소진은 드물어야 한다.
3. 그래도 미달이면 `shortfall` 로 반환하고 UI 에 **실수치를 명시**한다: 「목표 5.0 km 에 24 m 모자란 4.98 km 로 만들었습니다.」 조용히 짧은 경로를 성공으로 내놓지 않는다.
4. `shortfall` 도 Route 는 반환한다. 실패로 되돌리지 않는다.
5. 단위 시험: `f ≥ D` 후보를 만들 수 없는 fixture 에서 `outcome === "shortfall"` 과 고지 문구를 assert 한다. `exact`·`detoured` 는 `|distance − D| ≤ 5m` 를 assert 한다.

## 4. [정정] 단계 B 는 새로 만들지 않는다 — 이미 구현된 브랜치가 있다

**2026-09-02 브랜치 정리 중 확인**: `feat/next-ride-continuation` 에 RIDE-CONTINUE-1 이 **거의 전부 구현되어 있고 `main2` 에 병합되지 않은 채 방치**되어 있다. `main2` 기준 고유 commit 11개다.

| commit | 내용 | R1 단계 |
|---|---|---|
| `4dba881` | 이어 달리기 진행률·완주 상태 단조 보존 | **B-A** |
| `c6fb0c2` | 실제 세션 시작·종료 anchor 기록 | **B-B** |
| `746eb17` | 모든 유효 주행에 다음 출발점 결과 표시 | **B-C** |
| `d26b8b4` | 지도에 다음 주행 카드·재개 구간 표시 | 260829 §3.1 |
| `018dac6` | 마지막 종료점에서 새 경로 연결 + 최근 주행 액션 | 260829 §3.3 |
| `86a0443` | 종료→재진입 재개 Emulator 계약 시험 | 시험 |
| `4개 더` | HUD U4, 결과 시트 닫기 시 idle 복귀, 증거, 문서 | — |

보존 문서 [`document/archive/260830-next-ride-continuation-checkpoint.md`](../../archive/260830-next-ride-continuation-checkpoint.md) 기준으로 **자동 검증도 통과한 상태**다 — `test:next-ride` 40 pass, `ride-continuation` C1~C5 pass. 병합 보류 사유는 미완성이 아니라 「다음 주행 UI 추가 수정 예정」이었고, 그 뒤 거리 기반 자동 Route 작업이 우선되면서 2026-08-30 이후 멈춰 있다.

**따라서 단계 B 를 처음부터 구현하지 않는다.** R1 지시서 §3 의 「260829 §6 를 그대로 수행」은 이 사실을 모르고 쓴 것이므로 아래로 대체한다.

### 4.1 단계 B' — 기존 브랜치 통합

1. `feat/next-ride-continuation` 을 `main2`(현 `30cf14d`) 기준으로 통합한다. base 였던 8/30 시점 이후 `main2` 가 26 commit 앞서 있으므로 **충돌을 전제**한다. 겹치는 파일은 `App.tsx`·`MapView.tsx`·`RideSummarySheet.tsx`·`useRideEndAndPersistence.ts` 로, 자동 Route 작업이 같은 영역을 크게 고쳤다.
2. **rebase 하지 말고 merge 한다.** 원격에 있는 브랜치이고 11 commit 의 이력을 보존해야 한다. `feat/ride-continue-r1` 에서 `git merge feat/next-ride-continuation` 으로 받는다.
3. 충돌 해소 원칙 — **`main2` 쪽(자동 Route·Token·3I)이 최신이다.** 두 구현이 부딪치면 `main2` 의 계약을 유지하고 next-ride 쪽을 그 위에 맞춘다. 특히 다음을 깨지 않는다.
   - 자동 Route 의 `onApplyRoute` 표준 Route state 적용 경로
   - Token 1행동=1개 차감·환불
   - 3I §2 `functionsHttpUrl()` 일원화, 3I §3 `shortfall` outcome
4. 통합 직후 **단계 A 스크립트를 다시 돌려** ③ 종료점 승계와 결과 시트가 실제로 살아났는지 확인한다. `afterEnd.routeDockStops` 의 `S` 가 직전 종료점으로 바뀌고 `rideSummaryOpen: true` 가 되어야 한다.
5. 통합 결과를 **보고하고 멈춘다.** 이 시점에서 남은 gap 이 무엇인지 사용자와 확인한 뒤 단계 C 로 간다.

### 4.2 통합 후에 남는 일 (단계 C)

`feat/next-ride-continuation` 은 자동 Route 팝업이 존재하기 전에 만들어졌다. 따라서 [R1 §4](../ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md#4-단계-c--자동-route-결합-이-r1-의-신규-조항) 의 자동 Route 결합 조항은 **여전히 새 작업**이다.

- 260829 §3.3 「이 지점에서 새 경로」에서 자동 Route 팝업을 1급 진입으로 연결
- 목표 거리·이동수단 직전 값 승계
- 3회 연속 루프 e2e

### 4.3 부수

단계 A 확인 스크립트 `apps/web/scripts/ride-relay/phase-a-verify.mjs` 는 **커밋한다.** 위치를 `apps/web/scripts/ride-continue/` 로 옮긴다 — `scripts/` 하위는 기능명을 쓰고 `ride-relay` 는 문서 폴더 이름이라 혼동된다. `.out/` 산출물은 커밋하지 않는다(gitignore 확인). 통합 후 `test:next-ride`·`ride-continuation` 시험이 살아 있는지도 함께 확인한다.

## 5. commit·push 시점

[3H §5](260902-Token-config-운영반영-및-다음작업-착수-3H-작업지시서.md#5-commitpush-시점-이번-작업-이후-적용) 의 표를 유지하되 다음을 앞에 끼운다.

| 시점 | commit | push |
|---|---|---|
| §2 Emulator URL 일원화 + 정적 게이트 | 1개 | **즉시 push** |
| §3 `shortfall` 계약 정정 | 1개 | **즉시 push** |
| §4 단계 B-A·B-B·B-C | 각 1개 | B-B 에서 1차 push |

§2 를 즉시 push 하는 이유: 사용자 작업을 막고 있는 결함이고, 수정 범위가 URL 해석 한 곳으로 좁아 회귀 위험이 낮다. §3 은 서버 응답 계약 변경이라 로컬에만 두면 검증 재현이 어렵다.

두 경우 모두 `feat/ride-continue-r1` 브랜치에만 push 한다. `main2` 병합은 단계 B 완료·사용자 검수 후다.

## 6. 금지·경계

- deploy 하지 않는다.
- `main` 에 병합하지 않는다. 개발 base 는 `main2`.
- 기존 commit 을 amend·reset·rebase 하지 않는다.
- §2 를 파일마다 `emulatorUrl ??` 를 덧붙이는 방식으로 처리하지 않는다. 단일 helper + 정적 게이트가 요구사항이다.
- §3 에서 `EXACT_TARGET_DISTANCE_TOLERANCE_M` 을 키워 계약을 통과시키지 않는다. 짧으면 `shortfall` 로 정직하게 보고한다.

## 7. 프로세스 변경 — 지시서는 이 worktree 에서 직접 관리한다

지금까지 감리가 `C:\20.HDev\boxcycle` 에 지시서를 쓰고 개발팀장이 복사해 왔다. 3G 에서 route-relay 만 복사되고 ride-relay 가 누락돼 R1 착수가 하루 지연됐다.

**앞으로 감리는 이 worktree 의 `document/` 에 직접 작성한다.** 개발팀장은 자기 작업 커밋과 함께 문서를 커밋하면 되고, 복사 단계는 없어진다. `C:\20.HDev\boxcycle` 의 중복 사본은 이미 제거했다.
