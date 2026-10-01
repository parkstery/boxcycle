# Result 28B — DEV traffic meter instrumentation (no cadence change)

Status: **DONE** (see **28B-R** placement correction: [28br-result-meter-set-placement.md](28br-result-meter-set-placement.md))
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope: TASK-28B small implementation per `27-result-remaining-traffic-audit.md` §8.
No product cadence / payload / subscription / UI / functional E2E changes. No commit / push / deploy / merge.

---

## 1. What was instrumented

| Metric | Where counted | Snapshot field |
|---|---|---|
| Trail `livePublicationRides` **setDoc** attempts / success / errors | `firestoreTrailLivePublicationRides.mergeTrailLivePublicationRideSnapshot` | `livePublicationRideWriteAttempts` · `livePublicationRideWrites` (success) · `livePublicationRideWriteErrors` |
| Trail RTDB motion **set** attempts / success / errors | `rtdbTrailMotion.mergeTrailMotionSnapshot` (**around actual `set` only**; DEV fault-before-set excluded — 28B-R) | `rtdbMotionWriteAttempts` · `rtdbMotionWrites` · `rtdbMotionWriteErrors` |
| RTDB motion payload bytes (approx) | Sum of UTF-8 `JSON.stringify(payload)` length on **successful** sets | `rtdbMotionWriteBytesApprox` |
| FS hub **onSnapshot deliveries** | `livePublicationRidesSubscriptionHub` underlying callback | `fsLiveRideUnderlyingDeliveries` |
| FS underlying **docChanges** | `subscribeTrailLivePublicationRides` → `snap.docChanges().length` | `fsLiveRideUnderlyingDocChanges` |
| RTDB hub **onValue deliveries** | `rtdbMotionSubscriptionHub` underlying callback | `rtdbMotionUnderlyingDeliveries` |

DEV window API (`installTrafficPublishDebug` from `main.tsx`, DEV only):

- `window.__rtwTrafficMeters()` → snapshot
- `window.__rtwTrafficMetersApi.reset()` / `.snapshot()` / `.delta(start, end)`

Production: `note*` helpers no-op when `import.meta.env.DEV` is false. Build output unchanged in behavior (cadence/payloads untouched).

---

## 2. Hard caveats (must stay on every 28 / 28C artifact)

1. **Deliveries ≠ billed reads.** `fsLiveRideUnderlyingDeliveries` / `rtdbMotionUnderlyingDeliveries` are client hub callback counts, not Firestore document-read billing or RTDB download billing.
2. **Doc-changes ≠ billed reads.** `fsLiveRideUnderlyingDocChanges` is a multi-doc fanout shape hint only.
3. **Write counters ≠ billed writes.** Attempts/success are client-side; emulator ≠ production console.
4. **`rtdbMotionWriteBytesApprox` ≠ wire/billing bytes** — relative 1v2 bandwidth shape only.
5. No browser E2E / solo-dual measure window in this task → that is **28C**.

---

## 3. Files touched (this task)

### New

- `apps/web/src/lib/debug/trafficPublishMeters.ts`
- `apps/web/src/lib/debug/installTrafficPublishDebug.ts`
- `apps/web/scripts/traffic/traffic-publish-meters.test.ts`

### Wired (meter calls only)

- `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts` — setDoc attempt/ok/error + docChanges
- `apps/web/src/lib/trail/repo/livePublicationRidesSubscriptionHub.ts` — delivery
- `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts` — set attempt/ok/error + bytes
- `apps/web/src/lib/peerMotion/repo/rtdbMotionSubscriptionHub.ts` — delivery
- `apps/web/src/main.tsx` — `installTrafficPublishDebug()`
- `apps/web/package.json` — `test:traffic-meters` script only

### Explicitly not owned / reverted from flight path

- FS write meters were **not** left on `routePublishFlight` (that would double-count vs true setDoc). Flight file left without traffic-meter imports.

### Not touched

- Payloads, publish intervals, subscription gates, MapHud / HUD clock, functional E2E, 28C harness run.

---

## 4. Verification

| Check | Result |
|---|---|
| `npm run test:traffic-meters` | **4/4 PASS** (reset, delta, UTF-8 byte accounting, doc-change guard) |
| `npm run lint` | PASS |
| `npm run build` | PASS (`tsc -b && vite build`) |

---

## 5. Next

- **28C** — controlled emulator 1v2 measure window using `__rtwTrafficMetersApi` (quiet setup → reset → fixed `MEASURE_MS`). Design: `27-result` §8.
- **28T** remains deferred until meters + RTDB→FS fallback quality.
