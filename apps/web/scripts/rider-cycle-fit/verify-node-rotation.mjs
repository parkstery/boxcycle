#!/usr/bin/env node
/**
 * verify-node-rotation — 앱 IK 가 **렌더러에 전달하는 회전각**을 왕복 검산한다 (F22 상시 게이트).
 *
 * ── 왜 이 게이트가 필요한가 ────────────────────────────────────────────────
 * `sampleRiderMetrics()` 의 `footErr/handErr 0.000mm` 는 **IK 해의 오차**일 뿐,
 * 그 해를 오일러로 변환해 Mapbox 에 넘기는 **전달 단계의 검산이 아니다.**
 *
 * 실제로 `restToDirRotationDeg` 가 y·z 성분을 맞바꿔 반환하는 바람에 팔·다리가
 * 자기 rest 축(−Y) 둘레로 헛돌아 **화면상 전혀 움직이지 않았고**, 계측은 내내
 * 0.000mm 를 보고했다. F15~F21 여섯 단계가 "앱에 올려보고 틀렸다"의 반복이 된 이유다.
 *
 * 이 스크립트는 **앱을 켜기 전에** 그것을 잡는다.
 *
 * ── 무엇을 검사하는가 ──────────────────────────────────────────────────────
 * 8개 노드(leg_l/r · leg_l/r_shin · arm_l/r · arm_l/r_fore) × 4위상(0·0.25·0.5·0.75):
 * ```
 * R = Ry(e[1]) · Rz(e[2]) · Rx(e[0])      ← mapbox-gl `rotationYZX` 와 동일 순서
 * assert | R·[0,−1,0] − 목표 뼈 방향 | < 1e-6
 * ```
 * - 부모(thigh·upper arm) 목표 = `ik.boneADir`
 * - 자식(shin·forearm) 목표 = `ik.boneBDir`. 자식은 부모 로컬에서 도므로
 *   **부모 R 을 곱해 world 로 되돌려** 비교한다.
 *
 * ⚠ 허용치를 늘려 통과시키지 마라. 실패는 FAIL 로 보고하는 것이 옳다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node apps/web/scripts/rider-cycle-fit/verify-node-rotation.mjs [--verbose]
 *   위반이 있으면 **종료코드 1**(파이프라인 차단).
 */
import {
  hipOf,
  shoulderOf,
  hoodOf,
  ankleTargetWorld,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
} from "../../src/lib/riderPrototype/riderRig.geometry.mjs";
import { solveIk3D, restToDirRotationDeg, childRotationDeg } from "../../src/lib/riderPrototype/riderIk.mjs";

const TOL = 1e-6;
const D2R = Math.PI / 180;
const REST = [0, -1, 0];
const PHASES = [0, 0.25, 0.5, 0.75];

// ── mapbox-gl `rotationYZX`(:36044) 재현: R = Ry(r[1])·Rz(r[2])·Rx(r[0]) ──
const mul = (A, B) =>
  A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
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

// ── pose.mjs 와 동일한 pole 정의 (그쪽은 모듈 내부 함수라 여기 재현) ──
const kneePole = (side, hip) => [hip[0] + 0.35, hip[1] - 0.5, hip[2] + (side === "l" ? 0.02 : -0.02)];
const elbowPole = (side, sh) => [sh[0] + 0.12, sh[1] - 0.6, sh[2] + (side === "l" ? 0.06 : -0.06)];

/** 한 체인(부모+자식) 검사 행 2개 생성 */
function chainRows(phase, nodeName, root, target, pole, lenA, lenB) {
  const ik = solveIk3D(root, target, pole, lenA, lenB);
  const parentEuler = restToDirRotationDeg(ik.boneADir);
  const Rp = mapboxRotation(parentEuler);
  const childEuler = childRotationDeg(ik.boneADir, ik.boneBDir);
  const Rc = mul(Rp, mapboxRotation(childEuler)); // 자식은 부모 로컬 → world 로 되돌린다
  return [
    { phase, node: nodeName, euler: parentEuler, want: ik.boneADir, got: applyM(Rp, REST) },
    { phase, node: `${nodeName}${nodeName.startsWith("leg") ? "_shin" : "_fore"}`, euler: childEuler, want: ik.boneBDir, got: applyM(Rc, REST) },
  ];
}

function buildRows() {
  const rows = [];
  for (const phase of PHASES) {
    const crankRad = -phase * Math.PI * 2;
    for (const side of ["l", "r"]) {
      const hip = hipOf(side);
      rows.push(
        ...chainRows(phase, `leg_${side}`, hip, ankleTargetWorld(side, crankRad), kneePole(side, hip), THIGH_LEN, SHIN_LEN),
      );
      const sh = shoulderOf(side);
      rows.push(
        ...chainRows(phase, `arm_${side}`, sh, hoodOf(side), elbowPole(side, sh), UPPER_ARM_LEN, FOREARM_LEN),
      );
    }
  }
  return rows;
}

function main() {
  const verbose = process.argv.includes("--verbose");
  const rows = buildRows();
  const fails = [];
  console.log("=== verify-node-rotation — 전달 회전각 왕복 검산 (R·rest == 목표 뼈 방향) ===\n");
  console.log("  phase  node             euler [x, y, z] (deg)              목표 → 실제 오차");
  console.log("  " + "-".repeat(84));
  for (const r of rows) {
    const err = dist(r.got, r.want);
    const ok = err < TOL;
    if (!ok) fails.push(r);
    if (verbose || !ok) {
      const e = r.euler.map((v) => v.toFixed(2).padStart(8)).join(",");
      console.log(`  ${String(r.phase).padEnd(6)} ${r.node.padEnd(16)} [${e}]   ${err.toExponential(2)} ${ok ? "✔" : "✘ FAIL"}`);
    }
  }
  if (!verbose && fails.length === 0) console.log("  (전 행 통과 — 상세는 --verbose)");
  console.log(
    `\n  ${rows.length}행(8노드 × ${PHASES.length}위상) 중 통과 ${rows.length - fails.length} · 실패 ${fails.length} · 허용치 ${TOL}`,
  );
  if (fails.length) {
    console.error(
      `\n✘ FAIL — 전달되는 회전각이 목표 뼈 방향을 만들지 못한다.\n` +
        `   앱에 올리지 마라. 화면에서 팔·다리가 움직이지 않거나 엉뚱하게 돈다.\n` +
        `   riderIk.mjs 의 restToDirRotationDeg / childRotationDeg 를 의심하라` +
        `(Mapbox 는 R = Ry(e[1])·Rz(e[2])·Rx(e[0]) 로 조립한다).`,
    );
    process.exit(1);
  }
  console.log("✔ PASS — 모든 노드가 목표 뼈 방향으로 회전한다.");
}

main();
