# Result 25 / TASK-29D + TASK-29E — 1·2인 Public Trail 기능 회귀 매트릭스

Status: **PASS** — create-matrix (29D) + F6 solo finish (29E)
Task: TASK-29E Supervisor (F6 완주 once; preserves TASK-29D create-matrix PASS)
Date: 2026-09-30
Branch / worktree: `codex/public-trail-traffic`
Product source: **unchanged**
No commit / push / deploy / live Firebase

---

## Evidence authority (read this first)

| Claim | Status |
|---|---|
| **TASK-25** emulator PASS (`allPass: true`, ~2026-09-29) | **NOT accepted as current stronger evidence** — historical **H** only. |
| **TASK-29A / 29A-R / 29A-R2** | **FAIL / PENDING** — superseded. |
| **TASK-29B single-rider-stop-probe** | **PASS** — solo Stop summary+liveClear. |
| **TASK-29C create-matrix** | **FAIL** — exit 1; F7 row false from post-hub live probe nulls (harness). Superseded by 29D. |
| **TASK-29D create-matrix** | **PASS** — exit 0; `allPass: true`. Authoritative stronger gate for F1–F5·F7·F8. |
| **TASK-29E F6 (`--grep F6`)** | **PASS** — exit 0; solo auto-finish (not Stop); summary pair + live/listing clear. |
| Chief live 1·2인 육안 | **L** — separate; not this gate |

---

## TASK-29D create-matrix run (authoritative for F1–F5·F7·F8)

| Field | Value |
|---|---|
| Grep | `create` (`create → join → companion → …`) |
| Exit | **0** |
| Process wall (incl emulator boot) | **192490ms (~192s)** ≤300s deadline |
| Playwright wall (test body) | **~164s** (`elapsedMs: 163675`) |
| Port | `RTW_DEV_PORT=5050` |
| Workers / retries | 1 / 0 |
| Emulators | auth, firestore, database, functions |
| Blind rerun | **No** (single authorized run) |

Evidence paths:

- `document/ops/20260929-public-trail-traffic/public-trail-functional-1-2-task29d.json`
- `document/ops/20260929-public-trail-traffic/public-trail-functional-phases-task29d.jsonl`
- `document/ops/20260929-public-trail-traffic/.task29d-create-matrix.log`
- `document/ops/20260929-public-trail-traffic/public-trail-functional-1-2.json` (canonical twin)
- `apps/web/.out/firebase-traffic/public-trail-functional-1-2.json` (runtime twin)

---

## TASK-29E F6 run (authoritative for F6 완주)

| Field | Value |
|---|---|
| Grep | `F6` |
| Exit | **0** |
| Process wall (incl emulator boot) | **135814ms (~136s)** ≤300s deadline |
| Playwright wall | **~1.4m** (`1 passed`) |
| Port | `RTW_DEV_PORT=5050` |
| Workers / retries | 1 / 0 |
| Emulators | auth, firestore, database, functions |
| Route pick | shortest intro ≤0.5km @50km/h |
| selectedKm / route distance | **0.41 km** |
| Summary pair (ridden / total) | **0.41 / 0.41** (equal — finish, not Stop) |
| liveAfterFinish | **false** |
| openListingAfterFinish | **false** |
| Manual Stop substituted | **No** |
| Harness edit | **None** (existing F6 test sufficient) |
| Blind / bounded rerun | **No** (first run PASS) |

Evidence paths:

- `document/ops/20260929-public-trail-traffic/public-trail-functional-f6-task29e.json`
- `document/ops/20260929-public-trail-traffic/public-trail-functional-phases-task29e-f6.jsonl`
- `document/ops/20260929-public-trail-traffic/.task29e-f6.log`
- `apps/web/.out/firebase-traffic/public-trail-functional-f6.json` (runtime twin)

Phases (session `f6-1790768093595`, trail `dzuPSFaXwMRoxctulQSR`):

| Phase | Result |
|---|---|
| F6-boot | ok — selectedKm=0.41 |
| F6-ride-to-finish | ok — pairText=`0.41 / 0.41` (auto summary; no Stop click) |
| F6-cleanup | ok — liveAfterFinish=false, openListing=false |

---

## Functional matrix (8 items) — stronger gate

| # | Item | Status | Evidence class | Notes |
|---|---|---|---|---|
| 1 | Public Trail 생성 | **PASS** | E | 29D: trail open/open/host+listing+liveA (`trailId=z8xfE77…`) |
| 2 | 동행 참여/합류 | **PASS** | E | 29D: B live + `?trail=` |
| 3 | 동행 peer/data | **PASS** | E | 29D: peersA/B≥1 · peerDataOk; **visible HUD Dom false both** — not claimed from `__rtwOtherLiveRiderCount` alone |
| 4 | Stop (summary UI + live clear) | **PASS** | E | 29D: A summary+liveClear; B keep; listing while B |
| 5 | 재참여 | **PASS** | E | 29D: A live after clean goto; B still; listing |
| 6 | Trail 완료 (완주) | **PASS** | E | **29E**: solo auto-finish; `0.41/0.41`; live+listing clear |
| 7 | Trail 종료 | **PASS** | E | 29D: dual Stop summaries + live clear + listingGone (see F7 detail) |
| 8 | 다른 라이더 주행 유지 | **PASS** | E | 29D: B live+end enabled+listing after A Stop |

Overall: create-matrix **PASS** (29D) + F6 **PASS** (29E).

**Claimed PASS items:** F1, F2, F3 peer data, F4, F5, **F6**, F7, F8.
**Not claimed here:** F3 visible UI (user observation / **L**).

### F7 detail (honest — from TASK-29D; unchanged)

| Subgate | Result |
|---|---|
| A Stop summaryVisible | **true** (`kmBeforeStopA=0.43`) |
| B Stop summaryVisible | **true** (`kmBeforeStopB=0.60`) |
| F7-dual-live-clear poll | **ok** — `aLiveEvidence=false`, `bLiveEvidence=false` (captured **before** hub) |
| openListingAfterEnd | **false** (listing removed) |
| F7 row `aLive` / `bLive` | **false** / **false** — from dual-live-clear capture |
| F7-hub-check (secondary) | **TIMEOUT / NOT VERIFIED** — `hubError=bounded-timeout 20000ms — trailListedInHub`; `listedInHubAfterEnd=false` (error path, not a verified hub absence) |
| hubIsSecondary | **true** — does not fail F7 row |

Core expects (listing gone + both summaries + dual live clear) **passed**. Hub UI check remains secondary and **must not** be marked verified on timeout.

---

## Harness changes

### TASK-29C→29D (create-matrix) — allowed files only

- `apps/web/e2e/public-trail-functional-1-2.spec.ts`
  - Live evidence captured at `F7-dual-live-clear` before secondary hub UI.
  - Hub shortened + `markHb`; hub marked secondary — timeout does not null core live evidence.
  - Task tags / wall messages: TASK-29D.
- Report + ops artifacts updated truthfully.
- **No product/HUD**, no commit/push/deploy.

### TASK-29E (F6)

- Spec inspected; **no harness edit** — existing F6 path (shortest≤0.5km @50km/h, auto-finish ≠ Stop, pair equality, live+listing clear) PASS on first run.
- **No product/HUD**, no commit/push/deploy.

---

## Next

1. F3 map two-rider visual = Chief/user **L** observation only.
2. Merge / deploy = **NEEDS_APPROVAL** only.

---

## Commands

### create-matrix (TASK-29D)

```text
RTW_DEV_PORT=5050
PATH+=repo/node_modules/.bin
node scripts/e2e/run-with-deadline.mjs --limit-sec 300 -- \
  node scripts/e2e/run-with-functions-emulator.mjs \
  "playwright test public-trail-functional-1-2 --grep create --workers=1 --retries=0"
```

| Result | Value |
|---|---|
| exit | **0** |
| playwright | **1 passed (2.8m)** |
| e2e-deadline elapsedMs | **192490** |

### F6 (TASK-29E)

```text
RTW_DEV_PORT=5050
PATH+=repo/node_modules/.bin
node scripts/e2e/run-with-deadline.mjs --limit-sec 300 -- \
  node scripts/e2e/run-with-functions-emulator.mjs \
  "playwright test public-trail-functional-1-2 --grep F6 --workers=1 --retries=0"
```

| Result | Value |
|---|---|
| exit | **0** |
| playwright | **1 passed (1.4m)** |
| e2e-deadline elapsedMs | **135814** |
| selectedKm / ridden / total | **0.41 / 0.41 / 0.41** |
| live / listing after finish | **false / false** |

Merge / deploy = **NEEDS_APPROVAL** only.
