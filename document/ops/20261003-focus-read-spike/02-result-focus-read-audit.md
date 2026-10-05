> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# Result — TASK-01 포커스 복귀 read 급증 원인 감사·재현

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 결과** — TASK-01 audit + emulator 재현 |
| 담당 | Cursor CLI Developer |
| 작업일 | 2026-10-03 |
| 상태 | **DONE** (제품 런타임 미수정 · commit/push/deploy 없음) |
| 지시 | [01-task-focus-read-audit.md](01-task-focus-read-audit.md) |
| 연결 | [README](README.md) · [brief](00-brief.md) · 이전 [followup audit](../20261002-public-trail-traffic-followup/02-result-remaining-opportunity-audit.md) · [merge 검수](../20261002-public-trail-traffic-followup/12-review-merge-main2.md) |

증거 클래스: **C** code/static · **E** emulator · **H** harness · **P** production console · **L** human/Chief · **Ø** not measured.

---

## 1. 메타

| 항목 | 값 |
|---|---|
| Branch | `codex/focus-read-spike` |
| HEAD (시작·종료) | `ae498b7e14d79dc20ad2fa34bce94e6daef5f497` (`ae498b7 docs(ops): approve main2 traffic followup merge`) |
| Dirty (시작) | ops 문서만 (`PROGRESS.md`·`README.md` modified · 본 묶음 untracked) |
| Dirty (종료) | 위 + 진단 e2e·`package.json` script + 본 결과 md (**제품 런타임 소스 무변경**) |
| 제품 런타임 변경 | **없음** |

### 읽은 문서·코드

1. `document/ops/README.md` · `PROGRESS.md`
2. 본 묶음 README · `00-brief.md` · `01-task-…`
3. `20261002-public-trail-traffic-followup/02-result-remaining-opportunity-audit.md` · `12-review-merge-main2.md`
4. `apps/web/e2e/listener-scope-ride.spec.ts` · `apps/web/src/lib/debug/readSubscriptionMeters.ts` · `installReadSubscriptionDebug.ts`
5. `useDocumentVisibility` 소비자·`listenerScopePolicy`·catalog/world poll 경로 (아래 §2)

### 실행한 검증

| 명령 | 결과 |
|---|---|
| `git status` / `git rev-parse HEAD` / `git log -1` | HEAD `ae498b7` · 제품 clean |
| `npm install` (worktree 의존성 부재로 설치) | 성공 (로컬 env) |
| `RTW_DEV_PORT=5015 npm run test:e2e:focus-read-audit` | **PASS** 1/1 · ~53s · 산출 `apps/web/.out/firebase-traffic/focus-read-visibility-audit.json` |

실패·전환: 첫 시도 `playwright` PATH 없음 → script를 `npx playwright`로 수정. 포트 5000 점유 → `RTW_DEV_PORT=5015`. 5분 무진전 대기 없음.

진단 전용 추가(제품 런타임 아님):

- `apps/web/e2e/focus-read-visibility-audit.spec.ts`
- `apps/web/package.json` → `test:e2e:focus-read-audit`

---

## 2. 경로 지도 (HEAD `ae498b7`)

### 2.1 가시성 훅

| 경로 | path:line | 역할 |
|---|---|---|
| `useDocumentVisibility` | `apps/web/src/hooks/useDocumentVisibility.ts:4–16` | `visibilitychange`만. **`window.focus` / `pageshow` 없음** |
| App 소비 | `App.tsx:410` → overlays·trail·catalog·global presence·publish | `pageVisible` |
| PublicationSharedPresence | `PublicationSharedPresence.tsx:105` · effects `:165–379` | session / FS live rides / RTDB motion / heartbeat 전부 `pageVisible` 게이트 |
| BLE / BGM | `useBleCrankRpm.ts` (pageshow+visibility) · `useRideBgm.ts` | Firestore 읽기와 무관 |

**결론(C):** 앱의 Firestore 구독·카탈로그 재조회는 **`document.visibilityState`에만** 묶여 있다. 순수 focus는 코드 경로가 없다.

### 2.2 숨김(`pageVisible=false`)에서 의도적으로 내려가는 것

| 대상 | 게이트 | path:line |
|---|---|---|
| Trail 멤버 onSnapshot + presence upsert/heartbeat | `useTrailSession` | `useTrailSession.ts:50–96` · App `:817–822` |
| Publication session members / live rides / RTDB motion | PSP | `PublicationSharedPresence.tsx:160–345` |
| Active live-ride CG consumer (`useActiveLiveRideTrailIds`) | `listenerScopePolicy` + overlay | `listenerScopePolicy.ts:38–47` · `useAppMapOverlays.ts:173–180` |
| World livePublicationRides overlay (Trail당 hub) | policy | `listenerScopePolicy.ts:60–68` · `useAppMapOverlays.ts:306–321` · overlay `:103–140` |
| Activity World adaptive poll (단발 getDoc 배치) | `worldMapActivityEnabled` | `useAppMapOverlays.ts:243–261` · `useActivityWorldDataSync.ts:117–147` · poll immediate tick `useActivityWorldAdaptivePoll.ts:84` |
| Course activity poll | `courseActivityEnabled` | `useAppMapOverlays.ts:151–163` |
| Trail spectator overlay | enabled∧`pageVisible` | `useAppMapOverlays.ts:208–215` |
| Global live presence subscribe/publish · live publish session | App | `App.tsx:1504–1528` · `useLiveLocationPublishSession.ts:259+` |

### 2.3 숨김에도 **유지**되는 것 (중요)

| 대상 | 이유 | path:line |
|---|---|---|
| `openTrailListings` onSnapshot | `resolveOpenTrailsListenerEnabled`에 **`pageVisible` 없음** | `listenerScopePolicy.ts:18–26` · `App.tsx:781–789` · `useOpenTrails.ts:105–151` |
| Active live-ride CG **underlying** | `useOpenTrails`가 같은 hub를 잡아 refCount≥1 유지 | hub `activeLiveRideTrailIdsSubscriptionHub.ts:53–75` |

→ Trailhead idle에서 탭을 숨겨도 **CG underlying은 안 끊긴다**. `useActiveLiveRideTrailIds` consumer만 빠졌다가 복귀 시 다시 붙는다(초기 스냅샷 재청구 없음, hub가 캐시 fan-out).

### 2.4 복귀(`pageVisible=true`)에서 발행되는 단발 조회

| 호출 | 내용 | path:line |
|---|---|---|
| `refreshPublishedPublicCourseCatalog` | effect가 visible마다 실행 | `App.tsx:947–951` · hub `usePublicationCatalogHub.ts:90–113` |
| → `listPublishedPublicCourses(..., 50)` | `getDocs` published ≤50 | `firestoreCourses.ts:146–159` · `firestoreRoutePublications.ts:147–154` |
| → `getUserPublicLabelsByUid` | applicant uid당 `getDoc(users/…)` | `firestoreUser.ts:78–105` |
| Activity World `runFullSync` | enable 시 **즉시 1 tick** | `useActivityWorldAdaptivePoll.ts:84` · sync `useActivityWorldDataSync.ts:75–86` |
| → batch | `fetchWorldPresenceSummary` · `fetchWorldActivityGlobal` · `fetchLiveRouteActivityIds` · `fetchRouteActivitiesBatch(ids)` (id당 `getDoc`) | `firestoreRouteActivity.ts:249–258` 등 |

### 2.5 미터 커버리지 한계 (**E/C**)

`__rtwReadSubs()` / `readSubscriptionMeters`가 세는 것:

- `trailOnSnapshot` = livePublicationRides 구독만
- `collectionGroup` = active live-ride CG만
- `rtdbOnValue` = trail motion만

**세지 않음:** `openTrailListings` onSnapshot · Trail/Publication session members · 모든 `getDoc`/`getDocs`(카탈로그·Activity World·enrich).<br>
따라서 미터 `openTotal` 변화 없음 ≠ billed read 0.

---

## 3. 재현 결과 (E · Guest Trailhead · 무주행)

조건: 로컬 emulator only · headless · workers=1 · Guest 익명 인증 후 Trailhead idle · 주행 없음 · 빈 emulator 데이터.

산출: `apps/web/.out/firebase-traffic/focus-read-visibility-audit.json`

### 3.1 Baseline (visible)

| 항목 | 값 |
|---|---|
| `collectionGroup.open` | **1** (`openTotal=1`) |
| `trailOnSnapshot.open` | **0** (live Trail 없음 → world overlay 구독 0) |
| `rtdbOnValue.open` | **0** |
| `cgHub` | refCount **2** / consumers **2** / underlyingOpen true (`useOpenTrails` + `useActiveLiveRideTrailIds`) |
| `ridesHub.slotCount` | 0 |
| crossCheck.ok | true |

### 3.2 (a) focus / pageshow · visibility 유지

| 지표 | Δ |
|---|---|
| trail/cg/rtdb `openTotal` | **0 / 0 / 0** |
| visibilityState | 계속 `visible` |
| 조잡 emulatorReq Δ | +8 (노이즈 가능 · ≠ billed · listener 재개와 무관) |

**판정(E):** 가시성 불변 focus만으로는 **tracked underlying 재구독이 없다**.

### 3.3 (b) hidden → visible 1회

| 시점 | cg.open | cgHub.refCount | cgHub.acquireTotal | trail.open | underlying openTotal Δ |
|---|---:|---:|---:|---:|---|
| before hide | 1 | 2 | 2 | 0 | — |
| hidden | 1 | **1** | 2 | 0 | 0 (underlying 유지) |
| after visible | 1 | **2** | **3** | 0 | **0** |

- hidden 중 `useActiveLiveRideTrailIds` consumer release(refCount 2→1), underlying은 `useOpenTrails`가 유지 → **CG 초기 스냅샷 재청구 없음(E)**.
- Vite 로그에 `pageVisible:false` 관측 → App 게이트 동작 확인(E/C).
- 빈 emulator에서는 trail overlay 재구독·카탈로그 대량 getDocs가 없어 **~600 reads를 숫자로 재현하지 못함**.

### 3.4 (c) 반복 ×3

| 항목 | 결과 |
|---|---|
| `trailOnSnapshot.open` after each | `[0,0,0]` — **누수 없음** |
| `collectionGroup.open` | 계속 1 |
| cgHub acquire/release | 6 / 4 (consumer 재획득만; `unsubCallTotal=0`) |
| crossCheck | 전 샘플 ok |

**판정(E):** 이 시나리오에서 hub cleanup 누락으로 underlying이 쌓이는 증거 **없음**.

---

## 4. Brief 후보별 판정

| # | 후보 | 판정 | 근거 |
|---|---|---|---|
| 1 | 숨김→표시로 의도 해제된 리스너 재구독 + initial query | **부분 확정(C+E)** / 규모는 데이터 의존(**Ø billed**) | 다수 경로가 `pageVisible`로 unsub/resub(C). Trailhead에서 CG underlying은 유지되어 CG 재청구는 없음(E). **live Trail이 있는 환경**에서는 world overlay가 Trail당 `trailOnSnapshot`을 닫았다 다시 열어 initial query 가능(C · 본 E는 Trail 0이라 미관측). |
| 2 | 포커스/가시성 복귀 단발 조회 반복 | **가시성 복귀: 코드 확정(C)** · focus-only: **반박(C+E)** · production 건수 **Ø** | `App.tsx:947–951` catalog refresh + Activity World immediate tick(C). focus-only는 경로·미터 모두 무재구독(E). empty emulator라 getDocs 규모 미측정. |
| 3 | effect/hub cleanup 실패로 underlying 중복 | **본 시나리오 반박(E)** | open 불변 · crossCheck ok · 반복 후 open 비증가. listing/session 등 미터 밖 리스너는 **Ø**. |
| 4 | 다른 클라이언트·프로젝트 전체 집계 | **미측정(Ø)** · Console 한계는 brief와 동일 | 분단위·프로젝트 전체·다 탭 가능. 본 1창 E로 대체 금지. |

Chief **L**(포커스 복귀 ~600 reads): “포커스”가 OS 창 전환이어도 브라우저가 `hidden→visible`이면 후보 1+2가 동시에 탄다. **순수 focus(가시성 유지)** 만으로는 앱 코드가 폭주하지 않는다(C+E). Console 600을 한 창·한 원인으로 확정하지 않음.

---

## 5. 프로젝트 전체 그래프 한계 (재확인)

- Firestore usage dashboard ≠ exact billed ops · 분단위 표본(brief·Firebase docs).
- 다 탭/다 세션이 같은 그래프에 합쳐질 수 있음.
- 클라이언트 미터·emulator callback·production billed를 **한 표에 섞지 않음**.
- 이전 followup 병합분은 측정 도구만 · 앱 런타임 무변경 → 피크 감소 귀속 금지([12-review](../20261002-public-trail-traffic-followup/12-review-merge-main2.md)).

---

## 6. 최소 수정안 제안 (구현 안 함)

우선순위 · 안전 게이트 · Chief 여부.

| 순위 | 안 | 요지 | 기능 위험 | 회귀 게이트 | Chief |
|---|---|---|---|---|---|
| 1 | Catalog refresh TTL/가드 | `pageVisible` true마다 `refreshPublishedPublicCourseCatalog` 금지. mount·수동·stale(예: ≥N분)만 | Trailhead 퍼블릭 목록 신선도↓ | 카탈로그 표시 e2e/수동 · Rules 공개 read 유지 | **예** — 신선도↔비용 |
| 2 | Activity World poll resume | hidden→visible에서 `enabled` 토글로 **즉시 full sync** 대신 타이머 재개 또는 TTL 내 캐시 유지 | 월드 pulse/heat 복귀 지연 | WO poll 계약 · map overlay 육안/계약 | **예** — 동일 트레이드오프 |
| 3 | World live overlay 재구독 완화 | 짧은 hide에서는 Trail당 hub를 유지하거나 debounce 후 해제 | 백그라운드 리스너 비용↑ vs 복귀 burst↓ | `listener-scope` + focus-read audit 확장(라이브 Trail fixture) | **예** — 구독 정책 의미 |
| 4 | 미터 확장(진단) | getDocs/catalog/world sync DEV 카운터 | 없음(DEV) | `test:s42-meters` | 아니오 |
| — | 숨김 시 listing/CG까지 일괄 해제 | **비권장(현 단계)** — 복귀 시 CG initial이 **더** 커질 수 있음 | listing 공백·복귀 burst↑ | — | 사실상 정책 변경 → **예** |
| — | onSnapshot→getDocs 일괄 대체 | 지시 금지 · 원인 미확정 | 실시간성 붕괴 | — | 해당 시 **예** |

**600 reads 규모 가설(C, 미청구 확정 아님):**<br>
`≤50` catalog docs + 최대 ~50 user `getDoc` + Activity World batch(기본 허브·퍼블릭·open/live publication id 합) + (production에 live Trail이 많으면) Trail당 livePublicationRides initial + 미터 밖 session/listing. 빈 emulator Trailhead는 이 합이 작아 **숫자 재현 실패는 환경 한계**이지 후보 2 부정은 아님.

---

## 7. Chief 결정 필요 여부

| 질문 | 필요한가 |
|---|---|
| 포커스/가시성 복귀 시 카탈로그·월드 활동 **신선도 vs read 비용** 기본 정책 | **예** — 안 1·2 구현 전 |
| 짧은 백그라운드에서 world/peer 구독 유지 여부 | **예** — 안 3 |
| production Console quiet/solo 창으로 600의 귀속 재확인 | 관측 승인 수준 · 구조 변경 전 권장 |
| 현재 Trail peer liveness / 전송 주기 변경 | **이 묶음에서 열지 말 것**(지시 금지) |

기능 의미·구독 정책을 크게 바꾸지 않는 **버그성 누수**는 본 E에서 보이지 않음 → “중복 리스너 즉시 패치” 근거 부족.

---

## 8. 범위 밖 발견 (기록만)

1. worktree에 `node_modules`가 없어 `npm install` 필요했음 · `firebase emulators:exec` 환경에서 bare `playwright` PATH 실패 → 진단 script만 `npx` 사용(기존 listener-scope script는 미수정).
2. `openTrailListings` onSnapshot은 `readSubscriptionMeters` 밖 — visibility audit만으로 listing 누수/재청구를 닫을 수 없음.
3. 주행 중·dedicated Trail·다수 live Trail fixture에서의 hide→visible은 **미실행**(지시 우선: 무주행 Guest/Trailhead). 후보 1의 대규모 initial query는 그 확장 E가 필요.
4. emulatorReq 카운터는 WebChannel/잡음에 민감 — billed proxy로 쓰지 말 것.

---

## 9. 비목표 준수

- 제품 런타임 · Functions · Rules · schema · peer liveness/전송 주기 **변경 없음**
- production write · deploy · push · commit **없음**
- 원인 미확정 상태에서 onSnapshot 일괄 대체·숨김 구독 전체 해제 **없음**

---

## 한 줄 요약

가시성 복귀는 **의도된 구독 게이트 + catalog/Activity World 단발 재조회**를 탄다(C). 순수 focus는 재구독하지 않는다(E). Trailhead 빈 emulator에서는 tracked underlying 누수·CG 재청구가 없고 ~600 reads는 재현되지 않았다 — production 규모는 단발 getDocs·(있을 때) Trail overlay initial이 유력하나 billed 귀속은 Ø. 다음 최소 수정은 신선도 정책(Chief) 아래 catalog/world poll 가드가 1순위다.
