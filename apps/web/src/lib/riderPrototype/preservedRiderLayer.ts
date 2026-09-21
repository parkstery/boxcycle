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

  constructor() {
    this.scene.add(this.riderRoot);
    this.scene.add(new AmbientLight(0xffffff, 1.25));
    this.scene.add(new HemisphereLight(0xdcecff, 0x657080, 1.7));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 8, 5);
    this.scene.add(key);
  }

  onAdd(map: MapboxMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true,
    });
    this.renderer.autoClear = false;
    this.loadState = "loading";
    this.loadError = null;
    void this.loadApprovedCandidate(++this.generation);
  }

  onRemove(): void {
    this.generation++;
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

export function ensureRiderPreservedLayer(map: MapboxMap): boolean {
  try {
    if (!map.getStyle()?.layers?.length) return false;
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
