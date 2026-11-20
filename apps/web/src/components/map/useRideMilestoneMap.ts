import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { LineStringGeometry } from "../../lib/geo/geo";
import { RideMilestoneLayer, type RideMilestonePresentation } from "../../lib/map/rideMilestoneLayer";
import { buildRideMilestones, readRideMilestoneProgress } from "../../lib/route/rideMilestones";
import "./rideMilestone.css";

const APPROACH_M = 120;
const FINISH_APPROACH_M = 180;
const CROSSING_LIFETIME_MS = 1150;
const EMPTY_FRAME: RideMilestonePresentation = {};

export type RideMilestoneProgress = {
  distanceM: number;
  startOffsetM: number;
  arrivalStartedAt: number | null;
};

export function useRideMilestoneMap(
  mapRef: RefObject<MapboxMap | null>,
  mapLoaded: boolean,
  geometry: LineStringGeometry | null,
  routeDistanceM: number | undefined,
  progress: RideMilestoneProgress | null | undefined,
  reducedMotion: boolean,
) {
  const layerRef = useRef<RideMilestoneLayer | null>(null);
  const plan = useMemo(() => buildRideMilestones(geometry, routeDistanceM), [geometry, routeDistanceM]);
  const cursor = useRef({
    plan,
    highWaterM: 0,
    crossing: undefined as RideMilestonePresentation["crossing"],
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;
    const layer = new RideMilestoneLayer(map);
    layerRef.current = layer;
    return () => {
      layerRef.current = null;
      layer.dispose();
    };
  }, [mapLoaded, mapRef]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (!progress || !plan.length) {
      cursor.current = { plan, highWaterM: 0, crossing: undefined };
      layer.update(EMPTY_FRAME, reducedMotion);
      return;
    }
    if (cursor.current.plan !== plan || cursor.current.highWaterM < progress.startOffsetM) {
      cursor.current = { plan, highWaterM: progress.startOffsetM, crossing: undefined };
    }
    const { distanceM, arrivalStartedAt } = progress;
    const now = performance.now();
    const result = readRideMilestoneProgress(plan, cursor.current.highWaterM, distanceM);
    const finish = plan.at(-1);
    const arrival = arrivalStartedAt != null && finish?.label === "FINISH"
      ? { gate: finish, startedAt: arrivalStartedAt }
      : undefined;
    let crossing = cursor.current.crossing;
    if (crossing && now - crossing.startedAt >= CROSSING_LIFETIME_MS) crossing = undefined;
    if (result.crossed && !arrival && !reducedMotion) crossing = { gate: result.crossed, startedAt: now };
    cursor.current = { plan, highWaterM: result.highWaterM, crossing };
    const remainingM = result.next ? result.next.distanceM - distanceM : Infinity;
    const showAtM = result.next?.label === "FINISH" ? FINISH_APPROACH_M : APPROACH_M;
    const next = !arrival && result.next && remainingM <= showAtM ? { gate: result.next, remainingM } : undefined;
    layer.update({ next, crossing, arrival }, reducedMotion);
  }, [mapLoaded, plan, progress, reducedMotion]);
}
