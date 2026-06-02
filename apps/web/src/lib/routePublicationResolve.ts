import type { PublishedPublicRouteSummary } from "./firestoreRouteCatalog";
import {
  findPublishedPublicRouteByCatalogId,
  findPublishedPublicRouteByFingerprint,
  findPublishedPublicRouteBySourceSavedRouteId,
} from "./firestoreRouteCatalog";
import {
  findPublishedRoutePublicationByCourseId,
  findPublishedRoutePublicationByFingerprint,
  findPublishedRoutePublicationByRouteId,
} from "./firestoreRoutePublications";
import type { LineStringGeometry } from "./geo";
import { computeRouteFingerprint } from "./routeFingerprint";
import type { RouteProfile } from "../services/mapboxDirections";

export type RouteRideEntry = "owner_library" | "public_catalog";

/** 주행·Activity 연동용 — 단일 routeId + publication·카탈로그 키 */
export type PublishedRouteLink = {
  routeId: string;
  /** 카탈로그 Route id (`courses/{id}` legacy collection) */
  catalogRouteId: string;
  publicationId: string;
  publicTitle: string;
  /** @deprecated use catalogRouteId */
  courseId: string;
};

function linkFromCatalog(
  savedRouteId: string,
  catalog: readonly PublishedPublicRouteSummary[],
): PublishedRouteLink | null {
  const row = catalog.find((c) => c.sourceSavedRouteId === savedRouteId);
  if (!row?.sourceSavedRouteId) return null;
  const catalogRouteId = row.id;
  return {
    routeId: row.sourceSavedRouteId,
    catalogRouteId,
    courseId: catalogRouteId,
    publicationId: row.id,
    publicTitle: row.title,
  };
}

function linkFromPublicationRow(row: {
  routeId: string;
  courseId: string;
  publicationId: string;
  publicTitle: string;
}): PublishedRouteLink {
  const catalogRouteId = row.courseId;
  return {
    routeId: row.routeId,
    catalogRouteId,
    courseId: catalogRouteId,
    publicationId: row.publicationId,
    publicTitle: row.publicTitle,
  };
}

function linkFromLegacyCourse(row: {
  id: string;
  title: string;
  sourceSavedRouteId: string | null;
}): PublishedRouteLink | null {
  if (!row.sourceSavedRouteId) return null;
  const catalogRouteId = row.id;
  return {
    routeId: row.sourceSavedRouteId,
    catalogRouteId,
    courseId: catalogRouteId,
    publicationId: row.id,
    publicTitle: row.title,
  };
}

/**
 * 내 경로·주행 종료 시 퍼블릭 출판과 동일 경로인지 해석.
 * `routePublications` → 레거시 `courses` 순, 카탈로그 힌트는 동기 1차.
 */
export async function resolvePublishedRouteLink(input: {
  savedRouteId?: string | null;
  geometry: LineStringGeometry;
  profile: RouteProfile;
  catalogHints?: readonly PublishedPublicRouteSummary[];
}): Promise<PublishedRouteLink | null> {
  const routeId = input.savedRouteId?.trim() || null;

  if (routeId && input.catalogHints?.length) {
    const fromCatalog = linkFromCatalog(routeId, input.catalogHints);
    if (fromCatalog) return fromCatalog;
  }

  if (routeId) {
    const pub = await findPublishedRoutePublicationByRouteId(routeId);
    if (pub) return linkFromPublicationRow(pub);

    const legacy = await findPublishedPublicRouteBySourceSavedRouteId(routeId);
    const fromLegacy = legacy ? linkFromLegacyCourse(legacy) : null;
    if (fromLegacy) return fromLegacy;
  }

  const fingerprint = await computeRouteFingerprint(input.geometry, input.profile);

  const pubByFp = await findPublishedRoutePublicationByFingerprint(fingerprint);
  if (pubByFp) return linkFromPublicationRow(pubByFp);

  const legacyByFp = await findPublishedPublicRouteByFingerprint(fingerprint);
  if (legacyByFp) {
    const fromLegacy = linkFromLegacyCourse(legacyByFp);
    if (fromLegacy) return fromLegacy;
  }

  return null;
}

/** 퍼블릭 탭 주행 종료 — catalogRouteId만 있을 때 routeId 역조회 */
export async function resolvePublishedRouteLinkByCatalogRouteId(
  catalogRouteId: string,
): Promise<PublishedRouteLink | null> {
  const cid = catalogRouteId.trim();
  if (!cid) return null;

  const pub = await findPublishedRoutePublicationByCourseId(cid);
  if (pub) return linkFromPublicationRow(pub);

  const legacy = await findPublishedPublicRouteByCatalogId(cid);
  if (legacy) return linkFromLegacyCourse(legacy);

  return null;
}

/** @deprecated use resolvePublishedRouteLinkByCatalogRouteId */
export const resolvePublishedRouteLinkByCourseId = resolvePublishedRouteLinkByCatalogRouteId;
