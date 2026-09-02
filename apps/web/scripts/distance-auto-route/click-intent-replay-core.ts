import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  bearingFromOriginToPoint,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type AutoRouteOutcome,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
  type RouteProfile,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

export const BASELINE_ALGORITHM_VERSION = "3F-A-observe";

export type FixtureProviderOverride = {
  /** direct = 2-waypoint 직접 호출, detour = 3-waypoint 우회 호출 */
  endpointKind: "direct" | "detour";
} & (
  | { kind: "route"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
  | { kind: "throw" }
  | { kind: "too_short"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
  | { kind: "off_road"; snapDistanceMeters: number }
);

export type ClickIntentFixtureExpected = {
  status: "found" | "failed";
  outcome?: AutoRouteOutcome;
  attemptedCalls: number;
  maxAttemptedCalls?: number;
  distanceErrorM: number;
  snappedEndMissM: number | null;
  rawEndMissM: number;
  bearingErrorDeg: number;
  clippedEnd: LngLat;
  clippedEndToleranceM?: number;
  sameResult?: boolean;
  sameResultReason?: string;
};

export type ClickIntentFixture = {
  id: string;
  fixtureKind: "deterministic" | "synthetic";
  start: LngLat;
  targetRoadPoint: LngLat;
  targetDistanceMeters: number;
  profile: RouteProfile;
  baselineAlgorithm: string;
  /** 직접 경로 mock 거리(m). 미지정 시 targetDistanceMeters * defaultRouteLengthFactor */
  directRouteLengthM?: number;
  defaultRouteLengthFactor?: number;
  overrides?: FixtureProviderOverride[];
  expected: ClickIntentFixtureExpected;
};

export type ClickIntentReplayRow = {
  scenario: string;
  fixtureKind: string;
  algorithm: string;
  outcome: AutoRouteOutcome | null;
  directRoadMeters: number | null;
  endMissMeters: number | null;
  detourCalls: number | null;
  distanceErrorM: number | null;
  snappedEndMissM: number | null;
  rawEndMissM: number | null;
  bearingErrorDeg: number | null;
  attemptedCalls: number;
  ms: number;
  result: "found" | "failed";
  sameResult: boolean;
  sameResultReason?: string;
};

export function buildStraightRouteGeometry(
  origin: LngLat,
  bearingDeg: number,
  totalMeters: number,
  segments = 8,
): DirectionsRouteLike["geometry"] {
  const coords: LngLat[] = [origin];
  const step = totalMeters / segments;
  let current = origin;
  for (let i = 1; i <= segments; i += 1) {
    current = offsetLngLatByBearingMeters(current, bearingDeg, step);
    coords.push(current);
  }
  return { type: "LineString", coordinates: coords };
}

export function buildLShapedRouteGeometry(input: {
  start: LngLat;
  leg1BearingDeg: number;
  leg1Meters: number;
  leg2BearingDeg: number;
  leg2Meters: number;
}): DirectionsRouteLike["geometry"] {
  const leg1End = offsetLngLatByBearingMeters(input.start, input.leg1BearingDeg, input.leg1Meters);
  const leg2End = offsetLngLatByBearingMeters(leg1End, input.leg2BearingDeg, input.leg2Meters);
  return {
    type: "LineString",
    coordinates: [input.start, leg1End, leg2End],
  };
}

export function buildParallelOffsetRouteGeometry(input: {
  start: LngLat;
  bearingDeg: number;
  totalMeters: number;
  parallelOffsetMeters: number;
  segments?: number;
}): DirectionsRouteLike["geometry"] {
  const segments = input.segments ?? 10;
  const step = input.totalMeters / segments;
  const offsetBearing = (input.bearingDeg + 90) % 360;
  const coords: LngLat[] = [input.start];
  let current = input.start;
  for (let i = 1; i <= segments; i += 1) {
    const along = offsetLngLatByBearingMeters(current, input.bearingDeg, step);
    current = offsetLngLatByBearingMeters(along, offsetBearing, input.parallelOffsetMeters);
    coords.push(current);
  }
  return { type: "LineString", coordinates: coords };
}

export function createFixtureFetchDirections(fixture: ClickIntentFixture): FetchDirectionsFn {
  const lengthFactor = fixture.defaultRouteLengthFactor ?? 1.05;

  return async (_profile, waypoints) => {
    const start = waypoints[0]!;
    const end = waypoints[waypoints.length - 1]!;
    const isDirect = waypoints.length === 2;
    const endpointKind: "direct" | "detour" = isDirect ? "direct" : "detour";
    const override = fixture.overrides?.find((o) => o.endpointKind === endpointKind);

    if (override?.kind === "throw") {
      throw new Error("fixture provider throw");
    }

    if (isDirect && override?.kind === "off_road") {
      const routeBearing = bearingFromOriginToPoint(start, end);
      const geometry = buildStraightRouteGeometry(
        start,
        routeBearing,
        fixture.targetDistanceMeters * lengthFactor,
      );
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: 1200,
        snappedEnd: fixture.targetRoadPoint,
        endSnapDistanceMeters: override.snapDistanceMeters,
      };
    }

    if (override?.kind === "too_short") {
      const geometry = override.geometry;
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: override.duration ?? 900,
        snappedEnd: end,
        endSnapDistanceMeters: 0,
      };
    }

    if (override?.kind === "route") {
      const geometry = override.geometry;
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: override.duration ?? 1200,
        snappedEnd: end,
        endSnapDistanceMeters: 0,
      };
    }

    // 기본 직선 경로 — 2-waypoint(direct)와 3-waypoint(detour) 모두
    const routeBearing = bearingFromOriginToPoint(start, end);
    let routeLength: number;
    if (isDirect && fixture.directRouteLengthM != null) {
      routeLength = fixture.directRouteLengthM;
    } else {
      routeLength = fixture.targetDistanceMeters * lengthFactor;
    }
    const geometry = buildStraightRouteGeometry(start, routeBearing, routeLength);
    return {
      geometry,
      distance: lineStringLengthMeters(geometry),
      duration: 1200,
      snappedEnd: end,
      endSnapDistanceMeters: 0,
    };
  };
}

export async function replayClickIntentFixture(fixture: ClickIntentFixture) {
  const clickBearing = bearingFromOriginToPoint(fixture.start, fixture.targetRoadPoint);
  const fetchDirections = createFixtureFetchDirections(fixture);
  const searched = await searchDistanceAutoRoute({
    start: fixture.start,
    targetRoadPoint: fixture.targetRoadPoint,
    profile: fixture.profile,
    targetDistanceMeters: fixture.targetDistanceMeters,
    bearingDeg: clickBearing,
    fetchDirections,
  });
  return { searched, clickBearing };
}

export function formatMetric(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

export function rowsFromReplay(
  fixture: ClickIntentFixture,
  searched: Awaited<ReturnType<typeof replayClickIntentFixture>>["searched"],
): ClickIntentReplayRow[] {
  const baselineRow = buildReplayRow(fixture, fixture.baselineAlgorithm, searched);
  const currentRow = buildReplayRow(fixture, AUTO_ROUTE_ALGORITHM_VERSION, searched);
  const sameResult =
    baselineRow.result === currentRow.result &&
    baselineRow.distanceErrorM === currentRow.distanceErrorM &&
    baselineRow.rawEndMissM === currentRow.rawEndMissM &&
    baselineRow.bearingErrorDeg === currentRow.bearingErrorDeg &&
    baselineRow.attemptedCalls === currentRow.attemptedCalls;
  const sameResultReason = sameResult
    ? (fixture.expected.sameResultReason ?? "metrics match baseline")
    : "baseline·current replay metrics diverged";
  return [
    { ...baselineRow, sameResult, sameResultReason },
    { ...currentRow, sameResult, sameResultReason },
  ];
}

function buildReplayRow(
  fixture: ClickIntentFixture,
  algorithm: string,
  searched: Awaited<ReturnType<typeof replayClickIntentFixture>>["searched"],
): ClickIntentReplayRow {
  if (searched.status === "failed") {
    return {
      scenario: fixture.id,
      fixtureKind: fixture.fixtureKind,
      algorithm,
      outcome: null,
      directRoadMeters: null,
      endMissMeters: null,
      detourCalls: null,
      distanceErrorM: null,
      snappedEndMissM: null,
      rawEndMissM: null,
      bearingErrorDeg: null,
      attemptedCalls: searched.providerCallCount,
      ms: searched.searchElapsedMs,
      result: "failed",
      sameResult: false,
    };
  }

  const { diagnostics } = searched;
  return {
    scenario: fixture.id,
    fixtureKind: fixture.fixtureKind,
    algorithm,
    outcome: searched.outcome,
    directRoadMeters: searched.directRoadMeters,
    endMissMeters: searched.endMissMeters,
    detourCalls: searched.detourCalls,
    distanceErrorM: diagnostics.routeDistanceErrorMeters,
    snappedEndMissM: diagnostics.snappedClickMissMeters,
    rawEndMissM: diagnostics.rawClickMissMeters,
    bearingErrorDeg: diagnostics.actualEndBearingErrorDeg,
    attemptedCalls: diagnostics.providerCallCount,
    ms: diagnostics.searchElapsedMs,
    result: "found",
    sameResult: false,
  };
}

export function assertFixtureExpectations(
  fixture: ClickIntentFixture,
  searched: Awaited<ReturnType<typeof replayClickIntentFixture>>["searched"],
  toleranceMeters = 8,
): void {
  const { expected } = fixture;
  const effectiveTolerance = expected.clippedEndToleranceM ?? toleranceMeters;

  if (expected.status === "failed") {
    if (searched.status !== "failed") {
      throw new Error(`${fixture.id}: expected failed but got found`);
    }
    const calls = searched.providerCallCount;
    const maxCalls = expected.maxAttemptedCalls ?? expected.attemptedCalls;
    if (calls < expected.attemptedCalls || calls > maxCalls) {
      throw new Error(
        `${fixture.id}: attemptedCalls expected ${expected.attemptedCalls}..${maxCalls} got ${calls}`,
      );
    }
    return;
  }

  if (searched.status !== "found") {
    throw new Error(`${fixture.id}: expected found but got failed (${searched.message})`);
  }

  if (expected.outcome && searched.outcome !== expected.outcome) {
    throw new Error(
      `${fixture.id}: outcome expected ${expected.outcome} got ${searched.outcome}`,
    );
  }

  const { diagnostics } = searched;
  const calls = diagnostics.providerCallCount;
  const maxCalls = expected.maxAttemptedCalls ?? expected.attemptedCalls;
  if (calls < expected.attemptedCalls || calls > maxCalls) {
    throw new Error(
      `${fixture.id}: attemptedCalls expected ${expected.attemptedCalls}..${maxCalls} got ${calls}`,
    );
  }
  if (Math.abs(diagnostics.routeDistanceErrorMeters - expected.distanceErrorM) > 0.5) {
    throw new Error(
      `${fixture.id}: distanceErrorM expected ${expected.distanceErrorM} got ${diagnostics.routeDistanceErrorMeters}`,
    );
  }
  if (expected.snappedEndMissM == null) {
    if (diagnostics.snappedClickMissMeters != null) {
      throw new Error(`${fixture.id}: snappedEndMissM should be unavailable (null)`);
    }
  } else if (
    diagnostics.snappedClickMissMeters == null ||
    Math.abs(diagnostics.snappedClickMissMeters - expected.snappedEndMissM) > effectiveTolerance
  ) {
    throw new Error(
      `${fixture.id}: snappedEndMissM expected ${expected.snappedEndMissM} got ${diagnostics.snappedClickMissMeters}`,
    );
  }
  if (Math.abs(diagnostics.rawClickMissMeters - expected.rawEndMissM) > effectiveTolerance) {
    throw new Error(
      `${fixture.id}: rawEndMissM expected ${expected.rawEndMissM} got ${diagnostics.rawClickMissMeters}`,
    );
  }
  if (Math.abs(diagnostics.actualEndBearingErrorDeg - expected.bearingErrorDeg) > 2) {
    throw new Error(
      `${fixture.id}: bearingErrorDeg expected ${expected.bearingErrorDeg} got ${diagnostics.actualEndBearingErrorDeg}`,
    );
  }
  if (getDistanceMeters(searched.end, expected.clippedEnd) > effectiveTolerance) {
    throw new Error(
      `${fixture.id}: clippedEnd expected ${JSON.stringify(expected.clippedEnd)} got ${JSON.stringify(searched.end)} (${getDistanceMeters(searched.end, expected.clippedEnd).toFixed(1)}m)`,
    );
  }
}

export function printReplayTable(rows: ClickIntentReplayRow[]): void {
  console.log(
    "scenario | fixtureKind | algorithm | outcome | directRoadM | endMissM | detourCalls | distanceErrorM | snappedEndMissM | rawEndMissM | bearingErrorDeg | attemptedCalls | ms | result | sameResult",
  );
  for (const row of rows) {
    console.log(
      [
        row.scenario,
        row.fixtureKind,
        row.algorithm,
        row.outcome ?? "-",
        formatMetric(row.directRoadMeters, 0),
        formatMetric(row.endMissMeters, 0),
        row.detourCalls ?? "-",
        formatMetric(row.distanceErrorM),
        formatMetric(row.snappedEndMissM),
        formatMetric(row.rawEndMissM),
        formatMetric(row.bearingErrorDeg),
        row.attemptedCalls,
        row.ms,
        row.result,
        row.sameResult ? `true (${row.sameResultReason})` : "false",
      ].join(" | "),
    );
  }
}

export { AUTO_ROUTE_ALGORITHM_VERSION };
