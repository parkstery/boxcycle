import { getDistanceMeters, type LineStringGeometry, type LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";

/** GeoJSON 좌표 반올림 자릿수 — 동일 루트·다른 부동소수 노이즈는 같은 지문으로 취급 */
const PRECISION = 5;
/** 거리 버킷 크기(m). 재라우팅 미세차로 총거리가 흔들려도 같은 버킷이면 같은 경로로 본다. */
const DISTANCE_BUCKET_METERS = 100;

/**
 * "같은 경로" 판정 지문 — 출발·도착 좌표 + 거리 버킷 + 이동 수단의 조합.
 *
 * 좌표열 전체를 해싱하던 옛 방식은 주행마다 Directions 재라우팅으로 꼭짓점이
 * 미세하게 흔들려(부동소수·좌표 개수 변화) 사실상 어떤 두 주행도 같은 지문이
 * 되지 않아 중복 저장을 못 막았다. 사용자가 체감하는 "같은 길"은 시·종점과
 * 대략적 길이·수단이 같은 것이므로, 그 세 요소만 정규화한다.
 *
 * 거리는 저장된 distanceMeters 대신 geometry 좌표열에서 직접 계산한다 —
 * 도메인마다(저장 경로·퍼블릭 신청·발행) 거리 소스가 달라도 같은 경로면
 * 같은 지문이 나오도록 매칭 일관성을 보장하기 위함.
 */
export function encodeCanonicalRouteGeometryProfile(
  geometry: LineStringGeometry,
  profile: RouteProfile,
): string {
  const coords = geometry.coordinates as LngLat[];
  const first = coords[0] ?? [0, 0];
  const last = coords[coords.length - 1] ?? [0, 0];
  const at = ([lng, lat]: LngLat | number[]) =>
    `${Number(lng).toFixed(PRECISION)},${Number(lat).toFixed(PRECISION)}`;
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    meters += getDistanceMeters(coords[i], coords[i + 1]);
  }
  const distBucket = Math.round(meters / DISTANCE_BUCKET_METERS);
  return `${at(first)}>${at(last)}|${distBucket}|${profile}`;
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
