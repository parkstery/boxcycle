#!/usr/bin/env node
// Inspect the frozen viewer at bind phase only. Never edits the candidate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputIntegrity = Object.fromEntries(Object.entries(manifest.inputs).map(([name,input]) => {
  const bytes=fs.readFileSync(input.path);
  return [name,bytes.length===input.bytes && hash(bytes)===input.sha256];
}));
const viewer=fs.readFileSync(manifest.outputs.viewer,'utf8');
const embedded=/const GLB_B64\s*=\s*"([A-Za-z0-9+/=]+)"/.exec(viewer);
if(!embedded) throw new Error('Cannot verify embedded GLB');
const embeddedHash=hash(Buffer.from(embedded[1],'base64'));
if(embeddedHash!==manifest.glbHash || hash(fs.readFileSync(manifest.outputs.sourceGlb))!==manifest.glbHash)
  throw new Error('Embedded or copied GLB differs from registered source');
if(Object.values(inputIntegrity).some(ok=>!ok)) throw new Error('Registered inputs changed');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let result;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(manifest.outputs.viewer).href);
  await page.waitForFunction(() => Boolean(window.__RTW_CAPTURE__));
  await page.evaluate(() => window.__RTW_CAPTURE__.setMode('bind'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  result = await page.evaluate(() => {
    const point = (m, p) => [0, 1, 2].map(i => m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);
    const dist = (a,b) => Math.hypot(...a.map((v,i) => v-b[i]))*1000;
    const anchors = Object.fromEntries(['R','L'].map(side => {
      const pedal = point(groupMatrix('pedal'+side, 0), PEDAL0[side]);
      const crank = point(groupMatrix('crank', 0), PEDAL0[side]);
      return [side, { authored: PEDAL0[side], target: pedalPos(side,0), rendered: pedal,
        renderedToTargetMm: dist(pedal,pedalPos(side,0)),
        authoredCrankAnchorToRenderedPedalMm: dist(crank,pedal) }];
    }));
    const geometry = draws.map(d => {
      const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<d.restPos.length;i++) {lo[i%3]=Math.min(lo[i%3],d.restPos[i]);hi[i%3]=Math.max(hi[i%3],d.restPos[i]);}
      return {name:d.name,group:d.grp,vertices:d.pos.length/3,triangles:d.idx.length/3,min:lo,max:hi};
    });
    return { metrics:window.__RTW_CAPTURE__.stats(), anchors, bb:BB,
      primitives:draws.length, triangles:draws.reduce((n,d)=>n+d.idx.length/3,0),
      crankGeometry:geometry.filter(d=>['crank','pedalR','pedalL'].includes(d.group)) };
  });
  if(errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
const checks={
  inputsUnchanged:Object.values(inputIntegrity).every(Boolean),
  embeddedAndCopiedGlbMatch:embeddedHash===manifest.glbHash,
  guideMappingComplete:Object.values(result.metrics.guideMapping).every(item=>item.unmatched===0),
  bindVertexRestore:result.metrics.maxLegVertexDeltaMm<0.001,
  bindEdgeRestore:result.metrics.maxLegEdgeLengthDeltaMm<0.001,
  pedalBindRestore:Object.values(result.anchors).every(item=>item.authoredCrankAnchorToRenderedPedalMm<0.001),
  ikReachable:!result.metrics.rightClamped&&!result.metrics.leftClamped,
};
const report = {candidateId:manifest.candidateId,stage:'STATIC_AUDIT',viewerSha256:hash(fs.readFileSync(manifest.outputs.viewer)),
  inputIntegrity,embeddedGlbSha256:embeddedHash,checks,overall:Object.values(checks).every(Boolean)?'PASS':'FAIL',
  scope:'Static bind restoration only; no pedal-phase, collision, app or performance approval.',...result};
const out = path.join(path.dirname(dir), '..', `static-audit-${manifest.candidateId}.json`);
fs.writeFileSync(out, JSON.stringify(report,null,2));
console.log(JSON.stringify({out,...report},null,2));
if(report.overall==='FAIL') process.exitCode=1;
