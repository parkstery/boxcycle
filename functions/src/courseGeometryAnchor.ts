type LngLat = [number, number];

const COORD_DECIMALS = 3;
const EARTH_RADIUS_M = 6_371_000;

function roundCoord(n: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(n * f) / f;
}

function haversineMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const dp = p2 - p1;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseCoordsFromCourseData(data: Record<string, unknown>): LngLat[] | null {
  const jsonField = data.geometryCoordsJson;
  if (typeof jsonField === "string" && jsonField.length > 0) {
    try {
      const raw = JSON.parse(jsonField) as unknown;
      if (!Array.isArray(raw) || raw.length < 2) return null;
      const out: LngLat[] = [];
      for (const c of raw) {
        if (!Array.isArray(c) || c.length !== 2) return null;
        const lng = c[0];
        const lat = c[1];
        if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        out.push([lng, lat]);
      }
      return out.length >= 2 ? out : null;
    } catch {
      return null;
    }
  }
  const geom = data.geometry;
  if (geom && typeof geom === "object") {
    const g = geom as { type?: unknown; coordinates?: unknown };
    if (g.type === "LineString" && Array.isArray(g.coordinates)) {
      const out: LngLat[] = [];
      for (const c of g.coordinates) {
        if (!Array.isArray(c) || c.length !== 2) return null;
        const lng = c[0];
        const lat = c[1];
        if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        out.push([lng, lat]);
      }
      return out.length >= 2 ? out : null;
    }
  }
  return null;
}

/** 진행률(0..1)에 해당하는 코스 위 좌표 — 거리 비례 보간 */
export function lngLatAlongPolyline(coords: readonly LngLat[], progressRatio: number): LngLat | null {
  if (coords.length < 2) return null;
  const r = Math.max(0, Math.min(1, progressRatio));

  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const len = haversineMeters(coords[i - 1]!, coords[i]!);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) {
    const [lng, lat] = coords[0]!;
    return [roundCoord(lng), roundCoord(lat)];
  }

  let target = r * total;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]!;
    if (target <= len || i === segLens.length - 1) {
      const t = len > 0 ? Math.min(1, target / len) : 0;
      const a = coords[i]!;
      const b = coords[i + 1]!;
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      return [roundCoord(lng), roundCoord(lat)];
    }
    target -= len;
  }
  const last = coords[coords.length - 1]!;
  return [roundCoord(last[0]), roundCoord(last[1])];
}

export function liveAnchorFromCourseData(
  data: Record<string, unknown>,
  progressRatio: number,
): { lngLat: LngLat; progressRatio: number } | null {
  const coords = parseCoordsFromCourseData(data);
  if (!coords) return null;
  const lngLat = lngLatAlongPolyline(coords, progressRatio);
  if (!lngLat) return null;
  const pr = Math.max(0, Math.min(1, progressRatio));
  return { lngLat, progressRatio: pr };
}
