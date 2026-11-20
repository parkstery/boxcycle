import {
  getPointOnRouteByDistance,
  lineStringLengthMeters,
  smoothedCurveHeadingAtRouteDistanceMeters,
  type LineStringGeometry,
  type LngLat,
} from "../geo/geo";
import { rideDistanceAlongRoute } from "../geo/routeProgressMath";

const milestones = [
  { fraction: 0.25, label: "¼" },
  { fraction: 0.5, label: "HALF" },
  { fraction: 0.75, label: "¾" },
  { fraction: 1, label: "FINISH" },
] as const;

export type RideMilestone = {
  distanceM: number;
  position: LngLat;
  headingDeg: number;
  label: (typeof milestones)[number]["label"];
};

export function buildRideMilestones(
  geometry: LineStringGeometry | null,
  routeDistanceM: number | undefined,
): RideMilestone[] {
  if (!geometry || !routeDistanceM || !Number.isFinite(routeDistanceM) || routeDistanceM < 0) return [];
  const lineLengthM = lineStringLengthMeters(geometry);
  if (!(lineLengthM > 0)) return [];
  return milestones.flatMap(({ fraction, label }) => {
    const distanceM = routeDistanceM * fraction;
    const lineDistanceM = rideDistanceAlongRoute(distanceM, routeDistanceM, lineLengthM);
    const position = getPointOnRouteByDistance(geometry, lineDistanceM);
    if (!position) return [];
    const headingDeg = smoothedCurveHeadingAtRouteDistanceMeters(geometry, lineDistanceM, 4, lineLengthM);
    return [{ distanceM, position, headingDeg: headingDeg ?? 0, label }];
  });
}

export function readRideMilestoneProgress(
  plan: readonly RideMilestone[],
  previousM: number,
  distanceM: number,
): { highWaterM: number; next: RideMilestone | undefined; crossed: RideMilestone | undefined } {
  const highWaterM = Math.max(previousM, distanceM);
  return {
    highWaterM,
    next: plan.find((gate) => gate.distanceM > highWaterM),
    crossed: plan.findLast((gate) =>
      gate.label !== "FINISH" && previousM < gate.distanceM && gate.distanceM <= highWaterM),
  };
}
