/**
 * Ready Ride Claim 연동 — 출발점 주변 conquest 청크만 읽는다(지시08 D3).
 * 전체 `chunks` 컬렉션 스캔 금지. Claim 단위는 z20 셀(`20_x_y`).
 */
import { getFirestore } from "firebase-admin/firestore";
import type { LngLat } from "./distanceAutoRouteCore.js";

export const CONQUEST_CELL_ZOOM = 20;
export const CONQUEST_CHUNK_ZOOM = 12;

/** 서울 위도 기준 z12 한 변 ~7.8km — 반경 계산·진단용 */
export const CONQUEST_CHUNK_APPROX_METERS = 7800;

function lngLatToTileXY(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = 2 ** zoom;
  const xRaw = Math.floor(((lng + 180) / 360) * n);
  const latRad = (clampedLat * Math.PI) / 180;
  const yRaw = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return {
    x: Math.max(0, Math.min(n - 1, xRaw)),
    y: Math.max(0, Math.min(n - 1, yRaw)),
  };
}

/**
 * 중심·반경으로 덮이는 z12 청크 문서 ID 목록.
 * 반경은 목표 거리의 1.5배(경로 우회 여유)를 호출부가 넣는다.
 */
export function chunkIdsCoveringRadius(center: LngLat, radiusMeters: number): string[] {
  const [lng, lat] = center;
  const r = Math.max(0, radiusMeters);
  const dLat = r / 111_320;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLng = r / (111_320 * cosLat);
  const sw = lngLatToTileXY(lng - dLng, lat - dLat, CONQUEST_CHUNK_ZOOM);
  const ne = lngLatToTileXY(lng + dLng, lat + dLat, CONQUEST_CHUNK_ZOOM);
  const minX = Math.min(sw.x, ne.x);
  const maxX = Math.max(sw.x, ne.x);
  const minY = Math.min(sw.y, ne.y);
  const maxY = Math.max(sw.y, ne.y);
  const out: string[] = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      out.push(`${CONQUEST_CHUNK_ZOOM}_${x}_${y}`);
    }
  }
  return out;
}

export type LoadClaimedCellsNearStartResult = {
  claimedCellIds: Set<string>;
  chunkIdsRequested: string[];
  chunksHit: number;
  readMs: number;
};

/**
 * `conquest/{uid}/chunks/{z12}` 중 출발점 반경 안만 get.
 * 문서가 없거나 cells 가 비면 빈 Set — Claim 없는 사용자와 동일.
 */
export async function loadClaimedCellsNearStart(input: {
  userId: string;
  start: LngLat;
  /** 보통 `1.5 * targetDistanceMeters` */
  radiusMeters: number;
}): Promise<LoadClaimedCellsNearStartResult> {
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
      if (id.startsWith("20_")) claimedCellIds.add(id);
    }
  }
  return {
    claimedCellIds,
    chunkIdsRequested: chunkIds,
    chunksHit,
    readMs: Date.now() - started,
  };
}

export function conquestCellIdAt(lngLat: LngLat): string {
  const { x, y } = lngLatToTileXY(lngLat[0], lngLat[1], CONQUEST_CELL_ZOOM);
  return `${CONQUEST_CELL_ZOOM}_${x}_${y}`;
}
