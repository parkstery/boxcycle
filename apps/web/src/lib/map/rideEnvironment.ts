import type { Map as MapboxMap } from "mapbox-gl";
import { installRideQuality, parseRideQuality } from "./rideQuality";
import { installRideScenery, rideSceneryEnabled } from "./rideScenery";
import { installRideTrees, rideTreesEnabled } from "./rideTreeLayer";
import { installRideViewDistance, parseRideViewDistanceM, STANDARD_RIDE_DATA_SOURCE } from "./rideViewDistance";

/**
 * 지형 OFF 주행 화면 한 벌 — 시야 1km·나무·풍경·자동 품질 (2026-11 Chief, 지형 OFF·3D 최대).
 * 지도 컴포넌트는 켜고 끄기만 안다. 비교용 주소 스위치도 여기서만 읽는다.
 */
export type RideEnvironment = {
  /** 주행 중 · 지형 OFF 일 때만 true. */
  setActive(active: boolean): void;
  dispose(): void;
};

/** 시험 패널(`?fps=1`)의 비교 스위치. 새로고침하면 기본값(모두 켬)으로 돌아간다. */
export type RideLab = { roadsideTrees: boolean; fog: boolean };
const lab: RideLab = { roadsideTrees: true, fog: true };
let applyLab: ((next: RideLab) => void) | null = null;
export function readRideLab(): RideLab {
  return { ...lab };
}
export function setRideLab(next: Partial<RideLab>): void {
  Object.assign(lab, next);
  applyLab?.({ ...lab });
}

export function installRideEnvironment(
  map: MapboxMap,
  options: { search: string; token: string; modelBaseUrl: string; getRoute: () => readonly [number, number][] | null },
): RideEnvironment {
  const { search } = options;
  const viewDistanceM = parseRideViewDistanceM(search);
  const view = installRideViewDistance(map, viewDistanceM);
  const trees = installRideTrees(map, {
    dataSource: STANDARD_RIDE_DATA_SOURCE,
    modelBaseUrl: options.modelBaseUrl,
    getRoute: options.getRoute,
  });
  const scenery = installRideScenery(map, { viewDistanceM, token: options.token });
  const quality = installRideQuality(map, {
    fixedLevel: parseRideQuality(search),
    onLevel: (level) => {
      trees.setLimit(level.maxTrees);
      scenery.setWindows(level.windows);
    },
  });
  applyLab = (next) => {
    trees.setRoadside(next.roadsideTrees);
    scenery.setFogVisible(next.fog);
  };
  applyLab({ ...lab });
  return {
    setActive(active) {
      view.setActive(active);
      quality.setActive(active);
      trees.setActive(active && rideTreesEnabled(search));
      scenery.setActive(active && rideSceneryEnabled(search));
    },
    dispose() {
      applyLab = null;
      quality.dispose();
      scenery.dispose();
      trees.dispose();
      view.dispose();
    },
  };
}
