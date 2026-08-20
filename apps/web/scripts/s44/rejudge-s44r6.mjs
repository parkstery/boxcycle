/**
 * S4-4R6 — 고친 계측으로 S44R5·S44R4 로그를 재촬영 없이 다시 읽는다.
 * 원본 파일은 덮지 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJitterAxis } from "../../src/lib/peerMotion/peerJitterCapture.ts";
import { buildShotManifest } from "./shot-manifest.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../../../../document/ops/sync-relay");

function uniqueCount(xs) {
  return new Set(xs.map((v) => String(v))).size;
}

function longestRun(xs) {
  let best = { len: 0, value: null, start: 0 };
  let i = 0;
  while (i < xs.length) {
    let j = i + 1;
    while (j < xs.length && xs[j] === xs[i]) j += 1;
    if (j - i > best.len) best = { len: j - i, value: xs[i], start: i };
    i = j;
  }
  return best;
}

function alongOf(j) {
  const a = j?.cameraSplit?.relativeAlong ?? j?.relativeAlong ?? null;
  if (!a) return null;
  return {
    reverseCount: a.reverseCount,
    maxReversePx: a.maxReversePx,
    peakToPeakPx: a.peakToPeakPx,
    negativeCount: a.negativeCount,
  };
}

function sampleStats(samples) {
  const rel = samples.map((s) => s.relSPx);
  return {
    sampleCount: rel.length,
    uniqueRelSPx: uniqueCount(rel),
    longestIdenticalRun: longestRun(rel),
  };
}

function holdLocalScreenX(events, x) {
  return events.map((e) => {
    if (e.kind !== "display") return e;
    return { ...e, localScreenX: x };
  });
}

function rejudgeOne(raw, sourceName, oldAlongFromSummary) {
  const oldJudgment = raw.judgment ?? null;
  const oldAlong = oldAlongFromSummary ?? alongOf(oldJudgment);
  const oldSamples = oldJudgment?.cameraSplit?.samples ?? [];
  const newJudgment = analyzeJitterAxis(raw.events);
  const held = analyzeJitterAxis(holdLocalScreenX(raw.events, 640));
  const display = raw.events.filter((e) => e.kind === "display");
  const shots = Array.isArray(raw.shots)
    ? raw.shots.map((s) => ({ i: s.i, atMs: s.atMs, file: s.file }))
    : [];
  const manifest = shots.length
    ? buildShotManifest(
        shots,
        display.map((e) => ({
          atMs: e.atMs,
          gapDistM: e.gapDistM ?? null,
          screenX: e.screenX ?? null,
          localScreenX: e.localScreenX ?? null,
        })),
        newJudgment.cameraSplit.samples,
      )
    : [];
  const manRel = manifest.map((m) => m.relSPx).filter((v) => v != null);
  return {
    instruction: "S4-4R6",
    source: sourceName,
    sourceNotModified: true,
    sourceInstruction: raw.instruction ?? null,
    freezeCause:
      "A — 매니페스트가 display 와 다른 atMs 의 최근접 샘플을 재사용. 계산기 샘플 자체는 고유(R5 13/13). B(û 창 정체로 같은 값)는 기각. û 회귀 null 시 lockedU 미사용이 샘플을 희소하게 만들어 A 를 키웠다.",
    old: {
      relativeAlong: oldAlong,
      samples: sampleStats(oldSamples),
    },
    new: {
      relativeAlong: alongOf(newJudgment),
      samples: sampleStats(newJudgment.cameraSplit.samples),
      k1Pass: newJudgment.cameraSplit.k1Pass,
      k1MaxAbsResidualPx: newJudgment.cameraSplit.k1MaxAbsResidualPx,
      displayFrames: newJudgment.displayFrames,
      reason: newJudgment.reason,
    },
    localHeldAt640: {
      note: "로컬 X 를 640 으로 고정한 산술. Q1 미성립이므로 판정에 쓰지 않는다.",
      relativeAlong: alongOf(held),
      samples: sampleStats(held.cameraSplit.samples),
      judgmentForbidden: true,
    },
    comparison: {
      reverseCount: { before: oldAlong?.reverseCount ?? null, after: newJudgment.cameraSplit.relativeAlong.reverseCount },
      maxReversePx: { before: oldAlong?.maxReversePx ?? null, after: newJudgment.cameraSplit.relativeAlong.maxReversePx },
      peakToPeakPx: { before: oldAlong?.peakToPeakPx ?? null, after: newJudgment.cameraSplit.relativeAlong.peakToPeakPx },
      uniqueRelSPx: {
        before: sampleStats(oldSamples).uniqueRelSPx,
        after: sampleStats(newJudgment.cameraSplit.samples).uniqueRelSPx,
        sampleCountAfter: newJudgment.cameraSplit.samples.length,
      },
    },
    manifestUniqueRelSPx: uniqueCount(manRel),
    manifestShotCount: manifest.length,
    manifestNonNullRelSPx: manRel.length,
  };
}

const r5raw = JSON.parse(readFileSync(resolve(OUT_DIR, "S44R5-capture.json"), "utf8"));
const r4raw = JSON.parse(readFileSync(resolve(OUT_DIR, "S44R4-chief-5kmh.json"), "utf8"));

const r5 = rejudgeOne(r5raw, "S44R5-capture.json", r5raw.relativeAlong ?? alongOf(r5raw.judgment));
const r4 = rejudgeOne(r4raw, "S44R4-chief-5kmh.json", r4raw.relativeAlong ?? alongOf(r4raw.judgment));

r4.pixelContrast = {
  method:
    "S44R4-shots 1280×900 PNG 에서 맵 밴드(y≈400–450, x≈500–680)의 주황 자전거 픽셀 군집 무게중심 vs 최근접 display 의 localScreenX·peerScreenX. 새 샷 없음.",
  frames: [
    {
      file: "F000.png",
      dtMs: 26,
      localScreenX: 640.0000513309717,
      peerScreenX: 548.4306130155378,
      markerLocalPx: 635.7,
      markerPeerPx: 542.5,
      dLocalPx: 4.3,
      dPeerPx: 5.9,
    },
    {
      file: "F003.png",
      dtMs: 1,
      localScreenX: 645.0626827395105,
      peerScreenX: 553.1608485858097,
      markerLocalPx: 636.2,
      markerPeerPx: 545.2,
      dLocalPx: 8.9,
      dPeerPx: 8.0,
    },
    {
      file: "F006.png",
      dtMs: 50,
      localScreenX: 645.6566263231944,
      peerScreenX: 546.9139999087265,
      markerLocalPx: 636.4,
      markerPeerPx: 546.2,
      dLocalPx: 9.3,
      dPeerPx: 0.7,
    },
  ],
  reading:
    "그려진 local 은 635.7–636.4 로 0.7px 만 움직이는데 계측 localScreenX 는 640.00↔645.06 으로 토글한다. 대조 불성립. peer 도 0.7–8.0px 어긋남. Q5·Q6 판정 금지.",
};

mkdirSync(OUT_DIR, { recursive: true });
const dest5 = resolve(OUT_DIR, "S44R6-rejudge-R5.json");
const dest4 = resolve(OUT_DIR, "S44R6-rejudge-R4.json");
writeFileSync(dest5, JSON.stringify(r5, null, 2), "utf8");
writeFileSync(dest4, JSON.stringify(r4, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      wrote: [dest5, dest4],
      r5: r5.comparison,
      r4: r4.comparison,
    },
    null,
    2,
  ),
);
