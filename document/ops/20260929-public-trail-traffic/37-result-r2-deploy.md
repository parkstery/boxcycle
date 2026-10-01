# R2 — Production deploy (listing CF Created/Deleted + Hosting)

Status: **DONE** (PASS)
Developer: Cursor
Date: 2026-10-01 ~15:49 KST
Worktree: `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-integration\boxcycle`
Authorization: Chief explicit R1+R2 (main merge already done; Firebase deploy this task)
Code SHA deployed: `803f6ffd6826b08e79a7167ca0aa61be2b6acb4c` (`main` = `origin/main`)
Project: `boxcycle-dc2df`
Region: `asia-northeast3`

---

## Preconditions

| Check | Result |
|---|---|
| Branch / dirty | `main...origin/main` clean @ `803f6ff` |
| Touched `main2` / traffic dirty worktree? | **NO** |
| Firebase CLI | 15.1.0; logged in (account present) |
| `firebase use` / `.firebaserc` | `boxcycle-dc2df` |
| Pre-deploy listing inventory | Written×2 live; Created/Deleted **absent** |
| Listing CF secrets | **N/A** (no `defineSecret` on openTrailListing*) |
| Project secret metadata (no values) | `MAPBOX_ACCESS_TOKEN` v1 ENABLED; `STRIPE_SECRET_KEY` v1 ENABLED (not used by this deploy) |
| Gates | `functions` build PASS; functions tests **36/36**; `check:dep` PASS |
| CLI help | `deploy --only functions:a,functions:b`; `functions:delete … --region --force` |

---

## Deploy steps (exact order)

### 1) Create 4 listing triggers

Command (PowerShell: `--only` value **quoted** — unquoted commas become arrays and match 0 functions):

```text
firebase deploy --only "functions:openTrailListingOnMemberCreated,functions:openTrailListingOnMemberDeleted,functions:openTrailListingOnLiveCourseRideCreated,functions:openTrailListingOnLiveCourseRideDeleted" --project boxcycle-dc2df
```

Result: Successful **create** ×4 (`asia-northeast3`).

First attempt without quotes → `No function matches given --only filters` (CLI/PowerShell only; no partial upload). Retried with quotes → PASS.

### 2) Confirm 4 live before delete

`firebase functions:list`: all four Created/Deleted present @ `asia-northeast3` alongside legacy Written×2 and `openTrailListingOnTrailWritten`.

### 3) Delete legacy Written×2

```text
firebase functions:delete openTrailListingOnMemberWritten openTrailListingOnLiveCourseRideWritten --region asia-northeast3 --force --project boxcycle-dc2df
```

Result: Successful **delete** ×2 only (no unexpected names in delete output).

### 4) Hosting

| Step | Result |
|---|---|
| `npm run build` (web) | PASS (exit 0); asset `index-B5Q89rqf.js` |
| `firebase deploy --only hosting --project boxcycle-dc2df` | PASS; release complete |
| Hosting URL | `https://boxcycle-dc2df.web.app` |

Not deployed: full functions redeploy, Firestore rules, indexes, RTDB rules.

---

## Post-deploy verification

| Check | Result |
|---|---|
| Created×4 present | YES |
| Written×2 absent | YES (`MemberWritten` / `LiveCourseRideWritten` gone) |
| `openTrailListingOnTrailWritten` kept | YES |
| Hosting `web.app` / `firebaseapp.com` | HTTP **200**; HTML references `index-B5Q89rqf.js` |
| Rider functional matrix re-run | **Not run** (deploy inventory + HTTP only; scope remains 1–2 riders for any future ride verify) |

### Cost / billing note

Deploy removes steady `document.written` subscription on members / livePublicationRides for the **listing** triggers. That is expected to stop those specific CF invocations on heartbeat updates. **Production billed 1v2 reduction is not asserted here** — separate observation required.

---

## Untouched

- `main2` @ `C:\20.HDev\boxcycle`
- `codex/public-trail-traffic` dirty worktree
- Force push / `--no-verify`
