/** Emulator + harness 모드에서 Cloud Functions HTTP URL (로컬 검증 전용). */

function requireFunctionsEmulatorHostWhenEmulatorMode(): string | null {
  if (import.meta.env.VITE_USE_EMULATOR !== "1") return null;
  const host = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST?.trim();
  if (!host) {
    throw new Error(
      "VITE_USE_EMULATOR=1 인데 VITE_FUNCTIONS_EMULATOR_HOST 가 없습니다. " +
        "Auth 에뮬레이터 토큰으로 프로덕션 Functions 를 호출하면 401 이 납니다.",
    );
  }
  return host;
}

export function resolveFunctionsHttpUrl(functionName: string): string | null {
  const host = requireFunctionsEmulatorHostWhenEmulatorMode();
  if (!host) return null;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) return null;
  return `http://${host}/${projectId}/${region}/${functionName}`;
}

function resolveFunctionsHttpOrigin(): string {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const region = import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
  if (!projectId) {
    throw new Error("Firebase 프로젝트가 설정되지 않았습니다.");
  }
  const host = requireFunctionsEmulatorHostWhenEmulatorMode();
  if (host) {
    return `http://${host}/${projectId}/${region}`;
  }
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

/** Functions HTTP base origin (no trailing function path). */
export function functionsHttpOrigin(): string {
  return resolveFunctionsHttpOrigin();
}

/** Functions HTTP 엔드포인트 URL — Emulator 모드면 자동으로 로컬을 가리킨다. */
export function functionsHttpUrl(functionName: string): string {
  const emulatorUrl = resolveFunctionsHttpUrl(functionName);
  if (emulatorUrl) return emulatorUrl;
  return `${resolveFunctionsHttpOrigin()}/${functionName}`;
}
