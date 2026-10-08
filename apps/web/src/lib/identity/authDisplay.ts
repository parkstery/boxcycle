import type { User } from "firebase/auth";
import { selfRiderDisplayName } from "./riderName";

export type PresenceMemberType = "guest" | "user";

/**
 * Trailhead·코스 presence 에 싣는 표시명 — 다른 라이더가 읽는다. 규칙은 riderName 한 곳.
 * 이메일은 싣지 않는다(2026-10-09: 닉네임 없는 회원의 이메일이 동행 이름표로 나갔다).
 */
export function getPresenceDisplayName(user: User): string {
  return selfRiderDisplayName(user);
}

export function getPresenceMemberType(user: User): PresenceMemberType {
  return user.isAnonymous ? "guest" : "user";
}
