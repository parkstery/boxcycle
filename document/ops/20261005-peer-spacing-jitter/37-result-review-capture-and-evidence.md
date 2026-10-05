# RESULT-37 — Supervisor 검수 보완 (capture · 바이트 · 증거 분리)

담당: Cursor CLI · 지시: [36-task-review-capture-and-evidence.md](36-task-review-capture-and-evidence.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · commit/push/deploy **없음** · 브라우저 실주행 **없음**

## 판정 요약

| 항목 | 결과 |
|------|------|
| capture 40ms 간격 | **직전 capture 저장 시각**(UID별). `dtMs`는 실제 프레임 간격 유지 |
| 완료 export 카운터 | 저장 당시 `fsPickCount`/`maxJumpByUid` 등 **보존** · `liveCounters` 별도 |
| encode 바이트 | 0.1→0.01: mean **+0.888 B** · max **+1 B** · 1rider·5Hz·1h **+~16.0 KB**(JSON only) |
| 송신 횟수/주기 | **불변**(PUB 200ms / 측정 5Hz 동일 N) |
| 증거 분리 | 실측 관찰 ≠ 합성 quantize 인과. 원본 반올림 전 거리 **복구 불가** |
| 합성 게이트 | before 1s-pp **0.100** → after **0.008** · phase×speed 악화 없음 |
| 35 기록 | **보존**. 본 파일(37)이 정정·보완 |

## 1. capture 간격 · 행동 시험

**결함(35):** `notePeerFrameDiag`가 실제 프레임 `dtMs`로 40ms를 판단 → 60fps면 첫 표본 뒤 전량 스킵.

**수정:** `lastCapturedFrameAtByUid` · capture 시작 시 clear. 레거시 live ring은 매 프레임 유지.

| 시험 | 결과 |
|------|------|
| 60fps 20s 1UID | ~400표본 · 저장 간격≥40ms · `dtMs` 중앙값~16ms · **창 끝까지** |
| 60fps 20s 2UID | per-UID ≥40ms · 마지막 atMs≈끝 · **전역 frameCap=500**으로 early drop(`droppedFrameForCap>0`). 500=한 UID 20s@40ms 상한이지 two-UID 전 구간 보장이 아님 |
| 120fps 2s | ~25Hz 저장 · `dtMs`~8ms 보존 |
| live 덮어쓰기 후 download Blob JSON | `frameCount`/카운터/`maxJump` = 완료 시점 · `liveCounters`만 이후 반영 |
| reset · 반복 capture | 동작 확인 |

명령: `node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` → **6/6 PASS** (~9.5s)

## 2. encodePayload UTF-8 바이트

동일 표본 N=500 · `JSON.stringify(encodePayload)` · 전송 overhead 제외.

| | 0.1m | 제품 0.01m | Δ |
|--|------|------------|---|
| mean | 93.888 B | 94.776 B | **+0.888** |
| max | 94 | 95 | **+1** |
| 1 rider · 5Hz · 3600s | — | — | **+15 984 B ≈ 15.6 KiB/h** |

`cadenceUnchanged: true`. 원시: `evidence/real-paired-20261005/encode-payload-byte-cost.json`

## 3. 증거 분리 (35 정정)

| 층 | 내용 | 주장 범위 |
|----|------|-----------|
| 실측 | `rider_*.json` running `relativeGapM` · 1s-pp≈0.05–0.15m · wire `*.0` 격자 | 증상·상관 |
| 합성 | 등속 dual · 제품 encode/self/Registry · PUB200·RTT140·D600 | **양자화 인과** |
| 금지 | 원본 JSON before/after replay · 유일 확정 원인으로 실측 파일만 인용 | — |

35의 재생 수치(0.100→0.008)는 **합성 경로**였음을 37에서 명시. 파일 자체는 덮지 않음.

## 4. 그래프 · phase/speed

- 시계열: `quantize-beat-gap-series.json` · `observed-running-gap-series.json`
- PNG: `evidence/real-paired-20261005/graphs/quantize-beat-synthetic-compare.png` · `observed-running-gap.png`
- 합성 그래프: red(0.1) 큰 톱니 vs cyan(0.01) 소진동 — 시간축·양자 비트 가시
- 행렬 phase∈{0,40,80,120,160} × speed∈{5,6,20}: **after 1s-pp ≤ before** 전부 ok (절대 0.025 완화 없음; primary만 5km/h·phase80 절대 게이트)

## 5. 시험

| 명령 | 결과 | 벽시간 |
|------|------|--------|
| `node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` | **6/6 PASS** | ~9.5s |
| `node scripts/peer-sync/real-paired-quantize-beat-harness.mjs --graph` | **PASS** | ~4.4s(+png) |
| `node scripts/peer-sync/real-paired-quantize-beat-mutation-failcheck.mjs` | **PASS**(old FAIL + metrics restore) | ~8s |
| `npx tsc -b` | **0** | ~수초 |
| `npm run test:peer-residual-jitter` | requiredFail=0 | ~3.4s |
| `npm run test:peer-spacing` | GATE PASS · transitions 0 · residual 0 | ~25s |
| 브라우저 실주행 | **미실행** | — |

## 6. 변경 파일 (본 작업)

- `apps/web/src/lib/debug/peerIngestDiag.ts` — lastCaptured · export 카운터 보존 · liveCounters
- `apps/web/scripts/peer-sync/peer-ingest-diag-capture.test.mjs` — 60/120fps·2UID·Blob
- `apps/web/scripts/peer-sync/real-paired-quantize-beat-harness.mjs` — 합성 명시·바이트·행렬·그래프
- `apps/web/scripts/peer-sync/real-paired-quantize-beat-mutation-failcheck.mjs` — metrics 복원
- `apps/web/scripts/peer-sync/HARNESS.md` — E절 정정
- 증거 JSON/PNG · mid `00-mid-evidence-task36.md`

**미변경:** D600 · RTDB200 · FS4s · Rules/DB schema · 송신 주기.

## 7. 남은 한계

- 전역 frameCap 500 → 동시 2UID 20s@~25Hz는 앞구간 drop(끝은 유지).
- 실측 전체 running 20s capture는 본 수정 후 사용자 재수집이 필요(브라우저 미실행).
- 0.01m 잔여 cm비트·RTT/버퍼·FS estimated 구간은 별개.
