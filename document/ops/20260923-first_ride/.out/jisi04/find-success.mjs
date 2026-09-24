import { searchReadyLoopRoute } from "../../../../../functions/lib/distanceAutoRouteCore.js";
import { readFileSync } from "node:fs";
const envRaw = readFileSync(new URL("../../../../../apps/web/.env", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const TOKEN = env.VITE_MAPBOX_ACCESS_TOKEN;
async function fetchDirections(profile, waypoints) {
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code && json.code !== "Ok") throw new Error(`mapbox ${json.code}`);
  const route = json.routes?.[0];
  if (!route) throw new Error("no route");
  const lastWp = json.waypoints?.[json.waypoints.length - 1];
  return { geometry: route.geometry, distance: route.distance, duration: route.duration, snappedEnd: lastWp?.location, endSnapDistanceMeters: lastWp?.distance };
}
const candidates = [
  ["판교테크노밸리", 127.1086, 37.4019],
  ["일산호수공원", 126.7700, 37.6610],
  ["분당중앙공원", 127.1265, 37.3660],
  ["수원영통", 127.0730, 37.2600],
  ["동탄호수공원", 127.0800, 37.2000],
  ["김포한강신도시", 126.6500, 37.6400],
  ["잠원한강공원", 127.0130, 37.5220],
  ["서울숲", 127.0430, 37.5445],
  ["보라매공원", 126.9190, 37.4940],
  ["월드컵공원", 126.8890, 37.5710],
  ["안양평촌", 126.9700, 37.3940],
  ["과천정부청사", 127.0090, 37.4290],
  ["하남미사강변", 127.1940, 37.5600],
  ["남양주다산", 127.1550, 37.6220],
  ["송파문정", 127.1220, 37.4850],
  ["강서마곡", 126.8280, 37.5620],
  ["은평불광", 126.9300, 37.6110],
  ["노원상계", 127.0640, 37.6600],
  ["구로디지털단지", 126.9010, 37.4850],
  ["관악서울대", 126.9520, 37.4780],
];
async function main() {
  for (const [name, lng, lat] of candidates) {
    try {
      const r = await searchReadyLoopRoute({ start: [lng, lat], profile: "cycling", targetDistanceMeters: 3000, fetchDirections });
      console.log(name, r.status, r.status === "found" ? `dist=${Math.round(r.distance)} overlap=${r.selfOverlapRatio.toFixed(3)}` : `reason=${r.reason} err=${r.closestCandidate?.errorRatio?.toFixed(2)}`);
      if (r.status === "found") {
        console.log(">>> SUCCESS AT", name, lng, lat);
      }
    } catch (e) {
      console.log(name, "ERROR", e.message);
    }
    await new Promise((res) => setTimeout(res, 150));
  }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
