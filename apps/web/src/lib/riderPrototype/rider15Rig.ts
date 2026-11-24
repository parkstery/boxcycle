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
import type { PreservedRiderHandle, PreservedRiderSway } from "./preservedRiderHandle";
import { disposeRiderObject } from "./preservedRiderRig";

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
 * rider15 전용 리그. 표준 glTF 스킨과 `Ride_Hoods` 클립을 그대로 쓰고,
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
  private readonly clip: AnimationClip;
  private readonly mixer: AnimationMixer;
  private readonly action: AnimationAction;
  private readonly wheels: readonly WheelSpin[];
  private readonly visualKit: RiderVisualKit;
  private disposed = false;

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
    this.clip = clip;
    this.clipDuration = clip.duration;
    this.clipStart = clip.tracks.length === 0
      ? 0
      : Math.min(...clip.tracks.map((track) => track.times[0] ?? 0));
    this.clipTrackCount = clip.tracks.length;
    this.clipKeyFrames = clip.tracks.length === 0
      ? 0
      : Math.max(...clip.tracks.map((track) => track.times.length));

    this.mixer = new AnimationMixer(this.root);
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(LoopRepeat, Infinity);
    this.action.clampWhenFinished = false;
    this.action.enabled = true;
    this.action.setEffectiveTimeScale(1);
    this.action.setEffectiveWeight(1);
    this.action.play();

    this.wheels = [
      this.bindWheel(profile.wheelBoneNames.front, profile.wheelNodeNames.front),
      this.bindWheel(profile.wheelBoneNames.rear, profile.wheelNodeNames.rear),
    ];
    this.visualKit = profile.createVisualKit(this.object);
    this.setPhase(0);
  }

  /** 위상을 클립 시간으로만 옮긴다. `mixer.update(0)` 이라 벽시계 시간은 흐르지 않는다. */
  setPhase(phaseRev: number): void {
    const phase = wrapPhase(phaseRev);
    // 한 회전 = 첫 키~끝 키. GLB 첫 키가 1/24s 라 0 부터 재면 회전마다 1.5% 멈칫한다.
    this.action.time = this.clipStart + phase * (this.clip.duration - this.clipStart);
    this.mixer.update(0);
    this.setWheels(phase);
  }

  /** 모델 자체 롤은 S5 에서 붙인다. 지금은 아무것도 하지 않는다. */
  setSway(_v: PreservedRiderSway): void {}

  setVisualKind(kind: RiderVisualKind): void {
    this.visualKit.apply(kind);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
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
    const angle = -phase * Math.PI * 2 * WHEEL_REVOLUTIONS_PER_CRANK;
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
