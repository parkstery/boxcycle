#!/usr/bin/env node
// 수퍼바이저 인수 점검 (읽기 전용). 파일·git 을 바꾸지 않는다.
//   node scripts/handoff-check.mjs            요약 출력
//   node scripts/handoff-check.mjs --check    HANDOFF 크기 초과·낡음이면 exit 1
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handoffPath = path.join(root, 'document/ops/HANDOFF.md');
const MAX_BYTES = 12 * 1024; // 목표 8KB, 12KB 초과는 경고
const STALE_MIN = 30; // 마지막 변경이 HANDOFF 보다 이만큼 새로우면 낡은 것으로 본다
const check = process.argv.includes('--check');

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 90000, maxBuffer: 16 * 1024 * 1024 }).trimEnd();
  } catch (e) {
    return `(git ${args[0]} 실패: ${String(e.message).split('\n')[0]})`;
  }
};
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' KST';
const warns = [];

// 1. HANDOFF 자체
const stat = fs.statSync(handoffPath);
const text = fs.readFileSync(handoffPath, 'utf8');
const lines = text.split('\n').length;
console.log('== HANDOFF ==');
console.log(`크기 ${(stat.size / 1024).toFixed(1)}KB · ${lines}줄 · 마지막 수정 ${kst(stat.mtimeMs)}`);
const owner = text.split('\n').find((l) => /^\|\s*담당\s*\|/.test(l));
console.log(owner ? owner.slice(0, 200) : '담당 줄 없음');
if (stat.size > MAX_BYTES) warns.push(`HANDOFF ${(stat.size / 1024).toFixed(0)}KB — 12KB 초과. 날짜별 로그는 PROGRESS/archive 로 옮긴다.`);
if (!owner) warns.push('「담당」 표 줄이 없다. 인수하면 먼저 자기 이름과 시각을 적는다.');

// 2. git 상태
console.log('\n== git ==');
console.log(`브랜치 ${git('rev-parse', '--abbrev-ref', 'HEAD')} · HEAD ${git('log', '-1', '--format=%h %cd %s', '--date=format:%m-%d %H:%M')}`);
const ab = git('rev-list', '--left-right', '--count', 'HEAD...@{upstream}');
if (/^\d+\s+\d+$/.test(ab)) { const [a, b] = ab.split(/\s+/); console.log(`원격 대비 앞 ${a} / 뒤 ${b}`); }
const porcelain = git('status', '--porcelain=v1', '--untracked-files=normal').split('\n').filter(Boolean);
const files = porcelain.map((l) => ({ st: l.slice(0, 2), p: l.slice(3).replace(/^"|"$/g, '') }));
console.log(`변경 ${files.length}개 (수정 ${files.filter((f) => f.st.trim() === 'M').length} · 새 파일 ${files.filter((f) => f.st === '??').length})`);
const groups = {};
for (const f of files) { const k = f.p.split('/').slice(0, 3).join('/'); groups[k] = (groups[k] ?? 0) + 1; }
Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

// 3. 가장 최근에 바뀐 파일 vs HANDOFF
const timed = files
  .map((f) => { try { return { ...f, t: fs.statSync(path.join(root, f.p)).mtimeMs }; } catch { return null; } })
  .filter((f) => f && !f.p.endsWith('HANDOFF.md') && !f.p.startsWith('.out/'))
  .sort((a, b) => b.t - a.t);
console.log('\n== 최근 변경 파일 5개 ==');
timed.slice(0, 5).forEach((f) => console.log(`${kst(f.t)}  ${f.p}`));
const lastCommit = Number(git('log', '-1', '--format=%ct')) * 1000;
const newest = Math.max(timed[0]?.t ?? 0, Number.isFinite(lastCommit) ? lastCommit : 0);
if (newest - stat.mtimeMs > STALE_MIN * 60e3) {
  warns.push(`HANDOFF(${kst(stat.mtimeMs)})가 마지막 변경(${kst(newest)})보다 ${Math.round((newest - stat.mtimeMs) / 60e3)}분 오래됐다. ` +
    '직전 담당이 끊기기 전 작업일 수 있다 — 위 변경 파일의 묶음 README·최신 결과 파일과 git diff 로 상태를 재구성하고, 모르는 변경은 되돌리지 않는다.');
}

// 4. 묶음별 최신 결과 파일
const opsDir = path.join(root, 'document/ops');
const results = [];
for (const d of fs.readdirSync(opsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  for (const f of fs.readdirSync(path.join(opsDir, d.name))) {
    if (!f.endsWith('.md')) continue;
    try { results.push({ p: `document/ops/${d.name}/${f}`, t: fs.statSync(path.join(opsDir, d.name, f)).mtimeMs }); } catch { /* skip */ }
  }
}
results.sort((a, b) => b.t - a.t);
console.log('\n== 최신 결과·지시 파일 5개 ==');
results.slice(0, 5).forEach((f) => console.log(`${kst(f.t)}  ${f.p}`));

// 5. 「진행 중」 구역 (체크포인트)
const m = text.match(/^## 진행 중[^\n]*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
console.log('\n== HANDOFF 「진행 중」 ==');
console.log(m ? m[1].trim().slice(0, 800) || '(비어 있음)' : '(구역 없음)');

console.log('\n== 판정 ==');
if (warns.length === 0) console.log('OK — HANDOFF 크기·최신성 이상 없음');
else warns.forEach((w) => console.log(`WARN ${w}`));
if (check && warns.length) process.exit(1);
