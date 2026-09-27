import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  PEER_LIVE_RIDE_STALE_MS,
  TRAIL_PRESENCE_STALE_MS,
} from "../../src/lib/trail/trailLivePolicy.ts";

/**
 * 관전 점의 **사라지는 기준** 계약 (2026-09-27).
 *
 * 무엇을 막는가 — 맵에 그리는 동행 점을 멤버용 기준(240초)으로 거르면, 발행이 끊긴
 * 주행이 **1분 넘게 그대로 남는다.** 관전 외삽은 3초에서 멈추므로 그 점은 한자리에
 * 얼어붙어 있다가 다음 행이 오는 순간 **순간이동**한다 — chief 가 보고한 「툭툭 튀는」 증상.
 * 화면에 오류가 나지 않으므로 코드를 되돌려도 아무도 알아채지 못한다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

/** 산문이 아니라 코드를 본다 — 주석에 적힌 이름이 게이트를 통과시키면 안 된다. */
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");

const WORLD = "src/features/map-overlays/useWorldLivePublicationRideMapOverlay.ts";
const IN_TRAIL = "src/hooks/useTrailLivePublicationRideSpectatorOverlay.ts";

describe("두 기준은 서로 다른 일을 한다", () => {
  it("맵 표시 기준이 멤버 기준보다 **훨씬 짧다**", () => {
    /*
     * 둘이 가까워지면 이 계약이 아무것도 막지 못한다 — 어느 쪽을 써도 통과하기 때문이다.
     * 실측한 증상은 103초였다. 맵 기준은 그보다 한참 아래에 있어야 한다.
     */
    assert.ok(PEER_LIVE_RIDE_STALE_MS < TRAIL_PRESENCE_STALE_MS / 4);
    assert.ok(PEER_LIVE_RIDE_STALE_MS <= 30_000, "맵 점이 30초 넘게 남으면 순간이동이 보인다");
  });
});

describe("맵에 점을 찍는 곳은 맵 기준을 쓴다", () => {
  for (const rel of [WORLD, IN_TRAIL]) {
    it(`${path.basename(rel)} — 점 계산이 PeerVisible 로 걸러진다`, () => {
      const src = codeOnly(read(rel));
      assert.match(
        src,
        /isTrailLivePublicationRideRowPeerVisible\(/,
        "맵 점은 PeerVisible(15초)로 걸러야 한다 — RowFresh(240초)가 아니다",
      );
    });

    it(`${path.basename(rel)} — 시간이 흐르면 다시 판정한다`, () => {
      /*
       * 시각을 넘기지 않으면 `Date.now()` 기본값이 쓰여 값은 맞지만, 그 계산이 **다시 돌지
       * 않으면** 끊긴 점은 영영 남는다. 1초마다 도는 tick 을 넘기는지까지 봐야 계약이 산다.
       */
      const src = codeOnly(read(rel));
      assert.match(
        src,
        /isTrailLivePublicationRideRowPeerVisible\(\s*r\s*,\s*spectatorTickMs\s*\)/,
        "1초 tick 을 넘겨야 시간이 지나면서 사라진다",
      );
    });
  }
});

describe("관전 외삽 상한을 넘긴 점은 그려지면 안 된다", () => {
  it("맵 기준이 외삽 상한보다 지나치게 길지 않다", () => {
    /*
     * 외삽은 3초에서 멈춘다(`SPECTATOR_MAX_EXTRAP_MS`). 맵 기준이 그보다 훨씬 길면
     * 그 차이만큼 **얼어붙은 점**이 화면에 남는다. 지금은 3초 외삽 + 12초 잔류다.
     */
    assert.ok(PEER_LIVE_RIDE_STALE_MS >= 3_000, "외삽 상한보다 짧으면 정상 주행도 깜빡인다");
  });
});
