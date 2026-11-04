/**
 * 리더보드 누적 점수 채우기 — 기존 완료 주행(conquestResult.tier 있음)을 leaderboardScores 등에 더한다.
 * 기본은 dry-run(쓰기 없음). `--apply` 일 때만 쓴다. 원장(leaderboardScoreApplied/{rideId})으로 멱등이라
 * 다시 돌려도, 트리거와 겹쳐도 한 주행은 한 번만 더해진다.
 *
 *   npm run admin:backfill-leaderboard-scores                 # dry-run
 *   npm run admin:backfill-leaderboard-scores -- --limit=500  # dry-run, 앞 500건만
 *   npm run admin:backfill-leaderboard-scores -- --apply      # 실제 쓰기 (운영은 Supervisor 승인 후)
 *
 * 계약: document/ops/20261103-global-geo-data/02-task-g3-leaderboard-scores.md
 */
import { FieldValue, getFirestore, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { loadMemberUids, loadPublicationOwners } from "./leaderboardCore.js";
import { rideScoreInputFromData } from "./leaderboardScoresOnRideWritten.js";
import { homeScoreScopes, LEADERBOARD_SCORE_APPLIED_COLLECTION, planRideScoreWrites } from "./leaderboardScoresCore.js";
import { continentOfCountry } from "./geoRegion/geoRegionData.js";
import { applyRideScoresInTransaction } from "./leaderboardScoresStore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:backfill-leaderboard-scores [-- --apply] [--limit=N] [--projectId=id] [--serviceAccount=path]
  (기본 dry-run — --apply 일 때만 Firestore 에 쓴다)`);
    return;
  }

  initFirebaseAdminForCli({ projectId: arg("projectId"), serviceAccountPath: arg("serviceAccount") });
  const apply = hasFlag("apply");
  const limitRaw = arg("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : Number.POSITIVE_INFINITY;
  const db = getFirestore();

  const report = {
    mode: apply ? "apply" : "dry-run",
    scanned: 0,
    eligible: 0,
    alreadyApplied: 0,
    wouldApply: 0,
    applied: 0,
    scoreDocsTouched: 0,
  };
  const touched = new Set<string>();

  const pageSize = 500;
  let lastDoc: QueryDocumentSnapshot | null = null;
  while (report.scanned < limit) {
    let q: Query = db
      .collection("rides")
      .where("status", "==", "completed")
      .orderBy("endedAt", "asc")
      .select("userId", "endedAt", "distanceMeters", "conquestResult", "publicationId", "timeZone")
      .limit(Math.min(pageSize, limit - report.scanned));
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1]!;
    report.scanned += snap.size;

    // 이 페이지에서 인정 후보(tier 있음)만 추려 회원·소유자·원장을 한꺼번에 읽는다.
    const rows = snap.docs.filter((d) => {
      const tier = (d.get("conquestResult") as { tier?: unknown } | undefined)?.tier;
      return tier === "t0" || tier === "t1";
    });
    const publicationIds = [
      ...new Set(rows.map((d) => d.get("publicationId")).filter((v): v is string => typeof v === "string" && v !== "")),
    ];
    const [owners, members, ledger] = await Promise.all([
      loadPublicationOwners(db, publicationIds),
      loadMemberUids([...new Set(rows.map((d) => String(d.get("userId") ?? "")).filter(Boolean))]),
      rows.length
        ? db.getAll(...rows.map((d) => db.doc(`${LEADERBOARD_SCORE_APPLIED_COLLECTION}/${d.id}`)), { fieldMask: ["rideId"] })
        : Promise.resolve([]),
    ]);
    const done = new Set(ledger.filter((l) => l.exists).map((l) => l.id));
    // G3-2: 회원의 대표 국가(지금 값) — 아직 반영 안 된 주행만 거리 판 대륙·국가 범위에 더한다
    const memberIds = [...new Set(rows.map((d) => String(d.get("userId") ?? "")).filter((u) => members.has(u)))];
    const homeSnaps = memberIds.length
      ? await db.getAll(...memberIds.map((u) => db.doc(`users/${u}`)), { fieldMask: ["homeCountry"] })
      : [];
    const homeByUid = new Map(homeSnaps.map((s) => [s.id, s.get("homeCountry") as unknown]));

    for (const d of rows) {
      const pubId = d.get("publicationId");
      const input = rideScoreInputFromData(
        d.id,
        d.data() as Record<string, unknown>,
        typeof pubId === "string" && pubId ? (owners.get(pubId) ?? null) : null,
      );
      if (!input) continue;
      if (members.has(input.userId)) {
        const hc = homeByUid.get(input.userId);
        input.distanceScopes = homeScoreScopes(typeof hc === "string" ? hc : null, continentOfCountry);
      }
      const plan = planRideScoreWrites(input);
      if (plan.scores.length === 0 && plan.uses.length === 0) continue;
      report.eligible += 1;
      if (done.has(d.id)) {
        report.alreadyApplied += 1;
        continue;
      }
      report.wouldApply += 1;
      for (const s of plan.scores) touched.add(s.docId);
      if (!apply) continue;
      const member = members.has(input.userId);
      const did = await db.runTransaction((tx) =>
        applyRideScoresInTransaction(tx, db, input, member, FieldValue.serverTimestamp()),
      );
      if (did) report.applied += 1;
    }
    if (snap.size < pageSize) break;
  }

  report.scoreDocsTouched = touched.size;
  console.info(JSON.stringify(report, null, 2));
  if (!apply) console.info("[cli] dry-run only — 쓰려면 --apply");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
