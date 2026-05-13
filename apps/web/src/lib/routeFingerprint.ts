import type { LineStringGeometry } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";

/** GeoJSON 좌표 반올림 자릿수 — 동일 루트·다른 부동소수 노이즈는 같은 지문으로 취급 */
const PRECISION = 5;

/**
 * LineString 전 구간 + 이동 수단을 문자열로 정규화한다.
 * 시·종점만 같고 꼭짓점(경과)이 다르면 다른 문자열이 된다.
 * 같은 꼭짓점이라도 프로필(주행 방법)이 다르면 `|profile` 으로 구분된다.
 */
export function encodeCanonicalRouteGeometryProfile(
  geometry: LineStringGeometry,
  profile: RouteProfile,
): string {
  const parts = geometry.coordinates.map(
    ([lng, lat]) => `${lng.toFixed(PRECISION)},${lat.toFixed(PRECISION)}`,
  );
  return `${parts.join(";")}|${profile}`;
}

/**
 * Firestore `routeFingerprint` 등에 쓰는 64자 hex (SHA-256).
 * Web Crypto 미지원 환경에서는 동기식 대체 지문(동일 입력에 대해 결정적).
 */
export async function computeRouteFingerprint(
  geometry: LineStringGeometry,
  profile: RouteProfile,
): Promise<string> {
  const canonical = encodeCanonicalRouteGeometryProfile(geometry, profile);
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fingerprintFromCanonicalSync(canonical);
}

/** `computeRouteFingerprint` 가 SubtleCrypto 없을 때만 사용 */
export function fingerprintFromCanonicalSync(canonical: string): string {
  let h = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = h >>> 0;
  let out = x.toString(16).padStart(8, "0");
  for (let r = 1; r < 8; r++) {
    x = Math.imul(x ^ (x >>> 13), 0xcc9e2d51) >>> 0;
    out += x.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64).padEnd(64, "0");
}
