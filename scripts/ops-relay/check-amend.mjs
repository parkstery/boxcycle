#!/usr/bin/env node
/**
 * ops 릴레이 정정 감지 — **작업 중에 지시가 고쳐졌는지** 확인한다.
 *
 * await-next 는 지시를 한 번 물어다 주고 끝난다. 그런데 Chief 결정이 라운드 중간에 뒤집히면
 * 감리는 진행 중인 지시서에 「⚠【정정】」 블록을 끼워 넣는다. 작업 중인 개발팀장은 그걸 볼
 * 방법이 없다 — 이 스크립트가 그 구멍을 메운다.
 *
 * **진행 로그(PROGRESS.md)를 쓸 때마다 같이 돌려라.** 10분에 한 번이면 충분하다.
 *
 * Usage:
 *   node scripts/ops-relay/check-amend.mjs [ops-dir]
 *
 * Exit:
 *   0  CLEAN   — 정정 없음. 하던 일을 계속하라
 *   0  AMENDED — 정정 있음. **본문을 읽고 지금 하던 방향을 고쳐라**
 *   2  MISSING — 폴더 없음
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opsDir = path.resolve(
  args.find((a) => !a.startsWith("--")) ?? "document/ops/20260923-first_ride",
);
if (!fs.existsSync(opsDir)) {
  console.log(`MISSING ${opsDir}`);
  process.exit(2);
}

const instrRe = /^(\d{8})-지시(\d+)-(.+)\.md$/;
const resultRe = /^(\d{8})-지시(\d+)수행결과(\d*)-/;
const ackFile = path.join(opsDir, ".relay-ack.json");

function openInstruction() {
  const files = fs.readdirSync(opsDir).filter((f) => f.endsWith(".md"));
  const done = new Set();
  for (const f of files) {
    const rm = f.match(resultRe);
    if (rm) done.add(Number(rm[2]));
  }
  const open = files
    .map((f) => ({ f, m: f.match(instrRe) }))
    .filter((x) => x.m && !done.has(Number(x.m[2])))
    .sort((a, b) => Number(b.m[2]) - Number(a.m[2]));
  return open.length ? { file: open[0].f, num: Number(open[0].m[2]) } : null;
}

/** 지시서 안의 「⚠【정정】」 블록만 뽑는다 */
function extractAmends(text) {
  const lines = text.split(/\r?\n/);
    const blocks = [];
  let cur = null;
  for (const ln of lines) {
    if (/^#{1,4}\s*⚠?\s*【정정/.test(ln) || /^#{1,4}.*⚠【정정/.test(ln)) {
      if (cur) blocks.push(cur);
      cur = [ln];
    } else if (cur) {
      if (/^---\s*$/.test(ln) || /^#{1,2}\s+§?\d/.test(ln)) {
        blocks.push(cur);
        cur = null;
      } else cur.push(ln);
    }
  }
  if (cur) blocks.push(cur);
  return blocks.map((b) => b.join("\n").trim()).filter(Boolean);
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function readAck() {
  try {
    return JSON.parse(fs.readFileSync(ackFile, "utf8"));
  } catch {
    return {};
  }
}

const hit = openInstruction();
if (!hit) {
  console.log("CLEAN 열린 지시 없음 — await-next 로 돌아가라");
  process.exit(0);
}

const full = path.join(opsDir, hit.file);
const text = fs.readFileSync(full, "utf8");
const amends = extractAmends(text);
const state = readAck();
state.seenAmends ??= {};
const seen = new Set(state.seenAmends[hit.file] ?? []);
const fresh = amends.filter((a) => !seen.has(hash(a)));

if (!fresh.length) {
  console.log(`CLEAN 지시${String(hit.num).padStart(2, "0")} 정정 없음 (누적 ${amends.length}건 확인됨)`);
  process.exit(0);
}

console.log(`AMENDED 지시${String(hit.num).padStart(2, "0")} — 새 정정 ${fresh.length}건`);
console.log(`FILE ${full}`);
console.log("");
console.log("⚠ 지금 하던 방향이 무효가 됐을 수 있다. 읽고 즉시 반영하라.");
console.log("");
for (const a of fresh) {
  console.log("──────── 정정 ────────");
  console.log(a);
  console.log("");
}
console.log("반영했으면 PROGRESS.md 에 「정정 수신 — <무엇을 바꿨나>」 한 줄을 남겨라.");

// --peek: 읽음 처리를 하지 않는다(감리가 「정정이 잘 들어갔나」만 확인할 때).
// 이 표시를 남기면 정작 개발팀장이 CLEAN 을 받아 정정을 놓친다 — 실제로 두 번 당했다.
if (args.includes("--peek")) {
  console.log("");
  console.log("(--peek: 읽음 처리하지 않음 — 개발팀장은 이 정정을 그대로 받는다)");
} else {
  state.seenAmends[hit.file] = [...seen, ...fresh.map(hash)];
  try {
    fs.writeFileSync(ackFile, JSON.stringify(state, null, 2));
  } catch {
    /* 기록 실패가 전달을 막지 않는다 */
  }
}
