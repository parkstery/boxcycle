#!/usr/bin/env node
/**
 * `apps/web/src` 안에서 파일을 옮기고 **상대 import 경로를 다시 계산**한다 (Phase 5-5/5-6).
 *
 * 왜 스크립트인가 (결정 D8) — 이번 이동의 위험은 정적 리팩터 도구와 LLM 이 **조용히**
 * 놓치는 자리에 몰려 있다. 동적 `import("../firebase")` 6건이 실제로 있고, 그것이 깨지면
 * 타입체크는 통과하고 **실행 시점에** 터진다(구조 감사 R2). 검산자가 `tsc` 로 완전한
 * 기계적 작업에 LLM 을 쓸 이유가 없다.
 *
 * 무엇을 하는가
 *   1. 이동 전에 모든 상대 specifier 를 **실제 파일로 해석**해 둔다(확장자 생략 포함)
 *   2. `git mv` 로 옮긴다(이력 보존)
 *   3. 각 파일의 **새 위치**에서 **새 대상 위치**까지 상대경로를 다시 계산해 써넣는다.
 *      원본이 확장자를 생략했으면 생략을, 붙였으면 붙인 채로 유지한다
 *      (`src/` 는 생략, `scripts/`·`e2e/` 는 `.ts` 를 붙이는 관례가 섞여 있다)
 *
 * 자가 검산(M0) — 이동 뒤 **모든 상대 specifier 가 실제 파일로 해석되는지** 전수 확인한다.
 * 하나라도 못 하면 즉시 실패한다. 「옮겼는데 아무것도 안 고쳐졌다」는 조용한 성공을 막는다.
 *
 * 사용법
 *   node scripts/move-lib-files.mjs <plan.json> [--dry-run]
 *   plan.json = { "lib/firebase.ts": "lib/firebase/app.ts", ... }  (apps/web/src 기준)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web").split(path.sep).join("/");
const SRC = `${WEB}/src`;
const WALK_ROOTS = ["src", "scripts", "e2e"];

const planPath = process.argv[2];
const DRY = process.argv.includes("--dry-run");
if (!planPath) {
  console.error("사용법: node scripts/move-lib-files.mjs <plan.json> [--dry-run]");
  process.exit(2);
}
/** @type {Record<string,string>} apps/web/src 기준 상대경로 */
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

// ── 파일 수집 ─────────────────────────────────────────────
function collect() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "tmp" || e.name === ".out") continue;
        walk(p);
      } else if (/\.(ts|tsx|mts|mjs)$/.test(e.name)) {
        out.push(p);
      }
    }
  };
  for (const r of WALK_ROOTS) {
    const d = `${WEB}/${r}`;
    if (fs.existsSync(d)) walk(d);
  }
  return out;
}

const SUFFIXES = ["", ".ts", ".tsx", ".mts", ".mjs", "/index.ts", "/index.tsx"];
/** specifier → { file, omitted } (omitted = specifier 가 생략한 꼬리) */
function resolveSpec(fromFile, spec, fileSet) {
  const base = path.posix.join(path.posix.dirname(fromFile), spec);
  for (const s of SUFFIXES) {
    if (fileSet.has(base + s)) return { file: base + s, omitted: s };
  }
  return null;
}

/*
 * `from "x"` · `import("x")` · `require("x")` 에 더해 **부수효과 `import "x"`** 를 본다.
 * 2026-09-25 P5-6 에서 `import "../../lib/map/disableMapboxTelemetry";` 한 줄을 놓쳐
 * 이동 뒤 경로가 깨졌다 — `from` 이 없는 형태였다.
 */
const SPEC_RE =
  /(from\s*|import\s*\(\s*|require\s*\(\s*|^\s*import\s*)(["'])(\.[^"']*)\2/gm;

/**
 * 수집 범위 **밖**이라도 디스크에 실제로 있으면 정상 경로다.
 * `apps/web/scripts/*` 는 `../../../../functions/src/...` 처럼 패키지를 넘어 import 한다 —
 * 이것을 「깨진 경로」로 세면 검산이 항상 실패해 결국 검산을 꺼 버리게 된다.
 */
function existsOnDisk(fromFile, spec) {
  const base = path.posix.join(path.posix.dirname(fromFile), spec);
  return SUFFIXES.some((s) => fs.existsSync(base + s));
}

// ── 1. 이동 전 해석 ───────────────────────────────────────
const before = collect();
const beforeSet = new Set(before);

/** 이동 계획을 절대경로 맵으로 */
const moveMap = new Map();
for (const [from, to] of Object.entries(plan)) {
  const a = `${SRC}/${from}`;
  const b = `${SRC}/${to}`;
  if (!beforeSet.has(a)) {
    console.error(`[실패] 이동 대상이 없다: ${from}`);
    process.exit(1);
  }
  if (beforeSet.has(b)) {
    console.error(`[실패] 목적지가 이미 있다: ${to}`);
    process.exit(1);
  }
  moveMap.set(a, b);
}
const newPathOf = (f) => moveMap.get(f) ?? f;

/** file → [{ raw, spec, target, omitted }] */
const specsByFile = new Map();
let totalSpecs = 0;
for (const f of before) {
  const src = fs.readFileSync(f, "utf8");
  const list = [];
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[3];
    const hit = resolveSpec(f, spec, beforeSet);
    if (!hit) {
      // 수집 범위 밖(패키지를 넘는 경로)이나 비대상 확장자는 이동 대상일 수 없다.
      if (!/\.(json|css|svg|png|glb)$/.test(spec) && !existsOnDisk(f, spec)) {
        console.error(`[경고] 해석 불가 specifier: ${f} → ${spec}`);
      }
      continue;
    }
    list.push({ spec, target: hit.file, omitted: hit.omitted });
    totalSpecs += 1;
  }
  specsByFile.set(f, list);
}
console.log(`파일 ${before.length}개 · 상대 specifier ${totalSpecs}개 해석`);

// ── 2. 새 specifier 계산 ─────────────────────────────────
/** newFile → [{ from, to }] 치환 목록 */
const edits = new Map();
let changed = 0;
for (const [f, list] of specsByFile) {
  const newF = newPathOf(f);
  const out = [];
  for (const { spec, target, omitted } of list) {
    const newTarget = newPathOf(target);
    if (newF === f && newTarget === target) continue; // 양쪽 다 그대로
    let rel = path.posix.relative(path.posix.dirname(newF), newTarget);
    /*
     * 생략된 꼬리를 되돌린다. `/index.ts` 처럼 **경로 구분자를 포함한** 꼬리는 단순
     * 길이 빼기로 자르면 안 된다 — `index.ts`(8자)에서 `/index.ts`(9자)를 빼
     * `index.t` 라는 깨진 경로가 나왔다(2026-09-25 P5-6 에서 실제로 났다).
     */
    if (omitted && rel.endsWith(omitted)) {
      rel = rel.slice(0, rel.length - omitted.length);
    } else if (omitted.startsWith("/") && rel.endsWith(omitted.slice(1))) {
      rel = rel.slice(0, rel.length - omitted.slice(1).length).replace(/\/$/, "");
    }
    if (rel === "") rel = ".";
    if (!rel.startsWith(".")) rel = `./${rel}`;
    if (rel === spec) continue;
    // 같은 specifier 가 한 파일에 두 번 나오면(별도 import 문) 첫 치환이 /g 로 둘 다
    // 바꾼다. 중복을 남기면 두 번째 시도가 「치환 못 함」으로 오판해 중간에 멈춘다.
    if (out.some((e) => e.from === spec)) continue;
    out.push({ from: spec, to: rel });
    changed += 1;
  }
  if (out.length > 0) edits.set(newF, out);
}
console.log(`고쳐야 할 specifier ${changed}개 · 파일 ${edits.size}개`);

if (DRY) {
  for (const [f, list] of edits) {
    console.log(`\n${f.slice(WEB.length + 1)}`);
    for (const e of list) console.log(`  ${e.from}  →  ${e.to}`);
  }
  console.log("\n(dry-run — 아무것도 바꾸지 않았다)");
  process.exit(0);
}

// ── 3. git mv ────────────────────────────────────────────
let sidecars = 0;
for (const [a, b] of moveMap) {
  fs.mkdirSync(path.dirname(b), { recursive: true });
  execFileSync("git", ["mv", a, b], { cwd: ROOT, stdio: "pipe" });
  /*
   * `.mjs` 의 짝인 `.d.mts` 선언 파일을 함께 옮긴다.
   *
   * 수집(`collect`)에서 `.d.mts` 를 제외하기 때문에 계획에 잡히지 않는다. 2026-09-25
   * P5-6 에서 셋이 원래 자리에 남아, 옮겨진 `.mjs` 가 **타입을 잃고 암묵적 any** 가 됐다
   * (`tsc` 가 잡았지만 자동이어야 한다).
   */
  const dts = a.replace(/\.mjs$/, ".d.mts");
  if (a.endsWith(".mjs") && fs.existsSync(dts)) {
    execFileSync("git", ["mv", dts, b.replace(/\.mjs$/, ".d.mts")], { cwd: ROOT, stdio: "pipe" });
    sidecars += 1;
  }
}
console.log(`git mv ${moveMap.size}개 완료${sidecars > 0 ? ` (+ .d.mts ${sidecars}개 동반)` : ""}`);

// ── 4. specifier 치환 ────────────────────────────────────
for (const [f, list] of edits) {
  let src = fs.readFileSync(f, "utf8");
  for (const { from, to } of list) {
    // specifier 는 따옴표 안에서만 바꾼다 — 주석·문자열 본문을 건드리지 않기 위해
    // 원래 매칭한 형태(from/import(/require( + 따옴표)를 그대로 재사용한다.
    const re = new RegExp(
      `(from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)(["'])${from.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      )}\\2`,
      "g",
    );
    const next = src.replace(re, (_all, kw, q) => `${kw}${q}${to}${q}`);
    if (next === src) {
      console.error(`[실패] 치환 못 함: ${f} → ${from}`);
      process.exit(1);
    }
    src = next;
  }
  fs.writeFileSync(f, src);
}
console.log(`specifier 치환 ${changed}개 완료`);

// ── 5. M0 자가 검산 — 모든 상대 specifier 가 해석되는가 ──
const after = collect();
const afterSet = new Set(after);
let dangling = 0;
let verified = 0;
for (const f of after) {
  const src = fs.readFileSync(f, "utf8");
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(src))) {
    const spec = m[3];
    if (/\.(json|css|svg|png|glb)$/.test(spec)) continue;
    if (resolveSpec(f, spec, afterSet) || existsOnDisk(f, spec)) {
      verified += 1;
    } else {
      dangling += 1;
      console.error(`[깨진 경로] ${f.slice(WEB.length + 1)} → ${spec}`);
    }
  }
}
/**
 * import 가 아닌 **문자열 경로** 참조.
 *
 * 왜 따로 보는가 — 계약 시험 몇 개가 소스를 `readFileSync("lib/route/repo/firestoreCourses.ts")` 처럼
 * **경로 문자열로** 읽는다. 이동하면 `tsc` 는 통과하고 **시험만 ENOENT 로 죽는다.**
 * 2026-09-25 배치 B 에서 실제로 그랬다(`route-list-sort-contract`).
 * 경로를 어떻게 조립했는지는 파일마다 달라 자동 치환이 위험하므로, **목록만 내고 멈춘다.**
 */
const stringRefs = [];
for (const [a] of moveMap) {
  const oldBase = path.posix.basename(a);
  for (const f of after) {
    const src = fs.readFileSync(f, "utf8");
    // 따옴표 안에 옛 파일명이 남아 있고, 그 줄이 import specifier 가 아닌 경우.
    // 확장자 없는 줄기도 본다 — 시험이 소스 텍스트를 정규식으로 단언할 때는
    // `lib\/conquestLayerEmphasis` 처럼 이스케이프된 형태로 나타난다(2026-09-25 P5-6).
    const oldStem = oldBase.replace(/\.[^.]+$/, "");
    for (const line of src.split("\n")) {
      if (!line.includes(oldBase) && !line.includes(oldStem)) continue;
      if (/(from|import\s*\(|require\s*\()\s*["']/.test(line)) continue;
      if (!/["'`]/.test(line)) continue;
      stringRefs.push(`${f.slice(WEB.length + 1)}: ${line.trim()}`);
    }
  }
}
if (stringRefs.length > 0) {
  console.error(`\n[확인 필요] 문자열 경로로 옛 파일명을 가리키는 곳 ${stringRefs.length}건:`);
  for (const r of stringRefs) console.error("  " + r);
  console.error("  → 손으로 고쳐라. 여기는 tsc 가 잡지 못하고 시험만 ENOENT 로 죽는다.");
}

console.log(`\n=== M0 자가 검산 ===`);
console.log(`  ${after.length === before.length ? "PASS" : "FAIL"}  파일 수 보존 (${before.length} → ${after.length})`);
console.log(`  ${verified > 100 ? "PASS" : "FAIL"}  해석된 specifier ${verified}개 (수집 실패 시 0 이 되어 거짓 통과한다)`);
console.log(`  ${dangling === 0 ? "PASS" : "FAIL"}  깨진 경로 ${dangling}개`);
if (dangling > 0 || after.length !== before.length || verified <= 100 || stringRefs.length > 0) {
  console.error("\n[실패] 검산 불통 — `git status` 로 확인하고 되돌려라.");
  process.exit(1);
}
console.log("\n다음: tsc · lint · 계약 시험 · check-dep-direction 으로 확인하라.");
