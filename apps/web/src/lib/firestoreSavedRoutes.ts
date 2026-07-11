import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  increment,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LineStringGeometry, LngLat } from "./geo";
import type { User } from "firebase/auth";
import type { RouteProfile } from "../services/mapboxDirections";
import { assertTierQuotaClient } from "./tierQuota";
import { MAX_ROUTE_WAYPOINTS } from "./routeWaypoints";
import { computeRouteFingerprint } from "./routeFingerprint";

export const SAVED_ROUTES_COLLECTION = "savedRoutes";

/**
 * 사용자 경로 TTL 정책.
 * - 신규 저장 시 expiresAt = createdAt + 90일 (미완료 장기 프로젝트 보관 — §9.5, 2026-07-07 7일→90일)
 * - 주행 완료(격상) 시 expiresAt = null 로 비워 영구 보존
 * - 실제 삭제는 Firebase Console 의 TTL 정책(컬렉션 `savedRoutes` · 필드 `expiresAt`) 이 수행
 */
export const SAVED_ROUTE_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 사용자에게 노출하는 사용자 경로 모델(클라이언트). createdAt 등은 ISO 문자열로 정규화.
 *
 * `completed` 플래그 (시니어 명세):
 *   0 = 미주행(대기 · 7일 후 자동 삭제 대상)
 *   1 = 주행 완료(영구 보존 · 「완주 경로」 로 격상)
 *
 * 기존(필드 없음) 문서는 fromDoc 단계에서 안전 기본값으로 폴백한다.
 */
export type SavedRoute = {
  id: string;
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  /** 출발·도착 사이 경유지(최대 3). 옛 문서는 빈 배열로 폴백 */
  waypoints: LngLat[];
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  createdAtIso: string;
  updatedAtIso: string;
  /** 0=미주행 / 1=주행완료(격상). 옛 문서는 0 으로 폴백. */
  completed: 0 | 1;
  /** 격상 시각(ISO). 미주행이면 null. */
  completedAtIso: string | null;
  /** TTL 만료 시각(ISO). 격상되면 null. 옛 문서는 null 폴백 → 자동 삭제 대상 아님. */
  expiresAtIso: string | null;
  /** 가장 최근 격상을 일으킨 rides 문서 ID. 추적·역참조용. */
  lastRideId: string | null;
  /** 마지막 주행의 진행률(0..1). 미완료 「이어 달리기」·진행률 바용. 옛 문서·미주행은 0. */
  lastProgressRatio: number;
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

/**
 * 같은 경로가 이미 저장돼 있어 사용자 확인이 필요할 때 던진다.
 * UI 는 이 에러를 잡아 "업데이트하시겠습니까?" 프롬프트를 띄우고,
 * 「예」면 confirmUpdate=true 로 재저장한다.
 */
export class SavedRouteDuplicateError extends Error {
  readonly code = "saved-route-duplicate" as const;
  /** 갱신 대상 기존 문서 id */
  readonly existingId: string;
  constructor(existingId: string, message = "이미 저장된 경로입니다. 업데이트하시겠습니까?") {
    super(message);
    this.name = "SavedRouteDuplicateError";
    this.existingId = existingId;
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

function decodeWaypointsFromFirestore(data: Record<string, unknown>): LngLat[] {
  const raw = data.waypointsLngLat;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: LngLat[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lng = Number(o.lng);
    const lat = Number(o.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue;
    out.push([lng, lat]);
    if (out.length >= MAX_ROUTE_WAYPOINTS) break;
  }
  return out;
}

function encodeWaypointsForFirestore(waypoints: LngLat[]): { waypointsLngLat?: { lng: number; lat: number }[] } {
  const w = waypoints.slice(0, MAX_ROUTE_WAYPOINTS);
  if (w.length === 0) return {};
  return { waypointsLngLat: w.map(([lng, lat]) => ({ lng, lat })) };
}

function validateWaypointsForSave(waypoints: LngLat[] | undefined): LngLat[] {
  if (!waypoints?.length) return [];
  if (waypoints.length > MAX_ROUTE_WAYPOINTS) {
    throw new SavedRouteValidationError(`경과지는 최대 ${MAX_ROUTE_WAYPOINTS}개까지 저장할 수 있습니다.`);
  }
  for (const p of waypoints) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== "number" || typeof p[1] !== "number") {
      throw new SavedRouteValidationError("경과지 좌표가 올바르지 않습니다.");
    }
  }
  return waypoints;
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
  /** 경유지 — 배열 안에 배열 불가하므로 {lng,lat}[] */
  waypointsLngLat?: { lng: number; lat: number }[];
  geometryType?: "LineString";
  geometryCoordsJson?: string;
  geometry?: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  source: "web";
  createdAt: unknown;
  updatedAt: unknown;
  completed?: number;
  completedAt?: unknown;
  expiresAt?: unknown;
  lastRideId?: string | null;
  routeFingerprint?: string;
};

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function toOptionalIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function fromDoc(id: string, data: Partial<SavedRouteDoc>): SavedRoute | null {
  if (!data || typeof data.name !== "string" || !Array.isArray(data.startLngLat) || !Array.isArray(data.endLngLat)) {
    console.warn(`[savedRoutes] skip ${id}: 필수 필드 누락(name/startLngLat/endLngLat)`, {
      hasName: typeof data?.name === "string",
      hasStart: Array.isArray(data?.startLngLat),
      hasEnd: Array.isArray(data?.endLngLat),
    });
    return null;
  }
  const geometry = decodeGeometryFromFirestore(data as Record<string, unknown>);
  if (!geometry) {
    console.warn(`[savedRoutes] skip ${id}: geometry 디코딩 실패`, {
      hasCoordsJson: typeof (data as Record<string, unknown>).geometryCoordsJson === "string",
      hasLegacyGeometry: Boolean((data as { geometry?: unknown }).geometry),
    });
    return null;
  }
  const completed: 0 | 1 = data.completed === 1 ? 1 : 0;
  const waypoints = decodeWaypointsFromFirestore(data as Record<string, unknown>);
  return {
    id,
    name: data.name,
    profile: (data.profile ?? "cycling") as RouteProfile,
    startLngLat: data.startLngLat as LngLat,
    endLngLat: data.endLngLat as LngLat,
    waypoints,
    geometry,
    distanceMeters: Number(data.distanceMeters ?? 0),
    durationSec: Number(data.durationSec ?? 0),
    createdAtIso: toIso(data.createdAt),
    updatedAtIso: toIso(data.updatedAt),
    completed,
    completedAtIso: toOptionalIso(data.completedAt),
    expiresAtIso: toOptionalIso(data.expiresAt),
    lastRideId: typeof data.lastRideId === "string" ? data.lastRideId : null,
    lastProgressRatio: clamp01Number((data as Record<string, unknown>).lastProgressRatio),
  };
}

/** 임의 값 → 0..1 숫자(범위 밖·비유한은 0) */
function clamp01Number(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export type SaveRouteInput = {
  userId: string;
  name: string;
  profile: RouteProfile;
  startLngLat: LngLat;
  endLngLat: LngLat;
  /** 출발·도착 사이 경유(최대 3). 생략 시 빈 배열로 저장 */
  waypoints?: LngLat[];
  geometry: LineStringGeometry;
  distanceMeters: number;
  durationSec: number;
  /** true 면 같은 경로가 있어도 확인 없이 기존 문서를 갱신한다(프롬프트 「예」 이후 재호출). */
  confirmUpdate?: boolean;
};

/**
 * 같은 사용자·같은 경로의 기존 사용자 경로 문서 id 를 찾는다(없으면 null).
 * 중복을 차단하지 않고 "기존 문서 갱신" 대상을 찾는 용도.
 *
 * ⚠️ 저장된 routeFingerprint 값에 의존하지 않고 **모든 문서의 geometry 로
 * 지금 규칙으로 재계산**해 대조한다. 과거 문서는 옛 지문 규칙(좌표열 해시)으로
 * 저장돼 있어, 저장값을 그대로 비교하면 규칙이 달라 절대 일치하지 않는다
 * (인덱스 쿼리도, "지문 있으면 skip" 폴백도 이 옛 문서를 놓쳤다 → 32건 중복의 원인).
 */
async function findExistingSavedRouteIdByFingerprint(
  db: ReturnType<typeof getFirestore>,
  userId: string,
  routeFingerprint: string,
): Promise<string | null> {
  const qByUser = query(
    collection(db, SAVED_ROUTES_COLLECTION),
    where("userId", "==", userId),
    limit(200),
  );
  const snap = await getDocs(qByUser);
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const g = decodeGeometryFromFirestore(data);
    if (!g) continue;
    const prof = (data.profile === "driving" || data.profile === "walking" || data.profile === "cycling"
      ? data.profile
      : "cycling") as RouteProfile;
    const fp = await computeRouteFingerprint(g, prof);
    if (fp === routeFingerprint) {
      return d.id;
    }
  }
  return null;
}

/** 저장 결과 — `deduped=true` 면 새 문서를 만들지 않고 같은 경로의 기존 문서를 갱신했다는 뜻. */
export type SaveRouteResult = SavedRoute & { deduped: boolean };

export async function saveRouteToFirestore(
  input: SaveRouteInput,
  authUser: User,
): Promise<SaveRouteResult> {
  const name = validateSavedRouteName(input.name);
  validateGeometry(input.geometry);
  const waypoints = validateWaypointsForSave(input.waypoints);

  const db = getFirestore(getFirebaseApp());
  const routeFingerprint = await computeRouteFingerprint(input.geometry, input.profile);

  // 같은 경로가 이미 있으면 새로 만들지 않고 기존 문서를 갱신한다(중복 저장 방지).
  // "같은 길 반복은 새 자산이 아니다" — 정복 철학과 일치. 갱신은 quota 슬롯을 쓰지 않는다.
  const existingId = await findExistingSavedRouteIdByFingerprint(db, input.userId, routeFingerprint);
  if (existingId) {
    // 확인 전이면 저장하지 않고 프롬프트를 유도한다.
    if (!input.confirmUpdate) {
      throw new SavedRouteDuplicateError(existingId);
    }
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, SAVED_ROUTES_COLLECTION, existingId), {
      updatedAt: serverTimestamp(),
      lastSavedAt: serverTimestamp(),
      saveCount: increment(1),
      // 옛 지문 규칙으로 저장된 문서를 새 규칙 값으로 백필(다음 조회 정확도).
      routeFingerprint,
    });
    return {
      id: existingId,
      name,
      profile: input.profile,
      startLngLat: input.startLngLat,
      endLngLat: input.endLngLat,
      waypoints,
      geometry: input.geometry,
      distanceMeters: input.distanceMeters,
      durationSec: input.durationSec,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      completed: 0,
      completedAtIso: null,
      expiresAtIso: new Date(Date.now() + SAVED_ROUTE_EXPIRY_MS).toISOString(),
      lastRideId: null,
      lastProgressRatio: 0,
      deduped: true,
    };
  }

  // 신규 경로만 quota 슬롯을 소모한다.
  await assertTierQuotaClient(authUser, "save_route");

  const expiresAtDate = new Date(Date.now() + SAVED_ROUTE_EXPIRY_MS);
  const payload = {
    userId: input.userId,
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    ...encodeWaypointsForFirestore(waypoints),
    ...encodeGeometryForFirestore(input.geometry),
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    routeFingerprint,
    source: "web" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completed: 0,
    completedAt: null,
    expiresAt: Timestamp.fromDate(expiresAtDate),
    lastRideId: null,
  };
  const ref = await addDoc(collection(db, SAVED_ROUTES_COLLECTION), payload);
  const nowIso = new Date().toISOString();
  return {
    id: ref.id,
    name,
    profile: input.profile,
    startLngLat: input.startLngLat,
    endLngLat: input.endLngLat,
    waypoints,
    geometry: input.geometry,
    distanceMeters: input.distanceMeters,
    durationSec: input.durationSec,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    completed: 0,
    completedAtIso: null,
    expiresAtIso: expiresAtDate.toISOString(),
    lastRideId: null,
    lastProgressRatio: 0,
    deduped: false,
  };
}

/**
 * 사용자 경로 완주 격상 — 주행 **완주(≥98%)** 시에만 호출.
 * completed=1 로 전환하고 expiresAt 을 null 로 비워 TTL 자동 삭제 대상에서 제외한다.
 * 동일 경로를 다시 주행할 때마다 lastRideId 만 최신 rideId 로 갱신.
 * 미완주 진행은 {@link updateSavedRouteProgressInFirestore} 로 처리한다(§9.5).
 */
export async function promoteSavedRouteInFirestore(input: {
  userId: string;
  routeId: string;
  rideId: string;
}): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  await updateDoc(doc(db, SAVED_ROUTES_COLLECTION, input.routeId), {
    userId: input.userId,
    completed: 1,
    completedAt: serverTimestamp(),
    expiresAt: null,
    lastRideId: input.rideId,
    lastProgressRatio: 1,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 미완주 주행의 진행률 저장 — 완주 임계 미만일 때 호출.
 * completed 는 건드리지 않고(0 유지) lastProgressRatio·lastRideId 만 갱신해
 * 「이어 달리기」·진행률 바의 근거로 남긴다. TTL(미완료 90일)도 유지된다.
 */
export async function updateSavedRouteProgressInFirestore(input: {
  userId: string;
  routeId: string;
  rideId: string;
  progressRatio: number;
}): Promise<void> {
  const db = getFirestore(getFirebaseApp());
  const ratio = Math.max(0, Math.min(1, Number(input.progressRatio) || 0));
  await updateDoc(doc(db, SAVED_ROUTES_COLLECTION, input.routeId), {
    userId: input.userId,
    lastRideId: input.rideId,
    lastProgressRatio: ratio,
    updatedAt: serverTimestamp(),
  });
}

/**
 * userId 만으로 필터하고 정렬은 **클라이언트**에서 수행한다.
 * 의도적으로 `orderBy("updatedAt")` 를 쓰지 않는 이유:
 *   1) where + orderBy 조합은 Firestore 복합 인덱스가 필요해 인덱스 미생성 시 쿼리 자체가 실패.
 *   2) 50건 한도라 클라이언트 정렬 비용이 무시할 만큼 작다.
 *   3) updatedAt 이 누락된 옛 문서도 누락 없이 표시된다.
 */
export async function loadSavedRoutesFromFirestore(
  userId: string,
  limitCount = 50,
): Promise<SavedRoute[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, SAVED_ROUTES_COLLECTION),
    where("userId", "==", userId),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  console.info(
    `[savedRoutes] load userId=${userId} → 쿼리 hit ${snap.size}건 (client-sort by updatedAt)`,
  );
  const out: SavedRoute[] = [];
  for (const d of snap.docs) {
    const route = fromDoc(d.id, d.data() as Partial<SavedRouteDoc>);
    if (route) out.push(route);
  }
  out.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
  console.info(`[savedRoutes] 디코딩 성공 ${out.length}건 / 스킵 ${snap.size - out.length}건`);
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
 * 기존 문서에 expiresAt 필드를 일회성으로 백필.
 * - completed === 1 인 문서 → 건너뜀(영구 보존)
 * - 이미 expiresAt 이 있는 문서 → 건너뜀
 * - 그 외 → 「지금 + 7일」 로 설정(이미 만든 경로에도 7일 유예를 새로 부여)
 *
 * 필드가 한 번이라도 채워지면 Firebase Console TTL 설정 UI 에서
 * `savedRoutes.expiresAt` 으로 인식·등록 가능해진다.
 * 호출자(App.tsx)가 사용자별 localStorage 플래그로 중복 실행을 막는다.
 */
export async function backfillSavedRoutesExpiresAt(input: {
  userId: string;
}): Promise<{ scanned: number; updated: number; skipped: number; failed: number }> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, SAVED_ROUTES_COLLECTION),
    where("userId", "==", input.userId),
    limit(500),
  );
  const snap = await getDocs(q);
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const d of snap.docs) {
    const data = d.data() as Partial<SavedRouteDoc>;
    if (data.completed === 1) {
      skipped++;
      continue;
    }
    if (data.expiresAt instanceof Timestamp) {
      skipped++;
      continue;
    }
    const expiresAtDate = new Date(Date.now() + SAVED_ROUTE_EXPIRY_MS);
    try {
      await updateDoc(doc(db, SAVED_ROUTES_COLLECTION, d.id), {
        userId: input.userId,
        completed: data.completed === 1 ? 1 : 0,
        completedAt: data.completedAt ?? null,
        expiresAt: Timestamp.fromDate(expiresAtDate),
        lastRideId: typeof data.lastRideId === "string" ? data.lastRideId : null,
        updatedAt: serverTimestamp(),
      });
      updated++;
    } catch {
      failed++;
    }
  }
  return { scanned: snap.size, updated, skipped, failed };
}

/**
 * 게스트(localStorage) → Google 로그인(Firestore) 1회 마이그레이션.
 * 입력으로 들어온 로컬 경로 배열을 순서대로 저장하고, 새 SavedRoute 목록을 돌려준다.
 * 호출자(App.tsx)가 성공한 경우에만 로컬 저장소를 비운다.
 */
export async function migrateLocalRoutesToFirestore(input: {
  userId: string;
  routes: SaveRouteInput[];
  authUser: User;
}): Promise<SavedRoute[]> {
  const created: SavedRoute[] = [];
  for (const r of input.routes) {
    try {
      const saved = await saveRouteToFirestore({ ...r, userId: input.userId }, input.authUser);
      created.push(saved);
    } catch {
      // 한 건 실패해도 나머지는 계속 시도
    }
  }
  return created;
}
