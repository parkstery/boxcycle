// 5A §4.1 — 정복 셀(z20 ≈ 30m) 기준 중복. 셀 안에 머무는 정상 주행을 중복으로 세면 안 된다.
// 연속 구간(run)으로 묶고, **이미 떠났다가 다시 들어온 셀**의 run 만 중복으로 센다.
import fs from "node:fs";
const Z = 20, R = 6371000;
const cellId = (lng, lat) => {
  const n = 2 ** Z;
  const cl = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (cl * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${x}_${y}`;
};
const dist = (a, b) => {
  const t = (d) => (d * Math.PI) / 180;
  const dLat = t(b[1] - a[1]), dLng = t(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a[1])) * Math.cos(t(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export function overlapByCell(coords) {
  let total = 0;
  const pieces = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const segLen = dist(a, b);
    if (!(segLen > 0)) continue;
    const steps = Math.max(1, Math.ceil(segLen / 3));
    for (let s = 0; s < steps; s++) {
      const t0 = (s + 0.5) / steps;
      pieces.push({
        id: cellId(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
        len: segLen / steps,
      });
      total += segLen / steps;
    }
  }
  // 연속 run 으로 묶는다
  const runs = [];
  for (const p of pieces) {
    const last = runs[runs.length - 1];
    if (last && last.id === p.id) last.len += p.len;
    else runs.push({ id: p.id, len: p.len });
  }
  const seen = new Set();
  let overlap = 0;
  for (const r of runs) {
    if (seen.has(r.id)) overlap += r.len;   // 떠났다가 다시 들어온 셀 = 재방문
    else seen.add(r.id);
  }
  return { totalM: total, overlapM: overlap, ratio: total > 0 ? overlap / total : 0, cells: seen.size, runs: runs.length };
}

// ── M0 자가 검산 ──────────────────────────────────────────────
const off = (ll, brgDeg, m) => {
  const br = (brgDeg * Math.PI) / 180, E = 6378137;
  return [ll[0] + ((m * Math.sin(br)) / (E * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI),
          ll[1] + ((m * Math.cos(br)) / E) * (180 / Math.PI)];
};
const P = [127.0347, 37.5051];
const line = [P, off(P, 90, 700)];
const back = [P, off(P, 90, 350), P];
const l = overlapByCell(line), b = overlapByCell(back);
console.log(`M0 직선 700m      → 중복 ${(l.ratio * 100).toFixed(1)}% (0% 이어야 함)`);
console.log(`M0 왕복 350m×2    → 중복 ${(b.ratio * 100).toFixed(1)}% (약 50% 이어야 함)`);
if (l.ratio > 0.02 || Math.abs(b.ratio - 0.5) > 0.06) { console.error("M0 실패 — 측정 함수가 축퇴됐다"); process.exit(1); }
console.log("M0 통과\n");

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rows = data.rows.filter((r) => r.coordinates);
console.log("label        outcome   detour  total(m)  overlap(m)  ratio   cells");
const byOutcome = {};
for (const r of rows) {
  const o = overlapByCell(r.coordinates);
  (byOutcome[r.outcome] ??= []).push(o.ratio);
  console.log(
    `${r.label.padEnd(12)} ${String(r.outcome).padEnd(9)} ${String(r.detourCalls).padStart(3)}   ` +
    `${o.totalM.toFixed(1).padStart(8)} ${o.overlapM.toFixed(1).padStart(10)}  ${(o.ratio * 100).toFixed(1).padStart(5)}%  ${String(o.cells).padStart(5)}`
  );
}
console.log("\noutcome 별 평균·최대 중복 비율:");
for (const [k, v] of Object.entries(byOutcome)) {
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(`  ${k.padEnd(9)} n=${String(v.length).padStart(2)}  평균 ${(avg * 100).toFixed(1)}%  최대 ${(Math.max(...v) * 100).toFixed(1)}%`);
}
