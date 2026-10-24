/**
 * mapMouseEventFromPickCommit 동작 검증
 *
 * commit.point({x, y})를 mapboxgl.Point 인스턴스로 변환해
 * mapbox-gl 3.23 queryRenderedFeatures에 안전하게 넘길 수 있는지 확인한다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mapboxgl from "mapbox-gl";
import { mapMouseEventFromPickCommit } from "../../src/components/map/mapPickEvent.ts";
import type { MapRoutePickCommit } from "../../src/components/map/mapRoutePickGesture.ts";

describe("mapMouseEventFromPickCommit", () => {
  it("point가 mapboxgl.Point 인스턴스여야 한다", () => {
    const commit: MapRoutePickCommit = {
      lngLat: [127.0, 37.5] as [number, number],
      point: { x: 100, y: 200 },
    };
    const event = mapMouseEventFromPickCommit(commit);

    assert.ok(event.point instanceof mapboxgl.Point, "point는 mapboxgl.Point 인스턴스여야 함");
  });

  it("x, y 값이 보존되어야 한다", () => {
    const commit: MapRoutePickCommit = {
      lngLat: [127.0, 37.5] as [number, number],
      point: { x: 123, y: 456 },
    };
    const event = mapMouseEventFromPickCommit(commit);

    assert.equal(event.point.x, 123, "x 값 보존");
    assert.equal(event.point.y, 456, "y 값 보존");
  });

  it("lngLat이 올바르게 변환되어야 한다", () => {
    const commit: MapRoutePickCommit = {
      lngLat: [127.123, 37.456] as [number, number],
      point: { x: 0, y: 0 },
    };
    const event = mapMouseEventFromPickCommit(commit);

    assert.equal(event.lngLat.lng, 127.123, "경도 보존");
    assert.equal(event.lngLat.lat, 37.456, "위도 보존");
  });

  it("음수 좌표도 정상 처리되어야 한다", () => {
    const commit: MapRoutePickCommit = {
      lngLat: [-74.0, 40.7] as [number, number],
      point: { x: -10, y: -20 },
    };
    const event = mapMouseEventFromPickCommit(commit);

    assert.ok(event.point instanceof mapboxgl.Point);
    assert.equal(event.point.x, -10);
    assert.equal(event.point.y, -20);
    assert.equal(event.lngLat.lng, -74.0);
    assert.equal(event.lngLat.lat, 40.7);
  });

  it("소수점 좌표도 정상 처리되어야 한다", () => {
    const commit: MapRoutePickCommit = {
      lngLat: [127.123456, 37.654321] as [number, number],
      point: { x: 100.5, y: 200.75 },
    };
    const event = mapMouseEventFromPickCommit(commit);

    assert.ok(event.point instanceof mapboxgl.Point);
    assert.equal(event.point.x, 100.5);
    assert.equal(event.point.y, 200.75);
  });
});