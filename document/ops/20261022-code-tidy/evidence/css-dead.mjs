// CSS 클래스 중 TS/TSX/HTML 어디에도 문자열로 나오지 않는 것을 찾는다(동적 조합 접두어는 제외)
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
const web = "C:/20.HDev/boxcycle/apps/web";
const files = [];
const walk = (p) => { const st = statSync(p); if (st.isDirectory()) { for (const n of readdirSync(p)) if (!["node_modules", "dist", ".out"].includes(n)) walk(join(p, n)); } else files.push(p); };
walk(join(web, "src")); walk(join(web, "scripts")); walk(join(web, "e2e")); files.push(join(web, "index.html"));
const css = files.filter((f) => f.endsWith(".css") && f.includes("\src\\") || f.endsWith(".css") && f.includes("/src/"));
const code = files.filter((f) => /\.(tsx?|mjs|html)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
// 템플릿 접두어: `foo--${x}` / "foo--" + x
const dynPrefixes = [...code.matchAll(/([a-z][\w-]*?(?:--|__|-))\$\{/g)].map((m) => m[1])
  .concat([...code.matchAll(/["'`]([a-z][\w-]*?(?:--|__|-))["'`]\s*\+/g)].map((m) => m[1]));
const out = {}; let total = 0, dead = 0;
for (const f of css) {
  const t = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const classes = new Set([...t.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c)));
  for (const c of classes) { total++;
    if (code.includes(c)) continue;
    if (dynPrefixes.some((p) => c.startsWith(p))) continue;
    if (c.startsWith("mapboxgl-") || c.startsWith("maplibregl-")) continue;
    (out[relative(web, f).replaceAll("\\", "/")] ||= []).push(c); dead++; }
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log({ total, dead, files: Object.keys(out).length });
for (const [f, cs] of Object.entries(out).sort((a, b) => b[1].length - a[1].length).slice(0, 15)) console.log(cs.length, f);
