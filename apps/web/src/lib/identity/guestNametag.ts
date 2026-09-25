import type { PresenceMemberType } from "./authDisplay";

export type NametagMemberPick = { uid: string; memberType: PresenceMemberType | null };

/** 동시 접속 게스트 uid 를 안정적으로 정렬해 guest1, guest2 … 부여에 사용 */
export function sortedGuestUids(members: NametagMemberPick[]): string[] {
  return members
    .filter((m) => m.memberType === "guest")
    .map((m) => m.uid)
    .sort((a, b) => a.localeCompare(b));
}

/** 지도·목록용 표시 문자열 */
export function mapNametagForMember(
  uid: string,
  memberType: PresenceMemberType | null,
  displayName: string | null,
  guestUidsSorted: string[],
): string {
  if (memberType === "guest") {
    const i = guestUidsSorted.indexOf(uid);
    return i >= 0 ? `guest${i + 1}` : "guest";
  }
  const d = displayName?.trim();
  if (d) return d;
  return "Rider";
}
