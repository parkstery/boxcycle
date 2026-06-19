/** Firestore 문서 — Phase 7 `publicationId` 우선, 레거시 `courseId` 폴백 */
export function resolvePublicationIdFromDoc(data: Record<string, unknown>): string | null {
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  if (publicationId) return publicationId;
  const courseId =
    typeof data.courseId === "string" && data.courseId.trim() ? data.courseId.trim() : "";
  return courseId || null;
}
