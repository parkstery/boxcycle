import { useMemo } from "react";
import type { LngLat } from "../../lib/geo";

export type RouteDockStopId = "start" | "wp-0" | "wp-1" | "wp-2" | "end";

export type RouteDockStop = {
  id: RouteDockStopId;
  kind: "start" | "waypoint" | "end";
  label: string;
  loading: boolean;
  lngLat: LngLat;
  waypointIndex?: number;
};

type UseRouteDockStopsInput = {
  startLngLat: LngLat | null;
  endLngLat: LngLat | null;
  routeWaypoints: LngLat[];
  startLabel: string;
  endLabel: string;
  waypointLabels: string[];
};

export function useRouteDockStops(input: UseRouteDockStopsInput): RouteDockStop[] {
  const {
    startLngLat,
    endLngLat,
    routeWaypoints,
    startLabel,
    endLabel,
    waypointLabels,
  } = input;

  return useMemo(() => {
    const stops: RouteDockStop[] = [];
    if (startLngLat) {
      stops.push({
        id: "start",
        kind: "start",
        label: startLabel,
        loading: startLabel === "주소 불러오는 중…",
        lngLat: startLngLat,
      });
    }
    routeWaypoints.forEach((lngLat, i) => {
      const label = waypointLabels[i] ?? "…";
      stops.push({
        id: `wp-${i}` as RouteDockStopId,
        kind: "waypoint",
        label,
        loading: label === "주소 불러오는 중…",
        lngLat,
        waypointIndex: i,
      });
    });
    if (endLngLat) {
      stops.push({
        id: "end",
        kind: "end",
        label: endLabel,
        loading: endLabel === "주소 불러오는 중…",
        lngLat: endLngLat,
      });
    }
    return stops;
  }, [startLngLat, endLngLat, routeWaypoints, startLabel, endLabel, waypointLabels]);
}
