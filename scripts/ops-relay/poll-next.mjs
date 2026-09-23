#!/usr/bin/env node
/**
 * ops 릴레이: 아직 수행결과가 없는 가장 높은 지시 파일을 출력한다.
 * Usage: node scripts/ops-relay/poll-next.mjs [ops-dir]
 * Exit: 0 = NEXT 또는 IDLE (둘 다 정상). 출력 첫 토큰으로 분기.
 */
import fs from "node:fs";
import path from "node:path";

const opsDir = path.resolve(
  process.argv[2] ?? "document/ops/20260922-new_camera",
);

if (!fs.existsSync(opsDir)) {
  console.log(`MISSING ${opsDir}`);
  process.exit(2);
}

const files = fs.readdirSync(opsDir).filter((f) => f.endsWith(".md"));

/** @type {Map<number, { instruction: string|null, superseded: boolean, hasResult: boolean }>} */
const byNum = new Map();

function slot(n) {
  if (!byNum.has(n)) {
    byNum.set(n, { instruction: null, superseded: false, hasResult: false });
  }
  return byNum.get(n);
}

const instrRe = /^(\d{8})-지시(\d+)-(.+)\.md$/;
const resultRe = /^(\d{8})-지시(\d+)수행결과(\d*)-/;

for (const f of files) {
  const im = f.match(instrRe);
  if (im) {
    const n = Number(im[2]);
    const s = slot(n);
    s.instruction = f;
    const body = fs.readFileSync(path.join(opsDir, f), "utf8");
    // 이 지시 자체가 폐기된 경우만 (예: 「상태: 지시03 으로 대체됨」).
    // 「지시02 를 대체한다」처럼 *다른* 지시를 대체하는 문장은 무시.
    if (
      new RegExp(
        String.raw`상태[^\\n]{0,80}지시\\d+\\s*으로\\s*대체됨|` +
          String.raw`^\\s*-\\s*\\*\\*상태\\*\\*:\\s*\\*\\*지시\\d+\\s*으로\\s*대체`,
        "m",
      ).test(body) ||
      /^\s*-\s*\*\*상태\*\*:[^\n]*대체됨/m.test(body)
    ) {
      s.superseded = true;
    }
    continue;
  }
  const rm = f.match(resultRe);
  if (rm) {
    slot(Number(rm[2])).hasResult = true;
  }
}

const pending = [...byNum.entries()]
  .filter(([, v]) => v.instruction && !v.superseded && !v.hasResult)
  .sort((a, b) => b[0] - a[0]);

if (pending.length === 0) {
  console.log("IDLE");
  const done = [...byNum.entries()]
    .filter(([, v]) => v.instruction && !v.superseded)
    .sort((a, b) => b[0] - a[0]);
  if (done[0]) {
    console.log(`LATEST_DONE 지시${String(done[0][0]).padStart(2, "0")}`);
  }
  process.exit(0);
}

const [num, v] = pending[0];
const full = path.join(opsDir, v.instruction);
console.log(`NEXT ${full}`);
console.log(`NUM 지시${String(num).padStart(2, "0")}`);
process.exit(0);
