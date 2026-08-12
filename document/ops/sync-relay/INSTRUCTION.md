# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3B-2R 보고서는 **감리가 `REPORT-S3B2R.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** (rider 전용 규율은 해당 없음).

- **지시번호**: S3B-3 (D-2 — 저줌 적분 유지 + spectator 실제속도 + **시간 기준 정리**)
- **발신**: 클로드감리0812 · **일시**: 2026-08-12 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `20f16a1`

---

## 0. 출발점 — S3B-2 는 채택됐다 (재조사 금지)

Chief 결정(`HANDOFF` §3-9)이다. **이 세 줄이 이번 작업의 전제다.**

```
D-1 채택      발행 speedMps 는 이제 rAF 적용속도다. 되돌리지 마라
판정 규칙     동일 빌드 3 런의 중앙값으로 기술 판정한다      ← 이번에도 이 규칙이다
예산 유지     D_eff ≤350 · RMSE ≤1.0 · max ≤2.5 · 스케일 ≤10 %
현재 중앙값   z15-depart 340 · z15-cruise 300               ← 이번에 지킬 회귀 기준선
```

**단일 런 수치로 회귀를 주장하지 마라.** depart `D_eff` 는 같은 빌드에서 340~400 을 오간다.

### 0-1. 이번이 D 계열의 마지막이다

```
D-0  S3B-1 종결   D-1  S3B-2 종결   D-2  ← 이번
```

**그래도 「멀티라이더 위치 동기화 결함 종결」이라고 쓰지 마라.** F-1·F-2·S4 가 남아 있다.

---

## 1. 고칠 것 — 셋. **순서를 지켜라**

순서에 이유가 있다. **가를 먼저 넣지 않고 나를 넣으면 시계 오차가 6 배로 커진다**(`HANDOFF` §3-6-3).

### 1-가. 시간 기준 정리 — **먼저** (혼합 시계 제거)

```ts
// useTrailLivePublicationRideSpectatorOverlay.ts:155-156   ← 현재
const sampleAtMs = r.lastSeenAtMs ?? Date.now();          // 서버 시계 (serverTimestamp)
const elapsedSec = Math.max(0, (Date.now() - sampleAtMs) / 1000);   // 로컬 시계
```

**두 시계를 뺀 값이다.** 지금은 5 km/h 외삽이라 오차가 눌려 있을 뿐이다.

**정본** — 경과 시간은 **같은 시계의 두 값**으로만 잰다. 행이 클라이언트에 **도착한 로컬 시각**을
구독 매핑 지점(`firestoreTrailLivePublicationRides.ts:104` 부근)에서 붙여라.

```
추가 필드   receivedAtLocalMs: number      // 매핑 시점의 Date.now()
경과        Date.now() - receivedAtLocalMs
서버 시계   lastSeenAtMs 는 stale/가시성 판정에만 남긴다 — 외삽 계산에서 참조 금지
```

**같은 결함이 한 곳 더 있다** — `useWorldLivePublicationRideMapOverlay.ts:255-257`.
**두 곳 모두 고쳐라.** 하나만 고치면 저줌 월드 뷰가 그대로 남는다.

### 1-나. spectator 외삽을 실제 속도로

```ts
// :159 · useWorldLivePublicationRideMapOverlay.ts:257   ← 현재
anchorDistM + (PEER_EXTRAP_DEFAULT_SPEED_KMH / 3.6) * elapsedSec   // 고정 5 km/h
```

```
속도      r.speedMps 가 유한하면 그것을 쓴다. 아니면 0 (움직이지 않는다)
          ← 5 km/h 폴백 금지. 모르면 멈춰 있는 게 맞다
phase     paused · completed 는 0
상수      PEER_EXTRAP_DEFAULT_SPEED_KMH 의 값을 바꾸지 마라. 참조만 끊어라
          미사용이 되면 export 는 그대로 둔다 — 삭제는 별건이다
```

**외삽 상한을 반드시 함께 넣어라.** 지금은 상한이 없다. 5 km/h 일 때는 티가 안 났지만
30 km/h 로 바꾸면 **낡은 행이 코스 끝까지 혼자 달려간다.**

```
SPECTATOR_MAX_EXTRAP_MS = 3000        ← 감리가 정한다. Chief 에게 묻지 마라
   근거: 소스가 Firestore 1 Hz 이고, pt9 실측 fsWriteRttMs 가 depart p50 2434~3056 ms 다
         (HANDOFF §3-8). 1 s 주기 + 실측 RTT 를 덮되 그 이상은 추측이므로 자른다
초과 시   그 지점에 정지한다. 점을 지우지 마라 — 가시성 판정은 별도 규칙이다
```

`rideSyncPolicy.ts` 에 **새 상수 1 개 추가**는 허용한다. **기존 상수 수정은 금지**다.

### 1-다. 저줌에서 peer 적분 유지

```ts
// MapView.tsx:2258
const showPeerSprites = mapZoomRef.current > MAP_PEER_SPRITE_MIN_ZOOM;
const fc = showPeerSprites ? stepPeerDriveAndBuildGeoJson(...) : EMPTY_GEOJSON_FC;
```

`stepPeerDriveAndBuildGeoJson`(`peerRidersDrive.ts:51-54`)이 `pruneInactive` · `step` · 렌더를
**한 덩어리로** 하고 있어, 저줌에서 **적분까지 멈춘다.** 복귀하면 peer 가 순간이동한다.

```
적분·prune   zoom 과 무관하게 매 프레임 돈다
렌더 출력    showPeerSprites 가 false 면 EMPTY 를 반환한다   ← 화면 동작은 그대로
```

**금지 — 새 타이머·setInterval 로 적분을 돌리지 마라.** 기존 rAF `dt` 경로 그대로 쓴다.
탭 숨김에서는 rAF 가 멈추는 것이 **정상이고 필요한 동작**이다. 탭 숨김에서는 구독이 통째로
해제되므로 적분을 유지하면 **데이터 없이 외삽이 폭주한다**(`HANDOFF` 순서 의존 2).
`dt` 클램프(`PeerMotionRegistry.ts:94` 의 `0.12`)를 바꾸지 마라.

### 1-라. F-1 함정을 반복하지 마라

`spectatorDots` memo 는 지금 **데이터가 바뀔 때만** 재계산된다. 상한(§1-나)을 시간만으로
적용하려면 티커가 필요할 수 있다. **넣는다면 초기값은 반드시 `Date.now()` 다.**
`useState(0)` 으로 시작하면 첫 1 초 동안 경과가 음수가 되어 **죽은 peer 가 살아 보인다**
(F-1 과 같은 사고). 티커 주기는 1 s 로 하고, **행이 없으면 걸지 마라.**

---

## 2. 측정 — 3 런 · 두 경로를 나눠서

### 2-1. z15 회귀 (기존 경로)

**S3B-2R 과 같은 조건·같은 하네스로 3 런.** 중앙값으로 판정한다.

```
조건 고정   skew=0 · 앞 2 s 폐기 · maxDelayMs=3000 · 겹침 ≥0.7 · workers=1
            전제 Δ(A.self) ≥100 m · 창 ≥20 s
```

### 2-2. 저줌 — **두 경로에 같은 예산을 적용하지 마라**

이 구분이 이번 측정의 핵심이다. 섞으면 판정이 무의미해진다.

```
경로 A  peer sprite (RTDB 10 Hz · registry 적분)     ← 예산 적용 가능
        z13 으로 내렸다가 z15 로 복귀했을 때 peer 위치가 튀지 않는가

경로 B  spectator dot (Firestore 1 Hz · 외삽)        ← 예산 적용 불가
        소스가 1 Hz 이고 실측 write RTT 가 2.4~3.0 s 다. D_eff ≤350 은 구조적으로 불가능하다
        「before/after 개선」으로만 판정한다. 예산 미달을 FAIL 로 적지 마라
```

**경로 B 에 예산을 억지로 적용해 FAIL 을 만들지도, 예산을 완화하지도 마라.** 성격이 다르다.

### 2-3. 낼 수치

```
경로 A   저줌 체류 15 s 후 z15 복귀 직후 peer 표시 위치 vs A 실제 위치의 오차
         before(현재 빌드) / after 각각 3 런 · 중앙값
         복귀 직후 첫 프레임 점프량(m) 과 정착까지 걸린 시간(ms)

경로 B   spectator dot 위치 vs A 실제 위치의 오차 p50/max
         before(5 km/h 고정) / after(실제속도+상한) 각각 3 런 · 중앙값
         상한 히트율(%) · 외삽 경과시간 p50/p95
         시계 혼합 제거 확인 — receivedAtLocalMs 경로만 쓰는지 코드와 계측 양쪽으로
```

**계측은 기존 `peerSyncChainLog` 를 재사용한다. 새 로깅 프레임워크 금지.**
필요하면 방출점 하나(pt10)를 pt9 와 같은 형태로 추가한다. `import.meta.env.DEV` 게이트 필수.

---

## 3. 수용 조건 — 전부 충족해야 PASS

```
가.  §1-가 두 곳(trail·world) 모두에서 외삽 경과가 단일 시계로 계산된다
     lastSeenAtMs 가 외삽 산식에서 사라졌음을 코드로 보여라

나.  §1-나 spectator 속도가 r.speedMps 이고, 미상·paused·completed 는 0 이다
     SPECTATOR_MAX_EXTRAP_MS = 3000 상한이 동작한다(히트 관측 또는 미도달 근거)

다.  §1-다 저줌에서 적분이 유지되고, 렌더만 꺼진다
     복귀 점프량 중앙값이 예산 max 2.5 m 이내

라.  경로 B 가 before 대비 개선됐다 — 오차 p50·max 둘 다 감소

마.  z15 회귀 (3 런 중앙값)
     z15-depart · z15-cruise   D_eff ≤350 · RMSE ≤1.0 · max ≤2.5 · 스케일 ≤10 %

바.  회귀 가드 (3 런 전부)
     inFlightMax ≤1 · A_firstOutOfOrder =0 · 전진 폐기 =0 · pt3 ok=0 =0 · pt9 ok=0 =0
     publishQueueMs p50 ≤150 · p95 ≤400 · max ≤800 · 1 s 초과 0 %
     d0-duplicate-distm PASS 유지 · d1-target-vs-applied 뒤집힌 상태 유지

사.  쓰기량   RTDB·Firestore 모두 S3B-2 사후 런 대비 ≤1.3
     ← 이번 변경은 수신·렌더 측이므로 발행량이 늘면 그 자체가 이상 신호다
```

**하나라도 깨지면 FAIL 로 보고하고 멈춰라.** 상수를 조정해 통과시키지 마라.

---

## 4. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"저줌 적분을 유지해도 복귀 점프가 줄지 않거나, spectator 를 실제 속도로 바꿔도 오차가
> 개선되지 않는다면, 「D-2 가 저줌 어긋남의 원인」이라는 감리의 귀속이 틀린 것이다."*

**원인을 찾으러 가지 말고 수치를 그대로 올려라.** 다음 판단은 Chief 가 한다.
S3A·S3B-1·S3B-2 에서 감리 예측이 틀린 적이 이미 두 번 있다(외삽 점유·Firestore 증폭).

---

## 5. 보존

```
document/ops/sync-relay/S3B3-before-run{1,2,3}-events.json   현재 빌드 3 런 (변경 전)
document/ops/sync-relay/S3B3-after-run{1,2,3}-events.json    변경 후 3 런
document/ops/sync-relay/S3B3-summary.json                    §3 판정 · 경로 A/B 분리 · 중앙값
```

표본 추출 금지. 방출한 것은 전부 보존한다.

---

## 6. 커밋 분할 — 이 순서로 나눠라

```
① 시간 기준 정리 (receivedAtLocalMs · 외삽에서 서버 시계 제거)   ← 단독
② spectator 실제속도 + SPECTATOR_MAX_EXTRAP_MS
③ 저줌 적분 유지 (렌더만 게이트)
④ 계측·측정 산출물·보고
```

한 커밋에 섞지 마라. ① 없이 ② 를 먼저 넣지 마라.

---

## 7. 금지

- **예산·판정 규칙 변경** — 예산 4 종, 3 런 중앙값 규칙. 손대면 이 작업선 전체가 무효다
- `SPEED_PUBLISH_DELTA_MPS` · `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` · `METRICS_UI_MS` ·
  `PEER_INTERP_DELAY_MS` · `PEER_INTERP_MAX_EXTRAP_MS` · `PEER_EXTRAP_DEFAULT_SPEED_KMH` ·
  `MAP_PEER_SPRITE_MIN_ZOOM` · `dt` 클램프 **값 변경** (신규 상수 1 개 추가만 허용)
- **D-0 · D-1 배선 되돌리기** · `integrator.ts` 분기·dedup 조건 변경
- single-flight · latest-wins · RTDB 구독 방식 변경 · `onValue` → child 전환
- **새 타이머로 적분 구동** · 탭 숨김 중 적분 유지
- 발행 경로(`liveLocationSnapshot.ts` · `publishLiveLocationFanout.ts` · publish session) 수정
  — 이번은 **수신·렌더 측**이다. 발행을 건드려야 한다고 판단되면 고치지 말고 보고하라
- F-1 · F-2 수정 (§1-라 는 **새 티커를 넣을 때의 규율**이지 F-1 을 고치라는 뜻이 아니다)
- S4 · Orchestrator 를 이번 작업에 섞기 · 새 로깅 프레임워크 신설 · 표본 추출
- 작업공간의 **오케스트레이션 관련 미커밋 파일**(`document/260812-AI-오케스트레이션-*`,
  `scripts/claude-report-audit.mjs`, `document/ops/sync-relay/AUDIT.md`) **읽기·수정·삭제·커밋**
  — 다른 작업선의 사용자 변경이다. 충돌만 피하라
- cyclefit 자산·코드·스킬 일체 수정 · `main2` 병합 · PR · `--no-verify`

---

## 8. 보고

**새 `REPORT.md` 만 작성한다.**

### 8-1. 첫머리는 평문이다 — 수치 표보다 먼저

**「화면에서 무엇이 어떻게 좋아졌는가」를 지표 없이 3~5 줄로 먼저 써라.**
`D_eff` · RMSE · p95 같은 말을 쓰지 말고, 사용자가 지도에서 보는 것으로 설명하라.

```
예시 형태   "지도를 축소했다 확대하면 동행 라이더가 제자리에서 순간이동하듯 튀었는데,
             이제 튀지 않고 이어서 달린다. 멀리서 보는 다른 주행자 점은 실제보다
             느리게 기어가다 갑자기 따라잡았는데, 이제 실제 속도로 움직인다."
```

**과장 금지.** 개선되지 않았으면 개선되지 않았다고 평문으로 써라.

### 8-2. 그 다음

```
반증  §4 해당 여부 — 평문 다음, 표보다 먼저

UAG   §3 가~사 판정표
      한 줄 결론은 「S3B-3 PASS(D-2 교정) · z15 유지」 형태로
      「멀티라이더 위치 동기화 결함 종결」이라고 쓰지 마라 — F-1·F-2·S4 가 남았다

기술  구현 요약 (시간 기준 · 상한 · 저줌 게이트 분리 · 티커 유무)
      경로 A / 경로 B before-after 대조 (3 런 중앙값 · 런별 값도 함께)
      z15 3 런 분포 · 가드 · 쓰기량
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋 4 개
```

**「부분 성공」은 없다.** §3 가~사 가 전부 충족될 때만 PASS 다.
**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라. 런별 실행 시간을 분 단위로 적어라.**
