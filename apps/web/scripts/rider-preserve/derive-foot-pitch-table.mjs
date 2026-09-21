#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const candidateDir = path.resolve(process.argv[2] ?? "");
if (!candidateDir || !fs.existsSync(candidateDir)) {
  throw new Error("usage: node derive-foot-pitch-table.mjs <candidate-dir>");
}
const manifest = JSON.parse(fs.readFileSync(path.join(candidateDir, "manifest.json"), "utf8"));
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(manifest.outputs.viewer).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__RTW_CAPTURE__));
  const result = await page.evaluate(() => {
    window.__RTW_CAPTURE__.setMode("bind");
    updateSway();
    const dynamicOffset = ankleOffset;
    const bindOffset = (side) => V3.sub(RIG0.ankle[side], PEDAL0[side]);
    const stepDeg = 15;
    const tables = { R: [], L: [] };
    const targets = { R: [], L: [] };
    const achieved = { R: [], L: [] };
    const previous = { R: 0, L: 0 };

    for (let phaseDeg = 0; phaseDeg <= 360; phaseDeg += stepDeg) {
      crankAngle = phaseDeg * Math.PI / 180;
      for (const side of ["R", "L"]) {
        ankleOffset = dynamicOffset;
        solveLeg(side, pedalPos(side, crankAngle), 0);
        const originalKneeDeg = pose[side].kneeAng;
        // Keep a small interpolation margin below the 155 degree extension
        // limit used by the pedalling gate.
        const targetKneeDeg = Math.min(154, originalKneeDeg);
        targets[side].push({ phaseDeg, originalKneeDeg, targetKneeDeg });

        ankleOffset = bindOffset;
        let best = null;
        if (phaseDeg === 0 || phaseDeg === 360) {
          solveLeg(side, pedalPos(side, crankAngle), 0);
          best = { angleDeg: 0, kneeDeg: pose[side].kneeAng, deficitMm: pose[side].deficit * 1000 };
        } else {
          for (let angleDeg = -60; angleDeg <= 60.0001; angleDeg += 0.1) {
            solveLeg(side, pedalPos(side, crankAngle), angleDeg * Math.PI / 180);
            if (pose[side].clamped) continue;
            const kneeError = Math.abs(pose[side].kneeAng - targetKneeDeg);
            const continuity = Math.abs(angleDeg - previous[side]);
            // The two-link IK can have a second, anatomically implausible foot
            // rotation with the same knee angle. Prefer the continuous branch.
            const score = kneeError + continuity * 0.05;
            if (!best || score < best.score) {
              best = { score, angleDeg, kneeDeg: pose[side].kneeAng, deficitMm: pose[side].deficit * 1000 };
            }
          }
        }
        if (!best) throw new Error(`No reachable foot pitch at ${phaseDeg} degrees (${side})`);
        const rounded = Math.round(best.angleDeg * 10) / 10;
        tables[side].push(rounded);
        previous[side] = rounded;
        achieved[side].push({ phaseDeg, ...best, angleDeg: rounded });
      }
    }

    ankleOffset = bindOffset;
    const sampleTable = (side, phaseDeg) => {
      const wrapped = ((phaseDeg % 360) + 360) % 360;
      const index = Math.floor(wrapped / stepDeg);
      const t = (wrapped - index * stepDeg) / stepDeg;
      const a = tables[side][index];
      const b = tables[side][index + 1];
      return a + (b - a) * t;
    };
    const validation = [];
    for (let phaseDeg = 0; phaseDeg <= 360; phaseDeg += 1) {
      crankAngle = phaseDeg * Math.PI / 180;
      const row = { phaseDeg };
      for (const side of ["R", "L"]) {
        const flexDeg = sampleTable(side, phaseDeg);
        solveLeg(side, pedalPos(side, crankAngle), flexDeg * Math.PI / 180);
        const footCleat = M4.xform(pose[side].Mft, PEDAL0[side]);
        const pedal = pedalPos(side, crankAngle);
        row[side] = {
          flexDeg,
          kneeDeg: pose[side].kneeAng,
          clamped: pose[side].clamped,
          deficitMm: pose[side].deficit * 1000,
          cleatAnchorErrorMm: Math.hypot(...footCleat.map((v, i) => v - pedal[i])) * 1000,
        };
      }
      validation.push(row);
    }
    return { stepDeg, tables, targets, achieved, validation };
  });

  const rows = result.validation;
  const summary = {
    candidateId: manifest.candidateId,
    stepDeg: result.stepDeg,
    tables: result.tables,
    minKneeDeg: Math.min(...rows.flatMap((row) => [row.R.kneeDeg, row.L.kneeDeg])),
    maxKneeDeg: Math.max(...rows.flatMap((row) => [row.R.kneeDeg, row.L.kneeDeg])),
    anyClamped: rows.some((row) => row.R.clamped || row.L.clamped),
    maxCleatAnchorErrorMm: Math.max(...rows.flatMap((row) => [row.R.cleatAnchorErrorMm, row.L.cleatAnchorErrorMm])),
    minReachMarginMm: Math.min(...rows.flatMap((row) => [-row.R.deficitMm, -row.L.deficitMm])),
    knotTargets: result.targets,
    knotResults: result.achieved,
  };
  const outputPath = path.join(candidateDir, "derived-foot-pitch-table.json");
  fs.writeFileSync(outputPath, JSON.stringify({ ...summary, validation: rows }, null, 2));
  console.log(JSON.stringify({ outputPath, ...summary }, null, 2));
} finally {
  await browser.close();
}
