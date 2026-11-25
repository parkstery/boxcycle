import type { FogSpecification, Map as MapboxMap } from "mapbox-gl";
import { createRideBuildings } from "./rideBuildings";
import { computeRidgeProfile, createRidgeLayer, loadRidgeElevation, RIDE_RIDGE_LAYER, type RidgeProfile } from "./rideRidge";
import { RIDE_VIEW_DISTANCE_SDK_VERSION } from "./rideViewDistance";

/**
 * 지형 OFF 주행의 풍경 — 건물 외관·안개와 하늘·먼 산 능선 (2026-11-25 Chief, 4단계 「모두 적용」).
 * 주행 중·지형 OFF·낮은 카메라에서만 켜고, 벗어나면 원래 지도로 되돌린다.
 */
const CHECK_MS = 500;
const MIN_PITCH_DEG = 60;
const MIN_ZOOM = 15;
/** 능선을 다시 계산하는 이동 거리. */
const RIDGE_MOVE_M = 600;
const RIDGE_RETRY_MS = 60_000;
const SLICE_MS = 4;
/** 시야 거리에 대한 안개 시작·끝. SDK 는 지수식이라 끝을 시야보다 멀리 둬야 시야 끝에서 약 90% 가 된다. */
const FOG_START_RATIO = 0.25;
const FOG_END_RATIO = 1.59;
/** SDK 안개 거리의 0 은 화면 중심이고, 카메라에서 중심까지가 이 값이다(fov 36.87° 고정). */
const FOG_CENTER_UNITS = 1.5;

/**
 * 안개 거리의 단위는 「화면 높이만큼의 거리」다. Standard 기본값은 카메라 2 에서 약 120m 부터
 * 건물을 하얗게 덮어 시야 1km 를 가렸다 — 실제 미터로 정한다.
 */
export function rideFogRange(unitM: number, viewDistanceM: number): [number, number] {
  const at = (m: number): number => m / unitM - FOG_CENTER_UNITS;
  return [at(viewDistanceM * FOG_START_RATIO), at(viewDistanceM * FOG_END_RATIO)];
}

function rideFog(unitM: number, viewDistanceM: number): FogSpecification {
  return {
    range: rideFogRange(unitM, viewDistanceM),
    color: "hsla(208, 62%, 91%, 0.95)",
    "high-color": "hsl(208, 78%, 80%)",
    "space-color": "hsl(212, 82%, 68%)",
    "horizon-blend": 0.07,
    "star-intensity": 0,
    "vertical-range": [80, 400],
  };
}

type Host = MapboxMap & { version?: string; transform?: { height: number; pixelsPerMeter: number } };

export type RideSceneryController = { setActive(active: boolean): void; dispose(): void };

const NOOP: RideSceneryController = { setActive() {}, dispose() {} };

/** `?ridelook=0` 이면 4단계 풍경 없이 비교한다. */
export function rideSceneryEnabled(search: string | null | undefined): boolean {
  return new URLSearchParams(search ?? "").get("ridelook") !== "0";
}

export function installRideScenery(map: MapboxMap, options: { viewDistanceM: number; token: string }): RideSceneryController {
  const host = map as Host;
  if (host.version !== RIDE_VIEW_DISTANCE_SDK_VERSION || options.viewDistanceM <= 0) return NOOP;

  const buildings = createRideBuildings(map);
  let active = false;
  let timer: number | null = null;
  let fog: { original: FogSpecification | null | undefined; unitM: number } | null = null;
  let ridge: RidgeProfile | null = null;
  let ridgeAt: [number, number] | null = null;
  let ridgeBlockedUntil = 0;
  let ridgeRun = 0;
  let ridgeBusy = false;
  let warned = false;

  const restoreFog = (): void => {
    if (!fog) return;
    const { original } = fog;
    fog = null;
    map.setFog(original ?? null);
  };
  const applyFog = (): void => {
    const t = host.transform;
    if (!t) return;
    const unitM = t.height / t.pixelsPerMeter;
    // 카메라를 바꾸면 단위가 달라진다. 작은 흔들림에는 다시 정하지 않는다.
    if (fog && Math.abs(unitM / fog.unitM - 1) < 0.08) return;
    fog = { original: fog ? fog.original : map.getFog(), unitM };
    map.setFog(rideFog(unitM, options.viewDistanceM));
  };

  const removeRidge = (): void => {
    if (map.getLayer(RIDE_RIDGE_LAYER)) map.removeLayer(RIDE_RIDGE_LAYER);
  };
  const runProfile = (job: Generator<void, RidgeProfile, void>, run: number): void => {
    if (run !== ridgeRun) return;
    const until = performance.now() + SLICE_MS;
    for (;;) {
      const step = job.next();
      if (step.done) {
        ridge = step.value;
        ridgeBusy = false;
        map.triggerRepaint();
        return;
      }
      if (performance.now() >= until) break;
    }
    window.setTimeout(() => runProfile(job, run), 16);
  };
  const requestRidge = (here: [number, number]): void => {
    if (ridgeBusy || performance.now() < ridgeBlockedUntil) return;
    const moved = ridgeAt
      ? Math.hypot((here[0] - ridgeAt[0]) * 111_320 * Math.cos((here[1] * Math.PI) / 180), (here[1] - ridgeAt[1]) * 110_540)
      : Infinity;
    if (moved < RIDGE_MOVE_M) return;
    ridgeBusy = true;
    const run = ++ridgeRun;
    loadRidgeElevation(here, options.token).then(
      (elevation) => {
        if (run !== ridgeRun) return;
        ridgeAt = here;
        runProfile(computeRidgeProfile(here, elevation), run);
      },
      (err: unknown) => {
        if (run !== ridgeRun) return;
        ridgeBusy = false;
        // 요청이 실패하면 되풀이하지 않고 1분 뒤에 다시 본다. 먼저 그린 능선은 그대로 둔다.
        ridgeBlockedUntil = performance.now() + RIDGE_RETRY_MS;
        console.warn("[rideScenery] 능선 표고를 받지 못했습니다.", err);
      },
    );
  };
  const applyRidge = (): void => {
    const c = map.getCenter();
    requestRidge([c.lng, c.lat]);
    if (ridge && !map.getLayer(RIDE_RIDGE_LAYER)) map.addLayer(createRidgeLayer(map, options.viewDistanceM, () => ridge));
  };

  const restore = (): void => {
    try {
      buildings.restore();
      restoreFog();
      removeRidge();
    } catch {
      /* 스타일 교체 중이면 함께 사라진다 */
    }
  };
  /** 낮 지도만 — 저녁 지도에 낮 하늘·능선 색을 얹지 않는다. */
  const isDay = (): boolean => map.getConfigProperty("basemap", "lightPreset") !== "dusk";

  const check = (): void => {
    if (!active || document.hidden) return;
    try {
      const low = map.getPitch() >= MIN_PITCH_DEG && map.getZoom() >= MIN_ZOOM && !map.getTerrain();
      if (!low || !buildings.apply()) {
        restore();
        return;
      }
      if (isDay()) {
        applyFog();
        applyRidge();
      } else {
        restoreFog();
        removeRidge();
      }
    } catch (err) {
      if (!warned) console.warn("[rideScenery] 준비 대기", err);
      warned = true;
    }
  };
  /** 스타일이 새로 로드되면 안개·레이어가 함께 사라졌다 — 다음 점검에서 다시 적용한다. */
  const onStyleLoad = (): void => {
    fog = null;
  };
  const stop = (): void => {
    active = false;
    map.off("style.load", onStyleLoad);
    if (timer != null) window.clearInterval(timer);
    timer = null;
    ridgeRun += 1;
    ridgeBusy = false;
  };
  return {
    setActive(next) {
      if (active === next) return;
      if (!next) {
        stop();
        restore();
        return;
      }
      active = true;
      warned = false;
      map.on("style.load", onStyleLoad);
      timer = window.setInterval(check, CHECK_MS);
      check();
    },
    dispose() {
      stop();
    },
  };
}
