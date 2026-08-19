/**
 * 입문(Basic) 실도로 seed 전용 검증기.
 *
 * 이 검증기는 "Firebase 없이" 도는 정적 계약 게이트다. 허구 좌표·500m 초과·ID 불일치가
 * 앱까지 흘러가기 전에 여기서 먼저 깨진다.
 *
 *   cd apps/web && node scripts/basic-routes-verify/verify-basic-routes.mjs
 *
 * 검사 항목:
 *   C1  경로가 정확히 3개
 *   C2  각 경로 좌표 2개 이상, 모든 좌표 finite / 경위도 범위 안
 *   C3  0 < 좌표 재계산 거리 <= 500m  (nominal 이 아니라 좌표로 증명)
 *   C4  metadata distanceMeters 와 재계산 거리가 허용 오차 이내
 *   C5  bounds 가 모든 좌표를 포함하고 딱 맞음
 *   C6  세 ID 고유 + 레거시 허구 ID 부재
 *   C7  web(BASIC_SHARED_HUB_IDS 파생) 과 functions allowlist 가 같은 세 ID
 *   C8  profile 이 전부 cycling
 *   C9  기존 허구 제목·geometry 가 활성 목록에 없음
 *   C10 좌표가 실제 routing 응답에서 왔다는 증거(evidence.json) 존재 + geometry 해시 일치
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, "..", "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");

const SEED_TS = path.join(WEB_ROOT, "src", "lib", "basicIntroHubRouteGeometries.ts");
const FUNCTIONS_IDS_TS = path.join(REPO_ROOT, "functions", "src", "basicIntroHubSeeds.ts");
const COURSES_TS = path.join(WEB_ROOT, "src", "lib", "firestoreCourses.ts");
const EVIDENCE_JSON = path.join(
  REPO_ROOT,
  "document",
  "archive",
  "260816-입문-실도로-경로-증거",
  "evidence.json",
);

const EXPECTED_ROUTE_COUNT = 3;
const MAX_DISTANCE_METERS = 500;
/** metadata(API distance) vs 좌표 재계산 허용 오차 — 같은 polyline 이므로 작아야 정상 */
const DISTANCE_TOLERANCE_METERS = 15;
const DISTANCE_TOLERANCE_RATIO = 0.03;

/** 이번 교체로 폐기한 허구 직선 경로 — 다시 살아나면 실패시킨다. */
const RETIRED_FICTIONAL_IDS = [
  "basic-mountain-0_5km",
  "basic-coastal-1_0km",
  "basic-mountain-1_5km",
  "basic-intro-nyc-0_5km",
  "basic-intro-rome-0_5km",
  "basic-alps-grindelwald-5km",
  "basic-iceland-ring-road-5km",
];
const RETIRED_FICTIONAL_TITLES = [
  "Mountain Intro",
  "Coastal Tempo",
  "Ridge Climb",
];

const failures = [];
const notes = [];

function check(id, ok, message) {
  if (ok) notes.push(`  ok   ${id} ${message}`);
  else failures.push(`  FAIL ${id} ${message}`);
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

/**
 * seed 는 TS 리터럴이라 그대로 import 할 수 없다(node 가 TS 를 못 읽음).
 * 타입 주석만 벗겨 JSON 화하지 않고, 필요한 필드를 정규식으로 뽑는다 —
 * 파싱이 실패하면 그 자체가 계약 위반이므로 실패로 처리한다.
 */
function parseSeedModule(source) {
  const routes = [];
  const blockRe = /export const \w+: BasicIntroHubRouteSeed = \{([\s\S]*?)\n\};/g;
  let m;
  while ((m = blockRe.exec(source)) !== null) {
    const body = m[1];
    const pick = (key) => {
      const hit = body.match(new RegExp(`\\n  ${key}: (.*?),\\n`));
      return hit ? hit[1] : null;
    };
    const id = pick("id");
    const title = pick("title");
    const profile = pick("profile");
    const distance = pick("distanceMeters");
    const duration = pick("durationSec");
    const order = pick("order");

    const boundsRaw = body.match(/bounds: \{([\s\S]*?)\}/);
    const bounds = {};
    if (boundsRaw) {
      for (const key of ["minLng", "minLat", "maxLng", "maxLat"]) {
        const hit = boundsRaw[1].match(new RegExp(`${key}: (-?[\\d.]+)`));
        bounds[key] = hit ? Number(hit[1]) : NaN;
      }
    }

    const coordsRaw = body.match(/coordinates: \[([\s\S]*?)\n  \]/);
    const coordinates = [];
    if (coordsRaw) {
      const pairRe = /\[(-?[\d.]+), (-?[\d.]+)\]/g;
      let c;
      while ((c = pairRe.exec(coordsRaw[1])) !== null) {
        coordinates.push([Number(c[1]), Number(c[2])]);
      }
    }

    routes.push({
      id: id ? JSON.parse(id) : null,
      title: title ? JSON.parse(title) : null,
      profile: profile ? JSON.parse(profile) : null,
      order: order ? Number(order) : NaN,
      distanceMeters: distance ? Number(distance) : NaN,
      durationSec: duration ? Number(duration) : NaN,
      bounds,
      coordinates,
    });
  }
  return routes;
}

/**
 * functions 쪽 seed 에서 ID 를 뽑는다.
 * `BASIC_INTRO_HUB_PUBLICATION_IDS` 는 `BASIC_INTRO_HUB_SEEDS.map(...)` 로 파생되므로
 * 리터럴 목록이 아니라 seed 블록의 `id:` 를 읽어야 한다.
 */
function parseFunctionsIds(source) {
  const block = source.match(/BASIC_INTRO_HUB_SEEDS[^=]*= \[([\s\S]*?)\n\];/);
  if (!block) return null;
  const ids = [...block[1].matchAll(/\n\s+id: "([^"]+)",/g)].map((m) => m[1]);
  return ids.length > 0 ? ids : null;
}

function main() {
  for (const f of [SEED_TS, FUNCTIONS_IDS_TS, COURSES_TS]) {
    if (!fs.existsSync(f)) {
      console.error(`필수 파일 없음: ${f}`);
      process.exit(1);
    }
  }

  const seedSource = fs.readFileSync(SEED_TS, "utf8");
  const routes = parseSeedModule(seedSource);

  // C1
  check("C1", routes.length === EXPECTED_ROUTE_COUNT, `경로 수 = ${routes.length} (기대 ${EXPECTED_ROUTE_COUNT})`);
  if (routes.length === 0) {
    console.error("seed 를 하나도 파싱하지 못했습니다 — 형식이 바뀌었는지 확인하세요.");
    process.exit(1);
  }

  for (const r of routes) {
    const tag = r.id ?? "(id없음)";

    // C2
    const finite = r.coordinates.every(
      ([lng, lat]) =>
        Number.isFinite(lng) && Number.isFinite(lat) &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
    );
    check("C2", r.coordinates.length >= 2 && finite,
      `${tag} 좌표 ${r.coordinates.length}개, 전부 유한/범위내=${finite}`);

    if (r.coordinates.length < 2) continue;

    // C3 — nominal 이 아니라 좌표로 증명
    const recomputed = polylineLengthMeters(r.coordinates);
    check("C3", recomputed > 0 && recomputed <= MAX_DISTANCE_METERS,
      `${tag} 좌표 재계산 거리 = ${recomputed.toFixed(1)}m (<= ${MAX_DISTANCE_METERS}m)`);

    // C4
    const delta = Math.abs(recomputed - r.distanceMeters);
    const tol = Math.max(DISTANCE_TOLERANCE_METERS, r.distanceMeters * DISTANCE_TOLERANCE_RATIO);
    check("C4", delta <= tol,
      `${tag} metadata ${r.distanceMeters}m vs 재계산 ${recomputed.toFixed(1)}m (차 ${delta.toFixed(1)}m <= ${tol.toFixed(1)}m)`);

    // C5
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of r.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const boundsOk =
      Math.abs(minLng - r.bounds.minLng) < 1e-9 &&
      Math.abs(minLat - r.bounds.minLat) < 1e-9 &&
      Math.abs(maxLng - r.bounds.maxLng) < 1e-9 &&
      Math.abs(maxLat - r.bounds.maxLat) < 1e-9;
    check("C5", boundsOk, `${tag} bounds 가 좌표 전체와 일치`);

    // C8
    check("C8", r.profile === "cycling", `${tag} profile = ${r.profile}`);
  }

  // C6
  const ids = routes.map((r) => r.id);
  check("C6", new Set(ids).size === ids.length, `ID 고유: ${ids.join(", ")}`);
  const retiredPresent = ids.filter((id) => RETIRED_FICTIONAL_IDS.includes(id));
  check("C6", retiredPresent.length === 0, `폐기된 허구 ID 부재 (발견: ${retiredPresent.join(", ") || "없음"})`);

  // C7
  const fnIds = parseFunctionsIds(fs.readFileSync(FUNCTIONS_IDS_TS, "utf8"));
  check("C7", Array.isArray(fnIds), "functions ID 목록 파싱");
  if (Array.isArray(fnIds)) {
    const same =
      fnIds.length === ids.length && ids.every((id) => fnIds.includes(id));
    check("C7", same, `web ↔ functions ID 집합 일치 (functions: ${fnIds.join(", ")})`);
  }

  // C9 — 허구 좌표/제목이 활성 SoT 에 남아 있지 않은지
  const coursesSource = fs.readFileSync(COURSES_TS, "utf8");
  const leakedIds = RETIRED_FICTIONAL_IDS.filter((id) => coursesSource.includes(`"${id}"`));
  check("C9", leakedIds.length === 0,
    `firestoreCourses.ts 에 폐기 ID 없음 (발견: ${leakedIds.join(", ") || "없음"})`);
  const leakedTitles = RETIRED_FICTIONAL_TITLES.filter((t) => coursesSource.includes(t));
  check("C9", leakedTitles.length === 0,
    `firestoreCourses.ts 에 허구 제목 없음 (발견: ${leakedTitles.join(", ") || "없음"})`);
  check("C9", coursesSource.includes("BASIC_INTRO_HUB_ROUTE_SEEDS"),
    "BASIC_COURSES 가 실도로 seed 에서 파생");

  // C10 — routing 응답 증거
  if (!fs.existsSync(EVIDENCE_JSON)) {
    check("C10", false, `증거 파일 없음: ${EVIDENCE_JSON}`);
  } else {
    const ev = JSON.parse(fs.readFileSync(EVIDENCE_JSON, "utf8"));
    const evById = new Map((ev.routes ?? []).map((e) => [e.id, e]));
    check("C10", evById.size === routes.length, `증거 항목 ${evById.size}개`);
    for (const r of routes) {
      const e = evById.get(r.id);
      if (!e) {
        check("C10", false, `${r.id} 증거 없음`);
        continue;
      }
      const providerOk = /Mapbox Directions/.test(e.provider ?? "") && e.profile === "cycling";
      check("C10", providerOk, `${r.id} provider=${e.provider} profile=${e.profile}`);
      check("C10", typeof e.responseSha256 === "string" && e.responseSha256.length === 64,
        `${r.id} 응답 SHA-256 기록`);
      check("C10", typeof e.requestedAt === "string" && e.requestedAt.length > 0,
        `${r.id} 요청 시각 기록`);
      check("C10", !JSON.stringify(e).includes("access_token=pk."),
        `${r.id} 증거에 토큰 없음`);
      check("C10", e.coordinateCount === r.coordinates.length,
        `${r.id} 증거 좌표 수 ${e.coordinateCount} == seed ${r.coordinates.length}`);
      const snaps = e.waypointSnapDistanceMeters ?? [];
      check("C10", snaps.length >= 2 && snaps.every((d) => typeof d === "number" && d <= 1),
        `${r.id} 출발·도착이 도로 위(snap ${snaps.map((d) => Number(d).toFixed(3)).join(", ")}m)`);
      check("C10", Array.isArray(e.roadNames) && e.roadNames.length > 0,
        `${r.id} 도로명 근거: ${(e.roadNames ?? []).join(" | ")}`);
    }
  }

  console.info("입문 실도로 seed 검증");
  for (const n of notes) console.info(n);
  if (failures.length > 0) {
    console.error(`\n실패 ${failures.length}건:`);
    for (const f of failures) console.error(f);
    process.exit(1);
  }
  console.info(`\n통과 — ${notes.length}개 검사, 실패 0`);
}

main();
