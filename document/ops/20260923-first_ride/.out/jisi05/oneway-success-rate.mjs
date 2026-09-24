/**
 * 지시05 §5 — Ready Ride 단순 경로(searchReadyOnewayRoute) 실측 성공률.
 * 실 Mapbox + functions/lib 컴파일 산출물. synthetic·인터셉트 금지.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { searchReadyOnewayRoute, MAX_DISTANCE_ERROR_RATIO, MAX_AUTO_ROUTE_PROVIDER_CALLS } from "../../../../../functions/lib/distanceAutoRouteCore.js";

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
  const res = await fetch(url);
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

const capital20 = [
  ["판교테크노밸리", 127.1086, 37.4019],
  ["일산호수공원", 126.77, 37.661],
  ["분당중앙공원", 127.1265, 37.366],
  ["수원영통", 127.073, 37.26],
  ["동탄호수공원", 127.08, 37.2],
  ["김포한강신도시", 126.65, 37.64],
  ["잠원한강공원", 127.013, 37.522],
  ["서울숲", 127.043, 37.5445],
  ["보라매공원", 126.919, 37.494],
  ["월드컵공원", 126.889, 37.571],
  ["안양평촌", 126.97, 37.394],
  ["과천정부청사", 127.009, 37.429],
  ["하남미사강변", 127.194, 37.56],
  ["남양주다산", 127.155, 37.622],
  ["송파문정", 127.122, 37.485],
  ["강서마곡", 126.828, 37.562],
  ["은평불광", 126.93, 37.611],
  ["노원상계", 127.064, 37.66],
  ["구로디지털단지", 126.901, 37.485],
  ["관악서울대", 126.952, 37.478],
];

const nonhyeon5 = [
  ["nonhyeon-1", 127.0356, 37.5106],
  ["nonhyeon-2", 127.0296, 37.5133],
  ["nonhyeon-3", 127.0339, 37.5088],
  ["nonhyeon-4", 127.0247, 37.5116],
  ["nonhyeon-5", 127.038, 37.5145],
];

function okDistance(distance, D) {
  return Math.abs(distance - D) / D <= MAX_DISTANCE_ERROR_RATIO;
}

async function runOne(name, lng, lat, D) {
  const r = await searchReadyOnewayRoute({
    start: [lng, lat],
    profile: "cycling",
    targetDistanceMeters: D,
    fetchDirections,
  });
  const rec = {
    name,
    D,
    status: r.status,
    providerCallCount: r.providerCallCount,
    searchElapsedMs: r.searchElapsedMs,
  };
  if (r.status === "found") {
    rec.distance = Math.round(r.distance);
    rec.errorRatio = +(Math.abs(r.distance - D) / D).toFixed(3);
    rec.within20 = okDistance(r.distance, D);
    rec.bearing = r.startBearingSampleDeg;
    rec.coords = r.geometry?.coordinates?.length ?? 0;
    rec.callsOk = r.providerCallCount <= MAX_AUTO_ROUTE_PROVIDER_CALLS;
    rec.pass = rec.within20 && rec.callsOk;
  } else {
    rec.reason = r.reason;
    rec.pass = false;
  }
  console.log(JSON.stringify(rec));
  return rec;
}

async function main() {
  const outDir = new URL("./", import.meta.url);
  mkdirSync(outDir, { recursive: true });

  const capital = [];
  for (const [name, lng, lat] of capital20) {
    capital.push(await runOne(name, lng, lat, 3000));
    await new Promise((r) => setTimeout(r, 150));
  }

  const nonhyeon = [];
  for (const [name, lng, lat] of nonhyeon5) {
    for (const D of [2000, 3000]) {
      nonhyeon.push(await runOne(name, lng, lat, D));
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  const capPass = capital.filter((r) => r.pass).length;
  const nonPass = nonhyeon.filter((r) => r.pass).length;
  const summary = {
    measuredAt: new Date().toISOString(),
    algorithm: "searchReadyOnewayRoute",
    capital20_3km: {
      pass: capPass,
      total: capital.length,
      rate: +((capPass / capital.length) * 100).toFixed(1),
      gate: "≥90%",
      ok: capPass / capital.length >= 0.9,
    },
    nonhyeon5_2_3km: {
      pass: nonPass,
      total: nonhyeon.length,
      rate: +((nonPass / nonhyeon.length) * 100).toFixed(1),
      gate: "≥90%",
      ok: nonPass / nonhyeon.length >= 0.9,
    },
    capital,
    nonhyeon,
  };
  writeFileSync(new URL("./oneway-success-rate.json", import.meta.url), JSON.stringify(summary, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ capital20_3km: summary.capital20_3km, nonhyeon5_2_3km: summary.nonhyeon5_2_3km }, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
