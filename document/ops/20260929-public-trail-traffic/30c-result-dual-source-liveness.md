# Result 30C — Dual-source liveness (both-stream stop)

Status: **DONE** (TASK-30C PASS)
Date: 2026-09-30
Owner: Developer (Cursor). Supervisor does not code.
Scope: `syncFromPresence` dual-source ingest stamp + `PublicationSharedPresence.peerVisibleByUid` receiver-obs. Extend dual-source harness both-stream-stop. **No** schema / publish cadence / HUD / MapHud. **No** commit / push / deploy. Comparison: **1 local + 1 peer**.

---

## 0. Supervisor finding (30B review)

When both RTDB and FS candidates exist, 30B normalized every ingest as `{ ...selected, serverAtMs: nowMs }`. Frozen RTDB redelivery + stopped FS then manufactured a **new** stamp on every sync → `PeerMotionRegistry` liveness never aged out.

Also: `peerVisibleByUid` for RTDB-only peers compared sender `t` to local now → clock **+30s** could keep UI visible ~30s past true silence.

---

## 1. Harness extension

`rtdb-fs-fallback-harness.mjs --suite both-stop`:

- Both RTDB + FS freeze at once; frozen snapshots redelivered
- moving / stationary × sender offset −30s / 0 / +30s (6 cells)
- Assert peer gone by `freezeAt + PEER_LIVE_RIDE_STALE_MS + step` (15s policy)

```powershell
cd apps/web
node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite both-stop --out .../task30c-baseline-fail.json
node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite both-stop --out .../task30c-after-fix.json
node scripts/peer-sync/rtdb-fs-fallback-harness.mjs --suite fallback --out .../task30c-fallback-regress.json
```

Committed evidence is the compact `*.summary.json` siblings (scenario metrics/pass counts). Full raw dumps above remain **local-only** (not committed; selectionSamples/timeline omitted from summaries).

---

## 2. Baseline FAIL

Evidence (committed compact summary): [`task30c-baseline-fail.summary.json`](task30c-baseline-fail.summary.json) — **0/6** pass. All cells `goneAt=never` (manufactured `serverAtMs`). Full raw `task30c-baseline-fail.json` remains **local-only**.

---

## 3. Fix (minimal)

### 3.1 `stampDualSourceIngestPacket` (`syncFromPresence.ts`)

- Dual-source only: normalize to receiver `nowMs` **when selected source fingerprint changes**
- Identical frozen redelivery → stable normalized stamp → Registry expires at 15s
- Same-pose RTDB↔FS switch → keep prior stamp (do not refresh liveness)
- Single-source paths unchanged (native stamps)

### 3.2 `isRtdbMotionRowPeerVisibleByReceiverObs`

- RTDB-only UI visibility uses `noteRtdbContentObservation` age, not sender `t − now`
- Wired in `PublicationSharedPresence.peerVisibleByUid`

---

## 4. After-fix PASS

| Suite | Result |
|---|---|
| both-stream-stop | **6/6** — `goneAt=19100` = deadline (freeze 4s + 15s + 100ms) |
| 30B fallback regress | **48/48** |
| source-select / stamp / visibility unit | **8/8** |
| `replay.mjs --check` | **19/19** |
| `peer-liveness-contract` | **7/7** |
| eslint (touched product files) | clean |

Evidence (committed compact summaries): [`task30c-after-fix.summary.json`](task30c-after-fix.summary.json), [`task30c-fallback-regress.summary.json`](task30c-fallback-regress.summary.json). Full raw `task30c-after-fix.json` / `task30c-fallback-regress.json` remain **local-only**.

---

## 5. Limitations / not claimed

- Offline harness only; no emulator E2E tab-kill injection this pass.
- Presence panel RTDB visibility still depends on 1s `visibilityNowMs` ticker (pre-existing).
- FS-row visibility still uses `lastSeenAt` (server-aligned in product); only RTDB-only path was clock-skewed.
- No publisher cadence / schema / HUD / MapHud / billed claims.
- No commit / push / deploy.

---

## 6. Unlock

Dual-source ingest no longer keeps dead peers alive forever; 30B fallback matrix remains green; RTDB-only visibility matches receiver-observed freshness under ±30s sender skew.
