import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from "three";
import type { Object3D } from "three";

/** 원본 Ride_Hoods의 차체 롤 ±1°를 ±0.2°로 줄인다. */
const BIKE_ROLL_SCALE = 0.2;
const SAMPLE_STEPS = 128;
const CONTACT_CHAINS = [
  ["shoulder_L", "elbow_L", "wrist_L"],
  ["shoulder_R", "elbow_R", "wrist_R"],
  ["hip_L", "knee_L", "ankle_L"],
  ["hip_R", "knee_R", "ankle_R"],
] as const;

function setWorldRotation(node: Object3D, rotation: Quaternion): void {
  node.quaternion.copy(node.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));
}

function aimJoint(joint: Object3D, child: Object3D, target: Vector3): void {
  const origin = joint.getWorldPosition(new Vector3());
  const from = child.getWorldPosition(new Vector3()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const rotation = new Quaternion().setFromUnitVectors(from, to);
  setWorldRotation(joint, rotation.multiply(joint.getWorldQuaternion(new Quaternion())));
}

/** 원본 굽힘 방향을 유지하면서 두 관절을 접점까지 맞춘다. */
function fitLimb(root: Object3D, joint: Object3D, end: Object3D, target: Vector3): void {
  const origin = root.getWorldPosition(new Vector3());
  const bend = joint.getWorldPosition(new Vector3());
  const tip = end.getWorldPosition(new Vector3());
  const upper = origin.distanceTo(bend);
  const lower = bend.distanceTo(tip);
  const axis = target.clone().sub(origin);
  const distance = axis.length();
  if (distance < 1e-8) return;
  axis.divideScalar(distance);
  const pole = bend.sub(origin);
  pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const reach = Math.min(upper + lower, Math.max(Math.abs(upper - lower), distance));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const newBend = origin.clone().addScaledVector(axis, along).addScaledVector(pole, height);
  aimJoint(root, joint, newBend);
  aimJoint(joint, end, target);
}

/** 원본 몸통 궤적과 차체 기준 손발 접점을 사용해 재생용 Hoods 클립을 준비한다. */
export function tuneRider15HoodsClip(scene: Object3D, clip: AnimationClip): AnimationClip {
  const rollTrack = clip.tracks.find((track) => track.name === "P72_BikeRoll.quaternion");
  if (clip.name !== "Ride_Hoods" || !(rollTrack instanceof QuaternionKeyframeTrack)) return clip;

  // 샘플링은 복제본에서 수행한다. 실제 리그나 GLB 트랙은 건드리지 않는다.
  const sample = scene.clone(true);
  const bike = sample.getObjectByName("P72_BikeRoll");
  const pelvis = sample.getObjectByName("pelvis");
  const chains: [Object3D, Object3D, Object3D][] = [];
  for (const [a, b, c] of CONTACT_CHAINS) {
    const root = sample.getObjectByName(a);
    const joint = sample.getObjectByName(b);
    const end = sample.getObjectByName(c);
    if (!root || joint?.parent !== root || end?.parent !== joint) return clip;
    chains.push([root, joint, end]);
  }
  if (!bike || !pelvis?.parent) return clip;

  const rotating = [bike, pelvis, ...chains.flat()];
  const values = rotating.map(() => [] as number[]);
  const pelvisPositions: number[] = [];
  const start = Math.min(...clip.tracks.map((track) => track.times[0]!));
  const times = Array.from({ length: SAMPLE_STEPS + 1 }, (_, i) => start + i / SAMPLE_STEPS * (clip.duration - start));
  const mixer = new AnimationMixer(sample);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  for (const time of times) {
    mixer.setTime(time);
    const originalQuaternions = rotating.map((node) => node.quaternion.clone());
    const originalPelvisPosition = pelvis.position.clone();
    const pelvisPosition = pelvis.getWorldPosition(new Vector3());
    const pelvisRotation = pelvis.getWorldQuaternion(new Quaternion());
    const oldBikeRotation = bike.getWorldQuaternion(new Quaternion());
    const contacts = chains.map(([, , end]) => ({
      position: bike.worldToLocal(end.getWorldPosition(new Vector3())),
      rotation: end.getWorldQuaternion(new Quaternion()).premultiply(oldBikeRotation.clone().invert()),
    }));

    bike.quaternion.identity().slerp(originalQuaternions[0]!, BIKE_ROLL_SCALE);
    const newBikeRotation = bike.getWorldQuaternion(new Quaternion());
    pelvis.position.copy(pelvis.parent.worldToLocal(pelvisPosition));
    setWorldRotation(pelvis, pelvisRotation);
    chains.forEach(([root, joint, end], i) => {
      const contact = contacts[i]!;
      fitLimb(root, joint, end, bike.localToWorld(contact.position));
      setWorldRotation(end, contact.rotation.premultiply(newBikeRotation));
    });

    pelvisPositions.push(...pelvis.position.toArray());
    rotating.forEach((node, i) => values[i]!.push(...node.quaternion.toArray()));
    rotating.forEach((node, i) => node.quaternion.copy(originalQuaternions[i]!));
    pelvis.position.copy(originalPelvisPosition);
  }

  const replacements = [
    new VectorKeyframeTrack("pelvis.position", times, pelvisPositions),
    ...rotating.map((node, i) => new QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values[i]!)),
  ];
  const replaced = new Set(replacements.map((track) => track.name));
  return new AnimationClip(
    clip.name,
    clip.duration,
    [...clip.tracks.filter((track) => !replaced.has(track.name)), ...replacements],
    clip.blendMode,
  );
}
