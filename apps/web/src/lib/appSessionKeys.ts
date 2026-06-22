/**
 * 앱 부트스트랩용 sessionStorage 키·리더 및 맵 스타일 프리셋.
 * (Phase 1: App.tsx 에서 분리)
 */

/** 명시적 로그아웃 후 자동 익명 진입을 막는 플래그(같은 탭). */
export const USER_SIGNED_OUT_SESSION_KEY = "boxcycle_user_signed_out_v1";

/** 최초 1회 Guest(익명) 진입 안내 수락 — [tier 정책 §3.2](document/260519-사용자-tier-및-진입-정책.md) */
export const GUEST_ENTRY_ACCEPTED_SESSION_KEY = "boxcycle_guest_entry_v1";

export function readGuestEntryAccepted(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_ENTRY_ACCEPTED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuestEntryAccepted(): void {
  try {
    sessionStorage.setItem(GUEST_ENTRY_ACCEPTED_SESSION_KEY, "1");
  } catch {
    /* noop */
  }
}

const LEGACY_POST_SIGNOUT_MAP_SESSION_KEY = "boxcycle_post_signout_map_v1";

export function readUserSignedOutSessionFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (sessionStorage.getItem(USER_SIGNED_OUT_SESSION_KEY) === "1") return true;
    if (sessionStorage.getItem(LEGACY_POST_SIGNOUT_MAP_SESSION_KEY) === "1") {
      sessionStorage.setItem(USER_SIGNED_OUT_SESSION_KEY, "1");
      sessionStorage.removeItem(LEGACY_POST_SIGNOUT_MAP_SESSION_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function setUserSignedOutSessionFlag(): void {
  try {
    sessionStorage.setItem(USER_SIGNED_OUT_SESSION_KEY, "1");
  } catch {
    /* noop */
  }
}

export function clearUserSignedOutSessionFlag(): void {
  try {
    sessionStorage.removeItem(USER_SIGNED_OUT_SESSION_KEY);
  } catch {
    /* noop */
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

/** 앱 진입 시 기본 맵 스타일 — Light */
export const DEFAULT_MAP_STYLE = MAP_STYLE_OPTIONS[2]!.value;
