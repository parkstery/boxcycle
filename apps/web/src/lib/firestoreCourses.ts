import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  BASIC_INTRO_HUB_ROUTE_SEEDS,
  BASIC_INTRO_HUB_ROUTE_REVISION,
} from "./basicIntroHubRouteGeometries";
import { getFirebaseFirestore } from "./firebase";
import {
  findPublishedRoutePublicationById,
  listPublishedRoutePublications,
  mergePublicationPresenceEnabled,
  ROUTE_PUBLICATIONS_COLLECTION,
  type RoutePublicationRow,
} from "./firestoreRoutePublications";
import { getUserPublicLabelsByUid } from "./firestoreUser";
import { getDistanceMeters, type LineStringGeometry, type LngLat } from "./geo";
import { computeRouteFingerprint } from "./routeFingerprint";

export type CourseCategory = "basic" | "public" | "recommended" | "challenge";
export type CourseProfile = "cycling" | "driving" | "walking";

export type CourseDoc = {
  id: string;
  title: string;
  description: string | null;
  category: CourseCategory;
  type: "starter" | "curated" | "ugc";
  profile: CourseProfile;
  isPublic: boolean;
  status: "published" | "draft" | "archived";
  isRequired: boolean;
  requiredOrder: number | null;
  distanceMeters: number;
  durationSec: number;
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  /**
   * Firestore 는 `[[lng,lat], ...]` 처럼 배열의 배열을 필드로 저장할 수 없음.
   * DB에는 `geometryCoordsJson` 만 쓰고, 내장 BASIC_COURSES 등 로컬 상수에는 `geometry` 만 둘 수 있음.
   */
  geometryCoordsJson?: string;
  geometry?: {
    type: "LineString";
    coordinates: LngLat[];
  };
  /** Rules 공개 읽기 게이트 (`firestore.rules` 의 courses read 와 동기) */
  visibility?: "public" | "unlisted" | "private";
  lifecycleStage?: string;
  sourcePublicRouteRequestId?: string;
  sourceSavedRouteId?: string;
  applicantUid?: string;
  experienceTags?: string[];
  /** 동일 퍼블릭/신청 중복 방지 (SHA-256 hex 64) */
  routeFingerprint?: string;
  /** 상시 입문 허브(공개 읽기·동시 주행 presence 등) */
  isSharedStartHub?: boolean;
  /** Firestore Rules에서 coursePresence 허용 여부 판별 (입문 허브 등 true) */
  presenceEnabled?: boolean;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
};

/**
 * 동시 주행 presence 가 분리되는 입문 허브 publication id.
 *
 * 단일 진실은 `basicIntroHubRouteGeometries.ts`(Mapbox Directions cycling 실도로 seed)이며
 * `BASIC_COURSES`·`BASIC_SHARED_HUB_SUMMARIES` 도 모두 같은 seed 에서 파생한다.
 * Functions 쪽 사본은 `functions/src/basicIntroHubSeeds.ts` — 두 파일의 ID 집합 일치는
 * `apps/web/scripts/basic-routes-verify/verify-basic-routes.mjs` 가 검사한다.
 */
export const BASIC_SHARED_HUB_IDS: readonly string[] = BASIC_INTRO_HUB_ROUTE_SEEDS.map(
  (seed) => seed.id,
);

export type BasicSharedHubCourseId = string;

export type CourseRoutePayload = {
  id: string;
  title: string;
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  profile: CourseProfile;
};

/** 공개·게시된 퍼블릭 코스 목록(패널용 요약) */
export type PublishedPublicCourseSummary = {
  /** 카탈로그·`courseActivity` 키 (`courses/{id}`) */
  id: string;
  /** 공개 제목 (`routePublications.publicTitle` 우선) */
  title: string;
  profile: CourseProfile;
  distanceMeters: number;
  durationSec: number;
  /** 통합 경로 정체성 — `savedRoutes` id */
  routeId?: string | null;
  /** 출판 리비전 id (마이그레이션 기간 `id` 와 동일할 수 있음) */
  publicationId?: string | null;
  /** UGC 승인 시 원본 `savedRoutes` 문서 ID — 동일 내 경로의 퍼블릭 재신청 방지에 사용 */
  sourceSavedRouteId?: string | null;
  /** 승인된 UGC 코스의 신청자 uid */
  applicantUid?: string | null;
  /** `users/{applicantUid}` 닉네임(없으면 displayName 등) */
  publisherNickname?: string | null;
};

function summaryFromPublication(pub: RoutePublicationRow): PublishedPublicCourseSummary {
  return {
    id: pub.publicationId,
    title: pub.publicTitle,
    profile: pub.snapshotProfile,
    distanceMeters: pub.snapshotDistanceMeters,
    durationSec: pub.snapshotDurationSec,
    routeId: pub.routeId,
    publicationId: pub.publicationId,
    sourceSavedRouteId: pub.routeId,
    applicantUid: pub.applicantUid.length > 0 ? pub.applicantUid : null,
  };
}

/**
 * 퍼블릭 카탈로그 — `routePublications` 단일 (Phase 5: `courses` 폴백 제거).
 */
export async function listPublishedPublicCourses(max = 40): Promise<PublishedPublicCourseSummary[]> {
  const cap = Math.min(80, Math.max(1, max));
  const pubs = await listPublishedRoutePublications(cap);
  const rows = pubs.map(summaryFromPublication);
  const labelByUid = await getUserPublicLabelsByUid(
    rows.map((r) => r.applicantUid).filter((uid): uid is string => Boolean(uid)),
  );
  return rows.map((r) => ({
    ...r,
    publisherNickname: r.applicantUid ? (labelByUid.get(r.applicantUid) ?? null) : null,
  }));
}

function isLngLatPair(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

function coordinatesFromGeometryCoordsJson(json: string): LngLat[] | null {
  try {
    const coords = JSON.parse(json) as unknown;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const out: LngLat[] = [];
    for (const c of coords) {
      if (!isLngLatPair(c)) return null;
      out.push(c);
    }
    return out;
  } catch {
    return null;
  }
}

function coordinatesApproxEqual(a: LngLat[], b: LngLat[], eps = 2e-4): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (Math.abs(p[0] - q[0]) > eps || Math.abs(p[1] - q[1]) > eps) return false;
  }
  return true;
}

function polylineLengthMeters(coords: LngLat[]): number {
  if (coords.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) {
    sum += getDistanceMeters(coords[i - 1], coords[i]);
  }
  return sum;
}

/**
 * Directions/OSRM 등으로 다시 계산된 경로는 꼭짓점 수가 달라 `coordinatesApproxEqual` 이 실패한다.
 * 같은 입문 허브 코스로 보기: 시작·끝이 허브와 가깝고, 총연장이 허브와 비슷할 때만 허용.
 */
function hubGeometryLooseSameCourse(
  userCoords: LngLat[],
  refCoords: LngLat[],
  endpointMaxMeters = 120,
  lengthRelTol = 0.22,
): boolean {
  if (userCoords.length < 2 || refCoords.length < 2) return false;
  const u0 = userCoords[0];
  const u1 = userCoords[userCoords.length - 1];
  const r0 = refCoords[0];
  const r1 = refCoords[refCoords.length - 1];
  if (getDistanceMeters(u0, r0) > endpointMaxMeters) return false;
  if (getDistanceMeters(u1, r1) > endpointMaxMeters) return false;
  const lenU = polylineLengthMeters(userCoords);
  const lenR = polylineLengthMeters(refCoords);
  if (lenR <= 0 || lenU <= 0) return false;
  return Math.abs(lenU - lenR) / lenR <= lengthRelTol;
}

export function getBasicHubCoursePayload(courseId: string): CourseRoutePayload {
  const course = BASIC_COURSES.find((c) => c.id === courseId);
  if (!course) {
    throw new Error(`BASIC_COURSES 에 없는 courseId: ${courseId}`);
  }
  const geom = course.geometry;
  if (!geom?.coordinates?.length) {
    throw new Error(`BASIC_COURSES 코스에 geometry 가 없습니다: ${courseId}`);
  }
  return {
    id: course.id,
    title: course.title,
    geometry: { type: "LineString", coordinates: [...geom.coordinates] },
    distanceMeters: course.distanceMeters,
    durationSec: course.durationSec,
    profile: course.profile ?? "cycling",
  };
}

export async function findPublishedPublicFingerprintsAmong(
  candidates: readonly string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const uniq = [...new Set(candidates.filter((f) => typeof f === "string" && f.length === 64))];
  if (uniq.length === 0) return out;
  const db = getFirebaseFirestore();
  const chunkSize = 30;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const qy = query(
      collection(db, ROUTE_PUBLICATIONS_COLLECTION),
      where("routeFingerprint", "in", chunk),
      where("status", "==", "published"),
      limit(chunkSize),
    );
    const snap = await getDocs(qy);
    snap.forEach((docSnap) => {
      const fp = (docSnap.data() as { routeFingerprint?: unknown }).routeFingerprint;
      if (typeof fp === "string" && chunk.includes(fp)) out.add(fp);
    });
  }
  return out;
}

export function getBasicStartCourseStatic(): CourseRoutePayload | null {
  if (BASIC_SHARED_HUB_IDS.length === 0) return null;
  return getBasicHubCoursePayload(BASIC_SHARED_HUB_IDS[0]!);
}

/** 지도 geometry 가 어느 입문 허브 코스와 일치하는지(없으면 null) */
export function matchBasicSharedHubCourseId(geometry: LineStringGeometry | null): string | null {
  if (!geometry?.coordinates?.length) return null;
  const userCoords = geometry.coordinates;
  for (const id of BASIC_SHARED_HUB_IDS) {
    const ref = getBasicHubCoursePayload(id).geometry.coordinates;
    if (coordinatesApproxEqual(userCoords, ref)) return id;
    if (hubGeometryLooseSameCourse(userCoords, ref)) return id;
  }
  return null;
}

/** 이미 선택된 허브 `courseId` 와 경로가 같은 코스로 볼 수 있는지(저장소 geometry 가 내장과 조금 달라도 유지) */
export function routeGeometryMatchesBasicSharedHub(
  courseId: string,
  geometry: LineStringGeometry | null,
): boolean {
  if (!geometry?.coordinates?.length) return false;
  if (!(BASIC_SHARED_HUB_IDS as readonly string[]).includes(courseId)) return false;
  const ref = getBasicHubCoursePayload(courseId as BasicSharedHubCourseId).geometry.coordinates;
  const userCoords = geometry.coordinates;
  return coordinatesApproxEqual(userCoords, ref) || hubGeometryLooseSameCourse(userCoords, ref);
}

/** 지도에 올린 경로가 입문 허브 코스(그린델발트 또는 아이슬란드 링 로드 등) 중 하나와 동일한지 */
export function isGeometryBasicStartHub(geometry: LineStringGeometry | null): boolean {
  return matchBasicSharedHubCourseId(geometry) !== null;
}

/** 세션 동안 `courses/{id}` getDoc 중복 방지(관전 등에서 동일 코스 반복 조회 시) */
const courseRoutePayloadMemoryCache = new Map<string, CourseRoutePayload | null>();
const courseRoutePayloadInflight = new Map<string, Promise<CourseRoutePayload | null>>();

function courseRoutePayloadFromPublication(
  pub: RoutePublicationRow,
): CourseRoutePayload | null {
  if (!pub.geometryCoordsJson) return null;
  const coordinates = coordinatesFromGeometryCoordsJson(pub.geometryCoordsJson);
  if (!coordinates || coordinates.length < 2) return null;
  return {
    id: pub.publicationId,
    title: pub.publicTitle,
    geometry: { type: "LineString", coordinates },
    distanceMeters: pub.snapshotDistanceMeters,
    durationSec: pub.snapshotDurationSec,
    profile: pub.snapshotProfile,
  };
}

async function fetchCourseRoutePayloadUncached(publicationId: string): Promise<CourseRoutePayload | null> {
  const pub = await findPublishedRoutePublicationById(publicationId);
  return pub ? courseRoutePayloadFromPublication(pub) : null;
}

export async function fetchCourseRoutePayload(publicationId: string): Promise<CourseRoutePayload | null> {
  const id = publicationId.trim();
  if (!id) return null;
  if (courseRoutePayloadMemoryCache.has(id)) {
    return courseRoutePayloadMemoryCache.get(id)!;
  }
  let inflight = courseRoutePayloadInflight.get(id);
  if (!inflight) {
    inflight = fetchCourseRoutePayloadUncached(id)
      .then((payload) => {
        courseRoutePayloadMemoryCache.set(id, payload);
        courseRoutePayloadInflight.delete(id);
        return payload;
      })
      .catch((e) => {
        courseRoutePayloadInflight.delete(id);
        throw e;
      });
    courseRoutePayloadInflight.set(id, inflight);
  }
  return inflight;
}

/**
 * 입문(Basic) 1/2/3 — 전부 `basicIntroHubRouteGeometries.ts` 의 실도로 seed 에서 파생한다.
 * 좌표를 여기서 손으로 고치지 말 것(허구 직선이 다시 들어온다). geometry 를 바꾸려면
 * `node scripts/gen-basic-intro-routes.mjs` 로 재생성한다.
 */
const BASIC_COURSES: Omit<CourseDoc, "createdAt" | "updatedAt">[] =
  BASIC_INTRO_HUB_ROUTE_SEEDS.map((seed) => ({
    id: seed.id,
    title: seed.title,
    description: seed.description,
    category: "basic" as const,
    type: "starter" as const,
    profile: seed.profile,
    isPublic: false,
    status: "published" as const,
    isRequired: true,
    requiredOrder: seed.order,
    distanceMeters: seed.distanceMeters,
    durationSec: seed.durationSec,
    bounds: seed.bounds,
    geometry: {
      type: "LineString" as const,
      coordinates: seed.coordinates.map(([lng, lat]): LngLat => [lng, lat]),
    },
    isSharedStartHub: true,
    presenceEnabled: true,
    createdBy: "system",
  }));

export type CourseBounds = CourseDoc["bounds"];

export function boundsCenterLngLat(bounds: CourseBounds): LngLat {
  return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
}

export function boundsFromLineStringGeometry(geometry: LineStringGeometry): CourseBounds | null {
  const coords = geometry.coordinates;
  if (coords.length < 1) return null;
  let minLng = coords[0]![0];
  let maxLng = minLng;
  let minLat = coords[0]![1];
  let maxLat = minLat;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

export function getBasicHubCourseBounds(courseId: string): CourseBounds | null {
  const course = BASIC_COURSES.find((c) => c.id === courseId);
  return course?.bounds ?? null;
}

const courseBoundsMemoryCache = new Map<string, CourseBounds | null>();
const courseBoundsInflight = new Map<string, Promise<CourseBounds | null>>();

async function fetchCourseBoundsUncached(publicationId: string): Promise<CourseBounds | null> {
  const basic = getBasicHubCourseBounds(publicationId);
  if (basic) return basic;

  const pub = await findPublishedRoutePublicationById(publicationId);
  if (pub?.geometryCoordsJson) {
    const coords = coordinatesFromGeometryCoordsJson(pub.geometryCoordsJson);
    if (coords?.length) {
      return boundsFromLineStringGeometry({ type: "LineString", coordinates: coords });
    }
  }
  return null;
}

/** Activity World DOT 앵커용 — geometry 전체 로드 없이 bounds 만 */
export async function fetchCourseBounds(publicationId: string): Promise<CourseBounds | null> {
  const id = publicationId.trim();
  if (!id) return null;
  if (courseBoundsMemoryCache.has(id)) return courseBoundsMemoryCache.get(id)!;

  let pending = courseBoundsInflight.get(id);
  if (!pending) {
    pending = fetchCourseBoundsUncached(id)
      .then((bounds) => {
        courseBoundsMemoryCache.set(id, bounds);
        courseBoundsInflight.delete(id);
        return bounds;
      })
      .catch((e) => {
        courseBoundsInflight.delete(id);
        throw e;
      });
    courseBoundsInflight.set(id, pending);
  }
  return pending;
}

/**
 * 입문 경로 목록(패널·모달)용 요약 — `BASIC_SHARED_HUB_IDS` 를 `BASIC_COURSES` 에서 파생한다.
 * 하드코딩하지 않아 제목·거리·시간이 코스 정의와 항상 일치한다. seed 는 `routePublications/{id}`
 * 에 `id === course.id` 로 심으므로 publicationId 도 동일하다.
 */
export const BASIC_SHARED_HUB_SUMMARIES: PublishedPublicCourseSummary[] = BASIC_SHARED_HUB_IDS.map(
  (id): PublishedPublicCourseSummary => {
    const payload = getBasicHubCoursePayload(id);
    return {
      id: payload.id,
      title: payload.title,
      profile: payload.profile,
      distanceMeters: payload.distanceMeters,
      durationSec: payload.durationSec,
      routeId: payload.id,
      publicationId: payload.id,
    };
  },
);

export function getBasicSharedHubSummaries(): PublishedPublicCourseSummary[] {
  return BASIC_SHARED_HUB_SUMMARIES;
}

/**
 * publication — `routePublications/{id}` 에 presence 허용 플래그 merge.
 */
export async function ensureBasicSharedHubPresenceFlagsMerged(publicationId: string): Promise<void> {
  if (!(BASIC_SHARED_HUB_IDS as readonly string[]).includes(publicationId)) {
    return;
  }
  await mergePublicationPresenceEnabled(publicationId);
}

/** @deprecated {@link ensurePublicationPresenceFlagsMerged} */
export async function ensureCoursePresenceFlagsMerged(publicationId: string): Promise<void> {
  await ensurePublicationPresenceFlagsMerged(publicationId);
}

export async function ensurePublicationPresenceFlagsMerged(publicationId: string): Promise<void> {
  if ((BASIC_SHARED_HUB_IDS as readonly string[]).includes(publicationId)) {
    await ensureBasicSharedHubPresenceFlagsMerged(publicationId);
    return;
  }
  await mergePublicationPresenceEnabled(publicationId);
}

/**
 * 입문 허브 publication 시드.
 *
 * ⚠ 문서가 있으면 무조건 건너뛰던 예전 동작은 geometry 를 바꿔도 Firestore 에 옛 좌표가
 * 남는 함정이었다. 이제 `basicSeedRevision` 이 현재 seed 리비전과 다르면 다시 쓴다.
 *
 * ⚠ 프로덕션 `firestore.rules` 는 `routePublications` create 를 `isRouteReviewer()` 로,
 * update 를 `presenceEnabled`/`updatedAt` 로만 허용한다. 즉 일반 사용자·Guest 세션에서는
 * 이 함수가 geometry 를 만들거나 고칠 수 없고, 실패해도 앱은 로컬 `BASIC_COURSES` 로 주행한다.
 * 프로덕션 Firestore 를 실제로 맞추는 것은 Admin SDK 마이그레이션의 몫이다:
 *   npm run admin:seed-basic-intro-publications -- --dry-run
 */
export async function ensureBasicCoursesSeeded(_currentUserId?: string): Promise<void> {
  const db = getFirebaseFirestore();

  for (const course of BASIC_COURSES) {
    const pubRef = doc(db, ROUTE_PUBLICATIONS_COLLECTION, course.id);
    const snap = await getDoc(pubRef);
    if (snap.exists()) {
      const seeded = (snap.data() as { basicSeedRevision?: unknown }).basicSeedRevision;
      if (seeded === BASIC_INTRO_HUB_ROUTE_REVISION) continue;
    }
    const geometry = course.geometry;
    if (!geometry) continue;
    const profile = course.profile ?? "cycling";
    const routeFingerprint = await computeRouteFingerprint(
      { type: "LineString", coordinates: geometry.coordinates },
      profile,
    );
    await setDoc(
      pubRef,
      {
        routeId: course.id,
        courseId: course.id,
        publicTitle: course.title,
        publicSummary: course.description ?? null,
        status: "published",
        revision: 1,
        basicSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
        routeFingerprint,
        geometryCoordsJson: JSON.stringify(geometry.coordinates),
        snapshotProfile: profile,
        snapshotDistanceMeters: course.distanceMeters,
        snapshotDurationSec: course.durationSec,
        applicantUid: "",
        sourcePublicRouteRequestId: "",
        presenceEnabled: course.presenceEnabled === true || course.isSharedStartHub === true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  for (const hubId of BASIC_SHARED_HUB_IDS) {
    await ensureBasicSharedHubPresenceFlagsMerged(hubId).catch(() => {
      /* 권한 등으로 실패해도 앱 동작 유지 */
    });
  }
}
