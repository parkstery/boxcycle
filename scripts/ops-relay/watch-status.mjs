#!/usr/bin/env node
/**
 * ops 릴레이 상황판 — 개발팀(커서)의 작업 상황을 한 화면으로 본다.
 *
 * Usage:
 *   node scripts/ops-relay/watch-status.mjs [ops-dir] [--interval 5] [--once]
 *
 * 보여주는 것:
 *   1) 지금 열려 있는 라운드(지시NN)와 수행결과 유무
 *   2) 개발팀장이 남긴 진행 로그(PROGRESS.md) 최근 줄
 *   3) 코드가 실제로 움직였는가 — git diff --stat -- apps/web/src
 *   4) 캡처 산출물(.out) 최근 파일
 *
 * 읽기 전용이다. 이 스크립트는 아무것도 고치지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const once = args.includes("--once");
const iIdx = args.indexOf("--interval");
const interval = iIdx >= 0 ? Math.max(1, Number(args[iIdx + 1]) || 5) : 5;
const opsDir = path.resolve(
  args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) ??
    "document/ops/20260923-first_ride",
);
const repoRoot = path.resolve(opsDir, "..", "..", "..");

const C = {
  dim: "\x1b[2m",
  b: "\x1b[1m",
  r: "\x1b[31m",
  g: "\x1b[32m",
  y: "\x1b[33m",
  c: "\x1b[36m",
  x: "\x1b[0m",
};

function sh(cmd) {
  try {
    return execSync(cmd, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return "";
  }
}

/**
 * 혼합 인코딩 방어 — 커서가 CP949(ANSI)로 덧붙이는 사고가 실제로 있었다.
 * 줄 단위로 UTF-8 을 먼저 시도하고, 실패하면 euc-kr 로 되읽는다.
 */
function readTextLoose(file) {
  const buf = fs.readFileSync(file);
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  let kr = null;
  try {
    kr = new TextDecoder("euc-kr");
  } catch {
    kr = null;
  }
  return buf
    .toString("binary")
    .split("\n")
    .map((_, i, arr) => {
      const start = arr.slice(0, i).reduce((a, s) => a + s.length + 1, 0);
      const line = buf.subarray(start, start + arr[i].length);
      try {
        return utf8.decode(line);
      } catch {
        return kr ? kr.decode(line) : arr[i];
      }
    })
    .map((l) => l.replace(/\r$/, ""));
}

function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분 전`;
}

const instrRe = /^(\d{8})-지시(\d+)-(.+)\.md$/;
const resultRe = /^(\d{8})-지시(\d+)수행결과(\d*)-(.+)\.md$/;

function scanRounds() {
  const files = fs.existsSync(opsDir)
    ? fs.readdirSync(opsDir).filter((f) => f.endsWith(".md"))
    : [];
  /** @type {Map<number, {instr: string|null, results: string[]}>} */
  const rounds = new Map();
  const slot = (n) => {
    if (!rounds.has(n)) rounds.set(n, { instr: null, results: [] });
    return rounds.get(n);
  };
  for (const f of files) {
    const im = f.match(instrRe);
    if (im) slot(Number(im[2])).instr = f;
    const rm = f.match(resultRe);
    if (rm) slot(Number(rm[2])).results.push(f);
  }
  return [...rounds.entries()].sort((a, b) => a[0] - b[0]);
}

function mtime(f) {
  try {
    return fs.statSync(path.join(opsDir, f)).mtimeMs;
  } catch {
    return 0;
  }
}

function latestOut(limit = 5) {
  const roots = [path.join(opsDir, ".out")];
  /** @type {{p: string, m: number}[]} */
  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 3 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else {
        try {
          found.push({ p, m: fs.statSync(p).mtimeMs });
        } catch {
          /* 삭제 경합 무시 */
        }
      }
    }
  };
  roots.forEach((r) => walk(r));
  return found.sort((a, b) => b.m - a.m).slice(0, limit);
}

function render() {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(
    `${C.b}${C.c}━━ ops 릴레이 상황판 ━━${C.x} ${C.dim}${path.basename(opsDir)} · ${new Date().toLocaleTimeString("ko-KR")}${C.x}`,
  );
  push();

  // 1) 라운드
  const rounds = scanRounds();
  if (!rounds.length) {
    push(`${C.y}지시 파일이 없다.${C.x}`);
  } else {
    push(`${C.b}1. 라운드${C.x}`);
    for (const [n, r] of rounds) {
      const has = r.results.length > 0;
      const mark = has ? `${C.g}●${C.x}` : `${C.y}○${C.x}`;
      const state = has
        ? `${C.g}수행결과 ${r.results.length}건${C.x}`
        : `${C.y}작업 중(수행결과 없음)${C.x}`;
      push(`  ${mark} 지시${String(n).padStart(2, "0")}  ${state}`);
      if (r.instr) push(`      ${C.dim}지시: ${r.instr}  (${ago(mtime(r.instr))})${C.x}`);
      for (const f of r.results.sort())
        push(`      ${C.dim}결과: ${f}  (${ago(mtime(f))})${C.x}`);
    }
    const open = rounds.filter(([, r]) => r.results.length === 0);
    push();
    push(
      open.length
        ? `  ${C.y}▶ 개발팀장이 지금 해야 할 일: 지시${String(open[0][0]).padStart(2, "0")}${C.x}`
        : `  ${C.g}▶ 열린 지시 없음 — 감리 판정 대기${C.x}`,
    );
  }
  push();

  // 2) 진행 로그
  push(`${C.b}2. 개발팀장 진행 로그${C.x} ${C.dim}(PROGRESS.md 최근 8줄)${C.x}`);
  const pf = path.join(opsDir, "PROGRESS.md");
  if (fs.existsSync(pf)) {
    const body = readTextLoose(pf).filter(
      (l) => l.trim() && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("<!--"),
    );
    const tail = body.slice(-8);
    if (tail.length) tail.forEach((l) => push(`  ${l}`));
    else push(`  ${C.dim}(아직 기록 없음)${C.x}`);
    push(`  ${C.dim}갱신 ${ago(fs.statSync(pf).mtimeMs)}${C.x}`);
  } else {
    push(`  ${C.dim}PROGRESS.md 없음${C.x}`);
  }
  push();

  // 3) 코드가 실제로 움직였는가
  push(`${C.b}3. 코드 변화${C.x} ${C.dim}(git — 0줄이면 화면은 바뀌지 않았다)${C.x}`);
  push(`  ${C.dim}브랜치${C.x} ${sh("git rev-parse --abbrev-ref HEAD") || "?"}`);
  const stat = sh("git diff --stat -- apps/web/src functions/src");
  if (stat) stat.split("\n").forEach((l) => push(`  ${l}`));
  else push(`  ${C.r}변경 0줄${C.x}`);
  const staged = sh("git diff --cached --stat -- apps/web/src functions/src");
  if (staged) push(`  ${C.dim}(staged)${C.x} ${staged.split("\n").pop()}`);
  // 신규 파일은 diff 에 잡히지 않는다 — 「0줄」 오판을 막는다
  const untracked = sh(
    "git ls-files --others --exclude-standard -- apps/web/src functions/src",
  );
  if (untracked) {
    const list = untracked.split("\n").filter(Boolean);
    push(`  ${C.g}신규 파일 ${list.length}개${C.x}`);
    list.slice(0, 6).forEach((f) => push(`    ${C.dim}+ ${f}${C.x}`));
  }
  push(`  ${C.dim}최근 커밋${C.x} ${sh("git log --oneline -1") || "?"}`);
  push();

  // 4) 캡처
  push(`${C.b}4. 캡처 산출물${C.x} ${C.dim}(.out 최근 5개)${C.x}`);
  const outs = latestOut();
  if (outs.length)
    outs.forEach((f) =>
      push(`  ${C.dim}${ago(f.m).padStart(8)}${C.x}  ${path.relative(opsDir, f.p)}`),
    );
  else push(`  ${C.dim}(없음)${C.x}`);
  push();
  push(
    `${C.dim}${interval}초마다 갱신 · Ctrl+C 로 종료 · 읽기 전용${C.x}`,
  );

  if (!once) process.stdout.write("\x1b[2J\x1b[H");
  console.log(lines.join("\n"));
}

render();
if (!once) setInterval(render, interval * 1000);
