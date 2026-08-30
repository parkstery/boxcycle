const REQUIRED_EMULATOR_VARS = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"];

export function assertEmulatorIsolation() {
  const missing = REQUIRED_EMULATOR_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Route Token harness는 Emulator 안에서만 실행됩니다. 누락: ${missing.join(", ")}`,
    );
  }
  if (process.env.RTW_ROUTE_TOKEN_HARNESS !== "1") {
    throw new Error("RTW_ROUTE_TOKEN_HARNESS=1 이 필요합니다.");
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-rtw-route-token") {
    throw new Error(`예상 project demo-rtw-route-token, 실제 ${process.env.GCLOUD_PROJECT}`);
  }
  if (process.env.FIREBASE_CONFIG) {
    try {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      if (cfg.projectId && cfg.projectId !== "demo-rtw-route-token") {
        throw new Error(`FIREBASE_CONFIG project ${cfg.projectId}`);
      }
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
}

export function assertDirectDirectionsOff() {
  const raw = (process.env.VITE_DIRECTIONS_DIRECT ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true") {
    throw new Error("VITE_DIRECTIONS_DIRECT 가 켜져 있으면 harness를 실행할 수 없습니다.");
  }
}
