#!/usr/bin/env node
/**
 * 빠른 단위 시험 묶음 실행기 (2026-10-09).
 *
 *   node scripts/test-quick.mjs            # 전부(≈35초)
 *   node scripts/test-quick.mjs ride map   # 고른 묶음만
 *   node scripts/test-quick.mjs --list     # 묶음별 파일 목록만 출력
 *
 * 왜 만들었나: 단위 시험 100여 개가 79개 개별 명령으로 흩어져 있고, 어느 것도
 * 자동으로 돌지 않았다. 그 사이 거리 자동 경로 시험 5개 파일은 2주 동안 **열리지조차
 * 않았고**, 열자 숨어 있던 실패 13건이 나왔다. 개별 명령은 사람이 기억해야 돈다.
 *
 * 파일은 폴더에서 **자동으로 찾는다** — 새 시험을 만들면 등록 없이 여기 들어온다.
 * 묶음 표(GROUPS)에 없는 폴더는 「etc」 묶음으로 돌리고 경고한다. 조용히 빠지지 않게.
 *
 * 제외: 에뮬레이터가 필요한 시험(*.emulator.*)과 전체 하네스를 띄우는 시험.
 * 그것들은 각자의 test:* 명령으로 돌린다.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS_DIR = join(WEB_ROOT, "scripts");

/** 묶음 → scripts/ 아래 폴더 이름. 최상위 파일은 "." 으로 적는다. */
const GROUPS = {
  ride: [
    "calorie-profile",
    "conquest",
    "hud-companion",
    "next-ride",
    "pacer",
    "ride-calories",
    "ride-camera-framing",
    "ride-continue",
    "ride-elevation",
    "ride-end-north-up",
    "ride-hierarchy",
    "ride-result",
    "ride-stats",
    "rider-preserve",
    "sensor-cadence",
  ],
  route: ["distance-auto-route", "route-token"],
  map: ["map", "focus-read-spike"],
  peer: ["peer-sync"],
  meters: ["traffic", "s42", "s43"],
  tools: ["e2e", "."],
};

const GROUP_LABEL = {
  ride: "주행·결과·센서",
  route: "경로·토큰",
  map: "지도·화면 읽기",
  peer: "동행 동기화",
  meters: "트래픽 계측",
  tools: "시험 도구 자체",
  etc: "묶음 미지정 폴더",
};

/** 빠른 묶음에서 빼는 파일. 이유를 함께 적는다. */
const EXCLUDE = [
  { re: /\.emulator\./, why: "Firebase 에뮬레이터 필요" },
  { re: /runner-fail-recovery\.test\.mjs$/, why: "전체 하네스를 띄움(느림)" },
];

/** 미리 만들어져 있어야 하는 산출물. 없으면 실패 대신 「건너뜀」으로 알린다. */
const REQUIRES = [
  {
    re: /route-token-onboarding-grant\.test\.mjs$/,
    path: join(WEB_ROOT, "..", "..", "functions", "lib", "routeTokenCore.js"),
    hint: "functions 빌드 필요: (functions 폴더) npm run build",
  },
];

const TEST_FILE = /\.test\.(ts|mts|mjs)$/;

function listTestFiles(dir, recursive) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (recursive && name !== "node_modules") out.push(...listTestFiles(full, true));
    } else if (TEST_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function toRel(file) {
  return relative(WEB_ROOT, file).split(sep).join("/");
}

function collect() {
  const folderToGroup = new Map();
  for (const [group, folders] of Object.entries(GROUPS)) {
    for (const f of folders) folderToGroup.set(f, group);
  }
  const byGroup = new Map([...Object.keys(GROUPS), "etc"].map((g) => [g, []]));
  const excluded = [];
  const skipped = [];
  const unmapped = new Set();

  const place = (folder, files) => {
    let group = folderToGroup.get(folder);
    if (!group) {
      group = "etc";
      if (files.length) unmapped.add(folder);
    }
    for (const file of files) {
      const rel = toRel(file);
      const ex = EXCLUDE.find((e) => e.re.test(rel));
      if (ex) {
        excluded.push({ rel, why: ex.why });
        continue;
      }
      const req = REQUIRES.find((r) => r.re.test(rel));
      if (req && !existsSync(req.path)) {
        skipped.push({ rel, why: req.hint });
        continue;
      }
      byGroup.get(group).push(rel);
    }
  };

  place(".", listTestFiles(SCRIPTS_DIR, false));
  for (const name of readdirSync(SCRIPTS_DIR)) {
    const full = join(SCRIPTS_DIR, name);
    if (statSync(full).isDirectory()) place(name, listTestFiles(full, true));
  }
  for (const files of byGroup.values()) files.sort();
  return { byGroup, excluded, skipped, unmapped };
}

function runGroup(files) {
  return new Promise((resolve) => {
    const args = [
      "--experimental-strip-types",
      "--no-warnings=ExperimentalWarning",
      "--import",
      "./scripts/s42/register-vite-env.mjs",
      "--test",
      "--test-force-exit",
      "--test-reporter=spec",
      ...files,
    ];
    const started = Date.now();
    const child = spawn(process.execPath, args, { cwd: WEB_ROOT });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => {
      const num = (label) => {
        const m = output.match(new RegExp(`^ℹ ${label} (\\d+)`, "m"));
        return m ? Number(m[1]) : null;
      };
      resolve({
        code,
        output,
        pass: num("pass"),
        fail: num("fail"),
        sec: (Date.now() - started) / 1000,
      });
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const listOnly = argv.includes("--list");
  const wanted = argv.filter((a) => !a.startsWith("--"));
  const known = [...Object.keys(GROUPS), "etc"];
  const unknown = wanted.filter((g) => !known.includes(g));
  if (unknown.length) {
    console.error(`[test:quick] 모르는 묶음: ${unknown.join(", ")}`);
    console.error(`             쓸 수 있는 묶음: ${known.join(", ")}`);
    process.exit(2);
  }

  const { byGroup, excluded, skipped, unmapped } = collect();
  if (unmapped.size) {
    console.warn(
      `[test:quick] ⚠ 묶음 표에 없는 폴더 → etc 로 실행: ${[...unmapped].join(", ")}` +
        "\n             scripts/test-quick.mjs 의 GROUPS 에 넣어 주세요.",
    );
  }

  const targets = (wanted.length ? wanted : known).filter((g) => byGroup.get(g).length);

  if (listOnly) {
    for (const g of targets) {
      console.log(`\n[${g}] ${GROUP_LABEL[g]} — ${byGroup.get(g).length}개 파일`);
      for (const f of byGroup.get(g)) console.log(`  ${f}`);
    }
    if (excluded.length) {
      console.log("\n[제외]");
      for (const e of excluded) console.log(`  ${e.rel}  (${e.why})`);
    }
    return;
  }

  let totalPass = 0;
  let totalFail = 0;
  let broken = false;
  const t0 = Date.now();

  for (const g of targets) {
    const files = byGroup.get(g);
    const r = await runGroup(files);
    const countsMissing = r.pass === null || r.fail === null;
    const failed = r.code !== 0 || countsMissing || r.fail > 0;
    totalPass += r.pass ?? 0;
    totalFail += r.fail ?? 0;
    const mark = failed ? "✗" : "✓";
    console.log(
      `${mark} ${g.padEnd(6)} ${GROUP_LABEL[g].padEnd(10)}  통과 ${String(r.pass ?? "?").padStart(4)}  실패 ${String(r.fail ?? "?").padStart(3)}  (${files.length}개 파일, ${r.sec.toFixed(1)}초)`,
    );
    if (failed) {
      broken = true;
      // 실패한 묶음만 원문을 보여 준다 — 통과한 묶음의 수천 줄은 실패를 묻어 버린다.
      console.log(`\n----- ${g} 출력 -----\n${r.output.trimEnd()}\n----- ${g} 끝 -----\n`);
      if (countsMissing) console.log(`[test:quick] ${g}: 결과 집계 줄을 찾지 못했습니다(종료 코드 ${r.code}).`);
    }
  }

  for (const s of skipped) console.log(`- 건너뜀 ${s.rel}  (${s.hint ?? s.why})`);
  console.log(
    `\n[test:quick] 합계 통과 ${totalPass} · 실패 ${totalFail} · ${((Date.now() - t0) / 1000).toFixed(1)}초` +
      (excluded.length ? ` · 제외 ${excluded.length}개 파일(에뮬레이터·하네스, --list 로 확인)` : ""),
  );
  process.exit(broken ? 1 : 0);
}

main();
