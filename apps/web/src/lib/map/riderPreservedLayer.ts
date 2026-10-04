import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { moveLayerByRank, resolveBeforeIdByRank } from "./layerOrder";
import {
  installRiderRenderCostProbe,
  measureRiderPose,
  measureRiderRenderFrame,
} from "../debug/riderRenderCostProbe";
import { shouldAnimateRiderPose } from "../rider/riderDetailLod";
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
import type { RiderGlbModelSpec } from "../riderPrototype/iso2dMarker";
import {
  PRESERVED_RIDER_CUSTOM_LAYER_ID,
  preservedRiderAssetUrl,
} from "../riderPrototype/config";
import {
  PreservedRiderRig,
  type PreservedGuideData,
} from "../riderPrototype/preservedRiderRig";
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
    const rig = this.rig;
    if (!map || !renderer || this.specs.length === 0 || !rig) return;

    /*
     * 2026-09-27 — 이 한 프레임의 비용을 잰다(DEV 전용, 운영은 콜백만 부른다).
     * 아래 루프는 **라이더 한 명마다 전체 장면을 한 번씩** 그린다. 점으로만 보이는
     * 줌에서도 그대로 돈다 — 아낄 여지를 감으로 정하지 않기 위해 먼저 재는 것이다.
     */
    installRiderRenderCostProbe();
    /*
     * 점으로만 보이는 줌에서는 **자세를 새로 풀지 않는다**(2026-09-27).
     * 실측상 렌더 비용의 40~46% 가 자세 계산이고, 그 자세는 화면에서 보이지 않는다.
     * 위상·위치 같은 상태는 바깥에서 계속 돌므로 가까이 가면 다음 프레임에 바로 맞는다.
     */
    const animatePose = shouldAnimateRiderPose(map.getZoom());
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
      const local = new Matrix4()
        .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
        .scale(new Vector3(meterScale, -meterScale, meterScale))
        .multiply(new Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new Matrix4().makeRotationY(yaw))
        .multiply(new Matrix4().makeRotationX(lean));
      if (animatePose) measureRiderPose(() => rig.setPhase(spec.phaseRev ?? 0));
      // 공용 rig 1개를 self/peer 순으로 그리므로, 그리기 직전에 컬러 키트만 맞춘다.
      rig.setVisualKind(spec.kind ?? "self");
      this.camera.projectionMatrix.fromArray(matrix).multiply(local);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      renderer.render(this.scene, this.camera);
    }
    });
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
