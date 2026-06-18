function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/** Firestore rides — Trail ID (`trailId` 우선, 레거시 `roomId` 폴백). */
export function resolveRideTrailId(data: Record<string, unknown>): string | null {
  return trimOrNull(data.trailId) ?? trimOrNull(data.roomId);
}

/** Firestore rides — 작업본 경로 ID (`routeId` 우선, 레거시 `userRouteId` 폴백). */
export function resolveRideRouteId(data: Record<string, unknown>): string | null {
  return trimOrNull(data.routeId) ?? trimOrNull(data.userRouteId);
}

/** Firestore rides — 출판 ID (`publicationId` 우선, 레거시 `courseId` 폴백). */
export function resolveRidePublicationId(data: Record<string, unknown>): string | null {
  return trimOrNull(data.publicationId) ?? trimOrNull(data.courseId);
}

/** 신규 rides write — canonical 필드 + CF 호환 `courseId` mirror. */
export function buildRideCanonicalWriteFields(input: {
  trailId: string | null;
  routeId: string | null;
  publicationId: string | null;
}): {
  trailId: string | null;
  routeId: string | null;
  publicationId: string | null;
  courseId: string | null;
} {
  const trailId = trimOrNull(input.trailId);
  const routeId = trimOrNull(input.routeId);
  const publicationId = trimOrNull(input.publicationId);
  return {
    trailId,
    routeId,
    publicationId,
    courseId: publicationId,
  };
}
