import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { User } from "firebase/auth";
import {
  awaitMotionFlightSettled,
  cancelMotionPublish,
  enqueueMotionPublish,
  nextMotionPublishEpoch,
  peekMotionPublishEpoch,
  peekMotionSlotDiscardCount,
  requestMotionNodeCleanup,
} from "../../src/lib/peerMotion/motionPublishFlight.ts";
import { MOTION_MAX_IN_FLIGHT } from "../../src/lib/peerMotion/peerSyncPolicy.ts";
import type { LiveLocationSnapshot } from "../../src/lib/peerMotion/types.ts";

/**
 * motion 좌표 **겹쳐 보내기** 계약 (2026-09-27).
 *
 * 무엇을 막는가 — 좌표를 한 번에 하나씩만 보내면 도착 간격이 **왕복 시간에 묶인다**.
 * 실측: 100ms 마다 보내려 했는데 실제 도착은 약 200ms(`writeRttMs=137`+`publishQueueMs=70`).
 * 보내려던 10Hz 가 5Hz 였다. 도착 간격은 곧 보간 지연이므로(간격 × 2.2) **동행이
 * 뒤처져 보이는 시간이 두 배**가 된다. 화면에는 아무 오류도 없다.
 *
 * ⚠️ 이 파일이 e2e(`test:e2e:peer-s4m1`)를 대신하지 않는다. 그쪽은 실제 RTDB 쓰기·
 * onDisconnect·epoch 전환을 본다. 여기서는 **비행 슬롯 회계**만 본다 —
 * 브라우저·에뮬레이터 없이 1초 안에 돌기 때문에 게이트에 둘 수 있다.
 *
 * Firebase 설정이 없는 환경에서는 쓰기가 즉시 반환된다. 그래도 `await` 뒤로 넘어가므로
 * **한 틱 안에 여러 개를 넣으면 동시성 회계가 그대로 드러난다.**
 */

type FakeWindow = {
  __rtwMotionWriteDelayMs?: number;
  __rtwMotionFlightDebug?: { inFlight: number };
};

/**
 * 제품의 DEV 손잡이(`__rtwMotionWriteDelayMs`·`__rtwMotionFlightDebug`)는 `window` 에 산다.
 * node 에는 없으므로 최소한의 것만 만들어 준다 — 없으면 쓰기가 즉시 끝나 겹치지 않고,
 * 동시성 판정이 **전부 공짜로 통과한다**.
 */
function installFakeWindow(): FakeWindow {
  const g = globalThis as { window?: FakeWindow };
  if (!g.window) g.window = {};
  return g.window;
}

function readInFlight(w: FakeWindow): number {
  const n = w.__rtwMotionFlightDebug?.inFlight;
  assert.equal(typeof n, "number", "계기가 없으면 아무것도 판정할 수 없다(M0)");
  return n as number;
}

const user = { uid: "test-uid-000000" } as User;

const snapshot = (distM: number): LiveLocationSnapshot =>
  ({
    trailId: "t1",
    publicationId: "p1",
    lngLat: [127, 37],
    distMetersAlongRoute: distM,
    speedMps: 5,
    routeReady: true,
    routeRidePhase: "live",
  }) as unknown as LiveLocationSnapshot;

const job = (distM: number, epoch: number) => ({
  user,
  trailId: "t1",
  snapshot: snapshot(distM),
  epoch,
});

describe("겹쳐 보내기 — 앞 쓰기를 기다리지 않는다", () => {
  let epoch = 0;
  beforeEach(async () => {
    await awaitMotionFlightSettled(2_000);
    epoch = nextMotionPublishEpoch(`s-${Date.now()}-${Math.random()}`);
  });

  it("상한이 2 이상이다 — 1 이면 겹쳐 보내기가 아니다", () => {
    assert.ok(
      MOTION_MAX_IN_FLIGHT >= 2,
      "1 로 되돌리면 도착 간격이 다시 왕복 시간에 묶인다",
    );
  });

  it(`한 틱에 ${MOTION_MAX_IN_FLIGHT}개까지는 바로 보낸다`, () => {
    for (let i = 0; i < MOTION_MAX_IN_FLIGHT; i += 1) {
      const r = enqueueMotionPublish(job(i + 1, epoch));
      assert.equal(
        r.accepted,
        "write",
        `${i + 1}번째가 대기 슬롯으로 밀렸다 — 겹쳐 보내기가 안 된다`,
      );
    }
  });

  it("상한을 넘으면 대기 슬롯으로 — 최신 하나만 남긴다", () => {
    for (let i = 0; i < MOTION_MAX_IN_FLIGHT; i += 1) enqueueMotionPublish(job(i + 1, epoch));

    const over = enqueueMotionPublish(job(90, epoch));
    assert.equal(over.accepted, "slot", "상한을 넘겼는데 그대로 내보내면 순서가 무너진다");
    assert.equal(over.overwrite, false, "빈 슬롯을 덮었다고 보고하면 안 된다");

    const before = peekMotionSlotDiscardCount();
    const again = enqueueMotionPublish(job(91, epoch));
    assert.equal(again.accepted, "slot");
    assert.equal(again.overwrite, true, "슬롯은 최신 하나만 남긴다(latest-wins)");
    assert.equal(
      peekMotionSlotDiscardCount(),
      before + 1,
      "버린 것을 세지 않으면 발행이 밀리는 것을 아무도 모른다",
    );
  });

  it("전부 끝나면 배수 완료가 된다 — 하나만 끝나고 완료로 치면 안 된다", async () => {
    /*
     * ⚠️ 쓰기가 즉시 끝나면 이 판정은 **공짜로 통과한다** — 실제로 그래서 첫 판이
     * 사보타주를 놓쳤다. 겹치는 상황을 만들려면 쓰기에 지연을 줘야 한다.
     *
     * 「하나 끝났으니 완료」로 되돌리면, 완료 신호가 온 시점에 아직 날아가는 쓰기가
     * 남아 있다. 세션 정리가 그 틈에 끼어들면 **다음 세션의 좌표를 지운다.**
     */
    const w = installFakeWindow();
    w.__rtwMotionWriteDelayMs = 60;
    try {
      for (let i = 0; i < MOTION_MAX_IN_FLIGHT + 1; i += 1) enqueueMotionPublish(job(i + 1, epoch));
      assert.equal(readInFlight(w), MOTION_MAX_IN_FLIGHT, "겹쳐 날아가는 상태를 만들지 못했다");

      const settled = await awaitMotionFlightSettled(3_000);
      assert.equal(settled, true, "배수가 끝나지 않으면 세션 정리가 영영 멈춘다");
      assert.equal(
        readInFlight(w),
        0,
        "완료라고 했는데 아직 날아가는 쓰기가 남아 있다 — 정리가 새 세션을 지운다",
      );
    } finally {
      w.__rtwMotionWriteDelayMs = 0;
      await awaitMotionFlightSettled(3_000);
    }
  });
});

describe("겹쳐 보내도 수명주기는 그대로다", () => {
  it("지난 epoch 의 job 은 거절한다", async () => {
    await awaitMotionFlightSettled(2_000);
    const old = nextMotionPublishEpoch("old");
    nextMotionPublishEpoch("new");
    const r = enqueueMotionPublish(job(1, old));
    assert.equal(r.accepted, "reject", "옛 세션 좌표가 새 세션을 덮으면 위치가 뒤로 간다");
  });

  it("취소하면 대기 슬롯을 버린다", async () => {
    await awaitMotionFlightSettled(2_000);
    const e = nextMotionPublishEpoch(`c-${Date.now()}`);
    for (let i = 0; i < MOTION_MAX_IN_FLIGHT + 1; i += 1) enqueueMotionPublish(job(i + 1, e));
    const r = cancelMotionPublish(e);
    assert.equal(r.droppedSlot, true, "취소했는데 대기 좌표가 남으면 나중에 되살아난다");
    assert.equal(peekMotionPublishEpoch(), e);
    await awaitMotionFlightSettled(3_000);
  });
});

describe("정리는 날아가는 쓰기가 **전부** 끝난 뒤에", () => {
  it("아직 날아가는 쓰기가 있으면 삭제하지 않는다", async () => {
    /*
     * 왜 — 삭제가 먼저 끝나면 **늦게 도착한 쓰기가 지운 노드를 되살린다.** 주행을
     * 끝냈는데 상대 화면에 내가 남는다. 오늘 고친 「유령 라이더」가 다른 경로로 돌아온다.
     *
     * 겹쳐 보내기 전에는 내가 끝나면 날아가는 것이 없어 이 조건이 저절로 참이었다.
     * e2e(s4m1 M6)가 이 회귀를 잡았고 — `deleteDoneAt` 이 `lateWriteDoneAt` 보다 86ms
     * 빨랐다 — 그 시험은 3분 걸린다. 같은 불변식을 여기서 1초에 잡는다.
     */
    const w = installFakeWindow();
    w.__rtwMotionWriteDelayMs = 80;
    try {
      await awaitMotionFlightSettled(3_000);
      const e = nextMotionPublishEpoch(`cleanup-${Date.now()}`);
      for (let i = 0; i < MOTION_MAX_IN_FLIGHT; i += 1) enqueueMotionPublish(job(i + 1, e));
      assert.equal(readInFlight(w), MOTION_MAX_IN_FLIGHT, "겹쳐 날아가는 상태를 만들지 못했다");

      cancelMotionPublish(e);
      nextMotionPublishEpoch(`next-${Date.now()}`);

      const seenInFlight: number[] = [];
      requestMotionNodeCleanup({
        epoch: e,
        sessionKey: `cleanup-${e}`,
        run: async () => {
          seenInFlight.push(readInFlight(w));
        },
      });

      await awaitMotionFlightSettled(3_000);
      // 정리는 마지막 쓰기가 끝난 뒤에 돌므로 한 틱 양보한다.
      await new Promise((r) => setTimeout(r, 50));

      assert.ok(seenInFlight.length >= 1, "정리가 아예 돌지 않았다 — 노드가 영영 남는다");
      for (const n of seenInFlight) {
        assert.equal(
          n,
          0,
          `날아가는 쓰기가 ${n}개 남은 채 삭제했다 — 그 쓰기가 지운 노드를 되살린다`,
        );
      }
    } finally {
      w.__rtwMotionWriteDelayMs = 0;
      await awaitMotionFlightSettled(3_000);
    }
  });
});
