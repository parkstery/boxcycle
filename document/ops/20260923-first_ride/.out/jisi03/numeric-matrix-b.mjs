/**
 * 지시03 §B5 수치표 산출 — searchReadyLoopRoute + searchDistanceAutoRoute(실제 서버 알고리즘,
 * functions/lib 컴파일 산출물)를 직접 import 해서, distanceAutoRouteHttp.ts 의 closeLoop 폴백
 * 오케스트레이션(§B3)을 **그대로 복제**해 좌표 4곳 이상에 돌린다.
 *
 * http.ts 자체는 firebase-admin(Firestore)·Token 이 필요해 로컬에서 바로 import 할 수 없으므로
 * (지시02 numeric-matrix.mjs 와 같은 이유), 오케스트레이션 로직만 이 스크립트에 그대로 옮겨 왔다.
 * searchReadyLoopRoute·searchDistanceAutoRoute·offsetLngLatByBearingMeters 는 전부 실제 컴파일
 * 산출물이다 — 재구현이 아니다.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../../../../../functions/lib/distanceAutoRouteCore.js");

const {
  searchReadyLoopRoute,
  searchDistanceAutoRoute,
  getDistanceMeters,
  offsetLngLatByBearingMeters,
  bearingFromOriginToPoint,
  lineStringLengthMeters,
} = core;

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function interpolate(a, b, steps) {
  const out = [];
  for (let i = 1; i <= steps; i += 1) out.push(lerp(a, b, i / steps));
  return out;
}
function detourPath(a, b, roadFactor, steps = 24) {
  const straight = getDistanceMeters(a, b);
  if (straight < 1) return [b];
  const half = straight / 2;
  const bumpH = roadFactor > 1 ? half * Math.sqrt(Math.max(0, roadFactor * roadFactor - 1)) : 0;
  const mid = lerp(a, b, 0.5);
  const brg = bearingFromOriginToPoint(a, b);
  const bump = bumpH > 0 ? offsetLngLatByBearingMeters(mid, (brg + 90) % 360, bumpH) : mid;
  return [...interpolate(a, bump, Math.ceil(steps / 2)), ...interpolate(bump, b, Math.ceil(steps / 2))];
}
function makeUrbanFetchDirections(roadFactor) {
  return async (profile, waypoints) => {
    const coords = [waypoints[0]];
    for (let i = 1; i < waypoints.length; i += 1) coords.push(...detourPath(waypoints[i - 1], waypoints[i], roadFactor));
    const distance = lineStringLengthMeters({ type: "LineString", coordinates: coords });
    return {
      geometry: { type: "LineString", coordinates: coords },
      distance,
      duration: distance / 5,
      snappedEnd: waypoints[waypoints.length - 1],
      endSnapDistanceMeters: 0,
    };
  };
}
/** 3점 폐합 waypoints([start,w1,w2,start])를 받아 항상 out-and-back 처럼 동일 경로로 왕복하게 만든다
 *  → 모든 방위에서 자기중복률이 임계(60%)를 넘어 loop 가 반드시 "no_loop" 로 실패한다. */
function makeOutAndBackFetchDirections() {
  return async (profile, waypoints) => {
    if (waypoints.length === 4) {
      // start -> w1 -> w2 -> start 인데 w2 를 w1 과 거의 같은 지점으로 눌러 왕복을 강제한다.
      const [start, w1] = waypoints;
      const coords = [start, ...interpolate(start, w1, 30), ...interpolate(w1, start, 30)];
      const distance = lineStringLengthMeters({ type: "LineString", coordinates: coords });
      return {
        geometry: { type: "LineString", coordinates: coords },
        distance,
        duration: distance / 5,
        snappedEnd: start,
        endSnapDistanceMeters: 0,
      };
    }
    // searchDistanceAutoRoute 의 2점 직행 호출 — 정상 도로로 응답(편도는 성공해야 한다).
    return makeUrbanFetchDirections(1.15)(profile, waypoints);
  };
}
/** 도로 자체가 없는 지역 — 모든 호출이 실패한다(해상 등). */
function makeNoRoadFetchDirections() {
  return async () => {
    throw new Error("no route found");
  };
}
/** 거리 오차가 항상 허용치(±20%)를 넘게 만드는 고배율 지역(카이로 데모와 같은 성격). */
function makeHighDetourFetchDirections() {
  return makeUrbanFetchDirections(1.55);
}

function geometryHash(geometry) {
  const c = geometry.coordinates;
  return `${c.length}:${c[0]?.[0]?.toFixed(4)},${c[0]?.[1]?.toFixed(4)}:${c[c.length - 1]?.[0]?.toFixed(4)},${c[c.length - 1]?.[1]?.toFixed(4)}:${c[Math.floor(c.length / 2)]?.[0]?.toFixed(4)}`;
}

/** distanceAutoRouteHttp.ts executeDistanceAutoRoute 의 closeLoop 분기(§B3)를 그대로 복제 — 토큰 없이. */
async function runCloseLoopWithFallback({ start, targetDistanceMeters, fetchDirections, excludeStartBearingDeg }) {
  const loopSearched = await searchReadyLoopRoute({
    start,
    profile: "cycling",
    targetDistanceMeters,
    fetchDirections,
    excludeBearingsDeg: excludeStartBearingDeg !== undefined ? [excludeStartBearingDeg] : undefined,
  });

  if (loopSearched.status === "found") {
    return {
      status: "found",
      closed: true,
      geometry: loopSearched.geometry,
      distance: loopSearched.distance,
      startBearingSampleDeg: loopSearched.startBearingSampleDeg,
      providerCallCount: loopSearched.providerCallCount,
    };
  }

  const fallbackBearingDeg = loopSearched.closestCandidate?.bearingDeg;
  if (fallbackBearingDeg !== undefined) {
    const fallbackTargetRoadPoint = offsetLngLatByBearingMeters(start, fallbackBearingDeg, targetDistanceMeters);
    const onewaySearched = await searchDistanceAutoRoute({
      start,
      targetRoadPoint: fallbackTargetRoadPoint,
      profile: "cycling",
      targetDistanceMeters,
      bearingDeg: fallbackBearingDeg,
      fetchDirections,
    });
    if (onewaySearched.status === "found") {
      return {
        status: "found",
        closed: false,
        geometry: onewaySearched.geometry,
        distance: onewaySearched.distance,
        startBearingSampleDeg: fallbackBearingDeg,
        providerCallCount: loopSearched.providerCallCount + onewaySearched.diagnostics.providerCallCount,
      };
    }
    return {
      status: "failed",
      reason: "oneway_also_failed",
      providerCallCount: loopSearched.providerCallCount + onewaySearched.providerCallCount,
    };
  }
  return { status: "failed", reason: loopSearched.reason, providerCallCount: loopSearched.providerCallCount };
}

const COORDS = [
  { name: "서울 도심(광화문, 정상 도로 — loop 성공 통제군)", start: [126.9784, 37.5665], fetchDirections: makeUrbanFetchDirections(1.15) },
  { name: "out-and-back 강제(전 방위 자기중복 — loop no_loop → 편도 기대)", start: [126.9016, 37.5563], fetchDirections: makeOutAndBackFetchDirections() },
  { name: "고배율 지역(오차 55% — loop no_loop → 편도 기대, 카이로류)", start: [31.2357, 30.0444], fetchDirections: makeHighDetourFetchDirections() },
  { name: "해상(도로 없음 — loop no_road → 편도도 불가 → 진짜 실패 기대)", start: [-30.0, 0.0], fetchDirections: makeNoRoadFetchDirections() },
  { name: "도쿄(정상 도로 — loop 성공 통제군 2)", start: [139.6917, 35.6895], fetchDirections: makeUrbanFetchDirections(1.2) },
];

async function main() {
  console.log("## §B5-1 폐합 실패 좌표에서 편도 대안 생성 성공률 · 프로바이더 호출 수\n");
  const rows = [];
  for (const c of COORDS) {
    const r = await runCloseLoopWithFallback({ start: c.start, targetDistanceMeters: 3000, fetchDirections: c.fetchDirections });
    rows.push({ name: c.name, ...r });
    console.log(
      `${c.name} → status=${r.status} closed=${r.closed ?? "-"} providerCallCount=${r.providerCallCount} ` +
        `distance=${r.distance ? (r.distance / 1000).toFixed(2) + "km" : "-"} bearing=${r.startBearingSampleDeg ?? "-"} reason=${r.reason ?? "-"}`,
    );
  }

  const attemptedFallback = rows.filter((r) => r.status === "found" && r.closed === false
    || (r.status === "failed" && r.reason === "oneway_also_failed"));
  const fallbackTargets = rows.filter((r, i) => COORDS[i].name.includes("편도 기대"));
  const fallbackSuccess = fallbackTargets.filter((r) => r.status === "found" && r.closed === false);
  console.log(
    `\n편도 대상 좌표: ${fallbackTargets.length}곳 중 편도 성공 ${fallbackSuccess.length}곳 — 성공률 ${((fallbackSuccess.length / fallbackTargets.length) * 100).toFixed(0)}%`,
  );
  const maxCalls = Math.max(...rows.map((r) => r.providerCallCount));
  console.log(`전 좌표 중 최대 프로바이더 호출 수: ${maxCalls} (예산 13 이하 ${maxCalls <= 13 ? "PASS" : "FAIL"})`);

  console.log("\n## §B5-2 [다른 경로] 3회 연속 — 매번 다른 geometry 인가\n");
  const start = [126.9784, 37.5665];
  const fetchDirections = makeUrbanFetchDirections(1.15);
  let excludeStartBearingDeg;
  const hashes = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await runCloseLoopWithFallback({ start, targetDistanceMeters: 3000, fetchDirections, excludeStartBearingDeg });
    const hash = geometryHash(r.geometry);
    hashes.push(hash);
    console.log(`${i + 1}회차 — bearing=${r.startBearingSampleDeg} hash=${hash}`);
    excludeStartBearingDeg = r.startBearingSampleDeg;
  }
  // 지시서 §B3 문구: "직전에 쓴 시작 방위를 제외" = 바로 이전 것과만 달라야 한다(전역 유일성이 아니다).
  // 표본이 5개뿐이라 3연속을 반복하면 두 방위 사이를 오갈 수 있다 — 그래도 매 클릭은 "직전과 다름"을 만족한다.
  const adjacentDistinct = hashes.every((h, i) => i === 0 || h !== hashes[i - 1]);
  console.log(
    `\n매 클릭이 직전과 다른 geometry(지시서 요구사항): ${adjacentDistinct ? "PASS" : "FAIL"} — hashes=[${hashes.join(" | ")}]`,
  );
  console.log(
    `참고 — 전역 유일성(3회 전부 서로 다름): distinct=${new Set(hashes).size}/3` +
      ` (표본 5개 한정 exclude-직전-1개 설계라 2개 사이 왕복 가능 — 지시서는 "직전과 다름"만 요구)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
