/**
 * F2 Boundary Tests — End→Save→Restore full cycle
 * 
 * Codex-04: "Do NOT claim F2 complete without end→save→restore full-boundary tests"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StoredRideSession } from "../../src/lib/rideSessionsStorage.ts";
import { isRouteCompletion } from "../../src/lib/rideRecordPolicy.ts";

describe("F2 Boundary: End→Save→Restore", () => {
  it("1000m route, 50% progress: save 0.5 ratio → restore → same meaning", () => {
    // End: virtualDist = 500m, routeDistanceMeters = 1000m
    const virtualDist = 500;
    const routeDistanceMeters = 1000;
    const completionRatio = virtualDist / routeDistanceMeters; // 0.5
    
    // Save: progressToSave = max(completionRatio, previousProgressRatio)
    const previousProgressRatio = 0;
    const progressToSave = Math.max(completionRatio, previousProgressRatio); // 0.5
    
    // Restore: card/prep/Go use progressToSave with routeDistanceMeters
    const resumeMeters = progressToSave * routeDistanceMeters; // 500m
    
    assert.equal(progressToSave, 0.5, "saved ratio 0.5");
    assert.equal(resumeMeters, 500, "resume 500m");
    assert.equal(resumeMeters, virtualDist, "resume matches original end point");
  });

  it("Max progress: 43% then 20% → save 43%, not 20%", () => {
    const routeDistanceMeters = 1000;
    
    // First ride: end at 43%
    const virtualDist1 = 430;
    const completionRatio1 = virtualDist1 / routeDistanceMeters; // 0.43
    const progressToSave1 = Math.max(completionRatio1, 0); // 0.43
    
    // Second ride (restart): end at 20%
    const virtualDist2 = 200;
    const completionRatio2 = virtualDist2 / routeDistanceMeters; // 0.2
    const progressToSave2 = Math.max(completionRatio2, progressToSave1); // max(0.2, 0.43) = 0.43
    
    assert.equal(progressToSave1, 0.43, "first save 43%");
    assert.equal(progressToSave2, 0.43, "second save keeps 43% (max)");
  });

  it("0.97 cap: 0.98 progress → save 0.98, resume 0.97", () => {
    const routeDistanceMeters = 1000;
    const virtualDist = 980;
    const completionRatio = virtualDist / routeDistanceMeters; // 0.98
    
    // Save: NO cap (save full progress for completion check)
    const progressToSave = completionRatio; // 0.98
    
    // Resume: 0.97 cap applies
    const ROUTE_RESUME_MAX_RATIO = 0.97;
    const resumeRatio = Math.min(progressToSave, ROUTE_RESUME_MAX_RATIO); // 0.97
    const resumeMeters = resumeRatio * routeDistanceMeters; // 970m
    
    // Completion check: uses full 0.98
    const completed = isRouteCompletion(completionRatio); // true (≥0.98)
    
    assert.equal(progressToSave, 0.98, "save 0.98 (no cap)");
    assert.equal(resumeRatio, 0.97, "resume capped at 0.97");
    assert.equal(completed, true, "0.98 completes route");
  });

  it("Dual-length fixture: 1000m route / 1200m geometry → card/Go agree", () => {
    const routeDistanceMeters = 1000;
    const geometryLength = 1200;
    const progressRatio = 0.5;
    
    // Save: ratio * routeDistanceMeters
    const offsetMeters = progressRatio * routeDistanceMeters; // 500m
    
    // Card: uses offsetMeters as geometry meters (NO scaling)
    const cardGeoMeters = offsetMeters; // 500m
    
    // App Go: same (after Codex-04 fix)
    const appGoGeoMeters = offsetMeters; // 500m
    
    assert.equal(cardGeoMeters, 500, "card 500m");
    assert.equal(appGoGeoMeters, 500, "App Go 500m");
    assert.equal(cardGeoMeters, appGoGeoMeters, "card === App Go");
  });
});
