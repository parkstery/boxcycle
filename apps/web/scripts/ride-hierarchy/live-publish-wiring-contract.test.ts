import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * 실시간 동행 발행·정리의 **배선 계약** (Phase 6-③).
 *
 * 무엇을 막는가 — 이 경로가 끊기면 **에러가 나지 않는다.** 동행이 서로 안 보이거나
 * 주행 종료 후 남의 화면에 유령이 남을 뿐이고, 앱은 정상으로 보인다.
 * `trailLiveRidePort` 가 「전역 등록으로 두면 배선을 빠뜨렸을 때 아무 에러 없이 동행
 * 기록만 멈춘다」고 경고하는 바로 그 침묵이다.
 *
 * 왜 소스를 읽는가 — 이 배선은 **실주행 e2e 로만** 값으로 확인할 수 있는데,
 * `peer-sync-s41r` 은 2026-08-27 UI 변경 이후 한 달 넘게 red 였다(센서 사전조건·
 * 속도 슬라이더 이동). 값 검사가 없는 동안에도 **구조는 지킬 수 있다.**
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

/** 주석·산문에 걸려 통과하지 않도록 코드만 본다 (2026-09-26 에 실제로 겪었다). */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

describe("발행 배선 — 주행은 Trail 저장소를 직접 찌르지 않는다", () => {
  const burst = codeOnly(read("src/lib/ride/rideJoinPresenceBurst.ts"));
  const fanout = codeOnly(read("src/lib/ride/publishLiveLocationFanout.ts"));

  it("합류 버스트는 Trail 이 연 창구로만 쓴다", () => {
    assert.match(burst, /from "\.\.\/trail\/trailLiveRideSink"/, "Trail 창구를 써야 한다");
    assert.doesNotMatch(
      burst,
      /from "\.\.\/trail\/repo\//,
      "Trail 저장소를 직접 부르면 Trail 이 저장 방식을 바꿀 때 주행이 깨진다",
    );
    assert.match(burst, /mergeRideLiveProgress\(/, "진행을 올리는 호출이 남아 있어야 한다");
    assert.match(
      burst,
      /touchTrailActivityForRideJoin\(/,
      "Trail 활동 갱신이 빠지면 열린 Trail 목록이 조용히 낡는다",
    );
  });

  it("정리도 같은 창구로 — 그리고 동행 전송 흔적까지 치운다", () => {
    assert.doesNotMatch(fanout, /from "\.\.\/trail\/repo\//, "Trail 저장소 직접 호출 금지");
    assert.match(fanout, /deleteRideLiveRow\(/, "라이브 주행 행 삭제가 빠지면 유령이 남는다");
    assert.match(
      fanout,
      /cleanupPeerMotionPublish\(/,
      "동행 전송 흔적 삭제가 빠지면 남의 화면에 유령 라이더가 남는다",
    );
  });
});

describe("발행 배선 — 「전송이 가능한가」는 전송이 답한다", () => {
  const burst = codeOnly(read("src/lib/ride/rideJoinPresenceBurst.ts"));
  const fanout = codeOnly(read("src/lib/ride/publishLiveLocationFanout.ts"));

  it("주행은 어느 인프라를 쓰는지 묻지 않는다", () => {
    for (const [name, src] of [
      ["rideJoinPresenceBurst", burst],
      ["publishLiveLocationFanout", fanout],
    ] as const) {
      assert.doesNotMatch(
        src,
        /isFirebaseDatabaseConfigured/,
        `${name}: RTDB 를 직접 묻지 않는다 — 전송이 바뀌면 여기가 함께 깨진다`,
      );
      assert.match(
        src,
        /isMotionTransportConfigured\(\)/,
        `${name}: 「지금 motion 을 보낼 수 있나」만 묻는다`,
      );
    }
  });
});

describe("발행 배선 — 두 저장소를 걸친 정리 순서는 조립 지점이 갖는다", () => {
  const trailRepo = codeOnly(read("src/lib/trail/repo/firestoreTrailLivePublicationRides.ts"));
  const hook = codeOnly(read("src/hooks/useLiveLocationPublishSession.ts"));

  it("Trail 저장소가 동행 전송 저장소(RTDB)를 지우지 않는다", () => {
    assert.doesNotMatch(
      trailRepo,
      /deleteTrailMotion/,
      "한쪽 저장소가 남의 저장소를 지우면, 순서를 바꿀 때 어디를 고쳐야 할지 알 수 없다",
    );
  });

  it("종료 정리 순서가 조립 지점에 **눈에 보이게** 있다", () => {
    /*
     * 순서가 중요하다 — 완주 기록(final burst) → Firestore 행 삭제 → RTDB motion 삭제.
     * motion 을 먼저 지우면 상대 화면에서 라이더가 완주 표시 전에 사라진다.
     */
    /*
     * 훅에는 `deleteTrailMotion` 호출이 여러 군데 있다(재시작·오류 경로 등).
     * 전체에서 첫 번째를 집으면 엉뚱한 것을 재게 된다 — **완주 블록 안에서만** 본다.
     * (2026-09-26: 처음에 전역 indexOf 로 썼다가 이 시험 자신이 red 가 되어 알았다.)
     */
    const finalizeAt = hook.indexOf("finalizeAndDeleteTrailLivePublicationRide(");
    assert.ok(finalizeAt > 0, "완주 확정·행 삭제 호출이 있어야 한다");
    const block = hook.slice(finalizeAt, finalizeAt + 900);
    const motionAt = block.indexOf("deleteTrailMotion(");
    const cleanupAt = block.indexOf("cleanupLiveLocationPublish(");
    assert.ok(
      motionAt > 0,
      "완주 직후 동행 전송 흔적을 지우지 않으면 남의 화면에 유령 라이더가 남는다",
    );
    assert.ok(cleanupAt > 0, "뒤이은 정리 호출이 있어야 한다");
    assert.ok(
      motionAt < cleanupAt,
      "순서: 완주 확정 → 행 삭제 → motion 삭제 → 정리. motion 을 뒤로 미루면 유령이 더 오래 남는다",
    );
  });
});
