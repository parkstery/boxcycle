/**
 * 입문(Basic) 실도로 경로 3개 생성기 — Mapbox Directions `cycling` / `overview=full` / GeoJSON.
 *
 * 이 스크립트가 만드는 것(단일 진실):
 *   1. apps/web/src/lib/basicIntroHubRouteGeometries.ts  — geometry SoT (BASIC_COURSES 가 파생)
 *   2. functions/src/basicIntroHubSeeds.ts               — Functions 쪽 동일 seed + allowlist
 *   3. document/archive/260816-입문-실도로-경로-증거/     — 요청·응답·해시 증거(토큰 제거)
 *   4. 같은 폴더의 Mapbox Static Images 스크린샷(도로 위 경로선)
 *
 * 규칙:
 *   - 좌표를 사람이 찍지 않는다. 출발·도착만 지정하고 나머지는 routing 응답 그대로 쓴다.
 *   - runtime 은 Directions 를 호출하지 않는다. 여기서 고정한 seed 만 사용한다.
 *   - 토큰은 증거·로그·산출물 어디에도 남기지 않는다.
 *
 *   node scripts/gen-basic-intro-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const EVIDENCE_DIR = "document/archive/260816-입문-실도로-경로-증거";

/**
 * 출발·도착은 Directions 가 이미 도로에 스냅한 좌표(waypoint.location)로 고정했다.
 * → 재실행 시 `waypoints[].distance` 가 0 이어야 한다(=도로 위 실좌표라는 증거).
 */
const ROUTE_SPECS = [
  {
    id: "basic-intro-seoul-namsan",
    order: 1,
    constName: "BASIC_INTRO_SEOUL_NAMSAN_ROUTE",
    title: "Basic 1 · 서울 남산공원길",
    description: "남산 북사면을 감아 도는 남산공원길 구간. 완만한 곡선으로 조향·카메라에 적응하는 입문 경로.",
    from: [126.988622, 37.5486],
    to: [126.984975, 37.549777],
  },
  {
    id: "basic-intro-paris-pont-neuf",
    order: 2,
    constName: "BASIC_INTRO_PARIS_PONT_NEUF_ROUTE",
    title: "Basic 2 · 파리 퐁뇌프",
    description: "센 강 좌안 Rue de Nevers 에서 퐁뇌프를 건너 시테섬 Quai des Orfèvres 로 이어지는 입문 경로.",
    from: [2.33996, 48.856046],
    to: [2.343945, 48.854744],
  },
  {
    id: "basic-intro-nyc-central-park",
    order: 3,
    constName: "BASIC_INTRO_NYC_CENTRAL_PARK_ROUTE",
    title: "Basic 3 · 뉴욕 센트럴파크",
    description: "센트럴파크 순환로 West Drive 남행 구간. 차량이 통제된 공원 순환로를 따라 달리는 입문 경로.",
    from: [-73.969407, 40.781743],
    to: [-73.972581, 40.778609],
  },
];

const PROFILE = "cycling";
const SEED_REVISION = 3;
const MAX_DISTANCE_METERS = 500;

function readMapboxToken() {
  const files = [
    path.resolve("apps/web/.env.local"),
    path.resolve("apps/web/.env"),
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*VITE_MAPBOX_ACCESS_TOKEN\s*=\s*(.+?)\s*$/);
      if (m && m[1].length > 0) return m[1];
    }
  }
  if (process.env.MAPBOX_ACCESS_TOKEN) return process.env.MAPBOX_ACCESS_TOKEN.trim();
  throw new Error("Mapbox 토큰 없음 — apps/web/.env 의 VITE_MAPBOX_ACCESS_TOKEN 을 설정하세요.");
}

/** 토큰이 실수로 섞여 나가지 않도록 모든 산출 문자열을 통과시킨다. */
function scrubToken(text, token) {
  return text.split(token).join("<REDACTED_MAPBOX_TOKEN>");
}

function haversineMeters(a, b) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function polylineLengthMeters(coords) {
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

function boundsOf(coords) {
  let minLng = coords[0][0];
  let maxLng = minLng;
  let minLat = coords[0][1];
  let maxLat = minLat;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

async function requestRoute(token, spec) {
  const coordStr = `${spec.from[0]},${spec.from[1]};${spec.to[0]},${spec.to[1]}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    access_token: token,
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/${PROFILE}/${coordStr}?${params}`;
  const requestedAt = new Date().toISOString();
  const res = await fetch(url);
  const raw = await res.text();
  if (!res.ok) throw new Error(`Directions ${res.status} (${spec.id}): ${raw.slice(0, 200)}`);
  return {
    requestedAt,
    /** 응답 원본 SHA-256 — 이 seed 가 어느 응답에서 나왔는지 고정 */
    responseSha256: crypto.createHash("sha256").update(raw, "utf8").digest("hex"),
    /** 증거용 URL(토큰 제거) */
    requestUrl: `https://api.mapbox.com/directions/v5/mapbox/${PROFILE}/${coordStr}?geometries=geojson&overview=full&steps=true&access_token=<REDACTED_MAPBOX_TOKEN>`,
    raw,
    json: JSON.parse(raw),
  };
}

function roadNamesOf(route) {
  const names = [];
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const n = (step.name ?? "").trim();
      if (n && !names.includes(n)) names.push(n);
    }
  }
  return names;
}

function tsRouteLiteral(spec, built) {
  const coords = built.coordinates.map((c) => `    [${c[0]}, ${c[1]}],`).join("\n");
  const b = built.bounds;
  return `export const ${spec.constName}: BasicIntroHubRouteSeed = {
  id: "${spec.id}",
  order: ${spec.order},
  title: "${spec.title}",
  description: "${spec.description}",
  profile: "cycling",
  /** Directions 응답 distance (m) */
  distanceMeters: ${built.distanceMeters},
  /** Directions 응답 duration (s) */
  durationSec: ${built.durationSec},
  /** 도로 근거 — Directions steps 의 도로명 */
  roadNames: [${built.roadNames.map((n) => JSON.stringify(n)).join(", ")}],
  bounds: {
    minLng: ${b.minLng},
    minLat: ${b.minLat},
    maxLng: ${b.maxLng},
    maxLat: ${b.maxLat},
  },
  coordinates: [
${coords}
  ],
};`;
}

function renderSeedModule(entries) {
  return `// 자동 생성 — 직접 수정하지 말 것. \`node scripts/gen-basic-intro-routes.mjs\` 로 재생성한다.
//
// 입문(Basic) 실도로 경로 SoT. Mapbox Directions \`cycling\` / \`overview=full\` / GeoJSON 응답을
// 그대로 고정한 seed 이며, runtime 에서 Directions 를 호출하지 않는다.
// \`firestoreCourses.ts\` 의 \`BASIC_COURSES\`·\`BASIC_SHARED_HUB_IDS\` 가 이 파일에서 파생된다.
// 증거: document/archive/260816-입문-실도로-경로-증거/

/** seed 리비전 — geometry 가 바뀌면 올린다(Firestore 재시드 판단에 쓰임). */
export const BASIC_INTRO_HUB_ROUTE_REVISION = ${SEED_REVISION};

/** 입문 경로 상한 — 좌표 재계산 길이 기준(m) */
export const BASIC_INTRO_MAX_DISTANCE_METERS = ${MAX_DISTANCE_METERS};

export type BasicIntroHubRouteSeed = {
  id: string;
  order: number;
  title: string;
  description: string;
  profile: "cycling";
  distanceMeters: number;
  durationSec: number;
  roadNames: string[];
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  coordinates: [number, number][];
};

${entries.join("\n\n")}

export const BASIC_INTRO_HUB_ROUTE_SEEDS: readonly BasicIntroHubRouteSeed[] = [
${ROUTE_SPECS.map((s) => `  ${s.constName},`).join("\n")}
];
`;
}

function renderFunctionsSeedModule(builtById) {
  const entries = ROUTE_SPECS.map((spec) => {
    const built = builtById.get(spec.id);
    const coords = built.coordinates.map((c) => `      [${c[0]}, ${c[1]}],`).join("\n");
    return `  {
    id: "${spec.id}",
    order: ${spec.order},
    title: "${spec.title}",
    description: "${spec.description}",
    profile: "cycling",
    distanceMeters: ${built.distanceMeters},
    durationSec: ${built.durationSec},
    coordinates: [
${coords}
    ],
  },`;
  }).join("\n");

  return `// 자동 생성 — 직접 수정하지 말 것. \`node scripts/gen-basic-intro-routes.mjs\` 로 재생성한다.
//
// 입문(Basic) publication seed — \`apps/web/src/lib/basicIntroHubRouteGeometries.ts\` 와 같은
// Mapbox Directions cycling 응답에서 나온 동일 좌표다. Admin 마이그레이션(\`cliSeedBasicIntroPublications\`)과
// presence allowlist(\`publicationPresenceCore\`)가 이 파일을 쓴다.
// 두 파일의 ID 집합 일치는 \`apps/web/scripts/basic-routes-verify/verify-basic-routes.mjs\` 가 검사한다.

import type { LngLat } from "./routeFingerprintCore.js";

/** seed 리비전 — geometry 가 바뀌면 올린다. Firestore 문서의 \`basicSeedRevision\` 과 비교한다. */
export const BASIC_INTRO_HUB_ROUTE_REVISION = ${SEED_REVISION};

export type BasicIntroHubSeed = {
  id: string;
  order: number;
  title: string;
  description: string;
  profile: "cycling";
  distanceMeters: number;
  durationSec: number;
  coordinates: LngLat[];
};

export const BASIC_INTRO_HUB_SEEDS: readonly BasicIntroHubSeed[] = [
${entries}
];

export const BASIC_INTRO_HUB_PUBLICATION_IDS: readonly string[] = BASIC_INTRO_HUB_SEEDS.map(
  (s) => s.id,
);
`;
}

async function writeStaticMapShot(token, spec, built, outPath) {
  // 좌표를 6자리로 유지한 GeoJSON overlay — URL 길이 한도(8192) 안에 들어간다.
  const overlay = {
    type: "Feature",
    properties: { stroke: "#ff2d55", "stroke-width": 5, "stroke-opacity": 0.9 },
    geometry: { type: "LineString", coordinates: built.coordinates },
  };
  const encoded = encodeURIComponent(JSON.stringify(overlay));
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/geojson(${encoded})` +
    `/auto/900x700@2x?padding=60&access_token=${token}`;
  if (url.length > 8192) throw new Error(`static map URL too long (${spec.id}): ${url.length}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`static map ${res.status} (${spec.id}): ${(await res.text()).slice(0, 160)}`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const token = readMapboxToken();
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const entries = [];
  const evidence = [];
  const builtById = new Map();

  for (const spec of ROUTE_SPECS) {
    const resp = await requestRoute(token, spec);
    const route = resp.json.routes?.[0];
    if (!route) throw new Error(`경로 없음: ${spec.id}`);

    const coordinates = route.geometry.coordinates;
    const recomputed = polylineLengthMeters(coordinates);
    const snapDistances = (resp.json.waypoints ?? []).map((w) => w.distance ?? null);

    const built = {
      coordinates,
      distanceMeters: Math.round(route.distance),
      durationSec: Math.round(route.duration),
      roadNames: roadNamesOf(route),
      bounds: boundsOf(coordinates),
    };

    // 게이트 — 여기서 막지 못하면 허구가 seed 로 들어간다.
    if (coordinates.length < 2) throw new Error(`좌표 부족: ${spec.id}`);
    if (!(recomputed > 0 && recomputed <= MAX_DISTANCE_METERS)) {
      throw new Error(`좌표 재계산 길이 초과: ${spec.id} = ${recomputed.toFixed(1)}m`);
    }
    if (built.distanceMeters > MAX_DISTANCE_METERS) {
      throw new Error(`API 거리 초과: ${spec.id} = ${built.distanceMeters}m`);
    }
    for (const d of snapDistances) {
      if (d === null || d > 1) throw new Error(`출발·도착이 도로 위가 아님: ${spec.id} snap=${d}`);
    }

    entries.push(tsRouteLiteral(spec, built));
    builtById.set(spec.id, built);

    const shot = `${spec.id}.png`;
    await writeStaticMapShot(token, spec, built, path.join(EVIDENCE_DIR, shot));

    evidence.push({
      id: spec.id,
      title: spec.title,
      provider: "Mapbox Directions API v5",
      profile: PROFILE,
      overview: "full",
      geometries: "geojson",
      requestUrl: resp.requestUrl,
      requestedAt: resp.requestedAt,
      responseSha256: resp.responseSha256,
      startLngLat: spec.from,
      endLngLat: spec.to,
      waypointSnapDistanceMeters: snapDistances,
      apiDistanceMeters: route.distance,
      apiDurationSec: route.duration,
      recomputedPolylineMeters: Number(recomputed.toFixed(2)),
      recomputedVsApiDeltaMeters: Number((recomputed - route.distance).toFixed(2)),
      coordinateCount: coordinates.length,
      bounds: built.bounds,
      roadNames: built.roadNames,
      screenshot: shot,
    });

    // 토큰 제거한 API 원본 보존
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, `${spec.id}.directions.json`),
      scrubToken(resp.raw, token),
      "utf8",
    );

    console.info(
      `${spec.id}: api=${built.distanceMeters}m recomputed=${recomputed.toFixed(1)}m pts=${coordinates.length} snap=[${snapDistances.join(",")}] roads=${built.roadNames.join(" | ")}`,
    );
  }

  fs.writeFileSync(
    "apps/web/src/lib/basicIntroHubRouteGeometries.ts",
    renderSeedModule(entries),
    "utf8",
  );
  fs.writeFileSync(
    "functions/src/basicIntroHubSeeds.ts",
    renderFunctionsSeedModule(builtById),
    "utf8",
  );
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "evidence.json"),
    scrubToken(JSON.stringify({ generatedAt: new Date().toISOString(), maxDistanceMeters: MAX_DISTANCE_METERS, routes: evidence }, null, 2), token),
    "utf8",
  );

  console.info("written: apps/web/src/lib/basicIntroHubRouteGeometries.ts");
  console.info("written: functions/src/basicIntroHubSeeds.ts");
  console.info(`written: ${EVIDENCE_DIR}/ (evidence.json, *.directions.json, *.png)`);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
