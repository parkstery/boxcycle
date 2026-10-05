import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only document checks; archives are opt-in because they contain historical contracts.
const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const root = path.resolve(option('--root') ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const slash = (p) => p.replaceAll('\\', '/');
const relative = (p) => slash(path.relative(root, p));
const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const all = args.includes('--all');
const index = fs.readFileSync(path.join(root, 'document/README.md'), 'utf8');
const progress = fs.readFileSync(path.join(root, 'document/ops/PROGRESS.md'), 'utf8');
const files = walk(path.join(root, 'document')).filter((p) => p.endsWith('.md')).filter((p) => {
  if (all) return true;
  const r = relative(p);
  if (r.startsWith('document/archive/')) return false;
  if (!r.startsWith('document/ops/')) return true;
  if (['document/ops/README.md', 'document/ops/PROGRESS.md'].includes(r)) return true;
  const bundle = r.split('/')[2];
  if (!progress.includes(`](${bundle}/`)) return false;
  // Entry points and the latest documents explicitly linked by their README.
  const entry = path.join(root, 'document/ops', bundle, 'README.md');
  if (p === entry || path.basename(p) === 'HANDOFF.md' || path.basename(p) === 'INSTRUCTION.md') return true;
  return fs.existsSync(entry) && fs.readFileSync(entry, 'utf8').includes(`](${path.basename(p)})`);
});
const errors = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  // Ignore fenced examples and inline code, so example commands are not mistaken for links.
  const body = text.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\r\n]*$/gm, '').replace(/`[^`\r\n]*`/g, '');
  const re = /!?\[[^\]\r\n]*\]\((<[^>\r\n]+>|(?:[^()\r\n]|\([^()\r\n]*\))+)\)/g;
  for (const match of body.matchAll(re)) {
    let target = match[1].trim().replace(/\s+["'][^"']*["']$/, '');
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target) || /[<>{}*]/.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;
    try { target = decodeURIComponent(target); } catch { /* retain literal malformed URI */ }
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) errors.push({ file: relative(file), target: relative(resolved) });
  }
}
const structural = [];
for (const file of walk(path.join(root, 'document/reference')).filter((p) => p.endsWith('.md'))) {
  if (!index.includes(`](${slash(path.relative(path.join(root, 'document'), file))})`))
    structural.push(`Not indexed: ${relative(file)}`);
}
for (const row of progress.split('\n')) {
  if (row.startsWith('| [') && /\bCLOSED\b|\|\s*종료\s*\|/.test(row)) structural.push(`Closed work in PROGRESS: ${row}`);
}
const unique = [...new Map(errors.map((e) => [JSON.stringify(e), e])).values()];
const write = option('--write-baseline');
if (write) {
  fs.writeFileSync(path.resolve(root, write), JSON.stringify({ files: files.length, errors: unique }, null, 2) + '\n');
  console.log(`Baseline saved: ${write} (${unique.length} broken links)`);
  process.exit(0);
}
let known = new Set();
const baseline = option('--baseline');
if (baseline) {
  const old = JSON.parse(fs.readFileSync(path.resolve(root, baseline), 'utf8'));
  const movesArg = option('--moves');
  const moves = movesArg ? JSON.parse(fs.readFileSync(path.resolve(root, movesArg), 'utf8')) : {};
  const moved = (p) => moves[p] ?? p;
  known = new Set(old.errors.map((e) => JSON.stringify({ file: moved(e.file), target: moved(e.target) })));
}
const regressions = unique.filter((e) => !known.has(JSON.stringify(e)));
console.log(JSON.stringify({ mode: all ? 'all (includes history)' : 'current', checkedFiles: files.length,
  brokenLinks: unique.length, existing: unique.length - regressions.length, newErrors: regressions.length,
  structuralErrors: structural.length }, null, 2));
for (const e of unique) console.log(`${known.has(JSON.stringify(e)) ? 'EXISTING' : 'BROKEN'} ${e.file} -> ${e.target}`);
for (const e of structural) console.log(`STRUCTURE ${e}`);
// A baseline classifies failures; it never converts broken links into PASS.
process.exitCode = unique.length || structural.length ? 1 : 0;
