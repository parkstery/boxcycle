import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = 'C:/20.HDev/boxcycle';
const releaseName = process.argv[2] ?? 'deploy-interval-20261027';
const evidenceName = process.argv[3] ?? '';
if (!/^[a-z0-9-]+$/.test(releaseName) || (evidenceName && !/^[a-z0-9-]+$/.test(evidenceName))) throw new Error('Invalid release/evidence name');
const release = path.join(root, 'tmp', releaseName);
if (fs.existsSync(release)) throw new Error('Release directory already exists');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFiles = [
 'apps/web/src/App.tsx', 'apps/web/src/components/maphud/MapHud.tsx',
 'apps/web/src/components/ride/RideSettingsPanel.tsx', 'apps/web/src/components/ride/RideSettingsSheet.tsx',
 'apps/web/src/components/ride/RideIntervalHud.tsx', 'apps/web/src/components/ride/RideIntervalHud.css',
 'apps/web/src/hooks/useRideInterval.ts', 'apps/web/src/lib/ride/rideInterval.ts',
 'apps/web/src/components/ride/RideIntervalSettingsSheet.tsx', 'apps/web/src/components/ride/RideIntervalSettingsSheet.css',
 'apps/web/src/components/ride/RideSettingsSheet.css',
];
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const publicDir = path.join(release, config.hosting.public);
fs.mkdirSync(path.dirname(publicDir), { recursive: true });
fs.cpSync(path.join(root, 'apps/web/dist'), publicDir, { recursive: true, dereference: false });
for (const entry of fs.readdirSync(publicDir, { recursive: true })) {
 if (fs.lstatSync(path.join(publicDir, entry)).isSymbolicLink()) throw new Error('Unexpected symlink');
}
fs.writeFileSync(path.join(release, 'firebase.json'), JSON.stringify({ hosting: config.hosting }, null, 2));
const manifest = {
 createdAt: new Date().toISOString(), project: 'boxcycle-dc2df', target: 'hosting',
 baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
 sourceFiles: Object.fromEntries(sourceFiles.map(file => [file, hash(path.join(root, file))])),
 files: Object.fromEntries(fs.readdirSync(publicDir, { recursive: true }).filter(file => fs.statSync(path.join(publicDir,file)).isFile()).map(file => [file.replaceAll('\\','/'), hash(path.join(publicDir,file))])),
};
fs.writeFileSync(path.join(release, 'deploy-manifest.json'), JSON.stringify(manifest, null, 2));
const evidenceDir = path.join(root, 'document/ops/20261027-ride-interval/evidence', evidenceName);
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'deploy-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ release, baseHead: manifest.baseHead, files: Object.keys(manifest.files).length }));
