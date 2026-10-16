#!/usr/bin/env node
/**
 * 개발 부산물 등록부 게이트 (2026-10-17).
 *
 * 선언은 `apps/web/dev-tools.json` 한 곳이다. pre-push 가 `--check` 로 돌린다.
 *
 * 실패 조건 — document/ops/20261017-dev-byproducts/02-rules.md §5
 *   1. src/lib/debug/ 파일이 등록부에 없다
 *   2. src 의 쿼리 키(.get("키"), *_QUERY_KEY(S) 상수)가 등록부에 없다
 *   3. apps/web/scripts/ · 루트 scripts/ 의 시험이 아닌 파일이 아무 데도 불리지 않고 등록부에도 없다
 *   4. git 이 /.out/ 아래 파일을 추적한다
 *   5. 등록부 항목의 파일·키가 더 이상 없다
 *   6. temporary 가 만료 후 30일을 넘겼다. 만료~30일은 경고만
 *
 * "불린다" — 저장소 상대 경로, 또는 파일 이름(확장자 포함·제외)이 토큰으로
 * apps/web/package.json, 루트 package.json, githooks/, .claude/, .cursor/,
 * apps/web/src, apps/web/scripts, apps/web/e2e, 루트 scripts/ 의 다른 파일에 나타난다.
 * document/ 언급은 불린 것이 아니다. .out · node_modules · dist 는 검색하지 않는다.
 * 이름 토큰은 앞뒤가 식별자 문자가 아닐 때다. 짧은 이름이 더 긴 이름에 묻히지 않게.
 *
 * .out 안 파일은 3번 목록에서 뺀다. 거기는 지워도 되는 산출물이고, 추적되면 4번이 막는다.
 *
 *   node scripts/check-dev-tools.mjs --check
 *   node scripts/check-dev-tools.mjs --list
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_REL = "apps/web/dev-tools.json";
const FIX = "dev-tools.json 에 등록하거나 지운다";

const SKIP_DIR = new Set(["node_modules", "dist", ".out", ".git", "coverage", ".firebase"]);
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".glb", ".gltf",
  ".pdf", ".zip", ".woff", ".woff2", ".mp3", ".mp4", ".bin", ".lock", ".map",
]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"]);
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mts|js|mjs|cjs)$/;
const MAX_TEXT_BYTES = 1_000_000;

const SEARCH_FILES = ["package.json", "apps/web/package.json"];
const SEARCH_DIRS = [
  "githooks",
  ".claude",
  ".cursor",
  "apps/web/src",
  "apps/web/scripts",
  "apps/web/e2e",
  "scripts",
];

export function extractQueryKeys(source) {
  const keys = new Set();
  const getRe = /\.get\(\s*["']([A-Za-z_][\w-]*)["']\s*\)/g;
  for (const match of source.matchAll(getRe)) keys.add(match[1]);
  const constRe = /\b([A-Za-z0-9_]*QUERY_KEY[A-Za-z0-9_]*)\s*(?::[^=\n]+)?=\s*(\[[\s\S]*?\]|["'][^"']+["'])/g;
  for (const match of source.matchAll(constRe)) {
    const body = match[2];
    if (body.startsWith("[") ) {
      for (const part of body.matchAll(/["']([^"']+)["']/g)) keys.add(part[1]);
    } else {
      keys.add(body.slice(1, -1));
    }
  }
  return [...keys].sort();
}

function isTestFile(rel) {
  return TEST_FILE.test(rel);
}

function isScriptInventoryPath(rel) {
  if (rel.split("/").includes(".out")) return false;
  return rel.startsWith("apps/web/scripts/") || rel.startsWith("scripts/");
}

function normRel(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function localCalendarDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysAfter(now, iso) {
  const expires = calendarDay(iso);
  if (expires == null) return null;
  return Math.round((localCalendarDay(now) - expires) / 86_400_000);
}

function identChar(ch) {
  return ch != null && ch !== "" && /[A-Za-z0-9_-]/.test(ch);
}

function tokenAppears(text, token) {
  if (!token) return false;
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(token, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + token.length] ?? "";
    if (!identChar(before) && !identChar(after)) return true;
    from = at + 1;
  }
  return false;
}

function fileMentionsScript(text, scriptRel) {
  if (text.includes(scriptRel)) return true;
  if (scriptRel.startsWith("apps/web/")) {
    const fromWeb = scriptRel.slice("apps/web/".length);
    if (fromWeb !== scriptRel && text.includes(fromWeb)) return true;
  }
  const base = scriptRel.slice(scriptRel.lastIndexOf("/") + 1);
  const stem = base.replace(/\.[^.]+$/, "");
  if (tokenAppears(text, base)) return true;
  if (stem !== base && tokenAppears(text, stem)) return true;
  return false;
}

function walk(root, relDir, out) {
  const abs = path.join(root, relDir);
  if (!fs.existsSync(abs)) return;
  let entries;
  try {
    entries = fs.readdirSync(abs);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const rel = relDir ? `${relDir}/${name}` : name;
    const absChild = path.join(abs, name);
    let st;
    try {
      st = fs.statSync(absChild);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(root, rel, out);
    else out.push({ rel: normRel(rel), abs: absChild, size: st.size });
  }
}

function readText(file) {
  const ext = path.posix.extname(file.rel).toLowerCase();
  if (SKIP_EXT.has(ext)) return null;
  if (file.size > MAX_TEXT_BYTES) return null;
  try {
    return fs.readFileSync(file.abs, "utf8");
  } catch {
    return null;
  }
}

function gitTrackedOut(root) {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out.split("\0").filter((rel) => rel && /(?:^|\/)\.out\//.test(normRel(rel)));
}

export function collectWorld(root = ROOT) {
  const files = [];
  for (const rel of SEARCH_FILES) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    if (st.isFile()) files.push({ rel: normRel(rel), abs, size: st.size });
  }
  for (const dir of SEARCH_DIRS) walk(root, dir, files);

  const blobs = [];
  for (const file of files) {
    const text = readText(file);
    if (text != null) blobs.push({ rel: file.rel, text });
  }

  const debugFiles = files
    .map((file) => file.rel)
    .filter((rel) => rel.startsWith("apps/web/src/lib/debug/") && !rel.slice("apps/web/src/lib/debug/".length).includes("/") && !isTestFile(rel))
    .sort();

  const queryKeys = new Set();
  for (const blob of blobs) {
    if (!blob.rel.startsWith("apps/web/src/")) continue;
    if (!SOURCE_EXT.has(path.posix.extname(blob.rel))) continue;
    if (isTestFile(blob.rel)) continue;
    for (const key of extractQueryKeys(blob.text)) queryKeys.add(key);
  }

  const scripts = files
    .map((file) => file.rel)
    .filter((rel) => isScriptInventoryPath(rel) && !isTestFile(rel))
    .sort();

  const calledScripts = [];
  for (const script of scripts) {
    const called = blobs.some((blob) => blob.rel !== script && fileMentionsScript(blob.text, script));
    if (called) calledScripts.push(script);
  }

  return {
    debugFiles,
    queryKeys: [...queryKeys].sort(),
    scripts,
    calledScripts,
    gitTrackedOut: gitTrackedOut(root).sort(),
  };
}

function registeredRefs(registry) {
  const modules = new Set();
  const queries = new Set();
  const scripts = new Set();
  for (const entry of registry.tools ?? []) {
    if (entry.kind === "module" && entry.path) modules.add(normRel(entry.path));
    if (entry.kind === "query" && entry.key) queries.add(String(entry.key));
    if (entry.kind === "script" && entry.path) scripts.add(normRel(entry.path));
  }
  return { modules, queries, scripts };
}

/**
 * @param {object} world collectWorld() 결과 또는 합성 입력
 * @param {{ tools?: object[] }} registry
 * @param {Date} [now]
 */
export function evaluateDevTools(world, registry, now = new Date()) {
  const failures = [];
  const warnings = [];
  const tools = Array.isArray(registry?.tools) ? registry.tools : [];
  const refs = registeredRefs({ tools });
  const debug = new Set(world.debugFiles ?? []);
  const queries = new Set(world.queryKeys ?? []);
  const scripts = new Set(world.scripts ?? []);
  const called = new Set(world.calledScripts ?? []);

  for (const file of debug) {
    if (!refs.modules.has(file)) failures.push(`FAIL debug 미등록 ${file} — ${FIX}`);
  }
  for (const key of queries) {
    if (!refs.queries.has(key)) failures.push(`FAIL query 미등록 ${key} — ${FIX}`);
  }
  for (const file of scripts) {
    if (called.has(file)) continue;
    if (!refs.scripts.has(file)) failures.push(`FAIL script 미등록(아무도 부르지 않음) ${file} — ${FIX}`);
  }
  for (const file of world.gitTrackedOut ?? []) {
    failures.push(`FAIL git 이 .out 을 추적 ${normRel(file)} — 추적 해제. ${FIX}`);
  }

  for (const entry of tools) {
    const id = entry.id ?? "(id 없음)";
    if (entry.kind === "module") {
      const file = normRel(entry.path);
      if (!file || !debug.has(file)) failures.push(`FAIL 등록부 낡음 module ${id} ${file || "(path 없음)"} — ${FIX}`);
    } else if (entry.kind === "query") {
      const key = entry.key == null ? "" : String(entry.key);
      if (!key || !queries.has(key)) failures.push(`FAIL 등록부 낡음 query ${id} ${key || "(key 없음)"} — ${FIX}`);
    } else if (entry.kind === "script") {
      const file = normRel(entry.path);
      if (!file || !scripts.has(file)) failures.push(`FAIL 등록부 낡음 script ${id} ${file || "(path 없음)"} — ${FIX}`);
    } else {
      failures.push(`FAIL 등록부 kind 가 module·query·script 가 아님 ${id} — ${FIX}`);
    }

    if (entry.class === "temporary") {
      const past = daysAfter(now, entry.expires);
      if (past == null) {
        failures.push(`FAIL temporary expires 가 없거나 날짜가 아님 id=${id} — ${FIX}`);
      } else if (past > 30) {
        failures.push(`FAIL temporary 만료 후 ${past}일(30일 초과) id=${id} expires=${entry.expires} — ${FIX}`);
      } else if (past > 0) {
        warnings.push(`WARN temporary 만료 후 ${past}일(30일 이내) id=${id} expires=${entry.expires}`);
      }
    }
  }

  failures.sort();
  warnings.sort();
  return { failures, warnings };
}

export function loadRegistry(root = ROOT) {
  const abs = path.join(root, REGISTRY_REL);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(raw.tools)) throw new Error(`${REGISTRY_REL} 에 tools 배열이 없다`);
  return raw;
}

function printList(registry) {
  const rows = [...(registry.tools ?? [])].sort((a, b) => {
    const kind = String(a.kind).localeCompare(String(b.kind));
    if (kind !== 0) return kind;
    return String(a.path ?? a.key ?? a.id).localeCompare(String(b.path ?? b.key ?? b.id));
  });
  console.log(["kind", "class", "id", "path/key", "purpose"].join("\t"));
  for (const entry of rows) {
    console.log([
      entry.kind ?? "",
      entry.class ?? "",
      entry.id ?? "",
      entry.path ?? entry.key ?? "",
      entry.purpose ?? "",
    ].join("\t"));
  }
  const counts = rows.reduce((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`합계 ${rows.length} (module ${counts.module ?? 0}, query ${counts.query ?? 0}, script ${counts.script ?? 0})`);
}

function main() {
  const check = process.argv.includes("--check");
  const list = process.argv.includes("--list");
  if (!check && !list) {
    console.error("사용법: node scripts/check-dev-tools.mjs --check | --list");
    process.exit(2);
  }
  const registry = loadRegistry(ROOT);
  if (list) printList(registry);
  if (!check) return;
  const world = collectWorld(ROOT);
  const { failures, warnings } = evaluateDevTools(world, registry);
  for (const line of failures) console.log(line);
  for (const line of warnings) console.log(line);
  if (failures.length) {
    console.log(`check-dev-tools: FAIL ${failures.length} · WARN ${warnings.length}`);
    process.exit(1);
  }
  console.log(`check-dev-tools: PASS · WARN ${warnings.length}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) main();
