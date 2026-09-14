/**
 * 거부된 퍼블릭 경로 신청의 geometry 를 실측해 어느 게이트가 걸렸는지 특정한다(읽기 전용).
 *
 *   npm run admin:diag-public-route-request -- --requestId=<id> [--requestId=<id2> ...]
 *   npm run admin:diag-public-route-request -- --uid=<uid> --limit=5
 *
 * 게이트 문구는 2026-09-14 에 원인별로 분리했지만, 거부 사유는 로그에만 남고 신청 문서에는
 * 저장되지 않는다 — 이 스크립트가 실제 geometry 를 실측해 어느 게이트였는지 재현한다.
 */
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS,
  bboxDiagonalMeters,
  PUBLIC_ROUTE_MAX_COORDS,
  PUBLIC_ROUTE_MAX_LENGTH_METERS,
  PUBLIC_ROUTE_MIN_COORDS,
  PUBLIC_ROUTE_MIN_LENGTH_METERS,
  isCoordDensityValid,
  parseAndValidateCoordsJson,
  polylineLengthMeters,
} from "./publicRouteAutoReviewCore.js";

function args(name: string): string[] {
  const prefix = `--${name}=`;
  return process.argv.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length));
}

function arg(name: string): string | undefined {
  return args(name)[0];
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({ projectId: arg("projectId") });
  const db = getFirestore();

  let ids = args("requestId");
  const uid = arg("uid");
  if (ids.length === 0) {
    let q = db.collection("publicRouteRequests").orderBy("createdAt", "desc");
    if (uid) q = db.collection("publicRouteRequests").where("applicantUid", "==", uid);
    const snap = await q.limit(Number(arg("limit") ?? 5)).get();
    ids = snap.docs.map((d) => d.id);
  }

  for (const id of ids) {
    const snap = await db.collection("publicRouteRequests").doc(id).get();
    console.info(`\n=== publicRouteRequests/${id}`);
    if (!snap.exists) {
      console.info("  (문서 없음)");
      continue;
    }
    const d = snap.data() ?? {};
    console.info("  status        :", d.status, "| reason:", d.reviewReason ?? d.rejectedReason ?? "-");
    console.info("  savedRouteId  :", d.savedRouteId);
    console.info("  snapshotDistM :", d.snapshotDistanceMeters);

    const json = d.geometryCoordsJson;
    if (typeof json !== "string") {
      console.info("  !! geometryCoordsJson 이 문자열이 아님:", typeof json);
      continue;
    }
    console.info("  coordsJson len:", json.length, "chars");

    let rawParsed: unknown = null;
    try {
      rawParsed = JSON.parse(json);
    } catch (e) {
      console.info("  G-parse   : *** FAIL *** JSON.parse 실패:", String(e).slice(0, 120));
      continue;
    }
    if (Array.isArray(rawParsed)) {
      const compLens = new Set(rawParsed.map((p) => (Array.isArray(p) ? p.length : -1)));
      console.info("  좌표 성분 수  :", [...compLens].join(","), "(2 이외가 있으면 파싱 게이트 탈락)");
    }

    const coords = parseAndValidateCoordsJson(json);
    if (!coords) {
      console.info("  G-parse   : *** FAIL *** [lng,lat][] 형태 검증 실패");
      continue;
    }
    const len = polylineLengthMeters(coords);
    const maxAllowed = Math.max(500, (len / 1000) * 400);
    console.info("  coords.length :", coords.length);
    console.info("  polylineLength:", len.toFixed(1), "m");
    console.info("  평균 점 간격   :", (len / Math.max(1, coords.length - 1)).toFixed(2), "m/점");
    console.info("  --- 게이트 ---");
    console.info("  G-parse   : PASS");
    console.info(
      "  G-count   :",
      coords.length >= PUBLIC_ROUTE_MIN_COORDS && coords.length <= PUBLIC_ROUTE_MAX_COORDS
        ? "PASS"
        : `*** FAIL *** ${coords.length} (허용 ${PUBLIC_ROUTE_MIN_COORDS}~${PUBLIC_ROUTE_MAX_COORDS})`,
    );
    console.info(
      "  G-density :",
      isCoordDensityValid(coords, len)
        ? "PASS"
        : `*** FAIL *** ${coords.length} > maxAllowed ${maxAllowed.toFixed(0)} (=max(500, km×400))`,
    );
    console.info(
      "  G-length  :",
      len >= PUBLIC_ROUTE_MIN_LENGTH_METERS && len <= PUBLIC_ROUTE_MAX_LENGTH_METERS
        ? "PASS"
        : `*** FAIL *** ${len.toFixed(0)}m`,
    );
    const diagonal = bboxDiagonalMeters(coords);
    console.info(
      "  G-bbox    :",
      diagonal >= PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS
        ? `PASS (직경 ${Math.round(diagonal)}m ≥ ${PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS}m)`
        : `*** FAIL *** 직경 ${Math.round(diagonal)}m < ${PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS}m`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
