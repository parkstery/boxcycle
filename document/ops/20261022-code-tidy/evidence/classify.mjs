// knip 후보를 저장소 전체 단어 검색으로 재분류: DELETE / UNEXPORT / KEEP
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const [knipPath, outPath] = process.argv.slice(2);
const root = "C:/20.HDev/boxcycle";
const dirs = ["apps/web/src", "apps/web/scripts", "apps/web/e2e", "apps/web/index.html", "apps/web/vite.config.ts", "apps/web/playwright.config.ts", "functions/src", "scripts", "blender"];
const files = [];
const walk = (p) => { let st; try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) { for (const n of readdirSync(p)) { if (n === "node_modules" || n === "dist" || n.startsWith(".")) continue; walk(join(p, n)); } }
  else if (/\.(m?[jt]sx?|d\.mts|html|py|json)$/.test(p) && st.size < 3e6) files.push(p); };
for (const d of dirs) walk(join(root, d));
const text = new Map(files.map((f) => [relative(root, f).replaceAll("\\", "/"), readFileSync(f, "utf8")]));
const knip = JSON.parse(readFileSync(knipPath, "utf8"));
const rows = [];
for (const i of knip.issues) {
  const own = "apps/web/" + i.file;
  for (const kind of ["exports", "types"]) for (const e of i[kind] || []) {
    const re = new RegExp(`(?<![\w$])${e.name.replace(/\$/g, "\$")}(?![\w$])`, "g");
    const ownCount = (text.get(own)?.match(re) || []).length;
    const outside = [];
    const decl = new RegExp(`export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+${e.name}(?![\w$])`, "g");
    const reexp = new RegExp(`export\s*(?:type\s*)?\{[^}]*\}\s*from`, "g");
    for (const [f, t] of text) { if (f === own) continue; const m = t.match(re); if (!m) continue;
      // 선언·재수출만 있는 파일은 사용으로 치지 않는다
      let n = m.length - (t.match(decl) || []).length;
      for (const blk of t.match(reexp) || []) n -= (blk.match(re) || []).length;
      if (n > 0) outside.push(f); }
    const action = outside.length ? "KEEP" : ownCount > 1 ? "UNEXPORT" : "DELETE";
    rows.push({ file: i.file, name: e.name, kind, action, outside: outside.slice(0, 3) });
  }
}
writeFileSync(outPath, JSON.stringify(rows, null, 1));
const c = {}; for (const r of rows) c[r.action] = (c[r.action] || 0) + 1; console.log(c);
