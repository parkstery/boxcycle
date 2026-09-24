// D1~D6 — 실 운영 백엔드(boxcycle-dc2df) 직접 호출. 인터셉트 없음.
import { readFileSync } from "node:fs";

const envRaw = readFileSync(new URL("../../../../../apps/web/.env", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const API_KEY = env.VITE_FIREBASE_API_KEY;
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;
const REGION = "asia-northeast3";

async function signInAnon() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) },
  );
  const j = await res.json();
  if (!res.ok) throw new Error("signIn failed: " + JSON.stringify(j));
  return j.idToken;
}

function lineStringLengthMeters(coords) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    sum += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return sum;
}

function longestLegMeters(coords) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  let max = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    if (d > max) max = d;
  }
  return max;
}

async function main() {
  console.log("[D] signing in anonymously against", PROJECT_ID);
  const idToken = await signInAnon();
  console.log("[D] got idToken, len=", idToken.length);

  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/getDistanceAutoRoute`;

  // Chief 재현 좌표 — 마포구 월드컵로 일대
  const start = [126.9016, 37.5563];

  async function call(body, label) {
    const requestId = `jisi04_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const t0 = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: { ...body, requestId } }),
    });
    const elapsed = Date.now() - t0;
    const json = await res.json().catch(() => null);
    const result = json?.result ?? json;
    console.log(`\n=== ${label} === http=${res.status} elapsed=${elapsed}ms`);
    if (result?.status === "found" || result?.geometry) {
      const coords = result.geometry.coordinates;
      const len = lineStringLengthMeters(coords);
      const longest = longestLegMeters(coords);
      console.log(JSON.stringify({
        label, status: result.status ?? "found(legacy)", closed: result.closed, closeLoop: result.closeLoop,
        coordCount: coords.length, totalLengthM: Math.round(len), longestLegM: Math.round(longest),
        distanceField: result.distance, summary: result.summary,
        firstPoint: coords[0], lastPoint: coords[coords.length - 1], start,
      }, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return result;
  }

  // D6 — 정상 지역(폐합) 통제군: 강남 일대, closeLoop
  await call({ start: [127.0276, 37.4979], profile: "cycling", targetDistanceMeters: 3000, closeLoop: true }, "D6-gangnam-loop");

  // 버그 재현 — 마포구 월드컵로, closeLoop 3km (편도 폴백 유도)
  await call({ start, profile: "cycling", targetDistanceMeters: 3000, closeLoop: true }, "BUG-mapo-loop");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
