/** Route Token harness 공통 상수 */
export const HARNESS_PROJECT_ID = "demo-rtw-route-token";
export const HARNESS_REGION = "asia-northeast3";
export const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
export const FUNCTIONS_EMULATOR_HOST =
  process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

export function functionUrl(name) {
  return `http://${FUNCTIONS_EMULATOR_HOST}/${HARNESS_PROJECT_ID}/${HARNESS_REGION}/${name}`;
}

export const URLS = {
  getMapboxDirections: functionUrl("getMapboxDirections"),
  ensureOnboarding: functionUrl("ensureRouteTokenOnboardingHttp"),
  harnessControl: functionUrl("routeTokenHarnessControl"),
};

export const SAMPLE_ROUTE = {
  start: [127.02, 37.5],
  end: [127.03, 37.51],
  profile: "cycling",
  waypoints: [],
};
