/**
 * s5 ↔ rider14 앱 리그 동등성 시험 (P3 · G3).
 *
 * 같은 `PreservedRiderRig` 코드로 두 후보를 8위상에서 자세 잡고 비교한다.
 * - 다리 6메시: 정점 순서가 같으므로(사전 실측) 같은 인덱스끼리 위치·법선 비교
 * - 강체 7그룹: rider14 는 형상이 단순화돼 정점 비교가 성립하지 않으므로 그룹 변환 행렬 비교
 *
 * 실행: npm run test:rider-preserve (PowerShell)
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BufferAttribute, Mesh, type Object3D } from "three";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
  testCandidateDir,
} from "./rider-glb-test-loader";

const S5_ID = "20260921-041426-cd81398e";
const RIDER14_ID = "20261015-212136-df8de090";

const LEG_PAIRS: readonly (readonly [string, string])[] = [
  ["Right continuous knee skin", "legR__Material_5"],
  ["Mesh_153", "legR__Rider_black_shorts"],
  ["Mesh_156", "legR__Rider_black_socks"],
  ["Left continuous knee skin", "legL__Material_5"],
  ["Mesh_163", "legL__Rider_black_shorts"],
  ["Mesh_166", "legL__Rider_black_socks"],
];
const RIGID_GROUPS = ["crank", "pedalR", "pedalL", "footR", "footL", "wheelFront", "wheelRear"] as const;
const PHASES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

const LEG_POS_TOL = 1e-5;
/*
 * rider14 meshopt 본은 법선을 정규화 Int8 로 저장한다(눈금 1/127 ≈ 0.45°/성분).
 * 실측 분포: 다리 6메시 중앙값 0.27–0.36°, 최대 1.11°(위상 무관 = 저장 양자화).
 * 무압축 LOD0 은 0 이다. 최대 1.5° · 중앙값 0.5° 로 묶어 양자화만 허용한다.
 */
const LEG_NORMAL_TOL_DEG = 1.5;
const LEG_NORMAL_MEDIAN_TOL_DEG = 0.5;
const MATRIX_TOL = 1e-5;
const BIND_TOL = 1e-5;

type RigInternals = {
  pedalBind: Record<"R" | "L", [number, number, number]>;
  crankPhase: Record<"R" | "L", number>;
  crankRadius: number;
};
const internals = (rig: PreservedRiderRig) => rig as unknown as RigInternals;

async function buildRig(candidateId: string, profileId: "s5" | "rider14"): Promise<PreservedRiderRig> {
  const { scene } = await loadPreservedTestGlb(candidateId);
  if (profileId === "rider14") attachPaletteStubMap(scene);
  return new PreservedRiderRig(scene, loadPreservedTestGuides(candidateId), getRiderModelProfile(profileId));
}

function meshByName(root: Object3D, name: string): Mesh {
  const found: Mesh[] = [];
  root.traverse((item) => {
    if (item instanceof Mesh && item.name === name) found.push(item);
  });
  assert.equal(found.length, 1, `mesh ${name} count`);
  return found[0]!;
}

function legDelta(a: Mesh, b: Mesh): { pos: number; normalDeg: number; normalMedianDeg: number } {
  const pa = a.geometry.getAttribute("position") as BufferAttribute;
  const pb = b.geometry.getAttribute("position") as BufferAttribute;
  const na = a.geometry.getAttribute("normal") as BufferAttribute;
  const nb = b.geometry.getAttribute("normal") as BufferAttribute;
  assert.equal(pa.count, pb.count, `${a.name}/${b.name} vertex count`);
  let pos = 0;
  const angles: number[] = [];
  for (let i = 0; i < pa.count; i++) {
    pos = Math.max(pos, Math.hypot(pa.getX(i) - pb.getX(i), pa.getY(i) - pb.getY(i), pa.getZ(i) - pb.getZ(i)));
    const dot = na.getX(i) * nb.getX(i) + na.getY(i) * nb.getY(i) + na.getZ(i) * nb.getZ(i);
    const len = Math.hypot(na.getX(i), na.getY(i), na.getZ(i)) * Math.hypot(nb.getX(i), nb.getY(i), nb.getZ(i));
    angles.push(Math.acos(Math.max(-1, Math.min(1, dot / (len || 1)))) * 180 / Math.PI);
  }
  angles.sort((x, y) => x - y);
  return { pos, normalDeg: angles[angles.length - 1]!, normalMedianDeg: angles[Math.floor((angles.length - 1) / 2)]! };
}

function matrixDelta(a: PreservedRiderRig, b: PreservedRiderRig, group: string): number {
  const ga = a.object.getObjectByName(`preserved-${group}`);
  const gb = b.object.getObjectByName(`preserved-${group}`);
  assert.ok(ga && gb, `group ${group}`);
  let max = 0;
  for (let k = 0; k < 16; k++) max = Math.max(max, Math.abs(ga.matrix.elements[k]! - gb.matrix.elements[k]!));
  return max;
}

type PhaseRow = { phase: number; legPos: number; legNormalDeg: number; legNormalMedianDeg: number; rigidMatrix: number; worstLeg: string; worstGroup: string };

function comparePhase(s5: PreservedRiderRig, r14: PreservedRiderRig, phase: number): PhaseRow {
  s5.setPhase(phase);
  r14.setPhase(phase);
  const row: PhaseRow = { phase, legPos: 0, legNormalDeg: 0, legNormalMedianDeg: 0, rigidMatrix: 0, worstLeg: "", worstGroup: "" };
  for (const [a, b] of LEG_PAIRS) {
    const d = legDelta(meshByName(s5.object, a), meshByName(r14.object, b));
    if (d.pos > row.legPos) { row.legPos = d.pos; row.worstLeg = b; }
    row.legNormalDeg = Math.max(row.legNormalDeg, d.normalDeg);
    row.legNormalMedianDeg = Math.max(row.legNormalMedianDeg, d.normalMedianDeg);
  }
  for (const group of RIGID_GROUPS) {
    const d = matrixDelta(s5, r14, group);
    if (d > row.rigidMatrix) { row.rigidMatrix = d; row.worstGroup = group; }
  }
  return row;
}

const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".out", "rider14", "p3");

describe("s5 ↔ rider14 앱 리그 동등성 (G3)", async () => {
  // 생성자가 예외 없이 끝나면 가이드 미매칭 0 이다(미매칭 시 생성자가 던진다).
  const s5 = await buildRig(S5_ID, "s5");
  const r14 = await buildRig(RIDER14_ID, "rider14");

  it("가이드 가중치 파일이 두 후보에서 바이트 동일하고, 두 리그가 가이드 미매칭 0 으로 생성된다", () => {
    assert.equal(
      sha256(path.join(testCandidateDir(S5_ID), "guide-weights.json")),
      sha256(path.join(testCandidateDir(RIDER14_ID), "guide-weights.json")),
    );
  });

  it("pedalBind · crankPhase · crankRadius 가 같고 좌우 위상차가 π 다", () => {
    const a = internals(s5);
    const b = internals(r14);
    for (const side of ["R", "L"] as const) {
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(a.pedalBind[side][k]! - b.pedalBind[side][k]!) <= BIND_TOL, `pedalBind ${side}[${k}]`);
      }
      assert.ok(Math.abs(a.crankPhase[side] - b.crankPhase[side]) <= BIND_TOL, `crankPhase ${side}`);
    }
    assert.ok(Math.abs(a.crankRadius - b.crankRadius) <= BIND_TOL, "crankRadius");
    assert.ok(Math.abs(b.crankPhase.L - b.crankPhase.R - Math.PI) <= 1e-9, "rider14 L-R = π");
  });

  it("rider14 메시가 기대 그룹 노드 아래 있다", () => {
    for (const group of RIGID_GROUPS) {
      const node = r14.object.getObjectByName(`preserved-${group}`)!;
      const meshes = node.children.filter((c) => c instanceof Mesh);
      assert.equal(meshes.length, 1, `${group} mesh count`);
      assert.ok(meshes[0]!.name.startsWith(`${group}__`), `${group} holds ${meshes[0]!.name}`);
    }
    const direct = r14.object.children.filter((c) => c instanceof Mesh).map((c) => c.name).sort();
    assert.deepEqual(direct, [
      "legL__Material_5", "legL__Rider_black_shorts", "legL__Rider_black_socks",
      "legR__Material_5", "legR__Rider_black_shorts", "legR__Rider_black_socks",
      "static__Palette",
    ]);
  });

  it("8위상에서 다리 정점·법선과 강체 그룹 행렬이 허용 오차 안이다", () => {
    const rows = PHASES.map((phase) => comparePhase(s5, r14, phase));
    console.table(rows.map((r) => ({
      phaseDeg: r.phase * 360,
      legPosM: r.legPos.toExponential(3),
      legNormalDeg: r.legNormalDeg.toFixed(4),
      legNormalMedianDeg: r.legNormalMedianDeg.toFixed(4),
      rigidMatrix: r.rigidMatrix.toExponential(3),
      worstLeg: r.worstLeg,
      worstGroup: r.worstGroup,
    })));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "equivalence.json"), `${JSON.stringify({
      s5: S5_ID, rider14: RIDER14_ID,
      tolerance: { legPosM: LEG_POS_TOL, legNormalDeg: LEG_NORMAL_TOL_DEG, legNormalMedianDeg: LEG_NORMAL_MEDIAN_TOL_DEG, rigidMatrix: MATRIX_TOL },
      rows,
    }, null, 2)}\n`);
    for (const r of rows) {
      assert.ok(r.legPos <= LEG_POS_TOL, `phase ${r.phase}: leg ${r.worstLeg} ${r.legPos}`);
      assert.ok(r.legNormalDeg <= LEG_NORMAL_TOL_DEG, `phase ${r.phase}: normal ${r.legNormalDeg}°`);
      assert.ok(r.legNormalMedianDeg <= LEG_NORMAL_MEDIAN_TOL_DEG, `phase ${r.phase}: normal median ${r.legNormalMedianDeg}°`);
      assert.ok(r.rigidMatrix <= MATRIX_TOL, `phase ${r.phase}: ${r.worstGroup} ${r.rigidMatrix}`);
    }
  });

  it("음성 대조: rider14 pedalBind.R 을 1 mm 옮기면 시험이 차이를 잡는다", async () => {
    const shifted = await buildRig(RIDER14_ID, "rider14");
    internals(shifted).pedalBind.R[0] += 0.001;
    const row = comparePhase(s5, shifted, 0.25);
    assert.ok(row.rigidMatrix > MATRIX_TOL || row.legPos > LEG_POS_TOL, `shift not detected: ${JSON.stringify(row)}`);
    shifted.dispose();
  });
});
