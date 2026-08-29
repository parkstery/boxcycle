import type { LineStringGeometry, LngLat } from "./geo";
import type { RouteProfile } from "../services/mapboxDirections";
import { MAX_ROUTE_WAYPOINTS } from "./routeWaypoints";
import {
  SAVED_ROUTE_EXPIRY_MS,
  SAVED_ROUTE_MAX_COORDS,
  SavedRouteValidationError,
  validateSavedRouteName,
  type SavedRoute,
  type SaveRouteInput,
} from "./firestoreSavedRoutes";
import { computeRouteFingerprint } from "./routeFingerprint";
import { clampProgressRatio, resolveSavedRouteProgressUpdate } from "./savedRouteProgressPolicy";

const STORAGE_KEY = "boxcycle_web_saved_routes_v1";

type Stored = SavedRoute;

function readAll(): Stored[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Stored => isValidStored(x))
      .map(hydrateLegacy);
  } catch {
    return [];
  }
}

/** 옛 로컬 데이터(필드 없음)에 안전 기본값을 채워 신규 모델로 정렬. */
function hydrateLegacy(r: Stored): Stored {
  return {
    ...r,
    waypoints: Array.isArray(r.waypoints) ? r.waypoints : [],
    completed: r.completed === 1 ? 1 : 0,
    completedAtIso: r.completedAtIso ?? null,
    expiresAtIso: r.expiresAtIso ?? null,
    lastRideId: r.lastRideId ?? null,
    lastProgressRatio:
      typeof r.lastProgressRatio === "number" && Number.isFinite(r.lastProgressRatio)
        ? Math.max(0, Math.min(1, r.lastProgressRatio))
        : 0,
  };
}

function isValidStored(x: unknown): x is Stored {
  if (!x || typeof x !== "object") return false;
  const r = x as Partial<Stored>;
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    !Array.isArray(r.startLngLat) ||
    !Array.isArray(r.endLngLat) ||
    r.geometry?.type !== "LineString" ||
    !Array.isArray(r.geometry.coordinates) ||
    typeof r.distanceMeters !== "number" ||
    typeof r.durationSec !== "number"
  ) {
    return false;
  }
  const wp = r.waypoints;
  if (wp === undefined) return true;
  if (!Array.isArray(wp) || wp.length > 3) return false;
  return wp.every(
    (c) =>
      Array.isArray(c) &&
      c.length === 2 &&
      typeof c[0] === "number" &&
      typeof c[1] === "number" &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]),
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
  purgeExpiredLocalRoutes();
  return [...readAll()].sort((a, b) =>
    b.updatedAtIso.localeCompare(a.updatedAtIso),
  );
}

export async function saveRouteToLocal(input: {
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  waypoints?: LngLat[];
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
}): Promise<SavedRoute> {
  const name = validateSavedRouteName(input.name);
  validateGeometryLocal(input.geometry);
  const fp = await computeRouteFingerprint(input.geometry, input.profile);
  const now = new Date();
  const nowIso = now.toISOString();
  // 같은 경로가 이미 있으면 새로 만들지 않고 기존 항목의 갱신 시각만 올린다(중복 저장 방지).
  const existingList = readAll();
  for (const existing of existingList) {
    const efp = await computeRouteFingerprint(existing.geometry, existing.profile);
    if (efp === fp) {
      const updated: SavedRoute = { ...existing, updatedAtIso: nowIso };
      writeAll(existingList.map((r) => (r.id === existing.id ? updated : r)));
      return updated;
    }
  }
  const item: SavedRoute = {
    id: genId(),
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    waypoints: (input.waypoints ?? []).slice(0, MAX_ROUTE_WAYPOINTS),
    geometry: input.geometry,
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    completed: 0,
    completedAtIso: null,
    expiresAtIso: new Date(now.getTime() + SAVED_ROUTE_EXPIRY_MS).toISOString(),
    lastRideId: null,
    lastProgressRatio: 0,
  };
  const items = readAll();
  items.unshift(item);
  writeAll(items);
  return item;
}

/**
 * 게스트(로컬) 사용자 경로 격상 — 주행 완료 시 호출.
 * 게스트는 Firestore TTL 영향을 받지 않지만, 로그인 후 마이그레이션 시 동일 의미가 유지된다.
 */
export function promoteSavedRouteInLocal(input: {
  routeId: string;
  rideId: string;
}): void {
  const items = readAll();
  const idx = items.findIndex((r) => r.id === input.routeId);
  if (idx < 0) return;
  const now = new Date().toISOString();
  items[idx] = {
    ...items[idx],
    completed: 1,
    completedAtIso: now,
    expiresAtIso: null,
    lastRideId: input.rideId,
    lastProgressRatio: 1,
    updatedAtIso: now,
  };
  writeAll(items);
}

/**
 * 게스트(로컬) 미완주 진행률 갱신 — 완주 임계 미만 종료 시 호출(§9.5.5 단위7).
 * completed 는 건드리지 않고 진행률·lastRideId 만. 규칙은 Firestore transaction 과 **동일**하다
 * (`resolveSavedRouteProgressUpdate`) — 최대 도달점 유지, 완주 문서는 되돌리지 않음,
 * stale(더 낮은) 갱신은 `lastRideId` 도 덮지 않음(§4.4).
 */
export function updateSavedRouteProgressInLocal(input: {
  routeId: string;
  rideId: string;
  progressRatio: number;
}): { progressRatio: number; completed: 0 | 1 } {
  const items = readAll();
  const idx = items.findIndex((r) => r.id === input.routeId);
  if (idx < 0) {
    return { progressRatio: clampProgressRatio(input.progressRatio), completed: 0 };
  }
  const prev = items[idx];
  const decision = resolveSavedRouteProgressUpdate(
    { completed: prev.completed === 1 ? 1 : 0, lastProgressRatio: prev.lastProgressRatio },
    input.progressRatio,
  );
  if (!decision.shouldWrite) {
    return { progressRatio: decision.nextProgressRatio, completed: decision.completed };
  }
  items[idx] = {
    ...prev,
    lastRideId: input.rideId,
    lastProgressRatio: decision.nextProgressRatio,
    updatedAtIso: new Date().toISOString(),
  };
  writeAll(items);
  return { progressRatio: decision.nextProgressRatio, completed: decision.completed };
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

/**
 * 만료된 로컬(게스트) 사용자 경로 정리. 로그인 사용자의 Firestore TTL 과 동등한 효과.
 * `loadSavedRoutesFromLocal` 호출 시점에 lazy 로 1회 수행한다.
 */
export function purgeExpiredLocalRoutes(now: number = Date.now()): number {
  const items = readAll();
  const next = items.filter((r) => {
    if (r.completed === 1) return true;
    if (!r.expiresAtIso) return true;
    const t = Date.parse(r.expiresAtIso);
    return Number.isFinite(t) ? t > now : true;
  });
  if (next.length !== items.length) writeAll(next);
  return items.length - next.length;
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
    waypoints: r.waypoints?.length ? r.waypoints : undefined,
    geometry: r.geometry,
    distanceMeters: r.distanceMeters,
    durationSec: r.durationSec,
  }));
}
