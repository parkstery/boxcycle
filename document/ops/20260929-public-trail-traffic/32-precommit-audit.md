# TASK-32 — Final pre-commit audit

Status: **READY_FOR_SUPERVISOR_REVIEW** (no commit/stage/push/merge/deploy)
Branch: `codex/public-trail-traffic`
Auditor: Cursor Developer
Date: 2026-10-01 (~05:48–05:55 KST)

---

## Verdict

Builds and focused contracts **PASS**. Product + listing Created/Deleted + 4s FS heartbeat are coherent.
**Do not commit** until Supervisor signs the manifest. Exclude **(C)** unrelated UI and **heavy raw (D)** JSON/logs; keep them locally.

---

## Classification key

| Class | Meaning |
|---|---|
| **A** | Public Trail traffic deliverable (product / CF / DEV meters wiring / npm scripts) |
| **B** | Required focused test / harness / ops evidence (result md + small summary JSON) |
| **C** | Unrelated pre-existing edits — **do not revert** |
| **D** | Disposable run logs / superseded / heavy raw artifacts — **preserve locally, do not commit** |

---

## A — Deliverable (commit candidates after Supervisor OK)

### Product / CF

| Path | Note |
|---|---|
| `apps/web/src/lib/ride/rideSyncPolicy.ts` | `TRAIL_LIVE_PROGRESS_HEARTBEAT_MS = 4000`; RTDB 5Hz |
| `apps/web/src/lib/ride/liveLocationSnapshot.ts` | `shouldPublishRouteProgress` gate |
| `apps/web/src/lib/ride/publishLiveLocationFanout.ts` | fanout + meters wrap |
| `apps/web/src/lib/trail/trailLivePolicy.ts` | stale/extrap comments aligned |
| `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts` | FS setDoc + meters |
| `apps/web/src/lib/trail/repo/livePublicationRidesSubscriptionHub.ts` | hub + docChanges meters |
| `apps/web/src/lib/peerMotion/index.ts` | exports |
| `apps/web/src/lib/peerMotion/mergePackets.ts` | dual-source / fallback |
| `apps/web/src/lib/peerMotion/syncFromPresence.ts` | select + stamp |
| `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts` | RTDB set meters |
| `apps/web/src/lib/peerMotion/repo/rtdbMotionSubscriptionHub.ts` | hub |
| `apps/web/src/components/PublicationSharedPresence.tsx` | default-trail skip + comments |
| `apps/web/src/main.tsx` | `installTrafficPublishDebug()` (DEV-gated meters) |
| `apps/web/src/lib/debug/installTrafficPublishDebug.ts` | **new** |
| `apps/web/src/lib/debug/trafficPublishMeters.ts` | **new** — `isDevMeter()` no-op in prod |
| `apps/web/src/lib/debug/trafficPairedCapture.ts` | **new** — in-page paired capture |
| `functions/src/openTrailListingProjection.ts` | Created/Deleted; Written removed for members/live |
| `functions/src/openTrailListingProjection.test.ts` | registration + index contract |
| `functions/src/index.ts` | new exports; legacy Written names gone |

### Tooling scripts (A/B boundary — ship with branch)

| Path | Note |
|---|---|
| `apps/web/package.json` | traffic/functional npm scripts + heartbeat in `test:next-ride` |
| `apps/web/e2e/rideEntryHelpers.ts` | `shortest` / `maxKm` for F6 |
| `apps/web/e2e/peer-sync-s41r.spec.ts` | T5 / peer-sync traffic branch |
| `apps/web/scripts/peer-sync/scenarios.mjs` | 5Hz cmp scenarios |
| `apps/web/scripts/peer-sync/HARNESS.md` | harness notes |
| `apps/web/scripts/ride-verify/entry-contract.mjs` | entry contract touch |

---

## B — Focused tests / evidence (commit candidates; prefer small)

### New / modified tests & harness

| Path |
|---|
| `apps/web/e2e/public-trail-functional-1-2.spec.ts` |
| `apps/web/e2e/public-trail-traffic-1-2.spec.ts` |
| `apps/web/scripts/e2e/run-public-trail-traffic-meter.mjs` |
| `apps/web/scripts/traffic/traffic-publish-meters.test.ts` |
| `apps/web/scripts/traffic/traffic-paired-capture.test.ts` |
| `apps/web/scripts/ride-hierarchy/live-route-progress-heartbeat-contract.test.ts` |
| `apps/web/scripts/ride-hierarchy/sync-policy-constants-contract.test.ts` |
| `apps/web/scripts/peer-sync/cmp-rate-pair-input-equality.test.mjs` |
| `apps/web/scripts/peer-sync/rtdb-fs-fallback-harness.mjs` |
| `apps/web/scripts/peer-sync/rtdb-fs-fallback-source-select.test.mjs` |

### Ops docs (results / queue / progress)

| Path |
|---|
| `document/ops/20260929-public-trail-traffic/README.md` |
| `document/ops/20260929-public-trail-traffic/PROGRESS.md` |
| `document/ops/20260929-public-trail-traffic/22-task-queue.md` |
| `02-result-listing-trigger.md` · `03-review-listing-trigger.md` (updated) |
| `23-result-t5.md` … `31c-result-functional-4s.md` (result chain) |
| `26-task-listing-created-deleted.md` |
| `32-precommit-audit.md` (this file) |

### Small summary evidence JSON (OK to commit if Supervisor wants traces in-repo)

| Path | ~KB | Role |
|---|---|---|
| `public-trail-traffic-1-2.json` · `*-28db-baseline.json` | ~17 | meter summaries |
| `task31b-r.json` | ~19 | post-4s meters |
| `public-trail-functional-1-2-task29d.json` / `*-task31c.json` / `*-f6-*.json` | ≤5 | PASS matrices |
| `public-trail-functional-stop-probe.json` | &lt;1 | 29B |
| corresponding `*-phases*.jsonl` for PASS runs | ≤35 | phase traces |

---

## C — Unrelated (do not revert; exclude from traffic commit)

| Path | Why |
|---|---|
| `apps/web/src/boxcycle-theme.css` | `.hud-clock` glass style only |
| `apps/web/src/components/maphud/MapHud.tsx` | HUD live clock UI |
| `apps/web/src/components/maphud/MapHud.css` | clock layout |
| `document/ops/20260929-public-trail-traffic/.relay-handoff-ignore.json` | relay handoff marker (`ignore: []`) |

---

## D — Disposable / heavy (preserve locally; do not commit)

### Already gitignored (`*.log`)

All `document/ops/20260929-public-trail-traffic/.task*.log` / `.s41r*.log` / `.t5*.log` (~27 files). Local-only; OK.

### Heavy raw harness dumps (largest — keep local; commit `*.summary.json` instead)

| Path | ~KB | Why exclude |
|---|---|---|
| `task30c-fallback-regress.json` | **1294** | full fallback dump → summary committed |
| `task30b-after-fix.json` | **1291** | full fallback dump → summary committed |
| `task30b-baseline-fail.json` | **1257** | full baseline dump → summary committed (raw may be absent locally) |
| `task31a-fallback-4s.json` | **324** | full 4s fallback dump → summary committed |
| `task30c-baseline-fail.json` / `task30c-after-fix.json` | ~167 | dual-source dumps → summaries committed |
| `task30a-*.json` | ~50–55 | superseded 30A |

Summaries in-repo: `task30b-*.summary.json`, `task30c-*.summary.json`, `task31a-fallback-4s.summary.json`. Reports point to summaries and state raw files are local-only.

### Superseded / fail / diagnosis (optional local only)

| Path |
|---|
| `public-trail-functional-1-2-task29a-fail.json` + `*-phases-task29a-fail.jsonl` |
| `public-trail-functional-1-2-task29c.json` + phases (superseded by 29D) |
| `task31b-attempt1-phases.jsonl` · `.task31b-attempt1-INVALID.md` |
| `.task29ar-error-context-prev.md` · `.task29ar2-diagnosis.md` |
| `.task29b-result.md` … `.task29e-result.md` (dot scratch; canonical = numbered `*-result-*.md`) |
| `listener-scope-ride-task25.json` (historical E2E dump) |

---

## Commands / results (this audit)

| Command | Result |
|---|---|
| `git branch --show-current` | `codex/public-trail-traffic` |
| `git status --porcelain` | ~96 paths (M + ??); no stage |
| `git diff --check` | **PASS** (exit 0) |
| `npm run build` (`apps/web`) | **PASS** (`tsc -b && vite build`; chunk-size / pre-existing SADDLE/PELVIS warnings only) |
| `npm run build` (`functions`) | **PASS** (`tsc`) |
| `npm run test:traffic-meters` | **14/14** |
| heartbeat + sync-policy contracts | **13/13** |
| `cmp-rate-pair` + `rtdb-fs-fallback-source-select` | **22/22** |
| `peer-liveness-contract.test.ts` | **7/7** |
| `node scripts/peer-sync/replay.mjs --check` | **19/19** (exit 0) |
| `npm test` (`functions`) | **36/36** (listing Created/Deleted contract included) |
| Broad E2E re-run | **SKIPPED** (31C already PASS; no redundant matrix) |

No build failures → no product file fixes in this task.

---

## Deploy / merge risks (open)

1. **Legacy Written CF deletion (blocking for R2)**
   Source no longer exports `openTrailListingOnMemberWritten` / `openTrailListingOnLiveCourseRideWritten`.
   Deploying **without** deleting those orphaned v2 functions leaves `document.written` listeners → heartbeat updates still invoke CF (defeats TASK-26).
   Required: deploy Created/Deleted four + **delete** the two Written names.

2. **4s FS heartbeat**
   Steady `livePublicationRides` setDoc ~4× fewer; RTDB 5Hz unchanged. Stale margin ≈11s vs `PEER_LIVE_RIDE_STALE_MS=15s`. Functional @4s green (31C). Residual risk: RTDB outage → FS fallback freshness window wider; covered by 30B/30C/31A harness, not production A/B yet.

3. **`routeActivityOnLivePublicationRideWritten` still Written**
   Remaining CF cost on remaining FS updates (31B-R whole-run Written=213 vs 28D-B 320). Optional TASK-29; not a merge blocker.

4. **DEV meters**
   `isDevMeter()` gates all counters; production no-op (unit-covered). Safe to ship with Hosting.

5. **Commit hygiene**
   Accidental inclusion of **(C)** MapHud clock / theme or **~1.2MB** task30* JSON would pollute the traffic PR. Stage explicitly from this manifest.

6. **Out of scope still NEEDS_APPROVAL**
   R1 merge · R2 production deploy — Chief/Supervisor only. No push in this task.

---

## Suggested Supervisor commit slice (after review)

1. All **A** product/CF/debug + package.json
2. All **B** tests/harness + result md + small PASS JSON/jsonl
3. Explicitly omit **C** and heavy **D**
4. Separate commit or leave-out for MapHud clock if product wants it later

No commit performed by Developer in TASK-32.
