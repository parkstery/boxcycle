#!/usr/bin/env node
/**
 * Offline CLI: phase-aligned 1v2 minute-bin attribution.
 *
 * Usage (from apps/web):
 *   node --experimental-strip-types scripts/traffic/phase-aligned-measurement.mjs --input path/to/input.json
 *
 * Exit 0 = ok compare or intentional insufficient report printed.
 * Exit 2 = usage / parse error.
 * Never writes to production. Never promotes to billed.
 */
import fs from "node:fs";
import path from "node:path";
import { analyzePhaseAlignedTraffic } from "./phaseAlignedMeasurement.ts";

function usage() {
  console.error(`Usage:
  node --experimental-strip-types scripts/traffic/phase-aligned-measurement.mjs --input <file.json>

Input JSON: evidenceClass, deployLabel, calendarDate, quiet?, solo?, dual?, minuteBins[]
See apps/web/scripts/traffic/phaseAlignedMeasurement.ts for the contract.
`);
}

function parseArgs(argv) {
  const out = { input: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" || argv[i] === "-i") {
      out.input = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      out.help = true;
    }
  }
  return out;
}

function summarize(result) {
  const lines = [];
  lines.push(`status: ${result.status}`);
  lines.push(`billedPromotion: ${result.billedPromotion}`);
  if (!result.ok) {
    lines.push("reasons:");
    for (const r of result.reasons) lines.push(`  - ${r}`);
  } else {
    lines.push(`evidenceClass: ${result.evidenceClass}`);
    lines.push(`deployLabel: ${result.deployLabel}`);
    lines.push(`calendarDate: ${result.calendarDate}`);
    if (result.quietBaseline) {
      const q = result.quietBaseline;
      lines.push(
        `quietBaseline: bins=${q.binCount} sumReads=${q.sumReads} sumWrites=${q.sumWrites} rateReads/min=${q.rateReadsPerMin} rateWrites/min=${q.rateWritesPerMin}`,
      );
    } else {
      lines.push("quietBaseline: (none)");
    }
    if (result.compare) {
      const c = result.compare;
      lines.push(
        `solo.steady: bins=${c.solo.binCount} sumR=${c.solo.sumReads} sumW=${c.solo.sumWrites} rateR=${c.solo.rateReadsPerMin} rateW=${c.solo.rateWritesPerMin}`,
      );
      lines.push(
        `dual.steady: bins=${c.dual.binCount} sumR=${c.dual.sumReads} sumW=${c.dual.sumWrites} rateR=${c.dual.rateReadsPerMin} rateW=${c.dual.rateWritesPerMin}`,
      );
      lines.push(
        `metrics: compared=[${c.comparedMetrics.join(",")}] missing=[${c.missingMetrics.join(",")}]`,
      );
      lines.push(
        `directional: readsRatio(d/s)=${c.readsRatioDualOverSolo} writesRatio(d/s)=${c.writesRatioDualOverSolo} Δreads/min=${c.readsDeltaDualMinusSoloPerMin} Δwrites/min=${c.writesDeltaDualMinusSoloPerMin}`,
      );
      lines.push(`note: ${c.note}`);
    }
    for (const w of result.warnings) lines.push(`warning: ${w}`);
  }
  for (const a of result.attributions) {
    lines.push(
      `attr ${a.role}.${a.phase}: intervalMs=${a.intervalMs} bins=${a.binCount} excludedPartial=${a.excludedPartialBins.length} sumR=${a.sumReads} sumW=${a.sumWrites}`,
    );
  }
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.input) {
  usage();
  process.exit(args.help ? 0 : 2);
}

const abs = path.resolve(args.input);
if (!fs.existsSync(abs)) {
  console.error(`input not found: ${abs}`);
  process.exit(2);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(abs, "utf8"));
} catch (e) {
  console.error(`JSON parse failed: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}

const result = analyzePhaseAlignedTraffic(raw);
console.log(summarize(result));
console.log("---");
console.log(JSON.stringify(result, null, 2));
process.exit(0);
