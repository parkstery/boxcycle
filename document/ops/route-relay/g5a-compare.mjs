import fs from "node:fs";
const { overlapByCell } = await import("file:///C:/20.HDev/boxcycle-5a/document/ops/route-relay/g5a-overlap.mjs");
const load = (p) => JSON.parse(fs.readFileSync(p, "utf8")).rows;
const before = load(process.argv[2]), after = load(process.argv[3]);
const byLabel = (rows) => Object.fromEntries(rows.map((r) => [r.label, r]));
const B = byLabel(before), A = byLabel(after);
const stat = (r) => (r?.coordinates ? overlapByCell(r.coordinates) : null);

console.log("표본          | before outcome/중복/호출 | after outcome/중복/호출");
const wasDetoured = [];
let bSumAll = 0, aSumAll = 0, n = 0;
for (const label of Object.keys(B)) {
  const b = B[label], a = A[label];
  const ob = stat(b), oa = stat(a);
  if (!ob || !oa) continue;
  n += 1; bSumAll += ob.ratio; aSumAll += oa.ratio;
  if (b.outcome === "detoured") wasDetoured.push({ label, b, a, ob, oa });
  console.log(
    `${label.padEnd(13)}| ${String(b.outcome).padEnd(9)} ${(ob.ratio * 100).toFixed(1).padStart(5)}% ${String(b.providerCallCount ?? (b.detourCalls != null ? b.detourCalls + 1 : "-")).padStart(2)}회 ` +
    `| ${String(a.outcome).padEnd(9)} ${(oa.ratio * 100).toFixed(1).padStart(5)}% ${String(a.providerCallCount ?? "-").padStart(2)}회`
  );
}
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
console.log("\n=== §5.2 핵심: 수정 전 detoured 였던 8표본 ===");
console.log("표본          | before 중복 → after 중복 | before 호출 → after 호출 | after outcome");
for (const d of wasDetoured) {
  console.log(
    `${d.label.padEnd(13)}| ${(d.ob.ratio * 100).toFixed(1).padStart(5)}% → ${(d.oa.ratio * 100).toFixed(1).padStart(5)}%        ` +
    `| ${String(d.b.providerCallCount ?? d.b.detourCalls + 1).padStart(2)}회 → ${String(d.a.providerCallCount).padStart(2)}회             | ${d.a.outcome}`
  );
}
const bR = wasDetoured.map((d) => d.ob.ratio), aR = wasDetoured.map((d) => d.oa.ratio);
const bC = wasDetoured.map((d) => d.b.providerCallCount ?? d.b.detourCalls + 1);
const aC = wasDetoured.map((d) => d.a.providerCallCount);
console.log(`\n평균 중복 ${(avg(bR) * 100).toFixed(1)}% → ${(avg(aR) * 100).toFixed(1)}%   (${(((avg(aR) - avg(bR)) / avg(bR)) * 100).toFixed(0)}%)`);
console.log(`최대 중복 ${(Math.max(...bR) * 100).toFixed(1)}% → ${(Math.max(...aR) * 100).toFixed(1)}%   (${(((Math.max(...aR) - Math.max(...bR)) / Math.max(...bR)) * 100).toFixed(0)}%)`);
console.log(`평균 provider 호출 ${avg(bC).toFixed(1)}회 → ${avg(aC).toFixed(1)}회   최대 ${Math.max(...bC)}회 → ${Math.max(...aC)}회`);
console.log(`\n전체 24표본 평균 중복 ${(bSumAll / n * 100).toFixed(2)}% → ${(aSumAll / n * 100).toFixed(2)}%`);
const viol = after.filter((r) => r.outcome && r.outcome !== "shortfall" && Math.abs((r.distance ?? 0) - 700) > 5);
console.log(`거리 계약 위반(after): ${viol.length}건`);
console.log(`provider 호출 예산 13 초과(after): ${after.filter((r) => (r.providerCallCount ?? 0) > 13).length}건`);
