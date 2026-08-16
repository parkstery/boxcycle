import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { distanceMidpointLngLat, type LngLat } from "./routeGeometryMidpoint.js";
import { scanAllLiveRideDocs } from "./liveRideScan.js";
import { BASIC_INTRO_HUB_PUBLICATION_IDS } from "./basicIntroHubSeeds.js";

export const PUBLICATION_PRESENCE_COLLECTION = "publicationPresence";

/**
 * `apps/web` `BASIC_SHARED_HUB_IDS` 와 동일해야 한다.
 * 두 파일 모두 `node scripts/gen-basic-intro-routes.mjs` 가 생성하고,
 * `apps/web/scripts/basic-routes-verify/verify-basic-routes.mjs` 가 집합 일치를 검사한다.
 */
const BASIC_SHARED_HUB_IDS = new Set<string>(BASIC_INTRO_HUB_PUBLICATION_IDS);

type PublicationVisibility = "public" | "private";

function parseCoordsFromData(data: Record<string, unknown>): LngLat[] | null {
  const jsonField = data.geometryCoordsJson;
  if (typeof jsonField === "string" && jsonField.length > 0) {
    try {
      const raw = JSON.parse(jsonField) as unknown;
      if (!Array.isArray(raw) || raw.length < 2) return null;
      const out: LngLat[] = [];
      for (const c of raw) {
        if (!Array.isArray(c) || c.length !== 2) return null;
        const lng = c[0];
        const lat = c[1];
        if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        out.push([lng, lat]);
      }
      return out.length >= 2 ? out : null;
    } catch {
      return null;
    }
  }
  const geom = data.geometry;
  if (geom && typeof geom === "object") {
    const g = geom as { type?: unknown; coordinates?: unknown };
    if (g.type === "LineString" && Array.isArray(g.coordinates)) {
      const out: LngLat[] = [];
      for (const c of g.coordinates) {
        if (!Array.isArray(c) || c.length !== 2) return null;
        const lng = c[0];
        const lat = c[1];
        if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        out.push([lng, lat]);
      }
      return out.length >= 2 ? out : null;
    }
  }
  return null;
}

async function loadGeometrySource(
  publicationId: string,
): Promise<{ routeId: string | null; data: Record<string, unknown> } | null> {
  const db = getFirestore();
  const id = publicationId.trim();
  if (!id) return null;

  const pubSnap = await db.doc(`routePublications/${id}`).get();
  if (pubSnap.exists) {
    const data = pubSnap.data() as Record<string, unknown>;
    const routeId = typeof data.routeId === "string" ? data.routeId.trim() : null;
    return { routeId, data };
  }

  return null;
}

export async function resolvePublicationVisibility(publicationId: string): Promise<PublicationVisibility> {
  const id = publicationId.trim();
  if (!id) return "private";
  if (BASIC_SHARED_HUB_IDS.has(id)) return "public";

  const db = getFirestore();
  const pubSnap = await db.doc(`routePublications/${id}`).get();
  if (pubSnap.exists) {
    const status = pubSnap.get("status");
    if (status === "published") return "public";
    return "private";
  }

  return "private";
}

async function computeRepresentativePoint(publicationId: string): Promise<{
  point: LngLat;
  routeId: string | null;
} | null> {
  const loaded = await loadGeometrySource(publicationId);
  if (!loaded) return null;
  const coords = parseCoordsFromData(loaded.data);
  if (!coords) return null;
  const point = distanceMidpointLngLat(coords);
  if (!point) return null;
  return { point, routeId: loaded.routeId };
}

async function ensureRepresentativePoint(publicationId: string): Promise<LngLat | null> {
  const id = publicationId.trim();
  if (!id) return null;
  const db = getFirestore();
  const ref = db.doc(`${PUBLICATION_PRESENCE_COLLECTION}/${id}`);
  const snap = await ref.get();
  const existing = snap.data()?.representativePoint;
  if (Array.isArray(existing) && existing.length === 2) {
    const lng = existing[0];
    const lat = existing[1];
    if (typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat];
    }
  }

  const computed = await computeRepresentativePoint(id);
  if (!computed) return null;
  await ref.set(
    {
      publicationId: id,
      representativePoint: computed.point,
      routeId: computed.routeId ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return computed.point;
}

/** 첫 rider 세션 시작 — 전역 presence dot (heartbeat 아님) */
export async function bumpPublicationLiveSessionStarted(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const visibility = await resolvePublicationVisibility(id);
  const db = getFirestore();
  const ref = db.doc(`${PUBLICATION_PRESENCE_COLLECTION}/${id}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur =
      typeof snap.data()?.activeRiderCount === "number" && Number.isFinite(snap.data()!.activeRiderCount)
        ? Math.max(0, Math.floor(snap.data()!.activeRiderCount as number))
        : 0;
    const next = cur + 1;
    const patch: Record<string, unknown> = {
      publicationId: id,
      visibility,
      status: "active",
      activeRiderCount: next,
      liveNow: true,
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!snap.exists || !snap.data()?.startedAt) {
      patch.startedAt = FieldValue.serverTimestamp();
    }
    if (snap.data()?.status === "closed") {
      patch.closedAt = FieldValue.delete();
    }
    tx.set(ref, patch, { merge: true });
  });

  await ensureRepresentativePoint(id);
}

/** 마지막 rider 세션 종료 — active → closed (fade 대상) */
export async function bumpPublicationLiveSessionEnded(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore();
  const ref = db.doc(`${PUBLICATION_PRESENCE_COLLECTION}/${id}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const cur =
      typeof snap.data()?.activeRiderCount === "number" && Number.isFinite(snap.data()!.activeRiderCount)
        ? Math.max(0, Math.floor(snap.data()!.activeRiderCount as number))
        : 0;
    const next = Math.max(0, cur - 1);
    const patch: Record<string, unknown> = {
      activeRiderCount: next,
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (next === 0) {
      patch.status = "closed";
      patch.liveNow = false;
      patch.closedAt = FieldValue.serverTimestamp();
    } else {
      patch.status = "active";
      patch.liveNow = true;
    }
    tx.set(ref, patch, { merge: true });
  });
}

/** `livePublicationRides` collection group 기준 publication presence 재집계 */
export async function reconcilePublicationPresenceFromLiveRides(): Promise<void> {
  const db = getFirestore();
  const now = Date.now();
  const LIVE_RIDE_FRESH_MS = 180_000;
  const byPublication = new Map<string, number>();

  const liveRows = await scanAllLiveRideDocs();
  for (const row of liveRows) {
    let seenMs: number | null = null;
    const seenRaw = row.lastSeenAt;
    if (
      seenRaw &&
      typeof seenRaw === "object" &&
      typeof (seenRaw as { toMillis?: () => number }).toMillis === "function"
    ) {
      seenMs = (seenRaw as { toMillis: () => number }).toMillis();
    }
    if (seenMs == null || now - seenMs > LIVE_RIDE_FRESH_MS) continue;
    const publicationId = row.publicationId;
    byPublication.set(publicationId, (byPublication.get(publicationId) ?? 0) + 1);
  }

  const presenceSnap = await db.collection(PUBLICATION_PRESENCE_COLLECTION).get();
  const batch = db.batch();
  let ops = 0;
  const needMidpoint: string[] = [];

  const queueWrite = (publicationId: string, count: number, visibility: PublicationVisibility) => {
    const ref = db.doc(`${PUBLICATION_PRESENCE_COLLECTION}/${publicationId}`);
    const patch: Record<string, unknown> = {
      publicationId,
      visibility,
      activeRiderCount: count,
      liveNow: count > 0,
      status: count > 0 ? "active" : "closed",
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (count === 0) {
      patch.closedAt = FieldValue.serverTimestamp();
    }
    batch.set(ref, patch, { merge: true });
    ops += 1;
    if (count > 0) needMidpoint.push(publicationId);
  };

  for (const [publicationId, count] of byPublication) {
    const visibility = await resolvePublicationVisibility(publicationId);
    queueWrite(publicationId, count, visibility);
  }

  for (const d of presenceSnap.docs) {
    if (byPublication.has(d.id)) continue;
    const prev = d.data();
    const hadActive =
      prev.status === "active" ||
      prev.liveNow === true ||
      (typeof prev.activeRiderCount === "number" && prev.activeRiderCount > 0);
    if (!hadActive) continue;
    const visibility = await resolvePublicationVisibility(d.id);
    queueWrite(d.id, 0, visibility);
  }

  if (ops > 0) {
    await batch.commit();
  }

  for (const publicationId of needMidpoint) {
    await ensureRepresentativePoint(publicationId);
  }

  console.info("[publicationPresenceReconcile]", {
    activePublications: byPublication.size,
    ops,
  });
}
