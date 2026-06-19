import {
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
  writeBatch,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { RouteProfile } from "../services/mapboxDirections";

export const ROUTE_PUBLICATIONS_COLLECTION = "routePublications";

export type RoutePublicationStatus = "published" | "archived";

export type RoutePublicationDoc = {
  routeId: string;
  /** @deprecated Phase 7 — doc id = {@link RoutePublicationRow.publicationId}; 필드는 purge 예정 */
  courseId?: string;
  publicTitle: string;
  publicSummary: string | null;
  status: RoutePublicationStatus;
  revision: number;
  routeFingerprint: string;
  geometryCoordsJson: string;
  snapshotProfile: RouteProfile;
  snapshotDistanceMeters: number;
  snapshotDurationSec: number;
  applicantUid: string;
  sourcePublicRouteRequestId: string;
  /** 동행(coursePresence) Rules — `routePublications/{id}` 기준 */
  presenceEnabled?: boolean;
  createdAt: unknown;
  updatedAt: unknown;
};

export type RoutePublicationRow = RoutePublicationDoc & {
  publicationId: string;
};

function parsePublicationRow(id: string, data: Record<string, unknown>): RoutePublicationRow | null {
  const routeId = data.routeId;
  const publicTitle = data.publicTitle;
  if (typeof routeId !== "string" || routeId.length < 1) return null;
  if (typeof publicTitle !== "string" || publicTitle.length < 1) return null;
  const legacyCourseId =
    typeof data.courseId === "string" && data.courseId.trim().length > 0 ? data.courseId.trim() : id;
  const status = data.status === "archived" ? "archived" : "published";
  const profile = data.snapshotProfile;
  const snapshotProfile: RouteProfile =
    profile === "cycling" || profile === "driving" || profile === "walking" ? profile : "cycling";
  return {
    publicationId: id,
    routeId,
    courseId: legacyCourseId,
    publicTitle,
    publicSummary: typeof data.publicSummary === "string" ? data.publicSummary : null,
    status,
    revision: typeof data.revision === "number" && Number.isFinite(data.revision) ? data.revision : 1,
    routeFingerprint:
      typeof data.routeFingerprint === "string" && data.routeFingerprint.length === 64
        ? data.routeFingerprint
        : "",
    geometryCoordsJson: typeof data.geometryCoordsJson === "string" ? data.geometryCoordsJson : "",
    snapshotProfile,
    snapshotDistanceMeters:
      typeof data.snapshotDistanceMeters === "number" ? data.snapshotDistanceMeters : 0,
    snapshotDurationSec: typeof data.snapshotDurationSec === "number" ? data.snapshotDurationSec : 0,
    applicantUid: typeof data.applicantUid === "string" ? data.applicantUid : "",
    sourcePublicRouteRequestId:
      typeof data.sourcePublicRouteRequestId === "string" ? data.sourcePublicRouteRequestId : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** 승인 시 publication 스냅샷 기록 (doc id = publicationId) */
export function writeRoutePublicationOnApprove(
  batch: ReturnType<typeof writeBatch>,
  input: {
    publicationId: string;
    routeId: string;
    publicTitle: string;
    publicSummary: string;
    routeFingerprint: string;
    geometryCoordsJson: string;
    snapshotProfile: RouteProfile;
    snapshotDistanceMeters: number;
    snapshotDurationSec: number;
    applicantUid: string;
    sourcePublicRouteRequestId: string;
  },
): void {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, ROUTE_PUBLICATIONS_COLLECTION, input.publicationId);
  batch.set(ref, {
    routeId: input.routeId,
    publicTitle: input.publicTitle,
    publicSummary: input.publicSummary.length > 0 ? input.publicSummary : null,
    status: "published",
    revision: 1,
    routeFingerprint: input.routeFingerprint,
    geometryCoordsJson: input.geometryCoordsJson,
    snapshotProfile: input.snapshotProfile,
    snapshotDistanceMeters: input.snapshotDistanceMeters,
    snapshotDurationSec: input.snapshotDurationSec,
    applicantUid: input.applicantUid,
    sourcePublicRouteRequestId: input.sourcePublicRouteRequestId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function findPublishedRoutePublicationByRouteId(
  routeId: string,
): Promise<RoutePublicationRow | null> {
  const db = getFirestore(getFirebaseApp());
  const qy = query(
    collection(db, ROUTE_PUBLICATIONS_COLLECTION),
    where("routeId", "==", routeId),
    where("status", "==", "published"),
    limit(1),
  );
  const snap = await getDocs(qy);
  const d = snap.docs[0];
  if (!d) return null;
  return parsePublicationRow(d.id, d.data() as Record<string, unknown>);
}

export async function findPublishedRoutePublicationByFingerprint(
  routeFingerprint: string,
): Promise<RoutePublicationRow | null> {
  if (routeFingerprint.length !== 64) return null;
  const db = getFirestore(getFirebaseApp());
  const qy = query(
    collection(db, ROUTE_PUBLICATIONS_COLLECTION),
    where("routeFingerprint", "==", routeFingerprint),
    where("status", "==", "published"),
    limit(1),
  );
  const snap = await getDocs(qy);
  const d = snap.docs[0];
  if (!d) return null;
  return parsePublicationRow(d.id, d.data() as Record<string, unknown>);
}

/** 퍼블릭 탭 카탈로그 — `routePublications` 우선(Phase C) */
export async function listPublishedRoutePublications(max = 50): Promise<RoutePublicationRow[]> {
  const db = getFirestore(getFirebaseApp());
  const qy = query(
    collection(db, ROUTE_PUBLICATIONS_COLLECTION),
    where("status", "==", "published"),
    limit(Math.min(80, Math.max(1, max))),
  );
  const snap = await getDocs(qy);
  const rows: RoutePublicationRow[] = [];
  for (const d of snap.docs) {
    const row = parsePublicationRow(d.id, d.data() as Record<string, unknown>);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => a.publicTitle.localeCompare(b.publicTitle, "ko"));
  return rows;
}

/** @deprecated shim — {@link findPublishedRoutePublicationById} (doc id = publicationId) */
export async function findPublishedRoutePublicationByCourseId(
  courseId: string,
): Promise<RoutePublicationRow | null> {
  return findPublishedRoutePublicationById(courseId);
}

export async function findPublishedRoutePublicationById(
  publicationId: string,
): Promise<RoutePublicationRow | null> {
  const id = publicationId.trim();
  if (!id) return null;
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, ROUTE_PUBLICATIONS_COLLECTION, id));
  if (!snap.exists()) return null;
  const row = parsePublicationRow(snap.id, snap.data() as Record<string, unknown>);
  return row?.status === "published" ? row : null;
}

/** UGC·입문 publication — coursePresence Rules용 `presenceEnabled` merge */
export async function mergePublicationPresenceEnabled(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, ROUTE_PUBLICATIONS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  if (data.status !== "published") return;
  if (data.presenceEnabled === true) return;
  await setDoc(
    ref,
    {
      presenceEnabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
