import type { LngLat } from "../geo/geo";

/** 명시적으로 켠 개발·harness에서만 raw 클릭 위치 표시. 일반 개발 화면에도 숨긴다. */
export function isDistanceAutoRouteClickDebugEnabled(): boolean {
  return import.meta.env.DEV && typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("distanceRouteDebug") === "1";
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
