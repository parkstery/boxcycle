/**
 * Trail 수명주기 규칙 — 스케줄러와 점검 스크립트가 **같은 것을 본다**.
 *
 * 왜 여기 있나 (2026-09-27) — 점검 스크립트가 「정리 줄이 막혔나」를 재려면 정리기와
 * 똑같은 기준을 써야 한다. 상수와 판정을 베껴 두면 한쪽만 바뀌었을 때 점검이 딴 세상
 * 숫자를 말한다. 그렇다고 CLI 가 스케줄러 모듈을 import 하면 함수 등록 코드까지 끌고 온다
 * — 그래서 규칙만 떼어 둔다(이 리포의 `*Core.ts` 관례).
 */

/** UI 목록에서 사라진 뒤 DB에 남기는 기간 */
export const CLOSED_TO_ARCHIVED_MS = 24 * 60 * 60 * 1000;

/** archived 메타·서브컬렉션 정리까지의 기간 */
export const ARCHIVED_PURGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Firestore 값 → ms. 모르는 모양이면 null */
export type ToMillis = (raw: unknown) => number | null;

/**
 * 보관 단계가 기준으로 삼는 시각.
 * **셋 다 없으면 `null`** — 그 문서는 정리기가 영원히 건너뛴다. 점검이 그것을 센다.
 */
export function resolveClosedAtMs(data: Record<string, unknown>, ts: ToMillis): number | null {
  return ts(data.closedAt) ?? ts(data.lastActivityAt) ?? ts(data.createdAt);
}

/** 삭제 단계가 기준으로 삼는 시각. 셋 다 없으면 영원히 건너뛴다. */
export function resolveArchivedAtMs(data: Record<string, unknown>, ts: ToMillis): number | null {
  return ts(data.archivedAt) ?? ts(data.closedAt) ?? ts(data.lastActivityAt);
}
