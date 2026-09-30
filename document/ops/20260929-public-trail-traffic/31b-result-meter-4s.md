# Result 31B-R — Controlled emulator 1v2 meters after FS 4s heartbeat

Status: **DONE** (PASS)
Date: 2026-10-01
Owner: Developer (Cursor). Supervisor does not code.
Scope: post-31A (FS heartbeat 4s) re-measure vs **28D-B** (1s heartbeat baseline). No product cadence / schema / HUD change in this TASK. No commit / push / deploy.

**Invalid prior attempts (do not use):**
- attempt1 — dual wall 58.4s (CDP post-window inflate) → `.task31b-attempt1-INVALID.md`
- stamp-before-read revision — rejected (end stamp ≠ meter freeze)

---

## 1. Harness fix (TASK-31B-R)

True same-duration paired capture:

1. Compute shared absolute `startAtMs` / `endAtMs` (`MEASURE_MS=45000`, `ARM_LEAD_MS=800`).
2. Per page: `armPairedCapture` — in-page timers; **`resetAtStart`** (generation ticket) then start snap; end snap at deadline.
3. Wall-wait past `endAtMs`, then CDP-retrieve armed snaps (latency outside metric window).
4. Enforce `|actualDuration − 45000| ≤ 300`, `|timerSkew| ≤ 250`, cross-page align ≤ 250. Timer miss → FAIL (load diagnosis), no slack loosen.

Files: `trafficPairedCapture.ts`, `installTrafficPublishDebug.ts`, `e2e/public-trail-traffic-1-2.spec.ts`, runner `RTW_TRAFFIC_ARTIFACT_TAG`, unit `traffic-paired-capture.test.ts`.

Unit: `npm run test:traffic-meters` → **14/14**.

---

## 2. Command

```powershell
cd apps/web
$env:RTW_DEV_PORT='5050'
$env:RTW_TRAFFIC_ARTIFACT_TAG='task31b-r'
npm run test:e2e:public-trail-traffic
```

- workers=1 · retries=0 · MEASURE=45s · exit **0** · elapsedMin **3.06** · session `t31br-muokbui7`
- Artifacts (unique; 28D-B baseline preserved): `task31b-r.json` · `task31b-r-phases.jsonl` · `.task31b-r-run.log` · `.task31b-r-emulator.log`

---

## 3. Capture timing (accepted)

| Scope | durationMs | startSkew | endSkew | notes |
|---|---:|---:|---:|---|
| Solo | **44920** | 172 | 92 | ∈ 45000±300 |
| Dual A | **44916** | 220 | 136 | shared plan |
| Dual B | **45056** | 121 | 177 | start align 99ms · end align 41ms |

Start snaps all zeros after `resetAtStart` (generation ticket). Successes ≤ attempts on all deltas.

---

## 4. Client deltas — 31B-R (4s) vs 28D-B (1s)

Emulator counts ≠ billed. Same route `longest` 2.02 km · same 45s window protocol (capture method upgraded).

| Metric | Solo 31B-R | Solo 28D-B | Dual sum 31B-R | Dual sum 28D-B | Dual/Solo 31B-R |
|---|---:|---:|---:|---:|---:|
| FS write attempts | **11** | 41 | **22** | 80 | **2.00** |
| FS writes | **11** | 41 | **22** | 80 | **2.00** |
| RTDB write attempts | 152 | 149 | 292 | 297 | ~1.92 |
| RTDB writes | 151 | 149 | 290 | 296 | ~1.92 |
| FS hub deliveries (≠ billed) | 23 | 83 | 76 | 254 | — |
| RTDB hub deliveries (≠ billed) | 152 | 149 | 584 | 594 | — |

Directional FS reduction solo **41→11 (~3.7×)** · dual **80→22 (~3.6×)** — consistent with 1s→4s steady heartbeat (not billing). RTDB ~unchanged (5Hz kept). Write ratios still ~2× for 1→2 publishers.

---

## 5. Functions whole-run (not window-attributed)

| Function | 31B-R begin | 28D-B begin |
|---|---:|---:|
| `routeActivityOnLivePublicationRideWritten` | **213** | 320 |
| totalBegin | 263 | 367 |

Whole `emulators:exec` only (setup+solo+dual+teardown). Prefer client meter deltas for 1v2 ratios.

---

## 6. Limitations

- Emulator ≠ production billed R/W or CF executions.
- One controlled run; not a billing A/B.
- Timer skew tol ±250ms — under heavy main-thread load capture fails closed (does not accept stretched windows).
- Hub delivery sums are per-client callbacks, not server billed reads.
- attempt1 / stamp-before-read artifacts remain labeled **INVALID**.

---

## 7. Product

No cadence / schema / HUD change in 31B-R (31A 4s heartbeat already landed earlier). Merge/deploy still NEEDS_APPROVAL.
