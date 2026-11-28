import assert from "node:assert/strict";
import test from "node:test";
import { syncRideStartLine } from "../../src/lib/map/rideStartLine.ts";
import { getDistanceMeters, bearingDegrees } from "../../src/lib/geo/geo.ts";

test("출발선은 앞바퀴 접점에 수직으로 놓이며 반복 프레임에서 재생성하지 않는다", () => {
  const layers = new Map<string, unknown>();
  const sources = new Map<string, { data: GeoJSON.Feature<GeoJSON.LineString>; setData: (data: GeoJSON.Feature<GeoJSON.LineString>) => void }>();
  let adds = 0;
  const map = {
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: { data: GeoJSON.Feature<GeoJSON.LineString> }) => {
      adds++;
      sources.set(id, { data: source.data, setData(data) { this.data = data; } });
    },
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
  } as unknown as Parameters<typeof syncRideStartLine>[0];
  const rider = { lngLat: [127, 37] as [number, number], bearingDeg: 0 };
  syncRideStartLine(map, rider);
  const points = sources.get("ride-start-line")!.data.geometry.coordinates as [number, number][];
  assert.ok(Math.abs(getDistanceMeters(points[0], points[1]) - 5) < 0.02);
  assert.ok(Math.abs(bearingDegrees(points[0], points[1]) - 90) < 0.02);
  const center: [number, number] = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
  assert.ok(Math.abs(getDistanceMeters(rider.lngLat, center) - 0.58) < 0.01);
  syncRideStartLine(map, rider);
  assert.equal(adds, 1);
  syncRideStartLine(map, null);
  assert.equal(sources.size, 0);
  assert.equal(layers.size, 0);
});
