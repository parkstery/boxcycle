import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzePhaseAlignedTraffic,
  expectedContainedMinuteStarts,
  isBinFullyContained,
  parseOptionalNonNegInt,
  type PhaseAlignedInput,
} from "./phaseAlignedMeasurement.ts";

const baseMeta = {
  evidenceClass: "P" as const,
  deployLabel: "post-listing-created-deleted",
  calendarDate: "2026-10-02",
};

function binsAround(
  startIso: string,
  count: number,
  reads: number,
  writes: number,
): PhaseAlignedInput["minuteBins"] {
  const start = Date.parse(startIso);
  return Array.from({ length: count }, (_, i) => ({
    minuteStartIso: new Date(start + i * 60_000).toISOString(),
    reads,
    writes,
  }));
}

describe("isBinFullyContained", () => {
  it("accepts bin wholly inside window", () => {
    const win0 = Date.parse("2026-10-02T08:20:00.000Z");
    const win1 = Date.parse("2026-10-02T08:23:00.000Z");
    const bin = Date.parse("2026-10-02T08:21:00.000Z");
    assert.equal(isBinFullyContained(bin, win0, win1), true);
  });

  it("rejects partial overlap at either edge", () => {
    const win0 = Date.parse("2026-10-02T08:18:56.000Z");
    const win1 = Date.parse("2026-10-02T08:19:56.000Z");
    const bin1819 = Date.parse("2026-10-02T08:18:00.000Z");
    const bin1920 = Date.parse("2026-10-02T08:19:00.000Z");
    assert.equal(isBinFullyContained(bin1819, win0, win1), false);
    assert.equal(isBinFullyContained(bin1920, win0, win1), false);
  });
});

describe("expectedContainedMinuteStarts", () => {
  it("lists every fully-contained clock minute", () => {
    const starts = expectedContainedMinuteStarts(
      Date.parse("2026-10-02T00:00:00.000Z"),
      Date.parse("2026-10-02T00:03:00.000Z"),
    );
    assert.deepEqual(
      starts.map((t) => new Date(t).toISOString()),
      [
        "2026-10-02T00:00:00.000Z",
        "2026-10-02T00:01:00.000Z",
        "2026-10-02T00:02:00.000Z",
      ],
    );
  });
});

describe("parseOptionalNonNegInt", () => {
  it("accepts omitted and non-negative integers", () => {
    assert.deepEqual(parseOptionalNonNegInt("x", undefined), { ok: true, value: undefined });
    assert.deepEqual(parseOptionalNonNegInt("x", 0), { ok: true, value: 0 });
    assert.deepEqual(parseOptionalNonNegInt("x", 12), { ok: true, value: 12 });
  });

  it("rejects negative, non-integer, and non-finite", () => {
    assert.equal(parseOptionalNonNegInt("x", -1).ok, false);
    assert.equal(parseOptionalNonNegInt("x", 1.5).ok, false);
    assert.equal(parseOptionalNonNegInt("x", Number.NaN).ok, false);
    assert.equal(parseOptionalNonNegInt("x", "3").ok, false);
  });
});

describe("analyzePhaseAlignedTraffic", () => {
  it("returns insufficient for pre-deploy style 60s windows with no full minute", () => {
    // Documented archive §1.2 values only (363/118, 1200/252). No invented edge-minute counts.
    const input: PhaseAlignedInput = {
      ...baseMeta,
      calendarDate: "2026-09-29",
      deployLabel: "pre-deploy-console",
      solo: {
        steady: {
          startIso: "2026-09-29T08:18:56+09:00",
          endIso: "2026-09-29T08:19:56+09:00",
        },
      },
      dual: {
        steady: {
          startIso: "2026-09-29T08:24:28+09:00",
          endIso: "2026-09-29T08:25:28+09:00",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-09-29T08:19:00+09:00", reads: 363, writes: 118 },
        { minuteStartIso: "2026-09-29T08:24:00+09:00", reads: 1200, writes: 252 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.equal(r.status, "insufficient");
    assert.ok(r.reasons.some((x) => x.includes("solo.steady has zero")));
    assert.ok(r.reasons.some((x) => x.includes("dual.steady has zero")));
    assert.equal(r.billedPromotion, false);
  });

  it("compares equal fully-contained bins with rates and quiet baseline separately", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      quiet: {
        startIso: "2026-10-02T00:00:00.000Z",
        endIso: "2026-10-02T00:02:00.000Z",
      },
      solo: {
        start: {
          startIso: "2026-10-02T00:02:00.000Z",
          endIso: "2026-10-02T00:03:00.000Z",
        },
        steady: {
          startIso: "2026-10-02T00:03:00.000Z",
          endIso: "2026-10-02T00:06:00.000Z",
        },
        end: {
          startIso: "2026-10-02T00:06:00.000Z",
          endIso: "2026-10-02T00:07:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T00:10:00.000Z",
          endIso: "2026-10-02T00:13:00.000Z",
        },
      },
      minuteBins: [
        ...binsAround("2026-10-02T00:00:00.000Z", 2, 40, 2),
        ...binsAround("2026-10-02T00:02:00.000Z", 1, 100, 10),
        ...binsAround("2026-10-02T00:03:00.000Z", 3, 200, 50),
        ...binsAround("2026-10-02T00:06:00.000Z", 1, 90, 9),
        ...binsAround("2026-10-02T00:10:00.000Z", 3, 600, 120),
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.billedPromotion, false);
    assert.ok(r.quietBaseline);
    assert.equal(r.quietBaseline?.phase, "baseline");
    assert.equal(r.quietBaseline?.binCount, 2);
    assert.equal(r.quietBaseline?.sumReads, 80);
    assert.equal(r.quietBaseline?.rateReadsPerMin, 40);
    assert.ok(r.compare);
    assert.equal(r.compare?.solo.binCount, 3);
    assert.equal(r.compare?.dual.binCount, 3);
    assert.equal(r.compare?.solo.sumReads, 600);
    assert.equal(r.compare?.dual.sumReads, 1800);
    assert.equal(r.compare?.readsRatioDualOverSolo, 3);
    assert.equal(r.compare?.writesRatioDualOverSolo, 2.4);
    assert.deepEqual(r.compare?.comparedMetrics, ["reads", "writes"]);
    assert.deepEqual(r.compare?.missingMetrics, []);
    assert.equal(r.compare?.billedPromotion, false);
    // start/end attributions present but not merged into compare
    assert.ok(r.attributions.some((a) => a.role === "solo" && a.phase === "start"));
    assert.ok(r.attributions.some((a) => a.role === "solo" && a.phase === "end"));
  });

  it("excludes partial edge bins without prorating", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T01:00:30.000Z",
          endIso: "2026-10-02T01:03:30.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T02:00:30.000Z",
          endIso: "2026-10-02T02:03:30.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T01:00:00.000Z", reads: 999, writes: 99 },
        { minuteStartIso: "2026-10-02T01:01:00.000Z", reads: 10, writes: 1 },
        { minuteStartIso: "2026-10-02T01:02:00.000Z", reads: 10, writes: 1 },
        { minuteStartIso: "2026-10-02T01:03:00.000Z", reads: 999, writes: 99 },
        { minuteStartIso: "2026-10-02T02:00:00.000Z", reads: 999, writes: 99 },
        { minuteStartIso: "2026-10-02T02:01:00.000Z", reads: 20, writes: 2 },
        { minuteStartIso: "2026-10-02T02:02:00.000Z", reads: 20, writes: 2 },
        { minuteStartIso: "2026-10-02T02:03:00.000Z", reads: 999, writes: 99 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.compare?.solo.binCount, 2);
    assert.equal(r.compare?.solo.sumReads, 20);
    assert.equal(r.compare?.dual.sumReads, 40);
    const soloSteady = r.attributions.find((a) => a.role === "solo" && a.phase === "steady");
    assert.ok(soloSteady);
    assert.equal(soloSteady?.excludedPartialBins.length, 2);
    assert.ok(soloSteady?.excludedPartialBins.every((e) => e.reason === "partial_overlap_not_prorated"));
  });

  it("rejects equal binCount when an interior minute is missing", () => {
    // Window 00:00–00:03 expects 00:00,00:01,00:02. Providing only 00:00+00:02
    // would previously pass if both sides matched the same gap.
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:03:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:03:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: 1, writes: 1 },
        { minuteStartIso: "2026-10-02T00:02:00.000Z", reads: 1, writes: 1 },
        { minuteStartIso: "2026-10-02T01:00:00.000Z", reads: 2, writes: 2 },
        { minuteStartIso: "2026-10-02T01:02:00.000Z", reads: 2, writes: 2 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("missing fully-contained minute")));
  });

  it("rejects duplicate minuteStartIso instead of double-summing", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: 10, writes: 1 },
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: 10, writes: 1 },
        { minuteStartIso: "2026-10-02T00:01:00.000Z", reads: 10, writes: 1 },
        { minuteStartIso: "2026-10-02T01:00:00.000Z", reads: 20, writes: 2 },
        { minuteStartIso: "2026-10-02T01:01:00.000Z", reads: 20, writes: 2 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("duplicate minuteStartIso")));
  });

  it("allows unrelated extra minute bins without summing them", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        ...binsAround("2026-10-02T00:00:00.000Z", 2, 100, 10),
        { minuteStartIso: "2026-10-02T00:30:00.000Z", reads: 9999, writes: 999 },
        ...binsAround("2026-10-02T01:00:00.000Z", 2, 200, 20),
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.compare?.solo.sumReads, 200);
    assert.equal(r.compare?.dual.sumReads, 400);
  });

  it("rejects unequal bin counts instead of merging window lengths", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T03:00:00.000Z",
          endIso: "2026-10-02T03:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T04:00:00.000Z",
          endIso: "2026-10-02T04:03:00.000Z",
        },
      },
      minuteBins: [
        ...binsAround("2026-10-02T03:00:00.000Z", 2, 100, 10),
        ...binsAround("2026-10-02T04:00:00.000Z", 3, 200, 20),
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("binCount")));
  });

  it("rejects overlapping solo/dual steady", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T05:00:00.000Z",
          endIso: "2026-10-02T05:03:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T05:02:00.000Z",
          endIso: "2026-10-02T05:05:00.000Z",
        },
      },
      minuteBins: binsAround("2026-10-02T05:00:00.000Z", 5, 1, 1),
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("overlap")));
  });

  it("rejects negative or non-integer metric values", () => {
    const negative: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: -1, writes: 1 },
        { minuteStartIso: "2026-10-02T00:01:00.000Z", reads: 1, writes: 1 },
        ...binsAround("2026-10-02T01:00:00.000Z", 2, 1, 1),
      ],
    };
    const rNeg = analyzePhaseAlignedTraffic(negative);
    assert.equal(rNeg.ok, false);
    assert.ok(rNeg.reasons.some((x) => x.includes("non-negative integer")));

    const fractional: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: 1.5, writes: 1 },
        { minuteStartIso: "2026-10-02T00:01:00.000Z", reads: 1, writes: 1 },
        ...binsAround("2026-10-02T01:00:00.000Z", 2, 1, 1),
      ],
    };
    const rFrac = analyzePhaseAlignedTraffic(fractional);
    assert.equal(rFrac.ok, false);
    assert.ok(rFrac.reasons.some((x) => x.includes("non-negative integer")));
  });

  it("supports writes-only contract and leaves reads explicitly missing", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", writes: 10 },
        { minuteStartIso: "2026-10-02T00:01:00.000Z", writes: 10 },
        { minuteStartIso: "2026-10-02T01:00:00.000Z", writes: 30 },
        { minuteStartIso: "2026-10-02T01:01:00.000Z", writes: 30 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.compare?.comparedMetrics, ["writes"]);
    assert.deepEqual(r.compare?.missingMetrics, ["reads"]);
    assert.equal(r.compare?.writesRatioDualOverSolo, 3);
    assert.equal(r.compare?.readsRatioDualOverSolo, null);
    assert.equal(r.compare?.solo.sumReads, null);
    assert.ok(r.warnings.some((w) => w.includes("reads")));
  });

  it("rejects asymmetric metric presence between solo and dual", () => {
    const input: PhaseAlignedInput = {
      ...baseMeta,
      solo: {
        steady: {
          startIso: "2026-10-02T00:00:00.000Z",
          endIso: "2026-10-02T00:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T01:00:00.000Z",
          endIso: "2026-10-02T01:02:00.000Z",
        },
      },
      minuteBins: [
        { minuteStartIso: "2026-10-02T00:00:00.000Z", reads: 1, writes: 1 },
        { minuteStartIso: "2026-10-02T00:01:00.000Z", reads: 1, writes: 1 },
        { minuteStartIso: "2026-10-02T01:00:00.000Z", writes: 2 },
        { minuteStartIso: "2026-10-02T01:01:00.000Z", writes: 2 },
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("disagree on metric presence")));
  });

  it("does not auto-promote Chief L to billed", () => {
    const input: PhaseAlignedInput = {
      evidenceClass: "L",
      deployLabel: "chief-observation",
      calendarDate: "2026-10-02",
      solo: {
        steady: {
          startIso: "2026-10-02T06:00:00.000Z",
          endIso: "2026-10-02T06:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T07:00:00.000Z",
          endIso: "2026-10-02T07:02:00.000Z",
        },
      },
      minuteBins: [
        ...binsAround("2026-10-02T06:00:00.000Z", 2, 100, 10),
        ...binsAround("2026-10-02T07:00:00.000Z", 2, 300, 30),
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.evidenceClass, "L");
    assert.equal(r.billedPromotion, false);
    assert.equal(r.compare?.billedPromotion, false);
  });

  it("returns insufficient when evidenceClass is Ø", () => {
    const input: PhaseAlignedInput = {
      evidenceClass: "Ø",
      deployLabel: "none",
      calendarDate: "2026-10-02",
      solo: {
        steady: {
          startIso: "2026-10-02T08:00:00.000Z",
          endIso: "2026-10-02T08:02:00.000Z",
        },
      },
      dual: {
        steady: {
          startIso: "2026-10-02T09:00:00.000Z",
          endIso: "2026-10-02T09:02:00.000Z",
        },
      },
      minuteBins: [
        ...binsAround("2026-10-02T08:00:00.000Z", 2, 1, 1),
        ...binsAround("2026-10-02T09:00:00.000Z", 2, 1, 1),
      ],
    };
    const r = analyzePhaseAlignedTraffic(input);
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some((x) => x.includes("Ø")));
  });
});
