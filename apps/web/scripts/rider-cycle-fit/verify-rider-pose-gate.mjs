#!/usr/bin/env node
/**
 * verify-rider-pose-gate — 앱에 올리기 **전에** 라이더 자세를 수치로 전수 검증한다 (F23).
 *
 * F22 의 `verify-node-rotation`(회전각 왕복 검산)을 **포함**하고, 자세·해부학·계약까지 넓힌다.
 * 하나라도 실패하면 종료코드 1 — **앱에 올리지 마라.**
 *
 * | # | 검사 | 기준 | 막는 사고 |
 * |---|---|---|---|
 * | 1 | 회전각 왕복 (8노드 × 4위상) | < 1e−6 | 성분 뒤바뀜 → 팔다리 무회전(F15~F21) |
 * | 2 | 무릎 z | 전 위상 **고관절 안쪽** | 무릎이 바깥으로 꺾임(해부학 불가, 사용자 지적) |
 * | 3 | 다리 도달 | hip→발목 ≤ THIGH+SHIN | 발이 페달에서 떨어짐 |
 * | 4 | 팔 도달 | 어깨→후드 ≤ UPPER+FORE | 손이 후드에서 뜸 |
 * | 5 | GLB 노드 ↔ riderRig | `HIP_L`==`leg_l`.T · `SHOULDER_L`==`arm_l`.T | 앱 IK root 와 렌더 노드 불일치(F20) |
 * | 6 | 노드 rest | 라이더 9노드 rotation·scale 없음 | rest 가 오버라이드에 겹침(F19~F21) |
 * | 7 | 정점 수 | 라이더 5,521 불변 | exporter 정점 복제(F16) |
 *
 * ⚠ 허용치를 늘려 통과시키지 마라. 실패는 FAIL 로 보고하는 것이 옳다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node verify-rider-pose-gate.mjs [--glb <path>] [--expect-elbow 113.7] [--verbose]
 *   기본 GLB = 제품 경로.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  hipOf,
  shoulderOf,
  hoodOf,
  ankleTargetWorld,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  PELVIS_HALF_Z,
} from "../../src/lib/riderPrototype/riderRig.geometry.mjs";
import { solveIk3D, restToDirRotationDeg, childRotationDeg } from "../../src/lib/riderPrototype/riderIk.mjs";
// ⚠ pole 을 재현하지 않는다 — pose.mjs 의 것을 그대로 쓴다(복제하면 거짓 PASS).
import { _poles } from "../../src/lib/riderGlbPedalPose.pose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GLB = path.resolve(HERE, "../../public/rider/prototype/rider-lowpoly.glb");
const PHASES = [0, 0.25, 0.5, 0.75];
const TOL = 1e-6;
const D2R = Math.PI / 180;
const REST = [0, -1, 0];
const RIDER_NODES = ["torso", "leg_l", "leg_l_shin", "leg_r", "leg_r_shin", "arm_l", "arm_l_fore", "arm_r", "arm_r_fore"];
const EXPECT_RIDER_VERTS = 5521;

const mm = (v) => +(v * 1000).toFixed(2);
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const Rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const Ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const Rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const mapboxRotation = (e) => mul(mul(Ry(e[1] * D2R), Rz(e[2] * D2R)), Rx(e[0] * D2R));
const applyM = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const { kneePole, elbowPole } = _poles;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function parseGlbJson(p) {
  const buf = fs.readFileSync(p);
  let off = 12;
  let json = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString("utf8").replace(/\0+$/, ""));
    off += 8 + len;
  }
  return json;
}

function main() {
  const glbPath = arg("glb", DEFAULT_GLB);
  const expectElbow = arg("expect-elbow", null);
  const verbose = process.argv.includes("--verbose");
  const fails = [];
  const note = (ok, id, msg) => {
    console.log(`  ${ok ? "✔" : "✘"} [${id}] ${msg}`);
    if (!ok) fails.push(id);
  };
  console.log(`=== verify-rider-pose-gate ===\n  GLB: ${glbPath}\n`);

  // ── 1·2·3 다리 · 4 팔 (앱 IK) ───────────────────────────────────────────
  let worstRound = 0;
  let worstKneeOut = -Infinity;
  let worstLegReach = 0;
  const kneeRows = [];
  for (const phase of PHASES) {
    const crankRad = -phase * Math.PI * 2;
    for (const side of ["l", "r"]) {
      const hip = hipOf(side);
      const target = ankleTargetWorld(side, crankRad);
      const s = solveIk3D(hip, target, kneePole(side, hip), THIGH_LEN, SHIN_LEN);
      const Rp = mapboxRotation(restToDirRotationDeg(s.boneADir));
      worstRound = Math.max(worstRound, dist(applyM(Rp, REST), s.boneADir));
      const Rc = mul(Rp, mapboxRotation(childRotationDeg(s.boneADir, s.boneBDir)));
      worstRound = Math.max(worstRound, dist(applyM(Rc, REST), s.boneBDir));
      // 무릎 z: 좌(+z)는 hip 보다 작아야, 우(−z)는 hip 보다 커야 안쪽
      const kz = mm(s.joint[2]);
      const hz = mm(hip[2]);
      const outward = side === "l" ? kz - hz : hz - kz; // 양수면 바깥
      worstKneeOut = Math.max(worstKneeOut, outward);
      kneeRows.push({ phase, side, kz, hz, outward });
      worstLegReach = Math.max(worstLegReach, dist(hip, target) * 1000);
    }
  }
  let worstArmReach = 0;
  let elbowDeg = null;
  for (const side of ["l", "r"]) {
    const sh = shoulderOf(side);
    const hood = hoodOf(side);
    const s = solveIk3D(sh, hood, elbowPole(side, sh), UPPER_ARM_LEN, FOREARM_LEN);
    const Rp = mapboxRotation(restToDirRotationDeg(s.boneADir));
    worstRound = Math.max(worstRound, dist(applyM(Rp, REST), s.boneADir));
    const Rc = mul(Rp, mapboxRotation(childRotationDeg(s.boneADir, s.boneBDir)));
    worstRound = Math.max(worstRound, dist(applyM(Rc, REST), s.boneBDir));
    worstArmReach = Math.max(worstArmReach, dist(sh, hood) * 1000);
    elbowDeg = 180 - s.jointDeg;
  }

  note(worstRound < TOL, "1 회전각왕복", `최대 오차 ${worstRound.toExponential(2)} < ${TOL}`);

  if (verbose) {
    console.log("      무릎 z (mm) — 양수 outward = 고관절보다 바깥");
    for (const r of kneeRows)
      console.log(`        phase ${String(r.phase).padEnd(5)} ${r.side}  knee.z ${String(r.kz).padStart(7)}  hip.z ${String(r.hz).padStart(6)}  outward ${r.outward.toFixed(1).padStart(7)}`);
  }
  note(worstKneeOut < 0, "2 무릎안쪽", `최악 outward ${worstKneeOut.toFixed(1)}mm (음수여야 안쪽)`);

  const legMax = mm(THIGH_LEN) + mm(SHIN_LEN);
  note(worstLegReach <= legMax, "3 다리도달", `최대 hip→발목 ${worstLegReach.toFixed(1)}mm ≤ ${legMax.toFixed(1)}mm (여유 ${(legMax - worstLegReach).toFixed(1)})`);

  const armMax = mm(UPPER_ARM_LEN) + mm(FOREARM_LEN);
  let armMsg = `어깨→후드 ${worstArmReach.toFixed(1)}mm ≤ ${armMax.toFixed(1)}mm · 팔꿈치 내각 ${elbowDeg.toFixed(1)}°`;
  let armOk = worstArmReach <= armMax;
  if (expectElbow !== null) {
    const d = Math.abs(elbowDeg - Number(expectElbow));
    armMsg += ` (기대 ${expectElbow}°, 차 ${d.toFixed(1)}°)`;
    armOk = armOk && d < 1.0;
  }
  note(armOk, "4 팔도달", armMsg);

  // ── 5·6·7 GLB ───────────────────────────────────────────────────────────
  const g = parseGlbJson(glbPath);
  const byName = new Map();
  g.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  const anchorPairs = [
    ["leg_l", hipOf("l")],
    ["leg_r", hipOf("r")],
    ["arm_l", shoulderOf("l")],
    ["arm_r", shoulderOf("r")],
  ];
  let worstAnchor = 0;
  const anchorLines = [];
  for (const [name, want] of anchorPairs) {
    const i = byName.get(name);
    const t = (g.nodes[i]?.translation ?? [0, 0, 0]).map(mm);
    const w = want.map(mm);
    const d = Math.hypot(t[0] - w[0], t[1] - w[1], t[2] - w[2]);
    worstAnchor = Math.max(worstAnchor, d);
    anchorLines.push(`        ${name.padEnd(7)} GLB [${t.join(", ")}]  riderRig [${w.join(", ")}]  차 ${d.toFixed(2)}mm`);
  }
  if (verbose) anchorLines.forEach((l) => console.log(l));
  note(worstAnchor < 0.05, "5 앵커일치", `최대 차 ${worstAnchor.toFixed(3)}mm (GLB 노드 ↔ riderRig)`);

  const withRest = RIDER_NODES.filter((n) => {
    const nd = g.nodes[byName.get(n)];
    return !nd || nd.rotation || nd.scale || nd.matrix;
  });
  note(withRest.length === 0, "6 노드rest", withRest.length ? `rest 가 남은 노드: ${withRest.join(", ")}` : "라이더 9노드 전부 순수 translation");

  const paletteMats = new Set();
  (g.materials ?? []).forEach((m, i) => {
    if (m.pbrMetallicRoughness?.baseColorTexture) paletteMats.add(i);
  });
  let riderVerts = 0;
  (g.meshes ?? []).forEach((m) =>
    m.primitives.forEach((p) => {
      if (paletteMats.has(p.material)) riderVerts += g.accessors[p.attributes.POSITION].count;
    }),
  );
  note(riderVerts === EXPECT_RIDER_VERTS, "7 정점수", `라이더 정점 ${riderVerts} (기대 ${EXPECT_RIDER_VERTS})`);

  console.log(`\n  ${7 - fails.length}/7 통과`);
  if (fails.length) {
    console.error(`\n✘ FAIL — [${fails.join("] [")}]  앱에 올리지 말고 보고하라.`);
    process.exit(1);
  }
  console.log("✔ PASS — 앱 확인으로 진행해도 된다 (그림 판정은 별개다).");
}

main();
