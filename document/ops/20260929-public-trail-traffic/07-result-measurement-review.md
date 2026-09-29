# Result 06 — Measurement review (pre-deploy baseline)

Status: DONE
Task: [06-task-measurement-review.md](06-task-measurement-review.md)
Date: 2026-09-29
Scope: read-only. Isolated branch may already contain listing/5Hz edits; report = **pre-deployment baseline**.

---

## 1. Timeline vs report claims

Sources: `ride-phases-remeasure-solo.jsonl`, `ride-phases-remeasure-dual.jsonl`, `firebase-traffic-compare.spec.ts`, archive report.

| Phase (KST) | ISO (UTC) | Notes |
|---|---|---|
| solo_ready_quiet | 08:17:26 | After `ensureRiding` + `setSpeedKmh(12)` |
| solo_ride_start→end | 08:18:56–08:19:56 | Stamped 60s window |
| dual_ready_quiet | 08:22:58 | After A+B `ensureRiding` + B `setSpeedKmh` |
| dual_ride_start→end | 08:24:28–08:25:28 | Stamped 60s window |

### Quiet ≠ Firebase quiet — **confirmed (code + timeline)**

Spec stamps `*_ready_quiet` **after** riding has started (`ensureRiding` / `setSpeedKmh`), then waits 90s with no further UI actions (`spec.ts` ~106–117, ~148–153).
Quiet = **UI inactivity for console capture**, not Firestore silence. During quiet, ~1 Hz `livePublicationRides` writes and listeners remain active.

### 363 vs 1,200 are not aligned 60s ride totals — **confirmed**

Console bins are clock minutes. Stamped rides cross bin boundaries:

- Solo 08:18:56–08:19:56 → ~4s in 08:18 bin + ~56s in 08:19; report cites **08:19–08:20 = 363**.
- Dual 08:24:28–08:25:28 → ~32s in 08:24 + ~28s in 08:25; report cites **08:24–08:25 = 1,200**.

Those two numbers are **same-label clock bins**, not equal-length ride integrals. Dual’s 08:24 bin also includes ~28s of pre-stamp dual traffic (still inside the 90s “quiet”).

### 08:23–08:24 as “join event” — **not supported**

`dual_ready_quiet` = **08:22:58**. Join/setup finished by then. 08:22:58–08:24:28 is the dual quiet wait with **both already riding**.
Report line treating 08:23–08:24 as “B 합류 + 양쪽 준비” overstates join; that minute is mostly **ongoing dual live traffic**. Join+B setup better overlaps **08:22** (script_start 08:22:19 → ready 08:22:58).

### 60-minute totals / listener peak — **mixed workload**

`remeasure-t0.json`: reads 22k, writes 1.3k, listenersMax **79**, connectionsMax 8 (window includes ~08:05 first-run spike). Report’s 1.9만/2.2천/79 is the same class of **sliding 60m mixed load**, not a pure 1v2 ride attribution. Ratio ~8–9:1 reads:writes is consistent with that mixed window; do **not** treat it as ride-only cost mix.

---

## 2. Evidence classes

| Claim | Class |
|---|---|
| Quiet after ride start; Firebase still active | **Code-supported** |
| 363 / 1,200 not exact 60s ride totals | **Measurement + timeline** |
| 08:23–08:24 ≠ join | **Timeline** |
| 60m / listener 79 = mixed | **Measurement** |
| Read ≫ write as optimization priority | **Hypothesis** from mixed + per-minute samples (direction OK; magnitude not op-attributed) |
| 2인 read ×3.3 / write ×2.1 | **Report measurement** on misaligned bins — directional only |
| Specific $ / op attribution by path | **Not justified** from console totals alone |

---

## 3. onSnapshot map — 1 vs 2 Trail riders

Paths that can be live while authenticated on a Trail ride (this branch). **Refcount hubs** collapse multi-consumer fan-in to one underlying listener per key.

| Path | Subscribe site | Refcount? | 1 rider | 2 riders same Trail |
|---|---|---|---|---|
| `openTrailListings` (limit 40) | `firestoreOpenTrailListings.ts:352` ← `useOpenTrails` (`App` enables for any logged-in trailhead session: `App.tsx:778–780`) | No hub (one hook) | 1 / client | 1 / client (2 clients) |
| CG `livePublicationRides` (`lastSeenAt` query, limit 80) | `firestoreTrailLivePublicationRides.ts:240` via `activeLiveRideTrailIdsSubscriptionHub.ts:56–62` | **Yes** (process-wide 1) | 1 / client | 1 / client; **every live write can bill both CG listeners** |
| `trails/{id}/livePublicationRides` | `…Rides.ts:71` via `livePublicationRidesSubscriptionHub.ts:76–88` ← `PublicationSharedPresence`, spectator overlay, world overlay | **Yes** (per trailId) | 1 underlying / trail / client | Same; **each peer write → both clients’ collection listeners** |
| `trails/{id}/members` | `firestoreTrail.ts:112` ← `useTrailSession` (`App.tsx:808–812`) | No | 1 / client | 1 / client |
| `publicationSessions/{pubId}/members` | `firestorePublicationSessionPresence.ts:130` ← `PublicationSharedPresence.tsx:187` | No | 1 / client | 1 / client |
| `livePresence` (collection) | `firestoreGlobalLivePresence.ts:64` ← `useGlobalLivePresence` (gated on course id: `App.tsx:1495–1500`) | No | 0–1 / client | same |
| `users/{uid}` | `useUserTier.ts:52`; also `firestoreRouteToken.ts:13` | No (possible **duplicate** doc listeners) | 1–2 / client | same |
| `config/routeTokenEconomy` | `firestoreRouteTokenEconomy.ts:33` | No | 0–1 / client | same |
| `conquest/{uid}` | `firestoreConquest.ts:33` | No | 0–1 / client | same |
| `rides/{id}` conquest result | `rideConquestSubscription.ts` (post-end) | No | mainly ride-end | same |

**Already refcounted:** trail `livePublicationRides` hub; CG active-trail-ids hub.
**Fanout (code shape, not billed proof):** write path `publishLiveLocationFanout` → ~1 Hz `trails/{id}/livePublicationRides/{uid}` (`rideSyncPolicy.ts:34` `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS`) + slower `livePresence` / trail activity. With 2 clients, each progress write can generate reads on **collection listener × clients** and **CG listener × clients**; CF listing triggers are a separate amplifier (branch may already gate update-only — **not** in this baseline run).

World overlay (`useWorldLivePublicationRideMapOverlay.ts:117–118`) can acquire **one hub slot per trailId** in `liveRideTrailIds` (open listing + CG ids + current trail). That widens listener count beyond the single shared Trail when many trails are live — candidate for spikes like listener 79 under messy runs (**hypothesis**, not attributed to 08:24).

---

## 4. Concrete reduction candidates (code-backed)

1. **Disable or pause `useOpenTrails` + CG** while `isRideSessionActive` (today always on for logged-in users) — cuts listing + project-wide CG read amplification during ride.
2. **Narrow world overlay trailId set** during ride to current trail only — fewer `livePublicationRides` hubs.
3. **Keep/verify listing CF update-skip** (branch work) — reduces write→recompute→listing snapshot churn; remeasure after deploy.
4. **Merge `users/{uid}` listeners** (tier + routeToken) — small steady-state win.
5. **Gate whole-collection `livePresence`** when map does not need it.

Do not assign console-bin ops to these without operation-level meters.

---

## 5. Next measurements (recommended)

1. Same protocol but stamp quiet **before** `ensureRiding`, or stop publishes during quiet — isolate UI quiet from Firebase quiet.
2. Compare **integral over stamped ISO windows** (sum adjacent minute bins weighted by overlap), not single clock minutes labeled “1인/2인”.
3. Client `trackUnderlyingReadSubscription` / DEV meters during a clean 1v2 run: count active underlying listeners by kind at ride mid-point.
4. Post-deploy A/B only after (1)+(2); treat current 363/1200 as **ordinal**, not ×3.3 cost law.

---

## 6. Verdict

Report correctly prefers minute hover over sliding 60m deltas and correctly flags read-side sensitivity. It **overclaims** (a) quiet as low Firebase, (b) 08:23–08:24 as join, (c) 363 vs 1,200 as aligned 1-minute ride totals, (d) 60m/listener peaks as ride-pure. Optimization should still target **listener scope + write→snapshot fanout**, with a cleaner quiet/window protocol before trusting multipliers.
