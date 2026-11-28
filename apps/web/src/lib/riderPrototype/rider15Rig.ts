import {
  AnimationMixer,
  Box3,
  Group,
  LoopRepeat,
  Matrix4,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from "three";
import type { AnimationAction, AnimationClip, Object3D } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import type { Rider15ModelProfile, RiderVisualKit } from "./riderModelProfile";
import {
  RIDER_RIDE_POSTURES,
  type RiderRidePosture,
  type RiderRidePostureBlend,
} from "./riderRidePosture";
import type { PreservedRiderHandle, PreservedRiderSway, RiderGestureKey } from "./preservedRiderHandle";
import { disposeRiderObject } from "./preservedRiderRig";
import { tuneRider15HoodsClip } from "./rider15HoodsClip";

/** rider14 리그와 같은 시각 속도 — 크랭크 1회전당 바퀴 3.2회전. */
const WHEEL_REVOLUTIONS_PER_CRANK = 3.2;
const Z_AXIS = new Vector3(0, 0, 1);

export type Rider15Gltf = {
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
};

type WheelSpin =
  | {
      /** 예전 GLB — 바퀴가 별도 메시 노드다. 노드 행렬을 허브 중심으로 돌린다. */
      readonly kind: "mesh";
      readonly node: Object3D;
      /** 부모 공간의 회전 중심. 휠 노드 원점이든 지오메트리 중심이든 같은 식으로 돈다. */
      readonly pivot: Vector3;
      readonly axis: Vector3;
      readonly restMatrix: Matrix4;
    }
  | {
      /** P177 이후 — 프레임·바퀴가 스킨 메시 1개이고 바퀴는 허브 뼈다. 뼈 원점이 허브라 제자리에서 돈다. */
      readonly kind: "bone";
      readonly node: Object3D;
      readonly axis: Vector3;
      readonly restQuaternion: Quaternion;
    };

function wrapPhase(phaseRev: number): number {
  if (!Number.isFinite(phaseRev)) return 0;
  const wrapped = phaseRev % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function rotationAt(axis: Vector3, angle: number, pivot: Vector3): Matrix4 {
  const q = new Quaternion().setFromAxisAngle(axis, angle);
  return new Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new Matrix4().makeRotationFromQuaternion(q))
    .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
}

/**
 * rider15 전용 리그. 표준 glTF 스킨과 주행 클립을 사용하고,
 * 페달 위상은 클립 시간으로만 옮긴다(벽시계 시간은 쓰지 않는다).
 *
 * 좌표계는 rider14 와 같다 — +X 전진, +Y 위, m 단위, 원점이 지면.
 * 참조 런타임의 허브(앞 0.583·뒤 -0.412·y 0.33599767)가 rider14 `RIG` 와 같아
 * 고정 보정은 두지 않는다. 보정이 필요해지면 `correction` 그룹에 넣는다.
 */
export class Rider15Rig implements PreservedRiderHandle {
  readonly object = new Group();
  readonly supportsSway = false;
  /** 흔들림 타이밍용 rider14 값에 해당한다. rider15 는 흔들림을 아직 쓰지 않는다. */
  readonly crankPhaseR = 0;
  /** 시험·보고용 — 클립 길이(초)와 트랙 수. */
  readonly clipDuration: number;
  /** 첫 키 시각(초). 위상 0 이 여기에 온다. */
  readonly clipStart: number;
  readonly clipTrackCount: number;
  /** 트랙 하나의 최대 키 수(베이크 클립이면 프레임 수). */
  readonly clipKeyFrames: number;

  private readonly correction = new Group();
  private readonly root: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly action: AnimationAction;
  /** 자세별 클립 동작. GLB 에 없는 자세는 기본 클립(`profile.clipName`)으로 대신한다. */
  private readonly postureActions = new Map<RiderRidePosture, { action: AnimationAction; start: number }>();
  /** 이 GLB 가 클립으로 가진 주행 자세. 예전 후보는 Ride_Hoods 하나뿐이다. */
  readonly ridePostures: ReadonlySet<RiderRidePosture>;
  private postureWeights = new Map<AnimationAction, number>();
  private readonly wheels: readonly WheelSpin[];
  private readonly visualKit: RiderVisualKit;
  private disposed = false;
  private gestureRoot: Object3D | null = null;
  private gestureMixer: AnimationMixer | null = null;
  /** 상체 동작 뼈. 회전뿐 아니라 위치·크기도 쓴다(11-28): 손목 보조 뼈(wristfix·elbow_volume)는 위치가, wrist 는 크기가 움직여
   * 손목 모양을 만든다. 회전만 쓰면 손목 살이 주행 자세 위치로 당겨져 기형이 된다(손목 주변 최대 49 mm). */
  private readonly gestureBones: { target: Object3D; sample: Object3D; base: Quaternion; basePos: Vector3; baseScale: Vector3 }[] = [];
  private gestureActions = new Map<RiderGestureKey, { action: AnimationAction; bones: ReadonlySet<string> }>();
  /** 손·팔 보정 모프(11-28). 같은 메시(동작 파일 모델)일 때만 짝이 생긴다. */
  private readonly gestureMorphs: { target: number[]; sample: number[]; base: number[] }[] = [];
  private gestureSide: RiderGestureKey | null = null;
  private gestureElapsed = 0;
  private readonly gestureAcceptance = new Map<string, boolean>();

  constructor(gltf: Rider15Gltf, profile: Rider15ModelProfile) {
    this.object.name = "approved-preserved-rider";
    this.root = gltf.scene;
    this.correction.name = "rider15-correction";
    this.correction.add(this.root);
    this.object.add(this.correction);
    // 레이어가 커스텀 투영 행렬을 쓰므로 절두체 컬링을 끈다(rider14 리그와 같다).
    this.root.traverse((item) => {
      if (item instanceof Mesh) item.frustumCulled = false;
    });
    this.object.updateMatrixWorld(true);

    const clip = gltf.animations.find((item) => item.name === profile.clipName);
    if (!clip) throw new Error(`rider15 clip missing: ${profile.clipName}`);
    this.clipDuration = clip.duration;
    this.clipStart = clip.tracks.length === 0
      ? 0
      : Math.min(...clip.tracks.map((track) => track.times[0] ?? 0));
    this.clipTrackCount = clip.tracks.length;
    this.clipKeyFrames = clip.tracks.length === 0
      ? 0
      : Math.max(...clip.tracks.map((track) => track.times.length));

    this.mixer = new AnimationMixer(this.root);
    this.action = this.mixer.clipAction(tuneRider15HoodsClip(this.root, clip));
    this.action.setLoop(LoopRepeat, Infinity);
    this.action.clampWhenFinished = false;
    this.action.enabled = true;
    this.action.setEffectiveTimeScale(1);
    this.action.setEffectiveWeight(1);
    this.action.play();
    this.postureWeights.set(this.action, 1);

    const available = new Set<RiderRidePosture>();
    for (const name of RIDER_RIDE_POSTURES) {
      const found: AnimationClip | undefined =
        name === profile.clipName ? clip : gltf.animations.find((item) => item.name === name);
      if (!found) continue;
      available.add(name);
      if (found === clip) {
        this.postureActions.set(name, { action: this.action, start: this.clipStart });
        continue;
      }
      const action = this.mixer.clipAction(found);
      action.setLoop(LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(0);
      action.enabled = false;
      action.play();
      const start = found.tracks.length === 0 ? 0 : Math.min(...found.tracks.map((track) => track.times[0] ?? 0));
      this.postureActions.set(name, { action, start });
    }
    this.ridePostures = available;

    this.wheels = [
      this.bindWheel(profile.wheelBoneNames.front, profile.wheelNodeNames.front),
      this.bindWheel(profile.wheelBoneNames.rear, profile.wheelNodeNames.rear),
    ];
    this.visualKit = profile.createVisualKit(this.object);
    this.setPhase(0);
  }

  /** 위상을 클립 시간으로만 옮긴다. `mixer.update(0)` 이라 벽시계 시간은 흐르지 않는다. */
  setPhase(phaseRev: number, wheelPhaseRev = phaseRev * WHEEL_REVOLUTIONS_PER_CRANK): void {
    const phase = wrapPhase(phaseRev);
    // 한 회전 = 첫 키~끝 키. GLB 첫 키가 1/24s 라 0 부터 재면 회전마다 1.5% 멈칫한다.
    // 섞이는 자세 클립은 모두 같은 위상에 둔다(크랭크·페달이 어긋나지 않는다).
    for (const action of this.postureWeights.keys()) {
      const entry = [...this.postureActions.values()].find((item) => item.action === action);
      const start = entry?.start ?? this.clipStart;
      action.time = start + phase * (action.getClip().duration - start);
    }
    // mixer는 같은 위상을 다시 주면 속성을 생략할 수 있으므로 직전 상체 오버레이를 먼저 걷는다.
    for (const bone of this.gestureBones) {
      bone.target.quaternion.copy(bone.base); bone.target.position.copy(bone.basePos); bone.target.scale.copy(bone.baseScale);
    }
    for (const morph of this.gestureMorphs) for (let i = 0; i < morph.base.length; i++) morph.target[i] = morph.base[i];
    this.mixer.update(0);
    for (const bone of this.gestureBones) {
      bone.base.copy(bone.target.quaternion); bone.basePos.copy(bone.target.position); bone.baseScale.copy(bone.target.scale);
    }
    for (const morph of this.gestureMorphs) for (let i = 0; i < morph.base.length; i++) morph.base[i] = morph.target[i];
    this.applyThumbGesture();
    this.setWheels(wheelPhaseRev);
  }

  /**
   * 주행 자세를 정한다. `from`→`to` 를 `amount` 만큼 섞는다.
   * GLB 에 없는 자세는 기본 클립으로 대신한다.
   * 다음 `setPhase` 부터 반영된다.
   */
  setRidePosture(blend: RiderRidePostureBlend): void {
    const resolve = (name: RiderRidePosture): AnimationAction =>
      (this.postureActions.get(name) ?? { action: this.action }).action;
    const amount = Math.min(1, Math.max(0, Number.isFinite(blend.amount) ? blend.amount : 1));
    const weights = new Map<AnimationAction, number>();
    const from = resolve(blend.from);
    const to = resolve(blend.to);
    weights.set(from, (weights.get(from) ?? 0) + (1 - amount));
    weights.set(to, (weights.get(to) ?? 0) + amount);
    for (const [action, weight] of [...weights]) if (weight <= 1e-6) weights.delete(action);
    for (const { action } of this.postureActions.values()) {
      const weight = weights.get(action) ?? 0;
      action.enabled = weight > 0;
      action.setEffectiveWeight(weight);
    }
    if (!this.postureActions.size) {
      this.action.enabled = true;
      this.action.setEffectiveWeight(1);
    }
    this.postureWeights = weights.size ? weights : new Map([[this.action, 1]]);
  }

  /** 모델 자체 롤은 S5 에서 붙인다. 지금은 아무것도 하지 않는다. */
  setSway(_v: PreservedRiderSway): void {}

  /**
   * 상체 트랙만 별도 샘플링한다. 골반·다리·크랭크·바퀴는 페달 위상을 그대로 보존한다.
   * 엄지척(LookThumb)은 고개·목·팔만, hi(LookHi, 11-28 복원)는 상체를 세우는 동작이라 몸통(lumbar·spine·chest)도 쓴다.
   */
  installThumbClips(clips: readonly AnimationClip[]): void {
    this.gestureRoot = this.root.clone(true);
    this.gestureMixer = new AnimationMixer(this.gestureRoot);
    const arms = /^(head|neck|clavicle_[LR]|shoulder(?:_volume)?_[LR]|elbow(?:_volume)?_[LR]|forearmrot_[LR]|wrist(?:fix_(?:cuff|palmE|palmW))?_[LR])$/;
    const torso = /^(lumbar|spine|chest)$/;
    this.root.traverse((node) => {
      if (!arms.test(node.name) && !torso.test(node.name)) return;
      const sample = this.gestureRoot!.getObjectByName(node.name);
      if (sample) this.gestureBones.push({ target: node, sample, base: node.quaternion.clone(), basePos: node.position.clone(), baseScale: node.scale.clone() });
    });
    // 클립의 손·팔 보정 모프도 함께 쓴다. 주행 파일(rider.glb)은 보정 모프가 적어 개수가 다르면 짝을 만들지 않는다
    // (뼈만 적용 — 팔꿈치가 쪼그라든다). 레이어는 동작 파일이 오면 그 모델로 리그를 바꿔 끼운다.
    this.root.traverse((node) => {
      const influences = (node as Mesh).morphTargetInfluences;
      if (!influences?.length) return;
      const sample = (this.gestureRoot!.getObjectByName(node.name) as Mesh | undefined)?.morphTargetInfluences;
      if (sample && sample.length === influences.length) this.gestureMorphs.push({ target: influences, sample, base: [...influences] });
    });
    const variants: [RiderGestureKey, string, boolean][] = [
      ["left", "LookThumb_Left", false], ["right", "LookThumb_Right", false],
      ["hi-left", "LookHi_Left", true], ["hi-right", "LookHi_Right", true],
    ];
    let morphsUsed = false;
    for (const [key, clipName, withTorso] of variants) {
      const clip = clips.find((value) => value.name === clipName);
      if (!clip) continue;
      const uses = (bone: string) => arms.test(bone) || (withTorso && torso.test(bone));
      const morphCount = this.gestureMorphs[0]?.base.length ?? 0;
      // 클립 모프 트랙의 키당 값 개수가 리그 메시 모프 개수와 같을 때만(같은 모델) 쓴다.
      const boneTrack = (name: string) => name.endsWith(".quaternion") || name.endsWith(".position") || name.endsWith(".scale");
      const tracks = clip.tracks.filter((track) => (uses(track.name.split(".")[0]) && boneTrack(track.name))
        || (morphCount > 0 && track.name.endsWith(".morphTargetInfluences") && track.values.length === track.times.length * morphCount));
      if (tracks.some((track) => track.name.endsWith(".morphTargetInfluences"))) morphsUsed = true;
      const filtered = clip.clone(); filtered.tracks = tracks;
      const action = this.gestureMixer.clipAction(filtered);
      action.play(); action.enabled = false;
      this.gestureActions.set(key, { action, bones: new Set(tracks.filter((track) => boneTrack(track.name)).map((track) => track.name.split(".")[0])) });
    }
    if (!morphsUsed) this.gestureMorphs.length = 0;
  }

  setThumbGesture(side: RiderGestureKey | null, elapsedSec: number, eventId?: string): void {
    if (side && eventId && !this.gestureAcceptance.has(eventId)) {
      this.gestureAcceptance.set(eventId, this.gestureActions.has(side));
      if (this.gestureAcceptance.size > 200) this.gestureAcceptance.delete(this.gestureAcceptance.keys().next().value!);
    }
    if (eventId && !this.gestureAcceptance.get(eventId)) side = null;
    this.gestureSide = side; this.gestureElapsed = elapsedSec;
  }

  private applyThumbGesture(): void {
    if (!this.gestureMixer || !this.gestureSide) return;
    const selected = this.gestureActions.get(this.gestureSide);
    if (!selected) return;
    const duration = selected.action.getClip().duration;
    const t = this.gestureElapsed;
    if (t < 0 || t >= duration) return;
    for (const { action } of this.gestureActions.values()) action.enabled = action === selected.action;
    selected.action.time = t;
    this.gestureMixer.update(0);
    const amount = Math.min(1, t / 0.2, (duration - t) / 0.3);
    const weight = amount * amount * (3 - 2 * amount);
    // 이 동작이 움직이지 않는 뼈는 건드리지 않는다(샘플 루트의 정지 자세로 끌려가지 않게).
    for (const bone of this.gestureBones) {
      if (!selected.bones.has(bone.target.name)) continue;
      bone.target.quaternion.slerp(bone.sample.quaternion, weight);
      bone.target.position.lerp(bone.sample.position, weight);
      bone.target.scale.lerp(bone.sample.scale, weight);
    }
    for (const morph of this.gestureMorphs) for (let i = 0; i < morph.base.length; i++) morph.target[i] = morph.base[i] + (morph.sample[i] - morph.base[i]) * weight;
  }

  setVisualKind(kind: RiderVisualKind): void {
    this.visualKit.apply(kind);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gestureMixer?.stopAllAction();
    if (this.gestureRoot) this.gestureMixer?.uncacheRoot(this.gestureRoot);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    // 표준 스킨의 본 텍스처까지 해제한다.
    this.object.traverse((item) => {
      if (item instanceof SkinnedMesh) item.skeleton.dispose();
    });
    disposeRiderObject(this.object, this.visualKit);
  }

  /** 허브 뼈가 있으면 뼈로, 없으면 예전 바퀴 메시 노드로 돌린다(두 바퀴는 같은 각도). */
  private bindWheel(boneName: string, name: string): WheelSpin {
    const bone = this.root.getObjectByName(boneName);
    if (bone) {
      const parent = bone.parent;
      if (!parent) throw new Error(`rider15 wheel bone has no parent: ${boneName}`);
      const parentWorldQuat = parent.getWorldQuaternion(new Quaternion());
      const axis = Z_AXIS.clone().applyQuaternion(parentWorldQuat.invert()).normalize();
      return { kind: "bone", node: bone, axis, restQuaternion: bone.quaternion.clone() };
    }
    const node = this.root.getObjectByName(name);
    if (!node) throw new Error(`rider15 wheel node missing: ${name}`);
    const parent = node.parent;
    if (!parent) throw new Error(`rider15 wheel node has no parent: ${name}`);
    node.updateMatrix();
    const restMatrix = node.matrix.clone();
    const box = new Box3().setFromObject(node);
    if (box.isEmpty()) throw new Error(`rider15 wheel node has no geometry: ${name}`);
    const centerWorld = box.getCenter(new Vector3());
    const pivot = parent.worldToLocal(centerWorld.clone());
    const parentWorldQuat = parent.getWorldQuaternion(new Quaternion());
    const axis = Z_AXIS.clone().applyQuaternion(parentWorldQuat.invert()).normalize();
    node.matrixAutoUpdate = false;
    return { kind: "mesh", node, pivot, axis, restMatrix };
  }

  private setWheels(phase: number): void {
    const angle = -phase * Math.PI * 2;
    for (const wheel of this.wheels) {
      if (wheel.kind === "bone") {
        // 뼈 원점 = 허브. 부모 공간 축으로 돌린 뒤 원래 자세를 곱한다(위치는 그대로).
        wheel.node.quaternion.setFromAxisAngle(wheel.axis, angle).multiply(wheel.restQuaternion);
        continue;
      }
      wheel.node.matrix.copy(rotationAt(wheel.axis, angle, wheel.pivot)).multiply(wheel.restMatrix);
      wheel.node.matrixWorldNeedsUpdate = true;
    }
  }
}
