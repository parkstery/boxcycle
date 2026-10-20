import {
  buildConquestRoutePieces,
  type ConquestRoutePiece,
} from "./conquestTiles";
import type { LineStringGeometry, LngLat } from "../geo/geo";

export type NewRoadGeometryOptions = {
  geometry: LineStringGeometry;
  ownedAtStart: ReadonlySet<string>;
  traveledMeters?: number;
  fromMeters?: number;
  /** 서버가 확정한 신규 도로 길이. 생략하면 전체 신규 조각을 반환한다. */
  maxNewMeters?: number;
};

export type NewRoadGeometryResult = {
  /** 서로 연결된 신규 조각은 하나로 합친 LineString 목록. */
  segments: LineStringGeometry[];
  /** 반환된 geometry의 경로 길이 합(m). */
  meters: number;
};

function samePoint(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) <= 1e-9 && Math.abs(a[1] - b[1]) <= 1e-9;
}

function clippedEnd(piece: ConquestRoutePiece, meters: number): LngLat {
  if (meters >= piece.meters) return piece.end;
  const ratio = piece.meters > 0 ? meters / piece.meters : 0;
  return [
    piece.start[0] + (piece.end[0] - piece.start[0]) * ratio,
    piece.start[1] + (piece.end[1] - piece.start[1]) * ratio,
  ];
}

/**
 * 최근 주행에서 시작 시점에 보유하지 않았던 도로 조각만 메모리에서 만든다.
 *
 * 셀 샘플링은 `buildConquestCellsFromRoute`와 공유하는
 * `buildConquestRoutePieces`를 사용한다. 따라서 이 함수는 Firestore에 geometry를
 * 저장하지 않으며, 호출자가 결과를 상태에 보관하는 동안만 최근 신규 도로로 쓸 수 있다.
 */
export function buildNewRoadGeometryFromRoute(
  opts: NewRoadGeometryOptions,
): NewRoadGeometryResult {
  const traveledMeters = opts.traveledMeters ?? Number.POSITIVE_INFINITY;
  const pieces = buildConquestRoutePieces(opts.geometry, traveledMeters, opts.fromMeters ?? 0);
  const maxNewMeters =
    opts.maxNewMeters === undefined || opts.maxNewMeters === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Number.isFinite(opts.maxNewMeters) ? opts.maxNewMeters : 0);
  if (pieces.length === 0 || maxNewMeters <= 0) return { segments: [], meters: 0 };

  const segments: LineStringGeometry[] = [];
  let current: LngLat[] | null = null;
  let meters = 0;

  for (const piece of pieces) {
    if (opts.ownedAtStart.has(piece.cellId)) {
      current = null;
      continue;
    }
    const remaining = maxNewMeters - meters;
    if (remaining <= 0) break;
    const acceptedMeters = Math.min(piece.meters, remaining);
    if (!(acceptedMeters > 0)) continue;

    const end = clippedEnd(piece, acceptedMeters);
    if (current && samePoint(current[current.length - 1], piece.start)) {
      current.push(end);
    } else {
      current = [piece.start, end];
      segments.push({ type: "LineString", coordinates: current });
    }
    meters += acceptedMeters;
    if (acceptedMeters < piece.meters) break;
  }

  return { segments, meters };
}
