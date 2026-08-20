/**
 * S4-4R7 — 화면 픽셀에서 self/peer 마커를 직접 잰다. map.project 를 쓰지 않는다.
 *
 * 판별: 네임태그 글자색 (self=#1d4ed8 파랑, peer=#0f766e 틸). 위치로 짐작하지 않는다.
 * 위치: 네임태그 아래 주황 자전거 픽셀의 무게중심 (R6 자가 검산과 같은 점).
 */
export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
};

export type MarkerHit = {
  role: "self" | "peer";
  x: number;
  y: number;
  n: number;
  nametagX: number;
  nametagY: number;
  nametagN: number;
  reason: string;
};

export type ExtractResult = {
  width: number;
  height: number;
  self: MarkerHit | null;
  peer: MarkerHit | null;
  riderClusters: Array<{ x: number; y: number; n: number }>;
  failReasons: string[];
};

export const SELF_NAMETAG_RGB = { r: 0x1d, g: 0x4e, b: 0xd8 };
export const PEER_NAMETAG_RGB = { r: 0x0f, g: 0x76, b: 0x6e };

/** R6 가 S44R4 PNG 에서 읽은 self 정답. 추출기는 이 범위를 재현해야 한다. */
export const S0_SELF_X_MIN = 635.7;
export const S0_SELF_X_MAX = 636.4;
export const S0_FILES = ["F000.png", "F003.png", "F006.png"] as const;
export const S0_KNOWN: Record<(typeof S0_FILES)[number], number> = {
  "F000.png": 635.7,
  "F003.png": 636.2,
  "F006.png": 636.4,
};

export function isOrangeBikePixel(r: number, g: number, b: number): boolean {
  // 노란 경로선(g 높음)을 빼고 주황 자전거만.
  return r >= 150 && g >= 70 && g <= 135 && b <= 90 && r > g + 40 && r > b + 40;
}

/** JPEG 축소본용 — 채도가 내려가도 주황 자전거를 남긴다. */
export function isOrangeBikePixelLoose(r: number, g: number, b: number): boolean {
  return r >= 110 && g >= 45 && b <= 120 && r > b + 20 && r >= g;
}

function colorDist(r: number, g: number, b: number, t: { r: number; g: number; b: number }): number {
  return Math.hypot(r - t.r, g - t.g, b - t.b);
}

export function isSelfNametagPixel(r: number, g: number, b: number): boolean {
  if (b < 140 || b <= r + 40 || b <= g + 40) return false;
  return colorDist(r, g, b, SELF_NAMETAG_RGB) < 90 || (r < 80 && g < 130 && b > 170);
}

export function isPeerNametagPixel(r: number, g: number, b: number): boolean {
  if (g < 80 || r > 80 || b < 60 || b > 180) return false;
  return g > r + 30 && Math.abs(g - b) < 50;
}

type Pt = { x: number; y: number };

function cluster(points: readonly Pt[], dist: number, minN: number): Array<{ x: number; y: number; n: number }> {
  const acc: Array<{ sx: number; sy: number; n: number }> = [];
  for (const p of points) {
    let hit = false;
    for (const c of acc) {
      const cx = c.sx / c.n;
      const cy = c.sy / c.n;
      if (Math.abs(p.x - cx) < dist && Math.abs(p.y - cy) < dist) {
        c.sx += p.x;
        c.sy += p.y;
        c.n += 1;
        hit = true;
        break;
      }
    }
    if (!hit) acc.push({ sx: p.x, sy: p.y, n: 1 });
  }
  return acc
    .filter((c) => c.n >= minN)
    .map((c) => ({ x: c.sx / c.n, y: c.sy / c.n, n: c.n }))
    .sort((a, b) => a.x - b.x);
}

function collect(
  img: RgbaImage,
  pred: (r: number, g: number, b: number) => boolean,
  roi: { x0: number; x1: number; y0: number; y1: number },
): Pt[] {
  const out: Pt[] = [];
  const { width, data } = img;
  const x0 = Math.max(0, roi.x0 | 0);
  const x1 = Math.min(width - 1, roi.x1 | 0);
  const y0 = Math.max(0, roi.y0 | 0);
  const y1 = Math.min(img.height - 1, roi.y1 | 0);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * width + x) * 4;
      if (pred(data[i]!, data[i + 1]!, data[i + 2]!)) out.push({ x, y });
    }
  }
  return out;
}

function centroidOf(points: readonly Pt[]): { x: number; y: number; n: number } | null {
  if (points.length < 8) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length, n: points.length };
}

function nearest(of: { x: number; y: number }, items: Array<{ x: number; y: number; n: number }>) {
  if (items.length === 0) return null;
  let best = items[0]!;
  let bestD = Math.hypot(of.x - best.x, of.y - best.y);
  for (let i = 1; i < items.length; i += 1) {
    const d = Math.hypot(of.x - items[i]!.x, of.y - items[i]!.y);
    if (d < bestD) {
      best = items[i]!;
      bestD = d;
    }
  }
  return { hit: best, dist: bestD };
}

function bikeUnderTag(
  img: RgbaImage,
  tag: { x: number; y: number },
  pred: (r: number, g: number, b: number) => boolean,
) {
  return centroidOf(
    collect(img, pred, {
      x0: tag.x - 28,
      x1: tag.x + 28,
      y0: tag.y - 2,
      y1: tag.y + 70,
    }),
  );
}

export function extractMarkers(
  img: RgbaImage,
  opts: {
    bikePred?: (r: number, g: number, b: number) => boolean;
    jpeg?: boolean;
    fullFrame?: boolean;
    originX?: number;
    originY?: number;
  } = {},
): ExtractResult {
  const failReasons: string[] = [];
  const bikePred = opts.bikePred ?? (opts.jpeg ? isOrangeBikePixelLoose : isOrangeBikePixel);
  const w = img.width;
  const h = img.height;
  const mapBand = opts.fullFrame
    ? { x0: 0, x1: w - 1, y0: 0, y1: h - 1 }
    : {
        x0: Math.floor(w * 0.35),
        x1: Math.floor(w * 0.58),
        y0: Math.floor(h * 0.38),
        y1: Math.floor(h * 0.56),
      };
  const tagBand = opts.fullFrame
    ? { x0: 0, x1: w - 1, y0: 0, y1: h - 1 }
    : {
        x0: Math.floor(w * 0.32),
        x1: Math.floor(w * 0.62),
        y0: Math.floor(h * 0.32),
        y1: Math.floor(h * 0.5),
      };
  const riders = cluster(collect(img, bikePred, mapBand), opts.jpeg ? 18 : 28, opts.jpeg ? 4 : 8)
    .filter((r) => (opts.jpeg ? true : r.n <= 44));
  const selfTags = cluster(collect(img, isSelfNametagPixel, tagBand), 22, 6);
  const peerTags = cluster(collect(img, isPeerNametagPixel, tagBand), 22, 6);

  const selfTag = selfTags.sort((a, b) => b.n - a.n)[0] ?? null;
  const peerTag = peerTags.sort((a, b) => b.n - a.n)[0] ?? null;

  let self: MarkerHit | null = null;
  let peer: MarkerHit | null = null;

  if (!selfTag) failReasons.push("self 네임태그(#1d4ed8 파랑) 없음");
  if (!peerTag) failReasons.push("peer 네임태그(#0f766e 틸) 없음");
  // 한쪽만 잡히면 지도 틸 배경 오탐이다. 둘 다 있을 때만 라벨로 판별한다.
  if (!selfTag || !peerTag) {
    return { width: w, height: h, self: null, peer: null, riderClusters: riders, failReasons };
  }

  if (selfTag) {
    const aligned = riders.filter((r) => Math.abs(r.x - selfTag.x) < 36);
    const below = aligned.filter((r) => r.y > selfTag.y - 4);
    const n = nearest(selfTag, below.length ? below : aligned);
    const hit = n && n.dist < (opts.jpeg ? 80 : 120) ? n.hit : bikeUnderTag(img, selfTag, bikePred);
    if (hit) {
      self = {
        role: "self",
        x: hit.x + (opts.originX ?? 0),
        y: hit.y + (opts.originY ?? 0),
        n: hit.n,
        nametagX: selfTag.x + (opts.originX ?? 0),
        nametagY: selfTag.y + (opts.originY ?? 0),
        nametagN: selfTag.n,
        reason: "네임태그 글자색 #1d4ed8(live 파랑). 그 아래 주황 자전거 무게중심.",
      };
    } else {
      failReasons.push("self 네임태그 아래 자전거 군집 없음");
    }
  }
  if (peerTag) {
    const aligned = riders.filter((r) => Math.abs(r.x - peerTag.x) < 36);
    const below = aligned.filter((r) => r.y > peerTag.y - 4);
    const n = nearest(peerTag, below.length ? below : aligned);
    const hit = n && n.dist < (opts.jpeg ? 80 : 120) ? n.hit : bikeUnderTag(img, peerTag, bikePred);
    if (hit) {
      peer = {
        role: "peer",
        x: hit.x + (opts.originX ?? 0),
        y: hit.y + (opts.originY ?? 0),
        n: hit.n,
        nametagX: peerTag.x + (opts.originX ?? 0),
        nametagY: peerTag.y + (opts.originY ?? 0),
        nametagN: peerTag.n,
        reason: "네임태그 글자색 #0f766e(peer 틸). 그 아래 주황 자전거 무게중심.",
      };
    } else {
      failReasons.push("peer 네임태그 아래 자전거 군집 없음");
    }
  }

  return { width: w, height: h, self, peer, riderClusters: riders, failReasons };
}

export type PixelSeriesStats = {
  n: number;
  minX: number;
  maxX: number;
  peakToPeakPx: number;
  reverseCount: number;
  maxAbsDeltaPx: number;
  deltas: number[];
};

export function pixelSeriesStats(xs: readonly number[]): PixelSeriesStats {
  if (xs.length === 0) {
    return { n: 0, minX: 0, maxX: 0, peakToPeakPx: 0, reverseCount: 0, maxAbsDeltaPx: 0, deltas: [] };
  }
  const deltas: number[] = [];
  for (let i = 1; i < xs.length; i += 1) deltas.push(xs[i]! - xs[i - 1]!);
  let reverseCount = 0;
  for (let i = 1; i < deltas.length; i += 1) {
    if (deltas[i]! * deltas[i - 1]! < 0) reverseCount += 1;
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return {
    n: xs.length,
    minX,
    maxX,
    peakToPeakPx: maxX - minX,
    reverseCount,
    maxAbsDeltaPx: deltas.length ? Math.max(...deltas.map((d) => Math.abs(d))) : 0,
    deltas,
  };
}

export function selfCheckS0(selfX: number): boolean {
  return selfX >= S0_SELF_X_MIN - 0.15 && selfX <= S0_SELF_X_MAX + 0.15;
}
