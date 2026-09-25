/** Firestore 문서 — `publicationId` 단일 (Phase 7c F5: 레거시 `courseId` 폴백 제거) */
export function resolvePublicationIdFromDoc(data: Record<string, unknown>): string | null {
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  return publicationId || null;
}
