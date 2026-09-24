/**
 * 지시04 정정 §3 — 도심(논현동) Ready Ride 폐합 실패 진단.
 * 실 Mapbox Directions API 를 직접 호출한다(인터셉트 아님). 오케스트레이션은
 * functions/lib/distanceAutoRouteCore.js(실제 컴파일 산출물)의 searchReadyLoopRoute 를
 * 그대로 사용한다 — Cloud Function 계층(HTTP orchestration)만 우회했다. 이유: Cloud Logging
 * 이 firebase functions:log 로 조회되지 않아(gen2 제약, 재확인함) 방위별 진단 수치를
 * 얻을 방법이 이것뿐이었다.
 */
import { readFileSync } from "node:fs";
import { searchReadyLoopRoute, READY_LOOP_BEARING_SAMPLES_DEG, OUT_AND_BACK_OVERLAP_REJECT_RATIO, MAX_DISTANCE_ERROR_RATIO } from "../../../../../functions/lib/distanceAutoRouteCore.js";

const envRaw = readFileSync(new URL("../../../../../apps/web/.env", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const MAPBOX_TOKEN = env.VITE_MAPBOX_ACCESS_TOKEN;

let providerCalls = 0;
async function fetchDirections(profile, waypoints) {
  providerCalls += 1;
  const coords = waypoints.map((w) => `${w[0]},${w[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code && json.code !== "Ok") {
    throw new Error(`mapbox ${json.code}: ${json.message}`);
  }
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

// 논현동 일대 5개 지점 (도심 격자)
const starts = [
  { name: "nonhyeon-1", coord: [127.0356, 37.5106] },
  { name: "nonhyeon-2", coord: [127.0296, 37.5133] },
  { name: "nonhyeon-3", coord: [127.0339, 37.5088] },
  { name: "nonhyeon-4", coord: [127.0247, 37.5116] },
  { name: "nonhyeon-5", coord: [127.0380, 37.5145] },
];
const targets = [2000, 3000];

async function main() {
  console.log("bearing samples:", READY_LOOP_BEARING_SAMPLES_DEG);
  console.log("overlap reject ratio:", OUT_AND_BACK_OVERLAP_REJECT_RATIO, "max distance error ratio:", MAX_DISTANCE_ERROR_RATIO);
  const results = [];
  for (const s of starts) {
    for (const D of targets) {
      providerCalls = 0;
      const t0 = Date.now();
      const r = await searchReadyLoopRoute({
        start: s.coord,
        profile: "cycling",
        targetDistanceMeters: D,
        fetchDirections,
      });
      const elapsed = Date.now() - t0;
      const rec = { name: s.name, D, providerCalls, elapsedMs: elapsed, status: r.status };
      if (r.status === "found") {
        rec.selfOverlapRatio = r.selfOverlapRatio;
        rec.distance = Math.round(r.distance);
        rec.errorRatio = Math.abs(r.distance - D) / D;
      } else {
        rec.reason = r.reason;
        rec.closestCandidate = r.closestCandidate;
      }
      results.push(rec);
      console.log(JSON.stringify(rec));
      await new Promise((res) => setTimeout(res, 200));
    }
  }
  const successCount = results.filter((r) => r.status === "found").length;
  console.log(`\n=== 요약: 논현동 ${results.length}건 중 성공 ${successCount}건 (성공률 ${((successCount / results.length) * 100).toFixed(0)}%) ===`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
