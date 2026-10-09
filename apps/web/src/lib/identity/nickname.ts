/** 서비스 닉네임: 영문으로 시작, 영문·숫자만, 총 4~12자 */
export const NICKNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]{3,11}$/;

export const NICKNAME_RULES_SUMMARY_KO =
  "영문자로 시작하고, 영문자와 숫자만 사용합니다. 길이는 4~12자입니다.";

/** 대소문자 무시 중복 방지: 소문자로만 비교·저장소 키로 사용합니다. */
export const NICKNAME_CASE_FOLD_HINT_KO =
  "같은 철자의 대·소문자 조합은 하나의 닉네임으로만 쓸 수 있습니다.";

export function isValidNickname(raw: string): boolean {
  const s = raw.trim();
  return NICKNAME_REGEX.test(s);
}

/** `nicknames/{key}` 문서 ID 및 충돌 검사용 */
export function normalizeNicknameKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidNicknameKeyNormalized(key: string): boolean {
  return /^[a-z][a-z0-9]{3,11}$/.test(key);
}

/*
 * 닉네임 변경 제한(2026-10-09 Chief) — 자주 바꾸면 동행이 같은 사람을 알아보지 못하고, 놓은 이름을
 * 남이 바로 가져가 그 사람 행세를 할 수 있다. 서버 규칙(firestore.rules)이 같은 수치로 강제한다.
 *   - 가입 후 첫 변경은 언제든, 그 뒤로는 마지막 변경에서 30일이 지나야 다시 바꿀 수 있다.
 *   - 바꾸면서 놓은 옛 이름은 7일 동안 다른 사람이 가져갈 수 없다(nicknames/{key}.releasedAt).
 */
export const NICKNAME_CHANGE_COOLDOWN_DAYS = 30;
export const NICKNAME_RELEASE_HOLD_DAYS = 7;
const DAY_MS = 86_400_000;

/** 다음 변경이 가능해지는 시각(ms). 지금 바꿀 수 있으면 null */
export function nicknameChangeBlockedUntilMs(lastChangedAtMs: number | null, nowMs: number): number | null {
  if (lastChangedAtMs == null) return null;
  const until = lastChangedAtMs + NICKNAME_CHANGE_COOLDOWN_DAYS * DAY_MS;
  return nowMs > until ? null : until;
}

export type NicknameReservation = { ownerUid: string; releasedAtMs: number | null };

/**
 * 예약 문서가 이미 있을 때 이 uid 가 그 이름을 쓸 수 있나.
 *   mine    — 내가 쓰는 중(재로그인)
 *   reclaim — 내가 놓아 묶어 둔 이름(되찾기)
 *   free    — 남이 놓았고 묶임이 끝남(가져가기)
 *   taken   — 남이 쓰는 중이거나 묶임 중
 */
export function nicknameReservationAccess(
  r: NicknameReservation,
  uid: string,
  nowMs: number,
): "mine" | "reclaim" | "free" | "taken" {
  if (r.ownerUid === uid) return r.releasedAtMs == null ? "mine" : "reclaim";
  if (r.releasedAtMs != null && nowMs > r.releasedAtMs + NICKNAME_RELEASE_HOLD_DAYS * DAY_MS) return "free";
  return "taken";
}
