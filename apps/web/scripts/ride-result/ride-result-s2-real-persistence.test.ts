/**
 * RETIRED (RTW-NEXT-20260910-01 N2).
 * Former controlled-Promise simulator claimed “real persistence” without calling
 * production `persistRideEndCore` / `useRideEndAndPersistence`.
 *
 * Honest evidence: `ride-result-n2-persistence.test.ts`
 */
import { describe, it } from "node:test";

describe("S2: Persistence Axes Independence (controlled Promise) — RETIRED", () => {
  it("redirects to N2 production persistRideEndCore suite", () => {
    // Kept as an empty suite so historical script paths do not 404;
    // assertions live in ride-result-n2-persistence.test.ts.
  });
});
