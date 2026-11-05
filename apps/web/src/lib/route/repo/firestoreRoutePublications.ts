import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../../firebase/app";
import { noteVisibilityOneShot } from "../../debug/visibilityReadMeters";
import type { RouteProfile } from "../../../services/mapboxDirections";

export const ROUTE_PUBLICATIONS_COLLECTION = "routePublications";
/** 서버 트리거가 published Publication 을 좌표 없이 투영한 요약 목록(G2, functions/src/publicationListingCore.ts) */
const PUBLICATION_LISTINGS_COLLECTION = "publicationListings";

export type RoutePublicationStatus = "published" | "archived";

export type RoutePublicationDoc = {
  routeId: string;
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
  /** 등록자가 탈퇴해 익명화됨(applicantUid "") — 서버 deleteAccountHttp 가 쓴다(2026-10-06) */
  publisherDeleted?: boolean;
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
  const status = data.status === "archived" ? "archived" : "published";
  const profile = data.snapshotProfile;
  const snapshotProfile: RouteProfile =
    profile === "cycling" || profile === "driving" || profile === "walking" ? profile : "cycling";
  return {
    publicationId: id,
    routeId,
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
    publisherDeleted: data.publisherDeleted === true,
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
  const db = getFirebaseFirestore();
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
  const db = getFirebaseFirestore();
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
  const db = getFirebaseFirestore();
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
  noteVisibilityOneShot("catalogPublications");
  const db = getFirebaseFirestore();
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

/** 카탈로그 목록 한 줄에 필요한 필드만 — 요약 목록·원본 둘 다 이 꼴로 바꾼다 */
export type RoutePublicationSummaryRow = Pick<
  RoutePublicationRow,
  | "publicationId"
  | "routeId"
  | "publicTitle"
  | "snapshotProfile"
  | "snapshotDistanceMeters"
  | "snapshotDurationSec"
  | "applicantUid"
  | "publisherDeleted"
  | "createdAt"
> & {
  /** ISO 3166-1 alpha-2. 바다 등 판정 불가면 null */
  geoCountry: string | null;
  /** AS·EU·AF·NA·SA·OC·AN. 판정 불가면 null (목록 지역 필터용) */
  geoContinent: string | null;
};

function parsePublicationListingRow(
  id: string,
  data: Record<string, unknown>,
): RoutePublicationSummaryRow | null {
  const routeId = data.routeId;
  const publicTitle = data.publicTitle;
  if (typeof routeId !== "string" || routeId.length < 1) return null;
  if (typeof publicTitle !== "string" || publicTitle.length < 1) return null;
  if (data.status !== "published") return null;
  const profile = data.snapshotProfile;
  return {
    publicationId: id,
    routeId,
    publicTitle,
    snapshotProfile:
      profile === "cycling" || profile === "driving" || profile === "walking" ? profile : "cycling",
    snapshotDistanceMeters:
      typeof data.snapshotDistanceMeters === "number" ? data.snapshotDistanceMeters : 0,
    snapshotDurationSec: typeof data.snapshotDurationSec === "number" ? data.snapshotDurationSec : 0,
    applicantUid: typeof data.applicantUid === "string" ? data.applicantUid : "",
    publisherDeleted: data.publisherDeleted === true,
    createdAt: data.createdAt,
    geoCountry: typeof data.geoCountry === "string" ? data.geoCountry : null,
    geoContinent: typeof data.geoContinent === "string" ? data.geoContinent : null,
  };
}

/**
 * 퍼블릭 탭 카탈로그 — 요약 목록(G2). 원본과 달리 경로 좌표를 받지 않는다.
 * 최근 등록순 `max`개(종전 원본 쿼리는 순서 없이 80개). 화면 정렬은 호출부가 한다.
 */
export async function listPublishedPublicationListings(
  max = 50,
): Promise<RoutePublicationSummaryRow[]> {
  noteVisibilityOneShot("catalogPublications");
  const db = getFirebaseFirestore();
  const qy = query(
    collection(db, PUBLICATION_LISTINGS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(Math.min(80, Math.max(1, max))),
  );
  const snap = await getDocs(qy);
  const rows: RoutePublicationSummaryRow[] = [];
  for (const d of snap.docs) {
    const row = parsePublicationListingRow(d.id, d.data() as Record<string, unknown>);
    if (row) rows.push(row);
  }
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
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, ROUTE_PUBLICATIONS_COLLECTION, id));
  if (!snap.exists()) return null;
  const row = parsePublicationRow(snap.id, snap.data() as Record<string, unknown>);
  return row?.status === "published" ? row : null;
}

/** UGC·입문 publication — coursePresence Rules용 `presenceEnabled` merge */
export async function mergePublicationPresenceEnabled(publicationId: string): Promise<void> {
  const id = publicationId.trim();
  if (!id) return;
  const db = getFirebaseFirestore();
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
