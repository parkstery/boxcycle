import type { LineStringGeometry, LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";
import {
  SAVED_ROUTE_MAX_COORDS,
  SavedRouteValidationError,
  validateSavedRouteName,
  type SavedRoute,
  type SaveRouteInput,
} from "./firestoreSavedRoutes";

const STORAGE_KEY = "boxcycle_web_saved_routes_v1";

type Stored = SavedRoute;

function readAll(): Stored[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is Stored => isValidStored(x));
  } catch {
    return [];
  }
}

function isValidStored(x: unknown): x is Stored {
  if (!x || typeof x !== "object") return false;
  const r = x as Partial<Stored>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    Array.isArray(r.startLngLat) &&
    Array.isArray(r.endLngLat) &&
    r.geometry?.type === "LineString" &&
    Array.isArray(r.geometry.coordinates) &&
    typeof r.distanceMeters === "number" &&
    typeof r.durationSec === "number"
  );
}

function writeAll(items: Stored[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateGeometryLocal(geometry: LineStringGeometry): void {
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
      `경로 좌표가 너무 많습니다(최대 ${SAVED_ROUTE_MAX_COORDS}점).`,
    );
  }
}

export function loadSavedRoutesFromLocal(): SavedRoute[] {
  return [...readAll()].sort((a, b) =>
    b.updatedAtIso.localeCompare(a.updatedAtIso),
  );
}

export function saveRouteToLocal(input: {
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
}): SavedRoute {
  const name = validateSavedRouteName(input.name);
  validateGeometryLocal(input.geometry);
  const now = new Date().toISOString();
  const item: SavedRoute = {
    id: genId(),
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    geometry: input.geometry,
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    createdAtIso: now,
    updatedAtIso: now,
  };
  const items = readAll();
  items.unshift(item);
  writeAll(items);
  return item;
}

export function renameSavedRouteInLocal(routeId: string, newName: string): string {
  const name = validateSavedRouteName(newName);
  const items = readAll();
  const idx = items.findIndex((r) => r.id === routeId);
  if (idx < 0) throw new SavedRouteValidationError("해당 경로를 찾을 수 없습니다.");
  items[idx] = { ...items[idx], name, updatedAtIso: new Date().toISOString() };
  writeAll(items);
  return name;
}

export function deleteSavedRouteFromLocal(routeId: string): void {
  const items = readAll().filter((r) => r.id !== routeId);
  writeAll(items);
}

export function clearSavedRoutesLocal(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Firestore 마이그레이션용 — 로컬 항목을 SaveRouteInput 배열로 변환(userId 는 호출자가 채움). */
export function exportLocalRoutesForMigration(): Omit<SaveRouteInput, "userId">[] {
  return readAll().map((r) => ({
    name: r.name,
    profile: r.profile,
    startLngLat: r.startLngLat,
    endLngLat: r.endLngLat,
    geometry: r.geometry,
    distanceMeters: r.distanceMeters,
    durationSec: r.durationSec,
  }));
}
