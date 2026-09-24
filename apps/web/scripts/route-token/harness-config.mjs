/** Route Token harness 공통 상수 */
import { hostFor } from "../../../../scripts/emulatorPorts.mjs";

export const HARNESS_PROJECT_ID = "demo-rtw-route-token";
export const HARNESS_REGION = "asia-northeast3";
/**
 * 폴백 포트는 firebase.json 에서 읽는다 — 종전에는 여기에 9099·5001 이 박혀 있어,
 * firebase.json 의 포트를 바꾸면 아무 에러 없이 엉뚱한 곳을 두드렸다(구조 감사 H5).
 */
export const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? hostFor("auth");
export const FUNCTIONS_EMULATOR_HOST =
  process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? hostFor("functions");

export function functionUrl(name) {
  return `http://${FUNCTIONS_EMULATOR_HOST}/${HARNESS_PROJECT_ID}/${HARNESS_REGION}/${name}`;
}

export const URLS = {
  getMapboxDirections: functionUrl("getMapboxDirections"),
  getDistanceAutoRoute: functionUrl("getDistanceAutoRoute"),
  ensureOnboarding: functionUrl("ensureRouteTokenOnboardingHttp"),
  harnessControl: functionUrl("routeTokenHarnessControl"),
};

export const SAMPLE_ROUTE = {
  start: [127.02, 37.5],
  end: [127.03, 37.51],
  profile: "cycling",
  waypoints: [],
};
