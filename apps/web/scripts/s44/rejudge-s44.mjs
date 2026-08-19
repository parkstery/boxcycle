import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJitterAxis } from "../../src/lib/peerMotion/peerJitterCapture.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const SRC = resolve(OUT_DIR, "S44-jitter-capture.json");
const DEST = resolve(OUT_DIR, "S44R-rejudge.json");

const raw = JSON.parse(readFileSync(SRC, "utf8"));
if (raw.instruction !== "S4-4") {
  throw new Error("S44-jitter-capture.json 을 읽지 못했다. 덮어쓰지 말고 원본을 확인하라.");
}

const judgment = analyzeJitterAxis(raw.events);
const t0 = raw.windowStartedAt ?? 0;

const old2d = [];
const display = raw.events.filter((e) => e.kind === "display");
let prev = null;
let prevDx = 0;
let prevDy = 0;
for (const ev of display) {
  if (
    prev &&
    prev.screenX != null &&
    prev.screenY != null &&
    ev.screenX != null &&
    ev.screenY != null
  ) {
    const dx = ev.screenX - prev.screenX;
    const dy = ev.screenY - prev.screenY;
    const reverse =
      dx * prevDx + dy * prevDy < 0 &&
      Math.hypot(dx, dy) >= 8 &&
      Math.hypot(prevDx, prevDy) >= 8;
    if (reverse) {
      old2d.push({
        atMs: ev.atMs,
        tMs: ev.atMs - t0,
        magPx: Math.hypot(dx, dy),
        absDx: dx,
        absDy: dy,
        distFrom: prev.displayDistM,
        distTo: ev.displayDistM,
        distDeltaM: ev.displayDistM - prev.displayDistM,
      });
    }
    prevDx = dx;
    prevDy = dy;
  }
  prev = ev;
}

const ingest = raw.events.filter((e) => e.kind === "ingest");
const rtdbBacktracks = [];
let prevRtdb = null;
for (const ev of ingest) {
  const d = ev.rtdb?.distM;
  if (typeof d !== "number") continue;
  if (prevRtdb != null && d < prevRtdb - 1e-9) {
    rtdbBacktracks.push({
      atMs: ev.atMs,
      tMs: ev.atMs - t0,
      fromM: prevRtdb,
      toM: d,
      backM: prevRtdb - d,
      result: ev.ingest?.result ?? null,
    });
  }
  prevRtdb = d;
}
const alongByTime = new Map(judgment.alongReverses.map((h) => [h.atMs, h]));
const twoDIdentity = old2d.map((hit) => {
  const along = alongByTime.get(hit.atMs) ?? null;
  const nearest =
    along ??
    judgment.alongReverses.reduce((best, h) => {
      if (!best) return h;
      return Math.abs(h.atMs - hit.atMs) < Math.abs(best.atMs - hit.atMs) ? h : best;
    }, null);
  const dt = nearest ? Math.abs(nearest.atMs - hit.atMs) : null;
  return {
    ...hit,
    alongTrackSameFrame: along != null,
    nearestAlongDtMs: dt,
    nearestAlong: nearest
      ? {
          sPx: nearest.sPx,
          magPx: nearest.magPx,
          ux: nearest.ux,
          uy: nearest.uy,
          distDeltaM: nearest.distDeltaM,
        }
      : null,
    identity:
      along != null
        ? "along-track-sign-flip"
        : dt != null && dt <= 200
          ? "along-track-nearby"
          : Math.abs(hit.absDx) > Math.abs(hit.absDy) * 3
            ? "screen-x-dominant-2d"
            : "unclassified-2d",
  };
});

const distHits = judgment.distBacktracks.map((h) => ({
  ...h,
  tMs: h.atMs - t0,
  nearestAlongDtMs: (() => {
    if (judgment.alongReverses.length === 0) return null;
    const n = judgment.alongReverses.reduce((best, a) =>
      Math.abs(a.atMs - h.atMs) < Math.abs(best.atMs - h.atMs) ? a : best,
    );
    return Math.abs(n.atMs - h.atMs);
  })(),
}));

const out = {
  instruction: "S4-4R",
  source: "S44-jitter-capture.json",
  sourceNotModified: true,
  alongTrackMethod: judgment.alongTrackMethod,
  oldSummary: raw.judgment,
  newJudgment: {
    dominantSignal: judgment.dominantSignal,
    maxDistBacktrackM: judgment.maxDistBacktrackM,
    distBacktrackCount: judgment.distBacktrackCount,
    alongReverseCount: judgment.alongReverseCount,
    maxAlongReversePx: judgment.maxAlongReversePx,
    alongPeakToPeakPx: judgment.alongPeakToPeakPx,
    alongNegativeCount: judgment.alongNegativeCount,
    subThresholdAlongReverseCount: judgment.subThresholdAlongReverseCount,
    maxScreenReversePx: judgment.maxScreenReversePx,
    screenReverseCount: judgment.screenReverseCount,
    pxPerMMedian: judgment.pxPerMMedian,
    bandLabelPx: judgment.bandLabelPx,
    bandPxEqualsM: judgment.bandPxEqualsM,
    hasLocalScreen: judgment.hasLocalScreen,
    reason: judgment.reason,
  },
  old2dReversesGte8px: twoDIdentity,
  alongReverses: judgment.alongReverses.map((h) => ({ ...h, tMs: h.atMs - t0 })),
  distBacktracks: distHits,
  rtdbDistBacktracks: rtdbBacktracks,
  firstAbnormalHint: {
    rtdbBacktrackCount: rtdbBacktracks.length,
    rtdbMaxBackM: rtdbBacktracks.reduce((m, h) => Math.max(m, h.backM), 0),
    displayBacktrackCount: judgment.distBacktrackCount,
    displayMaxBackM: judgment.maxDistBacktrackM,
    alongReverseCount: judgment.alongReverseCount,
    note:
      rtdbBacktracks.length === 0 &&
      judgment.alongReverseCount > 0 &&
      (judgment.pxPerMMedian ?? 0) * judgment.maxDistBacktrackM <
        0.25 * judgment.maxAlongReversePx
        ? "원본 RTDB 단조. display 역행은 있으나 px 환산이 진행축 화면 반전보다 작다. 눈에 보이는 앞뒤는 화면 단계 후보(로컬 상대 좌표로 카메라 분리 전 미확정)."
        : rtdbBacktracks.length === 0 && judgment.distBacktrackCount > 0
          ? "원본 RTDB 단조인데 display 역행 — ingest/display 쪽을 보라"
          : rtdbBacktracks.length === 0 &&
              judgment.distBacktrackCount === 0 &&
              judgment.alongReverseCount > 0
            ? "원본·display 거리 깨끗, 진행축 화면 반전만 — 화면(투영·카메라) 후보"
            : "아래 숫자를 대조해 최초 이상 단계를 고른다",
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(DEST, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      wrote: DEST,
      dominantSignal: judgment.dominantSignal,
      old2d: twoDIdentity.length,
      identities: twoDIdentity.map((h) => h.identity),
      alongReverseCount: judgment.alongReverseCount,
      maxAlongReversePx: judgment.maxAlongReversePx,
      distBacktrackCount: judgment.distBacktrackCount,
      maxDistBacktrackM: judgment.maxDistBacktrackM,
      pxPerMMedian: judgment.pxPerMMedian,
      bandPxEqualsM: judgment.bandPxEqualsM,
    },
    null,
    2,
  ),
);
