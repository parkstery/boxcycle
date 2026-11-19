/** Real Mapbox + local generated Terrain-RGB. No Firebase, external terrain, or real rides. */
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { tickRideCameraFollow } from "../../src/components/map/rideCameraFollow";
import { readRideTerrainHealth, RideTerrainGuard } from "../../src/components/map/rideTerrainGuard";
import { resetRideCameraTerrain } from "../../src/components/map/rideCameraTerrain";
import { offsetLngLatByBearingMeters, type LngLat } from "../../src/lib/geo/geo";

const scenario = new URLSearchParams(location.search).get("scenario") ?? "flat";
const crc = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const v of b) { c ^= v; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
  view.setUint32(out.length - 4, crc(out.subarray(4, out.length - 4)));
  return out;
}
async function dem() {
  const rows = new Uint8Array((512 * 4 + 1) * 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const m = scenario === "ridge" ? 100 + 18 * Math.exp(-(((x - 252) / 3) ** 2))
      : scenario === "slope" ? 100 + (x - 256) * 2 : 100;
    const rgb = Math.round((m + 10000) * 10);
    const p = y * (512 * 4 + 1) + 1 + x * 4;
    rows.set([(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255], p);
  }
  const stream = new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const head = new Uint8Array(13), hv = new DataView(head.buffer);
  hv.setUint32(0, 512); hv.setUint32(4, 512); head[8] = 8; head[9] = 6;
  const bytes = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", compressed), chunk("IEND", new Uint8Array())];
  return await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(new Blob(bytes)); });
}
const x = 8192, y = 6377, z = 14;
const origin: LngLat = [(x + 0.5) / 2 ** z * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / 2 ** z))) * 180 / Math.PI];
const map = new mapboxgl.Map({ container: "map", accessToken: "", center: origin, zoom: 19, maxZoom: 24, maxPitch: 85,
  fadeDuration: 0, attributionControl: false,
  style: { version: 8, sources: { dem: { type: "raster-dem", tiles: [await dem()], tileSize: 512, maxzoom: 14 } },
    layers: [{ id: "background", type: "background", paint: { "background-color": "#bad4b9" } }], terrain: { source: "dem", exaggeration: 1.3 } } });
let now = performance.now(), flat = false, missing = false, slot: 2 | 3 = 2;
let rider = origin;
let guard = new RideTerrainGuard(now);
const smooth = { center: null as LngLat | null, bearingPrimary: null as number | null, bearing: null as number | null,
  pitch: null as number | null, zoom: null as number | null, lastTs: null as number | null };
const prevLiveRef = { current: null as LngLat | null };
const query = map.queryTerrainElevation.bind(map);
map.queryTerrainElevation = (...args) => missing ? null : query(...args);
function snapshot() {
  const camera = map.getFreeCameraOptions().position;
  const ll = camera?.toLngLat();
  const ground = ll ? query(ll, { exaggerated: false }) : null;
  const center = query(map.getCenter(), { exaggerated: false });
  const altitude = camera?.toAltitude() ?? null;
  const prospective = altitude == null ? null : altitude + (flat && center != null ? center * 1.3 : 0);
  const point = map.project(rider);
  return { scenario, slot, flat, requested: map.getTerrain() !== null, pitch: map.getPitch(), raw: query(rider, { exaggerated: false }),
    health: readRideTerrainHealth(map, rider, flat), centerM: center, shownCenterM: query(map.getCenter(), {exaggerated:true}), terrain: map.getTerrain(), altitude, clearance: prospective == null || ground == null ? null : prospective - ground * 1.3,
    riderPixel: { x: point.x, y: point.y }, viewport: [innerWidth, innerHeight], canvas: [map.getCanvas().width, map.getCanvas().height] };
}
function step(meters = 0, useGuard = false) {
  now = performance.now();
  rider = offsetLngLatByBearingMeters(origin, 90, meters);
  tickRideCameraFollow(map, rider, { activeQuickCamera: slot, followMode: slot === 2 ? "forward" : "backward", mapZoom: 19,
    rideCameraDistanceM: slot === 2 ? 9.4 : 11, lockBaseHeading: 90, routeGeometry: null, prevLiveRef, smooth, suppressUntilMs: 0, nowMs: now });
  if (useGuard && map.getTerrain()) {
    const next = guard.update(now, readRideTerrainHealth(map, rider, flat));
    if (next !== flat) { flat = next; map.setTerrain({ source: "dem", exaggeration: flat ? 0 : 1.3 }); }
  }
  const result = snapshot();
  document.getElementById("status")!.textContent = JSON.stringify(result);
  return result;
}
map.on("load", () => {
  const api = {
    snapshot, step,
    slot: (value: 2 | 3) => { slot = value; resetRideCameraTerrain(map); },
    flat: () => { flat = true; guard = new RideTerrainGuard(now); map.setTerrain({ source: "dem", exaggeration: 0 }); },
    missing: (value: boolean) => { missing = value; },
    off: () => { map.setTerrain(null); flat = false; },
    dispose: () => map.remove(),
  };
  Object.assign(window, { terrainCameraDemo: api });
  document.getElementById("status")!.textContent = "Ready";
});
