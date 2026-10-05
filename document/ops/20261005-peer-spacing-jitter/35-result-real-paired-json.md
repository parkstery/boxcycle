# RESULT-35 — 실측 paired JSON 분석 · 양자 비트 수정 · capture 보존

담당: Cursor CLI · 지시: [34-task-real-paired-json.md](34-task-real-paired-json.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · commit/push/deploy **없음** · 브라우저 실주행 **없음**

## 판정 요약

| 항목 | 결과 |
|------|------|
| 실측 증상 | 주행 중 **초당 수회 · 1s gap pp ≈ 0.05–0.15m** (≤1m). 창 간 순서합≈0 유지 |
| 확정 원인 | wire 거리 **0.1m 양자** + 두 라이더 **독립 보간** → 발행주기(~200–300ms) 상대간격 비트 |
| 제품 수정 | `MOTION_WIRE_DIST_QUANTUM_M` **0.1 → 0.01** (송신주기·D600·FS4s 불변) |
| 재생 | BEFORE 1s-pp **0.100m** → AFTER **0.008m** (−92%) |
| capture 결함 | `lastCompletedCapture` 분리 보존 — live ring240 덮어쓰기로 20s 소실 방지 |
| 제품 해결 주장 | **재생·게이트로 인과 확인**. 최종 체감은 사용자 실주행과 구분 |

## 1. 원본·증거

복사(UID 익명화): `evidence/real-paired-20261005/rider_{A,B}.json`  
분석: `evidence/real-paired-20261005/raw-paired-analysis.json` · mid: `00-mid-evidence.md`

| | A | B |
|--|---|---|
| frames/ingest | 240/240 (legacy ring) | 240/240 |
| capture meta | **idle** (완료 20s 아님) | idle |
| atMs span | ~17.0s | ~15.5s |
| 중첩 | ~14.2s (atMs 기준, 다운로드 시각 정렬 금지) | |
| 주행 gap | mean≈−0.27m · 1s-pp mean≈0.10m | mean≈+0.26m · 1s-pp mean≈0.09m |
| 순서 | Agap+Bgap ≈ 0 (동기화 유지) | |
| wire dist | 전부 0.1m 격자 | 동일 |
| 종료 구간 | peer/self→112.1 hold · gap null 다수 — **정지/완주 분리** | |

**unknown(확정 불가):** Firebase 원본 콜백·publish 큐·clock offset·camera · ring 밖 초기 maxJump(B 115m 등) · 전체 20s capture(당시 download가 live ring만 반환).

32의 「계단 peer vs 연속 self」 가상모델은 **베끼지 않음** — 실측은 peer·self **둘 다 보간 전진**, hold/catchup 교대 아님.

## 2. 인과

1. 상대 gap 고주파 성분 pp≈0.10–0.15m ≈ **1 quantum**.  
2. dGap 주기 중앙값 ~250–300ms ≈ **RTDB 200ms 발행**.  
3. 제품 경로 시뮬(encode → selfDisplayBuffer + Registry, D600, RTT140, phase+80ms):  
   - quantum 0.1 → mean 1s-pp **0.100m**  
   - quantum 0.01 → **0.008m**  
4. display-correction 비대칭·막연 smoothing·D/주기 변경으로는 설명·수정하지 않음.

## 3. 구현 diff (좁은 범위)

| 파일 | 내용 |
|------|------|
| `motionWireQuantize.ts` | dist 양자 **0.01m** + 시험용 `__setMotionWireDistQuantumForTests` |
| `selfDisplayBuffer.ts` | 주석 0.01m |
| `peerIngestDiag.ts` | **`lastCompletedCapture`** · download/export 기본 선택 · `payloadSource` · status hint |
| `real-paired-quantize-beat-harness.mjs` | BEFORE/AFTER 재생 게이트 |
| `real-paired-quantize-beat-mutation-failcheck.mjs` | 구 0.1m mutation → harness FAIL |
| `peer-ingest-diag-capture.test.mjs` | capture 완료 후 live 400frame 에도 동일 payload 행동 시험 |
| `HARNESS.md` | 진단·양자 비트 한 줄 |

**미변경:** D600 · RTDB200 · FS4s · HUD 즉시 · solo0 · Rules/DB schema · UI 신호정책.

## 4. BEFORE / AFTER (재생)

```text
beforeMean1sPp: 0.1000 m
afterMean1sPp:  0.0080 m
reduction:      0.92
```

원시: `quantize-beat-metrics.json` · mutation: `quantize-beat-mutation-failcheck.json` (harnessExit=1 when quantum→0.1).

## 5. 시험

| 명령 | 결과 | 벽시간 |
|------|------|--------|
| `node scripts/peer-sync/real-paired-quantize-beat-harness.mjs` | **PASS** | ~2.8s |
| `node scripts/peer-sync/real-paired-quantize-beat-mutation-failcheck.mjs` | **PASS** (old FAIL) | ~5.9s |
| `node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` | **3/3 PASS** | ~7.7s |
| `npx tsc -b` | **0** | ~14s |
| `npm run test:peer-residual-jitter` | requiredFail=0 | ~4s |
| `npm run test:peer-spacing` | GATE PASS · transitions requiredFail=0 | ~10s |
| 브라우저 실주행 | **미실행** | — |

## 6. 남은 한계

- 실측 파일은 **legacy ring240 + capture idle** — 완주 직전 구간 위주. 전체 running 20s 는 이번 capture 수정 후 재수집 권장.  
- 0.01m 후에도 이론상 ~cm 잔여 비트·RTT/버퍼 성김·FS estimated 구간은 남을 수 있음.  
- maxJump 누적(초기화)과 화면 GLB/camera 는 이번 raw gap 증거의 범위 밖.

## 7. 사용자 재시험 (짧게)

양쪽 Ctrl+Shift+R 후 같은 Trail·5–6km/h 약 20s:

```js
const r = await window.__rtwPeerIngestDiag.capture(20)
window.__rtwPeerIngestDiag.download()  // payloadSource=last-completed, 이후 주행해도 보존
```

기대: 초당 서브미터 「툭툭」이 크게 줄고, 다운로드 JSON의 `capture.status=done` · frameCount≫240.
