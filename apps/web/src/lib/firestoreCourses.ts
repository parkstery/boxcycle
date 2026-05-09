import {
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LineStringGeometry, LngLat } from "./geo";

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
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  /** 상시 입문 허브(공개 읽기·동시 주행 presence 등) */
  isSharedStartHub?: boolean;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
};

/** 입문자용 상시 개방 주행 코스 ID (Basic 4 · Grindelwald 5km) */
export const BASIC_START_COURSE_ID = "basic-alps-grindelwald-5km" as const;

export type CourseRoutePayload = {
  id: string;
  title: string;
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
};

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

function parseCourseRoutePayload(id: string, raw: Record<string, unknown>): CourseRoutePayload | null {
  const title = typeof raw.title === "string" ? raw.title : null;
  const geom = raw.geometry as Record<string, unknown> | undefined;
  const coords = geom?.coordinates;
  if (!title || geom?.type !== "LineString" || !Array.isArray(coords)) return null;
  const coordinates: LngLat[] = [];
  for (const c of coords) {
    if (!isLngLatPair(c)) return null;
    coordinates.push(c);
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
  };
}

export function getBasicStartCourseStatic(): CourseRoutePayload {
  const course = BASIC_COURSES.find((c) => c.id === BASIC_START_COURSE_ID);
  if (!course) {
    throw new Error("BASIC_START_COURSE_ID 가 BASIC_COURSES 에 없습니다.");
  }
  return {
    id: course.id,
    title: course.title,
    geometry: { type: "LineString", coordinates: [...course.geometry.coordinates] },
    distanceMeters: course.distanceMeters,
    durationSec: course.durationSec,
  };
}

/** 지도에 올린 경로가 입문 상시 코스(그린델발트 5km)와 동일한 geometry 인지 */
export function isGeometryBasicStartHub(geometry: LineStringGeometry | null): boolean {
  if (!geometry?.coordinates?.length) return false;
  const ref = getBasicStartCourseStatic().geometry.coordinates;
  if (geometry.coordinates.length !== ref.length) return false;
  /** Firestore·Mapbox 반올림으로 좌표가 조금 달라도 같은 코스로 본다 (~20m) */
  const eps = 2e-4;
  for (let i = 0; i < ref.length; i++) {
    const a = geometry.coordinates[i];
    const b = ref[i];
    if (Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps) return false;
  }
  return true;
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
    title: "Basic 4 · Grindelwald Valley (5km)",
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
];

export async function ensureBasicCoursesSeeded(currentUserId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());

  for (const course of BASIC_COURSES) {
    const ref = doc(db, "courses", course.id);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    const now = serverTimestamp();
    await setDoc(ref, {
      ...course,
      createdBy: currentUserId || "system",
      createdAt: now,
      updatedAt: now,
      seededAt: Timestamp.now(),
    } satisfies CourseDoc & { seededAt: Timestamp });
  }

  await setDoc(
    doc(db, "courses", BASIC_START_COURSE_ID),
    {
      isSharedStartHub: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => {
    /* 기존 환경에서 권한 등으로 실패해도 앱 동작 유지 */
  });
}
