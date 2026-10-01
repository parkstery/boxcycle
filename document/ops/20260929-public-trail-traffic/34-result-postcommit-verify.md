# TASK-34 — Post-commit verification + stable report wording

Status: **DONE** (local doc commit only)
Branch: `codex/public-trail-traffic`
Developer: Cursor
Date: 2026-10-01 (~10:25 KST)

---

## Scope

1. Stabilize `33-result-commit.md` SHA wording (remove self-staling `(HEAD)` on `dd59808`).
2. Re-run builds + focused unit/type gates at current tip (lint commit landed after TASK-32 builds).
3. Preserve unrelated dirty **C** (MapHud/theme/relay-ignore) and **D** (raw dumps). No push / merge / deploy. No E2E re-run.

---

## Report wording fix (TASK-33)

`33-result-commit.md` previously labeled lint SHA `dd59808…` as `(HEAD)`, which became false after docs commits `646b87a` / `b9593c5`.

**After:** fixed role table — Primary / Lint / Docs (result) / Docs (PROGRESS) full SHAs — with explicit note **not** to treat any row as current HEAD. No other stale SHA labels found in that file.

---

## Verification (this tip)

| Command | Result |
|---|---|
| `npm run build` (`apps/web`) | **PASS** (`tsc -b && vite build`; pre-existing chunk-size / SADDLE/PELVIS warnings only) |
| `npm run build` (`functions`) | **PASS** (`tsc`) |
| `npm run test:traffic-meters` | **14/14** |
| heartbeat + sync-policy contracts | **13/13** |
| `cmp-rate-pair` + `rtdb-fs-fallback-source-select` | **22/22** |
| `peer-liveness-contract.test.ts` | **7/7** |
| `node scripts/peer-sync/replay.mjs --check` | **19/19** |
| `npm test` (`functions`) | **36/36** (listing Created/Deleted included) |
| Broad E2E (create-matrix / F6 / traffic meter) | **SKIPPED** (31C already PASS; not required) |

Typecheck covered by web `tsc -b` and functions `tsc` in the builds above. No product/traffic file fixes required.

---

## Final HEAD

Recorded after this task’s local doc commit (see commit message). Do **not** embed a mutable “(HEAD)” label in long-lived reports — use the SHA printed by `git rev-parse HEAD` at report time, or list fixed role SHAs only.

---

## Excluded dirty paths (preserved, uncommitted)

**C:**
- `apps/web/src/boxcycle-theme.css`
- `apps/web/src/components/maphud/MapHud.tsx`
- `apps/web/src/components/maphud/MapHud.css`
- `document/ops/20260929-public-trail-traffic/.relay-handoff-ignore.json`

**D:** raw `task30b/30c/31a*.json` (non-summary), `task30a-*`, fail/superseded functional dumps, scratch `.task*`, `listener-scope-ride-task25.json`, etc.

---

## Remaining production approval gates (unchanged)

1. **R1** — merge `codex/public-trail-traffic` → mainline: **NEEDS_APPROVAL**
2. **R2** — production deploy Hosting/Functions: **NEEDS_APPROVAL**; must deploy Created/Deleted listing CF **and delete** legacy Written names
3. Residual: 4s FS heartbeat widens FS-fallback freshness under RTDB outage (harness-covered); `routeActivityOnLivePublicationRideWritten` still Written (optional)

Push / merge / deploy: **not performed**.
