import type { LineStringGeometry, LngLat } from "./geo";

/** 줌에 따라 노선 꼭짓점 상한(로비 관전 LOD). */
export function maxLineStringVerticesForMapZoom(zoom: number): number {
  if (zoom <= 8) return 20;
  if (zoom <= 10) return 32;
  if (zoom <= 12) return 56;
  if (zoom <= 14) return 96;
  return 160;
}

/** 균등 스텝으로 꼭짓점 수를 줄이고 시종점 유지. */
export function decimateLineStringVertices(geometry: LineStringGeometry, maxVertices: number): LineStringGeometry {
  const coords = geometry.coordinates as LngLat[];
  if (coords.length <= maxVertices) return geometry;
  const step = Math.max(1, Math.ceil(coords.length / maxVertices));
  const out: LngLat[] = [];
  for (let i = 0; i < coords.length; i += step) {
    out.push(coords[i]!);
  }
  const last = coords[coords.length - 1]!;
  const prev = out[out.length - 1];
  if (!prev || prev[0] !== last[0] || prev[1] !== last[1]) {
    out.push(last);
  }
  return { type: "LineString", coordinates: out };
}
