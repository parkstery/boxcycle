import {
  collection,
  GeoPoint,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LngLat } from "./geo";
import { lastSeenAtToMillis } from "./firestoreTrail";
import { COURSE_ACTIVITY_POLL_MS } from "./rideSyncPolicy";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  getBasicHubCoursePayload,
} from "./firestoreCourses";
import { distanceMidpointLngLat } from "./routeGeometryMidpoint";
import type { LineStringGeometry } from "./geo";

export const PUBLICATION_PRESENCE_COLLECTION = "publicationPresence";

export type PublicationPresenceStatus = "active" | "closed";
export type PublicationVisibility = "public" | "private";

export type PublicationPresenceSnapshot = {
  publicationId: string;
  routeId: string | null;
  visibility: PublicationVisibility;
  status: PublicationPresenceStatus;
  representativePoint: LngLat | null;
  activeRiderCount: number;
  liveNow: boolean;
  startedAtMs: number | null;
  lastActivityAtMs: number | null;
  closedAtMs: number | null;
};

const COLLECTION = PUBLICATION_PRESENCE_COLLECTION;
const MAX_ACTIVE = 48;
const MAX_CLOSED = 32;
/** 월드 heat dot — {@link activityWorldTraceStyle.ACTIVITY_TRACE_HEAT_WINDOW_MS} 와 동일 */
const CLOSED_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CLIENT_MIDPOINT_RESOLVE = 12;

/** Firestore `GeoPoint`·배열·객체 — parse 실패 시 null (문서는 유지) */
export function parseRepresentativePoint(raw: unknown): LngLat | null {
  if (raw instanceof GeoPoint) {
    const lng = raw.longitude;
    const lat = raw.latitude;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    return null;
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    return null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const lngRaw = o.lng ?? o.longitude ?? o.lon;
    const latRaw = o.lat ?? o.latitude;
    const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);
    const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return null;
}

function parseDoc(id: string, data: Record<string, unknown>): PublicationPresenceSnapshot {
  const visibility = data.visibility === "public" ? "public" : "private";
  const status: PublicationPresenceStatus = data.status === "closed" ? "closed" : "active";
  const activeRiderCount =
    typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
      ? Math.max(0, Math.floor(data.activeRiderCount))
      : 0;
  const point = parseRepresentativePoint(data.representativePoint);

  return {
    publicationId: id,
    routeId: typeof data.routeId === "string" && data.routeId.trim() ? data.routeId.trim() : null,
    visibility,
    status,
    representativePoint: point,
    activeRiderCount,
    liveNow: data.liveNow === true,
    startedAtMs: lastSeenAtToMillis(data.startedAt),
    lastActivityAtMs: lastSeenAtToMillis(data.lastActivityAt),
    closedAtMs: lastSeenAtToMillis(data.closedAt),
  };
}

async function runPresenceQuery(constraints: QueryConstraint[]): Promise<PublicationPresenceSnapshot[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  const out: PublicationPresenceSnapshot[] = [];
  for (const d of snap.docs) {
    out.push(parseDoc(d.id, d.data() as Record<string, unknown>));
  }
  return out;
}

function geometryForPublication(publicationId: string): LineStringGeometry | null {
  const id = publicationId.trim();
  if (!id) return null;
  const isBasic = (BASIC_SHARED_HUB_IDS as readonly string[]).includes(id);
  if (isBasic) {
    const g = getBasicHubCoursePayload(id).geometry;
    return g?.coordinates?.length ? g : null;
  }
  return null;
}

/** CF 미기록 시 클라이언트 distance midpoint (bounded) */
export async function resolvePublicationRepresentativePointClient(
  publicationId: string,
): Promise<LngLat | null> {
  const id = publicationId.trim();
  if (!id) return null;

  const embedded = geometryForPublication(id);
  if (embedded?.coordinates?.length) {
    return distanceMidpointLngLat(embedded.coordinates);
  }

  try {
    const payload = await fetchCourseRoutePayload(id);
    const coords = payload?.geometry?.coordinates;
    if (coords?.length) return distanceMidpointLngLat(coords);
  } catch {
    /* geometry optional */
  }
  return null;
}

/** representativePoint 누락 행 — route geometry 로 보충 (표시용) */
export async function enrichPublicationPresencePoints(
  rows: readonly PublicationPresenceSnapshot[],
): Promise<PublicationPresenceSnapshot[]> {
  const out: PublicationPresenceSnapshot[] = [];
  let resolved = 0;

  for (const row of rows) {
    if (row.representativePoint) {
      out.push(row);
      continue;
    }
    if (resolved >= MAX_CLIENT_MIDPOINT_RESOLVE) {
      out.push(row);
      continue;
    }
    const point = await resolvePublicationRepresentativePointClient(row.publicationId);
    if (point) resolved += 1;
    out.push({ ...row, representativePoint: point });
  }

  if (import.meta.env.DEV && resolved > 0) {
    console.debug("[PublicationPresence] client midpoint resolved", { count: resolved });
  }

  return out;
}

export type FetchPublicPublicationPresencesResult = {
  rows: PublicationPresenceSnapshot[];
  activeQueryError: string | null;
  closedQueryError: string | null;
};

/** 월드 맵 — public active + recent closed presence (M1·M2) */
export async function fetchPublicPublicationPresences(): Promise<PublicationPresenceSnapshot[]> {
  const result = await fetchPublicPublicationPresencesDetailed();
  return result.rows;
}

export async function fetchPublicPublicationPresencesDetailed(): Promise<FetchPublicPublicationPresencesResult> {
  const closedSince = Timestamp.fromMillis(Date.now() - CLOSED_WINDOW_MS);

  let active: PublicationPresenceSnapshot[] = [];
  let closed: PublicationPresenceSnapshot[] = [];
  let activeQueryError: string | null = null;
  let closedQueryError: string | null = null;

  try {
    active = await runPresenceQuery([
      where("visibility", "==", "public"),
      where("status", "==", "active"),
      limit(MAX_ACTIVE),
    ]);
  } catch (e) {
    activeQueryError = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) {
      console.warn("[PublicationPresence] active query failed", e);
    }
  }

  try {
    closed = await runPresenceQuery([
      where("visibility", "==", "public"),
      where("status", "==", "closed"),
      where("closedAt", ">=", closedSince),
      orderBy("closedAt", "desc"),
      limit(MAX_CLOSED),
    ]);
  } catch (e) {
    closedQueryError = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) {
      console.warn("[PublicationPresence] closed query failed", e);
    }
  }

  const byId = new Map<string, PublicationPresenceSnapshot>();
  for (const row of closed) byId.set(row.publicationId, row);
  for (const row of active) byId.set(row.publicationId, row);

  const merged = [...byId.values()];
  const enriched = await enrichPublicationPresencePoints(merged);

  return { rows: enriched, activeQueryError, closedQueryError };
}

export { COURSE_ACTIVITY_POLL_MS as PUBLICATION_PRESENCE_POLL_MS };

export function formatPublicationPresencePinPopup(
  row: PublicationPresenceSnapshot | null | undefined,
  kind: "pulse" | "heat",
): string | null {
  if (!row) return null;
  if (kind === "pulse") {
    const n = row.activeRiderCount;
    if (n <= 0) return "라이브 활동";
    return n === 1 ? "지금 1명 주행 중" : `지금 ${n}명 주행 중`;
  }
  if (row.closedAtMs != null) {
    const ageMs = Math.max(0, Date.now() - row.closedAtMs);
    if (ageMs < 24 * 60 * 60 * 1000) return "최근 24시간 내 완료";
    return null;
  }
  return null;
}

/** DEV 회귀 — representativePoint 파싱 */
export function runPublicationPresenceParseChecks(): void {
  const fromArray = parseRepresentativePoint([127.03, 37.5]);
  if (!fromArray || fromArray[0] !== 127.03) {
    throw new Error("parseRepresentativePoint: array");
  }
  const fromGeo = parseRepresentativePoint(new GeoPoint(37.5, 127.03));
  if (!fromGeo || fromGeo[0] !== 127.03 || fromGeo[1] !== 37.5) {
    throw new Error("parseRepresentativePoint: GeoPoint");
  }
  const fromObj = parseRepresentativePoint({ longitude: 127.1, latitude: 37.1 });
  if (!fromObj || fromObj[0] !== 127.1) {
    throw new Error("parseRepresentativePoint: object");
  }
}
