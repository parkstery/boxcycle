/**
 * 웹 메르카토르 타일 좌표와 Conquest 셀·청크 ID — **`functions/` 안의 단일 출처.**
 *
 * 왜 있는가 — 같은 계산이 서버 안에 두 벌 있었다.
 *   `conquestClaimRead.ts` (Claim 을 **읽는** 쪽, 상수 `CONQUEST_CELL_ZOOM` 사용)
 *   `distanceAutoRouteCore.ts` (신규도로 비율을 **재는** 쪽, `zoom = 20` 리터럴)
 *
 * 두 벌이 어긋나면 `claimedCellIds.has(...)` 가 **영영 실패**한다. 그런데 그 결과는
 * 「Claim 이 없는 사용자」와 **구분되지 않는다** — 비율이 전부 1.0 이 되고, 가산 항이
 * 모든 후보에 같아 순위에 영향이 없어져 **에러 없이 기능만 사라진다**(구조 감사 R10).
 * 그래서 계산을 한 곳으로 모은다.
 *
 * ⚠️ 경계 밖에 **세 번째 구현**이 있다 — `apps/web/src/lib/conquestTiles.ts` 다.
 * 그쪽이 Claim 을 **쓰고** 여기가 **읽으므로**, 둘이 어긋나면 같은 방식으로 조용히 깨진다.
 * 빌드가 나뉘어 코드를 공유할 수 없으니, **양쪽에 같은 고정 벡터**를 시험으로 박아 고정한다
 * (`conquestClaimContract.test.ts` ↔ `apps/web/scripts/conquest/cell-id-vectors.test.ts`).
 * 벡터를 바꿀 일이 있으면 **반드시 두 곳을 함께** 바꿔야 한다.
 *
 * 이 모듈은 아무것도 import 하지 않는다(순수). Firestore 접근은 `conquestClaimRead.ts` 가 맡는다.
 */

export type LngLat = [number, number];

/** Claim 단위. **축적 데이터의 단위이므로 확정 후 변경 불가에 준한다**(OQ-1). */
export const CONQUEST_CELL_ZOOM = 20;
/** 셀을 담는 묶음 문서 단위. */
export const CONQUEST_CHUNK_ZOOM = 12;
/** 서울 위도 기준 z12 한 변 ~7.8km — 반경 계산·진단용 */
export const CONQUEST_CHUNK_APPROX_METERS = 7800;

export function lngLatToTileXY(
  lng: number,
  lat: number,
  zoom: number,
): { x: number; y: number } {
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

/** 이 좌표가 속한 Claim 셀 ID (`20_x_y`). */
export function conquestCellIdAt(lngLat: LngLat): string {
  const { x, y } = lngLatToTileXY(lngLat[0], lngLat[1], CONQUEST_CELL_ZOOM);
  return `${CONQUEST_CELL_ZOOM}_${x}_${y}`;
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
