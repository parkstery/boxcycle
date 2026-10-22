#!/usr/bin/env node
/**
 * 코드 정련 래칫 게이트 (2026-10-22, document/ops/20261022-code-tidy P7).
 *
 * 정련으로 줄인 숫자가 다시 늘지 않게 막는다. pre-push 가 `--check` 로 돌린다.
 *
 *   1. 안 쓰이는 export·타입·파일·두 이름 — knip(`apps/web/knip.config.mjs`), 제품 소스(src/)만 센다
 *   2. 반복 줄 — jscpd(src, 8줄·70토큰 이상, 시험 제외)
 *   3. 파일 줄 수 — src 의 .ts/.tsx/.css 가 LINE_CAP 을 넘으면 기준선 목록에 있어야 하고, 기준선 + LARGE_FILE_SLACK 을 넘지 못한다
 *
 * 숫자만 보면 측정 규칙(knip 설정·jscpd 옵션·LINE_CAP)을 넓혀 통과시킬 수 있다.
 * 그래서 기준선에 규칙 지문을 함께 적고, 지문이 다르면 실패한다.
 *
 *   node scripts/check-code-tidy.mjs --check            기준선과 비교 (pre-push)
 *   node scripts/check-code-tidy.mjs --report           현재 숫자만 출력
 *   node scripts/check-code-tidy.mjs --update           줄어든 숫자로 기준선을 낮춘다
 *   node scripts/check-code-tidy.mjs --update --allow-increase   늘어난 값·바뀐 규칙도 기록(결정 로그에 이유를 남길 것)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web");
const BASELINE_REL = "apps/web/code-tidy.baseline.json";
const KNIP_CONFIG = "knip.config.mjs";
const JSCPD_ARGS = ["src", "--min-lines", "8", "--min-tokens", "70", "--ignore", "**/*.test.*"];
const LINE_CAP = 1200;
/** 이미 큰 파일이 기준선보다 이만큼까지는 늘어도 된다 — 한 줄 늘 때마다 막으면 기능 수정이 더디다(2026-10-23 Chief) */
const LARGE_FILE_SLACK = 150;
const LINE_EXT = new Set([".ts", ".tsx", ".css"]);
const KNIP_KINDS = ["files", "exports", "types", "duplicates"];

const args = new Set(process.argv.slice(2));

function fingerprint() {
  const knip = fs.readFileSync(path.join(WEB, KNIP_CONFIG), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256")
    .update(JSON.stringify({ knip, jscpd: JSCPD_ARGS, lineCap: LINE_CAP, lineExt: [...LINE_EXT], largeFileSlack: LARGE_FILE_SLACK }))
    .digest("hex")
    .slice(0, 16);
}

/** 패키지의 bin 스크립트를 셸 없이 node 로 직접 돌린다(Windows 의 npx.cmd 는 셸이 필요해 인자가 이스케이프되지 않는다). */
function runBin(pkg, binName, cmdArgs, cwd) {
  // exports 가 ./package.json 을 막는 패키지가 있어 resolve 대신 node_modules 를 위로 찾는다
  const pkgJsonPath = [WEB, ROOT]
    .map((dir) => path.join(dir, "node_modules", pkg, "package.json"))
    .find((p) => fs.existsSync(p));
  if (!pkgJsonPath) throw new Error(`${pkg} 가 설치돼 있지 않다 — npm install`);
  const { bin } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const rel = typeof bin === "string" ? bin : bin[binName];
  return execFileSync(process.execPath, [path.join(path.dirname(pkgJsonPath), rel), ...cmdArgs], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function measureKnip() {
  const out = runBin("knip", "knip", ["--config", KNIP_CONFIG, "--reporter", "json", "--no-exit-code", "--no-progress"], WEB);
  const report = JSON.parse(out.slice(out.indexOf("{")));
  const counts = Object.fromEntries(KNIP_KINDS.map((k) => [k, 0]));
  for (const issue of report.issues) {
    if (!issue.file.startsWith("src/")) continue;
    for (const k of KNIP_KINDS) counts[k] += Array.isArray(issue[k]) ? issue[k].length : 0;
  }
  return counts;
}

function measureJscpd() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-tidy-jscpd-"));
  try {
    runBin("jscpd", "jscpd", [...JSCPD_ARGS, "--reporters", "json", "--output", outDir, "--silent"], WEB);
    const report = JSON.parse(fs.readFileSync(path.join(outDir, "jscpd-report.json"), "utf8"));
    return report.statistics.total.duplicatedLines;
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

function measureLargeFiles() {
  const large = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (LINE_EXT.has(path.extname(entry.name)) && !/\.test\./.test(entry.name)) {
        const lines = fs.readFileSync(abs, "utf8").split("\n").length;
        if (lines > LINE_CAP) large[path.relative(WEB, abs).replaceAll("\\", "/")] = lines;
      }
    }
  };
  walk(path.join(WEB, "src"));
  return large;
}

function measure() {
  return {
    fingerprint: fingerprint(),
    knip: measureKnip(),
    duplicatedLines: measureJscpd(),
    largeFiles: measureLargeFiles(),
  };
}

/** 기준선보다 나빠진 항목 목록. 비어 있으면 통과. */
export function compare(base, cur) {
  const worse = [];
  if (base.fingerprint !== cur.fingerprint) {
    worse.push(`측정 규칙이 바뀌었다(지문 ${base.fingerprint} → ${cur.fingerprint}) — 규칙을 넓혀 통과시키지 않는다`);
  }
  for (const k of KNIP_KINDS) {
    if ((cur.knip[k] ?? 0) > (base.knip[k] ?? 0)) worse.push(`knip ${k} ${base.knip[k]} → ${cur.knip[k]}`);
  }
  if (cur.duplicatedLines > base.duplicatedLines) {
    worse.push(`반복 줄 ${base.duplicatedLines} → ${cur.duplicatedLines}`);
  }
  for (const [file, lines] of Object.entries(cur.largeFiles)) {
    const allowed = base.largeFiles[file];
    if (allowed == null) worse.push(`${file} ${lines}줄 — 새로 ${LINE_CAP}줄을 넘었다`);
    else if (lines > allowed + LARGE_FILE_SLACK) worse.push(`${file} ${allowed} → ${lines}줄 (여유 ${LARGE_FILE_SLACK}줄 초과)`);
  }
  return worse;
}

function readBaseline() {
  const abs = path.join(ROOT, BASELINE_REL);
  return fs.existsSync(abs) ? JSON.parse(fs.readFileSync(abs, "utf8")) : null;
}

function writeBaseline(cur) {
  const body = {
    왜: "코드 정련 래칫 — 숫자는 낮추기만 한다. scripts/check-code-tidy.mjs 머리 주석 참조",
    updated: new Date().toISOString().slice(0, 10),
    ...cur,
  };
  fs.writeFileSync(path.join(ROOT, BASELINE_REL), JSON.stringify(body, null, 2) + "\n");
}

function summary(cur) {
  const large = Object.entries(cur.largeFiles).map(([f, n]) => `${f} ${n}`).join(", ") || "없음";
  return `knip ${KNIP_KINDS.map((k) => `${k} ${cur.knip[k]}`).join(" · ")} | 반복 줄 ${cur.duplicatedLines} | ${LINE_CAP}줄 초과: ${large}`;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const cur = measure();
  const base = readBaseline();
  if (args.has("--report")) {
    console.log(summary(cur));
  } else if (args.has("--update")) {
    const worse = base ? compare(base, cur) : [];
    if (worse.length > 0 && !args.has("--allow-increase")) {
      console.error(`[code-tidy] 기준선을 올리지 않는다:\n  ${worse.join("\n  ")}\n  늘어난 것을 받아들이려면 --allow-increase 와 결정 로그 한 줄.`);
      process.exit(1);
    }
    writeBaseline(cur);
    console.log(`[code-tidy] 기준선 갱신 — ${summary(cur)}`);
  } else {
    if (!base) {
      console.error(`[code-tidy] 기준선 ${BASELINE_REL} 이 없다 — --update 로 만든다`);
      process.exit(1);
    }
    const worse = compare(base, cur);
    if (worse.length > 0) {
      console.error(`[code-tidy] 정련 숫자가 나빠졌다:\n  ${worse.join("\n  ")}`);
      console.error("  안 쓰는 코드를 지우거나 반복을 합치거나 파일을 나눈다. 줄였으면 --update 로 기준선을 낮춘다.");
      process.exit(1);
    }
    console.log(`[code-tidy] 기준선 이내 — ${summary(cur)}`);
  }
}
