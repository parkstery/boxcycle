// 5A §2 재현 계측 — 서버와 **같은 코드 경로**를 직접 돌린다.
//
// UI 를 거치지 않는다. `searchDistanceAutoRoute` 에 `functions/src/index.ts` 의
// `fetchDirectionsRoute` 와 동일한 형태의 provider 호출을 물려, Chief 조건
// (자동차 · 목표 0.7 km · 강남 일방통행 격자)으로 여러 방향을 찍는다.
//
// 출력: outcome · directRoadMeters · endMissMeters · detourCalls · providerCallCount
//       · algorithmVersion · geometry. A(우리 우회) / B(provider 경로) 판별용.
//
//   node document/ops/route-relay/g5a-probe.mjs [출력경로]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const core = await import(
  new URL(`file:///${path.join(repoRoot, "functions/src/distanceAutoRouteCore.ts").replace(/\\/g, "/")}`)
    .href
);
const { searchDistanceAutoRoute, lineStringLengthMeters } = core;

/** apps/web/.env 에서 Mapbox 토큰을 읽는다(서버 시크릿과 같은 값) */
function readMapboxToken() {
  const envPath = path.join(repoRoot, "apps/web/.env");
  const text = fs.readFileSync(envPath, "utf8");
  const m = text.match(/^VITE_MAPBOX_ACCESS_TOKEN\s*=\s*(.+)$/m);
  if (!m) throw new Error("apps/web/.env 에 VITE_MAPBOX_ACCESS_TOKEN 이 없다");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const TOKEN = readMapboxToken();
let providerCalls = 0;

/** functions/src/index.ts:270 fetchDirectionsRoute 와 같은 요청·응답 형태 */
const fetchDirections = async (profile, waypoints) => {
  providerCalls += 1;
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`directions HTTP ${res.status}`);
  const json = await res.json();
  if (json.code && json.code !== "Ok") throw new Error(`directions ${json.code}`);
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

/** 강남 논현·역삼 일방통행 격자 — Chief 화면과 같은 무대 */
const START = [127.0347, 37.5051];
const D = Number(process.env.G5A_TARGET_M ?? 700);
const PROFILE = process.env.G5A_PROFILE ?? "driving";

const R = 6378137;
function offset(ll, bearingDeg, meters) {
  const br = (bearingDeg * Math.PI) / 180;
  return [
    ll[0] + ((meters * Math.sin(br)) / (R * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI),
    ll[1] + ((meters * Math.cos(br)) / R) * (180 / Math.PI),
  ];
}

// 목표 0.7 km 와 겨루는 거리대(0.4~0.9 km)를 8방위로 찍는다.
const cases = [];
for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
  for (const straightM of [400, 600, 850]) {
    cases.push({ label: `${bearing}°/${straightM}m`, target: offset(START, bearing, straightM) });
  }
}

const out = [];
for (const c of cases) {
  providerCalls = 0;
  const t0 = Date.now();
  let r;
  try {
    r = await searchDistanceAutoRoute({
      start: START,
      targetRoadPoint: c.target,
      profile: PROFILE,
      targetDistanceMeters: D,
      bearingDeg: 0,
      fetchDirections,
    });
  } catch (e) {
    console.log(`${c.label.padEnd(12)} EXCEPTION ${e.message}`);
    continue;
  }
  const row = {
    label: c.label,
    target: c.target,
    status: r.status,
    message: r.status === "failed" ? r.message : undefined,
    outcome: r.status === "found" ? r.outcome : undefined,
    directRoadMeters: r.status === "found" ? r.directRoadMeters : undefined,
    endMissMeters: r.status === "found" ? r.endMissMeters : undefined,
    detourCalls: r.status === "found" ? r.detourCalls : undefined,
    providerCallCount: r.status === "found" ? r.diagnostics?.providerCallCount : r.providerCallCount,
    distance: r.status === "found" ? r.distance : undefined,
    elapsedMs: Date.now() - t0,
    coordinates: r.status === "found" ? r.geometry.coordinates : undefined,
  };
  out.push(row);
  console.log(
    `${c.label.padEnd(12)} ${String(row.status).padEnd(6)} ${String(row.outcome ?? "-").padEnd(9)} ` +
      `direct=${row.directRoadMeters?.toFixed(1) ?? "-"}m dist=${row.distance?.toFixed(1) ?? "-"}m ` +
      `detour=${row.detourCalls ?? "-"} provider=${row.providerCallCount} ` +
      `endMiss=${row.endMissMeters?.toFixed(1) ?? "-"}m pts=${row.coordinates?.length ?? 0}`,
  );
}

const outPath = process.argv[2] ?? path.join(repoRoot, "g5a-probe.json");
fs.writeFileSync(outPath, JSON.stringify({ start: START, targetMeters: D, profile: PROFILE, rows: out }, null, 2));
console.log(`\n표본 ${out.length}건 → ${outPath}`);

const byOutcome = {};
for (const r of out) byOutcome[r.outcome ?? r.status] = (byOutcome[r.outcome ?? r.status] ?? 0) + 1;
console.log("outcome 분포:", JSON.stringify(byOutcome));
console.log("거리 계약 위반(|dist−D|>5m, shortfall 제외):",
  out.filter((r) => r.outcome && r.outcome !== "shortfall" && Math.abs((r.distance ?? 0) - D) > 5).length);
