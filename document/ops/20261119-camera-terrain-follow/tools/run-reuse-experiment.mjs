// Reuses the existing local production-build/Edge terrain profiling harness.
// No production services, publishing, source rewrites or SDK cache patches.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const web=path.join(root,'apps/web');
const evidence=path.join(root,'tmp/terrain-perf');
const output=path.join(root,'document/ops/20261119-camera-terrain-follow/reuse-experiment-summary.json');
async function summarize() {
  const files=(await fs.readdir(evidence)).filter(f=>/^prod-tiles-fast-reuse-[a-h]-(zoom-abc|paint-abc|custom-overlay|custom-repeat)\.json$/.test(f));
  const rows=[];
  for(const file of files) {
    const r=JSON.parse(await fs.readFile(path.join(evidence,file),'utf8'));
    rows.push({file,fps:1000/r.frame.mean,p95:r.frame.p95,mapMs:r.map.mean,gpuMs:r.gpu.mean,
      considered:r.considered.mean,redrawn:r.redrawn.mean,cached:r.cachedPairs.mean,
      zoom:[Math.min(...r.rows.map(x=>x.zoom)),Math.max(...r.rows.map(x=>x.zoom))],
      hidden:r.reuseExperiment?.hidden, frozen:r.reuseExperiment?.frozen?.length,
      terrainSafetyOmitted:r.reuseExperiment?.terrainSafetyOmitted,overlay:r.overlay,
      lifecycle:r.overlayLifecycle,errors:r.reuseExperiment?.errors,
      terrain:[...new Set(r.rows.map(row=>row.exaggeration))],
      css:r.css,buffer:r.buffer,renderer:r.renderer,
      firstCenter:r.rows[0].center,lastCenter:r.rows.at(-1).center,
      dirtySourceFrames:r.dirtySourceFrames});
  }
  await fs.writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),rows},null,2)+'\n');
  console.table(rows.map(r=>({case:r.file.replace('prod-tiles-fast-reuse-','').replace('.json',''),
    fps:r.fps.toFixed(2),p95:r.p95.toFixed(1),cached:r.cached.toFixed(1),redrawn:r.redrawn.toFixed(1),
    segments:r.overlay?.segments,visibleSamples:r.overlay?.gpuVisibleSamples})));
  console.log('SUMMARY',output);
}
await summarize();
if(process.argv.includes('--validate')) {
  for(const file of ['terrain-overlay-probe.js','run-reuse-experiment.mjs']) {
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))],{encoding:'utf8'});
    console.log('syntax',file,result.status);if(result.status)throw new Error(result.stderr);
  }
  const handoff=path.join(root,'document/ops/HANDOFF.md');
  const bytes=(await fs.stat(handoff)).size;
  console.log('HANDOFF bytes',bytes);if(bytes>8192)throw new Error('HANDOFF exceeds 8 KiB');
  const check=spawnSync(process.execPath,['scripts/handoff-check.mjs','--check'],{cwd:root,encoding:'utf8'});
  console.log(check.stdout);if(check.status)throw new Error(check.stderr);
  const whitespace=spawnSync('git',['diff','--check','--','document/ops/HANDOFF.md','document/ops/20261119-camera-terrain-follow'],{cwd:root,encoding:'utf8'});
  console.log('diff check',whitespace.status,whitespace.stdout,whitespace.stderr);if(whitespace.status)process.exit(1);
  process.exit(0);
}
if(process.argv.includes('--diagnose')) {
  const log=await fs.readFile(path.join(evidence,'reuse-custom-repeat.log'),'utf8');
  const at=log.indexOf('Error: expect'); console.log(log.slice(Math.max(0,at-300),at+1500));
  const sourcemap=JSON.parse(await fs.readFile(path.join(root,'node_modules/mapbox-gl/dist/mapbox-gl.js.map'),'utf8'));
  for(const name of ['draw_custom.ts','transform.ts']) {
    const i=sourcemap.sources.findIndex(x=>x.endsWith('/'+name));
    const code=sourcemap.sourcesContent[i]??'';
    const pos=code.indexOf(name==='draw_custom.ts'?'implementation.render':'customLayerMatrix(');
    console.log(name,code.slice(Math.max(0,pos-1000),pos+2400));
  }
  process.exit(0);
}
if(process.argv.includes('--inspect'))process.exit(0);
const logfile=path.join(evidence,'reuse-custom-repeat.log');
const handle=await fs.open(logfile,'w');
const args=['scripts/e2e/run-with-deadline.mjs','--limit-sec','240','--','node',
  'scripts/e2e/run-with-functions-emulator.mjs',
  'node ../../node_modules/@playwright/test/cli.js test --config ../../tmp/terrain-perf/app-tile-playwright.config.ts'];
console.log('RUN reverse-order custom + baseline; log:',logfile);
const child=spawn(process.execPath,args,{cwd:web,env:{...process.env,RTW_DEV_PORT:'5210',
  FUNCTIONS_DISCOVERY_TIMEOUT:'45',TERRAIN_PARTIAL_FIXTURE:'0',TERRAIN_REUSE_PROD:'1',
  TERRAIN_STYLE_MATCHED:'1',TERRAIN_REVERSE:'1',TERRAIN_RUN_SUFFIX:'-custom-repeat',
  TERRAIN_CASES:process.argv.includes('--custom-only')?'fast-reuse-h':'fast-reuse-h,fast-reuse-a'},stdio:['ignore',handle.fd,handle.fd]});
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
await handle.close();
const log=await fs.readFile(logfile,'utf8');
console.log(log.split(/\r?\n/).filter(line=>/passed|failed|Error|done exit|fps:|name:/.test(line)).slice(-22).join('\n'));
await summarize();
process.exitCode=code??1;
