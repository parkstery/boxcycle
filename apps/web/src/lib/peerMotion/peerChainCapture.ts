/**
 * S4-14/S4-15 — 한 rAF 에서 local→displayDistM→렌더 lngLat→project→DOM 을 한 시계로 남긴다.
 * 제품 ingest·보간·카메라 수학·마커 로직은 바꾸지 않는다. begin() 전에는 no-op.
 *
 * 시계 정본: performance.now() (rAF `now`). Date.now() 는 동반 기록.
 * ② peer/self lngLat 은 그 프레임 렌더가 setLngLat 에 쓴 값. 경로 함수를 다시 돌리지 않는다.
 * DOM 은 marker element 의 CSS transform px. 스크린샷 픽셀 군집이 아니다.
 */
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import {
  peekSampleAppliedSpeedKmh,
  peekSampleVirtualDistanceM,
} from "./peerSyncDistanceSamplers";

const MAX_FRAMES = 20_000;

export type ChainAnchor = { x: number; y: number };

export type ChainPeerFeature = {
  geometry: { coordinates: [number, number] };
  properties: { id: string };
};

export type ChainPeerRow = {
  uid: string;
  phase: string;
  displayDistM: number;
  bufLen: number;
  axis: "server" | "recv";
  newestDistM: number | null;
  newestSpeedMps: number | null;
  newestServerAtMs: number | null;
  newestRecvAtMs: number | null;
  newestSeq: number | null;
  /** ② 렌더가 그 프레임에 쓴 peer lng/lat. 재계산 아님. */
  lng: number | null;
  lat: number | null;
  /** ③ map.project(peerLngLat) */
  projX: number | null;
  projY: number | null;
  /** ⑤ projected peer − self */
  relProjX: number | null;
  relProjY: number | null;
  peerAnchor: ChainAnchor | null;
  /** ⑥ DOM peer − self */
  relX: number | null;
  relY: number | null;
};

export type ChainFrame = {
  /** 이 캡처 안에서 단조 증가. 한 rAF = 한 프레임. */
  frameSeq: number;
  perfNowMs: number;
  dateNowMs: number;
  localDistM: number;
  localSpeedKmh: number;
  /** displayDistM − localDistM. 창 전체 Chief 근접 검증용. */
  gapDistM: number | null;
  camLng: number;
  camLat: number;
  camBearing: number;
  camPitch: number;
  camZoom: number;
  /** ⑦ 마지막 map.on("render") 시각 (performance.now) */
  mapRenderPerfMs: number | null;
  /** rAF now − 마지막 render. render 가 더 늦으면 음수. */
  rafMinusRenderMs: number | null;
  /** 이 틱 note 직전까지의 경과 (rAF 콜백 안). D2 설명용. */
  tickWorkMs: number;
  selfLng: number | null;
  selfLat: number | null;
  selfProjX: number | null;
  selfProjY: number | null;
  selfAnchor: ChainAnchor | null;
  peers: ChainPeerRow[];
};

export type ChainDump = {
  instruction: "S4-14" | "S4-15";
  conditionId: string | null;
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  clockCanonical: "performance.now";
  sameRaf: true;
  pixelAnalysis: false;
  lngLatSource: "render-setLngLat";
  tickKind: "requestAnimationFrame";
  frames: ChainFrame[];
};

type MapLike = {
  getCenter: () => { lng: number; lat: number };
  getBearing: () => number;
  getPitch: () => number;
  getZoom: () => number;
  project?: (ll: { lng: number; lat: number }) => { x: number; y: number };
};

let recording = false;
let dumpInstruction: "S4-14" | "S4-15" = "S4-15";
let conditionId: string | null = null;
let windowStartedAt: number | null = null;
let frames: ChainFrame[] = [];
let frameSeq = 0;
let lastMapRenderPerfMs: number | null = null;

export function isPeerChainCapturing(): boolean {
  return recording;
}

/** DEV — map.on("render") 에서만 호출. 카메라 수학을 바꾸지 않는다. */
export function noteMapboxRender(perfNowMs: number): void {
  lastMapRenderPerfMs = perfNowMs;
}

export function beginPeerChainCapture(
  condition?: string | null,
  opts?: { instruction?: "S4-14" | "S4-15" },
): void {
  recording = true;
  dumpInstruction = opts?.instruction ?? "S4-15";
  conditionId = condition ?? null;
  windowStartedAt = performance.now();
  frames = [];
  frameSeq = 0;
}

export function endPeerChainCapture(): ChainDump {
  recording = false;
  const dump: ChainDump = {
    instruction: dumpInstruction,
    conditionId,
    windowStartedAt,
    windowEndedAt: performance.now(),
    clockCanonical: "performance.now",
    sameRaf: true,
    pixelAnalysis: false,
    lngLatSource: "render-setLngLat",
    tickKind: "requestAnimationFrame",
    frames,
  };
  return dump;
}

export function resetPeerChainCaptureForTests(): void {
  recording = false;
  dumpInstruction = "S4-15";
  conditionId = null;
  windowStartedAt = null;
  frames = [];
  frameSeq = 0;
  lastMapRenderPerfMs = null;
}

export function snapshotPeerChainCapture(): ChainDump {
  return {
    instruction: dumpInstruction,
    conditionId,
    windowStartedAt,
    windowEndedAt: recording ? performance.now() : null,
    clockCanonical: "performance.now",
    sameRaf: true,
    pixelAnalysis: false,
    lngLatSource: "render-setLngLat",
    tickKind: "requestAnimationFrame",
    frames: frames.slice(),
  };
}

/**
 * mapbox marker 가 쓴 translate px. % 앵커는 버리고 px·matrix 의 이동만 합친다.
 * 스크린샷·무게중심이 아니다.
 */
export function readMarkerTranslatePx(el: HTMLElement | null | undefined): ChainAnchor | null {
  if (!el) return null;
  const raw = el.style.transform || (typeof getComputedStyle === "function" ? getComputedStyle(el).transform : "");
  if (!raw || raw === "none") return null;
  return parseTransformTranslatePx(raw);
}

export function parseTransformTranslatePx(raw: string): ChainAnchor | null {
  let x = 0;
  let y = 0;
  let hit = false;
  const translateRe = /translate3d\(\s*([-0-9.]+)px\s*,\s*([-0-9.]+)px\s*,\s*[-0-9.]+px\s*\)/gi;
  const translate2Re = /translate\(\s*([-0-9.]+)px\s*,\s*([-0-9.]+)px\s*\)/gi;
  const translateXRe = /translateX\(\s*([-0-9.]+)px\s*\)/gi;
  const translateYRe = /translateY\(\s*([-0-9.]+)px\s*\)/gi;
  const matrix3dRe = /matrix3d\(\s*([-0-9.eE+, ]+)\)/gi;
  const matrixRe =
    /matrix\(\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*\)/gi;

  let m: RegExpExecArray | null;
  while ((m = translateRe.exec(raw))) {
    x += Number(m[1]);
    y += Number(m[2]);
    hit = true;
  }
  while ((m = translate2Re.exec(raw))) {
    x += Number(m[1]);
    y += Number(m[2]);
    hit = true;
  }
  while ((m = translateXRe.exec(raw))) {
    x += Number(m[1]);
    hit = true;
  }
  while ((m = translateYRe.exec(raw))) {
    y += Number(m[1]);
    hit = true;
  }
  while ((m = matrixRe.exec(raw))) {
    x += Number(m[5]);
    y += Number(m[6]);
    hit = true;
  }
  while ((m = matrix3dRe.exec(raw))) {
    const parts = m[1]!.split(",").map((s) => Number(s.trim()));
    if (parts.length >= 14) {
      x += parts[12]!;
      y += parts[13]!;
      hit = true;
    }
  }
  if (!hit || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** 정렬용 — 기록 없어도 displayDistM − localDistM. 픽셀 아님. */
export function peekChainGapM(): number | null {
  const local = peekSampleVirtualDistanceM();
  if (!Number.isFinite(local)) return null;
  const ents = getPeerMotionRegistry().peekChainEntities(Date.now());
  if (ents.length === 0) return null;
  return ents[0]!.displayDistM - local;
}

function projectLl(map: MapLike, lng: number, lat: number): ChainAnchor | null {
  if (typeof map.project !== "function") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const p = map.project({ lng, lat });
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: p.x, y: p.y };
}

function featureLngLat(
  features: ReadonlyArray<ChainPeerFeature> | undefined,
  uid: string,
): [number, number] | null {
  if (!features) return null;
  const f = features.find((row) => row.properties.id === uid);
  const c = f?.geometry.coordinates;
  if (!c || c.length < 2) return null;
  const lng = c[0];
  const lat = c[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

export function notePeerChainFromMapTick(opts: {
  perfNowMs: number;
  map: MapLike | null;
  selfEl: HTMLElement | null;
  peerEls: ReadonlyMap<string, HTMLElement>;
  /** ④ 그 프레임 liveMarker.setLngLat 에 쓴 값. 경로 재계산 금지. */
  selfLngLat?: [number, number] | null;
  /** ② syncPeerDomMarkers 에 넘긴 그 features. 경로 재계산 금지. */
  peerFeatures?: ReadonlyArray<ChainPeerFeature>;
}): void {
  if (!recording) return;
  const map = opts.map;
  if (!map) return;
  const dateNowMs = Date.now();
  const localDistM = peekSampleVirtualDistanceM();
  const localSpeedKmh = peekSampleAppliedSpeedKmh();
  const center = map.getCenter();
  const selfAnchor = readMarkerTranslatePx(opts.selfEl);
  const selfLngLat = opts.selfLngLat ?? null;
  const selfLng = selfLngLat && Number.isFinite(selfLngLat[0]) ? selfLngLat[0] : null;
  const selfLat = selfLngLat && Number.isFinite(selfLngLat[1]) ? selfLngLat[1] : null;
  const selfProj =
    selfLng != null && selfLat != null ? projectLl(map, selfLng, selfLat) : null;
  const ents = getPeerMotionRegistry().peekChainEntities(dateNowMs);
  const peers: ChainPeerRow[] = ents.map((e) => {
    const peerAnchor = readMarkerTranslatePx(opts.peerEls.get(e.uid) ?? null);
    const relX = peerAnchor && selfAnchor ? peerAnchor.x - selfAnchor.x : null;
    const relY = peerAnchor && selfAnchor ? peerAnchor.y - selfAnchor.y : null;
    const ll = featureLngLat(opts.peerFeatures, e.uid);
    const proj = ll ? projectLl(map, ll[0], ll[1]) : null;
    const relProjX = proj && selfProj ? proj.x - selfProj.x : null;
    const relProjY = proj && selfProj ? proj.y - selfProj.y : null;
    return {
      uid: e.uid,
      phase: e.phase,
      displayDistM: e.displayDistM,
      bufLen: e.bufLen,
      axis: e.usedServerAxis ? "server" : "recv",
      newestDistM: e.newest?.distM ?? null,
      newestSpeedMps: e.newest?.speedMps ?? null,
      newestServerAtMs: e.newest?.serverAtMs ?? null,
      newestRecvAtMs: e.newest?.recvAtMs ?? null,
      newestSeq: e.newest?.seq ?? null,
      lng: ll ? ll[0] : null,
      lat: ll ? ll[1] : null,
      projX: proj?.x ?? null,
      projY: proj?.y ?? null,
      relProjX,
      relProjY,
      peerAnchor,
      relX,
      relY,
    };
  });
  const gapDistM = peers.length > 0 && Number.isFinite(localDistM) ? peers[0]!.displayDistM - localDistM : null;
  frameSeq += 1;
  const renderAt = lastMapRenderPerfMs;
  const frame: ChainFrame = {
    frameSeq,
    perfNowMs: opts.perfNowMs,
    dateNowMs,
    localDistM: Number.isFinite(localDistM) ? localDistM : Number.NaN,
    localSpeedKmh: Number.isFinite(localSpeedKmh) ? localSpeedKmh : Number.NaN,
    gapDistM,
    camLng: center.lng,
    camLat: center.lat,
    camBearing: map.getBearing(),
    camPitch: map.getPitch(),
    camZoom: map.getZoom(),
    mapRenderPerfMs: renderAt,
    rafMinusRenderMs: renderAt != null ? opts.perfNowMs - renderAt : null,
    tickWorkMs: performance.now() - opts.perfNowMs,
    selfLng,
    selfLat,
    selfProjX: selfProj?.x ?? null,
    selfProjY: selfProj?.y ?? null,
    selfAnchor,
    peers,
  };
  if (frames.length >= MAX_FRAMES) frames.shift();
  frames.push(frame);
}
