# 결과 01 — 기존 lint 오류 15파일 36건 제거

- 담당: Developer(Cursor CLI) · 지시: [02-task-01.md](02-task-01.md)
- 작업 시각: 2026-10-07 · **커밋 안 함**
- 판정 요청: Supervisor 검수

## 요약

| 항목 | 결과 |
|---|---|
| 대상 15파일 lint error | **0** (전부 제거, 보류 없음) |
| `npx eslint src` | **0 errors · 39 warnings** (전: 36 errors · 44 warnings → warning 5건 감소) |
| `npx tsc -b --noEmit` | **exit 0** |
| 관련 `node --test` 계약 | **48 pass / 0 fail** (로더 포함 재실행) |
| e2e ride | **5 passed · 2 failed** (실패는 본 작업 무관으로 판단 — 아래) |
| e2e route-dock | **1 passed** |
| e2e account-panel | **1 passed** |

## 파일별 수정

| 파일 | 방법 | 의미 보존 근거 |
|---|---|---|
| `MenuPlaceSearch.tsx` | A(prevOpen) + B(fetchKey·resolved) | 닫힘/키 불일치 시 목록·로딩은 렌더 파생; 비동기 결과만 `setResolved`. 검색·픽 동작 동일. |
| `DebugWorldLightMap.tsx` | refs → `useLayoutEffect` | 콜백 ref 최신화만 옮김. 맵 이벤트 구독 경로 불변. |
| `useAppAuth.ts` | A(prevUser / needsSignedOutUi) + layout으로 세션 플래그·ref | 로그인 시 signed-out 해제·플래그 클리어·자동 익명 진입 조건 동일. |
| `usePublishedCoursesActivityMapOverlay.ts` | refs 맵 → state 스냅샷(bump) + A(inactive clear) | geom/bounds는 ref에 적재 후 bump로 state 복사해 렌더; 비활성 시 비움 타이밍은 렌더 동기화. |
| `useRecentRideSessions.ts` | A(prevUser) | 로그아웃 시 `[]` 비움이 effect보다 먼저; 로드·머지 로직 그대로. |
| `useRideBgm.ts` | refs → layout + immutability(로컬 `audioEl` / `audioRef.current` 재조회) | 재생·페이드·셔플·visibility 재개 경로 동일. |
| `useRideCoaching.ts` | refs → layout + A(prevRouteSig) + layout ref 리셋 | 경로 바뀌면 coach null·세그먼트 리셋; TTS/틱 로직 불변. |
| `useRideConquestResult.ts` | A(hasKey) | 키 없으면 EMPTY; 구독 activate/dispose·onResult 콜백 동일. |
| `useRouteActivity.ts` | refs → layout + A(prevEnabled) | 폴링·optimistic reload 불변; disabled 시 null 클리어. |
| `useRouteElevationProfile.ts` | B(routeSig 파생) | 무효 geometry → `empty` 반환; sig 불일치 → loading shell; 완료 시 동일 state. |
| `useRouteTokenBalance.ts` | A(active) + pending을 uid 대비 파생 | 구독·온보딩 HTTP 1회 유지; `routeTokenLoading` = pending∧balance null. |
| `useTrailInstanceMeta.ts` | B(fetchKey·resolved) | loading/meta 키 매칭으로 파생; seed fallback·rememberDisplayNumber 유지. |
| `useWorldPublicationPresenceOverlay.ts` | geom state 스냅샷 + A(enabled / noGeometryCandidates) | presence 폴링·geometry 로드·dot/line 구성 동일; epoch 제거 대신 state deps. |
| `mapDebugPhase.ts` | A(prevEnabled) | Phase B 폴링·점 표시 동일; 비활성 시 null/meta 클리어. |
| `rideConquestSubscription.ts` | `any` → `DocumentReference` / `DocumentData` | 런타임 동일; S1 구독 시험 통과. |

보류: **없음**.

## 검증 증거

### 1. `npx eslint src` (`apps/web`)

- **전**: `36 errors, 44 warnings`
- **후**: `0 errors, 39 warnings` (exit 0)
- warning 증가 없음(5건 감소 — 주로 overlayEpoch unnecessary-deps 해소).

### 2. `npx tsc -b --noEmit`

- exit **0**

### 3. 단위 계약 (`apps/web`)

명령:

```text
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test \
  scripts/ride-result/ride-result-s1-timers.test.ts \
  scripts/ride-result/ride-result-s1-subscription.test.ts \
  scripts/ride-result/ride-result-contract-0b.test.ts \
  scripts/next-ride/recent-ride-sessions-merge.test.ts
```

- **48 pass / 0 fail** (S1-2/S1-3 구독·타이머 포함).
- (참고) 로더 없이 `node --test`만 돌리면 `ERR_MODULE_NOT_FOUND` — 기존 패키지 스크립트 관례와 동일, 본 변경과 무관.

### 4. e2e

| 명령 | 결과 |
|---|---|
| `npm run test:e2e:ride` | **5 passed · 2 failed** (~1.8m) |
| `npm run test:e2e:route-dock` | **1 passed** (~26s) |
| `npm run test:e2e:account-panel` | **1 passed** (~26s) |

`test:e2e:ride` 실패 2건 (본 lint 수정과 직접 연결되지 않음으로 기록):

1. `입문 목록은 실도로 경로 3개이고 전부 0.5km 이하` — 부제 km가 **2.02** (기대 ≤0.5). 입문 seed/카탈로그 거리 데이터 이슈.
2. `입력 준비 전에는 Go 가 잠긴다` — `주행 시작`이 이미 enabled. 결정 로그(2026-09-28)의 「센서 없음 기본으로 Go 개방」과 시험 기대가 어긋난 기존 불일치 가능.

같은 스위트에서 게스트→입문 로드→running 시나리오 **5건은 통과**.

## `git diff --stat` (허용 15파일)

```text
 apps/web/src/components/MenuPlaceSearch.tsx        | 73 +++++++++++++--------
 apps/web/src/components/map/DebugWorldLightMap.tsx |  8 ++-
 apps/web/src/hooks/useAppAuth.ts                   | 26 +++++---
 .../hooks/usePublishedCoursesActivityMapOverlay.ts | 47 +++++++++-----
 apps/web/src/hooks/useRecentRideSessions.ts        | 12 ++--
 apps/web/src/hooks/useRideBgm.ts                   | 74 ++++++++++++----------
 apps/web/src/hooks/useRideCoaching.ts              | 44 ++++++++-----
 apps/web/src/hooks/useRideConquestResult.ts        | 10 ++-
 apps/web/src/hooks/useRouteActivity.ts             | 25 +++++---
 apps/web/src/hooks/useRouteElevationProfile.ts     | 23 +++----
 apps/web/src/hooks/useRouteTokenBalance.ts         | 26 +++++---
 apps/web/src/hooks/useTrailInstanceMeta.ts         | 34 +++++-----
 .../hooks/useWorldPublicationPresenceOverlay.ts    | 55 +++++++++++-----
 apps/web/src/lib/debug/mapDebugPhase.ts            |  9 ++-
 apps/web/src/lib/ride/rideConquestSubscription.ts  | 18 ++++--
 15 files changed, 307 insertions(+), 177 deletions(-)
```

## 금지 준수

- `eslint-disable` 추가·eslint 설정 변경·lint 제외: **없음**
- `git worktree` / `restore` / `checkout --` / `clean` / `stash`: **미사용**
- 커밋: **안 함**
