#!/usr/bin/env node
/**
 * ops 릴레이 수신 대기 — 새 지시가 올라올 때까지 **블록**한다.
 *
 * poll-next.mjs 는 「지금 있나?」를 1회 묻고 끝난다(감리가 쓴다).
 * 이 스크립트는 「올 때까지 기다린다」다 — 개발팀장(커서)이 쓴다.
 * 한 라운드를 끝낸 뒤 이걸 실행해 두면, 감리가 다음 지시를 떨어뜨리는 순간
 * 본문까지 찍고 빠져나온다. Chief 가 중간에서 심부름할 일이 없다.
 *
 * Usage:
 *   node scripts/ops-relay/await-next.mjs [ops-dir]
 *     [--timeout 1500] [--interval 20] [--quiet]
 *     [--ignore-open-at-start]   시작 시점에 이미 열려 있던 미완 지시는 건너뛴다
 *                               (다른 개발팀장이 마무리 중일 때 핸드오프용)
 *
 * Exit:
 *   0  NEXT  — 지시 도착(본문을 stdout 에 찍는다). 읽고 바로 착수하라
 *   0  IDLE  — 대기 시간 만료. **다시 실행**하라(루프를 끊지 마라)
 *   2  MISSING — 폴더 없음
 *
 * 에이전트 자동 착수: 셸을 notify_on_output(pattern: ^NEXT ) 로 띄워 두면
 * NEXT 가 찍히는 순간 세션이 깨어 지시 본문을 읽고 즉시 수행한다.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Math.max(1, Number(args[i + 1]) || dflt) : dflt;
};
const quiet = args.includes("--quiet");
const ignoreOpenAtStart = args.includes("--ignore-open-at-start");
const timeoutSec = num("--timeout", 1500); // 25분
const intervalSec = num("--interval", 20);
const opsDir = path.resolve(
  args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) ??
    "document/ops/20260923-first_ride",
);

if (!fs.existsSync(opsDir)) {
  console.log(`MISSING ${opsDir}`);
  process.exit(2);
}

const instrRe = /^(\d{8})-지시(\d+)-(.+)\.md$/;
const resultRe = /^(\d{8})-지시(\d+)수행결과(\d*)-/;
const ackFile = path.join(opsDir, ".relay-ack.json");
const handoffIgnoreFile = path.join(opsDir, ".relay-handoff-ignore.json");

/** poll-next.mjs 와 같은 판정: 수행결과가 없는 가장 높은 지시 */
function findNext() {
  const files = fs.readdirSync(opsDir).filter((f) => f.endsWith(".md"));
  /** @type {Map<number, {instruction: string|null, superseded: boolean, hasResult: boolean}>} */
  const byNum = new Map();
  const slot = (n) => {
    if (!byNum.has(n))
      byNum.set(n, { instruction: null, superseded: false, hasResult: false });
    return byNum.get(n);
  };
  for (const f of files) {
    const im = f.match(instrRe);
    if (im) {
      const s = slot(Number(im[2]));
      s.instruction = f;
      const body = fs.readFileSync(path.join(opsDir, f), "utf8");
      if (/지시\d+\s*으?로\s*대체/.test(body)) s.superseded = true;
    }
    const rm = f.match(resultRe);
    if (rm) slot(Number(rm[2])).hasResult = true;
  }
  const open = [...byNum.entries()]
    .filter(([, s]) => s.instruction && !s.hasResult && !s.superseded)
    .sort((a, b) => b[0] - a[0]);
  return open.length ? { num: open[0][0], file: open[0][1].instruction } : null;
}

function listOpenInstructionFiles() {
  const files = fs.readdirSync(opsDir).filter((f) => f.endsWith(".md"));
  /** @type {Map<number, {instruction: string|null, superseded: boolean, hasResult: boolean}>} */
  const byNum = new Map();
  const slot = (n) => {
    if (!byNum.has(n))
      byNum.set(n, { instruction: null, superseded: false, hasResult: false });
    return byNum.get(n);
  };
  for (const f of files) {
    const im = f.match(instrRe);
    if (im) {
      const s = slot(Number(im[2]));
      s.instruction = f;
      const body = fs.readFileSync(path.join(opsDir, f), "utf8");
      if (/지시\d+\s*으?로\s*대체/.test(body)) s.superseded = true;
    }
    const rm = f.match(resultRe);
    if (rm) slot(Number(rm[2])).hasResult = true;
  }
  return [...byNum.values()]
    .filter((s) => s.instruction && !s.hasResult && !s.superseded)
    .map((s) => s.instruction);
}

/** @type {Set<string>} */
let ignoreFiles = new Set();
if (ignoreOpenAtStart) {
  try {
    if (fs.existsSync(handoffIgnoreFile)) {
      const prev = JSON.parse(fs.readFileSync(handoffIgnoreFile, "utf8"));
      if (Array.isArray(prev.ignore)) ignoreFiles = new Set(prev.ignore);
    }
  } catch {
    /* noop */
  }
  if (ignoreFiles.size === 0) {
    ignoreFiles = new Set(listOpenInstructionFiles());
    try {
      fs.writeFileSync(
        handoffIgnoreFile,
        JSON.stringify(
          { ignore: [...ignoreFiles], at: new Date().toISOString() },
          null,
          2,
        ),
      );
    } catch {
      /* noop */
    }
  }
  if (!quiet && ignoreFiles.size > 0) {
    process.stderr.write(
      `핸드오프 ignore: ${[...ignoreFiles].join(", ")}\n`,
    );
  }
}

function readAck() {
  try {
    return JSON.parse(fs.readFileSync(ackFile, "utf8"));
  } catch {
    return { delivered: [] };
  }
}

/** 수신 사실을 PROGRESS.md 에 한 줄 남긴다 — 감리 워처가 이 줄로 「받았다」를 안다 */
function ack(file, n) {
  const state = readAck();
  const first = !state.delivered.includes(file);
  if (first) {
    state.delivered.push(file);
    try {
      fs.writeFileSync(ackFile, JSON.stringify(state, null, 2));
    } catch {
      /* ack 실패가 착수를 막지 않는다 */
    }
    const hh = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const line = `${hh} | 지시${String(n).padStart(2, "0")} 수신 — 착수\n`;
    try {
      const p = path.join(opsDir, "PROGRESS.md");
      if (fs.existsSync(p)) fs.appendFileSync(p, line);
      else fs.writeFileSync(p, `# 진행 로그\n\n${line}`);
    } catch {
      /* 로그 실패가 착수를 막지 않는다 */
    }
  }
  return first;
}

const started = Date.now();
let ticks = 0;

function tick() {
  const hit = findNext();
  if (hit && ignoreFiles.has(hit.file)) {
    // 다른 팀장이 마무리 중인 지시 — 수행결과가 생길 때까지 무시
    ticks += 1;
  } else if (hit) {
    // 핸드오프 ignore 파일은 새 지시 수신 시 지운다(이후 정상 루프)
    try {
      if (fs.existsSync(handoffIgnoreFile)) fs.unlinkSync(handoffIgnoreFile);
    } catch {
      /* noop */
    }
    const isNew = ack(hit.file, hit.num);
    const full = path.join(opsDir, hit.file);
    console.log(`NEXT ${full}`);
    console.log(`NUM 지시${String(hit.num).padStart(2, "0")}`);
    console.log(isNew ? "STATE 신규 지시" : "STATE 이미 수신한 지시(미완료)");
    console.log("");
    console.log("──────── 지시 본문 ────────");
    try {
      console.log(fs.readFileSync(full, "utf8"));
    } catch {
      console.log("(본문을 읽지 못했다 — 파일을 직접 열어라)");
    }
    console.log("──────── 본문 끝 ────────");
    console.log("");
    console.log("지금 착수하라. Chief 의 「계속」을 기다리지 마라.");
    console.log(
      `끝나면 ${path.basename(opsDir)} 에 지시${String(hit.num).padStart(2, "0")}수행결과-*.md 를 쓰고, 이 스크립트를 다시 실행하라.`,
    );
    process.exit(0);
  }

  ticks += 1;
  const elapsed = (Date.now() - started) / 1000;
  if (elapsed >= timeoutSec) {
    console.log("IDLE");
    console.log(
      `대기 ${Math.round(elapsed / 60)}분 · 새 지시 없음. **다시 실행하라** — 루프를 끊지 마라.`,
    );
    process.exit(0);
  }
  if (!quiet && ticks % 15 === 0) {
    process.stderr.write(`… 대기 ${Math.round(elapsed / 60)}분\n`);
  }
  setTimeout(tick, intervalSec * 1000);
}

if (!quiet) {
  process.stderr.write(
    `ops 릴레이 수신 대기: ${path.basename(opsDir)} · ${intervalSec}초 간격 · 최대 ${Math.round(timeoutSec / 60)}분` +
      (ignoreOpenAtStart ? " · ignore-open-at-start" : "") +
      "\n",
  );
}
tick();
