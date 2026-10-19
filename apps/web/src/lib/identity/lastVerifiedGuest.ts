/**
 * 서버 확인을 통과한 마지막 Guest uid.
 * 삭제가 확정됐다는 뜻이 아니다. null·네트워크만으로 캐시를 지우지 않기 위한 표시다.
 */
export const LAST_VERIFIED_GUEST_UID_KEY = "boxcycle_last_verified_guest_uid_v1";

export function rememberVerifiedGuestUid(uid: string): void {
  if (!uid || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LAST_VERIFIED_GUEST_UID_KEY, uid);
  } catch {
    /* 기록이 없어도 확인된 만료 경로는 그대로다 */
  }
}

export function readLastVerifiedGuestUid(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(LAST_VERIFIED_GUEST_UID_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function clearLastVerifiedGuestUid(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LAST_VERIFIED_GUEST_UID_KEY);
  } catch {
    /* noop */
  }
}
