/**
 * 퍼블릭 경로 자동 등록 — 기하·정책 검수 코어(신뢰 경계, Admin SDK 측).
 * 클라 `apps/web/src/lib/publicRouteAutoReview.ts` · `publicRouteContentPolicy.ts` 의 순수 함수를
 * 이식한 것 — 알고리즘·상수는 동기 유지해야 한다(정책 §4). functions 쪽에서 자체 완결(웹 코드 import 금지).
 * SoT: document/260717-퍼블릭-경로-자동등록-정책.md
 */
import { findBannedWord, findPrivateInfo } from "./publicRouteBadWords.js";

export type LngLat = [number, number];

export type AutoReviewVerdict = { ok: true } | { ok: false; reason: string };

function ok(): AutoReviewVerdict {
  return { ok: true };
}

function fail(reason: string): AutoReviewVerdict {
  return { ok: false, reason };
}

/** 두 좌표 간 거리(m) — haversine. 클라 geo.ts `getDistanceMeters` / routeFingerprintCore `distanceMeters` 와 동일. */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Web Mercator (EPSG:3857) 구면 반경 — Mapbox 경로선 세그먼트와 동일한 직선 보간에 사용(클라 geo.ts 와 동일) */
const WEB_MERCATOR_R = 6378137;

function lngLatToMercatorMeters(lngLat: LngLat): { x: number; y: number } {
  const lambda = (lngLat[0] * Math.PI) / 180;
  const phi = (lngLat[1] * Math.PI) / 180;
  return {
    x: WEB_MERCATOR_R * lambda,
    y: WEB_MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

function mercatorMetersToLngLat(x: number, y: number): LngLat {
  const lng = ((x / WEB_MERCATOR_R) * 180) / Math.PI;
  const lat = ((2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) * 180) / Math.PI;
  return [lng, lat];
}

/** 두 지점을 머캐토 평면에서 직선으로 잇는 가정 하의 보간(클라 `interpolateLngLatAlongMercatorChord` 와 동일). */
function interpolateLngLatAlongMercatorChord(a: LngLat, b: LngLat, ratio: number): LngLat {
  const t = Math.min(1, Math.max(0, ratio));
  const pa = lngLatToMercatorMeters(a);
  const pb = lngLatToMercatorMeters(b);
  return mercatorMetersToLngLat(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t);
}

export function polylineLengthMeters(coords: LngLat[]): number {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    sum += distanceMeters(coords[i], coords[i + 1]);
  }
  return sum;
}

/** 경도·위도 평면에서 선분에 가장 가까운 점까지 거리(짧은 구간에서 haversine 근사에 충분) */
export function pointToSegmentDistanceMeters(p: LngLat, a: LngLat, b: LngLat): number {
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  const px = p[0];
  const py = p[1];
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 1e-18 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return distanceMeters(p, [cx, cy]);
}

export function minDistancePointToPolylineMeters(p: LngLat, coords: LngLat[]): number {
  if (coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i += 1) {
    min = Math.min(min, pointToSegmentDistanceMeters(p, coords[i], coords[i + 1]));
  }
  return min;
}

function getPointOnRouteByDistance(coords: LngLat[], targetDistanceMeters: number): LngLat | null {
  if (!coords.length) return null;
  if (coords.length === 1) return coords[0];
  let remaining = Math.max(0, targetDistanceMeters);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const segmentStart = coords[i];
    const segmentEnd = coords[i + 1];
    const segmentDistance = distanceMeters(segmentStart, segmentEnd);
    if (segmentDistance <= 0) continue;
    if (remaining <= segmentDistance) {
      const ratio = remaining / segmentDistance;
      return interpolateLngLatAlongMercatorChord(segmentStart, segmentEnd, ratio);
    }
    remaining -= segmentDistance;
  }
  return coords[coords.length - 1];
}

const SIMILARITY_BUFFER_METERS = 28;
const SIMILARITY_SAMPLES_MIN = 28;
const SIMILARITY_SAMPLES_MAX = 200;

function sampleCountForLength(lengthMeters: number): number {
  const spaced = Math.ceil(lengthMeters / 50);
  return Math.min(SIMILARITY_SAMPLES_MAX, Math.max(SIMILARITY_SAMPLES_MIN, spaced));
}

/** 누적 거리 기준 등간격 샘플 */
function sampleAlongPolyline(coords: LngLat[], n: number): LngLat[] {
  const L = polylineLengthMeters(coords);
  if (L <= 0 || n < 2) return [...coords];
  const out: LngLat[] = [];
  for (let k = 0; k < n; k += 1) {
    const t = k / (n - 1);
    const p = getPointOnRouteByDistance(coords, t * L);
    if (p) out.push(p);
  }
  return out;
}

function fractionSamplesWithinBuffer(samples: LngLat[], polyline: LngLat[], maxM: number): number {
  if (samples.length === 0) return 0;
  let hit = 0;
  for (const p of samples) {
    if (minDistancePointToPolylineMeters(p, polyline) <= maxM) hit += 1;
  }
  return hit / samples.length;
}

/**
 * 두 LineString 의 형태 유사도(0~1). 대칭 min( A→B, B→A ) 로 짧은 쪽만 맞춘 가짜 중복을 완화.
 * 동일 profile 일 때만 비교하는 것은 호출 측 책임. 클라 `routePolylineSimilaritySymmetric` 와 동일 알고리즘·상수.
 */
export function routePolylineSimilaritySymmetric(
  a: LngLat[],
  b: LngLat[],
  bufferMeters = SIMILARITY_BUFFER_METERS,
): number {
  const lenA = polylineLengthMeters(a);
  const lenB = polylineLengthMeters(b);
  const n = Math.max(sampleCountForLength(lenA), sampleCountForLength(lenB), SIMILARITY_SAMPLES_MIN);
  const sa = sampleAlongPolyline(a, n);
  const sb = sampleAlongPolyline(b, n);
  const forward = fractionSamplesWithinBuffer(sa, b, bufferMeters);
  const backward = fractionSamplesWithinBuffer(sb, a, bufferMeters);
  return Math.min(forward, backward);
}

// ─── 정책 상수 (정책 문서 §4 와 일치) ───
// 클라 publicRouteAutoReview.ts / publicRouteContentPolicy.ts 와 동기 유지할 것.

// export const PUBLIC_ROUTE_MIN_LENGTH_METERS = 5000;
export const PUBLIC_ROUTE_MIN_LENGTH_METERS = 100;
export const PUBLIC_ROUTE_MAX_LENGTH_METERS = 120_000;
export const PUBLIC_ROUTE_SIMILARITY_BLOCK = 0.9;
export const PUBLIC_ROUTE_MIN_COORDS = 20;
/** 웹 `SAVED_ROUTE_MAX_COORDS` 와 동일값 */
export const PUBLIC_ROUTE_MAX_COORDS = 5000;
export const PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS = 500;
export const PUBLIC_ROUTE_MAX_URLS = 2;

/** 미완주 출판 상한(선점 방지, 정책 §2). admin 은 무제한(코드에서 별도 처리). */
export const UNRIDDEN_PUBLICATION_CAP = { registered_free: 3, registered_paid: 5 } as const;

/** 경로 외접 사각형(bbox) 대각선 거리(m) — 좌표들의 min/max lng·lat 두 모서리 간 haversine */
export function bboxDiagonalMeters(coords: LngLat[]): number {
  if (coords.length === 0) return 0;
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return distanceMeters([minLng, minLat], [maxLng, maxLat]);
}

/** 밀도 검사: 좌표 수가 길이 대비 비정상으로 많지 않은지 */
export function isCoordDensityValid(coords: LngLat[], lengthMeters: number): boolean {
  const maxAllowed = Math.max(500, (lengthMeters / 1000) * 400);
  return coords.length <= maxAllowed;
}

function isLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    v[0] >= -180 &&
    v[0] <= 180 &&
    v[1] >= -90 &&
    v[1] <= 90
  );
}

/** `geometryCoordsJson` 파싱 + `[lng,lat][]` 형태 검증. 실패 시 null. */
export function parseAndValidateCoordsJson(json: string): LngLat[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  for (const item of parsed) {
    if (!isLngLat(item)) return null;
  }
  return parsed as LngLat[];
}

/** 최소·최대 연장 검사(G1·G2) — 클라 기존 메시지 문구 그대로 사용 */
export function checkRouteLength(lengthMeters: number): AutoReviewVerdict {
  if (lengthMeters < PUBLIC_ROUTE_MIN_LENGTH_METERS) {
    return fail(
      `퍼블릭 등록은 코스 연장 약 ${PUBLIC_ROUTE_MIN_LENGTH_METERS / 1000}km 이상만 가능합니다. (현재 약 ${(lengthMeters / 1000).toFixed(2)}km)`,
    );
  }
  if (lengthMeters > PUBLIC_ROUTE_MAX_LENGTH_METERS) {
    return fail(
      `퍼블릭 등록은 코스 연장 약 ${PUBLIC_ROUTE_MAX_LENGTH_METERS / 1000}km 이하만 가능합니다. (현재 약 ${(lengthMeters / 1000).toFixed(2)}km)`,
    );
  }
  return ok();
}

/** 좌표 수 검사(G6 전반부) */
export function checkCoordCount(coords: LngLat[]): AutoReviewVerdict {
  if (coords.length < PUBLIC_ROUTE_MIN_COORDS || coords.length > PUBLIC_ROUTE_MAX_COORDS) {
    return fail("경로 좌표 수가 비정상입니다.");
  }
  return ok();
}

/** 밀도 검사(G6 후반부) */
export function checkCoordDensity(coords: LngLat[], lengthMeters: number): AutoReviewVerdict {
  if (!isCoordDensityValid(coords, lengthMeters)) {
    return fail("경로 좌표 수가 비정상입니다.");
  }
  return ok();
}

/** bbox 대각선 검사(G7) */
export function checkBboxDiagonal(coords: LngLat[]): AutoReviewVerdict {
  if (bboxDiagonalMeters(coords) < PUBLIC_ROUTE_MIN_BBOX_DIAGONAL_METERS) {
    return fail("경로가 너무 좁은 영역에 몰려 있습니다(직경 500m 이상 필요).");
  }
  return ok();
}

// ─── 제목·소개 구조 검사 (클라 publicRouteContentPolicy.ts `validatePublicRouteTitleAndSummary` 이식) ───

const INVISIBLE_OR_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/;
/** 동일 문자·이모지 등 과도 반복(스팸 패턴) */
const EXCESSIVE_REPEAT = /(.)\1{49,}/u;

/** 제목·소개 구조 검사(G3) — 제어·숨김 문자, 줄바꿈, 과반복. 클라와 동일 문구. */
export function checkTitleSummaryStructure(title: string, summary: string): AutoReviewVerdict {
  if (INVISIBLE_OR_CONTROL.test(title) || INVISIBLE_OR_CONTROL.test(summary)) {
    return fail("제목·소개에 사용할 수 없는 제어문자·숨김 문자가 포함되어 있습니다.");
  }
  if (/[\r\n]/.test(title)) {
    return fail("공개 제목에는 줄바꿈을 넣을 수 없습니다.");
  }
  if (EXCESSIVE_REPEAT.test(title) || EXCESSIVE_REPEAT.test(summary)) {
    return fail("제목·소개에 과도하게 반복되는 문자가 있습니다.");
  }
  return ok();
}

/** URL 합계 검사(G5 후반부) */
export function checkUrlCount(title: string, summary: string, countUrls: (s: string) => number): AutoReviewVerdict {
  const total = countUrls(title) + countUrls(summary);
  if (total > PUBLIC_ROUTE_MAX_URLS) {
    return fail("제목·소개에 포함할 수 있는 링크 개수를 초과했습니다.");
  }
  return ok();
}

/** 금칙어 검사(G4) — 매칭 단어는 로그에만 남기고 사용자 메시지에는 노출하지 않는다. */
export function checkBannedWords(title: string, summary: string): { verdict: AutoReviewVerdict; matched: string | null } {
  const matched = findBannedWord(title) ?? findBannedWord(summary);
  if (matched) {
    return { verdict: fail("제목·소개에 사용할 수 없는 표현이 포함되어 있습니다."), matched };
  }
  return { verdict: ok(), matched: null };
}

/** 개인정보 검사(G5 전반부) */
export function checkPrivateInfo(title: string, summary: string): AutoReviewVerdict {
  const hit = findPrivateInfo(title) ?? findPrivateInfo(summary);
  if (hit) {
    return fail("제목·소개에 전화번호·이메일 등 개인정보를 넣을 수 없습니다.");
  }
  return ok();
}

/** 태그 검사(G10) */
export function checkExperienceTags(tags: unknown): AutoReviewVerdict {
  const ALLOWED = new Set(["mountain_trail", "coastal_road", "water_route", "urban", "countryside"]);
  if (!Array.isArray(tags) || tags.length < 1 || tags.length > 3) {
    return fail("경로 프로필 태그는 1~3개 선택하세요.");
  }
  for (const t of tags) {
    if (typeof t !== "string" || !ALLOWED.has(t)) {
      return fail(`허용되지 않은 태그입니다: ${String(t)}`);
    }
  }
  return ok();
}

/** 미완주 출판 상한(정책 §2) — tier 별 상한. admin 은 무제한(호출 측에서 이 함수를 부르지 않음). */
export function unriddenPublicationCapFor(tier: "registered_free" | "registered_paid"): number {
  return UNRIDDEN_PUBLICATION_CAP[tier];
}

export function checkUnriddenPublicationCap(
  tier: "registered_free" | "registered_paid",
  unriddenCount: number,
): AutoReviewVerdict {
  const cap = unriddenPublicationCapFor(tier);
  if (unriddenCount >= cap) {
    return fail(
      `미완주 상태로 등록한 퍼블릭 경로가 ${unriddenCount}개입니다. 기존 코스를 완주하면 추가 등록이 가능합니다.`,
    );
  }
  return ok();
}
