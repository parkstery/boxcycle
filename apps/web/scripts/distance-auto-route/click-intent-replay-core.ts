import {
  AUTO_ROUTE_ALGORITHM_VERSION,
  AUTO_ROUTE_BEARING_OFFSETS_DEG,
  AUTO_ROUTE_DISTANCE_FACTORS,
  bearingFromOriginToPoint,
  buildAutoRouteCandidates,
  getDistanceMeters,
  lineStringLengthMeters,
  offsetLngLatByBearingMeters,
  searchDistanceAutoRoute,
  type AutoRouteCandidate,
  type DirectionsRouteLike,
  type FetchDirectionsFn,
  type LngLat,
  type RouteProfile,
} from "../../../../functions/src/distanceAutoRouteCore.ts";

export const BASELINE_ALGORITHM_VERSION = "ebdee9d-baseline";

export type FixtureProviderOverride = {
  bearingOffsetDeg: number;
  distanceFactor: number;
} & (
  | { kind: "route"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
  | { kind: "throw" }
  | { kind: "too_short"; geometry: DirectionsRouteLike["geometry"]; duration?: number }
);

export type ClickIntentFixtureExpected = {
  status: "found" | "failed";
  attemptedCalls: number;
  distanceErrorM: number;
  snappedEndMissM: null;
  rawEndMissM: number;
  bearingErrorDeg: number;
  clippedEnd: LngLat;
  sameResult: true;
  sameResultReason: string;
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

function normalizeBearingOffsetDeg(offset: number): number {
  let normalized = offset % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return Math.round(normalized);
}

function nearestDistanceFactor(straightMeters: number, targetMeters: number): number {
  const ratio = straightMeters / targetMeters;
  let best = AUTO_ROUTE_DISTANCE_FACTORS[0]!;
  let bestDiff = Math.abs(ratio - best);
  for (const factor of AUTO_ROUTE_DISTANCE_FACTORS) {
    const diff = Math.abs(ratio - factor);
    if (diff < bestDiff) {
      best = factor;
      bestDiff = diff;
    }
  }
  return best;
}

function nearestBearingOffsetDeg(candidateBearing: number, clickBearing: number): number {
  const raw = normalizeBearingOffsetDeg(candidateBearing - clickBearing);
  let best = AUTO_ROUTE_BEARING_OFFSETS_DEG[0]!;
  let bestDiff = Math.abs(raw - best);
  for (const offset of AUTO_ROUTE_BEARING_OFFSETS_DEG) {
    const diff = Math.abs(raw - offset);
    if (diff < bestDiff) {
      best = offset;
      bestDiff = diff;
    }
  }
  return best;
}

function candidateSelector(
  candidate: AutoRouteCandidate,
  clickBearing: number,
  targetDistanceMeters: number,
): { bearingOffsetDeg: number; distanceFactor: number } {
  return {
    bearingOffsetDeg: nearestBearingOffsetDeg(candidate.bearingDeg, clickBearing),
    distanceFactor: nearestDistanceFactor(candidate.straightLineMeters, targetDistanceMeters),
  };
}

function findOverride(
  candidate: AutoRouteCandidate,
  clickBearing: number,
  targetDistanceMeters: number,
  overrides: FixtureProviderOverride[] | undefined,
): FixtureProviderOverride | undefined {
  if (!overrides?.length) return undefined;
  const selector = candidateSelector(candidate, clickBearing, targetDistanceMeters);
  return overrides.find(
    (item) =>
      item.bearingOffsetDeg === selector.bearingOffsetDeg &&
      Math.abs(item.distanceFactor - selector.distanceFactor) < 0.01,
  );
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
  const clickBearing = bearingFromOriginToPoint(fixture.start, fixture.targetRoadPoint);
  const lengthFactor = fixture.defaultRouteLengthFactor ?? 1.05;

  return async (_profile, start, end) => {
    const candidates = buildAutoRouteCandidates(start, clickBearing, fixture.targetDistanceMeters);
    const candidate =
      candidates.find((item) => getDistanceMeters(item.end, end) < 1) ??
      candidates.find((item) => getDistanceMeters(item.end, end) < 25);
    if (!candidate) {
      throw new Error(`fixture provider: unmatched end ${end.join(",")}`);
    }

    const override = findOverride(candidate, clickBearing, fixture.targetDistanceMeters, fixture.overrides);
    if (override?.kind === "throw") {
      throw new Error("fixture provider throw");
    }

    if (override?.kind === "too_short") {
      const geometry = override.geometry;
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: override.duration ?? 900,
      };
    }

    if (override?.kind === "route") {
      const geometry = override.geometry;
      return {
        geometry,
        distance: lineStringLengthMeters(geometry),
        duration: override.duration ?? 1200,
      };
    }

    const geometry = buildStraightRouteGeometry(
      start,
      candidate.bearingDeg,
      candidate.straightLineMeters * lengthFactor,
    );
    return {
      geometry,
      distance: lineStringLengthMeters(geometry),
      duration: 1200,
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
  const baseRow = buildReplayRow(fixture, fixture.baselineAlgorithm, searched);
  const observeRow = buildReplayRow(fixture, AUTO_ROUTE_ALGORITHM_VERSION, searched);
  const sameResult =
    baseRow.result === observeRow.result &&
    baseRow.distanceErrorM === observeRow.distanceErrorM &&
    baseRow.rawEndMissM === observeRow.rawEndMissM &&
    baseRow.bearingErrorDeg === observeRow.bearingErrorDeg &&
    baseRow.attemptedCalls === observeRow.attemptedCalls;
  const sameResultReason = sameResult
    ? fixture.expected.sameResultReason
    : "baseline·observe replay metrics diverged";
  return [
    { ...baseRow, sameResult, sameResultReason },
    { ...observeRow, sameResult, sameResultReason },
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
  if (diagnostics.snappedClickMissMeters != null) {
    throw new Error(`${fixture.id}: snappedEndMissM should be unavailable (null)`);
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
