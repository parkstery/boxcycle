import type { PresenceMemberType } from "./authDisplay";
import { presenceRiderDisplayName } from "./riderName";

/**
 * 지도·목록용 표시 문자열 — presence 행 하나.
 * 2026-10-09: 게스트를 접속 순번(guest1, guest2 …)으로 부르던 것을 없앴다. 남이 들어오고 나갈
 * 때마다 내 이름이 바뀌었고, 접속 목록·계정 시트와도 이름이 달랐다. 규칙은 riderName 한 곳.
 */
export function mapNametagForMember(
  uid: string,
  memberType: PresenceMemberType | null,
  displayName: string | null,
): string {
  return presenceRiderDisplayName(uid, memberType, displayName);
}
