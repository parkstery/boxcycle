/** QA 전용 — 프로덕션 빌드에서는 env 미설정 권장 */
export function allowUnauthMapDev(): boolean {
  const raw = (import.meta.env.VITE_ALLOW_UNAUTH_MAP ?? "").toString().trim().toLowerCase();
  return raw === "1" || raw === "true";
}
