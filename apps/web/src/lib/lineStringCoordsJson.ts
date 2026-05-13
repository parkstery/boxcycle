import type { LineStringGeometry } from "./geo";

/** `geometryCoordsJson` 등 LineString 좌표 JSON 배열 디코딩 */
export function decodeLineStringCoordsJson(json: string): LineStringGeometry | null {
  try {
    const coords = JSON.parse(json) as unknown;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const ok = coords.every(
      (c) =>
        Array.isArray(c) &&
        c.length === 2 &&
        typeof c[0] === "number" &&
        typeof c[1] === "number" &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]),
    );
    if (!ok) return null;
    return { type: "LineString", coordinates: coords as [number, number][] };
  } catch {
    return null;
  }
}
