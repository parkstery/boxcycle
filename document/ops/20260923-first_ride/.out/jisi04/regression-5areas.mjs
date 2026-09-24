/**
 * §5 회귀 확인 — 정상 지역 5곳, 폐합 3km. 게이트(V1~V3) 도입 후에도 종전 성공률 유지되는지.
 * 실 Mapbox API 직접 + 실제 컴파일된 distanceAutoRouteCore.js(게이트 포함) 사용.
 */
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

const areas = [
  { name: "여의도공원", coord: [126.9243, 37.5257] },
  { name: "잠실종합운동장", coord: [127.0736, 37.5150] },
  { name: "올림픽공원", coord: [127.1216, 37.5206] },
  { name: "홍대상수", coord: [126.9219, 37.5478] },
  { name: "강남역", coord: [127.0276, 37.4979] },
];

async function main() {
  let success = 0;
  for (const a of areas) {
    const r = await searchReadyLoopRoute({ start: a.coord, profile: "cycling", targetDistanceMeters: 3000, fetchDirections });
    if (r.status === "found") {
      success += 1;
      console.log(a.name, "FOUND", "distance=" + Math.round(r.distance), "overlap=" + r.selfOverlapRatio.toFixed(3), "bearing=" + r.startBearingSampleDeg);
    } else {
      console.log(a.name, "FAILED", r.reason, r.closestCandidate);
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  console.log(`\n성공률: ${success}/${areas.length} = ${((success/areas.length)*100).toFixed(0)}%`);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
