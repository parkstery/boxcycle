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
