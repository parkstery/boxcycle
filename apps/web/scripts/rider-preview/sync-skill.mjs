/**
 * Sync Skill — rider-preview 스킬을 .claude(원본) → .agents 로 동기화.
 *
 * 두 파일을 수동으로 각각 관리하면 규칙이 어긋난다. `.claude/skills/rider-preview/SKILL.md` 를
 * canonical 원본으로 삼아 `.agents/skills/rider-preview/SKILL.md` 로 복사한다.
 * frontmatter(name/description/allowed-tools)가 동일하므로 파일 전체를 그대로 복사한다.
 *
 * 사용:
 *   node scripts/rider-preview/sync-skill.mjs          # 원본 → 사본 복사(동기화)
 *   node scripts/rider-preview/sync-skill.mjs --check   # 불일치면 exit 1(CI/커밋 게이트)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname = apps/web/scripts/rider-preview → 리포 루트는 4단계 위.
const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const CANONICAL = path.join(repoRoot, ".claude", "skills", "rider-preview", "SKILL.md");
const MIRROR = path.join(repoRoot, ".agents", "skills", "rider-preview", "SKILL.md");

const check = process.argv.includes("--check");

if (!fs.existsSync(CANONICAL)) {
  console.error(`원본 없음: ${CANONICAL}`);
  process.exit(1);
}
const src = fs.readFileSync(CANONICAL, "utf8");
const dst = fs.existsSync(MIRROR) ? fs.readFileSync(MIRROR, "utf8") : null;

if (check) {
  if (dst === src) {
    console.log("✓ 스킬 사본 동기화됨 (.claude == .agents)");
    process.exit(0);
  }
  console.error("✗ 스킬 사본 불일치 — `node scripts/rider-preview/sync-skill.mjs` 로 동기화 필요");
  process.exit(1);
}

fs.mkdirSync(path.dirname(MIRROR), { recursive: true });
fs.writeFileSync(MIRROR, src);
console.log(`✓ 동기화 완료 → ${path.relative(repoRoot, MIRROR)}`);
