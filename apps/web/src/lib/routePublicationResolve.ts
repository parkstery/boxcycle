import type { PublishedPublicCourseSummary } from "./firestoreCourses";
import {
  findPublishedRoutePublicationByFingerprint,
  findPublishedRoutePublicationById,
  findPublishedRoutePublicationByRouteId,
} from "./firestoreRoutePublications";
import type { LineStringGeometry } from "./geo";
import { computeRouteFingerprint } from "./routeFingerprint";
import type { RouteProfile } from "../services/mapboxDirections";

export type RouteRideEntry = "owner_library" | "public_catalog";

/** 주행·Activity 연동용 — routeId + publication 키 */
export type PublishedRouteLink = {
  routeId: string;
  publicationId: string;
  publicTitle: string;
};

function linkFromCatalog(
  savedRouteId: string,
  catalog: readonly PublishedPublicCourseSummary[],
): PublishedRouteLink | null {
  const row = catalog.find((c) => c.sourceSavedRouteId === savedRouteId);
  if (!row?.sourceSavedRouteId) return null;
  const publicationId = row.publicationId ?? row.id;
  return {
    routeId: row.sourceSavedRouteId,
    publicationId,
    publicTitle: row.title,
  };
}

function linkFromPublicationRow(row: {
  routeId: string;
  publicationId: string;
  publicTitle: string;
}): PublishedRouteLink {
  return {
    routeId: row.routeId,
    publicationId: row.publicationId,
    publicTitle: row.publicTitle,
  };
}

/**
 * 내 경로·주행 종료 시 퍼블릭 출판과 동일 경로인지 해석 (`routePublications` 단일).
 */
export async function resolvePublishedRouteLink(input: {
  savedRouteId?: string | null;
  geometry: LineStringGeometry;
  profile: RouteProfile;
  catalogHints?: readonly PublishedPublicCourseSummary[];
}): Promise<PublishedRouteLink | null> {
  const routeId = input.savedRouteId?.trim() || null;

  if (routeId && input.catalogHints?.length) {
    const fromCatalog = linkFromCatalog(routeId, input.catalogHints);
    if (fromCatalog) return fromCatalog;
  }

  if (routeId) {
    const pub = await findPublishedRoutePublicationByRouteId(routeId);
    if (pub) return linkFromPublicationRow(pub);
  }

  const fingerprint = await computeRouteFingerprint(input.geometry, input.profile);
  const pubByFp = await findPublishedRoutePublicationByFingerprint(fingerprint);
  if (pubByFp) return linkFromPublicationRow(pubByFp);

  return null;
}

/** 퍼블릭 탭 주행 종료 — publicationId 로 routeId 역조회 */
export async function resolvePublishedRouteLinkByPublicationId(
  publicationId: string,
): Promise<PublishedRouteLink | null> {
  const id = publicationId.trim();
  if (!id) return null;

  const pub = await findPublishedRoutePublicationById(id);
  if (pub) return linkFromPublicationRow(pub);

  return null;
}
