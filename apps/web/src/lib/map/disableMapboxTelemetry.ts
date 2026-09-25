import mapboxgl from "mapbox-gl";

declare global {
  interface Window {
    __boxcycleMapboxTelemetryOff?: boolean;
  }
}

/** Mapbox analytics/turnstile — adblock 노이즈·중복 Map 생성 시 요청 폭주 완화 */
export function ensureMapboxTelemetryDisabled(): void {
  if (typeof window === "undefined" || window.__boxcycleMapboxTelemetryOff) return;
  try {
    const mb = mapboxgl as typeof mapboxgl & {
      setTelemetryEnabled?: (enabled: boolean) => void;
    };
    mb.setTelemetryEnabled?.(false);
  } catch {
    /* 구버전 mapbox-gl */
  }
  window.__boxcycleMapboxTelemetryOff = true;
}

ensureMapboxTelemetryDisabled();
