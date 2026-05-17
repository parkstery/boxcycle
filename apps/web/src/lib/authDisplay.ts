import type { User } from "firebase/auth";

export type PresenceMemberType = "guest" | "user";

/** Trailhead·코스 presence 표시명 (익명은 guest- 접두 + uid 일부) */
export function getPresenceDisplayName(user: User): string {
  if (user.isAnonymous) {
    return `guest-${user.uid.slice(0, 6)}`;
  }
  return user.displayName ?? user.email ?? user.uid;
}

export function getPresenceMemberType(user: User): PresenceMemberType {
  return user.isAnonymous ? "guest" : "user";
}
