# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S3B-3 보고서는 **감리가 `REPORT-S3B3.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG** (rider 전용 규율은 해당 없음).

- **지시번호**: S4-1 (route 발행 in-flight 제거 — Firestore 쓰기 폭주)
- **발신**: 클로드감리0812 · **일시**: 2026-08-12 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · 기준 HEAD `d2586e8`

---

## 0. 출발점 — D 계열은 끝났다 (재조사 금지)

```
D-0  S3B-1 채택   D-1  S3B-2 채택   D-2  S3B-3 채택
판정 규칙   동일 빌드 3 런 중앙값 (Chief 결정)
회귀 기준선  z15 depart 300 · cruise 300   (3 런 중앙값 · S3B-3 실측)
경로 B 기준선 spectator dot 오차 p50 57.0 m · max 87.0 m   (3 런 중앙값 · S3B-3 실측)
```

**이번은 비용 단계다.** 위치 정확도를 더 좋게 만드는 것이 목표가 아니라 **나빠지지 않게 두고
쓰기를 줄이는 것**이 목표다.

### 0-1. S4 는 3 단계로 나눈다 — 이번은 첫째뿐

```
S4-1  route 발행 in-flight 제거          ← 이번
S4-2  읽기 증폭 (컬렉션 전체 구독 N² · RTDB 부모 onValue · 전역 collectionGroup)
S4-3  touchTrailInstanceActivity · heartbeat 상수 재검토
```

**S4-2·S4-3 을 이번에 손대지 마라.** 발견해도 고치지 말고 보고에 적기만 해라.

---

## 1. 고칠 것 — 하나

### 1-1. 확정된 사실 (감리 코드 확인 · 재조사 금지)

```
useLiveLocationPublishSession.ts:249    await publishLiveLocationFanout(...)
                              :256-263  markRouteProgressPublished(...)   ← await 뒤에서 갱신
publishLiveLocationFanout.ts:67         await mergeTrailLivePublicationRideSnapshot(...)
```

await 가 도는 동안 `throttle` 의 route 타임스탬프가 **옛 값**이다. 100 ms tick 이 1 s heartbeat
게이트를 한 번 지나면 **그 뒤 tick 이 전부 통과**한다. **S3A 가 motion 에서 없앤 구조가 route 에
그대로 남아 있다.**

pt9 실측이 이와 맞물린다 — depart **3.95~5.05 writes/s**(1 Hz 기대) · **write RTT p50 2.4~3.0 s**.
같은 런의 RTDB write RTT 는 **~200 ms** 다.

### 1-2. 요구사항

```
가. route 발행에 in-flight 가드를 넣는다
    쓰기가 진행 중이면 새 route 발행을 시작하지 않는다

나. 게이트 갱신을 await 앞으로 옮긴다
    markRouteProgressPublished 를 「쓰기를 시작할 때」 호출한다
    ← S3A 가 motion 에서 쓴 관용구와 같다 (motionPublishFlight 의 onWriteStart)

다. latest-wins 를 유지한다
    대기 중 새 스냅샷이 오면 최신 것으로 덮는다. 큐를 쌓지 마라

라. 실패 처리를 삼키지 마라
    F-2 의 재발 금지 — 쓰기 실패는 pt9 ok=0 으로 반드시 방출되어야 한다
    catch 없이 void 로 던지지 마라
```

**motion 의 `motionPublishFlight.ts` 를 참고하되 그 파일을 수정하지 마라.** route 는 별도 경로다.

### 1-3. 건드리지 말 것

```
발행 내용     스냅샷 필드·값·산식 일체. 이번은 「언제 쓰는가」만 바꾼다
상수          TRAIL_LIVE_PROGRESS_HEARTBEAT_MS · SPEED_PUBLISH_DELTA_MPS 값
              ← 쓰기를 줄이려고 heartbeat 를 늘리는 것은 이번 수정이 아니다. S4-3 이다
motion 경로   S3A 결과물. 손대지 마라
```

---

## 2. 측정

### 2-1. before / after 각 3 런 · 중앙값

**S3B-3 과 같은 하네스·같은 조건.** before 는 현재 빌드(`d2586e8`) 그대로다.

```
조건 고정   skew=0 · 앞 2 s 폐기 · maxDelayMs=3000 · 겹침 ≥0.7 · workers=1
            전제 Δ(A.self) ≥100 m · 창 ≥20 s
```

### 2-2. 낼 수치

```
쓰기량   pt9 건수/초 — 전체 · depart · cruise 구간별
RTT      pt9 fsWriteRttMs p50/p95/max
대조군   같은 런의 RTDB write RTT (pt3)      ← 이게 핵심 대조다
겹침     route 발행 동시 진행 최대치 (in-flight max) — before 에서 몇까지 올라가는지
정확도   z15 depart/cruise D_eff·RMSE·max·스케일
경로 B   spectator dot 오차 p50/max          ← 악화 감시용
```

**`touchTrailInstanceActivity`(`publishLiveLocationFanout.ts:98`)도 Firestore 쓰기다.**
pt9 에 섞이지 않으므로 **pt11 로 따로 센다**(pt9 와 같은 형태 · `import.meta.env.DEV` 게이트).
**이번에 고치지는 마라 — 세기만 해라.** S4-3 이다.

---

## 3. 수용 조건 — 전부 충족해야 PASS

```
가.  Firestore route 쓰기   after/before ≤ 0.5        ← 절반 이하로 줄어야 의미가 있다
     그리고 cruise 구간 실측이 1 Hz heartbeat 기대(≈1.0 /s)에 수렴한다

나.  route in-flight max ≤ 1  (after 3 런 전부)

다.  pt9 ok=0 = 0 · pt3 ok=0 = 0   (실패가 조용히 사라지지 않았다는 증거)

라.  정확도 회귀 금지 (3 런 중앙값)
     z15-depart · z15-cruise   D_eff ≤350 · RMSE ≤1.0 · max ≤2.5 · 스케일 ≤10 %

마.  경로 B 악화 금지 (3 런 중앙값)
     spectator dot 오차 p50 ≤ 57.0 m · max ≤ 87.0 m    ← S3B-3 기준선
     ⚠ 쓰기를 줄이면 갱신이 드물어져 여기가 나빠질 수 있다. 나빠지면 FAIL 이다

바.  회귀 가드 (after 3 런 전부)
     inFlightMax(motion) ≤1 · A_firstOutOfOrder =0 · 전진 폐기 =0
     publishQueueMs p50 ≤150 · p95 ≤400 · max ≤800 · 1 s 초과 0 %
     d0-duplicate-distm PASS 유지 · d1-target-vs-applied 뒤집힌 상태 유지

사.  RTDB 쓰기량   after/before ≤ 1.3   (route 를 고쳤는데 motion 이 늘면 이상 신호다)
```

**상수를 조정해 「가」를 통과시키지 마라.** heartbeat 를 늘려서 줄인 쓰기는 이번 성과가 아니다.

---

## 4. 반증 조건 (해당하면 즉시 보고하고 멈춰라)

> *"in-flight 가드를 넣었는데 **write RTT 가 그대로 2.4~3.0 s** 라면, RTT 는 겹친 쓰기 때문이
> 아니라 에뮬레이터·Firestore 자체 특성이다. 「겹침이 RTT 를 키운다」는 감리의 예측이 틀린 것이다."*

**대조군은 같은 런의 RTDB RTT(~200 ms)다.** 쓰기 건수는 줄었는데 RTT 가 안 줄었다면
그 사실을 그대로 올려라 — **쓰기 건수 감소만으로도 「가」는 성립한다.** RTT 는 별개 관측이다.

**원인을 찾으러 가지 마라.** 감리 예측이 이 작업선에서 이미 두 번 틀렸다(외삽 점유 · Firestore 증폭).

---

## 5. 보존

```
document/ops/sync-relay/S41-before-run{1,2,3}-events.json
document/ops/sync-relay/S41-after-run{1,2,3}-events.json
document/ops/sync-relay/S41-summary.json     §3 가~사 판정 · 구간별 쓰기량 · RTT 대조 · 중앙값
```

표본 추출 금지. 방출한 것은 전부 보존한다.

---

## 6. 커밋 분할

```
① pt11 계측 추가 (touch 쓰기 세기) — 동작 변경 없음
② route in-flight 가드 + 게이트 갱신 앞당기기
③ 측정 산출물·보고
```

**① 을 먼저 넣고 before 를 측정하라.** 계측기를 바꾸고 before/after 를 비교하면 무효다.

---

## 7. 금지

- **예산·판정 규칙 변경** (예산 4 종 · 3 런 중앙값 규칙)
- `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` · `SPEED_PUBLISH_DELTA_MPS` · `METRICS_UI_MS` ·
  `PEER_INTERP_*` · `SPECTATOR_MAX_EXTRAP_MS` · `MAP_PEER_SPRITE_MIN_ZOOM` **값 변경**
- **발행 내용 변경** — 스냅샷 필드·값·산식. 이번은 「언제 쓰는가」만이다
- **motion 경로 수정** (`motionPublishFlight.ts` · `rtdbTrailMotion.ts` · single-flight 구조)
- **D-0 · D-1 · D-2 배선 되돌리기** · `integrator.ts` · `spectatorRideExtrap.ts` 산식 변경
- **S4-2 · S4-3** — 읽기 증폭 · `touchTrailInstanceActivity` 수정 · heartbeat 재검토. **세기만 해라**
- F-1 수정 · Orchestrator · 새 로깅 프레임워크 신설 · 표본 추출
- **`MapView.tsx` 의 파일 전역 `eslint-disable` 확대·다른 파일에 같은 수법 적용**
  — 이미 부채로 기록됐다. 늘리지 마라. 훅이 막으면 고치지 말고 보고하라
- 작업공간의 **오케스트레이션 관련 미커밋 파일**(`document/260812-AI-오케스트레이션-*`,
  `scripts/claude-report-audit.mjs`, `document/ops/sync-relay/AUDIT.md`) **읽기·수정·삭제·커밋**
- cyclefit 자산·코드·스킬 일체 수정 · `main2` 병합 · PR · `--no-verify`

---

## 8. 보고

**새 `REPORT.md` 만 작성한다.**

### 8-1. 첫머리는 평문이다

**「무엇이 어떻게 달라졌는가」를 지표 없이 3~5 줄로 먼저 써라.** 이번은 화면이 아니라 **비용**이므로,
「초당 몇 번 쓰던 것이 몇 번이 됐고, 화면에서 보이는 것은 그대로다」처럼 **사용자·운영자가 알아들을
말**로 써라. 개선되지 않았으면 그렇게 써라. 과장 금지.

### 8-2. 그 다음

```
반증  §4 해당 여부 (RTT 가 줄었는지 그대로인지 — 양방향) — 평문 다음, 표보다 먼저

UAG   §3 가~사 판정표
      한 줄 결론은 「S4-1 PASS(route 쓰기 폭주 제거) · 정확도 유지」 형태로
      「비용 종결」·「멀티라이더 위치 동기화 결함 종결」이라고 쓰지 마라 — S4-2·S4-3·F-1·F-2 가 남았다

기술  구현 요약 (가드 구조 · 게이트 갱신 시점 · 실패 방출 경로)
      쓰기량 before/after 구간별 · RTT before/after · RTDB 대조군
      in-flight max before/after (before 가 몇까지 올라갔는지 반드시 적어라)
      z15 3 런 분포 · 경로 B 3 런 분포 · 가드
      pt11 관측치 (touch 쓰기 /s — 판정 미사용, S4-3 이월)
      보존 파일 경로 · 실패·미완 전수 · 이견 · 커밋 3 개
```

**「부분 성공」은 없다.** §3 가~사 가 전부 충족될 때만 PASS 다.
**e2e 는 백그라운드로 던지고 산출물 파일만 확인하라. 런별 실행 시간을 분 단위로 적어라.**
