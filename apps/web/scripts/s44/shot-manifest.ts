/**
 * S4-4R5 — 샷↔프레임 짝짓기 · ③ 크기 상위/하위 연속 묶음.
 * 제품 판정 기준은 (peer − self) 진행축. 조용한 구간 대조는 쓰지 않는다.
 */

export type ShotStamp = {
  i: number;
  atMs: number;
  file: string;
};

export type DisplayStamp = {
  atMs: number;
  gapDistM?: number | null;
  screenX?: number | null;
  localScreenX?: number | null;
};

export type RelSample = {
  atMs: number;
  relSPx: number;
  localSPx?: number;
  peerSPx?: number;
};

export type ReverseStamp = {
  atMs: number;
  magPx: number;
  relSPx: number;
  gapDistM?: number | null;
  displayIndex?: number;
};

export type ShotManifestEntry = {
  file: string;
  shotIndex: number;
  shotAtMs: number;
  frameIndex: number | null;
  atMs: number | null;
  relSPx: number | null;
  gapDistM: number | null;
  dtMs: number | null;
  localSPx: number | null;
  peerSPx: number | null;
  localScreenX: number | null;
  peerScreenX: number | null;
};

export type MagnitudeBundle = {
  kind: "top" | "bottom";
  startShotIndex: number;
  endShotIndexExclusive: number;
  files: string[];
  meanAbsRelSPx: number | null;
  maxAbsRelSPx: number | null;
  reverseCount: number;
  localScreenXRangePx: number | null;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function nearestIndex(atMs: number, items: readonly { atMs: number }[]): number | null {
  if (items.length === 0) return null;
  let best = 0;
  let bestD = Math.abs(items[0]!.atMs - atMs);
  for (let i = 1; i < items.length; i += 1) {
    const d = Math.abs(items[i]!.atMs - atMs);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

export function medianShotIntervalMs(shots: readonly ShotStamp[]): number | null {
  const dts: number[] = [];
  const ordered = [...shots].sort((a, b) => a.atMs - b.atMs);
  for (let i = 1; i < ordered.length; i += 1) {
    dts.push(ordered[i]!.atMs - ordered[i - 1]!.atMs);
  }
  return median(dts);
}

export function peakShotSeparationMs(
  peakAtMs: number | null | undefined,
  shots: readonly ShotStamp[],
): number | null {
  if (peakAtMs == null || shots.length === 0) return null;
  const i = nearestIndex(peakAtMs, shots);
  if (i == null) return null;
  return Math.abs(shots[i]!.atMs - peakAtMs);
}

export function buildShotManifest(
  shots: readonly ShotStamp[],
  display: readonly DisplayStamp[],
  samples: readonly RelSample[],
): ShotManifestEntry[] {
  return shots.map((shot) => {
    const di = nearestIndex(shot.atMs, display);
    const si = nearestIndex(shot.atMs, samples);
    const ev = di != null ? display[di]! : null;
    const sm = si != null ? samples[si]! : null;
    return {
      file: shot.file,
      shotIndex: shot.i,
      shotAtMs: shot.atMs,
      frameIndex: di,
      atMs: ev?.atMs ?? null,
      relSPx: sm?.relSPx ?? null,
      gapDistM: ev?.gapDistM ?? null,
      dtMs: ev != null ? Math.abs(ev.atMs - shot.atMs) : null,
      localSPx: sm?.localSPx ?? null,
      peerSPx: sm?.peerSPx ?? null,
      localScreenX: ev?.localScreenX ?? null,
      peerScreenX: ev?.screenX ?? null,
    };
  });
}

function bundleFromRange(
  kind: "top" | "bottom",
  start: number,
  len: number,
  manifest: readonly ShotManifestEntry[],
  reverses: readonly ReverseStamp[],
): MagnitudeBundle {
  const slice = manifest.slice(start, start + len);
  const t0 = slice[0]!.shotAtMs;
  const t1 = slice[slice.length - 1]!.shotAtMs;
  const absRel = slice.map((e) => (e.relSPx != null ? Math.abs(e.relSPx) : null)).filter((v): v is number => v != null);
  const localXs = slice.map((e) => e.localScreenX).filter((v): v is number => v != null);
  const inWin = reverses.filter((r) => r.atMs >= t0 && r.atMs <= t1);
  return {
    kind,
    startShotIndex: start,
    endShotIndexExclusive: start + len,
    files: slice.map((e) => e.file),
    meanAbsRelSPx: absRel.length ? absRel.reduce((a, b) => a + b, 0) / absRel.length : null,
    maxAbsRelSPx: absRel.length ? Math.max(...absRel) : null,
    reverseCount: inWin.length,
    localScreenXRangePx:
      localXs.length >= 2 ? Math.max(...localXs) - Math.min(...localXs) : localXs.length === 1 ? 0 : null,
  };
}

function centerStart(shotIndices: readonly number[], bundleLen: number, shotCount: number): number {
  if (shotIndices.length === 0) return 0;
  const s = [...shotIndices].sort((a, b) => a - b);
  const mid = s[Math.floor(s.length / 2)]!;
  const half = Math.floor(bundleLen / 2);
  return Math.max(0, Math.min(shotCount - bundleLen, mid - half));
}

/**
 * ③ 반전 크기 상위 10% / 하위 10% 의 시각을 중심으로
 * 같은 길이·같은 샷 간격의 연속 묶음을 뽑는다.
 */
export function pickMagnitudeBundles(
  manifest: readonly ShotManifestEntry[],
  reverses: readonly ReverseStamp[],
  bundleLen = 8,
): { top: MagnitudeBundle | null; bottom: MagnitudeBundle | null; bundleLen: number } {
  if (manifest.length < 2 || bundleLen < 2) {
    return { top: null, bottom: null, bundleLen };
  }
  const len = Math.min(bundleLen, manifest.length);
  if (reverses.length === 0) {
    return { top: null, bottom: null, bundleLen: len };
  }
  const sorted = [...reverses].sort((a, b) => b.magPx - a.magPx);
  const decile = Math.max(1, Math.floor(sorted.length * 0.1));
  const topRevs = sorted.slice(0, decile);
  const botRevs = sorted.slice(-decile);

  const shotOf = (atMs: number) => {
    const i = nearestIndex(atMs, manifest.map((m) => ({ atMs: m.shotAtMs })));
    return i ?? 0;
  };
  const topStart = centerStart(
    topRevs.map((r) => shotOf(r.atMs)),
    len,
    manifest.length,
  );
  let botStart = centerStart(
    botRevs.map((r) => shotOf(r.atMs)),
    len,
    manifest.length,
  );
  const overlap = !(botStart + len <= topStart || topStart + len <= botStart);
  if (overlap) {
    if (topStart + len + len <= manifest.length) botStart = topStart + len;
    else if (topStart - len >= 0) botStart = topStart - len;
  }
  return {
    top: bundleFromRange("top", topStart, len, manifest, reverses),
    bottom: bundleFromRange("bottom", botStart, len, manifest, reverses),
    bundleLen: len,
  };
}
