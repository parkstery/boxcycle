# Result 31A — Firestore `livePublicationRides` steady heartbeat 1s → 4s

Status: **DONE PASS**
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor-directed.
Scope: narrow publish throttle only. **No** FS schema, RTDB cadence, HUD/MapHud, listener-scope, commit/push/deploy.
Comparison: **1 vs 2 riders** evidence model only.

---

## 1. Audit (before change)

| Symbol / path | Role | 4s OK? |
|---|---|---|
| `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS` (`rideSyncPolicy.ts`) | SoT for steady FS write gate | **yes** — only consumer of interval is `shouldPublishRouteProgress` |
| `shouldPublishRouteProgress` (`liveLocationSnapshot.ts`) | `routeWriteAt===0` immediate; `≥ heartbeat`; speed Δ ≥ 0.28 mps | preserved (logic unchanged) |
| `TRAIL_LIVE_PROGRESS_MIN/MAX_WRITE_MS` | aliases of heartbeat | follow SoT |
| `PEER_MOTION_PUBLISH_INTERVAL_MS = 200` | RTDB 5Hz | **unchanged** |
| `PEER_LIVE_RIDE_STALE_MS = 15_000` (`trailLivePolicy.ts`) | peer hide | margin **11s** (≫ rejected 8–10s margins of 5–7s) |
| `PEER_LIVE_RIDE_EXTRAP_MAX_MS = 12_000` | extrap ceiling | still ≫ 4s |
| Join burst / `routeWriteAt=0` speed burst / `finalizeAndDelete…` | initial · speed · end | **not gated by heartbeat** |
| `routeActivityOnLivePublicationRideWritten` | Written on every FS setDoc; handler skips tiny Δ; pulse/anchor on Δ≥0.012 / band / 0.08 | reducing **upstream** write rate preserves create/delete + mid-ride meaningful updates when they occur on remaining ticks; 24h reconcile still not a substitute |
| `TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS = 4_000` | unused legacy alias in trail repo | comment only; SoT remains rideSyncPolicy |
| HUD / MapHud / listener scopes | out of scope | untouched |

**Verdict:** 4s does **not** violate a critical contract. Safest ≤4s option if rejected would have been keep 1s or pick 2–3s; **not needed** — 30B already showed fs=4000 jump≤1.3m / margin 11s.

---

## 2. Implementation

- `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS`: `1_000` → `4_000`
- Comments aligned (PublicationSharedPresence, syncFromPresence, fanout, rtdbTrailMotion, mergePackets, trailLivePolicy)
- Gate function body unchanged → initial / speed-change / RTDB 5Hz behavior preserved by construction

---

## 3. Expected static write-rate reduction (not billing)

Steady riding only (no speed churn, after initial write):

| | Before | After | Ratio |
|---|---|---|---|
| FS `livePublicationRides` setDoc attempts / rider / s | **1.0** | **0.25** | **4× fewer** (75% cut) |
| RTDB motion set / rider / s | 5.0 | 5.0 | unchanged |

Directional fan-out (code shape, not billed): collection listener deliveries and `routeActivityOnLivePublicationRideWritten` **begin** counts during steady cruise scale with the same ~4× write cut for 1v2. Join burst, pause/speed edges, finalize/delete, and meaningful-progress CF work still fire when those events happen.

---

## 4. Evidence

| Check | Result |
|---|---|
| `live-route-progress-heartbeat-contract.test.ts` | **5/5** |
| `sync-policy-constants-contract.test.ts` (+ TASK-31A assertion) | **8/8** suite |
| `rtdb-fs-fallback-source-select.test.mjs` | **8/8** |
| `peer-liveness-contract.test.ts` | **7/7** |
| `replay.mjs --check` | **19/19** |
| Fallback harness `--suite fallback --interval 4000` | **12/12** → committed [`task31a-fallback-4s.summary.json`](task31a-fallback-4s.summary.json) (maxJump **1.3m**, maxBack **0**, staleRiskMargin **11000**, retake **1.0**); full raw `task31a-fallback-4s.json` remains **local-only** |
| eslint (touched) | PASS |
| build | skipped (type/lint surface only; no TS API change) |

---

## 5. Out of scope / follow-ups

- Emulator 1v2 meter re-run (28D-B style) — optional after deploy decision
- `routeActivity` Created/Deleted surgery (queue optional TASK-29)
- 8–10s still **not** recommended (jump↑, stale margin 5–7s)
