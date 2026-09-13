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
  pulse.setAttribute("aria-hidden", "true");

  const core = document.createElement("div");
  core.className = "map-view__self-location-core";
  core.setAttribute("aria-hidden", "true");

  const bearing = document.createElement("div");
  bearing.className = "map-view__self-location-bearing";
  core.appendChild(bearing);

  root.append(pulse, core);
  return { root, bearingEl: bearing };
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
