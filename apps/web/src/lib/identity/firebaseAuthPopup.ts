/** Google/게스트 팝업 취소 등 — 재시도 UX에서 무시해도 되는 Firebase 오류 */
export function isBenignAuthPopupCancel(e: unknown): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}
