# 간편 인터벌 주행 1-B — 인터벌 완료 시 종료·끝 지점에서 경로 자르기

2026-10-29 Chief 지시:
- 「간편 인터벌 주행은 사용자의 라이딩 목적이 인터벌에 특화된 주행이므로 추가적인 일반 주행을 하지 않는다.(목적지 도착하면 자른다)」
- 「현재 상태의 일반 주행 내 인터벌 시행은 그대로 유지한다.」

Supervisor Claude Code 작성. [01 지시](01-task.md)가 감리 PASS를 받은 뒤 착수한다. 실행자와 결과 파일 규칙은 01과 같다. 결과는 `02b-result-<실행자>.md`에 쓴다.

## 핵심 계약

| 주행 종류 | 인터벌 완료 시 | 저장 경로 |
|---|---|---|
| **간편 인터벌 주행** | **주행을 자동 종료한다** | 종료 지점에서 잘라 「완주」로 저장 |
| 일반 주행 + 인터벌 | **지금과 같다**: 자유 주행을 계속한다(고정 40) | 지금과 같다(계획 경로 전체 + 진행률) |

두 번째 줄을 바꾸면 FAIL이다. 간편 모드 표시가 일반 주행으로 새어 나가지 않는 것이 이 작업의 제일 중요한 조건이다.

## 확인된 부품

| 용도 | 위치 |
|---|---|
| 주행 종료(정지 버튼과 같은 경로) | `handleEndRideWithTrailCleanup` — `App.tsx`. 안에서 `handleEndRide`(`hooks/useRideEndAndPersistence.ts`)를 부른다 |
| 인터벌 완료 판정 | `useRideInterval().view.phase === "complete"` — `lib/ride/rideInterval.ts`(`RideIntervalPhase`) |
| 주행 후 저장 대상 | `LastEndedAdhocState` — `hooks/useSavedRoutesWorkspace.ts`. 채우는 곳은 **두 군데**다: `lib/ride/rideEndPersistence.ts`(`setLastEndedWasAdhoc({` 부분)와 `hooks/useRideEndAndPersistence.ts`(로컬·게스트 경로) |
| 주행 후 「경로 저장」 | `handleSaveAdhocAsUserRoute` → `resolveAdhocSaveServerAction`. `completedRoute: true`이면 `promote` 처리된다 |
| 경로 위 거리 환산 | `rideDistanceAlongRoute`(`lib/geo/routeProgressMath.ts`), `getPointOnRouteByDistance`(`lib/geo/geo.ts`). API 거리(`routeDistanceMeters`)와 선 길이가 다르므로 자를 때는 반드시 이 환산을 거친다 |
| 정복 판정 | 서버가 **실제 달린 궤적**으로 계산한다(`functions/src/conquestOnRideCreated.ts`). 경로를 잘라도 영향이 없다. 고치지 않는다 |
| Rules | 저장 경로는 `geometryCoordsJson` 문자열 길이만 검사하고, 거리와 선 모양의 일치는 검사하지 않는다(`firestore.rules` 476~479행). Rules는 고치지 않는다 |

## 동작

1. **간편 모드 표시:** 01에서 간편 경로가 적용되는 순간 「이 경로는 간편 인터벌 경로」 표시를 켠다. 표시는 App이 가진 한 곳(state 또는 ref)에 둔다. 다음 경우에 끈다:
   - 사용자가 경로를 바꿀 때: 지점 수정·다른 경로 불러오기·경로 지우기·새 거리/방향 탐색
   - 주행 종료 처리가 끝났을 때(결과 화면에서 저장 여부를 정하는 동안에는 저장 대상에 표시를 함께 실어 둔다)
   - 인터벌을 끌 때. 이때는 일반 주행으로 돌아간다

   새 저장소(localStorage·Firestore 필드)를 만들지 않는다.
2. **자동 종료:** 간편 모드이고, 주행 중(`running`)이고, 인터벌 단계가 `complete`가 되면 `handleEndRideWithTrailCleanup`을 **한 번만** 부른다. 재렌더가 일어나도 두 번 부르지 않게 막는다. 일시정지 중에는 판정하지 않는다. 인터벌 완료 응원이 종료와 함께 끊기는 것은 허용한다. 대신 결과 화면이 반드시 떠야 한다.
3. **자르기:** 간편 모드로 끝난 주행이면, `LastEndedAdhocState`를 만들 때 순수 함수 하나를 거친다. 예: `lib/ride/quickIntervalRoute.ts`의 `cutAdhocRouteAtRiddenEnd(state, riddenRouteMeters, geometryLengthMeters)`.
   - `geometry`: 출발점부터 달린 지점까지 잘라 낸 선. 끝점은 `getPointOnRouteByDistance`로 정확히 보간한 점이다
   - `endLngLat`: 그 끝점
   - `distanceMeters`: 달린 거리(API 거리 기준)
   - `durationSec`: 계획 시간 × (달린 거리 ÷ 계획 거리), 정수로 반올림
   - `waypoints`: 잘린 구간 밖의 경유지는 버린다
   - `progressRatio: 1`, `completedRoute: true`

   두 저장 지점(서버·로컬) 모두 **같은 함수**를 부른다. 같은 계산을 두 벌로 복사하지 않는다.
4. **종료 사유와 상관없이 같은 규칙:**
   - 인터벌 완료로 자동 종료되면 → 그 지점에서 자른다
   - 사용자가 중간에 직접 끝내도 → 끝낸 지점에서 자른다
   - 인터벌보다 경로가 먼저 끝나면(빠르게 달린 경우) → 지금처럼 목적지에서 멈춘다. 경로 전체가 달린 길이므로 결과는 같다
5. **짧은 주행:** 기존 폐기 기준(`isDiscardableRideRecord`)으로 기록이 버려지는 주행은 저장 대상도 만들지 않는다. 지금 동작과 같다. 새 기준을 만들지 않는다.
6. **바꾸지 않는 것:**
   - 주행 기록(rides 문서·로컬 세션)의 `routeDistanceMeters`·`completionRatio`는 계획 경로 기준 그대로 둔다
   - 저장은 지금처럼 결과 화면의 「경로 저장」 버튼으로 한다. 자동 저장하지 않는다
   - 결과 화면에 진행률이 「미완주 77%」처럼 보이면 문구는 고치지 말고 캡처와 함께 02b 결과에 보고한다. Supervisor가 Chief에게 묻는다

## 소유권·금지

- 수정 가능: `App.tsx`, `lib/ride/rideEndPersistence.ts`, `hooks/useRideEndAndPersistence.ts`, `hooks/useSavedRoutesWorkspace.ts`(타입에 표시를 실을 때만), `lib/ride/quickIntervalRoute.ts`, 필요하면 `lib/geo/`에 선 자르기 함수, 관련 시험.
- 금지: 01의 금지 전부(`functions/`·Rules·비용·동기화·저장 형식·게이트 완화·git 조작·배포). 추가로 다음을 금지한다:
  - `useRideInterval`·`rideInterval.ts`의 일반 주행 동작 변경
  - 인터벌 응원 로직(고정 40) 변경
  - 주행 기록 필드의 의미 변경
- 디자인 고정: 01의 목록과 같다. 결과 화면은 고정 50(주소 상단 행)을 포함해 바꾸지 않는다.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

1. 단위 시험 `scripts/quick-interval/quick-interval-cut.test.ts`. 확인할 것:
   - 선 중간(꼭짓점 사이)에서 잘라도 끝점이 정확히 보간된다
   - API 거리 ≠ 선 길이일 때도 환산을 거쳐 같은 지점에서 자른다
   - 0 m·전체 길이·초과 값의 경계를 처리한다
   - 잘린 구간 밖 경유지를 제거한다
   - `completedRoute: true`, `progressRatio: 1`이 된다
   - 일부러 틀린 구현(환산 생략, 끝점 보간 생략)으로 바꾸면 시험이 실패하는지 확인하고 결과에 적는다

   실행: `node --experimental-strip-types --test scripts/quick-interval/quick-interval-cut.test.ts`
2. e2e `e2e/quick-interval-end-cut.spec.ts`(1 worker, 0 retry, 함수 응답 스텁, 800×360, 인터벌을 짧은 설정으로 둔다). 시나리오:
   - (a) 간편 인터벌 → 인터벌 완료 → **자동 종료**·결과 화면 → 「경로 저장」 → 저장된 경로의 길이가 달린 거리와 같고 완주 상태
   - (b) 간편 인터벌 → 중간에 직접 종료 → 끝낸 지점에서 잘림
   - (c) **회귀:** 일반 경로 + 인터벌 켜고 완료 → 주행이 **계속된다**(자동 종료 없음), 저장 대상은 계획 경로 전체
   - (d) 간편 경로를 받은 뒤 사용자가 경로를 바꿈 → 일반 주행으로 처리됨(자동 종료 없음)

   각 시나리오를 새 evidence 폴더에 캡처하고, 시험 뒤 `git status`로 기존 증거가 덮이지 않았는지 확인한다.
3. 01에서 만든 시험, `ride-interval`·`interval-dock-confirm`·`distance-route-continuation`·주행 종료/저장 관련 기존 spec과 단위 시험을 다시 돌린다.
4. `npx tsc -b --noEmit`, 바뀐 파일 eslint, `node scripts/ride-verify/verify-selectors.mjs`, `npm run build`.
5. 같은 증상에 5분 동안 진전이 없으면 다른 경로로 바꾼다. 전체 e2e는 돌리지 않는다.

## 완료 조건

1~4가 PASS이고, (a)~(d) 캡처가 02b 결과에 경로와 함께 있어야 한다. 실폰·운영 Firebase 시험은 미실행으로 표시한다. Supervisor가 독립 검증한 뒤 Chief에게 보고하고, 고정 목록에 「간편 인터벌 주행은 인터벌 완료 시 종료·끝 지점 자르기, 일반 주행 인터벌은 고정 40 유지」 한 줄을 추가한다.
