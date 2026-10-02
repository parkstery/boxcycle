# Result 03 — foreground 복귀 one-shot read 저감 (catalog TTL · Activity World fresh-resume)

| 항목 | 내용 |
|---|---|
| 상태 | DEVELOPMENT_DONE |
| 지시 | [10-task-resume-cache.md](10-task-resume-cache.md) · [09 검수](09-review-visibility-meter-rework.md) |
| 날짜 | 2026-10-03 |
| Owner | Cursor CLI Developer |
| 제약 | production 접속·write·deploy·commit·push 없음. world `trailLiveRides` listener 정책 미변경 |

---

## 결론 요약

hidden→visible ×10(settle 직후)에서 actual network proxy 목표가 달성됐다.

| path | before (08 baseline) | after (본 측정) |
|---|---|---|
| `catalogPublications` | 10 | **0** |
| `activityWorldSummary` | 10 | **0** |
| `activityWorldGlobal` | 10 | **0** |
| `activityWorldRouteActivityGetDoc` | 0 | **0** (증가 없음) |

control ×0 유지. N=3 `trailLiveRides` **30/30** 유지(이번 단계에서 정책 변경 없음 — 기대대로 open/close 반복).

---

## 구현

### A. Published catalog (5분 TTL)

- 순수 정책: `lib/route/publishedCatalogRefreshPolicy.ts`
  - 성공 freshness TTL `PUBLISHED_CATALOG_TTL_MS = 5min`
  - `force` 우회, 초기/실패(null success)는 즉시 fetch
  - `createInflightDeduper` 로 동시 자동 refresh 합침
- `usePublicationCatalogHub.refreshPublishedPublicCourseCatalog({ force? })`
  - 자동(visibility) 호출은 TTL 안이면 Firestore 미호출
  - 메뉴 등 명시적 새로고침은 `App` → `{ force: true }`
  - 실패는 lastSuccess 미갱신; 직전 성공 rows 유지

### B. Activity World fresh-resume

- 순수 정책: `lib/activity/activityWorldResumePolicy.ts`
  - 마지막 성공 sync 가 현재 adaptive interval(active 60s / idle 10m) 안이면 `schedule(remaining)`
  - 초기·stale·force → immediate
- `useActivityWorldDataSync`
  - `enabled` = eligibility(pageVisible 제외) — hide 동안 성공 결과 보존
  - `pageVisible` 로 poll만 게이트
  - logout/config/debug isolation 등으로 eligibility 상실 시 stale clear
  - `refreshNonce` force는 기존처럼 즉시 sync
- `useActivityWorldAdaptivePoll` — `getLastSuccessAtMs` 있으면 resume plan 적용
- `useAppMapOverlays` — `activityWorldEligible` 분리, externalSync도 eligibility 기준

### 비목표 준수

- world `trailLiveRides` × N visibility 정책 변경 없음
- Rules/schema/Functions/RTDB/경로·poll 상수 변경 없음
- production deploy 없음

---

## 변경 파일

| 경로 | 내용 |
|---|---|
| `src/lib/route/publishedCatalogRefreshPolicy.ts` | catalog TTL·inflight 순수 정책 (신규) |
| `src/lib/activity/activityWorldResumePolicy.ts` | resume schedule/immediate 순수 정책 (신규) |
| `src/hooks/usePublicationCatalogHub.ts` | TTL cache + inflight + force |
| `src/hooks/useActivityWorldAdaptivePoll.ts` | fresh resume schedule |
| `src/features/map-overlays/useActivityWorldDataSync.ts` | eligibility vs visibility · lastSuccess |
| `src/features/map-overlays/useAppMapOverlays.ts` | eligible 분리 |
| `src/App.tsx` | 명시적 catalog refresh `force: true` |
| `dep-layers.json` | 신규 정책 파일 등재 |
| `scripts/focus-read-spike/resume-cache-policy.test.ts` | 정책 순수 테스트 (신규) |
| `scripts/focus-read-spike/visibility-gate-contract.test.ts` | force·eligible 계약 추가 |
| `e2e/focus-read-spike.spec.ts` | ×10 목표 0 assert · cycle wait 강화 |
| `package.json` | `test:focus-read-spike` 에 policy test 포함 |

---

## 전후 측정 (Emulator E2E)

Artifact: `apps/web/.out/focus-read-spike/visibility-e2e-delta.json` · `visibility-e2e-n3-delta.json`

### Baseline ×10 (N≈0)

| 경로 | class | ×10 Δ |
|---|---|---|
| trailMembers | app_resubscribe | 10/10 |
| trailLiveRides | — | 0/0 |
| kept (listing/CG/users/economy/conquest) | kept | 0 |
| catalogPublications | network | **0** |
| activityWorldSummary / Global | network | **0** |
| activityWorldBatchInvocation | invocation | **0** |
| activityWorldRouteActivityGetDoc | network | **0** |
| trailPresenceWrites | write proxy | 10 |
| control ×0 | — | 전부 0 |

### N=3 seed ×10

| 경로 | ×10 Δ |
|---|---|
| trailLiveRides | **30 / 30** |
| trailMembers | 10 / 10 |
| catalog / Activity World one-shots | **0** (fresh-resume) |

---

## 검증

| 명령 | 결과 |
|---|---|
| `npm run test:focus-read-spike` | **PASS** 27/27 (정책 12 + 기존 meters/gate/harness) |
| `npm run test:s42-meters` | **PASS** 15/15 |
| `npm run check:dep` (repo root) | **PASS** |
| `npx tsc -p tsconfig.json --noEmit` | **PASS** |
| `npx eslint` (변경 파일) | **PASS** (기존 useAppMapOverlays exhaustive-deps warning만) |
| `$env:RTW_DEV_PORT='5015'; npm run test:e2e:focus-read-spike` | **PASS** 2/2 |

---

## Git

지시대로 **commit / push / deploy / production 접속 없음**.

---

## 다음 (Supervisor)

- 검수 후 world `trailLiveRides × N` visibility grace는 **별도 단계**로 진행 (09 우선순위 3).
