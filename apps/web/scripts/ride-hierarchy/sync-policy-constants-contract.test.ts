/**
 * 동기 정책·LOD 상수 값 계약 (Phase 5-4 · 게이트 G5).
 *
 * 무엇을 막는가 — 구조 감사 R9: `activityWorldLod ↔ rideSyncPolicy` 순환.
 * **순환이 있으면 import 순서에 따라 모듈이 반쯤 초기화된 상태로 읽힌다.** 그때 파생 상수는
 * `undefined` 가 되고, 그 값이 `setInterval(…, undefined)` 이나 비교식으로 흘러
 * **폴링이 멈추거나 폭주한다.** 타입 에러도 런타임 예외도 나지 않는다.
 *
 * 그래서 「순환이 없다」(check-dep-direction)와 별개로 **값 자체를 여기서 잰다.**
 * 구조 검사만 두면 다른 경로로 같은 증상이 생겼을 때 아무도 모른다.
 *
 * ⚠️ 판정을 「0 이 아님」으로 쓰지 않는다 — `TRAIL_LIVE_PROGRESS_MIN_DIST_DELTA_M` 은
 *    정당하게 0 이다. 축퇴값으로 항상 참이 되는 게이트를 만들지 않기 위해,
 *    **유한성 + 파생 일치 + 불변식**으로 판정한다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as lod from "../../src/lib/activityWorldLod.ts";
import * as sync from "../../src/lib/rideSyncPolicy.ts";

const numbersOf = (ns: Record<string, unknown>): [string, number][] =>
  Object.entries(ns).filter((e): e is [string, number] => typeof e[1] === "number");

describe("G5 — 동기 정책 상수가 순환으로 무너지지 않는다", () => {
  it("모든 수치 상수가 유한하다 (순환이면 undefined/NaN 이 된다)", () => {
    // 하한은 모듈마다 다르다. 하나로 뭉뚱그리면 「상수를 못 읽었다」를 못 잡거나(너무 낮게)
    // 정상인데 실패한다(너무 높게). activityWorldLod 는 수치 상수가 셋뿐이다.
    for (const [mod, ns, min] of [
      ["rideSyncPolicy", sync, 20],
      ["activityWorldLod", lod, 3],
    ] as const) {
      const nums = numbersOf(ns as unknown as Record<string, unknown>);
      assert.ok(
        nums.length >= min,
        `${mod}: 상수를 못 읽었다(${nums.length} < ${min}) — 시험이 헛돈다`,
      );
      for (const [k, v] of nums) {
        assert.ok(Number.isFinite(v), `${mod}.${k} = ${v} — 유한해야 한다`);
      }
    }
  });

  it("파생 상수가 원본과 같다 — 반쯤 초기화되면 여기서 갈라진다", () => {
    // 셋 다 ACTIVITY_WORLD_POLL_ACTIVE_MS 에서 파생된다. 순환이면 파생 쪽만 undefined 가 된다.
    assert.equal(sync.ROUTE_ACTIVITY_CACHE_TTL_MS, sync.ACTIVITY_WORLD_POLL_ACTIVE_MS);
    assert.equal(sync.WORLD_PRESENCE_POLL_MS, sync.ACTIVITY_WORLD_POLL_ACTIVE_MS);
    assert.equal(sync.COURSE_ACTIVITY_POLL_MS, sync.ACTIVITY_WORLD_POLL_ACTIVE_MS);
    assert.equal(lod.MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN, lod.MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN);
  });

  it("폴링 주기가 실제로 폴링이 되는 값이다", () => {
    // 0 이나 음수면 폭주하고, 과도하게 크면 멈춘 것과 같다.
    for (const k of [
      "ACTIVITY_WORLD_POLL_ACTIVE_MS",
      "ACTIVITY_WORLD_POLL_IDLE_MS",
      "ACTIVITY_WORLD_POST_RIDE_WATCH_MS",
      "PEER_MOTION_PUBLISH_INTERVAL_MS",
      "TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS",
    ] as const) {
      const v = sync[k];
      assert.ok(v >= 50, `${k} = ${v} — 50ms 미만이면 폭주다`);
      assert.ok(v <= 3_600_000, `${k} = ${v} — 1시간을 넘으면 멈춘 것과 같다`);
    }
    assert.ok(
      sync.ACTIVITY_WORLD_POLL_IDLE_MS > sync.ACTIVITY_WORLD_POLL_ACTIVE_MS,
      "idle 이 active 보다 잦으면 adaptive 가 뒤집힌 것이다",
    );
  });

  it("LOD 히스테리시스 — 들어가는 줌이 나오는 줌보다 높다", () => {
    // 둘이 같거나 뒤집히면 경계에서 라인/점이 깜빡인다(채터링).
    assert.ok(
      lod.MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN > lod.MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN,
      "enter > exit 여야 히스테리시스가 성립한다",
    );
  });

  it("구조 — rideSyncPolicy 가 LOD 상수를 다시 re-export 하지 않는다", () => {
    // 이 한 줄이 R9 순환의 절반이었다. 되살아나면 위 값 검사들이 언제든 무너질 수 있다.
    for (const k of [
      "MAP_ZOOM_ACTIVITY_WORLD_LINE_ENTER_MIN",
      "MAP_ZOOM_ACTIVITY_WORLD_LINE_EXIT_MIN",
      "MAP_ZOOM_ACTIVITY_WORLD_LINE_MIN",
    ]) {
      assert.equal(
        k in sync,
        false,
        `rideSyncPolicy 가 ${k} 를 다시 내보내면 activityWorldLod 와 순환이 된다`,
      );
    }
  });
});
