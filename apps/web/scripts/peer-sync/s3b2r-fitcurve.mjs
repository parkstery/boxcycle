/**
 * S3B-2R §1-1 — depart D 축 곡선 (base·post)
 *   node scripts/peer-sync/s3b2r-fitcurve.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DELAY_STEP_MS, fitCurveDepart } from "./s3b2r-analyze.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../../../../document/ops/sync-relay");
const BASE = resolve(DIR, "S3B2-base-events.json");
const POST = resolve(DIR, "S3B2-chain-events.json");
const OUT = resolve(DIR, "S3B2R-fitcurve.json");

if (!existsSync(BASE) || !existsSync(POST)) {
  console.error("need S3B2-base-events.json and S3B2-chain-events.json");
  process.exit(1);
}

const base = fitCurveDepart(JSON.parse(readFileSync(BASE, "utf8")));
const post = fitCurveDepart(JSON.parse(readFileSync(POST, "utf8")));

const out = {
  instruction: "S3B-2R",
  section: "1-1",
  grid: {
    stepMs: DELAY_STEP_MS,
    range: [240, 480],
    note: "공식 D_eff 적합은 0..3000 step 20. 350 은 격자 밖(off-grid spotlight 만)",
    budgetMs: 350,
  },
  base,
  post,
  generatedAt: new Date().toISOString(),
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out: OUT,
      base: { D_eff: base.D_eff, distinguish: base.distinguish350vs360 },
      post: { D_eff: post.D_eff, distinguish: post.distinguish350vs360 },
    },
    null,
    2,
  ),
);
