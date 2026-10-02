# Result — Remaining opportunity audit (read-only)

| 항목 | 내용 |
|------|------|
| 문서 유형 | **ops 결과** — TASK-01 read-only audit |
| 담당 | Cursor CLI Developer |
| 작업일 | 2026-10-02 |
| 상태 | **DONE** (조사만 · 코드/테스트 미수정 · 테스트 미실행) |
| 지시 | [01-task-remaining-opportunity-audit.md](01-task-remaining-opportunity-audit.md) |
| 연결 | [README](README.md) · [00-handoff](00-handoff.md) · [이전 묶음 CLOSED](../20260929-public-trail-traffic/README.md) |

증거 클래스: **C** code/static · **E** emulator · **H** harness · **P** production console · **L** human/Chief observation · **Ø** not measured.

비교 권위 범위: **1 rider / 2 riders only**. 3명은 참고 각주만.

---

## 1. 메타

| 항목 | 값 |
|---|---|
| Branch | `codex/public-trail-traffic-followup` |
| HEAD | `68f0f11c9a1f8c1343c70bbeec28647bb8214663` |
| `origin/main` | `2cdaea6b7ca6468254e239a2fd2b2ab719c27c62` (handoff Base와 일치) |
| HEAD vs Base | ops 문서 커밋 2개만 (`32c76ca`, `68f0f11`). 제품 tip은 Base와 동일 계열 |
| Dirty | **clean** (`nothing to commit, working tree clean`) |
| 제품/테스트 변경 | **없음** (본 결과 md만 신규 작성 예정) |

### 읽은 문서

1. `document/ops/README.md` · `PROGRESS.md`
2. `document/ops/20261002-public-trail-traffic-followup/README.md` · `00-handoff.md` · `01-task-…`
3. `document/archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md` (Part A · Part B §2·§4·§7)
4. `document/ops/20260929-public-trail-traffic/27-result-remaining-traffic-audit.md`
5. `30-result-rtdb-fs-fallback.md` · `30c-result-dual-source-liveness.md`
6. `31b-result-meter-4s.md`
7. `37-result-r2-deploy.md`
8. 현재 tip 소스 (아래 §2 경로 지도)

### 실행한 명령 (읽기 전용)

```text
git status
git rev-parse HEAD
git branch --show-current
git log -1 --oneline
git rev-parse origin/main
git log --oneline -5
git merge-base HEAD origin/main
git log --oneline 2cdaea6..HEAD
```

리포 내 정적 검색·파일 읽기만. **테스트 미실행** (지시: 기본 미실행 · 실행하지 않음).

### 확정 baseline (보존)

| 주장 | 취급 |
|---|---|
| Emulator 28D-B(1s)→31B-R(4s) FS writes solo **73.2%** · dual **72.5%**; hub solo **72.3%** · dual **70.1%** | **E**. ~73% = FS writes만. 달러·묶음 총효과 금지 |
| Production billed 1v2 | **Ø 미측정** |
| Listing Created/Deleted + Hosting | **DONE** (37 · code SHA `803f6ff`) |
| FS 8–10s throttle | **거부** 유지 (27 · 30B jump↑ · stale margin) |
| 비교 범위 | **1/2 riders only** |

### Chief 제공 후속 관측 (독립 계측 검수 전 · **L** only)

정식 귀속·비용 검증·emulator **E** 표와 **한 표로 혼합하지 않음**. 「대성공 / 근본 해결 / 완벽 통제 / 누수 완전 해소」로 승격하지 않음.

| | peak read/write | run read/write |
|---|---:|---:|
| pre-change 2 riders | 1400 / 280 | 4239 / 855 |
| post-change 2 riders | 471 / 166 | 1366 / 365 |
| post-change 3 riders (**참고**) | 584 / 189 | 1509 / 414 |

계산 (post 2 vs pre 2): peak read **−66.4%** · peak write **−40.7%** · run read **−67.8%** · run write **−57.3%**.  
3 rider = 참고 관측 — 본 audit 비용식·성능 검증 권위를 3명으로 확대하지 않음.

---

## 2. 경로 지도 (현재 tip `68f0f11` / 제품 = main 계열)

이전 27의 줄 번호(1s 시대)는 **폐기**. 아래가 현재 권위.

| 후보 | 역할 | 현재 path:line |
|---|---|---|
| A | CF Written 등록 | `functions/src/routeActivityOnLivePublicationRideWritten.ts:112–114` (`onDocumentWritten`) |
| A | heartbeat-only early-return | 동 파일 `:78–98` (`isHeartbeatOnlyUpdate`) · `:172–174` |
| A | pulse / anchor 분기 | 동 파일 `:213–238` · Δ≥`0.012` / pulse band · Δ≥`0.08` anchor |
| A | pulse bands | `functions/src/routeActivityAggregateCore.ts:21–27` (0–0.4 / 0.4–0.75 / ≥0.75) |
| A | export | `functions/src/index.ts:469` |
| A | 24h safety net (mid-ride 대체 불가) | `functions/src/routeActivityScheduledReconcile.ts:27–31` |
| B | FS heartbeat **4s** | `apps/web/src/lib/ride/rideSyncPolicy.ts:39` (`TRAIL_LIVE_PROGRESS_HEARTBEAT_MS = 4_000`) |
| B | publish gate | `apps/web/src/lib/ride/liveLocationSnapshot.ts:137–154` |
| B | stale 15s · margin 계약 | `apps/web/src/lib/trail/trailLivePolicy.ts:16` · contract `live-route-progress-heartbeat-contract.test.ts` (margin ≥10s → heartbeat **≤5s** without stale 변경) |
| B | FS write | `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts:125–154` (`setDoc` merge) |
| B | fanout enqueue | `apps/web/src/lib/ride/publishLiveLocationFanout.ts:72` |
| C | Trail FS hub (refcount 1 onSnapshot/trail) | `livePublicationRidesSubscriptionHub.ts:77–100` · underlying `firestoreTrailLivePublicationRides.ts:72–80` |
| C | RTDB→FS select / dual stamp | `apps/web/src/lib/peerMotion/syncFromPresence.ts:46` (`PEER_MOTION_RTDB_SOURCE_STALE_MS=2500`) · select·normalize (30B/30C) |
| C | PSP FS/RTDB subscribe · DEFAULT skip · RTDB error→FS | `PublicationSharedPresence.tsx:205–345` (DEFAULT `:216`, `:265`; error clear `:318–336`) |
| C | listing Created/Deleted (update 0) | `functions/src/openTrailListingProjection.ts:55–75` |
| D | RTDB 5Hz 상수 | `rideSyncPolicy.ts:42` (`PEER_MOTION_PUBLISH_INTERVAL_MS = 200`) |
| D | motion publish gate | `liveLocationSnapshot.ts:158–174` (고정 간격 + 속도 Δ≥0.28 m/s 즉시; **정지 적응형 없음**) |
| D | RTDB set | `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts:145–175` |
| E | listener-scope policy | `listenerScopePolicy.ts:18–26` (listing) · `:38–47` (CG) · `:60–68` (world overlay) |
| E | App wiring | `App.tsx:783–789` · `useAppMapOverlays.ts:173–180` |
| E | Stop/완주 cleanup | `useLiveLocationPublishSession.ts:254–285` (page hide) · `:374–418` (unmount finalize/delete FS+RTDB) |
| E | delete helpers | `firestoreTrailLivePublicationRides.ts:157–179` |
| F | DEV meters (emulator≠billed) | `apps/web/src/lib/debug/trafficPublishMeters.ts` · e2e `public-trail-traffic-1-2.spec.ts` |
| F | 배포 inventory 근거 | [37](../20260929-public-trail-traffic/37-result-r2-deploy.md) · 최종 보고 Part B §7 |

---

## 3. 후보별 표 (A–F)

이론 비용식은 **정적 모델(C)** 또는 기존 **E/H**. billed $ 확정 금지. 1명/2명만 권위.

### A — `routeActivityOnLivePublicationRideWritten` 잔존 invocation · mid-ride pulse/anchor

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | Steady FS write ≈ **0.25 Hz/rider** (4s). CF는 **update마다 invoke** 후 heartbeat-only면 handler return. → invocations ≈ **0.25/s (1명)** vs **0.50/s (2명)** ≈ **1× vs 2×**. Create/Delete는 드묾. listing CF는 update **0** (이미 Created/Deleted). |
| 이미 검증 | **C**: Written + early-return (현재 tip). **E**: 31B-R whole-run begin 320→213 (창 귀속 아님·방향만). listing Created/Deleted 배포 **DONE** (37). |
| 미검증 | Production **billed** CF 절감 (**Ø**). Created/Deleted(또는 동등)로 바꾼 뒤 mid-ride pulse/anchor(Δ≥0.012 / band / 0.08) **대체 설계·품질** (**Ø**). |
| 기대효과 (상한·정성) | Update invocation **제거** 시 CF wake 비용 상한이 “steady 4s×riders” 쪽으로 수렴. handler no-op이 대부분이므로 **집계 write 절감은 작을 수 있음**. 절대 $ **Ø**. |
| 기능 위험 | mid-ride pulse/anchor·world live 표시 지연/누락. 24h reconcile은 대체 불가 (**C**·27§6). |
| 필요 증거 | (1) 4s에서 meaningful update 비율(Δ/pulse) 계측. (2) 대체 경로(클라이언트 명시 이벤트·별도 Created pulse doc·throttle된 Written 등) 설계안. (3) 기능 매트릭스 + world pulse 육안/계약. |
| Chief 결정 | **예** — CF 트리거 의미·world activity 동기화 의미 변경. |

### B — FS 4s heartbeat 추가 조정 · fallback/stale 경계

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | Steady FS writes ≈ `MEASURE_MS / heartbeat`. 4s→5s면 ≈ **20%** write↓ (1명·2명 동일 비율; dual writes ≈ **2×** solo). Read fanout도 write에 비례해 방향적으로 감소 (**C**). |
| 이미 검증 | **E**: 1s→4s FS writes ~73% (31B-R). **H**: 4s fallback jump≤1.3m · margin 11s (30B/31A). **거부**: 8–10s (jump ~28–37m · margin 5–7s) (**H**·27). Contract: `15s − heartbeat ≥ 10s` → **heartbeat ≤ 5s** (stale 불변 시). |
| 미검증 | 4s와 8s 사이 중간값(예: 5s)의 제품·하네스 재게이트 (**Ø**). production billed (**Ø**). |
| 기대효과 | stale 불변 시 여지가 **최대 ~5s** → FS 추가 절감 **소폭**. 8–10s는 거부 유지. |
| 기능 위험 | fallback catch-up jump↑ · stale hide 마진↓ · 동행 FS-only 품질. |
| 필요 증거 | 후보 interval에 대해 30B/30C harness + 31C functional + traffic meters 재실행. stale을 올리는 안은 **별도** 제품 판단. |
| Chief 결정 | **예** — 비용↔fallback 품질 트레이드오프. (현 계약 안에서의 5s도 Supervisor 검수·Chief 게이트 권장.) |

### C — Trail FS `onSnapshot` read fanout · RTDB primary / FS fallback

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | 주행+메뉴닫힘: 현재 Trail hub **클라이언트당 onSnapshot 1**. write W/s/rider × clients → hub deliveries 대략 **W×clients** (**C**). 31B-R **E**: solo hub 23 · dualΣ 76 (~3.3×) — write 2×를 넘는 콜백 배율(콜백≠billed read). RTDB primary ~5Hz; FS 4s는 presence/fallback. |
| 이미 검증 | Listener-scope으로 CG/listing/world 증폭 제거 (**C**+**E** 14). Hub refcount (**C**). RTDB→FS select·liveness (**H** 30B/30C). 현재 Trail listener 주행 중 유지 필요 (27§7D: disable 금지). |
| 미검증 | Production billed read 귀속 (**Ø**). fanout을 더 줄이는 구조(예: doc당 구독·RTDB-only HUD) (**Ø**). |
| 기대효과 | 구조 유지 시 **추가 저감 여지 제한적**. write cadence(B) 또는 리스너 수(E)가 레버. |
| 기능 위험 | 현재 Trail FS 구독 제거/축소용 → RTDB 장애 시 동행 소실·stale. RTDB-only는 30C visibility/liveness 재설계. |
| 필요 증거 | phase-aligned production read (**F**)로 “읽기가 여전히 지배적인지” 확인 후 구조안. |
| Chief 결정 | **예** — Firestore/RTDB 구조·Public Trail 동기화 의미 변경 시. |

### D — RTDB 5Hz 정지/저속 적응형 cadence

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | 현재 고정 **5Hz/rider** → 1명 ≈5 set/s · 2명 ≈10 set/s (**C**). 31B-R **E**: solo RTDB writes **151** / dualΣ **290** (45s) — FS(**11/22**)보다 **훨씬 큼**. 정지 시 publish 억제하면 idle 구간 RTDB ≈0에 가깝게 줄일 수 있음(상한·시나리오 의존). |
| 이미 검증 | 5Hz 채택·24R 입력 동등성 (**H**). 정지+5Hz stamp가 fallback 매트릭스에 포함 (**H** 30B). **적응형 cadence 코드 없음** (**C**). |
| 미검증 | 정지/저속 억제 시 peer liveness·silent-freeze 감지·보간 품질 (**Ø**). moving 구간을 5Hz 미만으로 내리는 안은 24R급 재게이트 필수·별건. |
| 기대효과 | **정지·저속 비중이 큰 세션**에서 RTDB 대역 정성 절감 가능. 연속 고속 주행에서는 효과 작음. billed RTDB **Ø**. |
| 기능 위험 | frozen RTDB vs “의도적 저빈도” 구분 실패 → FS 폴백 지연·peer 깜빡임·외삽 점프. |
| 필요 증거 | 정지 억제 정책 초안 + 30B/30C·replay `--check`·(이동 중 유지 시) 24R. 실기기 육안 **L** 권장. |
| Chief 결정 | **예** — 동행 동기화 cadence·품질 트레이드오프. |

### E — 메뉴 재개방 / Trail 전환 / Stop·완주 listener cleanup

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | 주행+메뉴닫힘: listing/CG/world **0**; 현재 Trail FS+RTDB만 (**C**). 메뉴 열림: listing(+관련) **재구독 burst** — 1·2명 모두 클라이언트 수에 비례하는 **일시** 비용. Stop/완주: FS delete + RTDB delete → CF create/delete 경로·상대 stale hide. |
| 이미 검증 | Policy+App wiring (**C**). Emulator listener-scope·DEFAULT skip (**E** 14/18). Functional Stop/완주 clear (**E** 31C F4/F6/F7; F7 hub UI secondary TIMEOUT=미검증). |
| 미검증 | production에서 메뉴 토글·Trail 전환 반복 시 잔여 구독/누수 (**Ø**). F7 hub UI (**E** secondary). |
| 기대효과 | 이미 큰 증폭 경로는 제거됨. **추가 코드 최적화 ROI 낮음** — 누수 발견 시에만. |
| 기능 위험 | 과도한 조기 unsub → 메뉴 재개방 지연(최종 보고 §9 잔여). cleanup 누락 시 default hub 잔존(과거 증상·현재 skip으로 완화). |
| 필요 증거 | 의심 시 `test:e2e:listener-scope` 재실행 + DEV hub debug counters. 새 구현 전 누수 **재현** 필요. |
| Chief 결정 | **아니오**(버그/누수 수정 수준) / **예**(구독 의미·주행 중 메뉴 정책 변경 시). |

### F — production metrics 귀속 · phase-aligned 측정 / Cloud Monitoring

| 항목 | 내용 |
|---|---|
| 이론 비용식 (1/2) | 비용 절감 레버가 아님. **관측 프로토콜**: quiet 스탬프를 ensureRiding **전** 또는 publish 중지 후 · 시계분 정렬 · 1인/2인 동일 창 (최종 보고 §8.1 · 08-review). |
| 이미 검증 | 배포 전 **P** 방향만 (2026-09-29). 배포 inventory (**P-inventory** 37). Emulator **E** 표. Chief 후속 **L** (위 별 섹션). |
| 미검증 | Production **billed** 1v2 (**Ø**). Chief **L** 숫자의 경로 귀속·시계 정렬 검수 (**Ø**). |
| 기대효과 | “더 줄일지 / 수정 없음” 결정의 **입력**. 절감 자체를 만들지 않음. |
| 기능 위험 | 없음(관측만). 잘못된 귀속은 잘못된 최적화로 이어질 위험. |
| 필요 증거 | 배포 후 Console 분당 호버 또는 Cloud Monitoring · ISO 위상 로그 · 1/2만 · emulator/Chief **L**과 표 혼합 금지. |
| Chief 결정 | **관측 창 승인** 정도면 제품 구조 변경 아님. 결과로 구현을 열 때는 해당 후보의 Chief 게이트 적용. |

---

## 4. 추천 순위

가설 순위(결론·채택 확정 아님). **수정 없음**을 명시 옵션으로 둠.

| 순위 | ID | 권고 | 근거 (요약) |
|---|---|---|---|
| 0 (게이트) | **수정 없음** | **항상 병기** | Chief **L**은 방향적으로 큰 감소를 시사하나 독립 계측 전. production billed **Ø**. 추가 구현 없이 **관측·검수만**으로 닫을 수 있음. |
| 1 | **F** | 다음으로 열기 최우선 | 구현 없이 “남은 여지 vs 충분”을 가르는 증거. A/B/D 착수 전 권장. |
| 2 | **A** | F 이후 설계 후보 | 잔존 **고주기 CF Written**. listing과 비대칭. 다만 pulse/anchor 대체 없이 수술 금지 (27·최종 보고 §9). |
| 3 | **D** | 조건부 | 현재 tip에서 RTDB 이벤트량이 FS를 압도 (**E** 31B-R). 정지 적응형은 moving 5Hz 인하와 분리해 설계. 품질 게이트 필수. |
| 4 | **C** | 보류 | fanout은 구조적이나 현재 Trail hub 제거는 금지 근거 유지. F에서 읽기 지배가 재확인될 때만 구조안. |
| 5 | **B** | **비권장(현 단계)** | 4s 이미 검증·8–10s 거부. stale 불변 시 ≤5s만 여유 → 기대효과 소폭. |
| 6 | **E** | 누수 재현 시에만 | 주 증폭 경로는 이미 게이트됨. |

**명시적 선택지 — 수정 없음:**  
Supervisor/Chief가 “후속 관측 **L** + 배포 완료로 충분, billed는 나중”으로 판단하면, 본 묶음은 **구현 TASK 없이** F 관측만 하거나 **CLOSED** 후보. 이 audit은 그 선택을 **차단하지 않음**.

---

## 5. 비목표 준수 선언

본 TASK에서 다음을 **하지 않았다**:

- 제품 코드 · 테스트 코드 · Rules · Functions · Hosting · 설정 수정
- commit / push / amend / force
- production 또는 emulator deploy / write / billed 변경
- throttle 변경 · trigger 삭제·변경 · RTDB rate 변경 · schema/rules/data migration
- 3명 이상 최적화 구현
- 이전 worktree / stash / 백업 경로 탐색

작성 산출물: **`02-result-remaining-opportunity-audit.md` 한 파일만** (본 문서).

---

## 6. 범위 밖 발견 (기록만 · 미구현)

1. `routeActivityOnLivePublicationRideWritten.ts` 소스가 **매 논리 줄 사이 빈 줄**이 많은 형태(가독성). 동작 주장과는 무관 · 포맷 정리 범위 밖.
2. 클라이언트 `TRAIL_LIVE_PROGRESS_MIN_DELTA = 0.005` vs 서버 `PROGRESS_AGGREGATE_MIN_DELTA = 0.012` 불일치 — 27과 동일하게 잔존 (**C**). listing과 무관.
3. Functional F7 hub UI secondary TIMEOUT — 최종 보고에 이미 잔여; 본 audit에서 재실행·재확인 안 함.
4. 3 rider Chief **L** 수치는 참고만 — 비용식·다음 구현 범위 자동 확대 금지.

---

## 7. 다음 행동 제안 (Supervisor용)

구현 지시 초안이 아니라 **측정·설계·Chief 질문** 분기:

1. **즉시:** 본 결과 검수. git에 결과 md 외 dirty 없는지 확인 (Developer는 commit하지 않음).
2. **권장 다음 창:** **F** — production phase-aligned 1v2 관측 프로토콜 TASK (write/deploy 없음 또는 read-only console). 완료 전 A/B/D 구현 지시 열지 말지 결정.
3. **Chief 질문 (구현 전):**
   - 후속 **L**만으로 “추가 저감 불필요(수정 없음)”인가, 아니면 billed/Console 귀속(**F**)까지 필요한가?
   - **A** pulse/anchor 대체 설계를 검토할 의사가 있는가?
   - **D** 정지 적응형을 품질 위험 감수하고 볼 의사가 있는가?
4. **열지 말 것 (현 증거):** FS **8–10s** · 현재 Trail FS listener disable · 3명+ 최적화 구현 · Chief **L**과 emulator를 한 표로 섞은 절감 확정.

---

## 한 줄 요약

배포 후 tip 기준 잔여 레버는 **(F) production 귀속 관측 → (A) routeActivity Written 수술 설계 → (D) RTDB 정지 적응형** 순이 유력하고, **B(추가 FS throttle)·C(구조)·E(cleanup)** 는 현 증거상 우선순위 낮거나 비권장이며, **수정 없음**도 정식 선택지로 남는다. 테스트·코드 변경·deploy는 본 TASK에서 수행하지 않았다.
