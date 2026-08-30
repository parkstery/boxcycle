export const ROUTE_TOKEN_HARNESS_PROJECT_ID = "demo-rtw-route-token";

export type HarnessEnv = {
  FUNCTIONS_EMULATOR?: string;
  GCLOUD_PROJECT?: string;
  GCP_PROJECT?: string;
  FIREBASE_CONFIG?: string;
  RTW_ROUTE_TOKEN_HARNESS?: string;
};

/** FIREBASE_CONFIG·GCLOUD_PROJECT 등에서 projectId 해석 — 파싱 실패 시 null */
export function resolveHarnessProjectId(env: HarnessEnv): string | null {
  if (env.GCLOUD_PROJECT?.trim()) return env.GCLOUD_PROJECT.trim();
  if (env.GCP_PROJECT?.trim()) return env.GCP_PROJECT.trim();
  const raw = env.FIREBASE_CONFIG?.trim();
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as { projectId?: string };
    return typeof cfg.projectId === "string" && cfg.projectId.trim()
      ? cfg.projectId.trim()
      : null;
  } catch {
    return null;
  }
}

/**
 * 가짜 Mapbox provider 활성 — 세 조건 AND (fail-closed).
 * FUNCTIONS_EMULATOR === "true"
 * AND projectId === demo-rtw-route-token
 * AND RTW_ROUTE_TOKEN_HARNESS === "1"
 */
export function resolveHarnessActive(env: HarnessEnv): boolean {
  return (
    env.FUNCTIONS_EMULATOR === "true" &&
    resolveHarnessProjectId(env) === ROUTE_TOKEN_HARNESS_PROJECT_ID &&
    env.RTW_ROUTE_TOKEN_HARNESS === "1"
  );
}
