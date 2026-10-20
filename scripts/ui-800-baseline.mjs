import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const out = path.join(root, '.out/ui-800x360/baseline');
fs.mkdirSync(out, { recursive: true });
const paths = execFileSync('git', ['ls-files', 'apps/web/src'], {encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const files = {};
for (const name of paths) {
  const absolute = path.join(root, name);
  if (!fs.existsSync(absolute)) continue;
  const data = fs.readFileSync(absolute);
  files[name] = crypto.createHash('sha256').update(data).digest('hex');
  const destination = path.join(out, name);
  if (fs.existsSync(destination)) throw new Error(`Baseline exists: ${destination}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(absolute, destination);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
  capturedAt:new Date().toISOString(),
  branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
  head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), files,
},null,2));
console.log(`Baseline saved: ${paths.length} tracked source files; no env/private data.`);
