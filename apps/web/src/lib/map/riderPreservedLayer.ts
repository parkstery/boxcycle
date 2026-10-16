import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { moveLayerByRank, resolveBeforeIdByRank } from "./layerOrder";
import { isPerfLabEnabled } from "../debug/perfLab";
import {
  installRiderRenderCostProbe,
  measureRiderPose,
  measureRiderRenderFrame,
  noteRiderPerfScene,
} from "../debug/riderRenderCostProbe";
import { shouldAnimateRiderPose, shouldUseRiderLod2 } from "../rider/riderDetailLod";
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
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { RiderGlbModelSpec } from "../riderPrototype/iso2dMarker";
import {
  PRESERVED_RIDER_CUSTOM_LAYER_ID,
  PRESERVED_RIDER_MODELS,
  isRiderSwayDisabledByQuery,
  preservedRiderAssetUrl,
  resolvePreservedRiderModel,
} from "../riderPrototype/config";
import {
  PreservedRiderRig,
  type PreservedGuideData,
} from "../riderPrototype/preservedRiderRig";
import { PreservedRiderStatic } from "../riderPrototype/preservedRiderStatic";
import { getRiderModelProfile } from "../riderPrototype/riderModelProfile";
import { computeRiderSway, RiderSwayEnvelope, RiderSwaySpeedFollow } from "../riderPrototype/riderSway";
import {
  DEFAULT_AMBIENT_INTENSITY,
  DEFAULT_HEMISPHERE_INTENSITY,
  DEFAULT_KEY_INTENSITY,
  DEFAULT_KEY_POSITION,
  KEY_LIGHT_RADIUS,
  keyLightPositionFromAzimuthElevationDeg,
  registerRiderLightLabTarget,
  unregisterRiderLightLabTarget,
  type RiderLightLabState,
  type RiderLightLabTarget,
} from "../riderPrototype/riderLightRig";

/**
 * 라이더가 **레지스트리가 정한 자리**에 있는가.
 *
 * 종전에는 「스타일의 마지막 레이어인가」로 판정했다. 그러면 DEV 진단 레이어처럼
 * 라이더보다 위에 있어야 할 것이 하나라도 있으면 **매 프레임 헛되게 이동**한다.
 */
function isPreservedRiderAtRankPosition(
  map: mapboxgl.Map,
  styleLayers: readonly { id: string }[],
): boolean {
  const idx = styleLayers.findIndex((l) => l.id === PRESERVED_RIDER_CUSTOM_LAYER_ID);
  if (idx < 0) return false;
  const above = styleLayers[idx + 1]?.id;
  const want = resolveBeforeIdByRank(map, PRESERVED_RIDER_CUSTOM_LAYER_ID);
  return above === want;
}

class PreservedRiderCustomLayer implements CustomLayerInterface, RiderLightLabTarget {
  readonly id = PRESERVED_RIDER_CUSTOM_LAYER_ID;
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map: MapboxMap | null = null;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly riderRoot = new Group();
  private rig: PreservedRiderRig | null = null;
  private lod2: PreservedRiderStatic | null = null;
  private specs: readonly RiderGlbModelSpec[] = [];
  private readonly swayEnvelope = new RiderSwayEnvelope();
  private readonly swaySpeed = new RiderSwaySpeedFollow();
  private generation = 0;
  private loadState: "idle" | "loading" | "ready" | "error" = "idle";
  private loadError: string | null = null;
  private lod2State: "none" | "loading" | "ready" | "error" = "none";

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
    registerRiderLightLabTarget(this);
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
    unregisterRiderLightLabTarget(this);
    this.rig?.dispose();
    this.rig = null;
    this.lod2?.dispose();
    this.lod2 = null;
    this.riderRoot.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  setSpecs(specs: readonly RiderGlbModelSpec[]): void {
    this.specs = specs.slice();
    this.riderRoot.visible = specs.length > 0;
    /*
     * 원거리 LOD2 는 리그를 숨기고, render() 도 그 줌에서는 setPhase 를 부르지 않는다.
     * 여기서까지 매 프레임 IK 를 풀면 화면에 없는 자세에 틱을 쓴다.
     * 리그가 보이는 줌이거나 LOD2 가 아직 없으면 종전대로 위상을 반영한다.
     */
    const animatePose = shouldAnimateRiderPose(this.map?.getZoom() ?? null);
    const lod2Showing = shouldUseRiderLod2(
      this.lod2State === "ready" && this.lod2 != null,
      animatePose,
    );
    if (!lod2Showing && specs[0] && this.rig) this.rig.setPhase(specs[0].phaseRev ?? 0);
    this.map?.triggerRepaint();
  }

  getDebugState(): {
    loadState: string;
    loadError: string | null;
    hasRig: boolean;
    hasSpec: boolean;
    lod2State: "none" | "loading" | "ready" | "error";
  } {
    return {
      loadState: this.loadState,
      loadError: this.loadError,
      hasRig: this.rig != null,
      hasSpec: this.specs.length > 0,
      lod2State: this.lod2State,
    };
  }

  render(_gl: WebGL2RenderingContext, matrix: Array<number>): void {
    const map = this.map;
    const renderer = this.renderer;
    const rig = this.rig;
    if (!map || !renderer || !rig) return;
    if (this.specs.length === 0) {
      this.swayEnvelope.prune(new Set());
      this.swaySpeed.prune(new Set());
      if (isPerfLabEnabled()) noteRiderPerfScene(map.getZoom(), 0, this.lod2State);
      return;
    }

    /*
     * 2026-09-27 — 이 한 프레임의 비용을 잰다.
     * DEV 또는 `?perflab=1` 일 때만 누적하고, 그 외 운영은 콜백만 부른다.
     * 아래 루프는 **라이더 한 명마다 전체 장면을 한 번씩** 그린다. 점으로만 보이는
     * 줌에서도 그대로 돈다 — 아낄 여지를 감으로 정하지 않기 위해 먼저 재는 것이다.
     */
    installRiderRenderCostProbe();
    /*
     * 점으로만 보이는 줌에서는 **자세를 새로 풀지 않는다**(2026-09-27).
     * 실측상 렌더 비용의 40~46% 가 자세 계산이고, 그 자세는 화면에서 보이지 않는다.
     * 위상·위치 같은 상태는 바깥에서 계속 돌므로 가까이 가면 다음 프레임에 바로 맞는다.
     */
    const zoom = map.getZoom();
    const animatePose = shouldAnimateRiderPose(zoom);
    const nowMs = performance.now();
    const swayDisabledByQuery = isRiderSwayDisabledByQuery();
    const enabled = animatePose && !swayDisabledByQuery;
    const liveIds = new Set<string>();
    /*
     * envelope 감쇠는 이 render 안에서만 적분한다. MapView 주행 틱(rAF)이
     * 매 프레임 syncRiderPreservedModels → setSpecs → triggerRepaint 하므로,
     * 위상이 멈춘 뒤에도 지도는 계속 다시 그려진다. 여기서 triggerRepaint 를
     * 또 부르지 않는다.
     */
    measureRiderRenderFrame(this.specs.length, () => {
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
      if (animatePose) measureRiderPose(() => rig.setPhase(spec.phaseRev ?? 0));
      // 공용 rig 1개와 LOD2 정적 메시를 self/peer 순으로 그린다. 줌 < 19 이고 LOD2 가 있으면 정적 1콜.
      const staticRider = this.lod2;
      const useLod2 = shouldUseRiderLod2(this.lod2State === "ready" && staticRider != null, animatePose);
      if (useLod2 && staticRider) {
        rig.object.visible = false;
        staticRider.object.visible = true;
        staticRider.setVisualKind(spec.kind ?? "self");
      } else {
        if (staticRider) staticRider.object.visible = false;
        rig.object.visible = true;
        rig.setVisualKind(spec.kind ?? "self");
      }
      const env = this.swayEnvelope.update(spec.id, spec.phaseRev ?? 0, nowMs, enabled);
      const factor = this.swaySpeed.update(spec.id, spec.speedMps, nowMs);
      const sway = computeRiderSway(spec.phaseRev ?? 0, rig.crankPhaseR, env * factor);
      rig.setSway({ shaderRollRad: sway.shaderRollRad, bobM: sway.bobM });
      const bikeRoll = rig.supportsSway ? sway.bikeRollRad : 0;
      const local = new Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new Vector3(meterScale, -meterScale, meterScale))
        .multiply(new Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new Matrix4().makeRotationY(yaw))
        .multiply(new Matrix4().makeRotationX(lean + bikeRoll));
      liveIds.add(spec.id);
      this.camera.projectionMatrix.fromArray(matrix).multiply(local);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      renderer.render(this.scene, this.camera);
    }
    }, zoom, this.lod2State);
    this.swayEnvelope.prune(liveIds);
    this.swaySpeed.prune(liveIds);
  }

  private async loadApprovedCandidate(generation: number): Promise<void> {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const [gltf, response] = await Promise.all([
        loader.loadAsync(preservedRiderAssetUrl("rider.glb")),
        fetch(preservedRiderAssetUrl("guide-weights.json")),
      ]);
      if (!response.ok) throw new Error(`guide weights ${response.status}`);
      const guides = await response.json() as PreservedGuideData;
      if (generation !== this.generation || !this.map) return;
      const model = PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()];
      const rig = new PreservedRiderRig(gltf.scene, guides, getRiderModelProfile(model.profile));
      if (generation !== this.generation || !this.map) {
        rig.dispose();
        return;
      }
      this.rig?.dispose();
      this.lod2?.dispose();
      this.lod2 = null;
      this.lod2State = "none";
      this.riderRoot.clear();
      this.rig = rig;
      this.riderRoot.add(rig.object);
      this.riderRoot.visible = this.specs.length > 0;
      if (this.specs[0]) rig.setPhase(this.specs[0].phaseRev ?? 0);
      this.loadState = "ready";
      this.map.triggerRepaint();
      if ("lod2" in model) void this.loadLod2(generation, model.lod2);
    } catch (error) {
      this.loadState = "error";
      this.loadError = error instanceof Error ? error.message : String(error);
      if (import.meta.env.DEV) console.warn("[riderPreserved] candidate load failed", error);
    }
  }

  /** LOD0 가 ready 인 뒤에만 호출한다. 실패해도 리그는 그대로 둔다. */
  private async loadLod2(generation: number, fileName: "rider-lod2.glb"): Promise<void> {
    this.lod2State = "loading";
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(preservedRiderAssetUrl(fileName));
      if (generation !== this.generation || !this.map) return;
      const model = PRESERVED_RIDER_MODELS[resolvePreservedRiderModel()];
      const staticRider = new PreservedRiderStatic(gltf.scene, getRiderModelProfile(model.profile));
      if (generation !== this.generation || !this.map) {
        staticRider.dispose();
        return;
      }
      this.lod2?.dispose();
      this.lod2 = staticRider;
      staticRider.object.visible = false;
      this.riderRoot.add(staticRider.object);
      this.lod2State = "ready";
      this.map.triggerRepaint();
    } catch (error) {
      if (generation !== this.generation) return;
      this.lod2State = "error";
      if (import.meta.env.DEV) console.warn("[riderPreserved] lod2 load failed", error);
    }
  }
}

const layerByMap = new WeakMap<MapboxMap, PreservedRiderCustomLayer>();
const desiredSpecsByMap = new WeakMap<MapboxMap, readonly RiderGlbModelSpec[]>();
const appliedDesiredByMap = new WeakMap<MapboxMap, readonly RiderGlbModelSpec[]>();
const rankVerifiedByMap = new WeakMap<MapboxMap, boolean>();
const styleWatchBound = new WeakSet<MapboxMap>();
const EMPTY_RIDER_SPECS: readonly RiderGlbModelSpec[] = [];

function bindRiderLayerRankWatch(map: MapboxMap): void {
  if (styleWatchBound.has(map)) return;
  styleWatchBound.add(map);
  const invalidate = () => {
    rankVerifiedByMap.set(map, false);
  };
  map.on("styledata", invalidate);
  map.on("remove", () => {
    rankVerifiedByMap.delete(map);
    styleWatchBound.delete(map);
  });
}

function applyDesiredRiderSpecs(map: MapboxMap, layer: PreservedRiderCustomLayer): void {
  const desired = desiredSpecsByMap.get(map) ?? EMPTY_RIDER_SPECS;
  if (appliedDesiredByMap.get(map) === desired) return;
  appliedDesiredByMap.set(map, desired);
  layer.setSpecs(desired);
}

export function ensureRiderPreservedLayer(map: MapboxMap): boolean {
  bindRiderLayerRankWatch(map);
  const known = layerByMap.get(map);
  if (known && rankVerifiedByMap.get(map) === true) {
    try {
      if (map.getLayer(PRESERVED_RIDER_CUSTOM_LAYER_ID)) {
        applyDesiredRiderSpecs(map, known);
        return true;
      }
    } catch {
      /* 스타일이 빠졌으면 아래 전체 경로 */
    }
    rankVerifiedByMap.set(map, false);
  }
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
    } else if (!isPreservedRiderAtRankPosition(map, styleLayers)) {
      /*
       * 경로선(route)·내 도로망(conquest)·활동 오버레이(activity world) 등은 2D 라인
       * 레이어라 커스텀 3D 레이어의 depth 를 읽지 않는다 — 앞뒤는 **style 의 레이어 순서
       * (painter's algorithm)** 만으로 정해진다. 저 레이어들은 각자 필요할 때마다
       * 각자 필요할 때마다 순서를 다시 세운다. 종전에는 그것이 **무조건 top 이동**이라
       * 라이더보다 위로 올라가 버렸다 — 그러면 선이 라이더 몸통·헬멧을 관통해 보인다
       * (지시04 §B). 이제 저들은 `lib/map/layerOrder` 의 **자기 랭크 자리**로 가고,
       * 라이더도 같은 레지스트리를 쓴다. 이 함수는 매 프레임 호출되므로 어긋난 다음
       * 프레임에 곧바로 되돌린다.
       */
      moveLayerByRank(map, PRESERVED_RIDER_CUSTOM_LAYER_ID);
    }
    if (layer) applyDesiredRiderSpecs(map, layer);
    rankVerifiedByMap.set(map, true);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn("[riderPreserved] layer init failed", error);
    return false;
  }
}

export function syncRiderPreservedModels(map: MapboxMap, specs: readonly RiderGlbModelSpec[]): void {
  desiredSpecsByMap.set(map, specs.slice());
  ensureRiderPreservedLayer(map);
}

export function clearRiderPreservedModels(map: MapboxMap | null): void {
  if (!map) return;
  desiredSpecsByMap.set(map, EMPTY_RIDER_SPECS);
  appliedDesiredByMap.delete(map);
  const layer = layerByMap.get(map);
  if (layer) applyDesiredRiderSpecs(map, layer);
}

export function getRiderPreservedDebugState(map: MapboxMap): {
  loadState: string;
  loadError: string | null;
  hasRig: boolean;
  hasSpec: boolean;
  lod2State: "none" | "loading" | "ready" | "error";
} | null {
  return layerByMap.get(map)?.getDebugState() ?? null;
}
