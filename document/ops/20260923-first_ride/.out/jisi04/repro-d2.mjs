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
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
  const j = await res.json();
  if (!res.ok) throw new Error("signIn failed: " + JSON.stringify(j));
  return j.idToken;
}

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

async function main() {
  const idToken = await signInAnon();
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/getDistanceAutoRoute`;

  // 한강 가까운 마포구 지점들 — 합정, 망원, 상암 인근
  const starts = [
    { name: "hapjeong-riverside", coord: [126.9147, 37.5495] },
    { name: "mangwon-riverside", coord: [126.9020, 37.5555] },
    { name: "sangam-riverside", coord: [126.8896, 37.5714] },
    { name: "worldcup-ro-near-river", coord: [126.8980, 37.5595] },
  ];

  for (const s of starts) {
    const requestId = `jisi04_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const t0 = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: { start: s.coord, profile: "cycling", targetDistanceMeters: 3000, closeLoop: true, requestId } }),
    });
    const elapsed = Date.now() - t0;
    const json = await res.json().catch(() => null);
    const result = json?.result ?? json;
    if (result?.geometry?.coordinates) {
      const coords = result.geometry.coordinates;
      console.log(`\n=== ${s.name} === http=${res.status} elapsed=${elapsed}ms`);
      console.log(JSON.stringify({
        status: result.status, closed: result.closed, closeLoop: result.closeLoop,
        coordCount: coords.length, totalLengthM: Math.round(total(coords)), longestLegM: Math.round(longest(coords)),
        distanceField: result.distance, summary: result.summary,
        startPointDistM: Math.round(dist(s.coord, coords[0])),
        firstPoint: coords[0], lastPoint: coords[coords.length - 1],
      }, null, 2));
    } else {
      console.log(`\n=== ${s.name} === http=${res.status} elapsed=${elapsed}ms`);
      console.log(JSON.stringify(result, null, 2));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
