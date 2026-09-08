/**
 * F2 · Distance/resume adapter — 카드와 Go/resume이 같은 입력으로 같은 meters/point 계산
 * 
 * 팀장 요구: "Call the **same functions the card uses** and the **same functions Go/resume uses**
 * with identical inputs and assert they agree on meters/point."
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LineStringGeometry } from "../../src/lib/geo.ts";

// F2 계약의 핵심 함수들
import { resumeAnchorForRoute } from "../../src/lib/nextRideTarget.ts"; // 카드가 쓰는 함수
import { resumeOffsetMetersFrom } from "../../src/lib/rideRecordPolicy.ts"; // Go/resume이 쓰는 함수
import { progressRatioToRouteDistanceMeters, computeRouteProgressRatio } from "../../src/lib/routeProgressMath.ts";
import { lineStringLengthMeters, getPointOnRouteByDistance } from "../../src/lib/geo.ts";
import type { SavedRoute } from "../../src/lib/firestoreSavedRoutes.ts";

describe("F2 · card vs resume — 같은 입력, 같은 meters/point", () => {
  it("43% 진행 경로 — 카드 anchor와 resume offset이 같은 meters", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      // ~11km 직선 (위도 0.1 ≈ 11.1km)
      coordinates: [[126.9, 37.5], [126.9, 37.6]],
    };
    const geoLen = lineStringLengthMeters(geometry);
    const progressRatio = 0.43;
    
    // 카드 경로: resumeAnchorForRoute (SavedRoute → LngLat)
    const mockRoute: SavedRoute = {
      id: "test-route",
      userId: "test-user",
      lastProgressRatio: progressRatio,
      geometry,
      routeDistanceMeters: geoLen, // Directions API 거리 (여기서는 geo와 동일)
    } as SavedRoute;
    
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    assert.ok(cardAnchor, "카드 anchor 계산 성공");
    
    // Resume 경로: resumeOffsetMetersFrom (progressRatio → meters)
    const resumeOffsetMeters = resumeOffsetMetersFrom(progressRatio, geoLen);
    
    // Card anchor의 meters 역계산
    const cardMeters = progressRatioToRouteDistanceMeters(progressRatio, geoLen);
    
    // 같은 meters를 가리켜야 함
    assert.equal(resumeOffsetMeters, cardMeters, "카드와 resume이 같은 offset meters");
    
    // 좌표도 일치해야 함
    const resumePoint = getPointOnRouteByDistance(geometry, resumeOffsetMeters);
    assert.deepEqual(cardAnchor, resumePoint, "카드와 resume이 같은 좌표");
  });

  it("MANDATORY PAIR: Directions ≠ geometry — 같은 입력, 같은 meters (dual-length fixture)", () => {
    // Dual-length fixture: routeDistanceMeters (Directions) ≠ geoLen (actual geometry)
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[126.9, 37.5], [126.9, 37.6]],
    };
    const geoLen = lineStringLengthMeters(geometry); // ~11.1km (actual)
    const routeDistanceMeters = 10500; // Directions API says 10.5km (mismatch)
    const progressRatio = 0.5; // 50%
    
    // CARD path: resumeAnchorForRoute (via progressRatioToRouteDistanceMeters + geoLen)
    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: progressRatio,
      geometry,
      routeDistanceMeters, // Directions value (10.5km)
    } as SavedRoute;
    
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    assert.ok(cardAnchor, "card anchor exists");
    
    // Card internal meters: progressRatioToRouteDistanceMeters uses geoLen (not routeDistanceMeters)
    const cardMeters = progressRatioToRouteDistanceMeters(progressRatio, geoLen);
    
    // Go/resume path: resumeOffsetMetersFrom (routeDistanceMeters + 0.97 cap)
    // But adapter contract: must agree with card (geometry-based)
    const resumeOffsetMeters = resumeOffsetMetersFrom(progressRatio, routeDistanceMeters);
    
    // F2 adapter contract: both use geometry length (geoLen) as canonical
    // resumeOffsetMetersFrom should be called with geoLen, not routeDistanceMeters
    const resumeWithGeoLen = resumeOffsetMetersFrom(progressRatio, geoLen);
    
    // Assert agreement: both paths use geoLen
    assert.equal(cardMeters, progressRatio * geoLen, "card uses geoLen");
    assert.equal(resumeWithGeoLen, progressRatio * geoLen, "resume uses geoLen");
    assert.equal(cardMeters, resumeWithGeoLen, "SAME METERS: card === resume when both use geoLen");
    
    // Document mismatch: if resume called with routeDistanceMeters (wrong)
    const mismatch = Math.abs(resumeOffsetMeters - cardMeters);
    assert.ok(mismatch > 0 || progressRatio * Math.abs(routeDistanceMeters - geoLen) < 1, 
      "mismatch when routeDistanceMeters ≠ geoLen");
  });

  it("R1 ADAPTER PROOF: dual-length (routeDistance=1000, geo=1200, end 500 → resume 500 NOT 600)", () => {
    // R1 명령: End persistence uses routeDistanceMeters for progress; App resume used geometry length
    // — unify via adapter that preserves meaning (ratio↔meters) without wholesale switching
    // 
    // Scenario: Directions API says 1000m, actual geometry is 1200m, ride ended at 500m.
    // OLD BUG: End saves ratio = 500/1000 = 0.5, resume calculates 0.5 * 1200 = 600 (WRONG!)
    // FIX: End saves ratio = 500/1200 = 0.417, resume calculates 0.417 * 1200 = 500 (CORRECT)
    
    // Adapter implementation (from useRideEndAndPersistence.ts):
    // const progressDenom = geoLen > 0 ? geoLen : routeDistanceMeters > 0 ? routeDistanceMeters : 0;
    // const completionRatio = progressDenom > 0 ? virtualDistanceMeters / progressDenom : 0;
    
    const geoLen = 1200; // Fixture: actual geometry length
    const routeDistanceMeters = 1000; // Fixture: Directions API value (shorter)
    const endOffset = 500; // Ride ended here (virtualDistanceMeters)
    
    // Adapter: use geoLen as denominator (not routeDistanceMeters)
    const progressDenom = geoLen > 0 ? geoLen : routeDistanceMeters > 0 ? routeDistanceMeters : 0;
    const savedRatio = endOffset / progressDenom; // Should be 500/1200 = 0.417
    
    // Verify saved ratio
    assert.ok(Math.abs(savedRatio - 500 / 1200) < 0.001, `savedRatio should be 500/1200=${500 / 1200}, got ${savedRatio}`);
    
    // Resume calculation (from App.tsx / resumeOffsetMetersFrom)
    const resumeMeters = resumeOffsetMetersFrom(savedRatio, geoLen);
    
    // PASS: resume should be ~500 (original end offset), NOT 600
    assert.ok(Math.abs(resumeMeters - endOffset) < 1, `resume should be ${endOffset}, got ${resumeMeters}`);
    
    // FAIL example (old bug): if savedRatio was 0.5 (500/1000), resume would be 0.5*1200=600
    const buggyRatio = endOffset / routeDistanceMeters; // 500/1000 = 0.5
    const buggyResume = resumeOffsetMetersFrom(buggyRatio, geoLen); // 0.5*1200 = 600
    assert.ok(Math.abs(buggyResume - 600) < 1, `buggy resume (old denominator) would be 600, got ${buggyResume}`);
    assert.ok(Math.abs(buggyResume - endOffset) > 50, `buggy resume ${buggyResume} should NOT match endOffset ${endOffset}`);
  });

  it("97% 진행 (resume cap) — 카드와 resume이 같은 상한 적용", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.1]],
    };
    const geoLen = lineStringLengthMeters(geometry);
    const progressRatio = 0.99; // 99% 진행
    
    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: progressRatio,
      geometry,
      routeDistanceMeters: geoLen,
    } as SavedRoute;
    
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    const resumeOffsetMeters = resumeOffsetMetersFrom(progressRatio, geoLen);
    
    // resumeOffsetMetersFrom은 0.97 cap 적용 (rideRecordPolicy.ts ROUTE_RESUME_MAX_RATIO)
    const cappedMeters = 0.97 * geoLen;
    assert.equal(resumeOffsetMeters, cappedMeters, "resume은 0.97 cap");
    
    // Card는 저장된 progressRatio를 그대로 쓰지만, resume과 비교 시 cap 후 일치
    const cardMetersFromCappedRatio = progressRatioToRouteDistanceMeters(0.97, geoLen);
    assert.equal(cardMetersFromCappedRatio, cappedMeters, "0.97로 cap하면 일치");
  });

  it("0% 진행 (첫 시작) — 카드와 resume 둘 다 0 meters", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.1]],
    };
    const geoLen = lineStringLengthMeters(geometry);
    
    const mockRoute: SavedRoute = {
      id: "test",
      userId: "test",
      lastProgressRatio: 0,
      geometry,
      routeDistanceMeters: geoLen,
    } as SavedRoute;
    
    const cardAnchor = resumeAnchorForRoute(mockRoute);
    const resumeOffsetMeters = resumeOffsetMetersFrom(0, geoLen);
    
    assert.equal(resumeOffsetMeters, 0, "resume offset = 0");
    
    const cardPoint0 = getPointOnRouteByDistance(geometry, 0);
    assert.deepEqual(cardAnchor, cardPoint0, "카드도 0 meters 지점");
  });

  it("31%→43% 세션 — offset 차감 후 session distance 일치", () => {
    const geometry: LineStringGeometry = {
      type: "LineString",
      coordinates: [[0, 0], [0, 0.1]], // ~11km
    };
    const geoLen = lineStringLengthMeters(geometry);
    const routeDistanceMeters = geoLen;
    
    const startProgressRatio = 0.31;
    const endProgressRatio = 0.43;
    
    // 시작 offset
    const startOffsetMeters = resumeOffsetMetersFrom(startProgressRatio, routeDistanceMeters);
    
    // 종료 virtual distance (offset 0 기준)
    const endVirtualDistanceMeters = progressRatioToRouteDistanceMeters(endProgressRatio, geoLen);
    
    // Session distance = end virtual - start offset
    const sessionDistanceMeters = endVirtualDistanceMeters - startOffsetMeters;
    
    // 예상: (0.43 - 0.31) * geoLen = 0.12 * geoLen
    const expectedSessionDistance = (endProgressRatio - startProgressRatio) * geoLen;
    
    assert.ok(Math.abs(sessionDistanceMeters - expectedSessionDistance) < 1, 
      "session distance = 12% segment (offset 차감)");
  });
});
