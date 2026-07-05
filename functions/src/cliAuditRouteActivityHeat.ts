/**
 * red dot(heat) 진단 — routeActivity 문서의 lastCompletedRideAt 나이를 덤프(읽기 전용).
 *
 * heat dot 표시 조건(클라이언트 isRouteActivityHeat):
 *   !liveNow && (now - lastCompletedRideAt) < 24h
 *
 *   npm run admin:audit-route-activity-heat
 *   npm run admin:audit-route-activity-heat -- --limit=500
 *   npm run admin:audit-route-activity-heat -- --publicationId=abc123
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

const HEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function toMillis(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const db = getFirestore();
  const limit = Math.min(1000, Math.max(1, Number.parseInt(arg("limit") ?? "500", 10)));
  const singleId = arg("publicationId")?.trim();

  const docs = singleId
    ? await db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${singleId}`).get().then((s) => (s.exists ? [s] : []))
    : (await db.collection(ROUTE_ACTIVITY_COLLECTION).limit(limit).get()).docs;

  const now = Date.now();
  const rows = docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const lastMs = toMillis(data.lastCompletedRideAt);
    const liveNow = data.liveNow === true;
    const activeRiderCount =
      typeof data.activeRiderCount === "number" ? Math.max(0, Math.floor(data.activeRiderCount)) : 0;
    const ageHours = lastMs != null ? Math.round(((now - lastMs) / 3_600_000) * 10) / 10 : null;
    const within24h = lastMs != null && now - lastMs < HEAT_WINDOW_MS;
    const isLive = liveNow && activeRiderCount > 0;
    const heatEligible = !isLive && within24h;
    return {
      id: d.id,
      ageHours,
      within24h,
      liveNow,
      activeRiderCount,
      recentRideCount7d:
        typeof data.recentRideCount7d === "number" ? Math.floor(data.recentRideCount7d) : 0,
      hasLastCompletedRideAt: lastMs != null,
      heatEligible,
    };
  });

  const summary = {
    collection: ROUTE_ACTIVITY_COLLECTION,
    totalDocs: rows.length,
    withLastCompletedRideAt: rows.filter((r) => r.hasLastCompletedRideAt).length,
    missingLastCompletedRideAt: rows.filter((r) => !r.hasLastCompletedRideAt).length,
    within24hWindow: rows.filter((r) => r.within24h).length,
    liveNow: rows.filter((r) => r.liveNow && r.activeRiderCount > 0).length,
    heatEligible_redDotShouldShow: rows.filter((r) => r.heatEligible).length,
  };

  const heatRows = rows
    .filter((r) => r.heatEligible)
    .sort((a, b) => (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9));
  const recentNonEligible = rows
    .filter((r) => r.hasLastCompletedRideAt && !r.heatEligible)
    .sort((a, b) => (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9))
    .slice(0, 10);

  console.info(JSON.stringify({ summary, heatEligible: heatRows, sampleRecentButNotEligible: recentNonEligible }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
