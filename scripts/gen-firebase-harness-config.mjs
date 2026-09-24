#!/usr/bin/env node
/**
 * `firebase.harness.json` 을 `firebase.json` 에서 **생성**한다.
 *
 * 왜 — 2026-09-24 구조 감사가 이 둘을 「글자 그대로의 중복」으로 잡았다(위험 H5).
 * firestore·database·emulators 설정이 두 파일에 똑같이 적혀 있어, 에뮬레이터 포트나
 * 규칙 경로를 한쪽만 고치면 **하네스가 다른 세계를 보면서도 아무 에러를 내지 않았다.**
 *
 * 하네스가 본체와 달라야 하는 것은 셋뿐이다.
 *   1. functions.source  — 미러 디렉터리를 쓴다(운영 functions 를 건드리지 않기 위해)
 *   2. functions.predeploy — 미러는 이미 빌드된 것을 넣으므로 빌드하지 않는다
 *   3. hosting — 하네스는 호스팅을 띄우지 않는다
 * 그 외는 전부 본체를 따른다. 여기서 다시 적지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "firebase.json");
const OUT = path.join(ROOT, "firebase.harness.json");

/** 하네스용 functions source — route-token 하네스가 준비하는 미러. */
const HARNESS_FUNCTIONS_SOURCE = "apps/web/scripts/route-token/.runner-cache/functions-mirror";

export function buildHarnessConfig(base) {
  const fn = Array.isArray(base.functions) ? base.functions[0] : base.functions;
  if (!fn) throw new Error("firebase.json 에 functions 설정이 없다");

  const harnessFn = { ...fn, source: HARNESS_FUNCTIONS_SOURCE };
  // 미러는 빌드 산출물을 그대로 넣는다 — predeploy 로 다시 빌드하면 운영 functions 를 건드린다.
  delete harnessFn.predeploy;

  const out = { ...base, functions: [harnessFn] };
  // 하네스는 호스팅을 쓰지 않는다.
  delete out.hosting;
  return out;
}

function main() {
  const base = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const harness = buildHarnessConfig(base);
  const text = `${JSON.stringify(harness, null, 2)}\n`;

  const check = process.argv.includes("--check");
  const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;

  if (check) {
    if (existing === null) {
      console.error("[harness config] firebase.harness.json 이 없다. `node scripts/gen-firebase-harness-config.mjs` 로 생성하라.");
      process.exit(1);
    }
    if (existing.split("\r\n").join("\n") !== text) {
      console.error("[harness config] firebase.harness.json 이 firebase.json 과 어긋났다.");
      console.error("  → `node scripts/gen-firebase-harness-config.mjs` 를 돌려 다시 만들고 함께 커밋하라.");
      process.exit(1);
    }
    console.log("[harness config] 통과 — firebase.json 과 동기.");
    return;
  }

  fs.writeFileSync(OUT, text);
  console.log(`[harness config] firebase.harness.json 생성 — functions.source=${HARNESS_FUNCTIONS_SOURCE}`);
}

if (import.meta.url === `file:///${process.argv[1].split("\\").join("/")}`) {
  main();
}
