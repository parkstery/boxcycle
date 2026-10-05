> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# Result — TASK-02 짧은 가시성 복귀 read burst 최소 수정 후보

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 결과** — catalog / Activity World visibility resume 가드 |
| 담당 | Cursor CLI Developer |
| 작업일 | 2026-10-03 |
| 상태 | **DEVELOPMENT_DONE** (후보 구현·검증 완료 · commit/push/merge/deploy 없음) |
| 지시 | [04-task-focus-read-fix.md](04-task-focus-read-fix.md) |
| 검수 근거 | [03-review-focus-read-audit.md](03-review-focus-read-audit.md) |

증거 클래스: **C** code · **E** emulator e2e · **U** unit/contract · **Ø** billed production reads.

---

## 1. 메타

| 항목 | 값 |
|---|---|
| Branch | `codex/focus-read-spike` |
| HEAD (시작) | `ae498b7` |
| 제품 런타임 변경 | **있음** (catalog freshness + Activity World poll resume) |
| Git | **commit / push / merge main2 / deploy / production write 없음** |

### 변경 파일

| 파일 | 역할 |
|---|---|
| `src/lib/activity/visibilityResumePolicy.ts` | 순수 정책 · `PUBLIC_CATALOG_VISIBILITY_FRESH_MS` = `ACTIVITY_WORLD_POLL_ACTIVE_MS`(60s) |
| `src/hooks/usePublicationCatalogHub.ts` | freshness skip · in-flight coalesce · force manual · 오류 시 목록 유지 |
| `src/App.tsx` | visibility → `{ reason:"visibility" }` · UI refresh → `{ force:true, reason:"manual" }` |
| `src/hooks/useActivityWorldAdaptivePoll.ts` | `pageVisible` pause · nextDue 잔여 재개 · source 계측 |
| `src/features/map-overlays/useActivityWorldDataSync.ts` | hide 시 표시 상태 보존 · in-flight coalesce · refreshNonce 유지 |
| `src/features/map-overlays/useAppMapOverlays.ts` | sync `enabled`를 `worldMapBaseEnabled`(pageVisible 제외)로 분리 |
| `src/hooks/useRouteActivity.ts` | poll API `pageVisible` 필수 인자 맞춤(호출측 기존 의미 유지) |
| `src/lib/debug/focusReadFetchMeters.ts` · `installFocusReadFetchDebug.ts` · `main.tsx` | DEV `__rtwFocusReadFetches` |
| `e2e/focus-read-visibility-audit.spec.ts` | first load / focus-only / quick resume invocation 고정 |
| `scripts/ride-hierarchy/visibility-resume-fetch-contract.test.ts` | stale·manual·retry·resume delay 계약 |

### 정책 값 (새 TTL 금지)

- Catalog visibility fresh window = **`ACTIVITY_WORLD_POLL_ACTIVE_MS` (60_000)** — active poll 주기 재사용.
- Activity World 빠른 복귀 = **숨김 전 `nextDueAtMs` 잔여**로 스케줄 재개(즉시 full sync 없음).
- Stale / 최초 / selfRide 전환 / `refreshNonce` / 오류 후 = 실제 조회 1회 허용.

---

## 2. Before / After (동일 조건 · Guest Trailhead · 무주행 · empty emulator)

조건: `RTW_DEV_PORT=5015 npm run test:e2e:focus-read-audit` · client invocation 미터(`__rtwFocusReadFetches`) · **≠ billed reads**.

| 시나리오 | Before (TASK-01 코드 경로) | After (본 후보) | 기능 표시 |
|---|---|---|---|
| First load catalog | 1 (visibility effect) | **1** | 목록 로드 |
| First load world full sync | 1 (enable immediate tick) | **1** | HUD/overlay sync |
| Focus-only (visibility 유지) | catalog/world **0** | catalog/world **0** | 변화 없음 |
| Quick hide→visible catalog | **+1** (effect 재실행) | **+0** | 최근 성공 목록 유지 |
| Quick hide→visible world | **+1** (enabled 토글 immediate) | **+0** | 최근 성공 표시 유지 · poll만 재개 |
| Repeat ×3 catalog/world Δ | 매회 +1 예상 | **[0,0,0] / [0,0,0]** | 누수 없음 |
| Underlying CG `openTotal` Δ | 0 (TASK-01) | **0** | listing/CG 정책 미변경 |
| Stale resume / manual / error retry | (코드상 매번 fetch) | 정책 **U PASS** (e2e 60s 대기는 미실행) | 허용 경로 유지 |

After 실측 산출: `apps/web/.out/firebase-traffic/focus-read-visibility-audit.json`<br>
- baseline `catalogFetchStarts=1` · `worldSyncStarts=1`<br>
- focusOnly Δ catalog/world **0/0**<br>
- hide→visible Δ catalog/world **0/0** · cg openTotal **0**

---

## 3. 검증 명령

| 명령 | 결과 |
|---|---|
| `node … --test scripts/ride-hierarchy/visibility-resume-fetch-contract.test.ts` | **PASS** 13/13 |
| `npm run test:listener-scope` | **PASS** 17/17 |
| `npx tsc -b` | **PASS** (exit 0) |
| `RTW_DEV_PORT=5015 npm run test:e2e:focus-read-audit` | **PASS** 1/1 · ~23s |
| eslint (변경 파일) | **미통과** — 기존 패턴 `react-hooks/refs`(render 중 ref.current 갱신) · hub fingerprint effect의 `set-state-in-effect`. 본 작업이 새로 도입한 규칙 위반으로 보이지 않으며, 동일 파일의 기존 관례와 동일. 신규 순수 정책·meters 파일은 해당 규칙 비대상. |

Playwright 5분 무진전 없음. 전환 규칙 미적용.

---

## 4. 비목표 준수

- Trail live peer 구독 · RTDB motion · 주행 중 전송 주기 · Firestore path/Rules/CF **미변경**
- `openTrailListings`에 pageVisible 게이트 **추가하지 않음** (계약 테스트 고정)
- commit / push / merge / deploy / production write **없음**
- 운영 ~600 billed read 전부 해결 주장 **안 함** (client invocation만 감소 확인)

---

## 5. 한계

1. 측정은 **client invocation** — billed document read 아님. empty emulator로 문서 수 절감률 주장 불가.
2. Stale(>60s)·manual UI·오류 재시도는 **unit 계약**으로 고정. e2e는 quick path 중심.
3. live Trail overlay 다수 fixture / production Console 600 귀속은 **Ø** (범위 밖).
4. Course activity(`useRouteActivity`)는 호출측이 여전히 `enabled ∧ pageVisible` — World sync만 표시 보존. Course 쪽 hide 시 상태 clear는 기존과 동일.

---

## 6. Chief 병합 결정 항목

| # | 질문 | 비고 |
|---|---|---|
| 1 | Trailhead 공개 Route 카탈로그를 **최대 60s** 동안 숨김 복귀 시 재조회하지 않아도 되는가? (수동 새로고침·stale·오류 재시도는 유지) | 신선도↔read |
| 2 | Activity World pulse/heat/HUD를 짧은 숨김 후 **남은 poll 주기까지** 캐시 표시해도 되는가? (live/selfRide·refreshNonce는 즉시) | 동일 |
| 3 | 본 spike branch 후보를 main2에 병합할 것인가? | Supervisor 검수 후 |

안전하게 계약을 만족하지 못해 BLOCKED 할 사유는 **없음** — 기존 주기 값 재사용·금지 경로 미접촉·검증 PASS.

---

## 한 줄 요약

Catalog/Activity World의 visible 복귀 중복 단발 조회를 **ACTIVE 60s / nextDue 잔여** 가드로 줄였고, e2e에서 first load=1·quick resume=+0·focus-only=0을 client invocation으로 고정했다. Chief가 신선도 정책 병합 여부를 결정하면 된다.
