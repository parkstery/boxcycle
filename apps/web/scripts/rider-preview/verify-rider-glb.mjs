#!/usr/bin/env node
/**
 * 라이더 GLB 정적 검증 — 앱 구동·로그인 없이 CLI로 실행.
 *
 * 검증 항목(하나라도 실패 시 exit 1):
 *   1. 노드 6종 존재: crank, leg_l, leg_l_shin, leg_r, leg_r_shin, torso
 *   2. 월드 AABB 전고·전장이 기대 범위 안 (모델 저스케일/형태 붕괴 회귀 감지)
 *   3. IK 좌표 불변식이 riderGlbPedalPose.ts 와 완전 일치
 *      (pelvis/bb/knee/crankArm — 두 파일이 하드코딩 공유, 인수인계 §2)
 *
 * three 로 로드해 Box3 로 AABB 를 잰다(three 는 이미 devDep). GLB 를 손수
 * 파싱하지 않는다 — 회전 행렬 구성에서 틀리기 쉽다.
 *
 * 사용: node scripts/rider-preview/verify-rider-glb.mjs [glbPath]
 *   기본 glbPath = public/rider/prototype/rider-lowpoly.glb
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..", "..");
const glbPath =
  process.argv[2] ?? path.join(webRoot, "public", "rider", "prototype", "rider-lowpoly.glb");

// ── 기대값(인수인계 §2). 변경 시 문서와 함께 갱신할 것. ──────────────────
const REQUIRED_NODES = ["crank", "leg_l", "leg_l_shin", "leg_r", "leg_r_shin", "torso"];
const HEIGHT_RANGE_M = [1.10, 1.30]; // 원본 AABB 전고(레이어에서 ×1.15 보정 전)
const LENGTH_RANGE_M = [1.25, 1.55]; // 전장(휠베이스+오버행)
const IK_INVARIANTS = { pelvis: [-0.12, 0.8], bb: [-0.04, 0.4], kneeLocal: [0.04, -0.208], crankArmM: 0.14 };

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function loadScene(buf) {
  const arr = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arr, "", (gltf) => resolve(gltf.scene), reject);
  });
}

function readIkInvariantsFromSource() {
  const src = fs.readFileSync(path.join(webRoot, "src", "lib", "riderGlbPedalPose.ts"), "utf8");
  const num = "(-?\\d+(?:\\.\\d+)?)";
  const grab = (re) => {
    const m = src.match(re);
    return m ? m.slice(1).map(Number) : null;
  };
  return {
    pelvis: grab(new RegExp(`PELVIS[^=]*=\\s*\\{\\s*x:\\s*${num},\\s*y:\\s*${num}`)),
    bb: grab(new RegExp(`BB[^=]*=\\s*\\{\\s*x:\\s*${num},\\s*y:\\s*${num}`)),
    kneeLocal: grab(new RegExp(`KNEE_LOCAL\\s*=\\s*\\{\\s*x:\\s*${num},\\s*y:\\s*${num}`)),
    crankArmM: grab(new RegExp(`CRANK_ARM_M\\s*=\\s*${num}`)),
  };
}

// ── 실행 ────────────────────────────────────────────────────────────────
console.log(`\n라이더 GLB 검증: ${path.relative(webRoot, glbPath)}`);
if (!fs.existsSync(glbPath)) {
  fail("GLB 파일 없음 — 먼저 'npm run gen:rider-glb' 실행");
  process.exit(1);
}

const scene = await loadScene(fs.readFileSync(glbPath));

// 1) 노드 6종
const names = new Set();
scene.traverse((o) => o.name && names.add(o.name));
const missing = REQUIRED_NODES.filter((n) => !names.has(n));
if (missing.length) fail(`노드 누락: ${missing.join(", ")}`);
else ok(`노드 6종 존재 (${REQUIRED_NODES.join(", ")})`);

// 2) AABB (지면 그림자 원판 제외 — 라이더 전고가 아님)
const shadow = scene.getObjectByName("groundShadow");
if (shadow) shadow.removeFromParent();
const box = new THREE.Box3().setFromObject(scene);
const size = new THREE.Vector3();
box.getSize(size);
if (size.y < HEIGHT_RANGE_M[0] || size.y > HEIGHT_RANGE_M[1])
  fail(`전고 ${size.y.toFixed(3)}m — 기대 ${HEIGHT_RANGE_M[0]}~${HEIGHT_RANGE_M[1]}m 벗어남`);
else ok(`전고 ${size.y.toFixed(3)}m (레이어 ×1.15 → ${(size.y * 1.15).toFixed(2)}m)`);
if (size.x < LENGTH_RANGE_M[0] || size.x > LENGTH_RANGE_M[1])
  fail(`전장 ${size.x.toFixed(3)}m — 기대 ${LENGTH_RANGE_M[0]}~${LENGTH_RANGE_M[1]}m 벗어남`);
else ok(`전장 ${size.x.toFixed(3)}m (폭 ${size.z.toFixed(3)}m)`);

// 3) IK 불변식 대조 (스크립트 기대값 ↔ riderGlbPedalPose.ts 실제값)
const srcIk = readIkInvariantsFromSource();
function cmp(label, expected, actual) {
  if (!actual) return fail(`IK 불변식 ${label} — riderGlbPedalPose.ts 파싱 실패(형식 변경?)`);
  const eq = expected.every((v, i) => Math.abs(v - actual[i]) < 1e-6);
  if (!eq) fail(`IK 불변식 ${label} 불일치: 기대 [${expected}] ≠ 소스 [${actual}]`);
  else ok(`IK 불변식 ${label} 일치 [${actual}]`);
}
cmp("pelvis", IK_INVARIANTS.pelvis, srcIk.pelvis);
cmp("bb", IK_INVARIANTS.bb, srcIk.bb);
cmp("kneeLocal", IK_INVARIANTS.kneeLocal, srcIk.kneeLocal);
cmp("crankArmM", [IK_INVARIANTS.crankArmM], srcIk.crankArmM);

console.log(process.exitCode === 1 ? "\n검증 실패 — 위 항목을 고칠 것.\n" : "\n모든 정적 검증 통과.\n");
