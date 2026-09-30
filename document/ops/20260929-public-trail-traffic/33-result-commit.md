# TASK-33 — Evidence hygiene + isolated branch commit

Status: **DONE** (local commit only)
Branch: `codex/public-trail-traffic`
Developer: Cursor
Date: 2026-10-01 (~05:55 KST)

---

## Authorization

Supervisor reviewed TASK-32 A/B manifest and authorized a **LOCAL** commit on this isolated branch only. **No push / merge / deploy.**

---

## Evidence hygiene

Compact checked-in summaries (scenario metrics + pass/fail counts; `selectionSamples` / `timeline` omitted):

| Summary (committed) | pass | Raw (local-only, not committed) |
|---|---|---|
| `task30b-baseline-fail.summary.json` | 16/48 | `task30b-baseline-fail.json` (may be absent; pre-fix FAIL matrix) |
| `task30b-after-fix.summary.json` | 48/48 | `task30b-after-fix.json` |
| `task30c-baseline-fail.summary.json` | 0/6 | `task30c-baseline-fail.json` (may be absent; pre-fix FAIL matrix) |
| `task30c-after-fix.summary.json` | 6/6 | `task30c-after-fix.json` |
| `task30c-fallback-regress.summary.json` | 48/48 | `task30c-fallback-regress.json` |
| `task31a-fallback-4s.summary.json` | 12/12 | `task31a-fallback-4s.json` |

Ops reports (`30-result`, `30c-result`, `31a-result`, queue, README, PROGRESS) point to `*.summary.json` and state that full raw dumps remain local-only. Raw files were **not** deleted when present.

---

## Stage policy

- Explicit allowlist from classes **A/B** only (`git add` path list; never `git add .`).
- Excluded **C**: `boxcycle-theme.css`, `MapHud.tsx`, `MapHud.css`, `.relay-handoff-ignore.json`.
- Excluded **D**: heavy raw harness dumps, superseded fail artifacts, scratch `.task*`, `listener-scope-ride-task25.json`, `task30a-*`, attempt1 INVALID.

---

## Verification (this task)

- JSON parse + passCount/failCount/allPass consistency vs regenerable raws: **OK**
- TASK-32 builds/tests already PASS — not re-run

---

## Commit report

| Item | Value |
|---|---|
| SHA | `f37006f9ac1726abbd19ff613a2233792212a584` (+ follow-up lint hygiene commit) |
| Committed file count (primary) | **80** |
| `git diff --cached --check` (pre-commit) | **PASS** (exit 0) |
| Push / merge / deploy | **not performed** |

### Excluded dirty paths still present (intentional)

**C (unrelated UI — preserve, uncommitted):**
- `apps/web/src/boxcycle-theme.css`
- `apps/web/src/components/maphud/MapHud.tsx`
- `apps/web/src/components/maphud/MapHud.css`
- `document/ops/20260929-public-trail-traffic/.relay-handoff-ignore.json`

**D (raw / superseded / scratch — local-only):**
- Heavy harness raw: `task30b-after-fix.json`, `task30c-after-fix.json`, `task30c-fallback-regress.json`, `task31a-fallback-4s.json`
- Superseded 30A: `task30a-*.json`
- Fail/superseded: `public-trail-functional-*-task29a-fail*`, `*-task29c*`, `task31b-attempt1*`, `.task31b-attempt1-INVALID.md`
- Scratch: `.task29*.md`, `.task29ar*`, `listener-scope-ride-task25.json`
- Note: `task30b-baseline-fail.json` / `task30c-baseline-fail.json` raw dumps not restored (pre-fix FAIL matrices); committed `.summary.json` retain metrics/pass counts

### Remaining deployment hazards (unchanged from TASK-32)

1. R2 must deploy Created/Deleted listing CF **and delete** legacy Written names.
2. 4s FS heartbeat: RTDB outage → FS fallback freshness window wider (harness-covered).
3. `routeActivityOnLivePublicationRideWritten` still Written (optional TASK-29).
4. R1 merge / R2 deploy still **NEEDS_APPROVAL**.
