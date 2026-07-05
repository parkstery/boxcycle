/**
 * red dot 진단 2단계 — 최근 rides 문서를 덤프(읽기 전용).
 * 신규 주행이 publicationId 를 들고 rides 에 기록되는지(=CF aggregate 가 돌 조건) 확인.
 *
 *   npm run admin:audit-recent-rides
 *   npm run admin:audit-recent-rides -- --limit=30
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

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
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const db = getFirestore();
  const limit = Math.min(100, Math.max(1, Number.parseInt(arg("limit") ?? "25", 10)));
  const now = Date.now();

  // endedAt 정렬이 인덱스 없이 실패할 수 있어 createdAt → endedAt 순으로 시도.
  let snap;
  try {
    snap = await db.collection("rides").orderBy("createdAt", "desc").limit(limit).get();
  } catch {
    snap = await db.collection("rides").orderBy("endedAt", "desc").limit(limit).get();
  }

  const rows = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const endedMs = toMillis(data.endedAt);
    const createdMs = toMillis(data.createdAt);
    const refMs = endedMs ?? createdMs;
    return {
      id: d.id,
      ageHours: refMs != null ? Math.round(((now - refMs) / 3_600_000) * 10) / 10 : null,
      status: typeof data.status === "string" ? data.status : null,
      publicationId: typeof data.publicationId === "string" ? data.publicationId : null,
      trailId: typeof data.trailId === "string" ? data.trailId : null,
      routeId: typeof data.routeId === "string" ? data.routeId : null,
      userRouteId: typeof data.userRouteId === "string" ? data.userRouteId : null,
      hasEndedAt: endedMs != null,
    };
  });

  const within24h = rows.filter((r) => r.ageHours != null && r.ageHours < 24);
  const summary = {
    sampled: rows.length,
    within24h: within24h.length,
    within24h_withPublicationId: within24h.filter((r) => r.publicationId).length,
    within24h_missingPublicationId: within24h.filter((r) => !r.publicationId).length,
    within24h_completed: within24h.filter((r) => r.status === "completed").length,
  };

  console.info(JSON.stringify({ summary, recentRides: rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
