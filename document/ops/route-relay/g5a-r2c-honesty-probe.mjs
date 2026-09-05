// 5A-R2c §5.4 — 직선 ∈ [0.9D, 1.0D] 성공률 · 직선 ≥ D 우회 0회 (Mapbox)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const core = await import(
  new URL(`file:///${path.join(repoRoot, "functions/src/distanceAutoRouteCore.ts").replace(/\\/g, "/")}`).href
);
const { searchDistanceAutoRoute } = core;

function readMapboxToken() {
  const text = fs.readFileSync(path.join(repoRoot, "apps/web/.env"), "utf8");
  const m = text.match(/^VITE_MAPBOX_ACCESS_TOKEN\s*=\s*(.+)$/m);
  if (!m) throw new Error("no token");
  return m[1].trim().replace(/^["']|["']$/g, "");
}
const TOKEN = readMapboxToken();
let providerCalls = 0;
let threeWaypoint = 0;
const fetchDirections = async (profile, waypoints) => {
  providerCalls += 1;
  if (waypoints.length === 3) threeWaypoint += 1;
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route?.geometry) throw new Error("no route");
  const last = json.waypoints?.[json.waypoints.length - 1];
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    snappedEnd: Array.isArray(last?.location) ? last.location : undefined,
    endSnapDistanceMeters: typeof last?.distance === "number" ? last.distance : undefined,
  };
};

const START = [127.0347, 37.5051];
const D = 700;
const R = 6378137;
function offset(ll, bearingDeg, meters) {
  const br = (bearingDeg * Math.PI) / 180;
  return [
    ll[0] + ((meters * Math.sin(br)) / (R * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI),
    ll[1] + ((meters * Math.cos(br)) / R) * (180 / Math.PI),
  ];
}

const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
// 0.9D=630, 0.95D=665, 1.0D=700 — §2.4 표 대응
const straights = [630, 665, 700, 750];
const rows = [];
for (const bearing of bearings) {
  for (const straightM of straights) {
    providerCalls = 0;
    threeWaypoint = 0;
    const r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: offset(START, bearing, straightM),
      profile: "driving",
      targetDistanceMeters: D,
      bearingDeg: bearing,
      fetchDirections,
    });
    rows.push({
      label: `${bearing}°/${straightM}m`,
      straightM,
      status: r.status,
      outcome: r.status === "found" ? r.outcome : "failed",
      directRoadMeters: r.status === "found" ? r.directRoadMeters : null,
      detourCalls: r.status === "found" ? (r.detourCalls ?? 0) : 0,
      threeWaypoint,
      providerCalls,
    });
    console.log(
      `${bearing}°/${straightM}m`.padEnd(14),
      r.status,
      r.status === "found" ? r.outcome : "-",
      `road=${r.status === "found" ? r.directRoadMeters?.toFixed(0) : "-"}`,
      `3wp=${threeWaypoint}`,
      `prov=${providerCalls}`,
    );
  }
}

function band(minInclusive, maxInclusive) {
  const xs = rows.filter((r) => r.straightM >= minInclusive && r.straightM <= maxInclusive);
  const ok = xs.filter((r) => r.status === "found").length;
  const fail = xs.filter((r) => r.status === "failed").length;
  const detour = xs.reduce((a, r) => a + (r.threeWaypoint || r.detourCalls || 0), 0);
  return { n: xs.length, ok, fail, rate: xs.length ? ok / xs.length : 0, detour };
}

const report = {
  D,
  bands: {
    "0.90D-1.00D": band(630, 700),
    "0.90D": band(630, 630),
    "0.95D": band(665, 665),
    "1.00D": band(700, 700),
    "geD": band(700, 750),
  },
  rows,
};
fs.writeFileSync(
  path.join(__dirname, "g5a-r2c-honesty.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log("\n=== §5.4 summary ===");
for (const [k, v] of Object.entries(report.bands)) {
  console.log(
    `${k}: n=${v.n} success=${v.ok} fail=${v.fail} rate=${(v.rate * 100).toFixed(1)}% threeWaypointSum=${v.detour}`,
  );
}