# Public Trail 동행 트래픽 개선 — 최종 결과 보고

| 항목 | 내용 |
|------|------|
| 문서 유형 | **기록** — Public Trail 1명/2명 Firebase 트래픽 개선 최종 결과 |
| 최초 작성 | 2026-10-01 |
| 상태 | **검토됨 · 끝남** — Supervisor 최종 검수 PASS · production billed 1v2 관측은 별도 미실시 |
| 독자 | **chief · AI** |
| 연결 문서 | [ops 묶음](../ops/20260929-public-trail-traffic/README.md) · [production 1인vs2인 분석(배포 전)](260929-주행-Firebase-트래픽-1인vs2인-분석보고.md) · [측정 한계 검수](../ops/20260929-public-trail-traffic/08-review-measurement.md) · [문서 지침](../260509-BOXCYCLE-문서-생성-및-수정-지침.md) · [Ontology](../260714-RTW-Ontology.md) |

---

# Part A — Chief용 1페이지 요약

## 문제

같은 Public Trail에서 **혼자 달릴 때**와 **2명이 함께 달릴 때** Firebase(특히 Firestore 읽기·쓰기·Cloud Functions) 사용량이 크게 달라 보였다. 2026-09-29 production Console 관찰에서 2인 쪽이 읽기 부담이 더 커 보였다. 비용 개요(일 합계)로는 1분 A/B를 판단할 수 없어, 원인 분리·최소 수정·에뮬레이터 전후 측정·배포까지 묶음으로 진행했다.

## 결론 (확정할 수 있는 것 / 없는 것)

| 말할 수 있음 | 말할 수 없음 |
|---|---|
| 배포 전 production Console은 **읽기 쪽 민감**을 방향적으로 보여 준다 (분당 호버, 창 정렬 한계 있음) | production **청구액·billed ops 절감률**은 아직 측정하지 않았다 |
| 에뮬레이터 **45초** 동일 조건(28D-B 1s → 31B-R 4s)에서 FS live-ride **writes** solo **73.2%** · dual **72.5%**; hub callback solo **72.3%** · dual **70.1%**. 약칭 「~73%」는 **FS writes만** | 그 숫자를 **달러 절감**·production Console 배수·**전체 묶음 총효과**로 바꿔 쓰지 말 것 (41→11/80→22는 주로 heartbeat 단계) |
| RTDB 동행 motion(~5Hz)은 전후 **거의 유지** | 3명 이상 Trail 비용 — **범위 밖** |
| listing Cloud Functions는 update마다 돌지 않도록 **Created/Deleted**로 바뀌었고, production에서 legacy Written×2를 **삭제**했다 | `routeActivityOnLivePublicationRideWritten`는 여전히 **update마다 호출**되는 별도 경로 |

### Baseline 시점 · 적용 상태 (혼동 금지)

| Baseline | 시점 / 코드 상태 | 비교에 쓸 수 있는 것 |
|---|---|---|
| 2026-09-29 production Console | **이 묶음 변경 배포 이전** 라이브 앱 | 읽기 민감 **방향만** (**P**). emulator와 **인과·비용 비교 금지** |
| **28D-B** emulator 1s | listener-scope · listing Created/Deleted · RTDB 5Hz 등 **이미 적용**된 코드 + FS heartbeat **1s** | 31B-R과의 before (**E**) |
| **31B-R** emulator 4s | 위와 동일 스택 + FS heartbeat **4s** · paired absolute capture | 28D-B after (**E**) |

따라서 FS writes **41→11 / 80→22**는 묶음 전체(리스너·listing·5Hz·4s)의 총효과가 아니라, **주로 1s→4s heartbeat 단계**의 전후다.

## 적용한 핵심 변경 (제품 의미)

1. **주행 중 불필요 구독 끄기** — Trail 목록·프로젝트 전체 live-ride 컬렉션그룹·다른 Trail 세계 오버레이를 주행 중(메뉴 닫힘)에 해제. 현재 Trail 동행 구독은 유지.
2. **Trailhead(`default`)에 남은 peer 구독 제거** — 종료 후 잔여 FS/RTDB peer 허브 방지.
3. **동행 위치 RTDB 목표 10Hz→5Hz** — 오프라인 재생·입력 동등성 검증 후 채택.
4. **listing CF를 Created/Deleted만** — 1Hz live-ride update로 listing 재계산이 돌지 않음. 배포 시 Written 고아 함수 삭제 필수.
5. **Firestore live-ride 정상 heartbeat 1s→4s** — RTDB 5Hz는 유지. RTDB 장애 시 FS fallback 품질을 먼저 증명한 뒤 적용. 8–10s는 거부.

## 현재 검증 수준

| 층 | 상태 |
|---|---|
| Emulator 1명/2명 트래픽 미터 (45s) | **PASS** — before [28D-B](../ops/20260929-public-trail-traffic/28c-result-traffic-1-2.md) · after [31B-R](../ops/20260929-public-trail-traffic/31b-result-meter-4s.md) |
| Emulator 기능 매트릭스 (생성·합류·Stop·완주 등) | **PASS** @4s — [31C](../ops/20260929-public-trail-traffic/31c-result-functional-4s.md) (DOM peer **가시성**은 자동 주장 안 함) |
| RTDB→FS fallback / dual-source liveness | **PASS** (오프라인 하네스) — [30B/30C](../ops/20260929-public-trail-traffic/30-result-rtdb-fs-fallback.md) · [30C](../ops/20260929-public-trail-traffic/30c-result-dual-source-liveness.md) |
| `origin/main` 병합 | **DONE** — tip align `803f6ff` ([36](../ops/20260929-public-trail-traffic/36-result-r1-merge-main.md)) |
| Production 배포 (listing CF + Hosting) | **DONE** ~2026-10-01 15:49 KST · project `boxcycle-dc2df` · code SHA `803f6ff` ([37](../ops/20260929-public-trail-traffic/37-result-r2-deploy.md)) |
| Production billed 1v2 재측정 | **미실시** |

## 남은 관측

- production Console(지난 60분·분당 호버) 또는 Cloud Monitoring으로 **배포 후** 1인/2인 quiet 프로토콜 재측정 — 배포 전 보고서와 **혼합 금지**.
- 선택: `routeActivityOnLivePublicationRideWritten` Created/Deleted(또는 동등) 수술 — mid-ride pulse/anchor 대체 설계 후에만.
- 사용자/Chief **육안** 동행 표시 품질은 자동 DOM 게이트와 분리해 기록.

---

# Part B — AI 후속 작업용 상세 기술 기록

비교 범위 전 구간: **1 rider / 2 riders only**. 3명 이상은 별도 지시.

증거 클래스 표기: **P** = production Console/호버 · **E** = emulator client meters / E2E · **H** = offline harness · **C** = code/static model · **L** = human observation · **Ø** = not measured.

---

## 1. 증상과 2026-09-29 production baseline · 측정 한계

### 1.1 출처

- 사용자/팀 분석 원문: [260929-주행-Firebase-트래픽-1인vs2인-분석보고.md](260929-주행-Firebase-트래픽-1인vs2인-분석보고.md)
- Supervisor/Developer 한계 교정: [07-result-measurement-review.md](../ops/20260929-public-trail-traffic/07-result-measurement-review.md) · [08-review-measurement.md](../ops/20260929-public-trail-traffic/08-review-measurement.md)
- 환경: project `boxcycle-dc2df` · 실 Firebase · **이 묶음의 코드 배포 이전** 라이브 앱 (**P**, 배포 전)

### 1.2 분당 대표값 (보고서 인용 · 한계 동봉)

| 구간 (KST) | 읽기 | 쓰기 | 보고서 해석 | 교정 (07/08) |
|---|---:|---:|---|---|
| 08:19–08:20 | **363** | **118** | 1인 주행 창과 일치 | 스탬프 주행 08:18:56–08:19:56이 **분 경계를 가로지름** → 시계열 1분이 정확한 60초 적분 아님 |
| 08:24–08:25 | **1,200** | **252** | 2인 본구간 | 마찬가지로 경계 교차; 분 시작 전 dual quiet 트래픽 일부 포함 가능 |
| 08:21–08:22 | 45 | 1 | 조용 baseline | UI quiet ≠ Firestore silence (**C**+타임라인) |
| 08:23–08:24 | 1,400 | 280 | “합류”로 기술됨 | `dual_ready_quiet`=08:22:58 → 이 분은 **이미 둘 다 주행 중**인 quiet 대기 (**합류 피크 주장 기각**) |

보고서가 쓴 배수(읽기 ×3.3 / 쓰기 ×2.1)는 **같은 라벨의 시계분 샘플 비교**이며, 인과 배수·경로 귀속으로 쓰지 않는다 (**08**).

### 1.3 60분 슬라이딩·리스너 피크

캡처 시점 슬라이딩 60분: 읽기 ~1.9만 · 쓰기 ~2.2천 · 리스너 최다 **79** · 연결 ≤7.
**08**: 혼합 워크로드(1차 실패 재시도·기타 세션 포함). ride-pure 비용비로 쓰지 말 것.

### 1.4 측정 한계 요약 (이후 모든 주장에 적용)

1. Usage 개요(일/월)로 1분 A/B 금지.
2. Quiet 스탬프가 주행 시작 **이후**이면 Firebase는 계속 동작한다.
3. 분당 호버를 60초 ride total로 재구성할 수 없다(균일 가정 불가).
4. 이 production 수치는 **listing Created/Deleted · listener-scope · 4s heartbeat · 5Hz 배포 이전**이다. 배포 후 수치와 합산·비율화하지 말 것.

---

## 2. 원인별 데이터 흐름 · 기여도 (근거 / 추론 구분)

정적 맵 원본: [07 §3](../ops/20260929-public-trail-traffic/07-result-measurement-review.md) · 잔여 감사 [27](../ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md).

| # | 경로 | 1명 vs 2명 형태 (**C**) | 기여도 판정 |
|---|---|---|---|
| A | `trails/{id}/livePublicationRides` ~1Hz(당시) `setDoc` + 양측 `onSnapshot` | 쓰기 ≈2× · 각 write가 **양쪽 클라이언트** 스냅샷 전달 가능 | **근거(코드 형태)** — billed read 수치는 Ø. Emulator 허브 콜백이 dual에서 ~3×로 커진 것은 **E** (콜백≠청구 읽기) |
| B | CG `livePublicationRides` + `openTrailListings` + world multi-Trail overlay | 주행 중에도 켜져 있으면 프로젝트/목록 증폭 | **근거(코드)** 구독 존재 · production 79 리스너와의 **직접 귀속은 추론** |
| C | listing CF `onDocumentWritten` (members / live) | live update마다 CF begin → recompute | **근거(코드)** TASK-01/02·26. production billed 절감 Ø |
| D | `routeActivityOnLivePublicationRideWritten` (`onDocumentWritten`) | update마다 **호출**; heartbeat-only는 handler early-return | **근거(코드)** [27 §3](../ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md). **여전히 잔존** |
| E | RTDB `/trails/{id}/motion/{uid}` | 당시 10Hz→목표 5Hz; 1→2 ≈2× write · delivery는 클라이언트 합산 | 대역폭 **C**; production RTDB billed Ø |
| F | `trails/{id}.lastActivityAt` coalesce · `livePresence` | 저주기 | 본 묶음 주 타깃 아님 |

최적화 우선순위(채택 순서와 일치): **리스너 범위(B) → listing CF(C) → FS heartbeat(A)**, RTDB는 품질 게이트 후 5Hz(E). FS 8–10s throttle은 stale margin·fallback 이유로 **거부** ([27 §7 / 28A](../ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md)).

---

## 3. 적용 변경 — 결정 이유 · 코드 위치 · 트리거 전환 순서

### 3.1 채택 변경 타임라인 (제품)

| 순서 | 변경 | 이유 | 주요 위치 | 증거 |
|---|---|---|---|---|
| 1 | Listing live update early-return → 이후 **Created/Deleted** | update마다 listing recompute 제거 | `functions/src/openTrailListingProjection.ts` · `functions/src/index.ts` | [02](../ops/20260929-public-trail-traffic/02-result-listing-trigger.md)(역사) · **[26](../ops/20260929-public-trail-traffic/26-result-listing-created-deleted.md)** |
| 2 | RTDB publish 100→200ms | 동행 위치 이벤트율 상한; 재생 시나리오 통과 | `apps/web/src/lib/ride/rideSyncPolicy.ts` (`PEER_MOTION_PUBLISH_INTERVAL_MS`) | [04](../ops/20260929-public-trail-traffic/04-result-5hz.md) · [24R](../ops/20260929-public-trail-traffic/24-result-5hz-quality.md) |
| 3 | 주행 중 listener gating | 목록/CG/world 증폭 차단, 현재 Trail peer 유지 | `listenerScopePolicy.ts` · `App.tsx` · `useAppMapOverlays.ts` | [10](../ops/20260929-public-trail-traffic/10-result-listener-scope.md) · [14](../ops/20260929-public-trail-traffic/14-result-emulator-listeners.md) |
| 4 | DEFAULT Trail peer hub skip | 종료 후 default FS/RTDB 잔여 | `PublicationSharedPresence.tsx` | [18](../ops/20260929-public-trail-traffic/18-result-default-trail-subscription.md) |
| 5 | RTDB→FS fallback 품질 (30B) + dual-source liveness (30C) | FS throttle 전 필수 게이트; 30A 시계 비교는 **폐기** | `syncFromPresence.ts` · `PublicationSharedPresence.tsx` | [30](../ops/20260929-public-trail-traffic/30-result-rtdb-fs-fallback.md) · [30C](../ops/20260929-public-trail-traffic/30c-result-dual-source-liveness.md) |
| 6 | FS heartbeat 1000→4000ms | steady FS write ~4× 감소; stale margin 11s; fallback jump≤1.3m @4s | `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` in `rideSyncPolicy.ts` | [31A](../ops/20260929-public-trail-traffic/31a-result-fs-heartbeat-4s.md) |

초기·속도 급변·종료 delete는 heartbeat에 묶이지 않음 (**C**, 31A 감사).

### 3.2 Production listing 트리거 전환 순서 (필수)

배포 증거 [37](../ops/20260929-public-trail-traffic/37-result-r2-deploy.md):

1. **Create** ×4: `openTrailListingOnMemberCreated` / `…Deleted` / `…LiveCourseRideCreated` / `…Deleted`
2. list로 4개 생존 확인
3. **Delete** ×2 only: `openTrailListingOnMemberWritten` · `openTrailListingOnLiveCourseRideWritten`
4. Hosting 배포
5. `openTrailListingOnTrailWritten` **유지**

PowerShell에서는 `--only` 값을 **따옴표**로 묶어야 함(미인용 시 0 match — 37 기록).

### 3.3 실패·무효·폐기 (채택과 분리)

| 항목 | 상태 | 이유 |
|---|---|---|
| 분석 보고의 “08:23=합류” · quiet=저트래픽 · ×3.3 인과 | **교정됨** | 07/08 |
| TASK-24 10Hz/5Hz lag 수치 | **무효 → 24R** | 입력 궤적 비동등 |
| TASK-25 초기 emulator PASS를 현재 강한 게이트로 사용 | **비채택** | 29D/29E가 대체 ([25](../ops/20260929-public-trail-traffic/25-result-functional-matrix.md)) |
| 29A/29C create-matrix | **FAIL / superseded** | 29D |
| 28C 첫 PASS FS success 카운트 | **superseded by 28D-B** | reset 후 in-flight success 누수 |
| 30A cross-clock skew select | **Supervisor 거부** | ±30s 실패 |
| 30B every-sync `serverAtMs: nowMs` | **30C로 수정** | frozen freeze peer immortal |
| FS 8–10s throttle | **거부** | stale margin · fallback jump |
| 31B attempt1 / stamp-before-read | **INVALID** | dual wall 58s 등 — [31B](../ops/20260929-public-trail-traffic/31b-result-meter-4s.md) |

---

## 4. Emulator 45초 1명/2명 전후 표 · 계측 정의 · 무효 시도

### 4.1 공통 조건 (**E**)

| 항목 | 값 |
|---|---|
| 환경 | Auth/Firestore/RTDB/Functions emulator · local hosts only |
| 창 | `MEASURE_MS=45000` · settle 후 meter reset |
| 루트 | longest intro **2.02 km** (solo=dual) |
| 포트 | `RTW_DEV_PORT=5050` (5060은 Chromium `ERR_UNSAFE_PORT` — 회피) |
| Before | **28D-B** · session `t28c-munauwzr` · [28c](../ops/20260929-public-trail-traffic/28c-result-traffic-1-2.md) · FS heartbeat **1s** · (listener-scope / listing Created-Deleted / RTDB 5Hz **이미 반영**) |
| After | **31B-R** · session `t31br-muokbui7` · [31b](../ops/20260929-public-trail-traffic/31b-result-meter-4s.md) · FS heartbeat **4s** · paired absolute capture |

production 2026-09-29 Console baseline과 위 emulator 쌍을 **한 표·한 배수로 섞지 않는다**.

명령 (`apps/web/package.json` 스크립트):

```powershell
cd apps/web
$env:RTW_DEV_PORT='5050'
# 28D-B 권위 숫자는 §4.4 보존 JSON을 본다. 재실행 시 일반 출력 파일명이 덮일 수 있음.
# 4s after 재현:
$env:RTW_TRAFFIC_ARTIFACT_TAG='task31b-r'
npm run test:e2e:public-trail-traffic
```

### 4.2 계측 정의 (청구와 혼동 금지)

| 메트릭 | 의미 | 아님 |
|---|---|---|
| `livePublicationRideWrites` / Attempts | 클라이언트 `setDoc` 성공/시도 (DEV meters, generation-ticket) | Firestore billed writes |
| `rtdbMotionWrites` / Attempts / BytesApprox | RTDB `set` 성공/시도 · UTF-8 대략 | billed RTDB |
| `fsLiveRideUnderlyingDeliveries` / DocChanges | 클라이언트 hub `onSnapshot` 콜백 합 | **server billed reads** |
| `rtdbMotionUnderlyingDeliveries` | hub `onValue` 콜백 합 | billed download |
| `functionsInvocationsWholeRun` | emulator log `Beginning execution` 전 구간 | window/dual 창 귀속 · production billed CF |

정의·한계: [27 §8](../ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md) · [28b](../ops/20260929-public-trail-traffic/28b-result-meter-instrumentation.md).

### 4.3 전후 표 (권위 숫자)

분모: 위 45s 창 · dual은 **pageA+pageB 합**. Emulator ≠ billing.

| Metric | Solo 1s (28D-B) | Solo 4s (31B-R) | DualΣ 1s | DualΣ 4s | Solo 감소율* | Dual 감소율* |
|---|---:|---:|---:|---:|---:|---:|
| FS write attempts | 41 | **11** | 80 | **22** | (41−11)/41 = **73.2%** | (80−22)/80 = **72.5%** |
| FS writes | 41 | **11** | 80 | **22** | **73.2%** | **72.5%** |
| FS hub deliveries | 83 | **23** | 254 | **76** | (83−23)/83 ≈ **72.3%** | (254−76)/254 ≈ **70.1%** |
| RTDB writes | 149 | 151 | 296 | 290 | ~0 (근접 유지) | ~0 (근접 유지) |
| RTDB hub deliveries | 149 | 152 | 594 | 584 | ~flat | ~flat |

\*감소율은 **에뮬레이터 client meter 변화**(28D-B↔31B-R)다. 약칭 **「emulator FS writes ~73%」**는 FS writes만(solo 73.2% · dual 72.5%). hub callback은 **별도**(solo 72.3% · dual 70.1%). **비용 절감률·전체 묶음 총효과로 확정하지 않는다.**

Dual/Solo 쓰기 비는 전후 모두 ~2.0 (출판자 수와 일치).

CF whole-run (창 귀속 아님): `routeActivityOnLivePublicationRideWritten` begin 320→213 · totalBegin 367→263 — 방향만 참고 (**E** whole-run).

### 4.4 아티팩트 위치

권위 숫자는 **아래 보존 파일명**을 쓴다. 일반 `public-trail-traffic-1-2.json`은 초기 28C·이후 재실행과 혼동될 수 있어 권위로 쓰지 않는다.

| | Path |
|---|---|
| **28D-B 권위** JSON/phases | `document/ops/20260929-public-trail-traffic/public-trail-traffic-1-2-28db-baseline.json` · `public-trail-traffic-1-2-phases-28db-baseline.jsonl` |
| **31B-R 권위** JSON/phases | `document/ops/20260929-public-trail-traffic/task31b-r.json` · `task31b-r-phases.jsonl` |
| Runtime (gitignore `.out/`) | `apps/web/.out/firebase-traffic/` |
| 31B-R logs (있을 때) | ops/`.task31b-r-run.log` · `.task31b-r-emulator.log` |
| INVALID | `.task31b-attempt1-INVALID.md` 등 — 비율에 사용 금지 |

---

## 5. 1명/2명 기능·품질·fallback·종료 검증

### 5.1 기능 매트릭스 (**E** DOM/데이터 · **L** 육안 분리)

권위 게이트 @4s: [31C](../ops/20260929-public-trail-traffic/31c-result-functional-4s.md)
(이전 1s 시대 강한 게이트: [25 / 29D+29E](../ops/20260929-public-trail-traffic/25-result-functional-matrix.md))

| # | 항목 | 31C | 자동 주장 범위 |
|---|---|---|---|
| F1 | Public Trail 생성 | PASS | listing·live host |
| F2 | 동행 합류 | PASS | B live · `?trail=` |
| F3 | 동행 peer/data | PASS | peers≥1 · peerDataOk — **visible HUD Dom은 false여도 PASS; 육안은 L** |
| F4 | Stop + live clear | PASS | summary · live clear · 상대 유지 |
| F5 | 재참여 | PASS | |
| F6 | 완주 | PASS | 0.41/0.41 · live+listing clear · Stop 아님 |
| F7 | 양쪽 종료 | PASS | dual clear · listingGone — hub UI secondary **TIMEOUT → 미검증** |
| F8 | 상대 주행 유지 | PASS | |

명령 (`apps/web/package.json`; port 5050, workers=1, retries=0 — 스크립트가 deadline·functions emulator 포함):

```powershell
cd apps/web
$env:RTW_DEV_PORT='5050'
npm run test:e2e:public-trail-functional-create
npm run test:e2e:public-trail-functional-f6
# 전체: npm run test:e2e:public-trail-functional
```

### 5.2 동행 표시 품질 (5Hz) (**H**)

[24R](../ops/20260929-public-trail-traffic/24-result-5hz-quality.md): 입력 동등성 14/14 · replay `--check` 19/19.
관측 lag는 게이트가 아님. **실기기·실측·mergePackets 이중 스트림·육안 2창 = 미검증**.

### 5.3 RTDB 장애 → FS fallback · liveness (**H**)

| 단계 | 결과 | 요약 증거 (committed) |
|---|---|---|
| 30B baseline | 16/48 | `task30b-baseline-fail.summary.json` |
| 30B after | 48/48 | `task30b-after-fix.summary.json` |
| 30C both-stop baseline | 0/6 | `task30c-baseline-fail.summary.json` |
| 30C after | 6/6 · fallback regress 48/48 | `task30c-after-fix.summary.json` · `task30c-fallback-regress.summary.json` |
| 31A @4s receive | 12/12 · maxJump 1.3m · staleRiskMargin 11000 | `task31a-fallback-4s.summary.json` |

Full raw JSON은 **local-only** (커밋하지 않음). Emulator 탭킬 E2E injection은 이 묶음에서 **미실시**.

### 5.4 Listener release (**E**)

[14](../ops/20260929-public-trail-traffic/14-result-emulator-listeners.md) · [18](../ops/20260929-public-trail-traffic/18-result-default-trail-subscription.md): CG `1→0→1→0→1` · ride 중 current Trail FS/RTDB open · post-ride default hub 없음 · RTDB open→0.

```powershell
cd apps/web
$env:RTW_DEV_PORT='5015'
npm run test:e2e:listener-scope
```

---

## 6. main / production 배포

### 6.1 Git

| 항목 | 값 | 증거 |
|---|---|---|
| Primary product commit (traffic branch) | `f37006f` (+ lint `dd59808`) | [33](../ops/20260929-public-trail-traffic/33-result-commit.md) |
| Integration merge | `fd27d06` (traffic `beb22b1` + main `4492753`) | [35](../ops/20260929-public-trail-traffic/35-result-integration-merge.md) |
| R1 publish tip | `803f6ff` = `origin/main` (배포 시점) | [36](../ops/20260929-public-trail-traffic/36-result-r1-merge-main.md) |
| R2 docs tip (본 worktree 작성 시점) | `4248425` | `git log` |
| R1 첫 push 실패 | dep-layers M0 + mapbox token 테스트 → R1-R로 해제 (`f5f2130`) | [36](../ops/20260929-public-trail-traffic/36-result-r1-merge-main.md) |

### 6.2 Firebase production (~2026-10-01 15:49 KST)

| 항목 | 값 |
|---|---|
| Project | `boxcycle-dc2df` |
| Region | `asia-northeast3` |
| Code SHA | `803f6ffd6826b08e79a7167ca0aa61be2b6acb4c` |
| Created | listing Created/Deleted **×4** |
| Deleted | `openTrailListingOnMemberWritten` · `openTrailListingOnLiveCourseRideWritten` **×2** |
| Kept | `openTrailListingOnTrailWritten` |
| Hosting | `https://boxcycle-dc2df.web.app` HTTP **200** · bundle `index-B5Q89rqf.js` |
| 미배포 | full functions redeploy · rules · indexes · RTDB rules |
| 증거 | [37-result-r2-deploy.md](../ops/20260929-public-trail-traffic/37-result-r2-deploy.md) |

배포 직후 rider functional matrix **재실행 안 함** (inventory + HTTP만).

---

## 7. Production billed 개선 — 미측정 · 사용자 관측 분리

| 주장 | 상태 |
|---|---|
| Emulator FS writes solo 73.2% · dual 72.5% (약칭 ~73%); hub callback solo 72.3% · dual 70.1% — 28D-B→31B-R | **E** — §4 (heartbeat 단계; 전체 묶음 총효과 아님) |
| Listing update CF 호출 제거(코드+배포 inventory) | **C** + deploy list **P-inventory** — billed $ Ø |
| Production Console 1v2 재측정으로 절감 확인 | **Ø** — [37] 명시: *billed cost reduction is not asserted* |
| 배포 전 363/1200 호버 | **P pre-deploy only** — 배포 후와 혼합 금지 |
| Chief/사용자 “주행 이상 없음” 류 피드백 | **L** — 연속성 지지, 트래픽·부드러움 정량 아님 ([08](../ops/20260929-public-trail-traffic/08-review-measurement.md)) |

**규칙:** live user screenshots / 배포 전 보고서 숫자와 emulator 표를 **한 표에 섞지 않는다**.

---

## 8. 재발 시 플레이북 · 조사 트리거 · 회귀 게이트 · 복구

### 8.1 측정 → 분류 → 최소 수정 → 검증 → 배포 → 관측

1. **측정**
   - Production: Firestore 지난 60분 **분당 호버** + ISO 위상 로그. quiet는 **ensureRiding 전** 또는 publish 중지 후. 창을 시계분에 정렬한 긴 steady 구간 권장 (08).
   - 개발 (`apps/web`): `$env:RTW_DEV_PORT='5050'; npm run test:e2e:public-trail-traffic` · paired capture · successes≤attempts.
2. **분류** — §2 표 A–F. 쓰기 배수(~2×) vs 읽기/콜백 배수(~3×+) vs CF begin vs RTDB.
3. **최소 수정** — 리스너 범위 → listing 트리거 타입 → (fallback 증명 후) FS cadence. RTDB rate는 24R급 재생 없이 내리지 말 것. 8–10s FS 금지 기본.
4. **검증** — §8.3 게이트 표의 package scripts / 경로.
5. **배포** — Created/Deleted **먼저** · legacy Written **삭제** · Hosting. Written 잔존 = 지속 update 과금.
6. **관측** — production billed/Console을 **별 섹션**에만. emulator와 비율화하지 말 것.

### 8.2 조사 트리거 (고정 threshold 경보 아님)

아래는 **조사 시작 신호**다. 수치를 SLA·경보 임계값으로 확정하지 않는다.

- Firestore 분당 읽기가 quiet 대비 급증하고, 리스너 수가 연결 수 대비 눈에 띄게 큼 (배포 전 혼합창에서 리스너 ~79를 본 적은 있으나 **임계값으로 쓰지 말 것**).
- Functions: listing **Written** export 이름 재등장, 또는 live/members **update** 시 listing 함수 begin이 비정상적으로 잦음.
- Emulator meter: dual FS writes가 solo의 ~2×에서 크게 벗어나거나, hub deliveries가 쓰기 대비 비정상적으로 커 보임 — **절대 배수 임계 미정**.
- Functional: F3 peerData / F4·F7 live clear / F6 listing clear 실패.
- Fallback harness: `--suite both-stop`에서 peer `goneAt=never`.

### 8.3 회귀 게이트 (최소 세트 · 실제 script)

경로·cwd를 맞출 것. 존재하지 않는 npm script 이름을 만들지 말 것.

| Gate | 명령·위치 |
|---|---|
| Listing trigger type | `cd functions && npm test` (`openTrailListingProjection.test.js` 포함) |
| Heartbeat / sync constants | `cd apps/web && npm run test:next-ride` (`live-route-progress-heartbeat-contract` · `sync-policy-constants-contract` 포함) |
| Traffic meters unit | `cd apps/web && npm run test:traffic-meters` |
| 1v2 meter E2E | `cd apps/web` · `RTW_DEV_PORT=5050` · `npm run test:e2e:public-trail-traffic` |
| Functional | `npm run test:e2e:public-trail-functional-create` · `npm run test:e2e:public-trail-functional-f6` |
| Peer motion | `cd apps/web` · `node scripts/peer-sync/replay.mjs --check` · `node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite fallback` / `--suite both-stop` |
| Listener scope | `cd apps/web && npm run test:e2e:listener-scope` |
| Dep layer | repo root `npm run check:dep` |

### 8.4 안전한 복구 원칙

1. **Hosting만** 이전 bundle로 되돌리기 vs **Functions** 롤백을 분리해 생각. listing은 Created/Deleted 없는 상태로 Written만 남기면 안 된다.
2. FS heartbeat를 1s로 되돌릴 때: traffic meter·functional·fallback을 다시 통과시킬 것.
3. RTDB를 다시 10Hz로 올릴 때: 24R 입력 동등성·재생 게이트.
4. listener-scope를 풀 때: 주행 중 CG/listing 재개 비용을 재측정.
5. 다른 worktree의 MapHud/theme 등 **무관 dirty(C)** 를 revert하지 말 것 ([32](../ops/20260929-public-trail-traffic/32-precommit-audit.md)).
6. `--no-verify` / force push to main 금지.

토큰·`.env`·전체 Trail ID·개인 UID는 보고서에 붙이지 않는다. 재현은 sessionId·artifact 태그·상대 경로로.

---

## 9. 잔여 리스크 · 추가 작업 조건

| 리스크 / 작업 | 조건 | 비고 |
|---|---|---|
| `routeActivityOnLivePublicationRideWritten` 잔존 | 선택 TASK-29류 | update마다 **invocation**; handler는 heartbeat-only skip. mid-ride pulse/anchor(Δ≥0.012 / band / 0.08) 대체 없이 Created/Deleted만으로 바꾸지 말 것 ([27](../ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md)) |
| Production billed 미확인 | 배포 후 관측 태스크 | Ø → 절감 주장 금지 |
| FS fallback freshness 창 확대 (4s) | RTDB 장기 장애 | harness 커버; 실탭 킬 E2E Ø |
| F3 육안 / F7 hub UI | 제품 UX | 자동 게이트 밖 (**L** / secondary timeout) |
| 주행 중 메뉴 재구독 지연 | 예상 UX | [10] Risks |
| 세계 맵 타 Trail 라이더 숨김 (주행 중) | 의도적 | idle Trailhead는 유지 |
| **>2 riders** | **범위 밖** | 새 ops 지시 필요 |
| 28T 8–10s | 비권장 유지 | jump↑ · margin 5–7s |

---

## 부록 A — 증거 색인 (ops)

묶음 입구: [README](../ops/20260929-public-trail-traffic/README.md) · 큐: [22-task-queue.md](../ops/20260929-public-trail-traffic/22-task-queue.md)

| 주제 | 파일 |
|---|---|
| Production baseline 한계 | `07` · `08` · archive `260929-…분석보고` |
| Listener scope | `10` · `14` · `18` |
| 5Hz + 품질 | `04` · `24` |
| Listing Created/Deleted | `26` · deploy `37` |
| 잔여 감사 / meter 설계 | `27` · `28b` · `28c` |
| Fallback / liveness | `30` · `30c` · `31a` |
| 4s meter / functional | `31b` · `31c` |
| Commit / merge / deploy | `32`–`37` |

## 부록 B — 용어

UI·문서: **Trail** · **Trailhead** · **Guest**(익명 인증 후). Room/Lobby/`courseId` 신규 사용 금지 — [Ontology](../260714-RTW-Ontology.md).
코드/Firestore에 남은 `liveCourseRide*` 함수 이름은 레거시 export 식별자이며, 제품 용어로 노출하지 않는다.

---

## 한 줄 요약

**배포 전(2026-09-29) production Console은 읽기 민감만 방향적으로 보여 주었다. Emulator 45초에서 28D-B(1s·다른 채택 수정 이미 반영) 대비 31B-R(4s) FS writes는 solo 73.2%·dual 72.5%(약칭 ~73%는 FS writes만; hub callback은 solo 72.3%·dual 70.1%)이며, 이 감소는 주로 heartbeat 1s→4s 단계이고 production billed와 인과·비용 비교하지 않는다. RTDB는 유지, billed 절감은 미측정, `routeActivityOnLivePublicationRideWritten`는 잔존.**
