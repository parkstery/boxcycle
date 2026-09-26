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

/**
 * 열린 Trail 이 「조용해서 닫아도 되는」 기간.
 *
 * 24시간인 이유 (2026-09-27 실측) — 열린 Trail 147개 중 **1~24시간 구간이 0개**였다.
 * 달리는 중(1시간 미만)과 죽은 것(1일 이상) 사이가 통째로 비어 있어서, 24시간으로 잡아도
 * 잃는 것이 없다. 더 짧게 잡을 이유도 없다 — 쉬었다 돌아오는 사람을 지킬 여유는 남긴다.
 *
 * ⚠️ 짧게 줄이지 마라. 닫힌 Trail 은 **다시 열 수 없고**, 그러면 2026-09-27 에 고친
 * 「개설자가 자기 Trail 에서 쫓겨나는」 증상이 그대로 돌아온다.
 */
export const OPEN_QUIET_TO_CLOSED_MS = 24 * 60 * 60 * 1000;

/**
 * 열린 Trail 을 닫아도 되는가 — **`lastActivityAt` 하나로 정한다.**
 *
 * 하위 문서(`livePublicationRides`·`members`)가 남았는지는 **보지 않는다.** 실측에서
 * 131일 조용한 Trail 에 `live=true` 가 남아 있었다 — 탭을 그냥 닫으면 그렇게 된다.
 * 그것을 「사람이 있다」로 읽으면 **가장 치워야 할 것이 영영 안 치워진다.**
 * 누가 달리는 동안에는 30초마다 `lastActivityAt` 이 갱신되므로, 24시간 조용하다는 것은
 * 남은 문서가 무엇이든 아무도 없다는 뜻이다. 남은 하위 문서는 삭제 단계가 함께 지운다.
 *
 * 날짜를 읽을 수 없으면 **닫지 않는다**(`null`) — 다른 두 단계와 같은 규칙이고,
 * 그런 문서는 점검 스크립트가 따로 센다.
 */
export function shouldCloseQuietOpenTrail(
  data: Record<string, unknown>,
  ts: ToMillis,
  nowMs: number,
  quietMs: number = OPEN_QUIET_TO_CLOSED_MS,
): boolean {
  const lastMs = ts(data.lastActivityAt) ?? ts(data.createdAt);
  if (lastMs == null) return false;
  return nowMs - lastMs >= quietMs;
}
