/** Stage 0 only: immutable source snapshots, Blender inventory and raw input renders.
 * No model export, fitting or product promotion. See HARNESS.md.
 *
 * The modelling release is named explicitly; nothing is discovered by scanning a
 * directory, so a work-in-progress or superseded file can never be picked up by
 * accident. Legacy fit inputs live on their own path and stay provenance-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');

const flags = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) throw Error(`Unexpected argument: ${arg} (all inputs are named flags)`);
  const [key, inline] = arg.slice(2).split(/=(.*)/s);
  flags[key] = inline ?? process.argv[++i];
  if (flags[key] === undefined) throw Error(`Missing value for --${key}`);
}
const required = (key) => {
  const value = flags[key];
  if (!value) throw Error(`Missing required --${key}. See HARNESS.md "Modelling 교체 — 단계 0".`);
  return value;
};

const release = path.resolve(required('release'));
const riderGlb = required('rider-glb');
const riderBlend = required('rider-blend');
const sourceThreadId = required('source-task');
const evidence = (flags.evidence ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const legacyDir = path.resolve(flags.legacy ?? path.join(release, '../../../v2_4_cyclefit'));
const blender = flags.blender ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const blenderVersion = execFileSync(blender, ['--version'], { encoding: 'utf8' }).trim();
const renderSettings = {
  engine: 'CYCLES', device: 'CPU', samples: 16, resolution: [900, 760],
  orthographicScale: 2.2, target: [0.08, 0, 0.85],
  views: { side: [0.08, -5, 0.85], threequarter: [3.08, -5, 2.35] },
  pose: 'stored GLB transforms; no runtime overrides or phase normalization',
};
const entries = [];
const add = (key, original, snapshot) => {
  const data = fs.readFileSync(original); // required files fail closed
  entries.push({ key, original: path.resolve(original), snapshot, bytes: data.length, sha256: sha(data), data });
};
// The modelling release: the two model files plus whatever evidence was handed over.
for (const name of [riderGlb, riderBlend, ...evidence]) {
  add(`modelling/${name}`, path.join(release, name), `snapshots/modelling/${path.basename(name)}`);
}
const repoFiles = [
  'apps/web/public/rider/prototype/rider-lowpoly.glb',
  'apps/web/src/lib/riderPrototype/config.ts', 'apps/web/src/lib/riderPrototype/glbModelLayer.ts',
  'apps/web/src/lib/riderPrototype/geometry.json', 'apps/web/src/lib/riderPrototype/riderAnthropometry.json',
  'apps/web/src/lib/riderPrototype/riderRig.geometry.mjs', 'apps/web/src/lib/riderPrototype/riderRig.ts',
  'apps/web/src/lib/riderPrototype/riderIk.mjs', 'apps/web/src/lib/rider/riderGlbPedalPose.pose.mjs',
  'apps/web/src/lib/rider/riderGlbPedalPose.ts', 'apps/web/src/lib/rider/riderPedalMotion.ts',
  'apps/web/src/lib/camera/rideCameraFraming.ts', 'apps/web/src/lib/map/mapGlobeView.ts',
  'apps/web/scripts/generate-rider-prototype-glb.mjs',
  'apps/web/scripts/rider-preview/export-ik-joints-v2.mjs',
  'apps/web/scripts/rider-cycle-fit/register-modelling-baseline.mjs',
  'blender/rider-cycle-fit/inspect-modelling-baseline.py',
  'apps/web/package.json', 'package-lock.json',
];
for (const file of repoFiles) add(file, path.join(repo, file), `snapshots/boxcycle/${file}`);
// Preserve the legacy fit inputs as provenance, NOT as the selected new rider/cycle.
for (const file of ['fit_ik.py', 'ik-joints-v2.json', 'cycle-only.glb']) {
  add(`legacy/${file}`, path.join(legacyDir, file), `snapshots/legacy/${file}`);
}
const files = entries.map(({ data, ...entry }) => entry);
const inputHash = sha(JSON.stringify({ files, blenderVersion, renderSettings }));
const stamp = new Date(Date.now() + 9 * 3600_000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const candidateId = `${stamp}-${inputHash.slice(0, 8)}`;
const out = path.join(here, '.out/candidates', candidateId);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync(out); // never reuse or overwrite a candidate
for (const e of entries) {
  const dest = path.join(out, e.snapshot);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, e.data, { flag: 'wx' });
  if (sha(fs.readFileSync(dest)) !== e.sha256) throw Error(`Snapshot mismatch: ${e.key}`);
}
let revision = null;
try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(); } catch {}
const manifest = {
  schemaVersion: 2, stage: '0', status: 'PREPARING', candidateId, inputHash,
  registeredAt: new Date().toISOString(), blenderVersion, gitRevision: revision, renderSettings, files,
  sourceThreadId,
  releaseDirectory: release,
  selectedRider: `snapshots/modelling/${path.basename(riderGlb)}`,
  selectedRiderBlend: `snapshots/modelling/${path.basename(riderBlend)}`,
  selectedCycleContainer: 'snapshots/boxcycle/apps/web/public/rider/prototype/rider-lowpoly.glb',
  cycleNote: 'Current product contains rider and cycle. Cycle-only extraction belongs to stage A; legacy cycle is provenance only.',
  approval: null,
};
const manifestPath = path.join(out, 'manifest.json');
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
save();
console.log(`Candidate: ${candidateId}\nSnapshots verified: ${files.length}\nOutput: ${out}`);
try {
  const script = path.join(out, 'snapshots/boxcycle/blender/rider-cycle-fit/inspect-modelling-baseline.py');
  const output = execFileSync(blender, ['--background', '--factory-startup', '--python', script, '--', manifestPath],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 240_000 });
  fs.writeFileSync(path.join(out, 'blender.log'), output);
  const inventoryPath = path.join(out, 'inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  for (const key of ['current', 'modelling']) {
    if (!inventory[key]?.aabb || !inventory[key]?.nodes?.length) throw Error(`Missing inventory: ${key}`);
  }
  const artifactNames = ['inventory.json', ...['current', 'modelling'].flatMap(k =>
    Object.keys(renderSettings.views).map(v => `${k}-${v}.png`))];
  manifest.artifacts = artifactNames.map(name => {
    const b = fs.readFileSync(path.join(out, name));
    if (name.endsWith('.png') && (b.readUInt32BE(16) !== 900 || b.readUInt32BE(20) !== 760)) {
      throw Error(`Unexpected image size: ${name}`);
    }
    return { path: name, sha256: sha(b), bytes: b.length };
  });
  for (const e of entries) {
    if (sha(fs.readFileSync(e.original)) !== e.sha256) throw Error(`Original drift during capture: ${e.key}`);
    if (sha(fs.readFileSync(path.join(out, e.snapshot))) !== e.sha256) throw Error(`Snapshot drift: ${e.key}`);
  }
  manifest.status = 'READY_FOR_STAGE_0_REVIEW';
  manifest.verifiedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify({ status: manifest.status, candidateId, originalAndSnapshotHashes: 'PASS',
    sourceBlendArmatures: inventory.sourceBlend.armatures, sourceBlendVertexGroups: inventory.sourceBlend.meshesWithVertexGroups,
    renders: manifest.artifacts.filter(a => a.path.endsWith('.png')).length }, null, 2));
} catch (error) {
  manifest.status = 'FAILED'; manifest.error = String(error.message); save();
  fs.writeFileSync(path.join(out, 'blender-failure.log'), `${error.stdout ?? ''}\n${error.stderr ?? ''}`);
  throw error;
}
