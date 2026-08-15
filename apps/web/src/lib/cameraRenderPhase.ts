/**
 * U-5 DEV — jumpTo 쓰기 vs Mapbox render 가 실제로 채택한 카메라.
 * writeSeq 는 jumpTo 직전. render 는 map.on("render") 에서 getCenter/getZoom/getBearing.
 */

import type { LngLat } from "./geo";
import { getDistanceMeters } from "./geo";

export type CameraWriteSample = {
  seq: number;
  t: number;
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
};

export type CameraRenderSample = {
  t: number;
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  adoptedSeq: number;
  lagFrames: number;
  writeZoom: number | null;
};

export type CameraRenderPhaseSnapshot = {
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sentinelDropped: number;
  writeCount: number;
  renderCount: number;
  writes: CameraWriteSample[];
  renders: CameraRenderSample[];
};

type Probe = {
  active: boolean;
  startedAt: number;
  sentinelDropped: number;
  writeSeq: number;
  writes: CameraWriteSample[];
  renders: CameraRenderSample[];
};

let probe: Probe | null = null;
const hooked = new WeakSet<mapboxgl.Map>();

function finite(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) < 1e12;
}

function shortestAngleDelta(from: number, to: number): number {
  let n = (to - from) % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
}

function camerasMatch(
  write: CameraWriteSample,
  lng: number,
  lat: number,
  bearing: number,
): boolean {
  if (getDistanceMeters([write.lng, write.lat], [lng, lat]) > 0.05) return false;
  return Math.abs(shortestAngleDelta(write.bearing, bearing)) < 0.05;
}

export function startCameraRenderPhaseProbe(): void {
  if (!import.meta.env.DEV) return;
  probe = {
    active: true,
    startedAt: performance.now(),
    sentinelDropped: 0,
    writeSeq: 0,
    writes: [],
    renders: [],
  };
  publish(null);
}

export function stopCameraRenderPhaseProbe(): CameraRenderPhaseSnapshot | null {
  if (!import.meta.env.DEV || !probe) return null;
  const snap = snapshotCameraRenderPhaseProbe();
  probe.active = false;
  publish(snap);
  return snap;
}

export function snapshotCameraRenderPhaseProbe(): CameraRenderPhaseSnapshot | null {
  if (!probe) return null;
  const endedAt = performance.now();
  return {
    startedAt: probe.startedAt,
    endedAt,
    durationMs: endedAt - probe.startedAt,
    sentinelDropped: probe.sentinelDropped,
    writeCount: probe.writes.length,
    renderCount: probe.renders.length,
    writes: probe.writes,
    renders: probe.renders,
  };
}

export function noteCameraWrite(input: {
  t: number;
  center: LngLat;
  zoom: number;
  bearing: number;
}): void {
  if (!import.meta.env.DEV || !probe?.active) return;
  const { t, center, zoom, bearing } = input;
  if (!finite(t) || !finite(center[0]) || !finite(center[1]) || !finite(zoom) || !finite(bearing)) {
    probe.sentinelDropped += 1;
    return;
  }
  probe.writeSeq += 1;
  const row: CameraWriteSample = {
    seq: probe.writeSeq,
    t,
    lng: center[0],
    lat: center[1],
    zoom,
    bearing,
  };
  probe.writes.push(row);
  publishCount();
}

export function noteCameraRenderFromMap(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV || !probe?.active) return;
  const c = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const t = performance.now();
  if (!finite(c.lng) || !finite(c.lat) || !finite(zoom) || !finite(bearing) || !finite(t)) {
    probe.sentinelDropped += 1;
    return;
  }
  let adoptedSeq = 0;
  for (let i = probe.writes.length - 1; i >= 0; i -= 1) {
    const w = probe.writes[i]!;
    if (camerasMatch(w, c.lng, c.lat, bearing)) {
      adoptedSeq = w.seq;
      break;
    }
  }
  if (adoptedSeq === 0 && probe.writes.length > 0) {
    probe.sentinelDropped += 1;
    return;
  }
  const lagFrames = probe.writeSeq - adoptedSeq;
  if (!finite(lagFrames) || lagFrames < 0) {
    probe.sentinelDropped += 1;
    return;
  }
  const adopted = probe.writes.find((w) => w.seq === adoptedSeq) ?? null;
  probe.renders.push({
    t,
    lng: c.lng,
    lat: c.lat,
    zoom,
    bearing,
    adoptedSeq,
    lagFrames,
    writeZoom: adopted?.zoom ?? null,
  });
  publishCount();
}

export function installCameraRenderPhaseHook(map: mapboxgl.Map): void {
  if (!import.meta.env.DEV || hooked.has(map)) return;
  hooked.add(map);
  map.on("render", () => {
    noteCameraRenderFromMap(map);
  });
}

function publishCount(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & {
    __RTW_CAMERA_PHASE_WRITE_N__?: number;
    __RTW_CAMERA_PHASE_RENDER_N__?: number;
  };
  w.__RTW_CAMERA_PHASE_WRITE_N__ = probe?.writes.length ?? 0;
  w.__RTW_CAMERA_PHASE_RENDER_N__ = probe?.renders.length ?? 0;
}

function publish(snap: CameraRenderPhaseSnapshot | null): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & {
    __RTW_CAMERA_PHASE__?: CameraRenderPhaseSnapshot | null;
    __RTW_CAMERA_PHASE_START__?: () => void;
    __RTW_CAMERA_PHASE_STOP__?: () => CameraRenderPhaseSnapshot | null;
    __RTW_CAMERA_PHASE_WRITE_N__?: number;
    __RTW_CAMERA_PHASE_RENDER_N__?: number;
  };
  w.__RTW_CAMERA_PHASE__ = snap;
  w.__RTW_CAMERA_PHASE_START__ = startCameraRenderPhaseProbe;
  w.__RTW_CAMERA_PHASE_STOP__ = stopCameraRenderPhaseProbe;
  publishCount();
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  publish(null);
}
