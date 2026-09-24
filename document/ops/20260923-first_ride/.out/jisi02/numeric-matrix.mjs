/**
 * 지시02 §6 수치표 산출 — searchReadyLoopRoute(실제 서버 알고리즘, functions/lib 컴파일 산출물)를
 * **직접 import** 해서 좌표 7곳(국내 3 + 해외 3 + 도로없음 실패 데모 1)에 대해 돌린다.
 *
 * 실제 Mapbox 네트워크 호출은 쓰지 않는다 — 이 라운드에서 배포하지 않고(커밋·배포 금지) 로컬에서
 * 검증해야 하므로, 위치별 synthetic fetchDirections(도로 배율 roadFactor)로 대체한다.
 * 알고리즘 코드 자체는 실제 컴파일 산출물(functions/lib/distanceAutoRouteCore.js)이다 — 재구현이 아니다.
 * 자기중복 판정(computeRouteSelfOverlapRatio)이 점 밀도를 전제하므로, synthetic geometry 도
 * 세그먼트를 여러 점으로 보간해 실제 Mapbox polyline 밀도에 가깝게 만든다.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../../../../../functions/lib/distanceAutoRouteCore.js");

const { searchReadyLoopRoute, getDistanceMeters, offsetLngLatByBearingMeters, bearingFromOriginToPoint } = core;

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function interpolate(a, b, steps) {
  const out = [];
  for (let i = 1; i <= steps; i += 1) out.push(lerp(a, b, i / steps));
  return out;
}

/** a→b 를 도로 배율(roadFactor)만큼 늘어난 굴절 경로(중점 수직 bump)로 보간한다. */
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

/** 일반 지역 — 각 leg 를 도로 배율(roadFactor) 굴절 경로로 시뮬레이션(waypoint 순서 보존). */
function makeUrbanFetchDirections(roadFactor) {
  return async (profile, waypoints) => {
    const coords = [waypoints[0]];
    for (let i = 1; i < waypoints.length; i += 1) {
      coords.push(...detourPath(waypoints[i - 1], waypoints[i], roadFactor));
    }
    const distance = core.lineStringLengthMeters({ type: "LineString", coordinates: coords });
    return {
      geometry: { type: "LineString", coordinates: coords },
      distance,
      duration: distance / 5,
      snappedEnd: waypoints[waypoints.length - 1],
      endSnapDistanceMeters: 0,
    };
  };
}

/** 지역 중심이 건물 한가운데라 도로 스냅 이격이 있는 경우(§3.2) — 첫 응답에서 이격을 보고. */
function makeUrbanFetchDirectionsWithSnap(roadFactor, snapMeters) {
  const base = makeUrbanFetchDirections(roadFactor);
  return async (profile, waypoints) => {
    const r = await base(profile, waypoints);
    return { ...r, endSnapDistanceMeters: snapMeters };
  };
}

/** 도로가 전혀 없는 지역(예: 해상) — provider 가 항상 실패. */
function makeNoRoadFetchDirections() {
  return async () => {
    throw new Error("no route found (synthetic)");
  };
}

/**
 * 외곽 산간처럼 도로가 사실상 하나뿐인 지역 — 어떤 방위 표본을 요청해도 같은 간선도로를
 * 그대로 왕복하는 geometry 를 돌려준다(자기중복 ~100%를 의도적으로 재현. §5 캡처 F/D 대응 수치).
 */
function makeSingleRoadOutAndBackFetchDirections(start, targetDistanceMeters) {
  const corridorBearing = 10;
  return async () => {
    const half = targetDistanceMeters / 2;
    const far = offsetLngLatByBearingMeters(start, corridorBearing, half);
    const out = interpolate(start, far, 200);
    const back = interpolate(far, start, 200);
    const coords = [start, ...out, ...back];
    const distance = core.lineStringLengthMeters({ type: "LineString", coordinates: coords });
    return {
      geometry: { type: "LineString", coordinates: coords },
      distance,
      duration: distance / 5,
      snappedEnd: start,
      endSnapDistanceMeters: 0,
    };
  };
}

const TARGET_KM = 3;
const TARGET_M = TARGET_KM * 1000;
const RURAL_START = [127.5, 37.2];

const LOCATIONS = [
  {
    label: "서울 도심(광화문)",
    start: [126.977, 37.5759],
    fetchDirections: makeUrbanFetchDirections(1.15),
  },
  {
    label: "서울 주택가(성북동)",
    start: [126.9985, 37.5942],
    fetchDirections: makeUrbanFetchDirectionsWithSnap(1.18, 34),
  },
  {
    label: "서울 외곽(양평 산간)",
    start: RURAL_START,
    fetchDirections: makeSingleRoadOutAndBackFetchDirections(RURAL_START, TARGET_M),
  },
  {
    label: "파리(유럽)",
    start: [2.3522, 48.8566],
    fetchDirections: makeUrbanFetchDirections(1.2),
  },
  {
    label: "뉴욕(북미)",
    start: [-73.9857, 40.7484],
    fetchDirections: makeUrbanFetchDirections(1.1),
  },
  {
    label: "도쿄(아시아)",
    start: [139.7671, 35.6812],
    fetchDirections: makeUrbanFetchDirections(1.18),
  },
  {
    label: "카이로 외곽(도로망 희박 실패 데모)",
    start: [31.3, 30.0],
    fetchDirections: makeUrbanFetchDirections(1.45),
  },
  {
    label: "해상(도로 없음 데모)",
    start: [128.5, 34.0],
    fetchDirections: makeNoRoadFetchDirections(),
  },
];

function fmt(n, digits = 1) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "-";
}

async function main() {
  console.log(`알고리즘: ${core.AUTO_ROUTE_ALGORITHM_VERSION}`);
  console.log(`시작 방위 표본: ${JSON.stringify(core.READY_LOOP_BEARING_SAMPLES_DEG)} (5개, 360° 균등)`);
  console.log(`자기중복 상한(≥ 이면 폐합 제외): ${core.OUT_AND_BACK_OVERLAP_REJECT_RATIO}`);
  console.log("");
  const rows = [];
  console.log(
    "| 좌표(지명) | 목표 | 생성 성공 | 실거리 | 오차% | 자기중복% | 프로바이더 호출 수 | 폐합 여부 | 실패 원인 | 스냅 이격 |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|");

  for (const loc of LOCATIONS) {
    const result = await searchReadyLoopRoute({
      start: loc.start,
      profile: "cycling",
      targetDistanceMeters: TARGET_M,
      fetchDirections: loc.fetchDirections,
    });

    if (result.status === "found") {
      const errPct = (Math.abs(result.distance - TARGET_M) / TARGET_M) * 100;
      const line = `| ${loc.label} | ${TARGET_KM}km | 성공 | ${fmt(result.distance / 1000, 2)}km | ${fmt(errPct)}% | ${fmt(result.selfOverlapRatio * 100)}% | ${result.providerCallCount} | 폐합(출발=도착) | - | ${fmt(result.startSnapMeters, 0)}m |`;
      console.log(line);
      rows.push({ loc: loc.label, ...result, errPct });
    } else {
      const line = `| ${loc.label} | ${TARGET_KM}km | 실패 | - | - | - | ${result.providerCallCount} | - | ${result.reason} | - |`;
      console.log(line);
      rows.push({ loc: loc.label, ...result });
    }
  }

  console.log("");
  console.log("### 실패 상세(closestCandidate — no_loop 만)");
  for (const r of rows) {
    if (r.status === "failed" && r.closestCandidate) {
      console.log(
        `- ${r.loc}: 가장 가까운 후보 오차 ${fmt(r.closestCandidate.errorRatio * 100)}% · 자기중복 ${fmt(r.closestCandidate.selfOverlapRatio * 100)}%`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
