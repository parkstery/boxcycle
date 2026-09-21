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
const captureScreenshots = process.argv.includes("--screenshots");
const releaseRoot =
  "C:/Users/kdrea/OneDrive/Documents/img/helmet_fix/revision/20260919-natural_joint_skin";
const wheelFixRoot = path.join(releaseRoot, "20260919_03-wheel-wobble-fix");
const inputs = {
  sourceGlb: path.join(wheelFixRoot, "roadcyclist_s5_wheelfix.glb"),
  sourceViewer: path.join(wheelFixRoot, "pedal_rig_viewer_wheelfix.html"),
  jointLayout: path.join(releaseRoot, "joint_layout.json"),
  partAxes: path.join(releaseRoot, "part_axes.json"),
  handoff: path.join(releaseRoot, "인계_수정_검증.md"),
  guideExporter: path.resolve(here, "../../../../blender/rider-cycle-fit/export-natural-skin-guides.py"),
  guideData: path.join(here, ".out", "natural-skin-guides-full.json"),
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

function injectCaptureApi(html, metadata, authoredGuides) {
  const overlay = `<div id="rtwCaptureMeta" style="position:absolute;z-index:20;left:14px;top:14px;padding:9px 12px;border:1px solid rgba(255,255,255,.28);border-radius:6px;background:rgba(8,12,16,.82);color:#f4f7f8;font:12px/1.45 ui-monospace,Consolas,monospace;pointer-events:none;white-space:pre"></div>`;
  let out = html.replace('<div id="stage">', `<div id="stage">${overlay}`);
  out = out.replace(
    "const GLB = parseGLB(",
    `const AUTHORED_GUIDES=${JSON.stringify(authoredGuides)};\nconst GUIDE_MATCH_STATS={};\nconst GLB = parseGLB(`,
  );
  // The release's approximate pedal anchors describe a point about 4.3 mm
  // above each platform centre, creating unequal radii about the real BB.
  // Register the centres of the two named, symmetric pedal bodies instead.
  // Do not translate or reshape any mesh to make the anchors fit.
  out = out.replace(
    "const BB=RIG.bb, PEDAL0=",
    `const PEDAL_ANCHOR_REGISTRATION={};
for(const [side,name] of [['R','Mesh_48'],['L','Mesh_52']]){
  const meshes=draws.filter(d=>d.name===name);
  if(!meshes.length) throw new Error('Missing pedal body '+name);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const d of meshes) for(let i=0;i<d.restPos.length;i++){
    lo[i%3]=Math.min(lo[i%3],d.restPos[i]); hi[i%3]=Math.max(hi[i%3],d.restPos[i]);
  }
  const centre=lo.map((v,i)=>(v+hi[i])/2);
  PEDAL_ANCHOR_REGISTRATION[side]={name,previous:RIG.pedal[side].slice(),centre};
  RIG.pedal[side]=centre;
}
if(Math.hypot(...[0,1].map(i=>RIG.pedal.R[i]+RIG.pedal.L[i]-2*RIG.bb[i]))>1e-7)
  throw new Error('Authored pedal bodies are not symmetric about release BB');
const BB=RIG.bb, PEDAL0=`,
  );
  out = out.replace(
    "const crankPhase={R:Math.atan2(PEDAL0.R[1]-BB[1],PEDAL0.R[0]-BB[0]),\n                  L:Math.atan2(PEDAL0.L[1]-BB[1],PEDAL0.L[0]-BB[0])};",
    `const crankPhase={R:Math.atan2(PEDAL0.R[1]-BB[1],PEDAL0.R[0]-BB[0]), L:0};
crankPhase.L=crankPhase.R+Math.PI;`,
  );
  // Lock each shoe's authored cleat point to its pedal centre. A periodic foot
  // pitch table preserves the release's knee trajectory while retaining at
  // least 25 degrees of knee bend at the most extended phases. The 15-degree
  // knots were derived from the release IK and validated at one-degree steps.
  out = out.replace(
    "function ankleOffset(side){\n  const k=(side==='R'?1:-1)*Math.cos(crankAngle);\n  const v=V3.add(ANK.C, V3.mul(ANK.D,k));\n  return [v[0], v[1], side==='R'? v[2] : -v[2]];\n}",
    `const FOOT_PITCH_STEP_DEG=15;
const FOOT_PITCH_DEG={
  R:[0,0.5,-1.9,1.7,6.5,9.4,12.4,15.4,18.2,20.6,22.3,23.3,23.5,22.9,21.5,19.6,17.3,14.7,12,9.3,6.5,4,1.9,0.5,0],
  L:[0,-0.3,-1.2,-2.6,-4.3,-6.1,-8.2,-10.3,-12.5,-14.7,-16.7,-18.2,-19.1,-19.3,-21.7,-19.1,-15.2,-12.9,-10.3,-7.7,-5.2,-3,-1.4,-0.4,0]
};
function ankleOffset(side){return V3.sub(RIG0.ankle[side],PEDAL0[side]);}
function footPitch(side,ca){
  const phase=((ca*180/Math.PI)%360+360)%360;
  const i=Math.floor(phase/FOOT_PITCH_STEP_DEG),t=(phase-i*FOOT_PITCH_STEP_DEG)/FOOT_PITCH_STEP_DEG;
  return (FOOT_PITCH_DEG[side][i]+(FOOT_PITCH_DEG[side][i+1]-FOOT_PITCH_DEG[side][i])*t)*Math.PI/180;
}`,
  );
  // Pedal platforms stay level while their centres follow the crank anchors.
  // The release viewer previously reused the foot matrix here, which moved the
  // platform up to 54 mm away from the crank even though its computed target
  // remained correct.
  out = out.replace(
    "case 'pedalR': return pose.R.Mft;\n    case 'pedalL': return pose.L.Mft;",
    `case 'pedalR': return M4.trans(V3.sub(pedalPos('R',ca),PEDAL0.R));
    case 'pedalL': return M4.trans(V3.sub(pedalPos('L',ca),PEDAL0.L));`,
  );
  const authoredWeightMapper = `
/* Blender Guide_* vertex groups are the modelling authority for the two
   continuous knee meshes. glTF export may duplicate vertices at seams, so
   each draw vertex is mapped back to the nearest authored vertex in a 0.1 mm
   spatial bucket. The accepted tolerance is 0.2 mm; measured export drift is
   below 0.001 mm. */
const GUIDE_CELL=1e-4, GUIDE_TOL=2e-4;
const GUIDE_MESH={R:'Right continuous knee skin',L:'Left continuous knee skin'};
const GUIDE_GROUP={R:['Guide_Right_Thigh','Guide_Right_Shin'],L:['Guide_Left_Thigh','Guide_Left_Shin']};
const GUIDE_INDEX={};
function guideCell(p){return [Math.round(p[0]/GUIDE_CELL),Math.round(p[1]/GUIDE_CELL),Math.round(p[2]/GUIDE_CELL)];}
function guideKey(x,y,z){return x+','+y+','+z;}
function guideIndex(side){
  if(GUIDE_INDEX[side]) return GUIDE_INDEX[side];
  const rows=AUTHORED_GUIDES[GUIDE_MESH[side]];
  if(!rows) throw new Error('Missing authored guide mesh: '+GUIDE_MESH[side]);
  const bins=new Map();
  for(let i=0;i<rows.length;i++){
    const c=guideCell(rows[i].p), k=guideKey(c[0],c[1],c[2]);
    if(!bins.has(k)) bins.set(k,[]); bins.get(k).push(i);
  }
  return GUIDE_INDEX[side]={rows,bins};
}
function authoredWeights(dr,side){
  if(dr.name!==GUIDE_MESH[side]) return null;
  const {rows,bins}=guideIndex(side), groups=GUIDE_GROUP[side];
  const n=dr.restPos.length/3, W=new Float32Array(n*4);
  let maxDistance=0, unmatched=0;
  for(let i=0;i<n;i++){
    const p=[dr.restPos[i*3],dr.restPos[i*3+1],dr.restPos[i*3+2]], c=guideCell(p);
    let best=-1,bestD=Infinity;
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++){
      const ids=bins.get(guideKey(c[0]+dx,c[1]+dy,c[2]+dz))||[];
      for(const id of ids){const q=rows[id].p,d=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);if(d<bestD){bestD=d;best=id;}}
    }
    if(best<0||bestD>GUIDE_TOL){unmatched++;continue;}
    const w=rows[best].w, wt=w[groups[0]]||0, ws=w[groups[1]]||0, sum=wt+ws;
    if(sum<=0){unmatched++;continue;}
    W[i*4+1]=wt/sum; W[i*4+2]=ws/sum;
    maxDistance=Math.max(maxDistance,bestD);
  }
  GUIDE_MATCH_STATS[side]={mesh:dr.name,vertices:n,unmatched,maxDistanceMm:maxDistance*1000};
  if(unmatched) throw new Error('Authored guide mapping failed for '+side+': '+unmatched+'/'+n+' unmatched');
  return W;
}
`;
  out = out.replace(
    "/* ---------- 좌측 다리 전용 수정 ----------",
    `${authoredWeightMapper}\n/* ---------- 좌측 다리 전용 수정 ----------`,
  );
  out = out.replace(
    "const n=dr.arc.length, W=new Float32Array(n*4);\n    const isSock = isSockName(dr.name);",
    `const n=dr.arc.length, W=new Float32Array(n*4);
    const isSock = isSockName(dr.name);
    if(dr.name==='Mesh_153'||dr.name==='Mesh_163'){
      /* These upper-thigh shells have a single 106 mm topology edge spanning
         the hip. Blending pelvis/thigh weights across that edge collapses it by
         up to 66 mm. The shell continues inside the shorts, so bind it rigidly
         to the thigh and keep the visible continuous knee skin DQS weighted. */
      for(let i=0;i<n;i++) W[i*4+1]=1;
      dr.w4=W;dr.isSock=false;continue;
    }
    const guideW=authoredWeights(dr,L.side);
    if(guideW){W.set(guideW);dr.w4=W;dr.isSock=false;continue;}`,
  );
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
  out = out.replace(
    `  const rigid = S.mode==='rigid';
  updateSway();
  const flexAmp=S.af*Math.PI/180;
  const fR=flexAmp*Math.sin(crankPhase.R-crankAngle+Math.PI/2);
  const fL=flexAmp*Math.sin(crankPhase.L-crankAngle+Math.PI/2);
  solveLeg('R',pedalPos('R',crankAngle),fR);
  solveLeg('L',pedalPos('L',crankAngle),fL);
  const stR=updateSkin('R',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapR=lastGapMM;
  const stL=updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapL=lastGapMM;`,
    `  const rigid = S.mode==='rigid';
  updateSway();
  const fR=footPitch('R',crankAngle),fL=footPitch('L',crankAngle);
  solveLeg('R',pedalPos('R',crankAngle),fR);
  solveLeg('L',pedalPos('L',crankAngle),fL);
  const stR=updateSkin('R',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapR=lastGapMM;
  const stL=updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,rigid); gapL=lastGapMM;`,
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
      'Stage      STATIC_GUIDE_WEIGHTED_BIND\\n'+
      'Status     UNAPPROVED\\n'+
      'Rendered   '+META.createdAtKst+'\\n'+
      'View       '+captureLabel;
  }
  window.__RTW_CAPTURE__={
    setMode(mode){
      CAPTURE_SOURCE=mode==='source';
      captureLabel=CAPTURE_SOURCE?'SOURCE ORIGINAL':'DQS BIND EVALUATION';
      S.play=false; setPlay(false); crankAngle=0;
      crankR=crankR0; S.cl=crankR0*1000;
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
    setPhase(deg){
      CAPTURE_SOURCE=false; S.play=false; setPlay(false);
      crankAngle=deg*Math.PI/180;
      updateSway();
      solveLeg('R',pedalPos('R',crankAngle),footPitch('R',crankAngle));
      solveLeg('L',pedalPos('L',crankAngle),footPitch('L',crankAngle));
      updateSkin('R',S.kb/1000,S.hb/1000,S.ab/1000,S.mode==='rigid');
      updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,S.mode==='rigid');
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
        pedalAnchorRegistration:PEDAL_ANCHOR_REGISTRATION,
        crankRadiusMm:crankR*1000,
        guideMapping:JSON.parse(JSON.stringify(GUIDE_MATCH_STATS)),
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
  for (const required of ["CAPTURE_SOURCE", "__RTW_CAPTURE__", "rtwCaptureMeta", "AUTHORED_GUIDES", "authoredWeights", "FOOT_PITCH_DEG", "setPhase(deg)"]) {
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
  const authoredGuides = JSON.parse(fs.readFileSync(inputs.guideData, "utf8"));
  const viewerHtml = injectCaptureApi(fs.readFileSync(inputs.sourceViewer, "utf8"), metadata, authoredGuides);
  const viewerOut = path.join(candidateDir, `preserved-viewer-${candidateId}.html`);
  fs.writeFileSync(viewerOut, viewerHtml);

  const manifest = {
    schemaVersion: 1,
    candidateId,
    stage: "STATIC_GUIDE_WEIGHTED_BIND",
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
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto(pathToFileURL(viewerOut).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.__RTW_CAPTURE__));
    await page.waitForTimeout(1200);
    if (pageErrors.length) throw new Error(`Viewer errors: ${pageErrors.join(" | ")}`);
    const captures = [];
    const stats = {};
    for (const mode of ["source", "bind"]) {
      await page.evaluate((m) => window.__RTW_CAPTURE__.setMode(m), mode);
      await page.waitForTimeout(200);
      for (const view of ["side", "front", "knee", "34"]) {
        await page.evaluate((v) => window.__RTW_CAPTURE__.setView(v), view);
        await page.waitForTimeout(150);
        if (captureScreenshots) {
          const outputPath = path.join(candidateDir, `${mode}-${view}-${candidateId}.png`);
          await page.locator("#stage").screenshot({ path: outputPath });
          captures.push(outputPath);
        }
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
