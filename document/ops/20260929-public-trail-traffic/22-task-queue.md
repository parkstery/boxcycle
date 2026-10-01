# Task queue — Public Trail traffic (`codex/public-trail-traffic`)

Updated: 2026-10-01 (R1 DONE — `origin/main`=`f5f2130`; see `36-result-r1-merge-main.md`; R2 awaits Supervisor). Comparison scope: **1 rider / 2 riders only**. No larger-group work on this branch.

Status key: `DONE` · `IN_PROGRESS` · `PENDING` · `BLOCKED` · `NEEDS_APPROVAL` · `DEFERRED`

---

## DONE

| ID | Item | Evidence |
|---|---|---|
| 01–02 | Listing trigger: live-ride **update** skips `recomputeOpenTrailListing`; create/delete still recompute | `02-result-listing-trigger.md` · superseded by 26 for trigger type |
| 03 | Listing-trigger supervisor review | `03-review-listing-trigger.md` |
| 04–05 | RTDB publish target **100→200 ms (5Hz)** + replay scenario `candidate-5hz-jitter-gap` | `04-result-5hz.md` · `05-review-5hz.md` · replay 11/11 + 29 motion/sync contracts |
| 06–08 | Pre-deploy measurement review (quiet ≠ Firebase quiet; clock-minute bins not exact ride multipliers) | `07-result-measurement-review.md` · `08-review-measurement.md` |
| 09–10 | Ride listener scope: open listings / CG / world live overlay off during active ride (menu closed); current Trail peers kept | `10-result-listener-scope.md` |
| 11–12 | Pure gate module + runtime state-matrix tests **17/17** | `12-result-gate-tests.md` |
| 13–14 | Emulator listener E2E: CG `1→0→1→0→1`; mid-ride current Trail FS/RTDB open | `14-result-emulator-listeners.md` |
| 15–16 | Post-ride peer close diagnosis (then fixed by 17) | `16-result-post-ride-cleanup.md` (FAIL→superseded) |
| 17–18 | `PublicationSharedPresence` skips Firestore/RTDB hubs on Trailhead **`default`** after ride end | `18-result-default-trail-subscription.md` · emulator E2E PASS |
| 19–20 | S4-1R T5 audit (unresolved gate documented; no product change) | `20-result-s41r-t5.md` |
| 21 | Supervisor READY_FOR_REVIEW summary | `21-supervisor-review.md` |
| **22** | **T5 test stabilization** (deterministic deferred skip-live-session) | **`23-result-t5.md`** · T5-only PASS×2 · full T1–T5 PASS (port 5021) after **one intermittent T2 fail** on port 5020 |
| **24** | **5Hz companion-display quality replay** (paired scenarios + graphs) | **`24-result-5hz-quality.md`** — **inputs were not equal** (see 24R) |
| **24R** | **10Hz/5Hz comparison input equality fix** + regen graphs/lag | **`24-result-5hz-quality.md`** · equality test 14/14 · replay **19/19** · contracts 29/29 |
| **25** | **1·2인 기능 검증 (에뮬/로컬)** — create/join/companion/Stop/rejoin/finish/end/other-keeps | **`25-result-functional-matrix.md`** · **TASK-29D** create-matrix **PASS** (F1–F5·F7·F8) + **TASK-29E** F6 **PASS** (exit 0, 0.41/0.41, live+listing clear) · F3 peer data E; F3 visible UI **L**; hub secondary timeout not claimed · listener-scope/selector historical |
| **26** | **Listing CF Created/Deleted** — members·livePublicationRides update → **0 CF invocations** | **`26-result-listing-created-deleted.md`** · functions tests 36/36 · deploy must delete legacy Written names |
| **27** | **Remaining traffic READ-ONLY audit** — `routeActivityOnLivePublicationRideWritten` still Written on 1Hz heartbeat; listener/write model | **`27-result-remaining-traffic-audit.md`** · no product change |
| **28A** | **Corrective planning** — Supervisor rejects immediate FS 8–10s throttle; defer until metrics + RTDB→FS fallback quality; next = controlled emulator 1v2 meters | **`27-result-remaining-traffic-audit.md`** §7–§8 · docs only |
| **28B** | **DEV traffic meter instrumentation** — window read/reset API; FS setDoc + RTDB set attempts/success/errors; payload UTF-8 bytes; hub deliveries + FS docChanges | **`28b-result-meter-instrumentation.md`** · unit 4/4 · lint(touched) · web build PASS · no E2E |
| **28B-R** | **RTDB set-meter placement** — attempt/error only around actual `set()`; DEV fault-before-set excluded; FS setDoc path confirmed exact | **`28br-result-meter-set-placement.md`** · unit **7/7** · eslint(touched) PASS · build skipped |
| **28C** | **Controlled emulator 1 vs 2 traffic measurement** — settle+reset+45s window; solo Stop/live-clear before dual; client deltas + whole-run CF top-level | **`28c-result-traffic-1-2.md`** · first PASS (pre-ticket) — **client success counts SUPERSEDED by 28D-B** |
| **28D** | **Generation-ticket meter fix** — reset bumps generation; in-flight ok/error ignored | unit **8/8** (Supervisor independent rerun) · meters in `trafficPublishMeters.ts` |
| **28D-B** | **Verification re-run** of controlled emulator 1v2 after 28D (no product/HUD change) | **`28c-result-traffic-1-2.md`** · PASS · FS writes **41→80 (~1.95×)** · RTDB **149→296 (~1.99×)** · successes≤attempts · CF whole-run routeActivityWritten=**320** · raw JSON/phases/emu + `.task28db-run.log` |
| **29B** | Single-rider Stop probe (harness) | **`.task29b-result.md`** · PASS |
| **29C** | Stronger create-matrix once | **FAIL** (F7 harness) — superseded by 29D |
| **29D** | Stronger create-matrix once after harness fix | **`25-result-functional-matrix.md`** · **PASS** · exit 0 · process 192s · hub secondary timeout separately reported |
| **29E** | F6 solo Trail 완료(완주) once | **`.task29e-result.md`** · **PASS** · exit 0 · process 136s · route 0.41km · summary 0.41/0.41 · live+listing clear · no harness edit |
| **30A** | RTDB-fail → FS fallback (cross-clock freshness) — **superseded / not approved** | `task30a-*.json` historical **local-only** (class D); rejected by Supervisor (±30s sender skew) |
| **30B** | **RTDB-fail → FS fallback** — local RTDB content observation (no cross-clock); dual-source nowMs stamp; harness ±30s × stationary/moving × hard/silent + retake | **`30-result-rtdb-fs-fallback.md`** · baseline **16/48** (`task30b-baseline-fail.summary.json`) → after **48/48** (`task30b-after-fix.summary.json`); full raw dumps local-only · select 6/6 · replay 19/19 · liveness 7/7 |
| **30C** | Dual-source liveness (both-stream-stop + content-stable stamp) | **`30c-result-dual-source-liveness.md`** · both-stop 6/6 (`task30c-*.summary.json`) · fallback 48/48 (`task30c-fallback-regress.summary.json`); raw local-only |
| **31A** | **Firestore `livePublicationRides` steady heartbeat 1s→4s** (keep RTDB 5Hz; initial/phase-end/speed immediate preserved) | **`31a-result-fs-heartbeat-4s.md`** · heartbeat 5/5 · G5+31A · fallback 4s **12/12** (`task31a-fallback-4s.summary.json`; raw local-only) · replay 19/19 · static ~4× fewer steady FS writes (not billing) |
| **31B-R** | **Controlled emulator 1v2 meters after 4s heartbeat** (in-page paired absolute capture; vs 28D-B) | **`31b-result-meter-4s.md`** · unit 14/14 · E2E PASS · FS **11→22** (~3.7× vs 28D-B 41→80) · RTDB ~unchanged · attempt1 INVALID |
| **31C** | **Post-4s functional regression** — create-matrix + F6 once @4s heartbeat | **`31c-result-functional-4s.md`** · create exit0 process=214s allPass · F6 exit0 0.41/0.41 live+listing clear · hub secondary timeout not claimed · no 4s stale defect · no product edit |
| **32** | **Final pre-commit audit** (classify A/B/C/D; builds + focused contracts; no commit) | **`32-precommit-audit.md`** · web+functions build PASS · diff --check PASS · meters 14 · heartbeat+policy 13 · cmp+select 22 · liveness 7 · replay 19 · functions 36 · **C** MapHud/theme/relay-ignore preserved · heavy task30* JSON = D |
| **33** | **Evidence hygiene + isolated branch commit** (Supervisor-approved A/B only; no push) | **`33-result-commit.md`** · compact `task30b/30c/31a *.summary.json` committed; raw dumps local-only · exclude C/D |
| **34** | **Post-commit verify** + stabilize TASK-33 SHA wording | **`34-result-postcommit-verify.md`** · builds + focused contracts PASS; E2E skipped |
| **35** | **Conflict-free integration branch** — new worktree/branch from traffic; merge main in | **`35-result-integration-merge.md`** · merge `fd27d06` (parents `beb22b1`+`4492753`) · 2-file resolve · entry-selectors 15/15 · no push |
| **R1** | **Merge traffic → main + publish `origin/main`** | **`36-result-r1-merge-main.md`** · FF → `3f583da`; R1-R dep-layers + ignored `.env`; tip/`origin/main`=`f5f2130` |

Earlier S4-1 / S4-1R T1–T4 emulator PASS (pre–listener-scope and/or partial suite) remains historical evidence; see `20-result-s41r-t5.md` and sync-relay artifacts.

---

## IN_PROGRESS

| ID | Item | Next |
|---|---|---|
| — | _(none)_ | — |

---

## PENDING (local work — not approval)

| ID | Item | Notes / gap |
|---|---|---|
| **29** | Optional: routeActivity trigger Created/Deleted (+ rare progress path) **after** 31A + meters | Do not drop update aggregate without replacement for mid-ride pulse/anchor. |
| 27b | Optional: T2 flake follow-up if `routeDisableGone` recurs under emulator load | One fail (5020) then pass (5021); not claimed product regression — see `23-result-t5.md` |

---

## DEFERRED

| ID | Item | Why / unlock |
|---|---|---|
| **28T** | ~~Firestore throttle (8–10s)~~ → **superseded by TASK-31A (4s)** | 8–10s still not recommended (jump↑ / stale margin 5–7s). Implemented interval = **4s** per Supervisor TASK-31A. |

---

## BLOCKED

| ID | Item | Why |
|---|---|---|
| — | _(none)_ | — |

---

## NEEDS_APPROVAL

배포·병합만. 미수행 기능/계측을 여기 두지 않는다.

| ID | Item | Notes |
|---|---|---|
| R2 | **Production deploy** (Hosting / Functions) | Await Supervisor review of R1 (`origin/main`=`f5f2130`); **delete** legacy listing Written CF names (`26-result`) |

Out of this queue (not “waiting on approval” as unfinished local work):

- Live production A/B billed R/W + perceived 5Hz quality → after R2, separate plan.
- Adaptive RTDB rate / groups larger than 2 riders → out of branch comparison scope until evidence.

---

## Suggested next TASK order

1. ~~Supervisor reviews `32-precommit-audit.md`~~ → **TASK-33** local commit done (A+B; omit C+heavy D).
2. ~~**TASK-34** post-commit builds + focused unit gates~~ → PASS; `33-result` SHA table stabilized (no mutable HEAD).
3. Optional **TASK-29** — routeActivity trigger surgery if meters still show CF invocation waste after 4s (31B-R whole-run Written=**213** vs 28D-B 320; client FS 11/45s). Functional @4s already green (31C).
4. Optional **27b** if checklist requires.
5. **NEEDS_APPROVAL R1** merge, then **R2** deploy (legacy Written delete).

Do **not** push / merge / deploy without Chief approval.
