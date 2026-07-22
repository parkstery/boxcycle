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

let failed = 0;
for (const step of ENTRY_STEPS) {
  const path = resolve(WEB_ROOT, step.file);
  let src;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    failed += 1;
    console.error(`✗ ${step.step} — 파일 없음: ${step.file}`);
    continue;
  }
  const missing = step.anchors.filter((a) => !a.re.test(src));
  if (missing.length) {
    failed += 1;
    console.error(`✗ ${step.step} (${step.file})`);
    for (const m of missing) console.error(`  · 앵커 실종: ${m.name}  ${m.re}`);
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
