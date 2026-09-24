import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

const line = process.argv[2];
if (!line) {
  console.error("usage: append-progress.mjs <line>");
  process.exit(1);
}
const d = new Date();
const hh = String(d.getHours()).padStart(2, "0");
const mm = String(d.getMinutes()).padStart(2, "0");
const p = resolve("document/ops/20260923-first_ride/PROGRESS.md");
appendFileSync(p, `\n${hh}:${mm} | ${line}\n`, { encoding: "utf8" });
console.log("ok", `${hh}:${mm}`);
