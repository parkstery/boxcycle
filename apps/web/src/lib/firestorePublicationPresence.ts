import {
  collection,
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
  startedAtMs: number | null;
  lastActivityAtMs: number | null;
  closedAtMs: number | null;
};

const COLLECTION = PUBLICATION_PRESENCE_COLLECTION;
const MAX_ACTIVE = 48;
const MAX_CLOSED = 32;
const CLOSED_WINDOW_MS = 30 * 86_400_000;

function parseRepresentativePoint(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const lng = raw[0];
  const lat = raw[1];
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return [lng, lat];
}

function parseDoc(id: string, data: Record<string, unknown>): PublicationPresenceSnapshot | null {
  const visibility = data.visibility === "public" ? "public" : "private";
  const status: PublicationPresenceStatus = data.status === "closed" ? "closed" : "active";
  const activeRiderCount =
    typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
      ? Math.max(0, Math.floor(data.activeRiderCount))
      : 0;
  const point = parseRepresentativePoint(data.representativePoint);
  if (!point) return null;

  return {
    publicationId: id,
    routeId: typeof data.routeId === "string" && data.routeId.trim() ? data.routeId.trim() : null,
    visibility,
    status,
    representativePoint: point,
    activeRiderCount,
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
    const row = parseDoc(d.id, d.data() as Record<string, unknown>);
    if (row) out.push(row);
  }
  return out;
}

/** 월드 맵 — public active + recent closed presence (M1·M2) */
export async function fetchPublicPublicationPresences(): Promise<PublicationPresenceSnapshot[]> {
  const closedSince = Timestamp.fromMillis(Date.now() - CLOSED_WINDOW_MS);

  const [active, closed] = await Promise.all([
    runPresenceQuery([
      where("visibility", "==", "public"),
      where("status", "==", "active"),
      limit(MAX_ACTIVE),
    ]),
    runPresenceQuery([
      where("visibility", "==", "public"),
      where("status", "==", "closed"),
      where("closedAt", ">=", closedSince),
      orderBy("closedAt", "desc"),
      limit(MAX_CLOSED),
    ]),
  ]);

  const byId = new Map<string, PublicationPresenceSnapshot>();
  for (const row of closed) byId.set(row.publicationId, row);
  for (const row of active) byId.set(row.publicationId, row);
  return [...byId.values()];
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
    const days = Math.floor((Date.now() - row.closedAtMs) / 86_400_000);
    if (days <= 0) return "오늘 완료된 활동";
    if (days < 7) return `${days}일 전 활동`;
    return "최근 활동 흔적";
  }
  return "최근 활동 흔적";
}
