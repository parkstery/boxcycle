import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LineStringGeometry, LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";

const SAVED_ROUTES_COLLECTION = "savedRoutes";

/** 사용자에게 노출하는 저장 경로 모델(클라이언트). createdAt 은 ISO 문자열로 정규화. */
export type SavedRoute = {
  id: string;
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  createdAtIso: string;
  updatedAtIso: string;
};

/** Firestore 문서 한도(1MB) 의 안전 가드. 일반 자전거 경로는 ~수만 좌표 미만. */
export const SAVED_ROUTE_MAX_COORDS = 5000;
export const SAVED_ROUTE_NAME_MIN = 1;
export const SAVED_ROUTE_NAME_MAX = 40;

export class SavedRouteValidationError extends Error {
  readonly code = "saved-route-invalid" as const;
  constructor(message: string) {
    super(message);
    this.name = "SavedRouteValidationError";
  }
}

export function normalizeSavedRouteName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function validateSavedRouteName(name: string): string {
  const normalized = normalizeSavedRouteName(name);
  if (normalized.length < SAVED_ROUTE_NAME_MIN) {
    throw new SavedRouteValidationError("경로 이름을 입력하세요.");
  }
  if (normalized.length > SAVED_ROUTE_NAME_MAX) {
    throw new SavedRouteValidationError(
      `경로 이름은 ${SAVED_ROUTE_NAME_MAX}자 이내로 입력하세요.`,
    );
  }
  return normalized;
}

function validateGeometry(geometry: LineStringGeometry): void {
  if (
    !geometry ||
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    throw new SavedRouteValidationError("저장할 경로 정보가 올바르지 않습니다.");
  }
  if (geometry.coordinates.length > SAVED_ROUTE_MAX_COORDS) {
    throw new SavedRouteValidationError(
      `경로 좌표가 너무 많습니다(최대 ${SAVED_ROUTE_MAX_COORDS}점). 짧은 구간으로 나눠 저장하세요.`,
    );
  }
}

/**
 * Firestore 는 배열 안에 배열(중첩 배열)을 둘 수 없습니다.
 * GeoJSON LineString 의 `coordinates: [lng,lat][]` 는 JSON 문자열로만 저장합니다.
 * `startLngLat` / `endLngLat` 는 길이 2의 숫자 배열이라 허용됩니다.
 */
function encodeGeometryForFirestore(geometry: LineStringGeometry): {
  geometryType: "LineString";
  geometryCoordsJson: string;
} {
  return {
    geometryType: "LineString",
    geometryCoordsJson: JSON.stringify(geometry.coordinates),
  };
}

function decodeGeometryFromFirestore(data: Record<string, unknown>): LineStringGeometry | null {
  const json = data.geometryCoordsJson;
  if (typeof json === "string" && json.length > 0) {
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
  /** 구버전(실패한 쓰기는 없었을 수 있음): 직렬화 없이 geometry 필드만 있는 경우 */
  const legacy = data.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (
    legacy?.type === "LineString" &&
    Array.isArray(legacy.coordinates) &&
    legacy.coordinates.length >= 2
  ) {
    const coords = legacy.coordinates;
    const ok = coords.every(
      (c) =>
        Array.isArray(c) &&
        c.length === 2 &&
        typeof c[0] === "number" &&
        typeof c[1] === "number",
    );
    if (ok) return { type: "LineString", coordinates: coords as [number, number][] };
  }
  return null;
}

type SavedRouteDoc = {
  userId: string;
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  geometryType?: "LineString";
  geometryCoordsJson?: string;
  geometry?: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  source: "web";
  createdAt: unknown;
  updatedAt: unknown;
};

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function fromDoc(id: string, data: Partial<SavedRouteDoc>): SavedRoute | null {
  if (!data || typeof data.name !== "string" || !Array.isArray(data.startLngLat) || !Array.isArray(data.endLngLat)) {
    return null;
  }
  const geometry = decodeGeometryFromFirestore(data as Record<string, unknown>);
  if (!geometry) return null;
  return {
    id,
    name: data.name,
    profile: (data.profile ?? "cycling") as RouteProfile,
    startLngLat: data.startLngLat as LngLat,
    endLngLat: data.endLngLat as LngLat,
    geometry,
    distanceMeters: Number(data.distanceMeters ?? 0),
    durationSec: Number(data.durationSec ?? 0),
    createdAtIso: toIso(data.createdAt),
    updatedAtIso: toIso(data.updatedAt),
  };
}

export type SaveRouteInput = {
  userId: string;
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
};

export async function saveRouteToFirestore(input: SaveRouteInput): Promise<SavedRoute> {
  const name = validateSavedRouteName(input.name);
  validateGeometry(input.geometry);

  const db = getFirestore(getFirebaseApp());
  const payload = {
    userId: input.userId,
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    ...encodeGeometryForFirestore(input.geometry),
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    source: "web" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, SAVED_ROUTES_COLLECTION), payload);
  return {
    id: ref.id,
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    geometry: input.geometry,
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  };
}

export async function loadSavedRoutesFromFirestore(
  userId: string,
  limitCount = 50,
): Promise<SavedRoute[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, SAVED_ROUTES_COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  const out: SavedRoute[] = [];
  for (const d of snap.docs) {
    const route = fromDoc(d.id, d.data() as Partial<SavedRouteDoc>);
    if (route) out.push(route);
  }
  return out;
}

export async function renameSavedRouteInFirestore(
  userId: string,
  routeId: string,
  newName: string,
): Promise<string> {
  const name = validateSavedRouteName(newName);
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, SAVED_ROUTES_COLLECTION, routeId), {
    userId,
    name,
    updatedAt: serverTimestamp(),
  });
  return name;
}

export async function deleteSavedRouteFromFirestore(routeId: string): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await deleteDoc(doc(db, SAVED_ROUTES_COLLECTION, routeId));
}

/**
 * 게스트(localStorage) → Google 로그인(Firestore) 1회 마이그레이션.
 * 입력으로 들어온 로컬 경로 배열을 순서대로 저장하고, 새 SavedRoute 목록을 돌려준다.
 * 호출자(App.tsx)가 성공한 경우에만 로컬 저장소를 비운다.
 */
export async function migrateLocalRoutesToFirestore(input: {
  userId: string;
  routes: SaveRouteInput[];
}): Promise<SavedRoute[]> {
  const created: SavedRoute[] = [];
  for (const r of input.routes) {
    try {
      const saved = await saveRouteToFirestore({ ...r, userId: input.userId });
      created.push(saved);
    } catch {
      // 한 건 실패해도 나머지는 계속 시도
    }
  }
  return created;
}
