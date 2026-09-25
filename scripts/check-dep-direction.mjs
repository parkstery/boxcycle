#!/usr/bin/env node
/**
 * apps/web/src/lib 의 도메인 간 import 방향과 순환을 본다.
 *
 * 왜 있는가 — 구조 감사(260924) §8 은 "도메인 폴더로 나누면 순환 4쌍이 자연 해소된다"고
 * 적었으나, 실측하면 **분할은 순환을 드러낼 뿐 끊어주지 않는다**. 방향을 선언하고 그
 * 선언을 기계가 지키게 해야 한다. 선언은 `apps/web/dep-layers.json` 이 갖는다.
 *
 * 형식은 선형 계층이 아니라 **허용 엣지 DAG** 다(결정 D7). `ride` 와 `trail` 은 서로를
 * 모르는 형제이고, 그 관계는 순위로 표현할 수 없다.
 *
 * ── 판정 전에 스스로를 검산한다(M0) ─────────────────────────────
 * 이 프로젝트에서 판정 도구가 두 번 틀렸고 두 번 다 "지워도 된다"/"통과" 쪽이었다.
 * 그래서 본 판정 앞에 자가 검산을 세운다. 검산이 실패하면 본 판정 결과는 버린다.
 *   - 수집 파일 수가 하한을 넘는가            (0건 수집 → 위반 0건 = 거짓 통과 방지)
 *   - 알려진 사실이 재현되는가 (geo.ts fan-in)
 *   - 알려진 순환 R9 가 검출되는가            (검출기가 죽어 있으면 순환 0건이 나온다)
 *   - lib 파일 전원에게 도메인이 지정됐는가    (미지정은 조용히 규칙 밖으로 빠진다)
 *
 * 사용법
 *   node scripts/check-dep-direction.mjs            위반 목록 보고 (exit 0)
 *   node scripts/check-dep-direction.mjs --check    baseline 초과 시 실패 (pre-push)
 *   node scripts/check-dep-direction.mjs --write-baseline   현재 위반을 baseline 으로 고정
 *
 * baseline 은 "허용"이 아니라 **갚아야 할 빚의 눈금**이다. 늘면 실패하고, 줄면 줄어든
 * 값으로 다시 고정하라고 알린다(래칫). Phase 5 가 끝나면 0 이어야 한다.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web");
/**
 * 그래프에 넣을 뿌리. `src` 만 걸으면 **소비자의 한 무리를 통째로 못 본다** —
 * `apps/web/scripts` 의 71개 파일이 `src/lib/` 를 import 하고, 계약 시험이 유일한
 * 소비자인 정책 모듈(`sensorChipSlot`)이 실제로 있었다. 「참조 0건」을 말하려면
 * 어디를 찾았는지가 판정의 일부다.
 */
const WALK_ROOTS = ["src", "scripts", "e2e"];
const LIB_PREFIX = "src/lib/";
const DECL_PATH = path.join(ROOT, "apps/web/dep-layers.json");
const BASELINE_PATH = path.join(ROOT, "apps/web/dep-layers.baseline.json");

const MODE_CHECK = process.argv.includes("--check");
const MODE_WRITE = process.argv.includes("--write-baseline");

/** M0 하한 — 수집이 망가져 0건이 되면 위반도 0건이 된다. */
const MIN_FILES = 400;
const MIN_GEO_FAN_IN = 40;

// ─────────────────────────────────────────────── 1. 선언 읽기

const decl = JSON.parse(fs.readFileSync(DECL_PATH, "utf8"));

/** "lib 상대경로" → 도메인(또는 "도메인/repo"). 폴더는 접두어로 등록한다. */
const fileDomain = new Map();
const folderDomain = [];
for (const [domain, entries] of Object.entries(decl.assign)) {
  for (const e of entries) {
    if (e.endsWith("/")) folderDomain.push([e, domain]);
    else fileDomain.set(e, domain);
  }
}
const pending = new Set(Object.keys(decl.pending ?? {}).filter((k) => k !== "왜"));

const appLayerPaths = decl.appLayer.paths;
const UNIVERSAL = decl.universallyImportable?.domains ?? [];
const REPO_MAY = decl.repoMayImport?.domains ?? [];

/**
 * 허용 규칙의 지문.
 *
 * 왜 필요한가 — 이 게이트를 통과하는 가장 쉬운 길은 코드를 고치는 게 아니라
 * `dep-layers.json` 의 mayImport 를 넓히는 것이다. 그러면 위반 수가 줄어 게이트가
 * 통과하고, 구조는 그대로 무너진 채 남는다. 지문이 바뀌면 재고정을 요구해서
 * 규칙 완화가 반드시 git diff 에 드러나게 한다.
 * 파일 배정(assign)은 넣지 않는다 — 파일 이동은 Phase 5 의 정상 작업이다.
 */
const rulesFingerprint = crypto
  .createHash("sha256")
  .update(
    JSON.stringify([
      Object.entries(decl.domains)
        .map(([k, v]) => [k, [...v.mayImport].sort()])
        .sort(),
      [...UNIVERSAL].sort(),
      [...REPO_MAY].sort(),
    ]),
  )
  .digest("hex")
  .slice(0, 16);

/** 파일의 소속을 정한다. lib 밖이면 "(app)". 지정이 없으면 null. */
function domainOf(relFromWeb) {
  if (!relFromWeb.startsWith(LIB_PREFIX)) return "(app)";
  const inLib = relFromWeb.slice(LIB_PREFIX.length);
  if (fileDomain.has(inLib)) return fileDomain.get(inLib);
  for (const [prefix, d] of folderDomain) if (inLib.startsWith(prefix)) return d;
  if (pending.has(inLib)) return "(pending)";
  return null;
}

/** 도메인 이름에서 repo 꼬리를 뗀다. "trail/repo" → "trail" */
const baseOf = (d) => (d.endsWith("/repo") ? d.slice(0, -"/repo".length) : d);

/**
 * from 도메인이 to 도메인을 import 해도 되는가.
 * D1 — X 가 Y/repo 를 볼 수 있는 조건은 X 가 Y 를 볼 수 있는 것과 같다.
 * repo 는 자기 도메인과 firebase 를 본다. 남의 도메인 본체는 보지 않는다.
 */
function mayImport(from, to) {
  if (from === "(app)" || to === "(app)") return true;
  if (from === "(pending)" || to === "(pending)") return true;
  const fb = baseOf(from);
  const tb = baseOf(to);
  if (fb === tb) return true;
  // 정책은 전부 선언이 갖는다 — 스크립트에 예외를 박으면 선언이 진실이 아니게 된다.
  if (UNIVERSAL.includes(tb)) return true;
  if (from.endsWith("/repo") && REPO_MAY.includes(tb)) return true;
  const rule = decl.domains[fb];
  if (!rule) return false;
  if (rule.mayImport.includes("*")) return true;
  return rule.mayImport.includes(tb);
}

// ─────────────────────────────────────────────── 2. import 그래프

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "tmp" || e.name === ".out") continue;
      walk(p);
    } else if (/\.(ts|tsx|mts|mjs)$/.test(e.name) && !/\.d\.mts$/.test(e.name)) {
      files.push(p.split(path.sep).join("/"));
    }
  }
}
for (const r of WALK_ROOTS) {
  const d = path.join(WEB, r);
  if (fs.existsSync(d)) walk(d);
}

const WEB_POSIX = WEB.split(path.sep).join("/");
const rel = (f) => f.slice(WEB_POSIX.length + 1);
/** 위반 출력용 — `src/lib/` 접두어를 떼고 lib 안 경로만 보여준다. */
const show = (r) => (r.startsWith(LIB_PREFIX) ? r.slice(LIB_PREFIX.length) : r);

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".mjs", "/index.ts", "/index.tsx"];
const fileSet = new Set(files);

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.posix.join(path.posix.dirname(fromFile), spec);
  for (const s of CANDIDATE_SUFFIXES) {
    const c = base + s;
    if (fileSet.has(c)) return c;
  }
  return null;
}

/**
 * 정적 `import/export … from "x"` · 부수효과 `import "x"` · 동적 `import("x")`.
 * 동적 import 를 빼면 App.tsx:162 류(R2)가 그래프에서 사라진다.
 *
 * ⚠️ 첫 절은 **줄머리에 고정**하고 `[^;'"]*` 로 문장을 넘지 못하게 한다.
 * 종전 `[\s\S]*?` 는 `import.meta.url`(문장 중간의 `import`)에서 시작해 한참 뒤의
 * `from "…"` 까지 이어 붙여 **없는 엣지를 만들어냈다**. 팬텀 엣지는 없는 위반을 만들고,
 * 반대로 진짜 엣지를 가릴 수도 있다.
 */
const IMPORT_RE =
  /^\s*(?:import|export)\b[^;'"]*\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/gm;

const edges = new Map();
/**
 * 해석되지 않은 상대 specifier.
 *
 * 왜 세는가 — 해석 못 한 엣지를 조용히 버리면 **깨진 코드가 위반을 줄인다.**
 * 2026-09-25 파일 이동이 중간에 멈췄을 때 실제로 위반이 59 → 25 로 「좋아졌다」.
 * 엣지가 사라지면 위반도 사라지기 때문이다 — 전형적인 축퇴값 자동통과다.
 * 그래서 M0 에서 이것을 막는다. (패키지를 넘는 경로는 디스크로 확인해 제외한다)
 */
const unresolved = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const set = new Set();
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec || !spec.startsWith(".")) continue;
    const r = resolveSpec(f, spec);
    if (r) {
      set.add(r);
      continue;
    }
    if (/\.(json|css|svg|png|glb)$/.test(spec)) continue;
    const base = path.posix.join(path.posix.dirname(f), spec);
    if (CANDIDATE_SUFFIXES.some((s) => fs.existsSync(base + s))) continue; // 범위 밖, 정상
    unresolved.push(`${rel(f)} → ${spec}`);
  }
  edges.set(f, set);
}

const fanIn = new Map(files.map((f) => [f, 0]));
for (const tos of edges.values()) for (const t of tos) fanIn.set(t, fanIn.get(t) + 1);

// ─────────────────────────────────────────────── 3. 순환 (Tarjan SCC)

function findCycles(graph = edges, nodes = files) {
  let idx = 0;
  const stack = [];
  const onStack = new Set();
  const num = new Map();
  const low = new Map();
  const out = [];
  // 재귀 깊이가 파일 수에 비례한다 — 282 파일에서는 안전하다.
  function strong(v) {
    num.set(v, idx);
    low.set(v, idx);
    idx += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!num.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), num.get(w)));
      }
    }
    if (low.get(v) === num.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) out.push(comp);
    }
  }
  for (const f of nodes) if (!num.has(f)) strong(f);
  return out;
}

const cycles = findCycles();

// ─────────────────────────────────────────────── 4. M0 자가 검산

const geoFile = files.find((f) => rel(f) === LIB_PREFIX + "geo.ts");
const scsFile = files.find((f) => rel(f) === LIB_PREFIX + "sensorChipSlot.ts");
const unassigned = files.filter(
  (f) => rel(f).startsWith(LIB_PREFIX) && domainOf(rel(f)) === null,
);

/*
 * 검출기 생존 확인 — **합성 그래프**로 잰다.
 *
 * 종전에는 「알려진 순환 R9 가 검출되는가」로 확인했다. 그런데 2026-09-25 에 R9 를
 * **고치자 이 검산이 죽었다.** 고치면 죽는 검산은 검산이 아니다 — 제품 코드가 나쁜
 * 상태로 남아 있어야만 성립하는 전제였다. 이제 알고리즘 자체를 시험한다.
 */
const synthCycle = new Map([
  ["a", new Set(["b"])],
  ["b", new Set(["c"])],
  ["c", new Set(["a"])],
  ["d", new Set(["a"])],
]);
const synthAcyclic = new Map([
  ["a", new Set(["b"])],
  ["b", new Set(["c"])],
  ["c", new Set()],
]);
const synthNodes = ["a", "b", "c", "d"];
const foundCycle = findCycles(synthCycle, synthNodes).some((c) => c.length === 3);
const foundNone = findCycles(synthAcyclic, ["a", "b", "c"]).length === 0;
const r9Detected = foundCycle && foundNone;

const m0 = [
  ["수집 파일 수 ≥ " + MIN_FILES, files.length >= MIN_FILES, files.length],
  ["src/lib/geo.ts 존재", Boolean(geoFile), geoFile ? rel(geoFile) : "없음"],
  [
    "src/lib/geo.ts fan-in ≥ " + MIN_GEO_FAN_IN,
    geoFile ? fanIn.get(geoFile) >= MIN_GEO_FAN_IN : false,
    geoFile ? fanIn.get(geoFile) : "-",
  ],
  [
    "순환 검출기 생존 (합성 그래프 양방향)",
    r9Detected,
    `순환 ${foundCycle ? "검출" : "미검출"} · 비순환 오탐 ${foundNone ? "없음" : "있음"}`,
  ],
  ["lib 파일 전원 도메인 지정", unassigned.length === 0, unassigned.length + "건 미지정"],
  // scripts 뿌리가 빠지면 이 모듈의 fan-in 이 0 이 된다 — 유일한 소비자가
  // scripts/ride-hierarchy 의 계약 시험이기 때문이다. 범위 누락의 감지선.
  [
    "깨진 상대경로 0 (엣지가 사라지면 위반도 사라진다)",
    unresolved.length === 0,
    unresolved.length + "건",
  ],
  [
    "scripts 뿌리 포함 (sensorChipSlot fan-in ≥ 1)",
    scsFile ? fanIn.get(scsFile) >= 1 : false,
    scsFile ? fanIn.get(scsFile) : "파일 없음",
  ],
];

console.log("=== M0 자가 검산 ===");
for (const [name, ok, value] of m0) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  (${value})`);
}
if (unresolved.length > 0) {
  console.log("\n  해석 못 한 상대경로 — 이동이 덜 끝났다는 뜻이다(repair-lib-imports.mjs):");
  for (const u of unresolved.slice(0, 20)) console.log("    " + u);
}
if (unassigned.length > 0) {
  console.log("\n  미지정 파일 — dep-layers.json 의 assign 또는 pending 에 넣어야 한다:");
  for (const f of unassigned) console.log("    " + show(rel(f)));
}

const m0Failed = m0.some(([, ok]) => !ok);
if (m0Failed) {
  console.error(
    "\n[check-dep-direction] M0 실패 — 판정 도구가 망가졌다. 아래 위반 목록을 신뢰하지 마라.",
  );
  process.exit(2);
}

// ─────────────────────────────────────────────── 5. 방향 위반

const violations = [];
for (const [from, tos] of edges) {
  const fr = rel(from);
  if (!fr.startsWith(LIB_PREFIX)) continue;
  const fd = domainOf(fr);
  if (fd === "debug" || fd === "(pending)") continue;
  for (const to of tos) {
    const tr = rel(to);
    if (!tr.startsWith(LIB_PREFIX)) continue;
    const td = domainOf(tr);
    if (td === "(pending)") continue;
    if (mayImport(fd, td)) continue;
    violations.push({ rule: `${fd} -> ${td}`, from: show(fr), to: show(tr) });
  }
}
violations.sort((a, b) => a.rule.localeCompare(b.rule) || a.from.localeCompare(b.from));

const byRule = new Map();
for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);

console.log(`\n=== 방향 위반 ${violations.length}건 ===`);
for (const [r, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${r}`);
  for (const v of violations.filter((v) => v.rule === r)) {
    console.log(`         ${v.from} → ${v.to}`);
  }
}
if (violations.length === 0) console.log("  (없음)");

const libCycles = cycles.filter((c) => c.every((f) => rel(f).startsWith(LIB_PREFIX)));
console.log(`\n=== lib 순환 ${libCycles.length}쌍 ===`);
for (const c of libCycles) {
  console.log("  " + c.map((f) => show(rel(f))).join("  <->  "));
}
if (libCycles.length === 0) console.log("  (없음)");

// ─────────────────────────────────────────────── 6. baseline 래칫

const current = { violations: violations.length, cycles: libCycles.length };

if (MODE_WRITE) {
  const payload = {
    왜: "Phase 5 시작 시점의 위반 눈금. 허용 목록이 아니라 갚아야 할 빚이다. 늘면 pre-push 가 막는다. Phase 5 종료 시 0 이어야 한다.",
    기준: new Date().toISOString().slice(0, 10),
    규칙지문: rulesFingerprint,
    ...current,
    위반내역: violations.map((v) => `${v.rule}  ${v.from} → ${v.to}`),
    순환내역: libCycles.map((c) => c.map((f) => show(rel(f))).join(" <-> ")),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\n[baseline] 고정 — 위반 ${current.violations} · 순환 ${current.cycles}`);
  process.exit(0);
}

if (!MODE_CHECK) {
  console.log("\n(보고 모드 — 실패하지 않는다. 게이트로 쓰려면 --check)");
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error("\n[check-dep-direction] baseline 이 없다. --write-baseline 으로 먼저 고정하라.");
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));

let failed = false;

if (baseline.규칙지문 && baseline.규칙지문 !== rulesFingerprint) {
  failed = true;
  console.error(
    `\n[게이트 실패] 허용 규칙이 바뀌었다 (${baseline.규칙지문} → ${rulesFingerprint}).` +
      `\n  위반 수를 줄이는 가장 쉬운 길은 규칙을 넓히는 것이다 — 그래서 자동 통과를 막는다.` +
      `\n  규칙 변경이 의도라면 결정 로그에 남기고 재고정하라: node scripts/check-dep-direction.mjs --write-baseline`,
  );
}

for (const key of ["violations", "cycles"]) {
  const label = key === "violations" ? "방향 위반" : "순환";
  if (current[key] > baseline[key]) {
    failed = true;
    console.error(
      `\n[게이트 실패] ${label}이 늘었다: ${baseline[key]} → ${current[key]}` +
        `\n  dep-layers.json 의 허용 엣지를 넓히지 말고, 의존을 뒤집거나 포트를 넣어 끊어라.`,
    );
  } else if (current[key] < baseline[key]) {
    console.log(
      `\n[진전] ${label} ${baseline[key]} → ${current[key]}.` +
        ` 되돌아가지 않게 고정하라: node scripts/check-dep-direction.mjs --write-baseline`,
    );
  }
}

if (failed) process.exit(1);
console.log("\n[check-dep-direction] baseline 이내 — 통과");
process.exit(0);
