# Result 24 / 24R — 5Hz companion-display quality replay + input equality fix

Status: **DONE** (TASK-24 superseded by **TASK-24R** input-equality correction)
Task: TASK-24 → **TASK-24R** — 10Hz/5Hz 비교 입력 동등성 오류 수정 후 품질 재생·수치 재측정
Date: 2026-09-29
Product source: **unchanged** (`rideSyncPolicy` / `integrator` / `mergePackets` not edited)
Allowed edits: `apps/web/scripts/peer-sync/scenarios.mjs`, equality test, ops docs only
No commit / push / deploy / live Firebase

Scope note: Replay models **one companion packet stream** (what a viewer sees in a **2-rider** ride). Solo (**1-rider**) has no peer display → N/A for companion quality. No 3+ rider comparison.

---

## TASK-24R — prior comparison error (Supervisor)

### Defect

TASK-24 pair graphs compared scenarios whose **inputs were not the same wall-clock motion**:

1. Segment chaining used `startDistM = last.packet.distM` after `steadyDuration` / tick loops. Last sample sits at `duration − interval`, so the next segment **lost** `speed × interval`: **0.1s @ 10Hz vs 0.2s @ 5Hz** → different final distances (e.g. accel ~44m vs ~42m; reconnect ~180m vs ~178m).
2. Reconnect resume used `startMs = last.atMs + gapMs`, so gap absolute start/end shifted by one sample interval between rates.

Therefore TASK-24 lag/final-distance **numeric comparisons were invalid**.

### Fix

- Absolute wall-clock **piecewise** speed profile + `distAt(t)` integration; sample `[t0,t1)` at 100ms / 200ms.
- Gaps: `emit:false` — motion continues, no packets; resume absolute time identical (e.g. reconnect gap `[13000,16000)`).
- Stop→resume: same `distM` would be integrator `dup-same-dist`; rate-independent **+0.1m** bump on first moving sample so buffer accepts it (product unchanged).
- `candidate-5hz-jitter-gap` **unchanged** (TASK-04 lock).
- New auto test: `cmp-rate-pair-input-equality.test.mjs` (14/14 PASS).

---

## Coverage vs quality situations

| Situation | Existing (pre-24) | Added (TASK-24/24R) | 10Hz vs 5Hz same wall-clock | `--check` | Graph | Verdict |
|---|---|---|---|---|---|---|
| 출발 (depart ramp) | `s2-depart-ramp-target-speed` (5Hz) | — | no 10Hz twin (S2 symptom model) | PASS | via quality-all / prior | **PASS** (5Hz) · 10Hz twin **미검증** |
| 가속/감속 | `accel-then-decel` (10Hz); `s2-decel-30-to-5` (5Hz) | `cmp-10hz-accel-decel` · `cmp-5hz-accel-decel` | **yes (24R absolute)** | PASS | `task24-cmp-accel-decel/pair-10hz-vs-5hz.png` | **PASS** |
| 정지 | `stationary-dedup` (10Hz); `s2-pause-hold` · `candidate-5hz…` stop (5Hz) | stop segment inside `cmp-*-jitter-gap` | **yes** | PASS | jitter pair + existing | **PASS** |
| 곡선 | **없음** | `cmp-10hz-curve-undulation` · `cmp-5hz-curve-undulation` | **yes** | PASS | `task24-cmp-curve/pair-10hz-vs-5hz.png` | **PASS** (1D speed proxy) |
| 지연 (RTT/jitter) | `candidate-5hz-jitter-gap` | `cmp-10hz-jitter-gap` · `cmp-5hz-jitter-gap` | **yes** (candidate locked) | PASS | `task24-cmp-jitter-gap/pair-10hz-vs-5hz.png` | **PASS** |
| 재연결 / gap | `mid-stall-2500ms` (10Hz); candidate 2s gap | `cmp-10hz-reconnect-3s` · `cmp-5hz-reconnect-3s` | **yes** (gap abs `[13s,16s)`) | PASS | `task24-cmp-reconnect/pair-10hz-vs-5hz.png` | **PASS** |
| 정속 cruise | `cruise-steady` / `s2-cruise-30kmh` | — | not paired | PASS | — | **PASS** separately · paired cruise **미검증** |
| 완주 completed | `ride-to-completed` (10Hz) | — | no 5Hz twin | PASS | — | **PASS** (10Hz) · 5Hz twin **미검증** |
| 1인 동행 표시 | — | — | — | — | — | **N/A** |
| 2인 동행 표시 | harness default | all cmp + candidate | — | PASS | pairs above | **PASS** (offline) · live eye **미검증** |
| mergePackets 이중 스트림 | harness TODO | not added | — | — | — | **미검증** |
| 실기기·실측 품질 | — | — | — | — | — | **미검증** |

`--check` was **not** relaxed. Known-fail / expectFail unused.

---

## Input equality (TASK-24R gate)

| Check | Result |
|---|---|
| Common `serverAtMs` (200ms lattice ∩ both streams): `distM` / `speedMps` | **match** (ε `1e-9` / `1e-12`) |
| Phase bounds + gap abs start/end | **aligned** per `CMP_RATE_PAIRS` |
| Last common-grid distance (examples) | accel **43.6m** both @15800; curve **121.6m** @21200; reconnect **170.4m** @18800; jitter **258.4m** @31400 |
| `node --test scripts/peer-sync/cmp-rate-pair-input-equality.test.mjs` | **14/14 PASS**, exit **0** |

---

## Lag metrics (observational — not gate) — **regenerated after 24R**

`newest.distM − displayDistM` on live frames (step 100ms). Official gate remains invariants only.

| Scenario | lag p50 (m) | lag p95 (m) | abs-mean (m) |
|---|---:|---:|---:|
| cmp-10hz-accel-decel | 0.72 | 3.52 | 2.00 |
| cmp-5hz-accel-decel | 0.88 | 7.04 | 3.05 |
| cmp-10hz-curve-undulation | 0.91 | 1.76 | 3.05 |
| cmp-5hz-curve-undulation | 1.51 | 3.51 | 3.53 |
| cmp-10hz-reconnect-3s | −0.64 | 6.00 | 5.35 |
| cmp-5hz-reconnect-3s | 0.00 | 6.80 | 5.57 |
| cmp-10hz-jitter-gap | 2.73 | 4.30 | 3.85 |
| cmp-5hz-jitter-gap | 2.40 | 4.12 | 3.52 |

Reading (honest): under **equal** wall-clock inputs, **5Hz is worse** on accel (esp. p95 7.04 vs 3.52) and curve p50/p95; reconnect slightly worse abs-mean; jitter pair 5Hz is **slightly better** on p50/abs-mean. Negative lag samples still appear around gap/extrap catch-up. **Does not prove live 2-window perceived quality.**

JSON: `apps/web/scripts/peer-sync/.out/task24-lag-metrics.json` (gitignore `.out/`).

---

## Commands / results

| Command | Result | Exit |
|---|---|---|
| `node --test scripts/peer-sync/cmp-rate-pair-input-equality.test.mjs` | **14/14 PASS** | **0** |
| `node scripts/peer-sync/replay.mjs --check` (cwd `apps/web`) | **19/19 PASS** | **0** |
| Pair graphs → `.out/task24-cmp-*/pair-10hz-vs-5hz.png` | written | **0** |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/peer-sync/interp-smoothness-contract.test.ts scripts/peer-sync/motion-flight-pipeline-contract.test.ts scripts/ride-hierarchy/sync-policy-constants-contract.test.ts` | **29/29 PASS** | **0** |

### Graph paths (absolute)

- `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle\apps\web\scripts\peer-sync\.out\task24-cmp-accel-decel\pair-10hz-vs-5hz.png`
- `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle\apps\web\scripts\peer-sync\.out\task24-cmp-curve\pair-10hz-vs-5hz.png`
- `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle\apps\web\scripts\peer-sync\.out\task24-cmp-reconnect\pair-10hz-vs-5hz.png`
- `C:\Users\kdrea\.codex\worktrees\public-trail-traffic\boxcycle\apps\web\scripts\peer-sync\.out\task24-cmp-jitter-gap\pair-10hz-vs-5hz.png`
- Per-rate PNG/SVG alongside each pair dir
- Strip: `...\scripts\peer-sync\.out\task24-quality-all\peer-timeline.png`

---

## Queue correction (22-task-queue.md)

Unchanged intent from TASK-24:

- **PENDING TASK-25** — 1·2인 기능 검증. **실측 아직 없음.**
- **PENDING TASK-26** — 로컬 트래픽 계측. **실측 아직 없음.**
- **NEEDS_APPROVAL** = **R1 merge · R2 production deploy only.**
- **TASK-24R** recorded as DONE correction of TASK-24 evidence validity.

---

## Changed files (TASK-24R)

- `apps/web/scripts/peer-sync/scenarios.mjs` — absolute wall-clock `sampleWallClockMotion` for cmp pairs; `CMP_RATE_PAIRS`; `candidate-5hz-jitter-gap` untouched
- `apps/web/scripts/peer-sync/cmp-rate-pair-input-equality.test.mjs` — **new** equality gate
- `document/ops/20260929-public-trail-traffic/24-result-5hz-quality.md` — this file (defect + regen numbers)
- `document/ops/20260929-public-trail-traffic/22-task-queue.md` · `PROGRESS.md` · `README.md`

---

## Next TASK

**TASK-25** — 1·2인 기능 검증 체크리스트를 에뮬/로컬에서 닫고 증거 기록 (실측 없음 명시). Then TASK-26 traffic instrumentation.
