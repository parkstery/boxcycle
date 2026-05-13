import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { getDistanceMeters, type LineStringGeometry, type LngLat } from "./geo";

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

/** 동시 주행 presence 가 분리되는 입문 허브 코스 (테스트: A/B → 코스 1, C/D → 코스 2) */
export const BASIC_HUB_COURSE_1_ID = "basic-alps-grindelwald-5km" as const;
export const BASIC_HUB_COURSE_2_ID = "basic-iceland-ring-road-5km" as const;

export const BASIC_SHARED_HUB_IDS = [
  BASIC_HUB_COURSE_1_ID,
  BASIC_HUB_COURSE_2_ID,
] as const;

export type BasicSharedHubCourseId = (typeof BASIC_SHARED_HUB_IDS)[number];

/** 하위 호환: 입문 허브 코스 1과 동일 */
export const BASIC_START_COURSE_ID = BASIC_HUB_COURSE_1_ID;

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
  id: string;
  title: string;
  profile: CourseProfile;
  distanceMeters: number;
  durationSec: number;
};

function parseCourseProfile(raw: Record<string, unknown>): CourseProfile {
  const p = raw.profile;
  return p === "cycling" || p === "driving" || p === "walking" ? p : "cycling";
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

function parseCourseRoutePayload(id: string, raw: Record<string, unknown>): CourseRoutePayload | null {
  const title = typeof raw.title === "string" ? raw.title : null;
  if (!title) return null;

  let coordinates: LngLat[] | null = null;
  const jsonField = raw.geometryCoordsJson;
  if (typeof jsonField === "string" && jsonField.length > 0) {
    coordinates = coordinatesFromGeometryCoordsJson(jsonField);
  }
  if (!coordinates) {
    const geom = raw.geometry as Record<string, unknown> | undefined;
    const coords = geom?.coordinates;
    if (geom?.type !== "LineString" || !Array.isArray(coords)) return null;
    coordinates = [];
    for (const c of coords) {
      if (!isLngLatPair(c)) return null;
      coordinates.push(c);
    }
  }
  if (coordinates.length < 2) return null;

  const distanceMeters = typeof raw.distanceMeters === "number" ? raw.distanceMeters : Number.NaN;
  const durationSec = typeof raw.durationSec === "number" ? raw.durationSec : Number.NaN;
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSec)) return null;
  return {
    id,
    title,
    geometry: { type: "LineString", coordinates },
    distanceMeters,
    durationSec,
    profile: parseCourseProfile(raw),
  };
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

/**
 * 심사 승인 등으로 등록된 퍼블릭 코스(`category`·`visibility`·`status` 일치) 목록.
 * Firestore 복합 쿼리 인덱스 필요 — `firestore.indexes.json` 참고.
 */
export async function listPublishedPublicCourses(max = 40): Promise<PublishedPublicCourseSummary[]> {
  const db = getFirestore(getFirebaseApp());
  const qy = query(
    collection(db, "courses"),
    where("category", "==", "public"),
    where("visibility", "==", "public"),
    where("status", "==", "published"),
    limit(Math.min(80, Math.max(1, max))),
  );
  const snap = await getDocs(qy);
  const rows: PublishedPublicCourseSummary[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (typeof data.title !== "string" || data.title.length < 1) continue;
    rows.push({
      id: d.id,
      title: data.title,
      profile: parseCourseProfile(data),
      distanceMeters: typeof data.distanceMeters === "number" ? data.distanceMeters : 0,
      durationSec: typeof data.durationSec === "number" ? data.durationSec : 0,
    });
  }
  rows.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  return rows;
}

export function getBasicStartCourseStatic(): CourseRoutePayload {
  return getBasicHubCoursePayload(BASIC_START_COURSE_ID);
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

export async function fetchCourseRoutePayload(courseId: string): Promise<CourseRoutePayload | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return parseCourseRoutePayload(courseId, data);
}

const BASIC_COURSES: Omit<CourseDoc, "createdAt" | "updatedAt">[] = [
  {
    id: "basic-mountain-0_5km",
    title: "Basic 1 · Mountain Intro (0.5km)",
    description: "완만한 산악 입문 코스. 조향과 카메라 적응을 위한 0.5km.",
    category: "basic",
    type: "starter",
    profile: "cycling",
    isPublic: false,
    status: "published",
    isRequired: true,
    requiredOrder: 1,
    distanceMeters: 500,
    durationSec: 120,
    bounds: {
      minLng: 127.0836,
      minLat: 37.5378,
      maxLng: 127.0882,
      maxLat: 37.5408,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [127.0836, 37.5382],
        [127.0846, 37.5391],
        [127.0862, 37.5401],
        [127.0882, 37.5408],
      ],
    },
    createdBy: "system",
  },
  {
    id: "basic-coastal-1_0km",
    title: "Basic 2 · Coastal Tempo (1.0km)",
    description: "해안선 느낌의 중간 길이 코스. 리듬 유지 훈련용 1.0km.",
    category: "basic",
    type: "starter",
    profile: "cycling",
    isPublic: false,
    status: "published",
    isRequired: true,
    requiredOrder: 2,
    distanceMeters: 1000,
    durationSec: 240,
    bounds: {
      minLng: 126.5571,
      minLat: 37.3738,
      maxLng: 126.5649,
      maxLat: 37.3772,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [126.5571, 37.3738],
        [126.5597, 37.3749],
        [126.5624, 37.3761],
        [126.5649, 37.3772],
      ],
    },
    createdBy: "system",
  },
  {
    id: "basic-mountain-1_5km",
    title: "Basic 3 · Ridge Climb (1.5km)",
    description: "능선 구간을 모사한 1.5km 기본 코스. 초반 인증용 최종 단계.",
    category: "basic",
    type: "starter",
    profile: "cycling",
    isPublic: false,
    status: "published",
    isRequired: true,
    requiredOrder: 3,
    distanceMeters: 1500,
    durationSec: 360,
    bounds: {
      minLng: 127.0068,
      minLat: 37.6468,
      maxLng: 127.0159,
      maxLat: 37.6526,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [127.0068, 37.6468],
        [127.0096, 37.6486],
        [127.0128, 37.6504],
        [127.0159, 37.6526],
      ],
    },
    createdBy: "system",
  },
  {
    id: "basic-alps-grindelwald-5km",
    title: "입문 코스 1 · 그린델발트 계곡 (5km)",
    description:
      "스위스 베른주 그린델발트 인근 루치네 계곡을 따라가는 약 5km 산악·알프스 풍경 코스.",
    category: "basic",
    type: "starter",
    profile: "cycling",
    isPublic: false,
    status: "published",
    isRequired: true,
    requiredOrder: 4,
    isSharedStartHub: true,
    presenceEnabled: true,
    distanceMeters: 5000,
    durationSec: 1200,
    bounds: {
      minLng: 8.018,
      minLat: 46.612,
      maxLng: 8.056,
      maxLat: 46.654,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [8.0185, 46.6128],
        [8.0262, 46.6194],
        [8.0338, 46.6261],
        [8.0412, 46.6325],
        [8.0486, 46.6392],
        [8.0554, 46.6465],
        [8.0528, 46.6532],
      ],
    },
    createdBy: "system",
  },
  {
    id: "basic-iceland-ring-road-5km",
    title: "입문 코스 2 · 아이슬란드 링 로드 (5km)",
    description:
      "아이슬란드 남부 국도 1호선(링 로드) 인근 구간을 모티브로 한 약 5km 해안·화산 지대 풍경 코스.",
    category: "basic",
    type: "starter",
    profile: "cycling",
    isPublic: false,
    status: "published",
    isRequired: true,
    requiredOrder: 5,
    isSharedStartHub: true,
    presenceEnabled: true,
    distanceMeters: 5000,
    durationSec: 1200,
    bounds: {
      minLng: -20.02,
      minLat: 63.61,
      maxLng: -19.87,
      maxLat: 63.66,
    },
    geometry: {
      type: "LineString",
      coordinates: [
        [-19.9886, 63.6155],
        [-19.972, 63.619],
        [-19.9555, 63.6225],
        [-19.939, 63.626],
        [-19.9225, 63.6295],
        [-19.906, 63.633],
        [-19.8895, 63.6365],
      ],
    },
    createdBy: "system",
  },
];

export const BASIC_SHARED_HUB_SUMMARIES: { id: string; title: string }[] = BASIC_SHARED_HUB_IDS.map(
  (id) => {
    const course = BASIC_COURSES.find((c) => c.id === id)!;
    return { id, title: course.title };
  },
);

export function getBasicSharedHubSummaries(): { id: string; title: string }[] {
  return BASIC_SHARED_HUB_SUMMARIES;
}

/**
 * 입문 허브 `courses/{id}` 에 presence 허용 플래그를 merge 한다.
 * 기존 문서에 필드가 없을 때 Rules 가 coursePresence 를 막는 문제를 막기 위해,
 * 동행 UI 마운트 직전에도 호출한다.
 */
export async function ensureBasicSharedHubPresenceFlagsMerged(courseId: string): Promise<void> {
  if (!(BASIC_SHARED_HUB_IDS as readonly string[]).includes(courseId)) {
    return;
  }
  const db = getFirestore(getFirebaseApp());
  await setDoc(
    doc(db, "courses", courseId),
    {
      isSharedStartHub: true,
      presenceEnabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function ensureBasicCoursesSeeded(currentUserId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());

  for (const course of BASIC_COURSES) {
    const ref = doc(db, "courses", course.id);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    const now = serverTimestamp();
    const { geometry, ...courseRest } = course;
    if (!geometry) continue;
    await setDoc(ref, {
      ...courseRest,
      geometryCoordsJson: JSON.stringify(geometry.coordinates),
      createdBy: currentUserId || "system",
      createdAt: now,
      updatedAt: now,
      seededAt: Timestamp.now(),
    } satisfies CourseDoc & { seededAt: Timestamp });
  }

  for (const hubId of BASIC_SHARED_HUB_IDS) {
    await ensureBasicSharedHubPresenceFlagsMerged(hubId).catch(() => {
      /* 기존 환경에서 권한 등으로 실패해도 앱 동작 유지 */
    });
  }
}
