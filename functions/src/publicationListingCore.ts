/**
 * 공개 경로 요약 목록(G2) — `routePublications/{id}` 원본에서 `publicationListings/{id}` 를 만든다.
 *
 * 왜: 퍼블릭 탭 목록이 원본을 읽으면 문서마다 경로 전체 좌표(`geometryCoordsJson`)를 받고, 지역 조건 없이
 * 전세계 80개만 보인다. 원본은 불변 스냅샷(Ontology)이라 필드를 옮기지 않고, `openTrailListings` 처럼
 * 서버가 요약 문서를 따로 만든다. 계획: document/ops/20261103-global-geo-data/00-plan.md §4.1.
 *
 * - 목록 문서는 **공개(published) Publication 만** 둔다. archived·삭제·좌표 없음 → 목록 문서를 지운다.
 *   그래서 목록 쿼리는 `status` 조건이 필요 없다(`status` 필드는 계획 규격대로 남긴다).
 * - 지역 기준점 = 경로 첫 좌표(출발점). 국경을 넘는 경로도 한 지역에만 속한다(계획 §3.2).
 * - 이 파일은 Firestore 를 import 하지 않는 순수 모듈이다. 읽기·쓰기는 `publicationListingStore.ts`.
 */
import type { GeoRegion } from "./geoRegion/geoRegionCore.js";
import type { LngLat } from "./geoTiles.js";

export const ROUTE_PUBLICATIONS_COLLECTION = "routePublications";
export const PUBLICATION_LISTINGS_COLLECTION = "publicationListings";

/** 목록 문서 규격 판. 필드를 바꾸면 올리고, 채우기 CLI 가 이 값이 다른 문서를 다시 쓴다. */
export const PUBLICATION_LISTING_SCHEMA_VERSION = 1;

export type PublicationListingProfile = "cycling" | "driving" | "walking";

/** 저장되는 목록 문서(시각 필드 제외). 시각은 store 가 붙인다. */
export type PublicationListingFields = {
  publicationId: string;
  routeId: string;
  publicTitle: string;
  snapshotDistanceMeters: number;
  snapshotDurationSec: number;
  snapshotProfile: PublicationListingProfile;
  /** 카탈로그 「등록자」 표시용. 원본 published 문서도 공개 읽기라 노출 범위는 같다. 탈퇴 시 "" */
  applicantUid: string;
  publisherDeleted: boolean;
  status: "published";
  /** [lng, lat] — 출발점(지역 기준점) */
  startLngLat: LngLat;
  /** [minLng, minLat, maxLng, maxLat] — 화면 범위 결과 거르기용 */
  bbox: [number, number, number, number];
  geoQuadkey: string;
  geoContinent: string | null;
  geoCountry: string | null;
  geoAdmin1: string | null;
  geoResolverVersion: number;
  listingSchemaVersion: number;
};

export type GeoResolver = (lngLat: LngLat) => GeoRegion | null;

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** `geometryCoordsJson` → 좌표 목록. 형식이 어긋나면 null(목록에 올리지 않는다). */
export function parsePublicationCoords(raw: unknown): LngLat[] | null {
  if (typeof raw !== "string" || raw.length < 2) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return null;
  const out: LngLat[] = [];
  for (const c of parsed) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const lng = finiteNumber(c[0]);
    const lat = finiteNumber(c[1]);
    if (lng == null || lat == null || lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
    out.push([lng, lat]);
  }
  return out;
}

export function coordsBbox(coords: readonly LngLat[]): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function parseProfile(v: unknown): PublicationListingProfile {
  return v === "driving" || v === "walking" ? v : "cycling";
}

/**
 * 원본 문서 → 목록 문서 필드. 목록에 두지 않을 문서(비공개·제목 없음·좌표 없음·지역 판정 불가)는 null.
 * 지역 판정이 바다 등으로 국가를 못 찾으면 `geoCountry` 만 null 이고 문서는 만든다(전세계 범위에만 나온다).
 */
export function buildPublicationListing(
  publicationId: string,
  data: Record<string, unknown> | undefined,
  resolveGeo: GeoResolver,
): PublicationListingFields | null {
  if (!data || !publicationId) return null;
  if (data.status !== "published") return null;
  const routeId = typeof data.routeId === "string" ? data.routeId : "";
  const publicTitle = typeof data.publicTitle === "string" ? data.publicTitle.trim() : "";
  if (!routeId || !publicTitle) return null;
  const coords = parsePublicationCoords(data.geometryCoordsJson);
  if (!coords) return null;
  const start = coords[0]!;
  const geo = resolveGeo(start);
  if (!geo) return null;
  return {
    publicationId,
    routeId,
    publicTitle,
    snapshotDistanceMeters: finiteNumber(data.snapshotDistanceMeters) ?? 0,
    snapshotDurationSec: finiteNumber(data.snapshotDurationSec) ?? 0,
    snapshotProfile: parseProfile(data.snapshotProfile),
    applicantUid: typeof data.applicantUid === "string" ? data.applicantUid : "",
    publisherDeleted: data.publisherDeleted === true,
    status: "published",
    startLngLat: [start[0], start[1]],
    bbox: coordsBbox(coords),
    geoQuadkey: geo.geoQuadkey,
    geoContinent: geo.geoContinent,
    geoCountry: geo.geoCountry,
    geoAdmin1: geo.geoAdmin1,
    geoResolverVersion: geo.geoResolverVersion,
    listingSchemaVersion: PUBLICATION_LISTING_SCHEMA_VERSION,
  };
}

/** 목록 문서에 영향을 주는 원본 필드. 이 밖의 변경(`presenceEnabled`·`updatedAt`)은 트리거가 즉시 반환한다. */
const LISTING_SOURCE_KEYS = [
  "status",
  "routeId",
  "publicTitle",
  "geometryCoordsJson",
  "snapshotDistanceMeters",
  "snapshotDurationSec",
  "snapshotProfile",
  "applicantUid",
  "publisherDeleted",
] as const;

/**
 * 원본 쓰기가 목록을 바꿀 수 있는가. 생성·삭제는 항상 참. 수정은 목록에 쓰는 필드가 바뀔 때만 참 —
 * 클라이언트의 `presenceEnabled` 병합(동행 켜기)마다 판정 데이터를 읽지 않게 한다.
 */
export function publicationWriteAffectsListing(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!before || !after) return true;
  return LISTING_SOURCE_KEYS.some((k) => before[k] !== after[k]);
}

/** 목록 문서끼리 내용 비교(시각 제외). 같으면 다시 쓰지 않는다(채우기 재실행·중복 트리거). */
export function listingFieldsEqual(
  a: PublicationListingFields,
  b: Record<string, unknown> | undefined,
): boolean {
  if (!b) return false;
  for (const [k, v] of Object.entries(a)) {
    const other = b[k];
    if (Array.isArray(v)) {
      if (!Array.isArray(other) || other.length !== v.length) return false;
      for (let i = 0; i < v.length; i++) if (other[i] !== v[i]) return false;
    } else if (other !== v) {
      return false;
    }
  }
  return true;
}
