# peer-sync Replay 하네스 — 도구 사용법 (HOW)

이 폴더(`apps/web/scripts/peer-sync/`)는 동행 peer 위치 동기화(보간)를 **실주행·앱 구동 없이**
패킷 로그로 재생·검증하는 오프라인 하네스다. **언제·왜 쓰는가**는
[`.claude/skills/peer-sync/SKILL.md`](../../../../.claude/skills/peer-sync/SKILL.md)를 보라 — 이 문서는 **어떻게 쓰는가**만 다룬다.

핵심: 검증 대상 순수 함수(`src/lib/peerMotion/integrator.ts`·`mergePackets.ts`·`rideSyncPolicy.ts`)를
**vite `ssrLoadModule` 로 소스 그대로 로드**한다. 그래서 하네스가 통과시키는 코드 = 프로덕션이 실제로 도는 코드.
별도 컴파일·목(mock) 없음. 모두 `apps/web/`에서 실행.

## 파일

| 파일 | 역할 |
|---|---|
| `replay.mjs` | 오케스트레이터 — 시나리오를 재생 → `--check`(불변식, exit 0/1) + `--graph`(PNG) |
| `scenarios.mjs` | 내장 시나리오(+ S2 5종: 출발램프·정속30·감속·일시정지·저줌) |
| `s1-metrics.mjs` | D_eff / residual 산출 |
| `s2-recompute.mjs` | S1 원시로그 재계산(maxDelay 5k/10k, z13 제외) |
| `s2-accuracy-gate.mjs` | z15-cruise 실로그 → integrator 재현 ±20% 수용 게이트 |
| `invariants.mjs` | 재생 타임라인의 기계적 PASS/FAIL 판정(clamp·역행·순간이동·외삽상한) |
| `graph.mjs` | distM-vs-time SVG 생성 + chromium PNG 렌더 |
| `.out/` | 그래프 산출물 PNG/SVG(gitignore — 휘발성 검토용) |

## 실행

```bash
cd apps/web && node scripts/peer-sync/replay.mjs [--check] [--graph] [--scenario <name|path>] [--out <dir>]
```
- 무옵션 = `--check --graph` 둘 다.
- `--check`: 전 시나리오 불변식 판정. known-fail 외 위반이 있으면 exit 1. 커밋 전 게이트로 쓴다.
- `--graph`: `.out/peer-timeline.png`(+svg) 생성. **Read 툴로 PNG 를 열어** 파란선(보간)이 회색점(수신 패킷)을 ~DELAY 뒤에서 매끄럽게 따라가는지 눈으로 본다.
- `--scenario <name>`: 내장 시나리오 하나만. `<path>`(json)면 외부 로그 재생.

출력 기호: `✓` 통과 · `✗` 위반(실패) · `~` known-fail(예상된 위반, 통과 처리) · `!` known-fail 인데 통과(고쳐졌으니 `expectFail` 제거하라는 신호).

## 시나리오 추가 (회귀 고정)

새 sync 결함을 만나면 그 패킷 시퀀스를 `scenarios.mjs` 에 추가한다:
- 이벤트 = `{ atMs, packet }[]`. `atMs` = 수신 측 시계(Date.now) 기준 ms. `packet` = `PeerMotionPacket`(`src/lib/peerMotion/types.ts`).
- 등속 구간은 `steady({...})` 헬퍼로. 불연속·정지·완주는 그 뒤에 이어 붙인다.
- **아직 안 고친 버그**면 `expectFail: true` 를 달아 known-fail 로 고정 → CI 는 통과, 고쳐지면 `!` 로 알림.

실주행 로그를 재생하려면 `PeerMotionPacket` 배열을 `{ name, routeLenM, events:[{atMs,packet}] }` JSON 으로 만들어 `--scenario <path>`.

## 시간 주입 방식 (주의)

`applyPeerMotionIngest` 는 내부에서 `Date.now()` 를 `recvAtMs` 로 쓴다. 재생 결정성을 위해
`replay.mjs` 가 재생 중 전역 `Date.now` 를 이벤트 시각으로 스텁하고 끝나면 복원한다(소스 무수정).
`stepPeerMotionEntity` 는 `nowMs` 파라미터로 직접 주입한다.

## RTDB↔FS 소스 선택 (TASK-30B) · both-stream liveness (TASK-30C)

주식 `replay.mjs` 는 단일 패킷 스트림만 재생한다. RTDB freeze 후 FS 폴백·양방 정지 liveness 는
**실제** `syncPeerMotionFromPresence` + `PeerMotionRegistry` 경로가 필요하므로 별도 Vite SSR 하네스.

행렬(30B): FS 수신 간격 1/4/8/10s × 송신 시계 ±30s/0 × moving/stationary × silent-freeze/hard-error (+ recovery retake).

행렬(30C): both-stream-stop × moving/stationary × ±30s/0 — frozen 재배달 후 15s 내 소멸.

```bash
cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs
cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite both-stop
cd apps/web && node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite fallback
cd apps/web && node --test scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs
```

선택: `selectPeerMotionPacketForIngest` + `noteRtdbContentObservation` — **수신 측 RTDB 내용 변화 시각**만 사용 (송신 `t` / FS `serverTimestamp` 교차 비교 금지).
이중 소스 ingest stamp: `stampDualSourceIngestPacket` — 동일 source 는 `native+offset`(Δt 보존),
source 전환·최초만 now 정렬. frozen 재배달·같은 자세 소스 전환은 stamp 유지(TASK-30C).
**매 신규 패킷 `nowMs` 재지정 금지**(TASK-02).

## 등속 간격 진동·소스 전환 (TASK-02/03 · **pre-push 게이트** · 2026-10-05)

주식 `replay.mjs` / smoothness 계약은 **단일 스트림**이라 `stampDualSourceIngestPacket` 을 우회한다
(`scenarios.mjs` 사각 주석 참고). 도착축 stamp 로 되돌려도 그 계약들은 초록이다. 실제 Presence 경로
(RTDB+FS 동시) 회귀는 **아래 npm 스크립트가 실제 게이트**다 — 산문이 아니라 `githooks/pre-push`
(`touch_web` 일 때 `test:next-ride` 다음)가 `npm run test:peer-spacing --silent` 를 실행한다.

```bash
cd apps/web && npm run test:peer-spacing            # = --gate && --suite transitions  (pre-push 가 호출, ~10s)
cd apps/web && npm run test:peer-spacing:mutation   # 게이트가 살아 있는지 FAIL 증명(파괴적 — pre-push 에 넣지 않음)
cd apps/web && npm run test:peer-two-view           # 두 창 순서 일치 측정(게이트 아님, 아래 §두 창)
```

### `--gate` (필수 셀만, requiredFail 이면 exit 1)

```bash
cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --gate
```

- dual × 200ms × 송신시계 −30s/0/+30s × 지터 none/sin/bundle (9셀)
- single × 200ms × 0 × sin (baseline)
- dual 200ms sin **no-seq** (프로덕션 wire)

판정은 **안정 구간(12–40s)**: 간격 pp ≤ 0.5m · 화면 속도 송신 ±20% · 역행 · 순간이동. 시작 구간(0–5s)은 JSON 에
따로 남는다(warmup 으로 숨기지 않음). **3000ms 는 게이트에 없다** — `interval > PEER_MOTION_RTDB_SOURCE_STALE_MS(2500)`
는 policyConflict 이며 성공이 아니다(게이트에서는 requiredFail 로 센다). 전체 행렬(100/200/1000/3000ms, 진단용)은 무옵션 실행.

### `--suite transitions` (소스 전환 결정적 시험)

```bash
cd apps/web && node scripts/peer-sync/peer-spacing-jitter-harness.mjs --suite transitions [--strict] [--fs-interval 4000]
```

실제 sync→Registry 경로에서 20km/h 등속 송신(200ms·sin 지터) 중에 **RTDB-only(0–20s) → dual(FS 등장, 20–36s) →
FS-only(RTDB 침묵, 36–60s) → dual again(RTDB 복귀, 60–84s)** 을 재생한다. RTDB 침묵은 `frozen`(마지막 행 재배달)·
`cleared`(행 없음) 두 방식, 송신시계 −30s/0/+30s, 그리고 no-seq 한 셀(총 7셀). 각 구간의 warmup 이후 안정 창에서
속도 ±20%·역행·순간이동을 판정하고, **선택된 소스가 기대와 맞는지**(≥90% 프레임)도 확인해 전환이 실제로 일어났음을 보인다.
FS 수신 간격은 1s — 프로덕션 steady 4s 는 적응 지연 상한(3s)보다 길어 FS-only 에서 외삽→hold 가 정책상 불가피하다(stamp 와 무관).

**TASK-03 A2 수정**: 단일 소스 패킷도 `stampDualSourceIngestPacket` 을 타며, 단일 소스로 떨어질 때 stamp 맵을 지우지 않는다.
이전에는 RTDB-only(raw 송신축) → dual 진입 시 +30s 송신시계에서 clockOffset 이 붕괴했다(속도 0~13.9 m/s). 전환 7셀 전부 필수 게이트.

### `test:peer-spacing:mutation` (게이트 생존 증명)

`stampDualSourceIngestPacket` **한 함수만** 임시 파일에 백업 → 수정 전 버그 동작(내용 변경마다 `serverAtMs = nowMs`)으로
치환 → `--gate` 를 돌려 **exit≠0 이어야** 하고 → `finally` 로 그 함수만 복원(크래시·Ctrl-C 포함, 다음 실행이 잔여 변이를 복구) →
복원 후 같은 하네스·같은 fixture 로 POST 게이트가 PASS 여야 exit 0. 변이에도 PASS(죽은 게이트)·크래시·복원 실패는 exit 1.
산출: ops 묶음의 `peer-spacing-jitter-metrics-rework-{pre,post,compare}.json` (기존 pre-fix/post-fix 는 보존).

### 왜 interval ≥1000ms 에는 간격 pp 게이트가 **없는가** (A3)

적응 지연 = max(160, min(3000, gapEma×2.2)). 1s 송신이면 목표 지연 ≈2200ms 이고 self 는 지연 0 으로 즉시 그려지므로
self(now)−peer(과거) 평균 뒤처짐이 지연×속도(20km/h 에서 ≈12m)로 커진다. 더구나 실제 재생 지연(`now − renderClock`)은
목표를 **±10%/s 로만** 따라가므로 12–25s 구간에도 아직 움직이고 있다. 그래서 pp 는 stamp 회귀 신호가 아니라 **지연 정책 + 재생 시계
수렴의 산물**이다(stamp 를 도착축으로 되돌려도 같은 크기가 난다). **6.71m 를 「안정 간격」이라 부르지 않는다.**
1000ms 는 속도·역행·순간이동만 게이트하고 pp 는 기록한다. 창별 지연 지표는 `--suite delay`(dual 200/1000 sin off0) 또는
각 셀 JSON 의 `delayConvergence`(0–5 / 5–12 / 12–25 / 25–40s 의 mean·std·min·max, 12–40s pp, convergeTimeMs).

실측(sin·off0): 200ms 목표 지연 ≈440ms(12–40s pp 46ms, 수렴 2.6s). 1000ms 목표 지연 ≈2200ms(12–40s pp 223ms, 수렴 15.2s)이나
실제 재생 지연은 0–5s 241ms → 5–12s 753ms → 12–25s 1728ms → 25–40s 2199ms 로 **25s 이후에야** 목표에 닿는다(12–40s 변동 1214ms).

### 같은 fixture PRE/POST (A4)

`peer-spacing-mutation-failcheck.mjs` 가 변이 상태에서 `--gate --out …rework-pre.json`, 복원 후 `--gate --out …rework-post.json`
(**같은 하네스 파일·같은 셀·같은 구간**; compare JSON 에 하네스 sha256 기록). dual 200ms sin/bundle off0 안정 창 표를 compare JSON 에 담는다.

### 두 창 순서 일치 (B) — `two-view-order-harness.mjs`

독립 Vite 모듈 그래프 2개(창 A/B 각자 Registry 싱글턴·dualIngestStamp 맵)로 **self 즉시 / peer 현행 보간**을 재생해, 같은 실제
시각에 창 A 의 「A−B」(selfA−peerB_display)와 창 B 의 「A−B」(peerA_display−selfB)가 반대 부호인 프레임을 센다
(|값|<0.05m 동률). 시나리오: 등속(간격 15m/1m)·추월·속도변경(20→30→10)·비대칭 링크·±30s 기기시계·한쪽 stall.
**06 정정**: `D_A≠D_B` 일 때만 역순이 아니다 — 대칭 링크(D_A=D_B≈440ms)에서도 진실 간격 |g| < L(평균 뒤처짐 ≈2.9m=v×(편도+지연))이면
양쪽이 모두 「내가 앞」(sweep: 대역 안 불일치 100%, 밖 0%). `--policy common-timeline` 은 두 창이 같은 절대
renderTime=commonNow−D 로 self·peer 모두 그리는 **오프라인 이상화**(공통 시계 정확 가정, 제품 코드 미변경)를 현행과 비교한다.
`--policy model-d600` 은 D=600ms + 기기별 clock-estimate-error ε∈{0,±50,±100}ms 행렬 **모델**(self/peer 모두 캡처·도착 버퍼만 사용; 제품 `tSrv` wire 검증 아님).
`--policy traffic-freq-compare` 는 동일 공통축 모델로 **RTDB 200ms·D600** vs **1s·D2200** vs **1s·D600**을 비교하고 메시지 수·encode 형태 UTF-8 bytes·간격/순서/자기지연을 표로 남긴다(제품/송신 설정 미변경). `--interval` 로 단일 모델 간격도 덮어쓸 수 있다.
산출: `.out/two-view-order-metrics.json`(10Hz 타임라인 포함) · ops 묶음 `two-view-order-metrics.json`(요약만);
모델은 `.out/two-view-order-model-d600-metrics.json` · ops `two-view-order-model-d600-metrics.json`;
빈도 비교는 `.out/two-view-order-traffic-freq-compare.json` · ops `two-view-order-traffic-freq-compare.json`. 측정이므로 명백한 불변식 위반(크래시·모듈 그래프 공유·비유한 값)만 exit 1.

### 공통 표시 제품 경로 (C) — `common-display-product-harness.mjs`

**실제** encode/`tSrv`/decode/`stampDualSourceIngestPacket`(tSrv bypass)·Registry×2·`selfDisplayBuffer`·`commonDisplayClock` 경로.
self 표본은 **enqueue 직후 local**(제품 fanout), peer 만 delivery/drop. stall 시 self 는 계속.
지표는 `debugSnapshot` 반올림이 아니라 **raw `displayDistM`**. accel 속도는 거리 도함수.
특수: pauseResume · fsOnly/legacy · offsetNotReady · clockJump · oneWayStall · soloLeave.
BEFORE=self 즉시+레거시 stamp, AFTER=공통 D=600+tSrv. 이상화 MODEL 과 구분.
`npm run test:peer-common-display` · 원시 JSON `.out/common-display-product-metrics.json` · ops 동명.

### 잔여 peer 앞뒤 튐 (D) — `residual-peer-jitter-harness.mjs`

저속(5/6km/h)·등속20·pause/resume·**RTDB 침묵→FS4s 폴백**·정지/가속 폴백·bundle 지터를 **dual RTDB200+FS4s + tSrv/D600 제품 경로**로 재생.
판정은 truth 간격 drift 를 뺀 **residual(= displayGap−truthGap) pp · peer frame jump · 역행**.
`residualPp` 만 stall 창 제외 가능(FS 성김 한계 보고). **점프/역행/axisFlip 은 공백·복구 포함 전체**.
FS 추정 시각은 `tSrvQuality:"estimated"` — 권위 capture anchor 오염 금지.
`npm run test:peer-residual-jitter` · mutation: `test:peer-residual-jitter:mutation` · ops `residual-peer-jitter-metrics*.json`.
`test:peer-spacing` 체인에 포함.
DEV 진단(트래픽 없음): `await window.__rtwPeerIngestDiag.capture(20)` 후 `.download()` — **완료 payload 는 `lastCompletedCapture` 로 보존**(live ring 240 덮어쓰기와 분리). 수집 중/없음은 `status().hint`·`payloadSource`. missing: Firebase 콜백·큐·offset·camera.

### 합성 quantize-beat · wire 양자 비트 (E) — `real-paired-quantize-beat-harness.mjs`

**원본 paired JSON 을 읽지 않는** 등속 합성 시나리오(제품 encode/self/Registry). 실측 관찰(초당 ~0.1m gap)과
합성 before/after 를 **분리**한다 — 후자는 양자화의 인과적 기여 증거로만 쓴다(원본 반올림 전 거리 복구 불가).
BEFORE 0.1m → 1s-pp≈0.10m · AFTER 제품 0.01m → ≈0.008m. phase∈{0,40,80,120,160}ms × speed∈{5,6,20}km/h 악화 금지.
`--graph`: observed gap + synthetic compare PNG. mutation: `real-paired-quantize-beat-mutation-failcheck.mjs`.
encode JSON UTF-8 바이트 delta 도 동일 표본으로 기록. 증거: `evidence/real-paired-20261005/`.

DEV capture: `notePeerFrameDiag` 의 40ms 간격은 **직전 capture 저장 시각**(실제 프레임 dtMs 와 분리). 완료 export 의
카운터/maxJump 는 저장 당시 값 유지(`liveCounters` 별도). 전역 frameCap=500(두 UID 전체 — per-UID 아님).

### 한계

- **mergePackets 재생 미포함**: 현재 시나리오는 이미 병합된 단일 패킷 스트림만 넣는다. RTDB(5Hz)+Firestore livePublicationRides(4s steady, TASK-31A) **필드 병합**(`mergePeerMotionPackets`)의 clock 혼용 버그는 아직 재생 안 한다 — 두 소스 이벤트를 각각 넣고 merge 를 태우는 시나리오 타입 추가 필요. (소스 **선택**/폴백은 위 TASK-30B 하네스가 담당.)
- **R2 reconcile(soft/hard pull) 미검증**: 자기 위치 보정(`PEER_RECONCILE_*`)은 이 하네스 범위 밖.
- 실제 Firebase RTT·지터 분포는 합성(sin/bundle)이다.
- ~~**알려진 미해결 버그**: `stationary-dedup`(정지 peer ~7m 오버슛)~~ ✅ **수정됨(2026-07-22)** — stall 외삽이 `newest.speedMps`(버퍼 낡은 값) 대신 `entity.speedMps`(매 ingest 갱신)를 쓰게 함. 오버슛 7.2m→0m, `expectFail` 제거해 이제 정상 회귀 방어.
