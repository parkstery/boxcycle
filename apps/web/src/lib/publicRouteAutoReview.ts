/**
 * 퍼블릭 경로 신청·승인 전 자동 검수(거리·유사도).
 * 제목·소개는 `publicRouteContentPolicy.ts` 와 선택적 원격 모더레이션 URL 을 사용한다.
 */
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { listPublishedRoutePublications } from "./firestoreRoutePublications";
import type { LineStringGeometry, LngLat } from "./geo";
import { getDistanceMeters, getPointOnRouteByDistance } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";
import { decodeLineStringCoordsJson } from "./lineStringCoordsJson";

/** 퍼블릭 등록 최소 연장(미만이면 신청 불가). 테스트: 0.1km — 운영 복귀 시 5000 권장 */
export const PUBLIC_ROUTE_MIN_LENGTH_METERS = 100;

/** 퍼블릭 등록 최대 연장(초과 시 신청·승인 불가) */
export const PUBLIC_ROUTE_MAX_LENGTH_METERS = 300_000;

/** 기존 코스와의 유사도 상한: 대칭 샘플 매칭 비율이 이 값 이상이면 등록 불가(동일 profile 일 때) */
export const PUBLIC_ROUTE_SIMILARITY_BLOCK = 0.9;

const SIMILARITY_BUFFER_METERS = 28;
const SIMILARITY_SAMPLES_MIN = 28;
const SIMILARITY_SAMPLES_MAX = 200;

export function polylineLengthMeters(coords: LngLat[]): number {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    sum += getDistanceMeters(coords[i], coords[i + 1]);
  }
  return sum;
}

/** 경도·위도 평면에서 선분에 가장 가까운 점까지 거리(짧은 구간에서 haversine 근사에 충분) */
function pointToSegmentDistanceMeters(p: LngLat, a: LngLat, b: LngLat): number {
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
  return getDistanceMeters(p, [cx, cy]);
}

function minDistancePointToPolylineMeters(p: LngLat, geometry: LineStringGeometry): number {
  const coords = geometry.coordinates;
  if (coords.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i += 1) {
    min = Math.min(min, pointToSegmentDistanceMeters(p, coords[i], coords[i + 1]));
  }
  return min;
}

function sampleCountForLength(lengthMeters: number): number {
  const spaced = Math.ceil(lengthMeters / 50);
  return Math.min(SIMILARITY_SAMPLES_MAX, Math.max(SIMILARITY_SAMPLES_MIN, spaced));
}

/** 누적 거리 기준 등간격 샘플 */
function sampleAlongPolyline(geometry: LineStringGeometry, n: number): LngLat[] {
  const L = polylineLengthMeters(geometry.coordinates);
  if (L <= 0 || n < 2) return [...geometry.coordinates];
  const out: LngLat[] = [];
  for (let k = 0; k < n; k += 1) {
    const t = k / (n - 1);
    const p = getPointOnRouteByDistance(geometry, t * L);
    if (p) out.push(p);
  }
  return out;
}

function fractionSamplesWithinBuffer(samples: LngLat[], polyline: LineStringGeometry, maxM: number): number {
  if (samples.length === 0) return 0;
  let hit = 0;
  for (const p of samples) {
    if (minDistancePointToPolylineMeters(p, polyline) <= maxM) hit += 1;
  }
  return hit / samples.length;
}

/**
 * 두 LineString 의 형태 유사도(0~1). 대칭 min( A→B, B→A ) 로 짧은 쪽만 맞춘 가짜 중복을 완화.
 * 동일 profile 일 때만 비교하는 것은 호출 측 책임.
 */
export function routePolylineSimilaritySymmetric(
  a: LineStringGeometry,
  b: LineStringGeometry,
  bufferMeters = SIMILARITY_BUFFER_METERS,
): number {
  const lenA = polylineLengthMeters(a.coordinates);
  const lenB = polylineLengthMeters(b.coordinates);
  const n = Math.max(
    sampleCountForLength(lenA),
    sampleCountForLength(lenB),
    SIMILARITY_SAMPLES_MIN,
  );
  const sa = sampleAlongPolyline(a, n);
  const sb = sampleAlongPolyline(b, n);
  const forward = fractionSamplesWithinBuffer(sa, b, bufferMeters);
  const backward = fractionSamplesWithinBuffer(sb, a, bufferMeters);
  return Math.min(forward, backward);
}

const PUBLIC_ROUTE_REQUESTS_COLLECTION = "publicRouteRequests";

/**
 * 퍼블릭 신청·승인 직전 자동 검수: 최소 연장, 기존 퍼블릭/대기 신청과의 형태 유사도(동일 profile).
 */
export async function assertPublicRouteAutoReview(input: {
  db: Firestore;
  geometry: LineStringGeometry;
  profile: RouteProfile;
  /** 승인 시 현재 신청 문서는 유사도 비교에서 제외 */
  excludePublicRouteRequestId?: string;
  /** 일반 신청: Rules 상 본인 pending 만 조회 가능 */
  applicantUid?: string;
  /** 심사자 승인 검수: 타인 pending 유사도 비교(리뷰어 read 규칙) */
  scanAllPendingRequests?: boolean;
}): Promise<void> {
  const { db, geometry, profile, excludePublicRouteRequestId, applicantUid, scanAllPendingRequests } =
    input;
  const len = polylineLengthMeters(geometry.coordinates);
  if (len < PUBLIC_ROUTE_MIN_LENGTH_METERS) {
    throw new Error(
      `퍼블릭 등록은 코스 연장 약 ${PUBLIC_ROUTE_MIN_LENGTH_METERS / 1000}km 이상만 가능합니다. (현재 약 ${(len / 1000).toFixed(2)}km)`,
    );
  }
  if (len > PUBLIC_ROUTE_MAX_LENGTH_METERS) {
    throw new Error(
      `퍼블릭 등록은 코스 연장 약 ${PUBLIC_ROUTE_MAX_LENGTH_METERS / 1000}km 이하만 가능합니다. (현재 약 ${(len / 1000).toFixed(2)}km)`,
    );
  }

  const published = await listPublishedRoutePublications(100);
  for (const pub of published) {
    if (pub.snapshotProfile !== profile) continue;
    const other = decodeLineStringCoordsJson(pub.geometryCoordsJson);
    if (!other) continue;
    if (routePolylineSimilaritySymmetric(geometry, other) >= PUBLIC_ROUTE_SIMILARITY_BLOCK) {
      throw new Error(
        "이미 등록된 퍼블릭 코스와 경로 형태가 너무 유사합니다(같은 이동 수단, 약 90% 이상).",
      );
    }
  }

  if (scanAllPendingRequests || applicantUid) {
    const pendingQ = scanAllPendingRequests
      ? query(
          collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
          where("status", "==", "pending"),
          limit(80),
        )
      : query(
          collection(db, PUBLIC_ROUTE_REQUESTS_COLLECTION),
          where("status", "==", "pending"),
          where("applicantUid", "==", applicantUid!),
          limit(20),
        );
    const reqSnap = await getDocs(pendingQ);
    for (const d of reqSnap.docs) {
      if (excludePublicRouteRequestId && d.id === excludePublicRouteRequestId) continue;
      const data = d.data() as Record<string, unknown>;
      if (data.snapshotProfile !== profile) continue;
      const json = data.geometryCoordsJson;
      if (typeof json !== "string") continue;
      const other = decodeLineStringCoordsJson(json);
      if (!other) continue;
      if (routePolylineSimilaritySymmetric(geometry, other) >= PUBLIC_ROUTE_SIMILARITY_BLOCK) {
        throw new Error(
          scanAllPendingRequests
            ? "심사 대기 중인 다른 신청과 경로가 너무 유사합니다(같은 이동 수단, 약 90% 이상)."
            : "본인의 다른 심사 대기 신청과 경로가 너무 유사합니다(같은 이동 수단, 약 90% 이상).",
        );
      }
    }
  }
}