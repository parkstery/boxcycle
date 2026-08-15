/**
 * S3B-2R — 3 런 분포 · §1-3 · 귀속 판정 → S3B2R-summary.json
 *   node scripts/peer-sync/s3b2r-summarize.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRun, departMechanics, stats } from "./s3b2r-analyze.mjs";
import { S1_LIMITS } from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const FIT = resolve(DIR, "S3B2R-fitcurve.json");
const BASE = resolve(DIR, "S3B2-base-events.json");
const POST = resolve(DIR, "S3B2-chain-events.json");
const OUT = resolve(DIR, "S3B2R-summary.json");

const RUNS = [1, 2, 3].map((n) => ({
  n,
  path: resolve(DIR, `S3B2R-run${n}-events.json`),
}));

for (const r of RUNS) {
  if (!existsSync(r.path)) {
    console.error(`missing ${r.path}`);
    process.exit(1);
  }
}
if (!existsSync(FIT)) {
  console.error("missing S3B2R-fitcurve.json — run s3b2r-fitcurve.mjs first");
  process.exit(1);
}

const fitcurve = JSON.parse(readFileSync(FIT, "utf8"));
const baseMech = departMechanics(JSON.parse(readFileSync(BASE, "utf8")));
const postMech = departMechanics(JSON.parse(readFileSync(POST, "utf8")));

const runAnalyses = RUNS.map((r) => {
  const raw = JSON.parse(readFileSync(r.path, "utf8"));
  raw.run = r.n;
  return analyzeRun(raw);
});

const departDeff = runAnalyses.map((r) => r.cases["z15-depart"].D_eff).filter((x) => x != null);
const cruiseDeff = runAnalyses.map((r) => r.cases["z15-cruise"].D_eff).filter((x) => x != null);
const dDist = stats(departDeff);
const cDist = stats(cruiseDeff);

function caseDist(caseId) {
  const rows = runAnalyses.map((r) => r.cases[caseId]);
  return {
    D_eff: stats(rows.map((x) => x.D_eff)),
    RMSE: stats(rows.map((x) => x.residualRmse)),
    max: stats(rows.map((x) => x.residualMax)),
    overlap: stats(rows.map((x) => x.overlap)),
    n: stats(rows.map((x) => x.n)),
    scalePct: stats(rows.map((x) => x.scalePct)),
    perRun: rows,
  };
}

const departDist = caseDist("z15-depart");
const cruiseDist = caseDist("z15-cruise");

function worstCasePass(caseId) {
  const rows = runAnalyses.map((r) => r.cases[caseId]);
  const worst = rows.reduce((w, x) => ((x.D_eff ?? 0) > (w.D_eff ?? 0) ? x : w), rows[0]);
  const pass =
    worst.D_eff != null &&
    worst.D_eff <= S1_LIMITS.D_eff_ms &&
    worst.residualRmse <= S1_LIMITS.residualRmse_m &&
    worst.residualMax <= S1_LIMITS.residualMax_m &&
    worst.scaleStatus === "PASS";
  return { worst, pass };
}

const worstDepart = worstCasePass("z15-depart");
const worstCruise = worstCasePass("z15-cruise");

const guardsAllPass = runAnalyses.every((r) => r.guardsPass);

// §1-3 hypothesis — support if post shows less over-publish AND residual mean shifts toward zero/negative
const hyp = {
  base: baseMech,
  post: postMech,
  deltaPublishOverActual:
    baseMech.publishOverActual != null && postMech.publishOverActual != null
      ? postMech.publishOverActual - baseMech.publishOverActual
      : null,
  deltaResidualMean:
    baseMech.residualMeanAtDeff != null && postMech.residualMeanAtDeff != null
      ? postMech.residualMeanAtDeff - baseMech.residualMeanAtDeff
      : null,
  deltaExtrapShare:
    baseMech.extrapolateShare != null && postMech.extrapolateShare != null
      ? postMech.extrapolateShare - baseMech.extrapolateShare
      : null,
};

let hypothesisVerdict = "판정불가";
if (
  hyp.deltaPublishOverActual != null &&
  hyp.deltaPublishOverActual < -0.05 &&
  hyp.deltaResidualMean != null &&
  hyp.deltaResidualMean < 0
) {
  hypothesisVerdict = "지지";
} else if (
  hyp.deltaPublishOverActual != null &&
  hyp.deltaPublishOverActual > 0.05
) {
  hypothesisVerdict = "불일치";
}

// §2-라 attribution
const span340to360 = dDist.min != null && dDist.max != null && dDist.min <= 340 && dDist.max >= 350;
const spread20 = dDist.min != null && dDist.max != null && dDist.max - dDist.min >= 20;
const cluster360 =
  departDeff.length === 3 && departDeff.every((d) => d >= 350) && dDist.p50 != null && dDist.p50 >= 350;
const curveDistinguishes = fitcurve.post?.distinguish350vs360?.distinguishable === true;

let attribution = "C";
let attributionNote = "";
if ((span340to360 || spread20) && !cluster360) {
  attribution = "A";
  attributionNote = `3 런 depart D_eff ${dDist.min}~${dDist.max} ms — 런 변동이 340↔360 스팬을 설명`;
} else if (cluster360 && curveDistinguishes) {
  attribution = "B";
  attributionNote = `3 런 depart D_eff 중앙 ${dDist.p50} ms(≥350) · 곡선이 350/360 RMSE 차 ${fitcurve.post.distinguish350vs360.delta?.toFixed(4)}`;
} else if (span340to360 && cluster360) {
  attribution = "A";
  attributionNote = "런 변동(스팬)이 D-1 단일 인과보다 우세";
} else {
  attribution = "C";
  attributionNote = `cluster360=${cluster360} curveDist=${curveDistinguishes} span=${span340to360} spread=${spread20}`;
}

const acceptance = {
  fitcurveSubmitted: !!fitcurve.base?.sweep?.length && !!fitcurve.post?.sweep?.length,
  threeRunsComplete: runAnalyses.length === 3,
  mechanicsTable: baseMech && postMech && !baseMech.missing && !postMech.missing,
  attributionDeclared: ["A", "B", "C"].includes(attribution),
  guardsAllRuns: guardsAllPass,
  all:
    !!fitcurve.base?.sweep?.length &&
    runAnalyses.length === 3 &&
    guardsAllPass &&
    ["A", "B", "C"].includes(attribution),
};

const out = {
  instruction: "S3B-2R",
  head: "aca3750",
  uag: acceptance.all ? `S3B-2R — 귀속 ${attribution} 로 판정` : "S3B-2R — 측정 미완",
  attribution: {
    code: attribution,
    note: attributionNote,
    criteria: { span340to360, spread20, cluster360, curveDistinguishes },
  },
  acceptance,
  section1_1: fitcurve,
  section1_2: {
    runs: runAnalyses.map((r, i) => ({
      run: i + 1,
      elapsedMin: r.elapsedMin,
      depart: r.cases["z15-depart"],
      cruise: r.cases["z15-cruise"],
      guardsPass: r.guardsPass,
    })),
    distribution: {
      depart: departDist,
      cruise: cruiseDist,
    },
    worstCase: {
      depart: worstDepart,
      cruise: worstCruise,
    },
  },
  section1_3: {
    comparison: { base: baseMech, post: postMech },
    hypothesis: hyp,
    hypothesisVerdict,
    note: "가설 확정 아님 — 재료 수집",
  },
  guards: runAnalyses.map((r) => ({ run: r.run, guards: r.guards, pass: r.guardsPass })),
  generatedAt: new Date().toISOString(),
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      uag: out.uag,
      attribution: out.attribution,
      departDeff: dDist,
      worstDepart: worstDepart.worst.D_eff,
      guardsAllPass,
      hypothesisVerdict,
    },
    null,
    2,
  ),
);
