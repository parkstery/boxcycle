/**
 * 라이더를 화면에 뭐라고 부르나 — 단일 규칙 (2026-10-09 Chief).
 *
 * 종전에는 같은 게스트가 계정 시트 「게스트」, 지도 이름표 「guest1」(접속 순번 — 남이 들어오면
 * 바뀐다), 접속 목록 「guest-tHQb0Y」, 혼자 달릴 때 「guest」 로 네 가지 이름을 가졌다.
 * 닉네임 없는 회원은 이메일이 이름표로 나가 동행에게 노출됐다.
 *
 * 규칙:
 *   회원  → 닉네임(닉네임 규칙을 통과한 값만)
 *   게스트 → 「게스트-」 + uid 앞 4자 (접속 순서와 무관하게 늘 같다)
 *   회원인데 닉네임이 없음 → 「라이더-」 + uid 앞 4자
 * **이메일·실명은 어떤 경우에도 이름으로 쓰지 않는다.** Google 실명("ster pin")·이메일은
 * 닉네임 규칙(영문 시작·영문숫자 4~12자)을 통과하지 못하므로 걸러진다.
 */
import { isValidNickname } from "./nickname";

export const GUEST_NAME_PREFIX = "게스트-";
export const UNNAMED_RIDER_PREFIX = "라이더-";
const SHORT_CODE_LEN = 4;

/** 옛 클라이언트가 presence 에 써 둔 게스트 표시명 접두 — 읽을 때 게스트로 판정 */
const LEGACY_GUEST_NAME = /^(guest-|guest\d*$|게스트-)/;

export function riderShortCode(uid: string): string {
  return uid.slice(0, SHORT_CODE_LEN);
}

/** 이름 후보가 닉네임으로 쓸 수 있는 값이면 그대로, 아니면 null */
export function nicknameOrNull(candidate: string | null | undefined): string | null {
  const s = candidate?.trim();
  return s && isValidNickname(s) ? s : null;
}

export function riderDisplayName(input: {
  uid: string;
  isGuest: boolean;
  nickname?: string | null;
}): string {
  const code = riderShortCode(input.uid);
  if (input.isGuest) return `${GUEST_NAME_PREFIX}${code}`;
  return nicknameOrNull(input.nickname) ?? `${UNNAMED_RIDER_PREFIX}${code}`;
}

/** 로그인한 나 — Firebase User 의 displayName 은 가입 때 닉네임으로 맞춰진다(updateProfile) */
export function selfRiderDisplayName(user: {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
}): string {
  return riderDisplayName({ uid: user.uid, isGuest: user.isAnonymous, nickname: user.displayName });
}

/**
 * 다른 라이더 — presence 행에서 읽은 값. memberType 을 모르면(옛 행·live 행만 있음)
 * 옛 게스트 표시명 접두로 게스트를 판정한다. 옛 클라이언트가 쓴 이메일은 여기서 걸러진다.
 */
export function presenceRiderDisplayName(
  uid: string,
  memberType: "guest" | "user" | null | undefined,
  displayName: string | null | undefined,
): string {
  const isGuest =
    memberType === "guest" || (memberType == null && LEGACY_GUEST_NAME.test(displayName?.trim() ?? ""));
  return riderDisplayName({ uid, isGuest, nickname: displayName });
}

/**
 * 닉네임 없는 회원 — 주행을 시작하기 전에 닉네임부터 받는다(2026-10-09 Chief: 「이름 없는 라이더가 달린다」).
 * 가입 카드가 정상 경로지만, 게스트→Google 연결처럼 카드를 건너뛰는 경로가 있었다. 이것은 마지막 확인이다.
 */
export function memberNeedsNickname(user: { isAnonymous: boolean; displayName: string | null }): boolean {
  return !user.isAnonymous && nicknameOrNull(user.displayName) === null;
}
