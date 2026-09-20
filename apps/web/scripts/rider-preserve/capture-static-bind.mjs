#!/usr/bin/env node
/**
 * Shape-preserving rider feasibility capture.
 *
 * The modelling release viewer is self-contained and already implements the
 * release's leg IK + DQS. This harness freezes it at the authored crank phase,
 * captures the untouched source geometry, then captures the evaluated DQS bind
 * pose with identical camera/light settings. Product assets are never written.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.join(here, ".out", "candidates");
const releaseRoot =
  "C:/Users/kdrea/OneDrive/Documents/img/helmet_fix/revision/20260919-natural_joint_skin";
const wheelFixRoot = path.join(releaseRoot, "20260919_03-wheel-wobble-fix");
const inputs = {
  sourceGlb: path.join(wheelFixRoot, "roadcyclist_s5_wheelfix.glb"),
  sourceViewer: path.join(wheelFixRoot, "pedal_rig_viewer_wheelfix.html"),
  jointLayout: path.join(releaseRoot, "joint_layout.json"),
  partAxes: path.join(releaseRoot, "part_axes.json"),
  handoff: path.join(releaseRoot, "인계_수정_검증.md"),
  harness: fileURLToPath(import.meta.url),
};

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function kstStamp(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    compact: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}-${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}${p(kst.getUTCSeconds())}`,
    iso: `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())}T${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())}+09:00`,
  };
}

function assertInputs() {
  for (const [name, inputPath] of Object.entries(inputs)) {
    if (!fs.existsSync(inputPath)) throw new Error(`Missing ${name}: ${inputPath}`);
  }
}

function computeSourceHash() {
  const hash = crypto.createHash("sha256");
  for (const [name, inputPath] of Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b))) {
    const normalized = inputPath.replace(/\\/g, "/");
    hash.update(`${name}\0${normalized}\0`);
    hash.update(fs.readFileSync(inputPath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function injectCaptureApi(html, metadata) {
  const overlay = `<div id="rtwCaptureMeta" style="position:absolute;z-index:20;left:14px;top:14px;padding:9px 12px;border:1px solid rgba(255,255,255,.28);border-radius:6px;background:rgba(8,12,16,.82);color:#f4f7f8;font:12px/1.45 ui-monospace,Consolas,monospace;pointer-events:none;white-space:pre"></div>`;
  let out = html.replace('<div id="stage">', `<div id="stage">${overlay}`);
  out = out.replace("const draws=[];", "let CAPTURE_SOURCE=false;\nconst draws=[];");
  out = out.replace(
    "function worldMatrix(grp,ca){",
    "function worldMatrix(grp,ca){\n  if(CAPTURE_SOURCE) return M4.ident();",
  );
  out = out.replace(
    "const stL=updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapL=lastGapMM;",
    `const stL=updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapL=lastGapMM;
  if(CAPTURE_SOURCE){
    for(const d of draws) if(d.isLeg){ d.pos.set(d.restPos); d.nrm.set(d.restNrm); }
  }`,
  );
  const api = `
<script>
(() => {
  const META=${JSON.stringify(metadata)};
  let captureLabel='SOURCE ORIGINAL';
  function updateMeta(){
    document.getElementById('rtwCaptureMeta').textContent =
      'Candidate  '+META.candidateId+'\\n'+
      'Source     '+META.sourceHash.slice(0,12)+'\\n'+
      'GLB        '+META.glbHash.slice(0,12)+'\\n'+
      'Stage      STATIC_BIND_FEASIBILITY\\n'+
      'Status     UNAPPROVED\\n'+
      'Rendered   '+META.createdAtKst+'\\n'+
      'View       '+captureLabel;
  }
  window.__RTW_CAPTURE__={
    setMode(mode){
      CAPTURE_SOURCE=mode==='source';
      captureLabel=CAPTURE_SOURCE?'SOURCE ORIGINAL':'DQS BIND EVALUATION';
      S.play=false; setPlay(false); crankAngle=0;
      S.mode='blend'; SKIN_DQS=true; SWAY.on=false;
      S.skel=false; S.weight=false; S.wire=false; S.stretch=false; S.bridge=false;
      S.bike=true; S.body=true;
      updateMeta();
    },
    setView(view){
      Object.assign(cam,JSON.parse(JSON.stringify(VIEWS[view])));
      captureLabel=(CAPTURE_SOURCE?'SOURCE ORIGINAL':'DQS BIND EVALUATION')+' / '+view.toUpperCase();
      updateMeta();
    },
    stats(){
      let max=0,sum=0,count=0,maxEdgeDelta=0,edgeSq=0,edgeCount=0,maxEdgeStrain=0;
      for(const d of draws) if(d.isLeg){
        for(let i=0;i<d.pos.length;i+=3){
          const dx=d.pos[i]-d.restPos[i],dy=d.pos[i+1]-d.restPos[i+1],dz=d.pos[i+2]-d.restPos[i+2];
          const q=dx*dx+dy*dy+dz*dz; max=Math.max(max,Math.sqrt(q)); sum+=q; count++;
        }
        for(let e=0;e<d.edges.length;e+=2){
          const a=d.edges[e]*3,b=d.edges[e+1]*3;
          const now=Math.hypot(d.pos[a]-d.pos[b],d.pos[a+1]-d.pos[b+1],d.pos[a+2]-d.pos[b+2]);
          const rest=d.edgeRest[e/2],delta=Math.abs(now-rest);
          maxEdgeDelta=Math.max(maxEdgeDelta,delta); edgeSq+=delta*delta; edgeCount++;
          if(rest>=0.002) maxEdgeStrain=Math.max(maxEdgeStrain,delta/rest);
        }
      }
      return {mode:CAPTURE_SOURCE?'source':'bind', legVertexCount:count,
        maxLegVertexDeltaMm:max*1000, rmsLegVertexDeltaMm:Math.sqrt(sum/Math.max(count,1))*1000,
        legEdgeCount:edgeCount,maxLegEdgeLengthDeltaMm:maxEdgeDelta*1000,
        rmsLegEdgeLengthDeltaMm:Math.sqrt(edgeSq/Math.max(edgeCount,1))*1000,
        maxLegEdgeStrainPercent:maxEdgeStrain*100,
        rightKneeDeg:pose.R.kneeAng,leftKneeDeg:pose.L.kneeAng,
        rightClamped:pose.R.clamped,leftClamped:pose.L.clamped,
        rightDeficitMm:pose.R.deficit*1000,leftDeficitMm:pose.L.deficit*1000};
    }
  };
  updateMeta();
})();
</script>`;
  out = out.replace("</body>", `${api}\n</body>`);
  for (const required of ["CAPTURE_SOURCE", "__RTW_CAPTURE__", "rtwCaptureMeta"]) {
    if (!out.includes(required)) throw new Error(`Viewer injection failed: ${required}`);
  }
  return out;
}

async function main() {
  assertInputs();
  const sourceHash = computeSourceHash();
  const stamp = kstStamp();
  const candidateId = `${stamp.compact}-${sourceHash.slice(0, 8)}`;
  const candidateDir = path.join(outRoot, candidateId);
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(candidateDir, { recursive: false });

  const glbBytes = fs.readFileSync(inputs.sourceGlb);
  const glbHash = sha256(glbBytes);
  const sourceGlbOut = path.join(candidateDir, "source-roadcyclist-s5.glb");
  fs.copyFileSync(inputs.sourceGlb, sourceGlbOut);

  const metadata = { candidateId, sourceHash, glbHash, createdAtKst: stamp.iso };
  const viewerHtml = injectCaptureApi(fs.readFileSync(inputs.sourceViewer, "utf8"), metadata);
  const viewerOut = path.join(candidateDir, `preserved-viewer-${candidateId}.html`);
  fs.writeFileSync(viewerOut, viewerHtml);

  const manifest = {
    schemaVersion: 1,
    candidateId,
    stage: "STATIC_BIND_FEASIBILITY",
    status: "UNAPPROVED",
    createdAtKst: stamp.iso,
    sourceHash,
    glbHash,
    inputs: Object.fromEntries(Object.entries(inputs).map(([name, inputPath]) => [name, {
      path: inputPath,
      bytes: fs.statSync(inputPath).size,
      sha256: sha256(fs.readFileSync(inputPath)),
    }])),
    outputs: { sourceGlb: sourceGlbOut, viewer: viewerOut, screenshots: [] },
    captureContract: {
      source: "untouched source vertices and identity group transforms",
      bind: "release viewer DQS evaluated at authored crank angle 0, sway off",
      sameCameraLighting: true,
      productFilesModified: false,
    },
  };

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(viewerOut).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.__RTW_CAPTURE__));
    await page.waitForTimeout(1200);
    const captures = [];
    const stats = {};
    for (const mode of ["source", "bind"]) {
      await page.evaluate((m) => window.__RTW_CAPTURE__.setMode(m), mode);
      await page.waitForTimeout(200);
      for (const view of ["side", "front", "knee", "34"]) {
        await page.evaluate((v) => window.__RTW_CAPTURE__.setView(v), view);
        await page.waitForTimeout(150);
        const outputPath = path.join(candidateDir, `${mode}-${view}-${candidateId}.png`);
        await page.locator("#stage").screenshot({ path: outputPath });
        captures.push(outputPath);
      }
      stats[mode] = await page.evaluate(() => window.__RTW_CAPTURE__.stats());
    }
    manifest.outputs.screenshots = captures;
    manifest.metrics = stats;
  } finally {
    await browser?.close();
  }
  const manifestPath = path.join(candidateDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ candidateId, candidateDir, manifestPath, metrics: manifest.metrics }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
