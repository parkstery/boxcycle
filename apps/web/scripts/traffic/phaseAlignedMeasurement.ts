/**
 * Phase-aligned traffic attribution (measurement-only, offline).
 *
 * Fully contained clock-minute bins only — no linear prorating of partial overlap.
 * Every clock minute inside a window must have exactly one bin (no gaps, no duplicates).
 * Does not promote console/emulator/Chief-L counts to billed cost.
 */

export type EvidenceClass = "P" | "E" | "L" | "H" | "C" | "Ø";

export type MetricName = "reads" | "writes";

export type IsoInterval = {
  startIso: string;
  endIso: string;
};

export type RiderPhaseIntervals = {
  start?: IsoInterval;
  steady: IsoInterval;
  end?: IsoInterval;
};

export type MinuteBin = {
  /** Inclusive start of the clock minute (ISO-8601). Length is always 60_000 ms. */
  minuteStartIso: string;
  reads?: number;
  writes?: number;
};

export type PhaseAlignedInput = {
  evidenceClass: EvidenceClass;
  /** Opaque deploy / code state label; must match for 1v2 compare. */
  deployLabel: string;
  /** Calendar date of the observation window (YYYY-MM-DD, local intent of the bins). */
  calendarDate: string;
  /** Optional CF / RTDB series — passed through, never mixed into Firestore rates. */
  seriesNotes?: string;
  quiet?: IsoInterval;
  solo?: RiderPhaseIntervals;
  dual?: RiderPhaseIntervals;
  minuteBins: MinuteBin[];
};

export type ContainedBin = {
  minuteStartIso: string;
  minuteEndIso: string;
  reads: number | null;
  writes: number | null;
};

export type WindowAttribution = {
  role: "quiet" | "solo" | "dual";
  /** quiet uses baseline; rider windows use start/steady/end. */
  phase: "start" | "steady" | "end" | "baseline";
  interval: IsoInterval;
  intervalMs: number;
  containedBins: ContainedBin[];
  excludedPartialBins: Array<{ minuteStartIso: string; reason: string }>;
  /** Clock minutes that must be fully contained; equals binCount when coverage is complete. */
  expectedBinCount: number;
  binCount: number;
  binDurationMs: number;
  sumReads: number | null;
  sumWrites: number | null;
  rateReadsPerMin: number | null;
  rateWritesPerMin: number | null;
  /** Metrics present on every contained bin (all-or-nothing per window). */
  metricsPresent: { reads: boolean; writes: boolean };
};

export type DirectionalCompare = {
  ok: true;
  evidenceClass: EvidenceClass;
  deployLabel: string;
  calendarDate: string;
  phase: "steady";
  solo: WindowAttribution;
  dual: WindowAttribution;
  /** Metrics compared on both sides; others are explicitly missing (not zero). */
  comparedMetrics: MetricName[];
  missingMetrics: MetricName[];
  /** Directional only — not billed savings. Null when that metric is missing. */
  readsRatioDualOverSolo: number | null;
  writesRatioDualOverSolo: number | null;
  readsDeltaDualMinusSoloPerMin: number | null;
  writesDeltaDualMinusSoloPerMin: number | null;
  billedPromotion: false;
  note: string;
};

export type InsufficientResult = {
  ok: false;
  status: "insufficient";
  reasons: string[];
  attributions: WindowAttribution[];
  billedPromotion: false;
};

export type PhaseAlignedResult =
  | {
      ok: true;
      status: "ok";
      evidenceClass: EvidenceClass;
      deployLabel: string;
      calendarDate: string;
      attributions: WindowAttribution[];
      quietBaseline: WindowAttribution | null;
      compare: DirectionalCompare | null;
      billedPromotion: false;
      warnings: string[];
    }
  | InsufficientResult;

const MINUTE_MS = 60_000;

export function parseIsoMs(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`invalid ISO: ${iso}`);
  return ms;
}

export function floorToMinuteMs(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

export function minuteEndMs(minuteStartMs: number): number {
  return minuteStartMs + MINUTE_MS;
}

/** True iff [binStart, binEnd) ⊆ [windowStart, windowEnd). */
export function isBinFullyContained(
  binStartMs: number,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  const binEnd = minuteEndMs(binStartMs);
  return binStartMs >= windowStartMs && binEnd <= windowEndMs;
}

/** Every clock-minute start that is fully contained in [windowStart, windowEnd). */
export function expectedContainedMinuteStarts(windowStartMs: number, windowEndMs: number): number[] {
  const out: number[] = [];
  const firstFloor = floorToMinuteMs(windowStartMs);
  for (let t = firstFloor; t + MINUTE_MS <= windowEndMs; t += MINUTE_MS) {
    if (isBinFullyContained(t, windowStartMs, windowEndMs)) out.push(t);
  }
  return out;
}

/** Non-negative integer metric, or undefined when the field is omitted. */
export function parseOptionalNonNegInt(
  label: string,
  value: unknown,
): { ok: true; value: number | undefined } | { ok: false; reason: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: `${label}: must be a finite non-negative integer or omitted` };
  }
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, reason: `${label}: must be a non-negative integer (got ${value})` };
  }
  return { ok: true, value };
}

function validateInterval(label: string, interval: IsoInterval): { startMs: number; endMs: number } | string {
  let startMs: number;
  let endMs: number;
  try {
    startMs = parseIsoMs(interval.startIso);
    endMs = parseIsoMs(interval.endIso);
  } catch (e) {
    return `${label}: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (endMs <= startMs) return `${label}: end must be after start`;
  return { startMs, endMs };
}

function sumMetricOrNull(contained: ContainedBin[], key: MetricName): number | null {
  if (contained.length === 0) return null;
  if (contained.some((b) => b[key] === null)) return null;
  return contained.reduce((acc, b) => acc + (b[key] as number), 0);
}

function attributeWindow(
  role: WindowAttribution["role"],
  phase: WindowAttribution["phase"],
  interval: IsoInterval,
  bins: MinuteBin[],
): WindowAttribution | string {
  const v = validateInterval(`${role}.${phase}`, interval);
  if (typeof v === "string") return v;
  const { startMs, endMs } = v;
  const expectedStarts = expectedContainedMinuteStarts(startMs, endMs);
  const expectedSet = new Set(expectedStarts);
  const containedByStart = new Map<number, ContainedBin>();
  const excluded: WindowAttribution["excludedPartialBins"] = [];
  const seenOverlapStarts = new Set<number>();

  for (const bin of bins) {
    let binStart: number;
    try {
      binStart = parseIsoMs(bin.minuteStartIso);
    } catch (e) {
      return `minuteBin ${bin.minuteStartIso}: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (binStart !== floorToMinuteMs(binStart)) {
      return `minuteBin ${bin.minuteStartIso}: must be exact clock-minute start`;
    }
    const binEnd = minuteEndMs(binStart);
    const overlaps = binStart < endMs && binEnd > startMs;
    if (!overlaps) continue;

    if (seenOverlapStarts.has(binStart)) {
      return `${role}.${phase}: duplicate minuteStartIso ${new Date(binStart).toISOString()}`;
    }
    seenOverlapStarts.add(binStart);

    const readsParsed = parseOptionalNonNegInt(
      `minuteBin ${bin.minuteStartIso} reads`,
      bin.reads,
    );
    if (!readsParsed.ok) return `${role}.${phase}: ${readsParsed.reason}`;
    const writesParsed = parseOptionalNonNegInt(
      `minuteBin ${bin.minuteStartIso} writes`,
      bin.writes,
    );
    if (!writesParsed.ok) return `${role}.${phase}: ${writesParsed.reason}`;

    if (isBinFullyContained(binStart, startMs, endMs)) {
      containedByStart.set(binStart, {
        minuteStartIso: new Date(binStart).toISOString(),
        minuteEndIso: new Date(binEnd).toISOString(),
        reads: readsParsed.value === undefined ? null : readsParsed.value,
        writes: writesParsed.value === undefined ? null : writesParsed.value,
      });
    } else {
      excluded.push({
        minuteStartIso: new Date(binStart).toISOString(),
        reason: "partial_overlap_not_prorated",
      });
    }
  }

  const missing: number[] = [];
  for (const t of expectedStarts) {
    if (!containedByStart.has(t)) missing.push(t);
  }
  if (missing.length > 0) {
    return `${role}.${phase}: missing fully-contained minute bin(s): ${missing
      .map((t) => new Date(t).toISOString())
      .join(", ")}`;
  }

  for (const t of containedByStart.keys()) {
    if (!expectedSet.has(t)) {
      return `${role}.${phase}: unexpected contained minute ${new Date(t).toISOString()}`;
    }
  }

  const contained = expectedStarts.map((t) => containedByStart.get(t)!);

  // Per-metric all-or-nothing: mixed present/missing inside one window is invalid.
  for (const key of ["reads", "writes"] as const) {
    const present = contained.filter((b) => b[key] !== null).length;
    if (present > 0 && present < contained.length) {
      return `${role}.${phase}: mixed present/missing ${key} across contained bins`;
    }
  }

  const sumReads = sumMetricOrNull(contained, "reads");
  const sumWrites = sumMetricOrNull(contained, "writes");
  const binCount = contained.length;
  const rate = (sum: number | null) => (sum === null || binCount === 0 ? null : sum / binCount);
  const metricsPresent = {
    reads: sumReads !== null,
    writes: sumWrites !== null,
  };

  return {
    role,
    phase,
    interval: { ...interval },
    intervalMs: endMs - startMs,
    containedBins: contained,
    excludedPartialBins: excluded,
    expectedBinCount: expectedStarts.length,
    binCount,
    binDurationMs: binCount * MINUTE_MS,
    sumReads,
    sumWrites,
    rateReadsPerMin: rate(sumReads),
    rateWritesPerMin: rate(sumWrites),
    metricsPresent,
  };
}

function intervalsOverlap(a: IsoInterval, b: IsoInterval): boolean {
  const a0 = parseIsoMs(a.startIso);
  const a1 = parseIsoMs(a.endIso);
  const b0 = parseIsoMs(b.startIso);
  const b1 = parseIsoMs(b.endIso);
  return a0 < b1 && b0 < a1;
}

function collectCompareBlockers(
  input: PhaseAlignedInput,
  soloSteady: WindowAttribution | null,
  dualSteady: WindowAttribution | null,
): string[] {
  const reasons: string[] = [];
  if (!input.solo?.steady) reasons.push("missing solo.steady interval");
  if (!input.dual?.steady) reasons.push("missing dual.steady interval");
  if (!soloSteady) reasons.push("solo.steady attribution failed");
  if (!dualSteady) reasons.push("dual.steady attribution failed");
  if (soloSteady && soloSteady.binCount === 0) {
    reasons.push("solo.steady has zero fully-contained clock-minute bins");
  }
  if (dualSteady && dualSteady.binCount === 0) {
    reasons.push("dual.steady has zero fully-contained clock-minute bins");
  }
  if (soloSteady && dualSteady && soloSteady.binCount !== dualSteady.binCount) {
    reasons.push(
      `solo.steady binCount (${soloSteady.binCount}) != dual.steady binCount (${dualSteady.binCount}); unequal window lengths are not merged into one effect estimate`,
    );
  }
  if (soloSteady && dualSteady && soloSteady.binCount > 0 && dualSteady.binCount > 0) {
    for (const key of ["reads", "writes"] as const) {
      const s = soloSteady.metricsPresent[key];
      const d = dualSteady.metricsPresent[key];
      if (s !== d) {
        reasons.push(
          `solo.steady and dual.steady disagree on metric presence for ${key} (solo=${s}, dual=${d})`,
        );
      }
    }
    if (
      !soloSteady.metricsPresent.reads &&
      !soloSteady.metricsPresent.writes &&
      !dualSteady.metricsPresent.reads &&
      !dualSteady.metricsPresent.writes
    ) {
      reasons.push("no comparable metrics: both reads and writes missing on solo/dual steady");
    }
  }
  if (input.solo?.steady && input.dual?.steady && intervalsOverlap(input.solo.steady, input.dual.steady)) {
    reasons.push("solo.steady and dual.steady intervals overlap");
  }
  if (!input.deployLabel?.trim()) reasons.push("missing deployLabel");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.calendarDate ?? "")) {
    reasons.push("calendarDate must be YYYY-MM-DD");
  }
  if (!input.evidenceClass) reasons.push("missing evidenceClass");
  if (input.evidenceClass === "Ø") reasons.push("evidenceClass Ø — not measured");
  return reasons;
}

/**
 * Attribute minute bins to phase windows and optionally compare solo vs dual steady.
 * On any blocker for the 1v2 compare, returns status "insufficient" (never invents rates).
 */
export function analyzePhaseAlignedTraffic(input: PhaseAlignedInput): PhaseAlignedResult {
  const attributions: WindowAttribution[] = [];
  const parseErrors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(input.minuteBins) || input.minuteBins.length === 0) {
    return {
      ok: false,
      status: "insufficient",
      reasons: ["minuteBins empty or missing"],
      attributions: [],
      billedPromotion: false,
    };
  }

  const pushAttr = (role: WindowAttribution["role"], phase: WindowAttribution["phase"], interval?: IsoInterval) => {
    if (!interval) return null;
    const attr = attributeWindow(role, phase, interval, input.minuteBins);
    if (typeof attr === "string") {
      parseErrors.push(attr);
      return null;
    }
    attributions.push(attr);
    return attr;
  };

  const quiet = pushAttr("quiet", "baseline", input.quiet);
  const soloStart = pushAttr("solo", "start", input.solo?.start);
  const soloSteady = pushAttr("solo", "steady", input.solo?.steady);
  const soloEnd = pushAttr("solo", "end", input.solo?.end);
  const dualStart = pushAttr("dual", "start", input.dual?.start);
  const dualSteady = pushAttr("dual", "steady", input.dual?.steady);
  const dualEnd = pushAttr("dual", "end", input.dual?.end);

  void soloStart;
  void soloEnd;
  void dualStart;
  void dualEnd;

  if (parseErrors.length > 0) {
    return {
      ok: false,
      status: "insufficient",
      reasons: parseErrors,
      attributions,
      billedPromotion: false,
    };
  }

  const blockers = collectCompareBlockers(input, soloSteady, dualSteady);
  if (blockers.length > 0) {
    return {
      ok: false,
      status: "insufficient",
      reasons: blockers,
      attributions,
      billedPromotion: false,
    };
  }

  // Narrowed by blockers.
  const s = soloSteady as WindowAttribution;
  const d = dualSteady as WindowAttribution;

  const comparedMetrics: MetricName[] = [];
  const missingMetrics: MetricName[] = [];
  for (const key of ["reads", "writes"] as const) {
    if (s.metricsPresent[key] && d.metricsPresent[key]) comparedMetrics.push(key);
    else missingMetrics.push(key);
  }

  const ratio = (a: number | null, b: number | null) =>
    a !== null && b !== null && b !== 0 ? a / b : null;
  const delta = (a: number | null, b: number | null) =>
    a !== null && b !== null ? a - b : null;

  if (quiet && quiet.binCount === 0) {
    warnings.push("quiet baseline interval present but has zero fully-contained bins");
  }
  if (missingMetrics.length > 0) {
    warnings.push(`compare omits missing metrics: ${missingMetrics.join(", ")}`);
  }

  const compare: DirectionalCompare = {
    ok: true,
    evidenceClass: input.evidenceClass,
    deployLabel: input.deployLabel,
    calendarDate: input.calendarDate,
    phase: "steady",
    solo: s,
    dual: d,
    comparedMetrics,
    missingMetrics,
    readsRatioDualOverSolo: comparedMetrics.includes("reads")
      ? ratio(d.rateReadsPerMin, s.rateReadsPerMin)
      : null,
    writesRatioDualOverSolo: comparedMetrics.includes("writes")
      ? ratio(d.rateWritesPerMin, s.rateWritesPerMin)
      : null,
    readsDeltaDualMinusSoloPerMin: comparedMetrics.includes("reads")
      ? delta(d.rateReadsPerMin, s.rateReadsPerMin)
      : null,
    writesDeltaDualMinusSoloPerMin: comparedMetrics.includes("writes")
      ? delta(d.rateWritesPerMin, s.rateWritesPerMin)
      : null,
    billedPromotion: false,
    note: "Directional rate compare on equal fully-contained minute bins only. Not billed cost. Do not mix with other evidence classes or deploy labels.",
  };

  return {
    ok: true,
    status: "ok",
    evidenceClass: input.evidenceClass,
    deployLabel: input.deployLabel,
    calendarDate: input.calendarDate,
    attributions,
    quietBaseline: quiet,
    compare,
    billedPromotion: false,
    warnings,
  };
}
