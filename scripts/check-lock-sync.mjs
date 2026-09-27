#!/usr/bin/env node
/**
 * package.json 과 package-lock.json 이 어긋났는지 본다.
 *
 * 왜 있는가 — 2026-09-25 배포가 여기서 깨졌다. `functions/package.json` 에 eslint
 * 의존 4개를 넣고 **lock 을 갱신하지 않은 채** 푸시했는데, 로컬은 루트에 hoist 된
 * 패키지로 돌아가 아무 증상이 없었다. Cloud Build 의 `npm ci` 만 lock 을 엄격히 보고
 * 거부했고, **함수 28개 배포가 통째로 실패**했다.
 *
 * `npm ci --dry-run` 은 확실하지만 느리다. 여기서는 선언된 의존 이름이 lock 에
 * 들어 있는지만 즉시 대조한다 — 오늘 실제로 난 사고를 잡기에는 그것으로 충분하다.
 *
 * functions 는 워크스페이스가 아니라 **자기 lock 을 따로 가진다** — 루트에서
 * `npm install` 을 아무리 돌려도 갱신되지 않는다는 점이 이 사고의 뿌리였다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** [package.json, 그 패키지를 관장하는 lock] 쌍. 워크스페이스는 루트 lock 이 관장한다. */
const PAIRS = [
  { pkg: "package.json", lock: "package-lock.json", label: "루트" },
  { pkg: "apps/web/package.json", lock: "package-lock.json", label: "apps/web (워크스페이스 → 루트 lock)" },
  { pkg: "functions/package.json", lock: "functions/package-lock.json", label: "functions (독립 lock)" },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** lock 안에서 이 이름의 패키지가 하나라도 설치 계획에 있는지. */
function lockHas(lock, name) {
  if (lock.packages) {
    for (const key of Object.keys(lock.packages)) {
      if (key === `node_modules/${name}`) return true;
      if (key.endsWith(`/node_modules/${name}`)) return true;
    }
  }
  if (lock.dependencies && lock.dependencies[name]) return true;
  return false;
}

let failed = false;
const checked = [];

for (const { pkg, lock, label } of PAIRS) {
  if (!fs.existsSync(path.join(ROOT, pkg)) || !fs.existsSync(path.join(ROOT, lock))) continue;
  const p = readJson(pkg);
  const l = readJson(lock);
  const declared = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) };
  const names = Object.keys(declared);
  checked.push({ label, count: names.length });

  const missing = names.filter((n) => !lockHas(l, n));
  if (missing.length > 0) {
    failed = true;
    console.error(`\n[lock 불일치] ${label}`);
    console.error(`  ${pkg} 가 선언했지만 ${lock} 에 없는 의존:`);
    for (const m of missing) console.error(`    - ${m}@${declared[m]}`);
    const dir = path.dirname(pkg) === "." ? "저장소 루트" : path.dirname(pkg);
    console.error(`  → ${dir} 에서 \`npm install\` 을 돌려 lock 을 갱신하고 함께 커밋하라.`);
  }
}

// M0 — 세는 일 자체가 작동하는지. 대조한 의존이 하나도 없으면 통과가 공허하다.
const total = checked.reduce((n, c) => n + c.count, 0);
if (total === 0) {
  console.error("[lock 검사] 대조한 의존이 0건이다 — 검사가 고장났다.");
  process.exit(1);
}

if (failed) {
  console.error("\nlock 이 어긋난 채 배포되면 Cloud Build 의 `npm ci` 가 거부한다(2026-09-25 실제 사고).");
  process.exit(1);
}

console.log(`[lock 검사] 통과 — ${checked.map((c) => `${c.label} ${c.count}개`).join(" · ")}`);
