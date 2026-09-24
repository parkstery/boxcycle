import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { MercatorCoordinate } from "mapbox-gl";
import {
  AmbientLight,
  Camera,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RiderGlbModelSpec } from "./iso2dMarker";
import {
  PRESERVED_RIDER_CUSTOM_LAYER_ID,
  preservedRiderAssetUrl,
} from "./config";
import {
  PreservedRiderRig,
  type PreservedGuideData,
} from "./preservedRiderRig";

/**
 * 조명 조절판(`?lightlab=1`, 지시02) 전용 상태 — Ambient·Hemisphere·Key 강도 + Key 방향(방위각·고도각).
 * 기본값은 이 파일에 원래 하드코딩돼 있던 값과 동일하다 — **제품 기본값은 불변**.
 */
export type RiderLightLabState = {
  ambient: number;
  hemisphere: number;
  keyIntensity: number;
  keyAzimuthDeg: number;
  keyElevationDeg: number;
};

const DEFAULT_AMBIENT_INTENSITY = 0.9;
const DEFAULT_HEMISPHERE_INTENSITY = 1.2;
const DEFAULT_KEY_INTENSITY = 1.6;
const DEFAULT_KEY_POSITION = new Vector3(-3, 8, 5);
const KEY_LIGHT_RADIUS = DEFAULT_KEY_POSITION.length();

/** Key 위치 → (방위각, 고도각) — 조절판 초기 슬라이더 값을 기존 `(-3, 8, 5)`에서 역산한다. */
function keyLightAzimuthElevationDeg(pos: Vector3): { azimuthDeg: number; elevationDeg: number } {
  const r = pos.length() || 1;
  const clampedSin = Math.min(1, Math.max(-1, pos.y / r));
  return {
    azimuthDeg: ((Math.atan2(pos.x, pos.z) * 180) / Math.PI + 360) % 360,
    elevationDeg: (Math.asin(clampedSin) * 180) / Math.PI,
  };
}

/** (방위각, 고도각, 반지름) → Key 위치 — 조절판 슬라이더를 씬에 즉시 반영할 때 쓰는 역변환. */
function keyLightPositionFromAzimuthElevationDeg(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number,
): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const y = radius * Math.sin(el);
  const horizontal = radius * Math.cos(el);
  return new Vector3(horizontal * Math.sin(az), y, horizontal * Math.cos(az));
}

const DEFAULT_KEY_AZIMUTH_ELEVATION = keyLightAzimuthElevationDeg(DEFAULT_KEY_POSITION);

export const RIDER_LIGHT_LAB_DEFAULT_STATE: RiderLightLabState = {
  ambient: DEFAULT_AMBIENT_INTENSITY,
  hemisphere: DEFAULT_HEMISPHERE_INTENSITY,
  keyIntensity: DEFAULT_KEY_INTENSITY,
  keyAzimuthDeg: DEFAULT_KEY_AZIMUTH_ELEVATION.azimuthDeg,
  keyElevationDeg: DEFAULT_KEY_AZIMUTH_ELEVATION.elevationDeg,
};

/** 조절판 「값 복사」용 — 강도만 다루는 프로덕션 코드(`key.position.set(...)`)와 같은 좌표계. */
export function riderLightLabKeyPosition(state: RiderLightLabState): { x: number; y: number; z: number } {
  const p = keyLightPositionFromAzimuthElevationDeg(state.keyAzimuthDeg, state.keyElevationDeg, KEY_LIGHT_RADIUS);
  return { x: p.x, y: p.y, z: p.z };
}

class PreservedRiderCustomLayer implements CustomLayerInterface {
  readonly id = PRESERVED_RIDER_CUSTOM_LAYER_ID;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map: MapboxMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly riderRoot = new Group();
  private rig: PreservedRiderRig | null = null;
  private specs: readonly RiderGlbModelSpec[] = [];
  private generation = 0;
  private loadState: "idle" | "loading" | "ready" | "error" = "idle";
  private loadError: string | null = null;

  // 조절판이 강도·방향만 갱신할 수 있도록 광원 참조를 잡아 둔다(지시02 — 렌더 구조는 그대로).
  private readonly ambientLight = new AmbientLight(0xffffff, DEFAULT_AMBIENT_INTENSITY);
  private readonly hemisphereLight = new HemisphereLight(0xdcecff, 0x657080, DEFAULT_HEMISPHERE_INTENSITY);
  private readonly keyLight = new DirectionalLight(0xffffff, DEFAULT_KEY_INTENSITY);

  constructor() {
    this.scene.add(this.riderRoot);
    this.keyLight.position.copy(DEFAULT_KEY_POSITION);
    this.scene.add(this.ambientLight);
    this.scene.add(this.hemisphereLight);
    this.scene.add(this.keyLight);
    liveRiderLightLabLayers.add(this);
    if (riderLightLabOverrideState) this.applyLightLabState(riderLightLabOverrideState);
  }

  /** 조절판(`?lightlab=1`) 전용 진입점 — 강도·Key 방향만 갱신, 다음 프레임에 반영. */
  applyLightLabState(state: RiderLightLabState): void {
    this.ambientLight.intensity = state.ambient;
    this.hemisphereLight.intensity = state.hemisphere;
    this.keyLight.intensity = state.keyIntensity;
    this.keyLight.position.copy(
      keyLightPositionFromAzimuthElevationDeg(state.keyAzimuthDeg, state.keyElevationDeg, KEY_LIGHT_RADIUS),
    );
    this.map?.triggerRepaint();
  }

  onAdd(map: MapboxMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true,
    });
    /**
     * 출력 색공간을 **명시적으로** 고정한다 — three 의 기본값에 기대지 않는다.
     * r152 에서 기본값이 Linear → sRGB 로 바뀌었고, 0.134 를 쓰던 시절 이 코드는
     * 그 기본값에 의존하고 있었다. 2026-09-25 에 0.134 → 0.186 으로 올리면서
     * 라이더 색이 조용히 달라지는 경로가 되었으므로, 다음 업그레이드에서 또
     * 흔들리지 않도록 여기서 선언한다. 값을 바꾸려면 화면을 보고 바꿔라.
     */
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.autoClear = false;
    this.loadState = "loading";
    this.loadError = null;
    void this.loadApprovedCandidate(++this.generation);
  }

  onRemove(): void {
    this.generation++;
    liveRiderLightLabLayers.delete(this);
    this.rig?.dispose();
    this.rig = null;
    this.riderRoot.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  setSpecs(specs: readonly RiderGlbModelSpec[]): void {
    this.specs = specs.slice();
    this.riderRoot.visible = specs.length > 0;
    if (specs[0] && this.rig) this.rig.setPhase(specs[0].phaseRev ?? 0);
    this.map?.triggerRepaint();
  }

  getDebugState(): { loadState: string; loadError: string | null; hasRig: boolean; hasSpec: boolean } {
    return {
      loadState: this.loadState,
      loadError: this.loadError,
      hasRig: this.rig != null,
      hasSpec: this.specs.length > 0,
    };
  }

  render(_gl: WebGL2RenderingContext, matrix: Array<number>): void {
    const map = this.map;
    const renderer = this.renderer;
    if (!map || !renderer || this.specs.length === 0 || !this.rig) return;

    renderer.resetState();
    for (const spec of this.specs) {
      const [lng, lat] = spec.lngLat;
      let altitude: number;
      try {
        altitude = map.queryTerrainElevation({ lng, lat }, { exaggerated: false }) ?? 0;
      } catch {
        altitude = 0;
      }
      const coordinate = MercatorCoordinate.fromLngLat({ lng, lat }, altitude);
      const meterScale = coordinate.meterInMercatorCoordinateUnits();
      const yaw = (90 - spec.bearingDeg) * Math.PI / 180;
      const lean = (spec.leanDeg ?? 0) * Math.PI / 180;
      const local = new Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new Vector3(meterScale, -meterScale, meterScale))
        .multiply(new Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new Matrix4().makeRotationY(yaw))
        .multiply(new Matrix4().makeRotationX(lean));
      this.rig.setPhase(spec.phaseRev ?? 0);
      this.camera.projectionMatrix.fromArray(matrix).multiply(local);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      renderer.render(this.scene, this.camera);
    }
  }

  private async loadApprovedCandidate(generation: number): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const [gltf, response] = await Promise.all([
        loader.loadAsync(preservedRiderAssetUrl("rider.glb")),
        fetch(preservedRiderAssetUrl("guide-weights.json")),
      ]);
      if (!response.ok) throw new Error(`guide weights ${response.status}`);
      const guides = await response.json() as PreservedGuideData;
      if (generation !== this.generation || !this.map) return;
      const rig = new PreservedRiderRig(gltf.scene, guides);
      if (generation !== this.generation || !this.map) {
        rig.dispose();
        return;
      }
      this.rig?.dispose();
      this.riderRoot.clear();
      this.rig = rig;
      this.riderRoot.add(rig.object);
      this.riderRoot.visible = this.specs.length > 0;
      if (this.specs[0]) rig.setPhase(this.specs[0].phaseRev ?? 0);
      this.loadState = "ready";
      this.map.triggerRepaint();
    } catch (error) {
      this.loadState = "error";
      this.loadError = error instanceof Error ? error.message : String(error);
      if (import.meta.env.DEV) console.warn("[riderPreserved] candidate load failed", error);
    }
  }
}

const layerByMap = new WeakMap<MapboxMap, PreservedRiderCustomLayer>();
const desiredSpecsByMap = new WeakMap<MapboxMap, readonly RiderGlbModelSpec[]>();

// 조절판(`?lightlab=1`) 전용 — 살아 있는 레이어 전체에 즉시 반영 + 이후 생성되는 레이어의 초기값.
const liveRiderLightLabLayers = new Set<PreservedRiderCustomLayer>();
let riderLightLabOverrideState: RiderLightLabState | null = null;

/** 조절판 전용 진입점. 화면의 모든 preserved 레이어에 즉시 반영한다 — 재로드·재시작 불필요. */
export function setRiderLightLabState(state: RiderLightLabState): void {
  riderLightLabOverrideState = state;
  for (const layer of liveRiderLightLabLayers) layer.applyLightLabState(state);
}

export function ensureRiderPreservedLayer(map: MapboxMap): boolean {
  let styleLayers: ReadonlyArray<{ id: string }> | undefined;
  try {
    styleLayers = map.getStyle()?.layers;
    if (!styleLayers?.length) return false;
  } catch {
    return false;
  }
  try {
    let layer = layerByMap.get(map);
    if (!map.getLayer(PRESERVED_RIDER_CUSTOM_LAYER_ID)) {
      layer?.onRemove();
      layer = new PreservedRiderCustomLayer();
      layerByMap.set(map, layer);
      map.addLayer(layer);
    } else if (styleLayers[styleLayers.length - 1]?.id !== PRESERVED_RIDER_CUSTOM_LAYER_ID) {
      /*
       * 경로선(route)·내 도로망(conquest)·활동 오버레이(activity world) 등은 2D 라인
       * 레이어라 커스텀 3D 레이어의 depth 를 읽지 않는다 — 앞뒤는 **style 의 레이어 순서
       * (painter's algorithm)** 만으로 정해진다. 저 레이어들은 각자 필요할 때마다
       * `addLayer`(beforeId 없음)·`moveLayer`(top)로 스스로를 최상단에 올리며 라이더보다
       * 위로 올라가 버린다 — 그러면 선이 라이더 몸통·헬멧을 관통해 보인다(지시04 §B).
       * 이 함수는 매 프레임 호출되므로, 라이더가 최상단이 아니게 된 다음 프레임에
       * 곧바로 되돌려 항상 라이더가 선을 가리게 한다.
       */
      try {
        map.moveLayer(PRESERVED_RIDER_CUSTOM_LAYER_ID);
      } catch {
        /* noop */
      }
    }
    layer?.setSpecs(desiredSpecsByMap.get(map) ?? []);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[riderPreserved] layer init failed", error);
    return false;
  }
}

export function syncRiderPreservedModels(map: MapboxMap, specs: readonly RiderGlbModelSpec[]): void {
  desiredSpecsByMap.set(map, specs.slice());
  if (!ensureRiderPreservedLayer(map)) return;
  layerByMap.get(map)?.setSpecs(specs);
}

export function clearRiderPreservedModels(map: MapboxMap | null): void {
  if (!map) return;
  desiredSpecsByMap.set(map, []);
  layerByMap.get(map)?.setSpecs([]);
}

export function getRiderPreservedDebugState(map: MapboxMap): {
  loadState: string;
  loadError: string | null;
  hasRig: boolean;
  hasSpec: boolean;
} | null {
  return layerByMap.get(map)?.getDebugState() ?? null;
}
