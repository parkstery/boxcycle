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
/**
 * 안개 (2026-11-26 정정). SDK 3.23.1 의 안개 거리는 −20~20(화면 높이 단위)까지만 받는다 — 카메라 2 에서
 * 약 130~190m 다. 4단계에서 넣으려던 「1km 까지 맑게」(38~252)는 범위를 넘어 SDK 가 말없이 거부했고,
 * 화면에는 처음부터 Standard 기본 안개(약 100m 부터 흰색)가 보였다. 끄기는 색을 투명하게 해서 한다.
 */
const FOG_OFF_COLOR = "rgba(255, 255, 255, 0)";

/** 「안개 끔」 — 하늘(높은 곳 색·우주 색 등)은 원래 안개 설정 그대로 두고, 덮는 색만 투명하게. */
export function rideFogOff(original: FogSpecification | null | undefined): FogSpecification {
  return { ...(original ?? { range: [0.5, 10] }), color: FOG_OFF_COLOR };
}

/** 시험 패널 표시. */
export function rideFogText(fog: FogSpecification | null | undefined): string {
  if (!fog) return "안개 없음";
  if (fog.color === FOG_OFF_COLOR) return "안개 끔";
  return "안개 켬(Mapbox 기본, 약 100m~)";
}

type Host = MapboxMap & { version?: string };

export type RideSceneryController = {
  setActive(active: boolean): void;
  setWindows(on: boolean): void;
  setFogVisible(on: boolean): void;
  dispose(): void;
};

const NOOP: RideSceneryController = { setActive() {}, setWindows() {}, setFogVisible() {}, dispose() {} };

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
  /** 끈 동안만 값이 있다 — 켜면(기본) 처음 안개로 돌려놓는다. */
  let fog: { original: FogSpecification | null | undefined } | null = null;
  let fogResetNoted = false;
  let fogVisible = true;
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
    if (fogVisible) {
      restoreFog();
      return;
    }
    const current = map.getFog();
    if (fog && current?.color === FOG_OFF_COLOR) return;
    // 다른 곳에서 안개를 되돌렸으면 다시 끈다.
    if (fog && !fogResetNoted) console.info("[rideScenery] 안개가 바뀌어 다시 끕니다.");
    if (fog) fogResetNoted = true;
    fog = { original: fog ? fog.original : current };
    map.setFog(rideFogOff(fog.original));
    if (map.getFog()?.color !== FOG_OFF_COLOR) console.warn("[rideScenery] SDK 가 안개 끄기를 받지 않았습니다.");
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
    setWindows: buildings.setWindows,
    setFogVisible(on) {
      fogVisible = on;
    },
    dispose() {
      stop();
    },
  };
}
