/**
 * Ready Ride Claim 연동 — 출발점 주변 conquest 청크만 읽는다(지시08 D3).
 * 전체 `chunks` 컬렉션 스캔 금지. Claim 단위는 z20 셀(`20_x_y`).
 *
 * 이 파일은 **Conquest 쪽 어댑터**다 — `distanceAutoRouteCore` 가 선언한 `ClaimReader`
 * 포트를 Firestore 로 구현한다(Phase 5 D2). 타일 계산은 갖지 않는다 — `geoTiles.ts` 가
 * 단일 출처이며, 그 이유는 거기 적혀 있다(계산이 두 벌이면 조용히 기능이 사라진다).
 */
import { getFirestore } from "firebase-admin/firestore";
import type { ClaimReadResult } from "./distanceAutoRouteCore.js";
import { CONQUEST_CELL_ZOOM, chunkIdsCoveringRadius, type LngLat } from "./geoTiles.js";

/** 셀 ID 접두어. 리터럴 `"20_"` 를 박으면 줌 상수와 조용히 어긋난다. */
const CELL_ID_PREFIX = `${CONQUEST_CELL_ZOOM}_`;

// 종전 import 경로를 유지한다 — 이 모듈에서 가져가던 소비자를 깨지 않는다.
export {
  CONQUEST_CELL_ZOOM,
  CONQUEST_CHUNK_ZOOM,
  CONQUEST_CHUNK_APPROX_METERS,
  chunkIdsCoveringRadius,
  conquestCellIdAt,
} from "./geoTiles.js";

/** @deprecated `ClaimReadResult`(distanceAutoRouteCore) 와 같다. 종전 이름 보존용. */
export type LoadClaimedCellsNearStartResult = ClaimReadResult;

/**
 * `conquest/{uid}/chunks/{z12}` 중 출발점 반경 안만 get.
 * 문서가 없거나 cells 가 비면 빈 Set — Claim 없는 사용자와 동일.
 *
 * `ClaimReader` 포트의 Firestore 구현이다. 시험은 이 함수 대신 가짜를 주입한다.
 */
export async function loadClaimedCellsNearStart(input: {
  userId: string;
  start: LngLat;
  /** 보통 `1.5 * targetDistanceMeters` */
  radiusMeters: number;
}): Promise<ClaimReadResult> {
  const started = Date.now();
  const chunkIds = chunkIdsCoveringRadius(input.start, input.radiusMeters);
  const db = getFirestore();
  const base = db.collection("conquest").doc(input.userId).collection("chunks");
  const snaps = await Promise.all(chunkIds.map((id) => base.doc(id).get()));
  const claimedCellIds = new Set<string>();
  let chunksHit = 0;
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const cells = snap.data()?.cells;
    if (!cells || typeof cells !== "object") continue;
    chunksHit += 1;
    for (const id of Object.keys(cells as Record<string, unknown>)) {
      if (id.startsWith(CELL_ID_PREFIX)) claimedCellIds.add(id);
    }
  }
  return {
    claimedCellIds,
    chunkIdsRequested: chunkIds,
    chunksHit,
    readMs: Date.now() - started,
  };
}
