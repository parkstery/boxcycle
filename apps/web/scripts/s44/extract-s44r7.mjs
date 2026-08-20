/**
 * S4-4R7 — 샷 디렉터리에서 self/peer 픽셀을 추출한다.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba } from "./decode-png.ts";
import {
  extractMarkers,
  pixelSeriesStats,
  S0_FILES,
  S0_KNOWN,
  S0_SELF_X_MAX,
  S0_SELF_X_MIN,
} from "./extract-marker-pixels.ts";
import { loadRaster } from "./load-raster.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../../../../document/ops/sync-relay");

const shotDir = resolve(process.argv[2] ?? resolve(OUT_DIR, "S44R5-shots"));
const outName = process.argv[3] ?? "S44R7-pixels.json";
const capturePath = process.argv[4] ? resolve(process.argv[4]) : null;

const R4 = resolve(OUT_DIR, "S44R4-shots");
const s0 = S0_FILES.map((file) => {
  const img = decodePngRgba(readFileSync(resolve(R4, file)));
  const extracted = extractMarkers(img);
  const selfX = extracted.self?.x ?? null;
  return {
    file,
    ok: selfX != null && Math.abs(selfX - S0_KNOWN[file]) < 0.15,
    selfX,
    known: S0_KNOWN[file],
    failReasons: extracted.failReasons,
  };
});
const s0Pass = s0.every((r) => r.ok);

const files = readdirSync(shotDir)
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .sort();

const jpeg = files.some((f) => /\.jpe?g$/i.test(f));
let clipOrigin = { originX: 0, originY: 0 };
try {
  const raw = JSON.parse(readFileSync(resolve(shotDir, "clip.json"), "utf8"));
  clipOrigin = { originX: Number(raw.originX) || 0, originY: Number(raw.originY) || 0 };
} catch {
  clipOrigin = { originX: 0, originY: 0 };
}
const shots = files.map((file) => {
  const path = resolve(shotDir, file);
  const img = jpeg ? loadRaster(path) : decodePngRgba(readFileSync(path));
  const clip = img.width < 900;
  const extracted = extractMarkers(img, {
    jpeg,
    fullFrame: clip,
    originX: clip ? clipOrigin.originX : 0,
    originY: clip ? clipOrigin.originY : 0,
  });
  return {
    file,
    width: img.width,
    height: img.height,
    selfX: extracted.self?.x ?? null,
    selfY: extracted.self?.y ?? null,
    selfN: extracted.self?.n ?? null,
    peerX: extracted.peer?.x ?? null,
    peerY: extracted.peer?.y ?? null,
    peerN: extracted.peer?.n ?? null,
    selfReason: extracted.self?.reason ?? null,
    peerReason: extracted.peer?.reason ?? null,
    failReasons: extracted.failReasons,
    riderClusterCount: extracted.riderClusters.length,
  };
});

const selfXs = shots.map((s) => s.selfX).filter((x) => x != null);
const peerXs = shots.map((s) => s.peerX).filter((x) => x != null);
const complete = shots.filter((s) => s.selfX != null && s.peerX != null);
const usable =
  s0Pass && complete.length === shots.length && shots.every((s) => s.failReasons.length === 0);
const ns = shots.map((s) => s.selfN).filter((n) => n != null);
const medianN = ns.length ? [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] : 0;
const centroidErrPx = medianN > 0 ? 0.5 / Math.sqrt(medianN) : null;

let projectionCompare = null;
if (capturePath) {
  const capture = JSON.parse(readFileSync(capturePath, "utf8"));
  const peerAlong = capture.judgment?.cameraSplit?.peerAlong ?? capture.peerAlong ?? null;
  const samples = capture.judgment?.cameraSplit?.samples ?? [];
  const projectXs = samples.map((s) => s.peerSPx).filter((x) => typeof x === "number");
  const projectStats = projectXs.length ? pixelSeriesStats(projectXs) : peerAlong;
  projectionCompare = {
    source: basename(capturePath),
    citedR5PeerAlong: { reverseCount: 16, maxReversePx: 5.6, peakToPeakPx: 9.3 },
    project: peerAlong ?? projectStats,
    pixel: usable ? pixelSeriesStats(peerXs) : null,
    note: usable
      ? "같은 창이면 계열(반전·최대|Δ|·진폭)을 비교한다. 절대 X 오프셋은 뷰포트 vs 캔버스라 기대한다."
      : "픽셀 추출이 불완전해 투영 대조를 하지 않는다.",
    seriesMatch:
      usable && peerAlong
        ? Math.abs((pixelSeriesStats(peerXs).peakToPeakPx) - (peerAlong.peakToPeakPx ?? 0)) < 2 &&
          Math.abs((pixelSeriesStats(peerXs).reverseCount) - (peerAlong.reverseCount ?? 0)) <= 2
        : null,
  };
}

const precision = {
  method: "주황 자전거 픽셀 군집 무게중심",
  medianSelfN: medianN,
  centroidErrPxEstimate: centroidErrPx,
  jpeg,
  jpegImpact: jpeg
    ? "S44R5 JPEG 는 480×270 맵 캔버스만이며 HTML 네임태그가 없다. 주황 경계가 압축으로 무너져 라이더를 놓친다."
    : "PNG 무손실. S0 가 R4 에서 0.15px 이내 재현.",
};

const out = {
  instruction: "S4-4R7",
  shotDir: basename(shotDir),
  jpeg,
  shotCount: shots.length,
  completeCount: complete.length,
  s0: {
    requiredRange: [S0_SELF_X_MIN, S0_SELF_X_MAX],
    applicable: true,
    pass: s0Pass,
    frames: s0,
    note: s0Pass
      ? "추출기가 R4 PNG 알려진 self 정답을 재현했다."
      : "S0 실패. peer 숫자를 판정에 쓰지 않는다.",
  },
  discrimination:
    "self = .map-view__rider-nametag--live 글자색 #1d4ed8. peer = --peer 글자색 #0f766e. 위치로 고르지 않음.",
  precision,
  selfStats: pixelSeriesStats(selfXs),
  peerStats: usable ? pixelSeriesStats(peerXs) : null,
  projectionCompare,
  shots,
};

mkdirSync(OUT_DIR, { recursive: true });
const dest = resolve(OUT_DIR, outName);
writeFileSync(dest, JSON.stringify(out, null, 2), "utf8");
const summaryDest = resolve(
  OUT_DIR,
  /-pixels\.json$/i.test(outName)
    ? outName.replace(/-pixels\.json$/i, "-summary.json")
    : outName.replace(/\.json$/i, "-summary.json"),
);
const summary = {
  instruction: "S4-4R7",
  shotDir: basename(shotDir),
  jpeg,
  s0Pass,
  completeCount: complete.length,
  shotCount: shots.length,
  usable,
  precision,
  discrimination: out.discrimination,
  selfStats: out.selfStats,
  peerStats: out.peerStats,
  projectionCompare,
  note: usable
    ? "S0 통과 · 전 샷 판별. peer 픽셀 계열을 판정에 쓴다."
    : jpeg
      ? "S0 추출기는 통과했으나 이 JPEG 샷은 네임태그·주황 군집이 부족하다. S3~S6 숫자를 결론으로 쓰지 않는다."
      : "추출 불완전. S3~S6 숫자를 결론으로 쓰지 않는다.",
};
writeFileSync(summaryDest, JSON.stringify(summary, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      wrote: dest,
      summary: summaryDest,
      jpeg,
      complete: complete.length,
      s0Pass,
      usable,
      selfP2p: out.selfStats.peakToPeakPx,
      peerP2p: out.peerStats?.peakToPeakPx ?? null,
      peerReverse: out.peerStats?.reverseCount ?? null,
    },
    null,
    2,
  ),
);
