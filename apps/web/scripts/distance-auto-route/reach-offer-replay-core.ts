/**
 * §2 세션 6클릭 재현 — reach-offer mock fetch
 *
 * - 직접(2-waypoint) 호출: §2 표의 directRoadMeters 반환
 * - 우회(3-waypoint) 호출: monotonically increasing, 첫 호출에서 D+60m 수렴
 */
import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  bearingFromOriginToPoint,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type AutoRouteOutcome,
  type FetchDirectionsFn,
  type LngLat,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

export const SESSION_6_START: LngLat = [127.0351, 37.5047];
export const SESSION_6_TARGET_METERS = 1000;
export const SESSION_6_PROFILE = "driving" as const;

export type Session6ClickRow = {
  id: string;
  /** raw click marker 좌표 (§2 table) */
  clickLngLat: LngLat;
  /** Mapbox Directions 실측 도로거리 (§2 table) */
  directRoadMeters: number;
  /** 기대 outcome */
  expectedOutcome: AutoRouteOutcome;
  /** 최소 provider 호출 수 */
  expectedAttemptedCalls: number;
  /** 최대 provider 호출 수 */
  maxAttemptedCalls: number;
};

/**
 * Mock FetchDirectionsFn:
 * - 직접 호출(2-waypoint): §2 표의 directRoadMeters 반환
 * - 우회 호출(3-waypoint): 단조증가, 1회에 D+60m 이상 수렴
 */
export function createSession6MockFetch(
  directRoadMeters: number,
  targetDistanceMeters: number,
): FetchDirectionsFn {
  let detourCallCount = 0;
  return async (_profile, waypoints) => {
    const startPt = waypoints[0]!;
    const endPt = waypoints[waypoints.length - 1]!;
    const bearing = bearingFromOriginToPoint(startPt, endPt);

    if (waypoints.length === 2) {
      // 직접 호출 — §2 표의 실측 도로 거리로 응답
      const farEnd = offsetLngLatByBearingMeters(startPt, bearing, directRoadMeters);
      const geometry = {
        type: "LineString" as const,
        coordinates: [startPt, farEnd] as LngLat[],
      };
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: 1200,
        snappedEnd: endPt,
        endSnapDistanceMeters: 0,
      };
    }

    // 우회 호출 — 단조증가: Math.max(accumulated, D+60) → 첫 호출에서 바로 수렴
    detourCallCount += 1;
    const deficit = targetDistanceMeters - directRoadMeters;
    const accumulated = directRoadMeters + deficit * (1 - Math.pow(0.4, detourCallCount));
    const detourLength = Math.max(accumulated, targetDistanceMeters + 60);

    const farEnd = offsetLngLatByBearingMeters(startPt, bearing, detourLength);
    const geometry = {
      type: "LineString" as const,
      coordinates: [startPt, farEnd] as LngLat[],
    };
    return {
      geometry,
      distance: lineStringLengthMeters(geometry),
      duration: 1200,
      snappedEnd: endPt,
      endSnapDistanceMeters: 0,
    };
  };
}

export async function replaySession6Click(click: Session6ClickRow) {
  const bearingDeg = bearingFromOriginToPoint(SESSION_6_START, click.clickLngLat);
  const fetchDirections = createSession6MockFetch(click.directRoadMeters, SESSION_6_TARGET_METERS);
  const searched = await searchDistanceAutoRoute({
    start: SESSION_6_START,
    targetRoadPoint: click.clickLngLat,
    profile: SESSION_6_PROFILE,
    targetDistanceMeters: SESSION_6_TARGET_METERS,
    bearingDeg,
    fetchDirections,
  });
  return searched;
}

export function assertSession6ClickExpectations(
  click: Session6ClickRow,
  searched: Awaited<ReturnType<typeof replaySession6Click>>,
): void {
  if (searched.status !== "found") {
    throw new Error(
      `${click.id}: expected found but got failed (${(searched as { message?: string }).message ?? "unknown"})`,
    );
  }
  if (searched.outcome !== click.expectedOutcome) {
    throw new Error(
      `${click.id}: outcome expected ${click.expectedOutcome} got ${searched.outcome}`,
    );
  }
  const calls = searched.diagnostics.providerCallCount;
  if (calls < click.expectedAttemptedCalls || calls > click.maxAttemptedCalls) {
    throw new Error(
      `${click.id}: providerCallCount expected ${click.expectedAttemptedCalls}..${click.maxAttemptedCalls} got ${calls}`,
    );
  }
}

export function printSession6ReplayTable(
  rows: Array<{ click: Session6ClickRow; searched: Awaited<ReturnType<typeof replaySession6Click>> }>,
): void {
  console.log(
    "id | clickLng | clickLat | directRoadM | expectedOutcome | outcome | attemptedCalls | status",
  );
  for (const { click, searched } of rows) {
    const outcome = searched.status === "found" ? searched.outcome : "-";
    const calls =
      searched.status === "found"
        ? searched.diagnostics.providerCallCount
        : (searched as { providerCallCount?: number }).providerCallCount ?? "-";
    console.log(
      [
        click.id,
        click.clickLngLat[0].toFixed(6),
        click.clickLngLat[1].toFixed(6),
        click.directRoadMeters,
        click.expectedOutcome,
        outcome,
        calls,
        searched.status,
      ].join(" | "),
    );
  }
}

export { AUTO_ROUTE_ALGORITHM_VERSION };
