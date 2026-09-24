/**
 * 지시08 §5 — 같은 출발점 Claim 전/후 geometry·신규도로비율 비교.
 * 실 Mapbox. Claim 은 전 경로 셀을 in-memory Set 으로 주입(Firestore 쓰기 없음).
 */
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import {
  searchReadyOnewayRoute,
  computeRouteNewRoadRatio,
  MAX_DISTANCE_ERROR_RATIO,
  MAX_AUTO_ROUTE_PROVIDER_CALLS,
} from "../../../../../functions/lib/distanceAutoRouteCore.js";

const envRaw = readFileSync(new URL("../../../../../apps/web/.env", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const TOKEN = env.VITE_MAPBOX_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("VITE_MAPBOX_ACCESS_TOKEN missing");
  process.exit(1);
}

async function fetchDirections(profile, waypoints) {
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await awaitFetch(url);
  const json = await res.json();
  if (json.code && json.code !== "Ok") throw new Error(`mapbox ${json.code}`);
  const route = json.routes?.[0];
  if (!route) throw new Error("no route");
  const lastWp = json.waypoints?.[json.waypoints.length - 1];
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    snappedEnd: lastWp?.location,
    endSnapDistanceMeters: lastWp?.distance,
  };
}

function awaitFetch(url) {
  return fetch(url);
}

function geoHash(geometry) {
  const flat = JSON.stringify(geometry?.coordinates ?? []);
  return createHash("sha256").update(flat).digest("hex").slice(0, 16);
}

function cellsAlong(coords) {
  const set = new Set();
  const zoom = 20;
  const n = 2 ** zoom;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1];
    const b = coords[i];
    const steps = 8;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      const x = Math.floor(((lng + 180) / 360) * n);
      const latRad = (lat * Math.PI) / 180;
      const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
      );
      set.add(`${zoom}_${x}_${y}`);
    }
  }
  return set;
}

const starts = [
  ["논현역", 127.0216, 37.511],
  ["판교테크노밸리", 127.1086, 37.4019],
  ["서울숲", 127.043, 37.5445],
];

async function pair(name, lng, lat, D) {
  const start = [lng, lat];
  const before = await searchReadyOnewayRoute({
    start,
    profile: "cycling",
    targetDistanceMeters: D,
    fetchDirections,
  });
  if (before.status !== "found") {
    return { name, D, pass: false, reason: "before_failed", before };
  }
  const claimed = cellsAlong(before.geometry.coordinates);
  const after = await searchReadyOnewayRoute({
    start,
    profile: "cycling",
    targetDistanceMeters: D,
    fetchDirections,
    claimedCellIds: claimed,
  });
  if (after.status !== "found") {
    return { name, D, pass: false, reason: "after_failed", before, after };
  }
  const beforeHash = geoHash(before.geometry);
  const afterHash = geoHash(after.geometry);
  const beforeNew = computeRouteNewRoadRatio(before.geometry.coordinates, claimed);
  const afterNew = after.newRoadRatio ?? computeRouteNewRoadRatio(after.geometry.coordinates, claimed);
  const within20 =
    Math.abs(before.distance - D) / D <= MAX_DISTANCE_ERROR_RATIO &&
    Math.abs(after.distance - D) / D <= MAX_DISTANCE_ERROR_RATIO;
  const callsOk =
    before.providerCallCount <= MAX_AUTO_ROUTE_PROVIDER_CALLS &&
    after.providerCallCount <= MAX_AUTO_ROUTE_PROVIDER_CALLS;
  const geometryChanged = beforeHash !== afterHash;
  const newRoadUp = afterNew > beforeNew + 0.02; // 2%p 이상 상승
  const pass = geometryChanged && newRoadUp && within20 && callsOk;
  const rec = {
    name,
    D,
    beforeHash,
    afterHash,
    geometryChanged,
    beforeNew: +beforeNew.toFixed(3),
    afterNew: +afterNew.toFixed(3),
    newRoadUp,
    beforeDist: Math.round(before.distance),
    afterDist: Math.round(after.distance),
    beforeBearing: before.startBearingSampleDeg,
    afterBearing: after.startBearingSampleDeg,
    beforeCalls: before.providerCallCount,
    afterCalls: after.providerCallCount,
    claimedCells: claimed.size,
    within20,
    callsOk,
    pass,
  };
  console.log(JSON.stringify(rec));
  return rec;
}

async function main() {
  mkdirSync(new URL("./", import.meta.url), { recursive: true });
  const rows = [];
  for (const [name, lng, lat] of starts) {
    rows.push(await pair(name, lng, lat, 3000));
    await new Promise((r) => setTimeout(r, 200));
  }
  const passN = rows.filter((r) => r.pass).length;
  const summary = {
    measuredAt: new Date().toISOString(),
    gate: "geometryChanged && newRoadUp && ±20% && calls≤13",
    pass: passN,
    total: rows.length,
    ok: passN >= 2, // 3곳 중 2곳 이상
    rows,
  };
  writeFileSync(new URL("./claim-before-after.json", import.meta.url), JSON.stringify(summary, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ pass: summary.pass, total: summary.total, ok: summary.ok }, null, 2));
  if (!summary.ok) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
