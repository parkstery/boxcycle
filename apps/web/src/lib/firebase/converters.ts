/**
 * Firestore 값 ↔ JS 값 변환 — **순수 인프라**. 도메인을 모른다.
 *
 * 왜 여기 있나 (Phase 5 D3·D6) — `lastSeenAtToMillis` 는 `trail/repo/firestoreTrail.ts`
 * 안에 있었다. 그래서 presence 타임스탬프를 밀리초로 바꾸려면 **네 도메인의 저장소가
 * Trail 저장소를 import** 해야 했다(ride/repo 3 · activity/repo 2 · route/repo 1).
 * Timestamp 를 밀리초로 바꾸는 일에 Trail 은 아무 상관이 없다. 구조 감사 §8 의 목표
 * 구조가 `lib/firebase/converters.ts` 를 적어 둔 자리가 바로 여기다.
 *
 * ⚠️ **구현을 그대로 옮겼다. 손대지 않았다.** 옮기는 일에 재작성을 섞으면 조용히
 * 동작이 바뀐다 — 초안에서 nanoseconds 합산과 `< 1e12`(초 단위) 해석을 빠뜨려
 * 하마터면 presence 시각이 달라질 뻔했다.
 */

/** Firestore Timestamp·{seconds,nanoseconds}·레거시 숫자 등을 ms 로 통일 */
export function lastSeenAtToMillis(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && typeof (raw as { toMillis?: () => number }).toMillis === "function") {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const o = raw as unknown as { seconds: unknown; nanoseconds?: unknown };
    if (typeof o.seconds !== "number") return null;
    const s = o.seconds;
    const n = typeof o.nanoseconds === "number" ? o.nanoseconds : 0;
    return s * 1000 + Math.floor(n / 1_000_000);
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 1e12) return Math.round(raw * 1000);
    return raw;
  }
  return null;
}

/*
 * 2026-09-26 (Phase 6-D5): `route/resolvePublicationIdFromDoc.ts` 에서 **그대로** 옮겨 왔다.
 * 같은 이유다 — 소비자는 Trail 저장소 셋뿐이었고 route 는 **아무도 쓰지 않았는데**,
 * 그 셋이 문서에서 필드 하나를 꺼내려고 route 도메인을 import 하고 있었다.
 * 문서에서 `publicationId` 필드를 꺼내는 일에 경로 도메인은 상관이 없다.
 */
/** Firestore 문서 — `publicationId` 단일 (Phase 7c F5: 레거시 `courseId` 폴백 제거) */
export function resolvePublicationIdFromDoc(data: Record<string, unknown>): string | null {
  const publicationId =
    typeof data.publicationId === "string" && data.publicationId.trim()
      ? data.publicationId.trim()
      : "";
  return publicationId || null;
}
