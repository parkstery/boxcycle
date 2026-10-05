// Isolated mutation checks for the cleanup guard; never mutate the user's documents.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const run = (fixture) => spawnSync(process.execPath, ['scripts/check-document-system.mjs', ...(fixture ? ['--root', fixture] : [])], { cwd: root, encoding: 'utf8' });
const tests = [
  ['missing-link', 'document/README.md', (s) => s + '\n[missing](does-not-exist-failcheck.md)\n', '"brokenLinks": 1'],
  ['reference-not-indexed', 'document/README.md', (s) => s.replace('](reference/product/example.md)', '](#failcheck)'), 'Not indexed:'],
  ['closed-work-in-progress', 'document/ops/PROGRESS.md', (s) => s + '\n| [failcheck](README.md) | CLOSED |\n', 'Closed work in PROGRESS:'],
];
if (run().status !== 0) throw new Error('Clean baseline must pass before mutation checks');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'rtw-document-failcheck-'));
const files = {
  'document/README.md': '[example](reference/product/example.md)\n',
  'document/ops/PROGRESS.md': '# Current work\n',
  'document/reference/product/example.md': '# Reference\n',
};
try {
  for (const [file, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
    fs.writeFileSync(path.join(fixture, file), contents);
  }
  if (run(fixture).status !== 0) throw new Error('Clean fixture must pass');
  for (const [name, file, mutate, expected] of tests) {
    const target = path.join(fixture, file);
    try {
      fs.writeFileSync(target, mutate(files[file]));
      const result = run(fixture);
      if (result.status !== 1 || !result.stdout.includes(expected)) throw new Error(`${name} did not fail for the expected reason: ${result.stdout}`);
      console.log(`PASS ${name}: detected with exit 1`);
    } finally {
      fs.writeFileSync(target, files[file]);
    }
  }
} finally {
  for (const file of Object.keys(files)) fs.unlinkSync(path.join(fixture, file));
  for (const dir of ['document/reference/product', 'document/reference', 'document/ops', 'document', ''])
    fs.rmdirSync(path.join(fixture, dir));
}
if (run().status !== 0) throw new Error('Restored documents failed');
console.log('PASS restored current documents: exit 0');
