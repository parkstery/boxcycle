import assert from "node:assert/strict";
import test from "node:test";
import { AnimationMixer } from "three";
import { Rider15Rig } from "../../src/lib/riderPrototype/rider15Rig.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { attachRider15PaletteStubMaps, loadPreservedTestGlb } from "./rider-glb-test-loader.ts";

test("좌우 엄지척은 팔을 움직이면서 다리·크랭크·바퀴 페달 위상을 보존한다", async () => {
  const id = "20261127-160608-8767e93a";
  const gltf = await loadPreservedTestGlb(id);
  attachRider15PaletteStubMaps(gltf.scene);
  const rig = new Rider15Rig(gltf, getRiderModelProfile("rider15"));
  const gestures = await loadPreservedTestGlb(id, "rider-gestures.glb");
  rig.installThumbClips(gestures.animations);
  const q = (name: string) => rig.object.getObjectByName(name)!.quaternion.clone();
  try {
    for (const side of ["left", "right"] as const) {
      rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
      const names = ["hip_L", "hip_R", "knee_L", "knee_R", "ankle_L", "ankle_R", "crank", "wheel_front", "wheel_rear"];
      const lower = names.map(q);
      const arm = q(side === "left" ? "elbow_L" : "elbow_R");
      rig.setThumbGesture(side, 1.2, `event-${side}`); rig.setPhase(0.3, 0.4);
      names.forEach((name, i) => assert.ok(q(name).angleTo(lower[i]) < 1e-7, `pedal changed ${name}`));
      assert.ok(q(side === "left" ? "elbow_L" : "elbow_R").angleTo(arm) > 0.05, "arm must gesture");
      rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
      assert.ok(q(side === "left" ? "elbow_L" : "elbow_R").angleTo(arm) < 1e-7, "arm returns to grip");
    }
  } finally { rig.dispose(); }
});

test("hi(LookHi, 11-28 복원)는 팔과 몸통을 세우면서 다리·크랭크·바퀴 위상을 보존하고, 엄지척은 몸통을 건드리지 않는다", async () => {
  const id = "20261127-160608-8767e93a";
  const gltf = await loadPreservedTestGlb(id);
  attachRider15PaletteStubMaps(gltf.scene);
  const rig = new Rider15Rig(gltf, getRiderModelProfile("rider15"));
  const gestures = await loadPreservedTestGlb(id, "rider-gestures.glb");
  assert.ok(gestures.animations.some((clip) => clip.name === "LookHi_Left") && gestures.animations.some((clip) => clip.name === "LookHi_Right"), "앱 동작 파일에 LookHi 두 클립");
  rig.installThumbClips(gestures.animations);
  const q = (name: string) => rig.object.getObjectByName(name)!.quaternion.clone();
  const lowerNames = ["pelvis", "hip_L", "hip_R", "knee_L", "knee_R", "ankle_L", "ankle_R", "crank", "wheel_front", "wheel_rear"];
  try {
    for (const side of ["left", "right"] as const) {
      rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
      const lower = lowerNames.map(q); const spine = q("spine"); const arm = q(side === "left" ? "shoulder_L" : "shoulder_R");
      rig.setThumbGesture(`hi-${side}`, 1.2, `hi-${side}`); rig.setPhase(0.3, 0.4);
      lowerNames.forEach((name, i) => assert.ok(q(name).angleTo(lower[i]) < 1e-7, `pedal changed ${name}`));
      assert.ok(q(side === "left" ? "shoulder_L" : "shoulder_R").angleTo(arm) > 0.3, "hi 팔을 든다");
      assert.ok(q("spine").angleTo(spine) > 0.01, "hi 는 상체를 세운다");
      rig.setThumbGesture(side, 1.2, `thumb-${side}`); rig.setPhase(0.3, 0.4);
      assert.ok(q("spine").angleTo(spine) < 1e-7, "엄지척은 몸통 불변(기존 동작 보존)");
      rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
      assert.ok(q(side === "left" ? "shoulder_L" : "shoulder_R").angleTo(arm) < 1e-7 && q("spine").angleTo(spine) < 1e-7, "그립 자세로 복귀");
    }
  } finally { rig.dispose(); }
});

test("11-28 동작 파일 모델 리그: hi·엄지척이 손·팔 보정 모프를 모델대로 켜고, 끝나면 주행 모양으로 돌아온다", async () => {
  const id = "20261127-160608-8767e93a";
  const gestures = await loadPreservedTestGlb(id, "rider-gestures.glb");
  attachRider15PaletteStubMaps(gestures.scene);
  const rig = new Rider15Rig(gestures, getRiderModelProfile("rider15"));
  rig.installThumbClips(gestures.animations);
  let morph: import("three").Mesh | null = null;
  rig.object.traverse((node) => { const m = node as import("three").Mesh; if (m.morphTargetDictionary?.Correct_Cheer_L_21 != null) morph = m; });
  assert.ok(morph, "동작 파일 모델에 팔 보정 모프");
  const mesh = morph as unknown as import("three").Mesh;
  const w = (name: string) => mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]];
  const lowerNames = ["pelvis", "hip_L", "knee_L", "ankle_L", "crank", "wheel_front"];
  const q = (name: string) => rig.object.getObjectByName(name)!.quaternion.clone();
  try {
    rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
    const rideCurl = w("L_Fingers_Curl"), rideHoods = w("P72_Ride_Hoods_33"), lower = lowerNames.map(q);
    assert.ok(rideCurl > 0.9 && w("Correct_Cheer_L_21") < 1e-6, "주행: 왼손 쥠, 팔 보정 꺼짐");
    rig.setThumbGesture("hi-left", 1.33, "hi-morph"); rig.setPhase(0.3, 0.4); // 손을 다 든 중간
    assert.ok(w("Correct_Cheer_L_21") > 0.95, `hi 팔 보정 켜짐 ${w("Correct_Cheer_L_21")}`);
    assert.ok(w("L_Fingers_Curl") < 0.05, `hi 왼손 펴짐 ${w("L_Fingers_Curl")}`);
    assert.ok(w("P72_Ride_Hoods_33") < 0.05, "주행 팔 보정은 꺼짐");
    lowerNames.forEach((name, i) => assert.ok(q(name).angleTo(lower[i]) < 1e-7, `pedal changed ${name}`));
    rig.setThumbGesture("left", 1.33, "thumb-morph"); rig.setPhase(0.3, 0.4);
    assert.ok(w("Correct_ThumbUp_Left_21") > 0.95 && w("L_Thumb_Up") > 0.95, "엄지척 보정·엄지 세움");
    rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
    assert.ok(Math.abs(w("L_Fingers_Curl") - rideCurl) < 1e-6 && Math.abs(w("P72_Ride_Hoods_33") - rideHoods) < 1e-6 && w("Correct_Cheer_L_21") < 1e-6, "주행 모양 복귀");
  } finally { rig.dispose(); }
});

test("11-28 주행 파일 리그에는 개수가 다른 동작 모프 값을 덮어쓰지 않는다(뼈 제스처만)", async () => {
  const id = "20261127-160608-8767e93a";
  const gltf = await loadPreservedTestGlb(id);
  attachRider15PaletteStubMaps(gltf.scene);
  const rig = new Rider15Rig(gltf, getRiderModelProfile("rider15"));
  rig.installThumbClips((await loadPreservedTestGlb(id, "rider-gestures.glb")).animations);
  const meshes: import("three").Mesh[] = [];
  rig.object.traverse((node) => { const m = node as import("three").Mesh; if (m.morphTargetInfluences?.length) meshes.push(m); });
  try {
    rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
    const before = meshes.map((m) => [...m.morphTargetInfluences!]);
    rig.setThumbGesture("hi-left", 1.33, "hi-plain"); rig.setPhase(0.3, 0.4);
    meshes.forEach((m, i) => assert.deepEqual([...m.morphTargetInfluences!], before[i]));
  } finally { rig.dispose(); }
});

test("11-28 손목 모양: 동작의 위치·크기 트랙(wristfix·elbow_volume 위치, wrist 크기)까지 클립 그대로 적용한다", async () => {
  const id = "20261127-160608-8767e93a";
  const gestures = await loadPreservedTestGlb(id, "rider-gestures.glb");
  attachRider15PaletteStubMaps(gestures.scene);
  const rig = new Rider15Rig(gestures, getRiderModelProfile("rider15"));
  rig.installThumbClips(gestures.animations);
  // 기준: 같은 모델을 클립으로 직접 재생(Babylon·Sandbox 와 같은 결과)
  const ref = gestures.scene.clone(true);
  const mixer = new AnimationMixer(ref);
  const bones = ["wristfix_cuff", "wristfix_palmE", "wristfix_palmW", "elbow_volume", "wrist", "forearmrot", "elbow"];
  try {
    for (const [key, clipName, side] of [["hi-right", "LookHi_Right", "R"], ["hi-left", "LookHi_Left", "L"], ["right", "LookThumb_Right", "R"]] as const) {
      const clip = gestures.animations.find((value) => value.name === clipName)!;
      const t = 1.2;
      const action = mixer.clipAction(clip); mixer.stopAllAction(); action.play(); action.time = t; mixer.update(0);
      rig.setThumbGesture(key, t, `wrist-${key}`); rig.setPhase(0.3, 0.4);
      let moved = 0;
      for (const base of bones) {
        const name = `${base}_${side}`;
        const got = rig.object.getObjectByName(name)!; const want = ref.getObjectByName(name)!;
        assert.ok(got.position.distanceTo(want.position) < 1e-5, `${clipName} ${name} 위치 ${got.position.distanceTo(want.position)}`);
        assert.ok(got.scale.distanceTo(want.scale) < 1e-5, `${clipName} ${name} 크기 ${got.scale.distanceTo(want.scale)}`);
        const sign = got.quaternion.dot(want.quaternion) < 0 ? -1 : 1; // q 와 -q 는 같은 회전
        const dq = Math.max(...got.quaternion.toArray().map((v, i) => Math.abs(v - sign * want.quaternion.toArray()[i])));
        assert.ok(dq < 1e-6, `${clipName} ${name} 회전 ${dq}`);
        moved = Math.max(moved, got.position.length());
      }
      assert.ok(moved > 0, "보조 뼈 위치가 있음");
      rig.setThumbGesture(null, 0); rig.setPhase(0.3, 0.4);
    }
  } finally { mixer.stopAllAction(); rig.dispose(); }
});
