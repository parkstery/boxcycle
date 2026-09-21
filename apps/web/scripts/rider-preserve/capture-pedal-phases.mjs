#!/usr/bin/env node
/** Capture 8 pedal phases from an immutable, statically approved candidate. */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const candidateDir = path.resolve(process.argv[2] ?? "");
if (!candidateDir || !fs.existsSync(candidateDir)) {
  throw new Error("usage: node capture-pedal-phases.mjs <candidate-dir>");
}
const manifestPath = path.join(candidateDir, "manifest.json");
const approvalPath = path.join(candidateDir, "static-approval.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
if (!approval.approved || approval.candidateId !== manifest.candidateId) {
  throw new Error("Static approval missing or candidate mismatch");
}
const viewerPath = manifest.outputs.viewer;
if (!fs.existsSync(viewerPath)) throw new Error(`Immutable viewer missing: ${viewerPath}`);
const viewerSha256 = crypto.createHash('sha256').update(fs.readFileSync(viewerPath)).digest('hex');
if (approval.viewerSha256 && approval.viewerSha256 !== viewerSha256) throw new Error('Approved viewer changed');

const phases = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const keyPhases = new Set([0, 90, 180, 270]);
const captureScreenshots = process.argv.includes("--screenshots");
const captures = [];
const phaseMetrics = [];
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.text().includes("CONTEXT_LOST_WEBGL")) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto(pathToFileURL(viewerPath).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__RTW_CAPTURE__));
  await page.waitForTimeout(900);

  for (const phaseDeg of phases) {
    await page.evaluate((deg) => {
      window.__RTW_CAPTURE__.setMode("bind");
      window.__RTW_CAPTURE__.setPhase(deg);
      const meta = document.getElementById("rtwCaptureMeta");
      const lines = meta.textContent.split("\n").filter((line) => !line.startsWith("Phase"));
      lines[3] = "Stage      PEDAL_8_PHASE";
      lines[4] = "Status     UNAPPROVED";
      lines[6] = "View       DQS / SIDE";
      lines.push(`Phase      ${String(deg).padStart(3, "0")} DEG`);
      meta.textContent = lines.join("\n");
    }, phaseDeg);
    await page.evaluate(() => window.__RTW_CAPTURE__.setView("side"));
    await page.evaluate((deg) => {
      const meta = document.getElementById("rtwCaptureMeta");
      const lines = meta.textContent.split("\n").filter((line) => !line.startsWith("Phase"));
      lines[3] = "Stage      PEDAL_8_PHASE";
      lines[4] = "Status     UNAPPROVED";
      lines[6] = "View       DQS / SIDE";
      lines.push(`Phase      ${String(deg).padStart(3, "0")} DEG`);
      meta.textContent = lines.join("\n");
    }, phaseDeg);
    await page.waitForTimeout(180);

    if (captureScreenshots) {
      const sidePath = path.join(candidateDir, `pedal-${String(phaseDeg).padStart(3, "0")}-side-${manifest.candidateId}.png`);
      await page.locator("#stage").screenshot({ path: sidePath });
      captures.push(sidePath);
    }

    const metrics = await page.evaluate((deg) => {
      const base = window.__RTW_CAPTURE__.stats();
      const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const transformedVertices = (group) => {
        const matrix = groupMatrix(group, crankAngle), points = [];
        for (const draw of draws) if (draw.grp === group) for (let i = 0; i < draw.restPos.length; i += 3) {
          points.push(M4.xform(matrix, [draw.restPos[i], draw.restPos[i + 1], draw.restPos[i + 2]]));
        }
        return points;
      };
      const closestVertexDistanceMm = (a, b) => {
        let best = Infinity;
        for (const p of a) for (const q of b) best = Math.min(best, distance(p, q));
        return best * 1000;
      };
      const pr = pedalPos("R", crankAngle), pl = pedalPos("L", crankAngle);
      const renderedR = M4.xform(groupMatrix('pedalR', crankAngle), PEDAL0.R);
      const renderedL = M4.xform(groupMatrix('pedalL', crankAngle), PEDAL0.L);
      const cleatR = M4.xform(groupMatrix('footR', crankAngle), PEDAL0.R);
      const cleatL = M4.xform(groupMatrix('footL', crankAngle), PEDAL0.L);
      const crankR = M4.xform(groupMatrix('crank', crankAngle), PEDAL0.R);
      const crankL = M4.xform(groupMatrix('crank', crankAngle), PEDAL0.L);
      const vr = [pr[0] - BB[0], pr[1] - BB[1]];
      const vl = [pl[0] - BB[0], pl[1] - BB[1]];
      const lenR = Math.hypot(...vr), lenL = Math.hypot(...vl);
      const cosine = Math.max(-1, Math.min(1, (vr[0] * vl[0] + vr[1] * vl[1]) / (lenR * lenL)));
      return {
        phaseDeg: deg,
        ...base,
        rightAnkleTargetErrorMm: distance(pose.R.Anew, pose.R.Atgt) * 1000,
        leftAnkleTargetErrorMm: distance(pose.L.Anew, pose.L.Atgt) * 1000,
        rightFootPedalClosestVertexMm: closestVertexDistanceMm(transformedVertices("footR"), transformedVertices("pedalR")),
        leftFootPedalClosestVertexMm: closestVertexDistanceMm(transformedVertices("footL"), transformedVertices("pedalL")),
        pedalPhaseSeparationDeg: Math.acos(cosine) * 180 / Math.PI,
        rightPedalRadiusMm: lenR * 1000,
        leftPedalRadiusMm: lenL * 1000,
        renderedPedals: {R:renderedR,L:renderedL},
        maxRenderedPedalTargetErrorMm: Math.max(distance(renderedR,pr),distance(renderedL,pl))*1000,
        maxPedalCrankAttachmentDeltaMm: Math.max(distance(renderedR,crankR),distance(renderedL,crankL))*1000,
        rightCleatPedalAnchorErrorMm:distance(cleatR,renderedR)*1000,
        leftCleatPedalAnchorErrorMm:distance(cleatL,renderedL)*1000,
      };
    }, phaseDeg);
    phaseMetrics.push(metrics);

    if (captureScreenshots && keyPhases.has(phaseDeg)) {
      for (const view of ["front", "knee"]) {
        await page.evaluate((v) => window.__RTW_CAPTURE__.setView(v), view);
        await page.evaluate(({ deg, view }) => {
          const meta = document.getElementById("rtwCaptureMeta");
          const lines = meta.textContent.split("\n").filter((line) => !line.startsWith("Phase"));
          lines[3] = "Stage      PEDAL_8_PHASE";
          lines[4] = "Status     UNAPPROVED";
          lines[6] = `View       DQS / ${view.toUpperCase()}`;
          lines.push(`Phase      ${String(deg).padStart(3, "0")} DEG`);
          meta.textContent = lines.join("\n");
        }, { deg: phaseDeg, view });
        await page.waitForTimeout(120);
        const outputPath = path.join(candidateDir, `pedal-${String(phaseDeg).padStart(3, "0")}-${view}-${manifest.candidateId}.png`);
        await page.locator("#stage").screenshot({ path: outputPath });
        captures.push(outputPath);
      }
    }
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
} finally {
  await browser?.close();
}

const worst = {
  maxLegEdgeLengthDeltaMm: Math.max(...phaseMetrics.map((item) => item.maxLegEdgeLengthDeltaMm)),
  maxLegEdgeStrainPercent: Math.max(...phaseMetrics.map((item) => item.maxLegEdgeStrainPercent)),
  maxAnkleTargetErrorMm: Math.max(...phaseMetrics.flatMap((item) => [item.rightAnkleTargetErrorMm, item.leftAnkleTargetErrorMm])),
  maxFootPedalClosestVertexMm: Math.max(...phaseMetrics.flatMap((item) => [item.rightFootPedalClosestVertexMm, item.leftFootPedalClosestVertexMm])),
  minFootPedalClosestVertexMm: Math.min(...phaseMetrics.flatMap((item) => [item.rightFootPedalClosestVertexMm, item.leftFootPedalClosestVertexMm])),
  minPedalPhaseSeparationDeg: Math.min(...phaseMetrics.map((item) => item.pedalPhaseSeparationDeg)),
  maxPedalPhaseSeparationDeg: Math.max(...phaseMetrics.map((item) => item.pedalPhaseSeparationDeg)),
  anyIkClamped: phaseMetrics.some((item) => item.rightClamped || item.leftClamped),
  maxRenderedPedalTargetErrorMm: Math.max(...phaseMetrics.map(item=>item.maxRenderedPedalTargetErrorMm)),
  maxPedalCrankAttachmentDeltaMm: Math.max(...phaseMetrics.map(item=>item.maxPedalCrankAttachmentDeltaMm)),
  maxCleatPedalAnchorErrorMm:Math.max(...phaseMetrics.flatMap(item=>[item.rightCleatPedalAnchorErrorMm,item.leftCleatPedalAnchorErrorMm])),
  maxKneeExtensionDeg:Math.max(...phaseMetrics.flatMap(item=>[item.rightKneeDeg,item.leftKneeDeg])),
};
const first=phaseMetrics[0],last=phaseMetrics.at(-1);
worst.loopClosurePedalMm=Math.max(...['R','L'].map(side=>Math.hypot(...first.renderedPedals[side].map((v,i)=>v-last.renderedPedals[side][i]))*1000));
const hardVerdict = {
  ankleTarget: !worst.anyIkClamped && worst.maxAnkleTargetErrorMm <= 0.1 ? "PASS" : "FAIL",
  pedalSymmetry: Math.abs(worst.minPedalPhaseSeparationDeg - 180) <= 0.5 && Math.abs(worst.maxPedalPhaseSeparationDeg - 180) <= 0.5 ? "PASS" : "FAIL",
  renderedPedalTarget:worst.maxRenderedPedalTargetErrorMm<=0.1?'PASS':'FAIL',
  pedalCrankAttachment:worst.maxPedalCrankAttachmentDeltaMm<=0.1?'PASS':'FAIL',
  cleatPedalAnchor:worst.maxCleatPedalAnchorErrorMm<=0.1?'PASS':'FAIL',
  kneeExtension:!worst.anyIkClamped&&worst.maxKneeExtensionDeg<=155?'PASS':'FAIL',
  loopClosurePedal:worst.loopClosurePedalMm<=0.001?'PASS':'FAIL',
};
const reviewVerdict = {
  shape: "REVIEW_IN_3D_VALIDATOR",
  footPedalContact: "REVIEW_IN_3D_VALIDATOR",
  bodyFrameCollision: "REVIEW_IN_3D_VALIDATOR",
};
const report = {
  candidateId: manifest.candidateId,
  stage: "PEDAL_8_PHASE",
  status: "UNAPPROVED",
  staticApproval: approval,
  immutableViewer: viewerPath,
  viewerSha256,
  scope: 'Hard checks cover phase/targets/attachments/loop closure. Shape, foot contact and body/frame collision require review in the immutable 3D validator.',
  captures,
  phaseMetrics,
  worst,
  hardVerdict,
  reviewVerdict,
  overall: Object.values(hardVerdict).every((value) => value === "PASS") ? "REVIEW" : "FAIL",
};
const outputPath = path.join(candidateDir, "pedal-8phase-report.json");
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputPath, worst, hardVerdict, reviewVerdict, overall: report.overall }, null, 2));
