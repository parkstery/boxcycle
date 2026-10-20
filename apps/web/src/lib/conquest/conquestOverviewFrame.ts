import type { LineStringGeometry } from "../geo/geo";

export type ConquestOverviewFrame = {
  bbox: [number, number, number, number];
  center: [number, number];
  selectedCellCount: number;
};

type Cell = { x: number; y: number };

const GRID_DEGREES = 1;
const DENSITY_THRESHOLD = 0.02;
const MAX_VIEW_DEGREES = 170;
const MAX_SEGMENT_DENSITY_CONTRIBUTION_M = 1000;

function cellOf(lng: number, lat: number): Cell {
  return {
    x: Math.floor(lng / GRID_DEGREES),
    y: Math.floor(lat / GRID_DEGREES),
  };
}

function cellKey(cell: Cell): string {
  return `${cell.x}:${cell.y}`;
}

function segmentLengthMeters(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function clampFrame(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
): [number, number, number, number] {
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const width = Math.min(MAX_VIEW_DEGREES, Math.max(0.001, maxLng - minLng));
  const height = Math.min(MAX_VIEW_DEGREES, Math.max(0.001, maxLat - minLat));
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    Math.max(-180, centerLng - halfWidth),
    Math.max(-85, centerLat - halfHeight),
    Math.min(180, centerLng + halfWidth),
    Math.min(85, centerLat + halfHeight),
  ];
}

/**
 * 주행 geometry 전체를 무조건 fitBounds 하지 않고, 선분 길이가 가장 많이 쌓인
 * 연결 격자 영역을 찾아 사용자가 실제로 달린 지역을 중심으로 프레이밍한다.
 * Firestore를 추가로 읽지 않고 이미 로드된 trace만 사용한다.
 */
export function computeConquestOverviewFrame(
  geometries: readonly LineStringGeometry[],
): ConquestOverviewFrame | null {
  const scores = new Map<string, { cell: Cell; meters: number }>();
  const segments: { cell: Cell; a: [number, number]; b: [number, number] }[] = [];

  for (const geometry of geometries) {
    const coordinates = geometry.coordinates;
    for (let i = 0; i + 1 < coordinates.length; i += 1) {
      const a = coordinates[i];
      const b = coordinates[i + 1];
      const length = segmentLengthMeters(a, b);
      if (!(length > 0)) continue;
      const cell = cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const key = cellKey(cell);
      const score = scores.get(key) ?? { cell, meters: 0 };
      // 한 번의 긴/희소한 trace 선분이 도시의 반복 주행보다 우선하지 않도록
      // 선분 하나의 density 기여에는 상한을 둔다.
      score.meters += Math.min(length, MAX_SEGMENT_DENSITY_CONTRIBUTION_M);
      scores.set(key, score);
      segments.push({ cell, a, b });
    }
  }

  if (scores.size === 0) return null;

  let seed = [...scores.values()][0];
  for (const score of scores.values()) {
    if (score.meters > seed.meters) seed = score;
  }

  const threshold = Math.max(1, seed.meters * DENSITY_THRESHOLD);
  const selected = new Set<string>();
  const queue: Cell[] = [seed.cell];
  selected.add(cellKey(seed.cell));
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        const key = cellKey(next);
        if (selected.has(key)) continue;
        if ((scores.get(key)?.meters ?? 0) < threshold) continue;
        selected.add(key);
        queue.push(next);
      }
    }
  }

  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const segment of segments) {
    if (!selected.has(cellKey(segment.cell))) continue;
    minLng = Math.min(minLng, segment.a[0], segment.b[0]);
    minLat = Math.min(minLat, segment.a[1], segment.b[1]);
    maxLng = Math.max(maxLng, segment.a[0], segment.b[0]);
    maxLat = Math.max(maxLat, segment.a[1], segment.b[1]);
  }

  if (!Number.isFinite(minLng)) return null;
  const bbox = clampFrame(minLng, minLat, maxLng, maxLat);
  return {
    bbox,
    center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    selectedCellCount: selected.size,
  };
}
