# Result 31C — Post-4s functional regression (1·2 riders)

Status: **DONE PASS**
Date: 2026-10-01
Owner: Developer (Cursor). Supervisor does not code.
Branch / worktree: `codex/public-trail-traffic`
Product / harness / HUD / MapHud / schema / cadence: **unchanged** (run-only)
No commit / push / deploy / live Firebase

---

## Verdict

On current **FS livePublicationRides heartbeat 4s** (TASK-31A) branch:

| Run | Exit | Process (incl boot) | Playwright | Result |
|---|---|---|---|---|
| create-matrix (`--grep create`) | **0** | **214215ms** ≤300s | **1 passed (3.0m)** · body **175183ms** | **PASS** `allPass: true` |
| F6 solo finish (`--grep F6`) | **0** | **115916ms** ≤300s | **1 passed (1.4m)** · body **~1.3m** | **PASS** |

**4s stale peer / summary / listing issue:** **not observed** in this gate set. Peer data (F3), Stop live-clear (F4/F7/F8), rejoin (F5), listing remove (F7), and F6 auto-finish summary+live+listing clear all passed on first authorized run each. No product/harness fix required; no blind rerun.

---

## Environment

| Field | Value |
|---|---|
| Port | `RTW_DEV_PORT=5050` |
| Workers / retries | 1 / 0 |
| Headless | yes (Playwright default in harness) |
| Emulators | auth · firestore · database · functions (local only) |
| Process deadline | 300s each (existing create/F6 deadline) |
| Scope | **1 rider and 2 riders only** |
| Blind rerun | **No** |

---

## create-matrix (F1–F5 · F7 · F8)

Session `matrix-1790800838073` · trail `2opi5fLi9hbcr067Y8dP`

| # | Item | Status | Evidence |
|---|---|---|---|
| F1 | Public Trail 생성 | **PASS** | open/open · listing · liveA |
| F2 | 동행 참여/합류 | **PASS** | B live · `?trail=` |
| F3 | 동행 peer/data | **PASS** | peersA/B=1 · peerDataOk; **visible HUD Dom false both — not claimed** (L) |
| F4 | Stop (summary + live clear) | **PASS** | A summary · aLiveAfterStop=false · B keep · listing while B |
| F5 | 재참여 | **PASS** | A live after clean goto · B still · listing |
| F7 | Trail 종료 (양쪽 Stop) | **PASS** | dual summaries · dual live clear · listingGone |
| F8 | 다른 라이더 유지 | **PASS** | B live+end · listing after A Stop |

### F7 hub (secondary — not a pass gate)

| Subgate | Result |
|---|---|
| dual-live-clear | ok — aLiveEvidence=false, bLiveEvidence=false |
| openListingAfterEnd | **false** |
| hub UI (`trailListedInHub`) | **TIMEOUT / NOT VERIFIED** — `hubError=bounded-timeout 20000ms — trailListedInHub`; `hubIsSecondary=true` |
| Claimed as hub absence verified? | **No** (same honesty rule as 29D) |

Artifacts:

- `document/ops/20260929-public-trail-traffic/public-trail-functional-1-2-task31c.json`
- `document/ops/20260929-public-trail-traffic/public-trail-functional-phases-task31c.jsonl`
- `document/ops/20260929-public-trail-traffic/.task31c-create-matrix.log`
- `apps/web/.out/firebase-traffic/public-trail-functional-1-2.json` (runtime twin)

---

## F6 solo auto-finish

Session `f6-1790801080286` · trail `JFVfV8ETZAFAog3c05TZ`

| Field | Value |
|---|---|
| Route | shortest intro **0.41 km** @50km/h |
| Summary pair | **0.41 / 0.41** (auto-finish; **no** manual Stop) |
| liveAfterFinish | **false** |
| openListingAfterFinish | **false** |
| Harness / product edit | **None** |

Phases:

| Phase | Result |
|---|---|
| F6-boot | ok — selectedKm=0.41 |
| F6-ride-to-finish | ok — pairText=`0.41 / 0.41` |
| F6-cleanup | ok — liveAfterFinish=false, openListing=false |

Artifacts:

- `document/ops/20260929-public-trail-traffic/public-trail-functional-f6-task31c.json`
- `document/ops/20260929-public-trail-traffic/public-trail-functional-phases-task31c-f6.jsonl`
- `document/ops/20260929-public-trail-traffic/.task31c-f6.log`
- `apps/web/.out/firebase-traffic/public-trail-functional-f6.json` (runtime twin)

---

## 4s heartbeat impact (this TASK)

| Concern | Observation |
|---|---|
| Stale peer motion / peerDataOk | F3 passed (peers≥1 both). No fail attributable to 4s FS heartbeat (RTDB 5Hz still primary motion). |
| Stale summary after Stop/finish | F4/F6/F7 summaries appeared within existing budgets. |
| Stale open listing | Listing present while B riding; gone after both end / F6 finish. |
| Timing vs 29D/29E @1s era | create process **214s** (29D was 192s); F6 process **116s** (29E was 136s). Within same 300s deadline; no gate weaken. |

---

## Commands

```text
RTW_DEV_PORT=5050
PATH+=repo/node_modules/.bin
node scripts/e2e/run-with-deadline.mjs --limit-sec 300 -- \
  node scripts/e2e/run-with-functions-emulator.mjs \
  "playwright test public-trail-functional-1-2 --grep create --workers=1 --retries=0"

node scripts/e2e/run-with-deadline.mjs --limit-sec 300 -- \
  node scripts/e2e/run-with-functions-emulator.mjs \
  "playwright test public-trail-functional-1-2 --grep F6 --workers=1 --retries=0"
```

---

## Next

Merge / deploy remain **NEEDS_APPROVAL** only. F3 map two-rider visual = Chief/user **L** only.
