/** Emulator + harness 모드에서 Cloud Functions HTTP URL (로컬 검증 전용). */
export function resolveFunctionsHttpUrl(functionName: string): string | null {
  if (import.meta.env.VITE_USE_EMULATOR !== "1") return null;
  const host = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!host || !projectId) return null;
  return `http://${host}/${projectId}/${region}/${functionName}`;
}
