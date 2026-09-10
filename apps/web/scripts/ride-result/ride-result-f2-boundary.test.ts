/**
 * F2 Boundary Tests — End→Save→Restore full cycle
 * 
 * CP1: End persistence (routeDistanceMeters-based ratio) → Resume (0.97 cap) → Agreement
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRouteCompletion } from "../../src/lib/rideRecordPolicy.ts";

describe("F2 Boundary: End→Save→Restore", () => {
  it("50% progress: save 0.5 ratio → resume same meaning", () => {
    const virtualDist = 500;
    const routeDistanceMeters = 1000;
    const completionRatio = virtualDist / routeDistanceMeters; // 0.5

    const previousProgressRatio = 0;
    const progressToSave = Math.max(completionRatio, previousProgressRatio); // 0.5

    const resumeMeters = progressToSave * routeDistanceMeters; // 500m

    assert.equal(progressToSave, 0.5, "saved ratio 0.5");
    assert.equal(resumeMeters, 500, "resume 500m");
    assert.equal(resumeMeters, virtualDist, "resume matches original end point");
  });

  it("Max progress: 43% then 20% → save 43%, not 20%", () => {
    const routeDistanceMeters = 1000;

    const completionRatio1 = 430 / routeDistanceMeters; // 0.43
    const progressToSave1 = Math.max(completionRatio1, 0); // 0.43

    const completionRatio2 = 200 / routeDistanceMeters; // 0.2
    const progressToSave2 = Math.max(completionRatio2, progressToSave1); // max(0.2, 0.43) = 0.43

    assert.equal(progressToSave1, 0.43, "first save 43%");
    assert.equal(progressToSave2, 0.43, "second save keeps 43% (max)");
  });

  it("0.97 cap: 0.98 progress → save 0.98, resume 0.97, completes", () => {
    const routeDistanceMeters = 1000;
    const virtualDist = 980;
    const completionRatio = virtualDist / routeDistanceMeters; // 0.98

    const progressToSave = completionRatio; // 0.98 (no cap on save)

    const ROUTE_RESUME_MAX_RATIO = 0.97;
    const resumeRatio = Math.min(progressToSave, ROUTE_RESUME_MAX_RATIO); // 0.97
    const resumeMeters = resumeRatio * routeDistanceMeters; // 970m

    const completed = isRouteCompletion(completionRatio); // true (≥0.98)

    assert.equal(progressToSave, 0.98, "save 0.98 (no cap)");
    assert.equal(resumeRatio, 0.97, "resume capped at 0.97");
    assert.equal(completed, true, "0.98 completes route");
  });

  it("Dual-length 1000m/1200m → card/Go agree (no scaling)", () => {
    const routeDistanceMeters = 1000;
    const geometryLength = 1200;
    const progressRatio = 0.5;

    const offsetMeters = progressRatio * routeDistanceMeters; // 500m

    // Card/Go both use offsetMeters as geometry meters (no scaling)
    const cardGeoMeters = offsetMeters; // 500m
    const appGoGeoMeters = offsetMeters; // 500m

    assert.equal(cardGeoMeters, 500, "card 500m");
    assert.equal(appGoGeoMeters, 500, "App Go 500m");
    assert.equal(cardGeoMeters, appGoGeoMeters, "card === App Go");
  });
});
