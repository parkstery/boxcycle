import type { LngLat } from "./geo";

/** 개발·harness 전용 raw 클릭 marker — production build에서는 비활성 */
export function isDistanceAutoRouteClickDebugEnabled(): boolean {
  return import.meta.env.DEV;
}

export function formatDistanceAutoRouteClickDebugCoords(lngLat: LngLat): string {
  return `${lngLat[0].toFixed(6)}, ${lngLat[1].toFixed(6)}`;
}

export function updateDistanceAutoRouteClickDebugMarkerElement(
  root: HTMLElement,
  lngLat: LngLat,
): void {
  const marker = root.querySelector<HTMLElement>(".map-view__auto-route-click-debug-marker");
  const label = root.querySelector<HTMLElement>(".map-view__auto-route-click-debug-label");
  const lng = lngLat[0].toFixed(6);
  const lat = lngLat[1].toFixed(6);
  if (marker) {
    marker.dataset.clickLng = lng;
    marker.dataset.clickLat = lat;
  }
  if (label) {
    label.textContent = `${lng}, ${lat}`;
  }
}

export function createDistanceAutoRouteClickDebugMarkerElement(lngLat: LngLat): HTMLDivElement {
  const lng = lngLat[0].toFixed(6);
  const lat = lngLat[1].toFixed(6);
  const host = document.createElement("div");
  host.className = "map-view__auto-route-click-debug-host";

  const marker = document.createElement("div");
  marker.className = "map-view__auto-route-click-debug-marker";
  marker.dataset.clickLng = lng;
  marker.dataset.clickLat = lat;
  marker.setAttribute("aria-hidden", "true");
  marker.title = "Direction click (dev)";
  marker.textContent = "C";

  const label = document.createElement("div");
  label.className = "map-view__auto-route-click-debug-label";
  label.textContent = `${lng}, ${lat}`;

  host.append(marker, label);
  return host;
}
