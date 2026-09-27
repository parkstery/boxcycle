#!/usr/bin/env node
/**
 * 옮겨진 파일을 가리키는 **깨진 상대 import 경로**를 고친다 (Phase 5 이동 보조).
 *
 * 왜 따로 있는가 — `move-lib-files.mjs` 가 이동 도중 멈추면(2026-09-25 에 실제로 그랬다:
 * 같은 specifier 가 한 파일에 두 번 나올 때 두 번째 치환을 「실패」로 오판) 파일은 옮겨졌고
 * 경로만 낡은 상태가 남는다. **되돌리기보다 앞으로 고치는 것이 안전하다** — `git mv` 로
 * 이력은 이미 보존됐고, 되돌리려면 작업분을 파괴해야 한다.
 *
 * 어떻게 — 해석되지 않는 상대 specifier 마다 **파일명(basename)** 으로 후보를 찾는다.
 *   후보 1개 → 그 경로로 다시 계산해 쓴다
 *   후보 0개 또는 2개 이상 → **고치지 않고 멈춘다.** 「그럴듯한 것」을 고르면 조용히
 *   엉뚱한 모듈을 가리키게 되고, 타입이 같으면 tsc 도 통과한다
 *
 * 사용법: node scripts/repair-lib-imports.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web").split(path.sep).join("/");
const WALK_ROOTS = ["src", "scripts", "e2e"];
const DRY = process.argv.includes("--dry-run");

const files = [];
(function () {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "tmp" || e.name === ".out") continue;
        walk(p);
      } else if (/\.(ts|tsx|mts|mjs)$/.test(e.name)) files.push(p);
    }
  };
  for (const r of WALK_ROOTS) {
    const d = `${WEB}/${r}`;
    if (fs.existsSync(d)) walk(d);
  }
})();
const fileSet = new Set(files);

const SUFFIXES = ["", ".ts", ".tsx", ".mts", ".mjs", "/index.ts", "/index.tsx"];
const resolves = (from, spec) => {
  const base = path.posix.join(path.posix.dirname(from), spec);
  return SUFFIXES.some((s) => fileSet.has(base + s) || fs.existsSync(base + s));
};

/** basename(확장자 없음) → 후보 절대경로 목록 */
const byBase = new Map();
for (const f of files) {
  const b = path.posix.basename(f).replace(/\.(ts|tsx|mts|mjs)$/, "");
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}

const SPEC_RE = /(from\s*|import\s*\(\s*|require\s*\(\s*)(["'])(\.[^"']*)\2/g;

let fixed = 0;
const ambiguous = [];
const missing = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const seen = new Set();
  const edits = [];
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[3];
    if (seen.has(spec)) continue;
    seen.add(spec);
    if (/\.(json|css|svg|png|glb)$/.test(spec)) continue;
    if (resolves(f, spec)) continue;

    const wantExt = /\.(ts|tsx|mts|mjs)$/.exec(spec)?.[0] ?? "";
    const base = path.posix.basename(spec).replace(/\.(ts|tsx|mts|mjs)$/, "");
    const cands = byBase.get(base) ?? [];
    if (cands.length === 0) {
      missing.push(`${f.slice(WEB.length + 1)} → ${spec}`);
      continue;
    }
    if (cands.length > 1) {
      ambiguous.push(
        `${f.slice(WEB.length + 1)} → ${spec}  후보: ${cands
          .map((c) => c.slice(WEB.length + 1))
          .join(", ")}`,
      );
      continue;
    }
    let rel = path.posix.relative(path.posix.dirname(f), cands[0]);
    if (!wantExt) rel = rel.replace(/\.(ts|tsx|mts|mjs)$/, "");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    edits.push({ from: spec, to: rel });
  }
  if (edits.length === 0) continue;
  let next = src;
  for (const { from, to } of edits) {
    const re = new RegExp(
      `(from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)(["'])${from.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )}\\2`,
      "g",
    );
    next = next.replace(re, (_a, kw, q) => `${kw}${q}${to}${q}`);
    fixed += 1;
    if (DRY) console.log(`  ${f.slice(WEB.length + 1)}: ${from} → ${to}`);
  }
  if (!DRY) fs.writeFileSync(f, next);
}

console.log(`\n고친 specifier ${fixed}개${DRY ? " (dry-run)" : ""}`);
if (ambiguous.length > 0) {
  console.error(`\n[멈춤] 후보가 여럿이라 고르지 않았다 ${ambiguous.length}건:`);
  for (const a of ambiguous) console.error("  " + a);
}
if (missing.length > 0) {
  console.error(`\n[멈춤] 후보가 없다 ${missing.length}건:`);
  for (const a of missing) console.error("  " + a);
}
if (ambiguous.length > 0 || missing.length > 0) process.exit(1);

// 자가 검산 — 남은 깨진 경로가 0 인가
let dangling = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[3];
    if (/\.(json|css|svg|png|glb)$/.test(spec)) continue;
    if (!resolves(f, spec)) {
      dangling += 1;
      console.error(`[남은 깨진 경로] ${f.slice(WEB.length + 1)} → ${spec}`);
    }
  }
}
console.log(`${dangling === 0 ? "PASS" : "FAIL"}  남은 깨진 경로 ${dangling}개`);
process.exit(dangling === 0 ? 0 : 1);
