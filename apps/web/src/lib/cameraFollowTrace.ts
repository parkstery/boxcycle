/**
 * U-3 DEV — jumpTo 직전 카메라 출력 시계열.
 * 프레임 시간이 아니라 그 프레임이 쓴 center/bearing/pitch/zoom 과 파생 step 을 남긴다.
 */

import type { LngLat } from "./geo";
import { getDistanceMeters } from "./geo";

export type CameraTraceFrame = {
  t: number;
  lng: number;
  lat: number;
  bearing: number;
  pitch: number;
  zoom: number;
  centerStepM: number;
  bearingStepDeg: number;
  zoomStep: number;
  riderStepM: number;
  centerStepPx: number;
  mPerPx: number;
};

export type CameraTraceSnapshot = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sentinelDropped: number;
  frames: CameraTraceFrame[];
};

type Trace = {
  active: boolean;
  startedAt: number;
  sentinelDropped: number;
  frames: CameraTraceFrame[];
  prevCenter: LngLat | null;
  prevBearing: number | null;
  prevZoom: number | null;
  prevRider: LngLat | null;
};

let trace: Trace | null = null;

function finite(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) < 1e12;
}

function shortestAngleDelta(from: number, to: number): number {
  let n = (to - from) % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}

function metersPerPixel(latDeg: number, zoom: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);
}

export function startCameraFollowTrace(): void {
  if (!import.meta.env.DEV) return;
  trace = {
    active: true,
    startedAt: performance.now(),
    sentinelDropped: 0,
    frames: [],
    prevCenter: null,
    prevBearing: null,
    prevZoom: null,
    prevRider: null,
  };
  publish(null);
}

export function stopCameraFollowTrace(): CameraTraceSnapshot | null {
  if (!import.meta.env.DEV || !trace) return null;
  const snap = snapshotCameraFollowTrace();
  trace.active = false;
  publish(snap);
  return snap;
}

export function snapshotCameraFollowTrace(): CameraTraceSnapshot | null {
  if (!trace) return null;
  const endedAt = performance.now();
  return {
    startedAt: trace.startedAt,
    endedAt,
    durationMs: endedAt - trace.startedAt,
    sentinelDropped: trace.sentinelDropped,
    frames: trace.frames,
  };
}

export function noteFollowJumpToValues(input: {
  t: number;
  center: LngLat;
  bearing: number;
  pitch: number;
  zoom: number;
  riderLngLat: LngLat;
}): void {
  if (!import.meta.env.DEV || !trace?.active) return;
  const { t, center, bearing, pitch, zoom, riderLngLat } = input;
  if (
    !finite(t) ||
    !finite(center[0]) ||
    !finite(center[1]) ||
    !finite(bearing) ||
    !finite(pitch) ||
    !finite(zoom) ||
    !finite(riderLngLat[0]) ||
    !finite(riderLngLat[1])
  ) {
    trace.sentinelDropped += 1;
    return;
  }
  const prevC = trace.prevCenter;
  const centerStepM = prevC ? getDistanceMeters(prevC, center) : 0;
  const bearingStepDeg =
    trace.prevBearing == null ? 0 : shortestAngleDelta(trace.prevBearing, bearing);
  const zoomStep = trace.prevZoom == null ? 0 : zoom - trace.prevZoom;
  const riderStepM = trace.prevRider ? getDistanceMeters(trace.prevRider, riderLngLat) : 0;
  const mPerPx = metersPerPixel(center[1], zoom);
  if (!finite(centerStepM) || !finite(bearingStepDeg) || !finite(zoomStep) || !finite(riderStepM) || !finite(mPerPx) || mPerPx <= 0) {
    trace.sentinelDropped += 1;
    return;
  }
  const centerStepPx = centerStepM / mPerPx;
  if (!finite(centerStepPx)) {
    trace.sentinelDropped += 1;
    return;
  }
  trace.frames.push({
    t,
    lng: center[0],
    lat: center[1],
    bearing,
    pitch,
    zoom,
    centerStepM,
    bearingStepDeg,
    zoomStep,
    riderStepM,
    centerStepPx,
    mPerPx,
  });
  trace.prevCenter = center;
  trace.prevBearing = bearing;
  trace.prevZoom = zoom;
  trace.prevRider = riderLngLat;
  publish(null);
}

function publish(snap: CameraTraceSnapshot | null): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & {
    __RTW_CAMERA_TRACE__?: CameraTraceSnapshot | null;
    __RTW_CAMERA_TRACE_START__?: () => void;
    __RTW_CAMERA_TRACE_STOP__?: () => CameraTraceSnapshot | null;
    __RTW_CAMERA_TRACE_COUNT__?: number;
  };
  w.__RTW_CAMERA_TRACE__ = snap;
  w.__RTW_CAMERA_TRACE_START__ = startCameraFollowTrace;
  w.__RTW_CAMERA_TRACE_STOP__ = stopCameraFollowTrace;
  w.__RTW_CAMERA_TRACE_COUNT__ = trace?.active ? trace.frames.length : (snap?.frames.length ?? 0);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  publish(null);
}

export function assertCameraTraceP0(snap: CameraTraceSnapshot): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (snap.sentinelDropped !== 0) reasons.push(`sentinel=${snap.sentinelDropped}`);
  if (snap.frames.length < 500) reasons.push(`frames=${snap.frames.length}<500`);
  let lastT = -Infinity;
  for (const f of snap.frames) {
    if (!Number.isFinite(f.t) || f.t < lastT) {
      reasons.push("t not monotonic");
      break;
    }
    lastT = f.t;
  }
  return { ok: reasons.length === 0, reasons };
}
