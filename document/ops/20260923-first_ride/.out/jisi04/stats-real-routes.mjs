/**
 * V1(좌표 밀도)·V2(최장 직선 구간) 임계값 실측 근거 수집.
 * 실 Mapbox Directions API 직접 호출(cycling) — 도심 밀집·교외 간선도로 섞어서 표본을 만든다.
 */
import { readFileSync } from "node:fs";
const envRaw = readFileSync(new URL("../../../../../apps/web/.env", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const TOKEN = env.VITE_MAPBOX_ACCESS_TOKEN;

function metersHelpers() {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dist = (a, b) => {
    const [lng1, lat1] = a, [lng2, lat2] = b;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const total = (coords) => { let s = 0; for (let i = 1; i < coords.length; i++) s += dist(coords[i - 1], coords[i]); return s; };
  const longest = (coords) => { let m = 0; for (let i = 1; i < coords.length; i++) { const d = dist(coords[i - 1], coords[i]); if (d > m) m = d; } return m; };
  return { dist, total, longest };
}
const { dist, total, longest } = metersHelpers();

async function fetchRoute(waypoints, profile = "cycling") {
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);
  const json = await res.json();
  const route = json.routes?.[0];
  return route;
}

const samples = [
  { name: "urban-gangnam-A2B-1.2km", wps: [[127.0276, 37.4979], [127.0356, 37.5040]] },
  { name: "urban-gangnam-A2B-2km", wps: [[127.0276, 37.4979], [127.0430, 37.5060]] },
  { name: "urban-mapo-1.5km", wps: [[126.9016, 37.5563], [126.9160, 37.5500]] },
  { name: "urban-hongdae-1km", wps: [[126.9245, 37.5563], [126.9330, 37.5580]] },
  { name: "suburban-gimpo-8km", wps: [[126.7159, 37.6152], [126.7800, 37.6400]] },
  { name: "riverside-bikepath-5km", wps: [[126.9016, 37.5563], [126.8500, 37.5700]] },
  { name: "yeouido-loop-3km", wps: [[126.9243, 37.5219], [126.9350, 37.5280], [126.9243, 37.5219]] },
  { name: "nonhyeon-loop-found-3km", wps: null }, // filled below via known good candidate
];

async function main() {
  const results = [];
  for (const s of samples) {
    if (!s.wps) continue;
    try {
      const route = await fetchRoute(s.wps, "cycling");
      if (!route) { console.log(s.name, "NO ROUTE"); continue; }
      const coords = route.geometry.coordinates;
      const len = total(coords);
      const rec = {
        name: s.name,
        coordCount: coords.length,
        totalLengthM: Math.round(len),
        pointsPerKm: +(coords.length / (len / 1000)).toFixed(2),
        longestLegM: Math.round(longest(coords)),
        longestLegRatioOfTotal: +(longest(coords) / len).toFixed(4),
      };
      results.push(rec);
      console.log(JSON.stringify(rec));
    } catch (e) {
      console.log(s.name, "ERROR", e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const ppkVals = results.map((r) => r.pointsPerKm).sort((a, b) => a - b);
  const legVals = results.map((r) => r.longestLegM).sort((a, b) => a - b);
  console.log("\npointsPerKm distribution:", ppkVals);
  console.log("longestLegM distribution:", legVals);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
