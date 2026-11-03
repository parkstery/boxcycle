#!/usr/bin/env node
/**
 * 데이터베이스 접근 통로 게이트 — 「DB 를 여는 곳은 한 곳」을 지킨다.
 *
 * 왜 — document/ops/20261103-global-geo-data/00-plan.md §5.1 P5.
 * 해외 사용자가 늘면 Firestore·RTDB 를 지역별로 늘릴 수 있다(같은 프로젝트의 추가 DB·인스턴스).
 * 그때 「이 데이터는 어느 DB」를 **한 곳에서** 바꿀 수 있어야 한다. 화면·훅이 SDK 를 직접 열기
 * 시작하면 그 결정이 수십 곳에 흩어지고, 한 곳만 빠뜨려도 에러 없이 다른 DB 를 본다.
 *
 * 규칙
 *   apps/web/src   — getFirestore( · initializeFirestore( · getDatabase(  →  lib/firebase/app.ts 만
 *   functions/src  — getDatabase( · getDatabaseWithUrl(                   →  rtdbInstances.ts 만
 *   (서버 Firestore 는 admin `getFirestore()` 를 곳곳에서 쓴다. 지역 DB 를 더할 때는
 *    `getFirestore(app, databaseId)` 처럼 명시적으로 열게 되므로 이 게이트 대상이 아니다.)
 *
 * M0(자가 검산) — 허용 파일이 **실제로 그 호출을 담고 있어야** 한다. 파일을 옮기거나 이름을 바꾸면
 * 게이트가 「위반 0」으로 조용히 죽는다(옮긴 코드는 계약을 무장해제한다). 그때는 실패시킨다.
 *
 * 사용법: node scripts/check-firebase-accessors.mjs --check
 * 생존 확인: scripts/verify-gates-alive.mjs 「DB 접근 통로」 항목
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RULES = [
  {
    name: "web Firestore·RTDB",
    dir: "apps/web/src",
    calls: ["getFirestore", "initializeFirestore", "getDatabase"],
    allowed: "apps/web/src/lib/firebase/app.ts",
    mustContain: ["getFirestore", "getDatabase"],
  },
  {
    name: "functions RTDB",
    dir: "functions/src",
    calls: ["getDatabase", "getDatabaseWithUrl"],
    allowed: "functions/src/rtdbInstances.ts",
    mustContain: ["getDatabase", "getDatabaseWithUrl"],
  },
];

function listSources(dir) {
  const out = [];
  const walk = (abs) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = path.join(abs, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|cts)$/.test(e.name)) out.push(p);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

/** 주석을 지운다(문자열 안의 // 는 드물어 무시한다 — 오탐은 실패 쪽으로 난다). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");

let failed = false;
for (const rule of RULES) {
  const re = new RegExp(`\\b(${rule.calls.join("|")})\\s*\\(`, "g");
  const violations = [];
  for (const file of listSources(rule.dir)) {
    const r = rel(file);
    if (r === rule.allowed) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    const lines = code.split("\n");
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) violations.push(`${r}:${i + 1}  ${m[1]}(`);
    });
  }
  const allowedAbs = path.join(ROOT, rule.allowed);
  const missing = [];
  if (!fs.existsSync(allowedAbs)) missing.push("(파일 없음)");
  else {
    const code = stripComments(fs.readFileSync(allowedAbs, "utf8"));
    for (const c of rule.mustContain) if (!new RegExp(`\\b${c}\\s*\\(`).test(code)) missing.push(`${c}(`);
  }
  if (missing.length) {
    failed = true;
    console.error(`[DB 접근 통로] ${rule.name}: 허용 파일 ${rule.allowed} 에 ${missing.join(", ")} 가 없다 — 통로가 옮겨졌으면 이 게이트의 allowed 도 함께 옮겨라(M0).`);
  }
  if (violations.length) {
    failed = true;
    console.error(`[DB 접근 통로] ${rule.name}: ${rule.allowed} 밖에서 DB 를 직접 연다 ${violations.length}건`);
    for (const v of violations) console.error(`  ${v}`);
  } else if (!missing.length) {
    console.log(`[DB 접근 통로] ${rule.name}: 위반 0 (통로 ${rule.allowed})`);
  }
}
process.exit(failed ? 1 : 0);
