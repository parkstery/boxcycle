/**
 * register-anchors — 단계 A: rider·cycle GLB 에서 실제 추출한 접점 앵커를 manifest 에 저장.
 * HTML 내부 상수가 아니라 두 GLB 의 실제 좌표(extract-anchors.py Blender 추출)를 박는다.
 *
 * 실행: node scripts/rider-cycle-fit/register-anchors.mjs [--blenderExe <path>] [--inputHash <hash>]
 * 산출: .out/inputs/anchors-<inputHash>.json  (manifest-<inputHash>.json 옆)
 * 의존: 먼저 register-inputs.mjs 로 manifest-latest.json 생성돼 있어야(inputHash 확인).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { INPUTS_ROOT, REPO_ROOT, DEFAULT_BLENDER_EXE, DEFAULT_INPUTS, kstNow } from "./register-inputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT_ANCHORS_PY = path.join(REPO_ROOT, "blender", "rider-cycle-fit", "extract-anchors.py");

function arg(name, def) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${name}`);
  return i >= 0 ? a[i + 1] : def;
}

function main() {
  const blenderExe = arg("blenderExe", DEFAULT_BLENDER_EXE);
  // inputHash: 인자 우선, 없으면 manifest-latest 에서
  let inputHash = arg("inputHash", null);
  if (!inputHash) {
    const latestPath = path.join(INPUTS_ROOT, "manifest-latest.json");
    if (!fs.existsSync(latestPath)) {
      console.error("✗ manifest-latest.json 없음 — 먼저 register-inputs.mjs 실행.");
      process.exit(1);
    }
    inputHash = JSON.parse(fs.readFileSync(latestPath, "utf8")).inputHash;
  }
  if (!fs.existsSync(EXTRACT_ANCHORS_PY)) { console.error(`✗ ${EXTRACT_ANCHORS_PY} 없음`); process.exit(1); }
  if (!fs.existsSync(blenderExe)) { console.error(`✗ Blender 없음: ${blenderExe}`); process.exit(1); }

  const out = execFileSync(blenderExe, ["--background", "--python", EXTRACT_ANCHORS_PY, "--", DEFAULT_INPUTS.rider, DEFAULT_INPUTS.cycle],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const line = out.split(/\r?\n/).find((l) => l.startsWith("@@ANCHORS@@"));
  if (!line) { console.error("✗ @@ANCHORS@@ 출력 없음(Blender 오류?)"); process.exit(1); }
  const anchors = JSON.parse(line.slice("@@ANCHORS@@".length).trim());

  const t = kstNow();
  const doc = {
    $note: "단계 A 앵커 — rider·cycle GLB 실제 추출(HTML 상수 아님). glTF mm(x전방,y상,z좌).",
    inputHash,
    extractedAt: t.human,
    ...anchors,
    reconcile: {
      $note: "실측 GLB 본길이 vs 앱 정본 대조(anti-pattern #3 근원). 결합 정본 = GLB 실측(사용자 결정 2026-07-29).",
      chosen: { source: "GLB 실측", thigh: anchors.rider?.boneLengths_mm?.thigh ?? null, shin: anchors.rider?.boneLengths_mm?.shin ?? null,
        why: "결합 대상은 실제 GLB 라이더. 그 뼈로 IK 를 풀어야 발-페달 도달 0mm. fit_ik.py V2 thigh 430 과 일치." },
      glbBoneLengths: anchors.rider?.boneLengths_mm ?? null,
      appRig: { thigh: 493, shin: 493, source: "riderRig.geometry.mjs", use: "절차생성 라이더용(별개)" },
      anthropometry: { thigh: 415, shin: 405, source: "riderAnthropometry.json", use: "절차생성 라이더용(별개)" },
    },
  };
  const outPath = path.join(INPUTS_ROOT, `anchors-${inputHash}.json`);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));

  console.log(`✔ 단계 A 앵커 등록: inputHash=${inputHash} (${t.human})`);
  console.log(`  anchors: ${outPath}`);
  const r = anchors.rider, c = anchors.cycle;
  console.log(`  RIDER 본길이(실측): thigh ${r.boneLengths_mm.thigh} shin ${r.boneLengths_mm.shin} upperArm ${r.boneLengths_mm.upperArm} forearm ${r.boneLengths_mm.forearm}`);
  console.log(`  RIDER pelvisRoot ${JSON.stringify(r.pelvisRoot)} hipL ${JSON.stringify(r.hipL)} shoulderL ${JSON.stringify(r.shoulderL)}`);
  console.log(`  CYCLE BB ${JSON.stringify(c.BB)} saddleSurface ${JSON.stringify(c.saddleSurface)} hoodGrip ${JSON.stringify(c.hoodGrip)}`);
  console.log(`  ⚠ 다리길이 대조(anti#3): GLB실측 ${r.boneLengths_mm.thigh}/${r.boneLengths_mm.shin} vs 앱rig 493/493 vs anthropometry 415/405 — 정본 결정 필요.`);
}

main();
