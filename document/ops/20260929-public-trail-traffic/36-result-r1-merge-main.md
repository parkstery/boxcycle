# R1 — Merge traffic → main + publish origin/main

Status: **DONE** (local FF + R1-R unblock + `git push origin main` — see §Publish)
Developer: Cursor
Date: 2026-10-01
Worktree: `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-integration\boxcycle`
Authorization: Chief R1+R2 in user message; **R2 Firebase deploy NOT run** (wait Supervisor review)

---

## Preconditions verified

| Check | Result |
|---|---|
| `git fetch origin main` | OK (at R1 start) |
| Remote `origin/main` before R1 | `44927534fe25263ff8e735629c70fae6f45628a8` |
| Integration tip | `3f583dadce1a595048cc6a85073bd33134775c55` |
| `origin/main` ancestor of integration | YES |
| Touched `main2` / `C:\20.HDev\boxcycle`? | **NO** (read-only `.env` copy source only) |

---

## Local merge (R1 — DONE)

| Step | Result |
|---|---|
| `git checkout main` | OK |
| `git merge --ff-only codex/public-trail-traffic-integration` | **FF** `4492753` → `3f583da` |
| `npm run build` (`apps/web` / `functions`) | PASS |
| `git diff --check` | PASS |

---

## First push (R1 — REJECTED)

Command: `git push origin main` (normal; no force / no `--no-verify`)

Pre-push abort:

1. **lib dep-direction M0** — 3 files missing from `dep-layers.json` assign/pending:
   - `debug/installTrafficPublishDebug.ts`
   - `debug/trafficPairedCapture.ts`
   - `debug/trafficPublishMeters.ts`
2. **`mapbox-token-per-mode.test.ts`** — 2 fails (real token empty in this worktree; no `apps/web/.env`)

`origin/main` remained `4492753`.

---

## R1-R unblock (DONE)

| Step | Result |
|---|---|
| Register 3 debug meters under `assign.debug` in `apps/web/dep-layers.json` | DONE |
| `npm run check:dep` | **PASS** (M0 미지정 0; 방향/순환 0) |
| Copy `apps/web/.env` from main2 → integration via `Copy-Item -LiteralPath` only if dest absent | **COPY_OK**; dest was absent |
| Read/print/commit `.env` contents | **NOT done** |
| `git check-ignore` / status for `apps/web/.env` | ignored (`.gitignore:28:.env`; `!!` / not in commit status) |
| `scripts/map/mapbox-token-per-mode.test.ts` | **# pass 4 / # fail 0** (token presence via pass/fail only; value never echoed) |
| Test modified to skip token? | **NO** |
| `--no-verify` used? | **NO** |

---

## Publish (DONE)

Command: `git push origin main` (normal; no force / no `--no-verify`) — pre-push gates passed.

| Ref | SHA |
|---|---|
| R1-R unblock commit (dep-layers + ops) | `f5f2130219a9230b523eb5dc5d19d083a2316e63` |
| Docs SHA fill-in commit | `006ce97a8ac74a833e440297602225cd6d69b3ae` |
| Tip-align commit (this file/queue/progress) | `803f6ffd6826b08e79a7167ca0aa61be2b6acb4c` |
| Current local `main` / `origin/main` (R1 tip before R2 docs) | `803f6ffd6826b08e79a7167ca0aa61be2b6acb4c` |
| Prior `origin/main` | `44927534fe25263ff8e735629c70fae6f45628a8` |

R2 Firebase deploy: see [`37-result-r2-deploy.md`](37-result-r2-deploy.md) (ran from tip `803f6ff`).
