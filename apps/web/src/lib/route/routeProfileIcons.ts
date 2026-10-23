import type { RouteProfile } from "../../services/mapboxDirections";
import { publicationProfileLabelKo } from "./publicationDisplay";

/**
 * 지도 탭 팝업·경로 목록 공용 프로필 아이콘 path 묶음.
 * Lucide (https://lucide.dev) `car-front`, `bike`, `footprints` — ISC License.
 */
export const ROUTE_PROFILE_ICON_INNER_HTML: Record<RouteProfile, string> = {
  driving:
    '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  cycling:
    '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  walking:
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
};

const SVG_OPEN =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

/** 지도 지점 팝업 — 기존 클래스·모양 유지 */
export function buildPickPopupProfileIconSvg(profile: RouteProfile): string {
  return `<svg class="map-view__pick-profile-ico" ${SVG_OPEN} aria-hidden="true">${ROUTE_PROFILE_ICON_INNER_HTML[profile]}</svg>`;
}

export function routeProfileLabelKo(profile: RouteProfile): string {
  return publicationProfileLabelKo(profile);
}
