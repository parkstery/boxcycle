/**
 * Conquest(정복) v2 진단 — 읽기 전용.
 * (1) 최근 rides 의 conquest 페이로드(v·셀 수·path)·conquestResult → 클라/CF 배포 여부 판별
 * (2) conquest/{uid} 요약(totalMeters)·청크(z12)·traces → 집계 데이터 확인
 *
 *   npm run admin:audit-conquest
 *   npm run admin:audit-conquest -- --uid=<uid> --limit=10
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
  const limit = Math.min(50, Math.max(1, Number.parseInt(arg("limit") ?? "8", 10)));
  const now = Date.now();

  let snap;
  try {
    snap = await db.collection("rides").orderBy("createdAt", "desc").limit(limit).get();
  } catch {
    snap = await db.collection("rides").orderBy("endedAt", "desc").limit(limit).get();
  }

  const rides = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const conquest = data.conquest as Record<string, unknown> | null | undefined;
    const result = data.conquestResult as Record<string, unknown> | null | undefined;
    const endedMs = toMillis(data.endedAt);
    return {
      id: d.id,
      userId: typeof data.userId === "string" ? data.userId.slice(0, 8) : null,
      ageHours: endedMs != null ? Math.round(((now - endedMs) / 3_600_000) * 10) / 10 : null,
      distanceM: Number(data.distanceMeters) || 0,
      elapsedSec: Number(data.elapsedSec) || 0,
      /** 클라 페이로드 — v2=도로 셀. v1(tiles)은 구버전 클라 */
      payload: conquest
        ? {
            v: conquest.v ?? null,
            cells: Array.isArray(conquest.cells) ? conquest.cells.length : 0,
            pathPts: Array.isArray(conquest.path) ? conquest.path.length : 0,
            legacyTiles: Array.isArray(conquest.tiles) ? conquest.tiles.length : 0,
            pedalSec: conquest.pedalSec ?? null,
          }
        : null,
      /** CF 회신 — null 이면 CF 미배포/미실행/구버전 payload */
      result: result
        ? {
            newMeters: result.newMeters ?? null,
            newCells: result.newCells ?? null,
            legacyNewTiles: result.newTiles ?? null,
            creditedM: result.creditedMeters,
            tier: result.tier,
          }
        : null,
    };
  });

  const uid = arg("uid") ?? snap.docs[0]?.data()?.userId;
  let summary: Record<string, unknown> | null = null;
  let chunks: { id: string; cellCount: number; legacyTileCount: number }[] = [];
  let traces: { id: string; pathPts: number; newMeters: number }[] = [];
  if (typeof uid === "string" && uid) {
    const sSnap = await db.doc(`conquest/${uid}`).get();
    summary = sSnap.exists ? (sSnap.data() as Record<string, unknown>) : null;
    const cSnap = await db.collection(`conquest/${uid}/chunks`).limit(30).get();
    chunks = cSnap.docs.map((d) => ({
      id: d.id,
      cellCount: Object.keys((d.data().cells as Record<string, unknown>) ?? {}).length,
      legacyTileCount: Object.keys((d.data().tiles as Record<string, unknown>) ?? {}).length,
    }));
    const tSnap = await db.collection(`conquest/${uid}/traces`).limit(30).get();
    traces = tSnap.docs.map((d) => ({
      id: d.id,
      pathPts: Array.isArray(d.data().path) ? (d.data().path as unknown[]).length : 0,
      newMeters: Number(d.data().newMeters) || 0,
    }));
  }

  console.info(
    JSON.stringify(
      {
        rides,
        conquestUser: typeof uid === "string" ? uid.slice(0, 8) : null,
        summary,
        chunks,
        traces,
        verdictHints: {
          "payload=null": "클라가 페이로드를 안 실음(경로 없음/구버전 빌드 — 새로고침 필요)",
          "payload.v=1": "구버전 클라 페이로드 — 웹 새로고침",
          "payload.v=2 result=null": "CF 미배포 또는 오류 — functions 배포·로그 확인",
          "result有 traces=0": "newMeters=0(전부 기존 도로) 이었는지 확인",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
