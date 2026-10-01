# Result 30 — RTDB failure → Firestore fallback quality (1v2 scope)

Status: **DONE** (TASK-30C PASS — supersedes 30B dual-source stamp; 30B select retained)
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope: `syncFromPresence` source selection + dual-source ingest stamp normalize (**30C: content-stable**). Narrow `PublicationSharedPresence` RTDB error clear (30A) + RTDB visibility receiver-obs (30C). Offline dual-source replay through **actual** registry path. **No** schema / publish cadence / HUD / MapHud changes. **No** commit / push / deploy. **No** billed-read claims.

Comparison: **1 local + 1 peer** only.

> **30C addendum:** 30B’s every-sync `serverAtMs: nowMs` kept frozen dual-source peers alive forever. See `30c-result-dual-source-liveness.md`. After-fix: both-stop **6/6**, fallback regress **48/48**.

---

## 0. TASK-30B supervisor rejection of 30A

30A compared three clocks: RTDB `t` (sender `Date.now`), FS `lastSeenAt` (`serverTimestamp`), receiver `Date.now`, with `PEER_MOTION_SOURCE_CLOCK_SKEW_MS = 1500`. That assumption fails at realistic ±30s sender offsets:

| Sender offset | 30A failure mode (silent freeze, FS continues) |
|---|---|
| **+30s** | Frozen RTDB `t` stays ahead of FS → never FS-selected → peer wiped at ~freeze+15.1s |
| **−30s** | RTDB always “behind” / wall-stale → pre-freeze RTDB-first share **0** (5Hz never primary) |

Hard subscribe error (rows cleared) still fell through to FS under 30A; silent frozen redelivery did not under +30s.

---

## 1. Harness (extended)

`replay.mjs` still cannot exercise dual-source selection. Vite SSR harness loads production modules:

| File | Role |
|---|---|
| `apps/web/scripts/peer-sync/rtdb-fs-fallback-harness.mjs` | Matrix → `syncPeerMotionFromPresence` + `PeerMotionRegistry` |
| `apps/web/scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs` | Pure select + local observation contracts |

Matrix dimensions (48 cells):

- FS receive interval: **1000 / 4000 / 8000 / 10000** ms (receive-side only)
- Sender clock offset: **−30000 / 0 / +30000** ms (RTDB `t` only)
- Peer motion: **moving** (5 m/s) / **stationary** (0 m/s, stamps still 5Hz)
- RTDB failure: **silent-freeze** (frozen row redelivered) / **hard-error** (rows cleared)
- Recovery: after 20s outage, RTDB advances again → retake share ≥ 0.7 (silent-freeze)

```powershell
cd apps/web
node scripts/peer-sync/rtdb-fs-fallback-harness.mjs
node --test scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs
node scripts/peer-sync/replay.mjs --check
```

Publisher cadence **unchanged**.

---

## 2. Baseline FAIL (30A logic × 30B matrix)

Evidence (committed compact summary): [`task30b-baseline-fail.summary.json`](task30b-baseline-fail.summary.json) — **16/48** pass. Full raw `task30b-baseline-fail.json` remains **local-only** (not committed; selectionSamples/timeline omitted from summary).

| Bucket | pass/fail | Concrete |
|---|---|---|
| offset=+30s · silent-freeze | **0/8** | `peerGoneInOutage=true` @~19100ms; back-jump 26m (moving) / 40m (stationary wipe) |
| offset=−30s · all | **0/16** | `preFreezeRtdbFirstShare=0` (FS always wins) |
| offset=0 · silent-freeze | **0/8** | peer stayed, but recovery retake share 0 under then-buggy harness `Math.min` freeze (fixed before 30B after-fix; not the supervisor defect) |
| offset=0/+30s · hard-error | **16/16** | Presence clear → FS-only; peer survives |

Representative (+30s, 1Hz, moving, silent): gone=true, maxBack=26m, endDist=0.
Representative (−30s, 1Hz, moving, silent): gone=false, preRtdb=0.000, retake=0.

---

## 3. Fix (minimal, clock-independent)

### 3.1 Local RTDB content observation (`syncFromPresence.ts`)

- `noteRtdbContentObservation(uid, row, nowMs)` — fingerprint `seq|serverAtMs|distM|speedMps|ridePhase`; updates **only on content change**.
- `selectPeerMotionPacketForIngest(rtdb, fs, nowMs, rtdbContentChangedAtLocalMs)`:
  - no RTDB → FS; no FS → RTDB
  - observation age ≤ `PEER_MOTION_RTDB_SOURCE_STALE_MS` (2500) → **RTDB-first**
  - age > 2500 → **FS**
- **Removed** `PEER_MOTION_SOURCE_CLOCK_SKEW_MS` and all cross-clock `serverAtMs` comparisons.
- `resetPeerMotionRtdbContentObservations()` for harness/tests.

### 3.2 Dual-source ingest stamp normalize

When **both** RTDB and FS candidates exist, ingest `{ ...selected, serverAtMs: nowMs }` so source switches do not shock integrator `clockOffset` by ±30s (would back-jump display on RTDB retake). Single-source paths keep native stamps.

### 3.3 Presence hard-error clear (retained from 30A)

On RTDB subscribe error: clear `motionRowsRef` + sync with `motionRows: []` → unambiguous FS-only.

---

## 4. After-fix PASS (30B)

Evidence (committed compact summary): [`task30b-after-fix.summary.json`](task30b-after-fix.summary.json) — **48/48** pass. Full raw `task30b-after-fix.json` remains **local-only** (not committed; selectionSamples/timeline omitted from summary).

| FS interval | gone | maxJump (all offsets/modes) | preRtdb min | retake min (silent) | staleMargin (15s−interval) |
|---|---|---|---|---|---|
| **1000ms** | 0 | **1.3m** | **1.000** | **1.000** | 14000ms |
| **4000ms** | 0 | **1.3m** | 1.000 | 1.000 | 11000ms |
| **8000ms** | 0 | **27.8m** | 1.000 | 1.000 | 7000ms |
| **10000ms** | 0 | **36.8m** | 1.000 | 1.000 | 5000ms |

Limits / reading (offline, not billed):

- ±30s sender skew: peer never vanishes; RTDB-first pre-freeze; silent freeze → FS; recovery retake clean (share 1.0).
- Stationary + moving covered; hard-error vs silent-freeze both green.
- **1Hz** baseline smooth (jump≤1.3m). **8s/10s** still survive but catch-up jumps grow (~28m / ~37m at 5 m/s); 10s margin to 15s stale = **5s** — do not throttle yet without product judgment.
- maxBack=0 across after-fix matrix.

Unit: `rtdb-fs-fallback-source-select.test.mjs` **6/6**.
`replay.mjs --check` **19/19**.
`peer-liveness-contract.test.ts` **7/7** (via `register-vite-env.mjs`).
eslint (touched product files) clean.

---

## 5. Historical 30A note (aligned clocks only)

30A after-fix on offset=0 freeze (`task30a-after-fix.json`, **local-only** / class D) remains valid as a narrower green, but **not approved** for production because ±30s breaks it. Use 30B committed summaries for gate decisions.

---

## 6. Out of scope / not claimed

- No FS publisher throttle (**28T** still deferred).
- No emulator E2E RTDB fault injection this pass.
- No production billed R/W.
- HUD / MapHud / schema / cadence untouched.

---

## 7. Unlock

RTDB-fail → FS fallback quality gate is green offline under **clock-independent** local observation, including ±30s sender skew, stationary/moving, hard vs silent failure, and RTDB retake. Candidate 8–10s intervals: peers survive; larger catch-up jumps / thinner stale margin — evidence for Supervisor before any **28T** throttle.
