// 지시 목록 중 아직 처리 안 된 항목을 찾는다
import { readFileSync, existsSync } from "node:fs";
const root = "C:/20.HDev/boxcycle/";
for (const id of process.argv.slice(2)) {
  const md = readFileSync(`${root}document/ops/20261022-code-tidy/02-task-${id}-list.md`, "utf8");
  let file = null, left = [], total = 0;
  for (const line of md.split("\n")) {
    const h = line.match(/^## (.+)$/); if (h) { file = "apps/web/" + h[1].trim(); continue; }
    const m = line.match(/^- (DELETE|UNEXPORT) `([^`]+)`/); if (!m || !file) continue; total++;
    const [, act, name] = m;
    const src = existsSync(root + file) ? readFileSync(root + file, "utf8") : "";
    const w = `(?<![\w$])${name.replace(/\$/g, "\$")}(?![\w$])`;
    const exported = new RegExp(`export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+${w}`).test(src)
      || new RegExp(`export\s*(?:type\s*)?\{[^}]*${w}[^}]*\}`).test(src);
    const present = new RegExp(`(?:function\*?|const|let|var|class|type|interface|enum)\s+${w}`).test(src) || exported;
    const done = act === "DELETE" ? !present : !exported;
    if (!done) left.push(`${act} ${file.replace("apps/web/", "")} ${name}`);
  }
  console.log(`task ${id}: ${total - left.length}/${total} done, ${left.length} left`);
  if (process.env.SHOW) console.log(left.join("\n"));
}
