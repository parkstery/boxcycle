import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  buildClickSurroundingEndpoints,
  bearingFromOriginToPoint,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
  type RouteProfile,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

export const BASELINE_ALGORITHM_VERSION = "3F-A-observe";

export type FixtureProviderOverride = {
  /** direct = raw click, ring = click 주변 ring endpoint */
  endpointKind: "direct" | "ring";
  ringRadiusM?: number;
  ringBearingDeg?: number;
} & (
  | { kind: "route"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
  | { kind: "throw" }
  | { kind: "too_short"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
  | { kind: "off_road"; snapDistanceMeters: number }
);

export type ClickIntentFixtureExpected = {
  status: "found" | "failed";
  attemptedCalls: number;
  distanceErrorM: number;
  snappedEndMissM: number | null;
  rawEndMissM: number;
  bearingErrorDeg: number;
  clippedEnd: LngLat;
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
  defaultRouteLengthFactor?: number;
  overrides?: FixtureProviderOverride[];
  expected: ClickIntentFixtureExpected;
};

export type ClickIntentReplayRow = {
  scenario: string;
  fixtureKind: string;
  algorithm: string;
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

function ringEndpoint(
  center: LngLat,
  radiusM: number,
  bearingDeg: number,
): LngLat {
  const ring = buildClickSurroundingEndpoints(center);
  return (
    ring.find(
      (point) =>
        Math.abs(getDistanceMeters(center, point) - radiusM) < 2 &&
        Math.abs(bearingFromOriginToPoint(center, point) - bearingDeg) < 5,
    ) ?? ring[0]!
  );
}

function matchEndpoint(
  fixture: ClickIntentFixture,
  end: LngLat,
): { kind: "direct" } | { kind: "ring"; radiusM: number; bearingDeg: number } | null {
  if (getDistanceMeters(end, fixture.targetRoadPoint) < 1) {
    return { kind: "direct" };
  }
  for (const radius of [25, 75] as const) {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315] as const) {
      const ringPoint = ringEndpoint(fixture.targetRoadPoint, radius, bearing);
      if (getDistanceMeters(end, ringPoint) < 1) {
        return { kind: "ring", radiusM: radius, bearingDeg: bearing };
      }
    }
  }
  return null;
}

function findOverride(
  fixture: ClickIntentFixture,
  end: LngLat,
): FixtureProviderOverride | undefined {
  const matched = matchEndpoint(fixture, end);
  if (!matched) return undefined;
  return fixture.overrides?.find((item) => {
    if (item.endpointKind === "direct" && matched.kind === "direct") return true;
    if (
      item.endpointKind === "ring" &&
      matched.kind === "ring" &&
      (item.ringRadiusM == null || item.ringRadiusM === matched.radiusM) &&
      (item.ringBearingDeg == null || item.ringBearingDeg === matched.bearingDeg)
    ) {
      return true;
    }
    return false;
  });
}

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

  return async (_profile, start, end) => {
    const override = findOverride(fixture, end);
    if (override?.kind === "throw") {
      throw new Error("fixture provider throw");
    }

    if (override?.kind === "off_road") {
      const routeBearing = bearingFromOriginToPoint(start, end);
      const geometry = buildStraightRouteGeometry(
        start,
        routeBearing,
        fixture.targetDistanceMeters * lengthFactor,
      );
      const snapped = ringEndpoint(fixture.targetRoadPoint, 25, 0);
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: 1200,
        snappedEnd: snapped,
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
  if (expected.status === "failed") {
    if (searched.status !== "failed") {
      throw new Error(`${fixture.id}: expected failed but got found`);
    }
    if (searched.providerCallCount !== expected.attemptedCalls) {
      throw new Error(
        `${fixture.id}: attemptedCalls expected ${expected.attemptedCalls} got ${searched.providerCallCount}`,
      );
    }
    return;
  }

  if (searched.status !== "found") {
    throw new Error(`${fixture.id}: expected found but got failed (${searched.message})`);
  }

  const { diagnostics } = searched;
  if (diagnostics.providerCallCount !== expected.attemptedCalls) {
    throw new Error(
      `${fixture.id}: attemptedCalls expected ${expected.attemptedCalls} got ${diagnostics.providerCallCount}`,
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
    Math.abs(diagnostics.snappedClickMissMeters - expected.snappedEndMissM) > toleranceMeters
  ) {
    throw new Error(
      `${fixture.id}: snappedEndMissM expected ${expected.snappedEndMissM} got ${diagnostics.snappedClickMissMeters}`,
    );
  }
  if (Math.abs(diagnostics.rawClickMissMeters - expected.rawEndMissM) > toleranceMeters) {
    throw new Error(
      `${fixture.id}: rawEndMissM expected ${expected.rawEndMissM} got ${diagnostics.rawClickMissMeters}`,
    );
  }
  if (Math.abs(diagnostics.actualEndBearingErrorDeg - expected.bearingErrorDeg) > 2) {
    throw new Error(
      `${fixture.id}: bearingErrorDeg expected ${expected.bearingErrorDeg} got ${diagnostics.actualEndBearingErrorDeg}`,
    );
  }
  if (getDistanceMeters(searched.end, expected.clippedEnd) > toleranceMeters) {
    throw new Error(
      `${fixture.id}: clippedEnd expected ${expected.clippedEnd} got ${searched.end}`,
    );
  }
}

export function printReplayTable(rows: ClickIntentReplayRow[]): void {
  console.log(
    "scenario | fixtureKind | algorithm | distanceErrorM | snappedEndMissM | rawEndMissM | bearingErrorDeg | attemptedCalls | ms | result | sameResult",
  );
  for (const row of rows) {
    console.log(
      [
        row.scenario,
        row.fixtureKind,
        row.algorithm,
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
