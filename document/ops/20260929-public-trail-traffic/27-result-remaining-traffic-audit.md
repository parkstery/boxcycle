# Result 27 — Remaining Public Trail traffic audit (1 vs 2 riders)

Status: DONE (read-only) · **TASK-28A correction applied** (throttle deferred; measurement first)
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope: remaining Firestore / RTDB / CF paths after TASK-26 listing Created/Deleted. **No product or test code edited in 27 / 28A.**

Comparison: **1 rider / 2 riders only**. No deploy / merge / push.

---

## 1. Evidence classes (do not mix)

| Class | What it is | What it is not |
|---|---|---|
| **Static model** | Code paths: triggers, write cadence, listener hubs, early-return gates | Billed ops, latency, $ |
| **Emulator evidence** | Listener open counts, E2E contracts (TASK-13/14/17/25) | Production Firestore billing |
| **Production billed metrics** | User 2026-09-29 console (pre-deploy live app) | Attribution to this branch’s listing gate / 5Hz / listener-scope |

User 1v2 report (live): `C:/20.HDev/boxcycle/document/archive/260929-주행-Firebase-트래픽-1인vs2인-분석보고.md`
Qualified in: `07-result-measurement-review.md` · `08-review-measurement.md`.
Already applied on this branch (not in that report): listing Created/Deleted (TASK-26), listener-scope (09–14), default-Trail skip (17), RTDB 5Hz target (04).

---

## 2. Upstream write: `livePublicationRides` ~1 Hz

| Step | File:line | Mechanism |
|---|---|---|
| Cadence | `apps/web/src/lib/ride/rideSyncPolicy.ts:34` | `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS = 1_000` |
| Gate | `apps/web/src/lib/ride/liveLocationSnapshot.ts:137–154` | `shouldPublishRouteProgress` → true every ≥1s (or speed Δ ≥ 0.28 m/s) |
| Fanout | `apps/web/src/lib/ride/publishLiveLocationFanout.ts:69–92` | `enqueueRoutePublish` → Trail sink |
| Write | `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts:115–137` | `setDoc(merge)` always sets `publicationId`, `progressRatio`, `displayName`, `lastSeenAt`, `ridePhase`, `speedMps`, optional `distMeters` |

**Static model (steady ride):** ~1 write/s/rider → **1 vs 2 riders ≈ 1× vs 2× document writes** on the same Trail.

Parallel (not FS live-ride):

| Path | Cadence | Role |
|---|---|---|
| RTDB `/trails/{id}/motion/{uid}` | `PEER_MOTION_PUBLISH_INTERVAL_MS = 200` (`rideSyncPolicy.ts:37`) | Primary companion motion (5Hz) |
| `trails/{id}.lastActivityAt` | coalesce ≤30s (`firestoreTrailInstance.ts:200–214` + `TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS`) | Listing via `openTrailListingOnTrailWritten` |
| `livePresence` | 4–12s move/time gates | Global dots |

---

## 3. CF still on every live-ride **update**: `routeActivityOnLivePublicationRideWritten`

| Item | Evidence |
|---|---|
| Registration | `functions/src/routeActivityOnLivePublicationRideWritten.ts:112–114` — **`onDocumentWritten`** on `trails/{trailId}/livePublicationRides/{uid}` |
| Export | `functions/src/index.ts:469` |
| Contrast | Listing live-ride CF is **Created/Deleted only** (`openTrailListingProjection.ts:56–74`) — update → **0 listing CF invocations** (TASK-26) |

### Invocation vs handler work

Firebase still **invokes** the function on every create/update/delete. Handler then:

| Event | Handler | Downstream writes (when not skipped) |
|---|---|---|
| **Create** | bump course + publication session start; `touchCourseLiveProgressWithAnchor`; `refreshWorldHighlightedCourses` | `routeActivity/*`, `worldActivity/global`, `publicationPresence/*`, geometry read |
| **Delete** | bump ends; `refreshWorldHighlightedCourses` | same families |
| **Update + `isHeartbeatOnlyUpdate`** | **return** (`:172–174`) | **no aggregate writes** — **invocation still billed** |
| **Update + meaningful progress** | pulse-only or anchor touch (`:213–238`) | `routeActivity` merge; anchor path may read `routePublications/{id}` |

Heartbeat predicate (`:78–98`):

- Same `publicationId`
- `|Δ progressRatio| < PROGRESS_AGGREGATE_MIN_DELTA` (**0.012**, `:36`)
- Same `pulseLevelFromProgress` (bands 0–0.4 / 0.4–0.75 / ≥0.75)

Ignores `lastSeenAt` / `speedMps` / `distMeters` / `displayName` alone → typical 1Hz ticks with tiny progress are **handler no-ops** but **still CF cold/warm starts**.

Client `TRAIL_LIVE_PROGRESS_MIN_DELTA = 0.005` (`rideSyncPolicy.ts:64`) ≠ server **0.012** — client does not skip writes for that delta; server skips aggregate only.

**Static 1v2 CF invocation model (listing already fixed):**
~1 Hz × riders × clients-that-write → **~1 vs ~2 invocations/s** for `routeActivityOnLivePublicationRideWritten` while both publish. Create/delete are rare.

Scheduled safety net only: `routeActivityScheduledReconcile` every **24h** (`routeActivityScheduledReconcile.ts:27–31`) — cannot replace mid-ride pulse/anchor.

---

## 4. Listener / read fanout (post listener-scope)

Policy: `listenerScopePolicy.ts` — ride + menu closed drops open listings, project-wide CG, world multi-Trail overlay; **keeps current Trail** peer hub.

| Path | 1 rider (menu closed) | 2 riders same Trail | Bill shape (static) |
|---|---|---|---|
| `trails/{current}/livePublicationRides` onSnapshot | 1 / client (spectator / PSP hub) | 1 / client × **2 clients** | Each ~1Hz write → snapshot on **both** clients |
| CG `livePublicationRides` | **0** while riding (gated) | **0** | Was major pre-09 amplifier; report predates gate |
| `openTrailListings` | **0** riding menu closed | **0** | Same |
| RTDB motion hub | 1 / client | 1 / client × 2 | ~5Hz bandwidth, not FS read |

Peer display merge: `PublicationSharedPresence.tsx:457–467` + `syncFromPresence.ts:34–65` — **RTDB 5Hz + Firestore 1Hz** into registry; HUD peers keyed from live-ride visibility (`PEER_LIVE_RIDE_STALE_MS = 15_000`, `trailLivePolicy.ts:16`). RTDB failure falls back to FS (`PublicationSharedPresence.tsx:318`).

DEFAULT Trail: PSP skips FS/RTDB hubs (`PublicationSharedPresence.tsx:213–215`, `:264`) — TASK-17.

---

## 5. User 1v2 report vs current queue

| Report claim | Class | Audit stance |
|---|---|---|
| Reads 363 (1인 bin) vs 1,200 (2인 bin); ×3.3 | Production console, **misaligned clock bins** | Directional read pressure only (`08-review`) |
| Quiet ≠ Firebase quiet | Code + timeline | Confirmed |
| Write ×2.1 | Production | Plausible for 2 writers; not path-attributed |
| Listener peak 79 / 60m mix | Mixed window | Not ride-pure |

**Queue after TASK-26:** listing update CF gone (code). **Remaining high-rate CF** = `routeActivityOnLivePublicationRideWritten`. **Remaining high-rate FS read amp (1v2)** = shared Trail `livePublicationRides` collection listeners × clients × write rate. Production A/B of this branch: **not measured** (undeployed).

---

## 6. Necessary semantic progress vs heartbeat-only skip

Must keep (create/delete or equivalent):

1. Session start/end → `activeRiderCount` / `liveNow` / publicationPresence / world highlight refresh
2. Mid-ride **meaningful** progress → pulseLevel / `liveAnchorProgressRatio` (± geometry anchor when Δ ≥ **0.08**) for world route activity

Safe to skip **handler work** (already): lastSeenAt-only / tiny progress / same pulse band.

**Not safe** to drop all update triggers without a replacement for (2): 24h reconcile is too slow for live world pulse.

Reducing **upstream write rate** preserves (1)(2) if writes still fire on: create, delete, pulse boundary, Δprogress ≥ ~0.012, and a **max interval ≪ 15s** (stale hide).

---

## 7. Safest concrete proposals (prefer order) — **TASK-28A correction**

### A — Firestore write throttle — **DEFERRED** (Supervisor reject of immediate 8–10s)

**Do not implement** max-interval ~8–10s (or other FS cadence cut) until **paired 1v2 metrics** and an **RTDB-failure → FS fallback quality** check exist on this branch.

Reject reasons (Supervisor):

1. Firestore `livePublicationRides` row is also the **RTDB-failure fallback** for companion display (`PublicationSharedPresence.tsx` FS fallback path) — throttling FS is not “secondary traffic only.”
2. `PEER_LIVE_RIDE_STALE_MS = 15_000` leaves **little jitter margin** for an 8–10s max interval (one missed/late tick → stale hide).
3. Branch has **no paired client metrics** yet and **no fallback-quality replay/test** — static model alone is insufficient.

Keep RTDB 5Hz. Leave `routeActivityOnLivePublicationRideWritten` as Written + existing skips until after measurement.

### B — **Current priority:** controlled emulator **1 vs 2** measurement (no product cadence change)

See **§8**. Produce directional 1v2 ratios under emulator; **do not** equate counts to billed ops.

### C — After meters + fallback evidence

Re-open throttle (former A) with an interval chosen against stale margin + fallback replay, **then** optional routeActivity Created/Deleted split (**TASK-29**) if CF invocations still dominate.

### D — Do not do first

- Immediate FS 8–10s throttle
- Cut RTDB below 5Hz without TASK-24R quality re-check
- Disable current-Trail `livePublicationRides` listener while riding
- Infer $ / billed savings from emulator listener or CF begin counts

### Deploy hazard (unchanged)

Approved deploy must **delete** legacy listing Written names (`26-result-listing-created-deleted.md`). Leaving them undeleted keeps update invocations in production.

---

## 8. TASK-28A — Narrow runnable measurement design (no product cadence change)

**Goal:** same-window **1 rider vs 2 riders** client+emulator counters on current branch policy (~1 Hz FS / ~5 Hz RTDB).
**Out of scope this design:** throttle, routeActivity surgery, deploy, billing attribution.

### 8.1 Entry / protocol (reuse existing helpers)

| Piece | Use |
|---|---|
| `apps/web/e2e/rideEntryHelpers.ts` | `guestStart` · `loadIntroCourse` · `ensureRiding` · `setSpeedKmh` — same path as TASK-25 / peer-sync |
| Solo | 1 guest → intro route → riding → **quiet setup complete** → **reset meters** → fixed `MEASURE_MS` window |
| Dual | Host create + joiner (max 2) → both riding same Trail → quiet setup → **reset both** → **same** `MEASURE_MS` |
| Guard | Local Auth/Firestore/RTDB/(Functions) emulator hosts only; refuse live Firebase |
| Artifact | JSON + phase JSONL under `apps/web/.out/firebase-traffic/` (copy to ops optional) |

Quiet setup **must end before** the measure window so join/create bursts are excluded from deltas.

### 8.2 Metrics extractable **without product cadence / payload changes**

DEV-only counters and emulator log parse are observation harnesses; they must **not** change publish intervals or fields.

| Metric | Source | What it means | Not |
|---|---|---|---|
| `livePublicationRideWrites` (+ errors) | Client DEV `__rtwTrafficMeters` delta per page / sum dual | FS live-ride **setDoc attempts** in window | Billed Firestore writes |
| `rtdbMotionWrites` (+ errors) | same | RTDB motion **set** count in window | Billed RTDB ops |
| `rtdbMotionWriteBytesApprox` | same (JSON UTF-8 length of payload) | Relative bandwidth shape 1v2 | Exact wire/billing bytes |
| `fsLiveRideUnderlyingDeliveries` | same (hub onSnapshot) | FS **delivery events** seen by client hub | Server billed reads; multi-doc fanout model only |
| `rtdbMotionUnderlyingDeliveries` | same (hub onValue) | RTDB **delivery events** | Billed download |
| Mid-ride listener-scope snapshot | Existing DEV read-sub / scope debug (as in listener-scope E2E) | Which hubs **open** while riding (menu closed) | Continuous read rate |
| CF `Beginning execution of …` by name | `firebase emulators:exec` stdout/stderr regex (Functions on) | Emulator **invocation** tallies (esp. `routeActivityOnLivePublicationRideWritten`, listing triggers) | Production billed executions; **whole-run** if logs lack ISO window slice |

**Derived (ok):** solo vs dual **ratios** of the client deltas above for the same `MEASURE_MS`.
**Not derived as $:** any dollar or console R/W projection from these counts (`08-review`).

### 8.3 Hard limitations (state explicitly in result JSON)

1. Emulator counts ≠ production billed Firestore / RTDB / Functions.
2. CF begin counts on this runner are often **whole `emulators:exec` run** (setup+solo+dual+teardown), not cleanly window-sliced — label as such; prefer **client deltas** for 1v2 write/delivery ratios.
3. No RTDB-failure injection in this pass — fallback quality is a **gate before throttle**, not part of this meter window.
4. Prior live console 1v2 report remains pre-deploy baseline only.

### 8.4 Exit criteria for this measurement task

- Solo + dual complete with same `MEASURE_MS`, meters reset at measure start, JSON artifact written.
- Report client deltas + ratios; CF by-name if Functions emulator attached, with whole-run caveat.
- **Pass ≠ savings claimed.** Next coding (throttle) stays deferred until fallback-quality evidence is planned/run.

### 8.5 Task IDs after correction

| ID | Status | Item |
|---|---|---|
| **28A** | **DONE** (this note) | Defer FS throttle; promote measurement; design above |
| **28** | **PENDING — next** | Run controlled emulator 1v2 meters per §8 (harness/tests only as needed; **no** cadence change) |
| **28T** | **DEFERRED** | Former §7A FS write throttle — after §8 meters **and** RTDB-fail→FS fallback quality |
| **29** | PENDING | routeActivity trigger surgery — after 28T (+ meters) if still needed |
| **30** | superseded by **28** | Former “local traffic meters” queue id — same work as **28** |

---

## 9. Non-goals this audit / 28A

- No apps/web HUD / MapHud edits in this planning pass
- No throttle / product cadence change
- No test execution in 28A
- No revert of parallel worktree changes
- No commit / push / deploy / merge
