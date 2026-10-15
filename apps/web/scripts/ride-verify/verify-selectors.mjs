// 진입 시퀀스 셀렉터 계약 정적 검증 — Firebase·앱 구동 불필요, 소스만 읽는다.
// entry-contract.mjs 의 각 앵커가 해당 소스 파일에 실재하는지 확인. 하나라도 없으면 exit 1.
//
//   cd apps/web && node scripts/ride-verify/verify-selectors.mjs
//
// e2e(entry.spec.ts)가 깨지기 전에, UI 변경으로 셀렉터 앵커가 사라졌음을 커밋 전 게이트로 잡는다.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRY_STEPS } from "./entry-contract.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");

function readAnchors(file, anchors) {
  const path = resolve(WEB_ROOT, file);
  let src;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    return { ok: false, missingFile: true, missing: anchors, path: file };
  }
  const missing = anchors.filter((a) => !a.re.test(src));
  return { ok: missing.length === 0, missingFile: false, missing, path: file };
}

let failed = 0;
for (const step of ENTRY_STEPS) {
  const targets = [{ file: step.file, anchors: step.anchors }, ...(step.also ?? [])];
  const bad = targets.map((target) => readAnchors(target.file, target.anchors)).filter((result) => !result.ok);
  if (bad.length) {
    failed += 1;
    console.error(`✗ ${step.step}`);
    for (const result of bad) {
      if (result.missingFile) {
        console.error(`  · 파일 없음: ${result.path}`);
        continue;
      }
      console.error(`  (${result.path})`);
      for (const anchor of result.missing) console.error(`  · 앵커 실종: ${anchor.name}  ${anchor.re}`);
    }
    console.error(`  → 셀렉터: ${step.selector}`);
  } else {
    console.log(`✓ ${step.step} — ${step.desc}`);
  }
}

if (failed) {
  console.error(`\n${failed}개 단계의 셀렉터 앵커가 사라졌다. entry-contract.mjs 와 entry.spec.ts 를 UI 변경에 맞춰 갱신하라.`);
  process.exit(1);
}
console.log(`\n진입 시퀀스 셀렉터 계약 ${ENTRY_STEPS.length}단계 전부 유효.`);
