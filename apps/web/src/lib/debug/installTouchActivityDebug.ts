import {
  beginTouchMeterWindow,
  endTouchMeterWindow,
  resetTouchActivityMeters,
  setTouchMeterDenominators,
  snapshotTouchActivityMeters,
} from "./touchActivityMeters";

export function snapshotTouchActivity() {
  return snapshotTouchActivityMeters();
}

export function installTouchActivityDebug(): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;
  const api = {
    snapshot: snapshotTouchActivityMeters,
    resetMeters: resetTouchActivityMeters,
    setDenominators: setTouchMeterDenominators,
    beginWindow: beginTouchMeterWindow,
    endWindow: endTouchMeterWindow,
  };
  (
    window as Window & {
      __rtwTouchMeters?: typeof snapshotTouchActivityMeters;
      __rtwTouchMetersApi?: typeof api;
    }
  ).__rtwTouchMeters = snapshotTouchActivityMeters;
  (window as Window & { __rtwTouchMetersApi?: typeof api }).__rtwTouchMetersApi = api;
}
