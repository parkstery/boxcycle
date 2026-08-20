/**
 * S4-14 — 한 rAF 에서 local→peer buffer→displayDistM→카메라→DOM marker 를 한 시계로 남긴다.
 * 제품 ingest·보간·카메라 수학은 바꾸지 않는다. begin() 전에는 no-op.
 *
 * 시계 정본: performance.now() (rAF `now`). Date.now() 는 동반 기록.
 * ⑤⑥ 은 marker element 의 CSS transform px. 스크린샷 픽셀 군집이 아니다.
 */
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import { peekSampleVirtualDistanceM } from "./peerSyncDistanceSamplers";

const MAX_FRAMES = 20_000;

export type ChainAnchor = { x: number; y: number };

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
  peerAnchor: ChainAnchor | null;
  relX: number | null;
  relY: number | null;
};

export type ChainFrame = {
  /** 이 캡처 안에서 단조 증가. 한 rAF = 한 프레임. */
  frameSeq: number;
  perfNowMs: number;
  dateNowMs: number;
  localDistM: number;
  camLng: number;
  camLat: number;
  camBearing: number;
  camPitch: number;
  camZoom: number;
  selfAnchor: ChainAnchor | null;
  peers: ChainPeerRow[];
};

export type ChainDump = {
  instruction: "S4-14";
  conditionId: string | null;
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  clockCanonical: "performance.now";
  sameRaf: true;
  pixelAnalysis: false;
  frames: ChainFrame[];
};

type MapLike = {
  getCenter: () => { lng: number; lat: number };
  getBearing: () => number;
  getPitch: () => number;
  getZoom: () => number;
};

let recording = false;
let conditionId: string | null = null;
let windowStartedAt: number | null = null;
let frames: ChainFrame[] = [];
let frameSeq = 0;

export function isPeerChainCapturing(): boolean {
  return recording;
}

export function beginPeerChainCapture(condition?: string | null): void {
  recording = true;
  conditionId = condition ?? null;
  windowStartedAt = performance.now();
  frames = [];
  frameSeq = 0;
}

export function endPeerChainCapture(): ChainDump {
  recording = false;
  const dump: ChainDump = {
    instruction: "S4-14",
    conditionId,
    windowStartedAt,
    windowEndedAt: performance.now(),
    clockCanonical: "performance.now",
    sameRaf: true,
    pixelAnalysis: false,
    frames,
  };
  return dump;
}

export function resetPeerChainCaptureForTests(): void {
  recording = false;
  conditionId = null;
  windowStartedAt = null;
  frames = [];
  frameSeq = 0;
}

export function snapshotPeerChainCapture(): ChainDump {
  return {
    instruction: "S4-14",
    conditionId,
    windowStartedAt,
    windowEndedAt: recording ? performance.now() : null,
    clockCanonical: "performance.now",
    sameRaf: true,
    pixelAnalysis: false,
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
  const matrix3dRe =
    /matrix3d\(\s*([-0-9.eE+, ]+)\)/gi;
  const matrixRe = /matrix\(\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*,\s*([-0-9.eE+]+)\s*\)/gi;

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

export function notePeerChainFromMapTick(opts: {
  perfNowMs: number;
  map: MapLike | null;
  selfEl: HTMLElement | null;
  peerEls: ReadonlyMap<string, HTMLElement>;
}): void {
  if (!recording) return;
  if (!opts.map) return;
  const dateNowMs = Date.now();
  const localDistM = peekSampleVirtualDistanceM();
  const center = opts.map.getCenter();
  const selfAnchor = readMarkerTranslatePx(opts.selfEl);
  const ents = getPeerMotionRegistry().peekChainEntities(dateNowMs);
  const peers: ChainPeerRow[] = ents.map((e) => {
    const peerAnchor = readMarkerTranslatePx(opts.peerEls.get(e.uid) ?? null);
    const relX = peerAnchor && selfAnchor ? peerAnchor.x - selfAnchor.x : null;
    const relY = peerAnchor && selfAnchor ? peerAnchor.y - selfAnchor.y : null;
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
      peerAnchor,
      relX,
      relY,
    };
  });
  frameSeq += 1;
  const frame: ChainFrame = {
    frameSeq,
    perfNowMs: opts.perfNowMs,
    dateNowMs,
    localDistM: Number.isFinite(localDistM) ? localDistM : Number.NaN,
    camLng: center.lng,
    camLat: center.lat,
    camBearing: opts.map.getBearing(),
    camPitch: opts.map.getPitch(),
    camZoom: opts.map.getZoom(),
    selfAnchor,
    peers,
  };
  if (frames.length >= MAX_FRAMES) frames.shift();
  frames.push(frame);
}
