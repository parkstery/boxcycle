# Result 28B-R — RTDB set-meter placement (narrow)

Status: **DONE**
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope: TASK-28B-R narrow correction only. No cadence / payload / HUD / E2E / commit / deploy / merge.

---

## 1. Defect

In `mergeTrailMotionSnapshot`, `noteRtdbMotionWriteAttempt()` (and the shared catch → `noteRtdbMotionWriteError()`) ran **before** DEV `__rtwMotionWriteFaultOnce` injection. A synthetic fault throws without calling RTDB `set()`, yet attempts/errors were counted as if a write had started.

FS `setDoc` path was already exact (attempt → `setDoc` → ok / catch error). Confirmed; left unchanged.

---

## 2. Fix

`rtdbTrailMotion.ts` — fault gate first (behavior unchanged), then meters **only** around actual `set()`:

1. DEV fault injection / throw (unchanged)
2. `noteRtdbMotionWriteAttempt()`
3. `await set(...)`
4. `noteRtdbMotionWriteOk(payload)` on success
5. `noteRtdbMotionWriteError()` only when that `set()` throws

`trafficPublishMeters.ts` — field/helper comments now state exactly what is counted (actual `set`/`setDoc` starts & failures; fault-before-set excluded).

---

## 3. Production observability

All `note*` helpers still begin with `if (!isDevMeter()) return;` (`import.meta.env.DEV`).
`installTrafficPublishDebug` still returns immediately when `!import.meta.env.DEV`.
No product publish path, cadence, or payload change. Production behavior remains no-op for meters.

---

## 4. Files touched (this R only)

| File | Change |
|---|---|
| `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts` | Move attempt/ok/error around actual `set` only |
| `apps/web/src/lib/debug/trafficPublishMeters.ts` | Comment precision (names ↔ counted events) |
| `apps/web/scripts/traffic/traffic-publish-meters.test.ts` | +3 contracts: prod gate, FS setDoc wrap, RTDB fault-before-attempt |

**Not touched:** E2E harness, MapHud/HUD, cadence/payload, subscription hubs, FS ride repo, `main.tsx`, `package.json`.

---

## 5. Verification

| Check | Result |
|---|---|
| `npm run test:traffic-meters` | **7/7 PASS** |
| eslint (touched files only) | PASS |
| web build | **skipped** — reorder/comments only; no API/type surface change |

---

## 6. Next

- **28C** — controlled emulator 1v2 measure window (unchanged plan).
- Parent summary: [28b-result-meter-instrumentation.md](28b-result-meter-instrumentation.md).
