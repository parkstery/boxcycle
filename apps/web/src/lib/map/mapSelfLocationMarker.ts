import { ridePulseAnimationDelay } from "../ride/ridePulse";

/** Screen-space self-location marker — zoom-independent "you are here" dot (MAP-SELF-LOCATION-MARKER-1) */

export const SELF_LOCATION_MARKER_CLASS = "map-view__self-location-marker";
export const SELF_LOCATION_HOST_CLASS = "map-view__self-location-host";

export function createSelfLocationMarkerRoot(): {
  root: HTMLDivElement;
  bearingEl: HTMLDivElement;
} {
  const root = document.createElement("div");
  root.className = SELF_LOCATION_HOST_CLASS;
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", "내 위치");

  const pulse = document.createElement("div");
  pulse.className = "map-view__self-location-pulse";
  // HUD 「새 도로」와 같은 격자 위에서 뛰도록 위상을 못 박는다(lib/ride/ridePulse.ts 참고).
  pulse.style.animationDelay = ridePulseAnimationDelay();
  pulse.setAttribute("aria-hidden", "true");

  const core = document.createElement("div");
  core.className = "map-view__self-location-core";
  core.setAttribute("aria-hidden", "true");

  const bearing = document.createElement("div");
  bearing.className = "map-view__self-location-bearing";
  bearing.setAttribute("aria-hidden", "true");
  const chevron = document.createElement("div");
  chevron.className = "map-view__self-location-bearing-chevron";
  bearing.appendChild(chevron);

  root.append(pulse, core, bearing);
  return { root, bearingEl: bearing };
}

export function normalizeBearingDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Viewport-fixed Marker 용. 지리 방위(북=0°, 시계)를 CSS rotate(화면 위=0°)로 바꿀 때
 * 지도 bearing 을 빼지 않으면 north-up 이 아닐 때 화살표가 접선과 어긋난다.
 */
export function viewportBearingDeg(
  geographicBearingDeg: number,
  mapBearingDeg: number,
): number {
  return normalizeBearingDeg(geographicBearingDeg - mapBearingDeg);
}

export function updateSelfLocationMarkerBearing(
  bearingEl: HTMLDivElement | null,
  bearingDeg: number | null,
): void {
  if (!bearingEl) return;
  if (bearingDeg == null || !Number.isFinite(bearingDeg)) {
    bearingEl.style.opacity = "0";
    return;
  }
  bearingEl.style.opacity = "1";
  bearingEl.style.transform = `rotate(${bearingDeg}deg)`;
}

export function updateSelfLocationMarkerViewportBearing(
  bearingEl: HTMLDivElement | null,
  geographicBearingDeg: number | null,
  mapBearingDeg: number,
): void {
  if (geographicBearingDeg == null || !Number.isFinite(geographicBearingDeg)) {
    updateSelfLocationMarkerBearing(bearingEl, null);
    return;
  }
  const mapB = Number.isFinite(mapBearingDeg) ? mapBearingDeg : 0;
  updateSelfLocationMarkerBearing(bearingEl, viewportBearingDeg(geographicBearingDeg, mapB));
}
