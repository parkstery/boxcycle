/**
 * rider15 전용 리그 시험 (S2).
 *
 * GLB 는 neighbouring 테스트와 같은 `rider-glb-test-loader` 로 연다.
 * 실행: node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs \
 *   --test scripts/rider-preserve/rider15-rig.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AnimationClip, Bone, Box3, DataTexture, Group, Mesh, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3 } from "three";
import { RiderRidePostureFollow, RIDER_RIDE_POSTURE_BLEND_MS } from "../../src/lib/riderPrototype/riderRidePosture.ts";
import {
  PRESERVED_RIDER_ACTIVE_MODEL,
  PRESERVED_RIDER_MODELS,
  resolvePreservedRiderModel,
} from "../../src/lib/riderPrototype/config.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { RiderPaletteKit } from "../../src/lib/riderPrototype/riderPaletteKit.ts";
import { Rider15Rig } from "../../src/lib/riderPrototype/rider15Rig.ts";
import { attachRider15PaletteStubMaps, loadPreservedTestGlb } from "./rider-glb-test-loader.ts";

const RIDER15_ID = "20261111-025600-ad1d669d";
const POSE_BONES = ["crank", "foot_L", "foot_R"] as const;

async function buildRig(): Promise<Rider15Rig> {
  const { scene, animations } = await loadPreservedTestGlb(RIDER15_ID);
  attachRider15PaletteStubMaps(scene);
  return new Rider15Rig({ scene, animations }, getRiderModelProfile("rider15"));
}

/** Node 에는 캔버스가 없으므로 키트 텍스처를 미리 넣어 apply 경로만 확인한다. */
function injectPeerKitForTests(rig: Rider15Rig): void {
  let injected = false;
  rig.object.traverse((item) => {
    if (injected || !(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (!material) continue;
      const kit = RiderPaletteKit.ofMaterialForTests(material);
      if (!kit) continue;
      kit.injectKitTextureForTests(
        "peer",
        new DataTexture(new Uint8Array(64 * 1024 * 4), 64, 1024),
      );
      injected = true;
      return;
    }
  });
  assert.ok(injected, "rider15 palette kit missing");
}

function nodeOf(rig: Rider15Rig, name: string) {
  const found = rig.object.getObjectByName(name);
  assert.ok(found, `missing node ${name}`);
  return found;
}

function matricesOf(rig: Rider15Rig, names: readonly string[]): number[] {
  rig.object.updateMatrixWorld(true);
  const out: number[] = [];
  for (const name of names) {
    const node = nodeOf(rig, name);
    node.updateMatrixWorld(true);
    out.push(...node.matrixWorld.elements);
  }
  return out;
}

function wheelMatrices(rig: Rider15Rig): number[] {
  return [
    ...matricesOf(rig, ["P67_FrontWheel"]),
    ...matricesOf(rig, ["P67_RearWheel"]),
  ];
}

function maxDiff(a: readonly number[], b: readonly number[]): number {
  assert.equal(a.length, b.length, "vector length");
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]! - b[i]!));
  return max;
}

function positionOf(rig: Rider15Rig, name: string): Vector3 {
  rig.object.updateMatrixWorld(true);
  return nodeOf(rig, `${name}`).getWorldPosition(new Vector3());
}

describe("rider15-rig", () => {
  it("GLB 가 로드되고 rig 가 서며 Ride_Hoods 클립을 찾는다", async () => {
    const rig = await buildRig();
    try {
      assert.ok(rig.object.getObjectByName("P67_FrontWheel"), "front wheel node");
      assert.ok(rig.object.getObjectByName("P67_RearWheel"), "rear wheel node");
      assert.ok(rig.clipDuration > 0, `clip duration ${rig.clipDuration}`);
      assert.equal(rig.clipTrackCount, 59, "Ride_Hoods track count");
      assert.ok(rig.clipKeyFrames > 0, `clip key frames ${rig.clipKeyFrames}`);
      assert.equal(rig.supportsSway, false);
      assert.equal(rig.crankPhaseR, 0);
      assert.doesNotThrow(() => rig.setSway({ shaderRollRad: 0.2, bobM: 0.01 }));
      injectPeerKitForTests(rig);
      assert.doesNotThrow(() => rig.setVisualKind("peer"));
    } finally {
      rig.dispose();
    }
  });

  it("회전 이음매가 매끄럽다 — 위상 0 에서 멈칫하지 않고 끝이 처음으로 이어진다", async () => {
    const rig = await buildRig();
    try {
      const footAt = (phase: number) => {
        rig.setPhase(phase);
        return positionOf(rig, "foot_L");
      };
      const step = 1 / 64;
      const mid = footAt(0.5).distanceTo(footAt(0.5 + step));
      const afterStart = footAt(0).distanceTo(footAt(step));
      const beforeEnd = footAt(1 - step).distanceTo(footAt(0));
      console.log("[rider15-rig] seam", { clipStart: rig.clipStart, mid, afterStart, beforeEnd });
      assert.ok(mid > 1e-3, `foot must move mid-stroke: ${mid}`);
      // 한 걸음 이동량이 회전 내내 비슷해야 한다(멈칫이면 0, 건너뜀이면 2배 이상).
      assert.ok(afterStart > mid * 0.5 && afterStart < mid * 1.6, `hold or jump after start: ${afterStart} vs ${mid}`);
      assert.ok(beforeEnd > mid * 0.5 && beforeEnd < mid * 1.6, `hold or jump before end: ${beforeEnd} vs ${mid}`);
    } finally {
      rig.dispose();
    }
  });

  it("setPhase(0) 과 setPhase(0.5) 는 발·크랭크 자세가 다르다", async () => {
    const rig = await buildRig();
    try {
      rig.setPhase(0);
      const pose0 = matricesOf(rig, POSE_BONES);
      const foot0 = positionOf(rig, "foot_L");
      const crank0 = nodeOf(rig, "crank").quaternion.clone();

      rig.setPhase(0.5);
      const pose5 = matricesOf(rig, POSE_BONES);
      rig.object.updateMatrixWorld(true);
      const foot5 = positionOf(rig, "foot_L");
      const crank5 = nodeOf(rig, "crank").quaternion.clone();

      assert.ok(foot0.distanceTo(foot5) > 0.05, `foot moved ${foot0.distanceTo(foot5)} m`);
      assert.ok(new Quaternion().copy(crank0).angleTo(crank5) > 0.2, "crank rotation changed");
      assert.ok(maxDiff(pose0, pose5) > 0.05, "bone matrices changed");
    } finally {
      rig.dispose();
    }
  });

  it("setPhase(0) 과 setPhase(1) 은 같은 자세다", async () => {
    const rig = await buildRig();
    try {
      rig.setPhase(0);
      const pose0 = matricesOf(rig, POSE_BONES);
      const wheels0 = wheelMatrices(rig);

      rig.setPhase(1);
      const pose1 = matricesOf(rig, POSE_BONES);
      const wheels1 = wheelMatrices(rig);

      assert.ok(maxDiff(pose0, pose1) <= 1e-9, `pose drift ${maxDiff(pose0, pose1)}`);
      assert.ok(maxDiff(wheels0, wheels1) <= 1e-9, `wheel drift ${maxDiff(wheels0, wheels1)}`);
    } finally {
      rig.dispose();
    }
  });

  it("같은 위상을 다시 주면 시간이 흐르지 않는다", async () => {
    const rig = await buildRig();
    try {
      rig.setPhase(0.25);
      const first = [...matricesOf(rig, POSE_BONES), ...wheelMatrices(rig)];
      rig.setPhase(0.25);
      const second = [...matricesOf(rig, POSE_BONES), ...wheelMatrices(rig)];
      assert.ok(maxDiff(first, second) <= 1e-9, `phase drift ${maxDiff(first, second)}`);
    } finally {
      rig.dispose();
    }
  });

  it("바퀴 노드가 위상에 따라 돌고 0/1 에서 제자리다", async () => {
    const rig = await buildRig();
    try {
      rig.setPhase(0);
      const front0 = matricesOf(rig, ["P67_FrontWheel"]);
      const rear0 = matricesOf(rig, ["P67_RearWheel"]);

      rig.setPhase(0.25);
      const front25 = matricesOf(rig, ["P67_FrontWheel"]);
      const rear25 = matricesOf(rig, ["P67_RearWheel"]);

      assert.ok(maxDiff(front0, front25) > 1e-3, "front wheel did not turn");
      assert.ok(maxDiff(rear0, rear25) > 1e-3, "rear wheel did not turn");
    } finally {
      rig.dispose();
    }
  });

  it("방향·단위·접지: 앞바퀴 +X, 허브 y≈0.336 m, 타이어 바닥 y≈0", async () => {
    const rig = await buildRig();
    try {
      rig.setPhase(0);
      rig.object.updateMatrixWorld(true);
      const front = new Box3().setFromObject(nodeOf(rig, "P67_FrontWheel"));
      const rear = new Box3().setFromObject(nodeOf(rig, "P67_RearWheel"));
      const frontCenter = front.getCenter(new Vector3());
      const rearCenter = rear.getCenter(new Vector3());
      const frontSize = front.getSize(new Vector3());
      console.log("[rider15-rig] measured", {
        clipDuration: rig.clipDuration,
        clipKeyFrames: rig.clipKeyFrames,
        clipTrackCount: rig.clipTrackCount,
        frontCenter: frontCenter.toArray(),
        rearCenter: rearCenter.toArray(),
        frontSize: frontSize.toArray(),
        frontBottomY: front.min.y,
        rearBottomY: rear.min.y,
      });

      assert.ok(frontCenter.x > rearCenter.x + 0.8, `front ${frontCenter.x} rear ${rearCenter.x}`);
      assert.ok(Math.abs(frontCenter.y - rearCenter.y) < 0.02, "hub y mismatch");
      assert.ok(frontCenter.y > 0.2 && frontCenter.y < 0.5, `hub y ${frontCenter.y}`);
      assert.ok(frontSize.y > 0.5 && frontSize.y < 0.9, `wheel diameter ${frontSize.y}`);
      assert.ok(Math.abs(front.min.y) < 0.05, `front tyre bottom ${front.min.y}`);
      assert.ok(Math.abs(rear.min.y) < 0.05, `rear tyre bottom ${rear.min.y}`);
      assert.deepEqual(rig.object.position.toArray(), [0, 0, 0]);
      assert.deepEqual(rig.object.scale.toArray(), [1, 1, 1]);
    } finally {
      rig.dispose();
    }
  });

  it("P177 구조: 바퀴가 허브 뼈면 두 뼈가 같은 각도로 제자리에서 돈다(프레임+바퀴 메시 1개)", () => {
    // 실제 GLB 대신 같은 노드 구조를 만든다: P72_BikeRoll 아래 허브 뼈 2개, 바퀴 메시 노드는 없다.
    const scene = new Group();
    const bikeRoll = new Object3D();
    bikeRoll.name = "P72_BikeRoll";
    scene.add(bikeRoll);
    const hubs = { wheel_front: [0.583, 0.336, 0.00057], wheel_rear: [-0.412, 0.336, 0.00057] } as const;
    for (const [name, at] of Object.entries(hubs)) {
      const bone = new Bone();
      bone.name = name;
      bone.position.fromArray(at);
      bikeRoll.add(bone);
    }
    const profile = {
      ...getRiderModelProfile("rider15"),
      createVisualKit: () => ({ apply: () => {}, dispose: () => {} }),
    };
    const rig = new Rider15Rig({ scene, animations: [new AnimationClip("Ride_Hoods", 1, [])] }, profile);
    try {
      const front = nodeOf(rig, "wheel_front");
      const rear = nodeOf(rig, "wheel_rear");
      rig.setPhase(0);
      const q0 = front.quaternion.clone();
      rig.setPhase(0.1);
      // 0.1 위상 = 0.32 회전. 두 바퀴는 같은 각도, Z 축(진행 방향 기준 바퀴 축)으로 돈다.
      const turned = q0.angleTo(front.quaternion);
      assert.ok(Math.abs(turned - 0.32 * Math.PI * 2) < 1e-6 || Math.abs(turned - (2 * Math.PI - 0.32 * Math.PI * 2)) < 1e-6, `front angle ${turned}`);
      assert.ok(front.quaternion.angleTo(rear.quaternion) < 1e-9, "front/rear must share one angle");
      assert.ok(Math.abs(front.quaternion.x) < 1e-9 && Math.abs(front.quaternion.y) < 1e-9, "spin axis must be Z");
      assert.deepEqual(front.position.toArray(), [...hubs.wheel_front], "hub stays put");
      assert.deepEqual(rear.position.toArray(), [...hubs.wheel_rear], "hub stays put");
      rig.setPhase(1);
      assert.ok(front.quaternion.angleTo(q0) < 1e-9, "phase 1 == phase 0");
    } finally {
      rig.dispose();
    }
  });

  it("주행 자세 전환: Hoods↔Sprint 클립을 섞고, 없는 자세는 기본 클립으로 대신한다", () => {
    const scene = new Group();
    const bikeRoll = new Object3D();
    bikeRoll.name = "P72_BikeRoll";
    scene.add(bikeRoll);
    for (const [name, x] of [["wheel_front", 0.583], ["wheel_rear", -0.412]] as const) {
      const bone = new Bone();
      bone.name = name;
      bone.position.set(x, 0.336, 0);
      bikeRoll.add(bone);
    }
    // 두 자세의 자전거 롤을 고정값으로 둔 시험 클립(Hoods 0°, Sprint 15°). Aero 는 없다.
    const roll = (deg: number) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), deg * Math.PI / 180);
    const clip = (name: string, deg: number) => new AnimationClip(name, 2, [
      new QuaternionKeyframeTrack("P72_BikeRoll.quaternion", [0, 2], [...roll(deg).toArray(), ...roll(deg).toArray()]),
    ]);
    const profile = {
      ...getRiderModelProfile("rider15"),
      createVisualKit: () => ({ apply: () => {}, dispose: () => {} }),
    };
    const rig = new Rider15Rig({ scene, animations: [clip("Ride_Hoods", 0), clip("Ride_Sprint", 15)] }, profile);
    try {
      const node = nodeOf(rig, "P72_BikeRoll");
      const rollDeg = () => new Quaternion().angleTo(node.quaternion) * 180 / Math.PI;
      assert.deepEqual([...rig.ridePostures].sort(), ["Ride_Hoods", "Ride_Sprint"]);
      rig.setPhase(0.3);
      assert.ok(rollDeg() < 1e-6, `hoods roll ${rollDeg()}`);
      rig.setRidePosture({ from: "Ride_Sprint", to: "Ride_Sprint", amount: 1 });
      rig.setPhase(0.3);
      assert.ok(Math.abs(rollDeg() - 15) < 1e-4, `sprint roll ${rollDeg()}`);
      rig.setRidePosture({ from: "Ride_Hoods", to: "Ride_Sprint", amount: 0.5 });
      rig.setPhase(0.3);
      assert.ok(Math.abs(rollDeg() - 7.5) < 1e-3, `half blend roll ${rollDeg()}`);
      rig.setRidePosture({ from: "Ride_Aero", to: "Ride_Aero", amount: 1 });
      rig.setPhase(0.3);
      assert.ok(rollDeg() < 1e-6, `missing Aero falls back to Hoods: ${rollDeg()}`);
    } finally {
      rig.dispose();
    }
  });

  it("자세 전환 상태: 처음은 바로, 바뀌면 600 ms 동안 섞고, 끝나면 새 자세 하나", () => {
    const follow = new RiderRidePostureFollow();
    assert.deepEqual(follow.update("a", undefined, 0), { from: "Ride_Hoods", to: "Ride_Hoods", amount: 1 });
    assert.deepEqual(follow.update("a", "Ride_Sprint", 1000), { from: "Ride_Hoods", to: "Ride_Sprint", amount: 0 });
    const mid = follow.update("a", "Ride_Sprint", 1000 + RIDER_RIDE_POSTURE_BLEND_MS / 2);
    assert.ok(Math.abs(mid.amount - 0.5) < 1e-9, `mid ${mid.amount}`);
    assert.deepEqual(follow.update("a", "Ride_Sprint", 1000 + RIDER_RIDE_POSTURE_BLEND_MS), { from: "Ride_Sprint", to: "Ride_Sprint", amount: 1 });
    assert.deepEqual(follow.update("b", "Ride_Sprint", 0), { from: "Ride_Sprint", to: "Ride_Sprint", amount: 1 });
    follow.prune(new Set(["b"]));
    assert.deepEqual(follow.update("a", "Ride_Aero", 5000), { from: "Ride_Aero", to: "Ride_Aero", amount: 1 });
  });

  it("등록은 rider15 를 DEV 후보로만 추가하고 기본 활성 모델은 rider14 다", () => {
    assert.equal(PRESERVED_RIDER_ACTIVE_MODEL, "rider14");
    assert.equal(resolvePreservedRiderModel(), "rider14");
    assert.equal(PRESERVED_RIDER_MODELS.rider15.candidateId, RIDER15_ID);
    assert.equal(PRESERVED_RIDER_MODELS.rider15.lod2, "rider-lod2.glb");
    assert.equal(getRiderModelProfile("rider15").id, "rider15");
    assert.equal(getRiderModelProfile("rider14").id, "rider14");
  });
});
