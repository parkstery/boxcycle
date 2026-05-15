/**
 * 앱 부트스트랩용 sessionStorage 키·리더 및 맵 스타일 프리셋.
 * (Phase 1: App.tsx 에서 분리)
 */

/** 로그아웃 직후 같은 탭에서 맵을 유지할지. 최초 방문은 플래그 없음 → 전체 인증 게이트. */
export const POST_SIGNOUT_MAP_SESSION_KEY = "boxcycle_post_signout_map_v1";

export function readPostSignoutMapSessionFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(POST_SIGNOUT_MAP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** B 여정 setup 안내 탭 닫힘 — 탭 세션 동안 유지. */
export const B_JOURNEY_HINT_SESSION_KEY = "boxcycle_b_journey_hint_dismissed_v1";

export function readBJourneyHintDismissedSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(B_JOURNEY_HINT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export const MAP_STYLE_OPTIONS = [
  { value: "mapbox://styles/mapbox/streets-v12", label: "Streets" },
  { value: "mapbox://styles/mapbox/outdoors-v12", label: "Outdoors" },
  { value: "mapbox://styles/mapbox/light-v11", label: "Light" },
  { value: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
];
