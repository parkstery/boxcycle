import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import type { RideEndResult } from "../../src/lib/rideEndResult.ts";
import {
  assertRideReturnExperimentPayloadSafe,
  buildNextRideSelectedPayload,
  buildRideSummaryResolvedPayload,
  buildRideSummaryViewedPayload,
  emitRideReturnExperimentEvent,
  setRideReturnExperimentSink,
  type RideReturnExperimentEvent,
} from "../../src/lib/rideReturnExperimentEvents.ts";

function sampleResult(over: Partial<RideEndResult> = {}): RideEndResult {
  return {
    recordId: "local-rec-1",
    serverRideId: "srv-ride-1",
    endedAtIso: "2026-09-13T03:00:00.000Z",
    sessionDistanceMeters: 5200,
    elapsedSec: 900,
    avgSpeedKmh: 20.8,
    caloriesEstimate: 120,
    savedRouteId: "route-a",
    routeName: "테스트 경로",
    hasRoute: true,
    previousProgressRatio: 0.2,
    progressRatio: 0.43,
    routeCompleted: false,
    anchorLngLat: { lng: 127.0, lat: 37.5 },
    anchorPlaceLabel: "서울",
    profile: "cycling",
    routeDistanceMeters: 12000,
    rideSaveStatus: "success",
    savedRouteProgressStatus: "success",
    ...over,
  };
}

describe("RIDE-RETURN-EXPERIMENT-4 · 측정 이벤트 계약", () => {
  const events: RideReturnExperimentEvent[] = [];

  afterEach(() => {
    events.length = 0;
    setRideReturnExperimentSink(null);
  });

  it("ride_summary_viewed 페이로드 — recordId·serverRideId·진행 플래그만", () => {
    const payload = buildRideSummaryViewedPayload(sampleResult());
    assert.deepEqual(payload, {
      recordId: "local-rec-1",
      serverRideId: "srv-ride-1",
      hasRoute: true,
      routeCompleted: false,
    });
    assert.doesNotThrow(() => assertRideReturnExperimentPayloadSafe(payload));
  });

  it("ride_summary_resolved 페이로드 — reason 포함, 좌표·주소 없음", () => {
    const payload = buildRideSummaryResolvedPayload(sampleResult(), "close");
    assert.equal(payload.reason, "close");
    assert.equal(payload.recordId, "local-rec-1");
    assert.doesNotThrow(() => assertRideReturnExperimentPayloadSafe(payload));
  });

  it("next_ride_selected 페이로드 — rideId·targetKind·selection", () => {
    const payload = buildNextRideSelectedPayload("ride-9", "resume_route", "resume_route");
    assert.deepEqual(payload, {
      rideId: "ride-9",
      targetKind: "resume_route",
      selection: "resume_route",
    });
    assert.doesNotThrow(() => assertRideReturnExperimentPayloadSafe(payload));
  });

  it("금지 키(uid·좌표·주소) 포함 시 assert 실패", () => {
    assert.throws(
      () => assertRideReturnExperimentPayloadSafe({ uid: "u1", recordId: "r1" }),
      /forbidden payload key "uid"/,
    );
    assert.throws(
      () => assertRideReturnExperimentPayloadSafe({ lngLat: { lng: 1, lat: 2 } }),
      /forbidden payload key "lngLat"/,
    );
    assert.throws(
      () => assertRideReturnExperimentPayloadSafe({ placeLabel: "서울" }),
      /forbidden payload key "placeLabel"/,
    );
  });

  it("emit — 세 이벤트 이름·페이로드가 sink 로 전달된다", () => {
    setRideReturnExperimentSink((event) => events.push(event));

    emitRideReturnExperimentEvent("ride_summary_viewed", buildRideSummaryViewedPayload(sampleResult()));
    emitRideReturnExperimentEvent(
      "ride_summary_resolved",
      buildRideSummaryResolvedPayload(sampleResult(), "extend_from_end"),
    );
    emitRideReturnExperimentEvent(
      "next_ride_selected",
      buildNextRideSelectedPayload("ride-9", "extend_route", "extend_from_anchor"),
    );

    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((e) => e.name),
      ["ride_summary_viewed", "ride_summary_resolved", "next_ride_selected"],
    );
    for (const event of events) {
      assert.ok(Number.isFinite(event.atMs));
      assert.doesNotThrow(() =>
        assertRideReturnExperimentPayloadSafe(event.payload as unknown as Record<string, unknown>),
      );
    }
  });
});
