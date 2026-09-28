import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PeerMotionRegistry } from "../../src/lib/peerMotion/PeerMotionRegistry.ts";
import { PEER_LIVE_RIDE_STALE_MS } from "../../src/lib/trail/trailLivePolicy.ts";
import type { PeerMotionPacket } from "../../src/lib/peerMotion/types.ts";

/**
 * 동행 **생존 판정** 계약 (2026-09-28).
 *
 * 무엇을 막는가 — 탭을 그냥 닫으면 아무도 정리해 주지 않는다. Firestore 에는 「연결이
 * 끊기면 지워라」가 없고, RTDB onDisconnect 도 서버가 알아챌 때까지 걸린다. 그동안 **같은
 * 행이 계속 배달**되는데, 그것을 받아 주면 라이더가 영영 화면에 남는다.
 *
 * chief 보고(2026-09-28): 「Stop 은 15초 안에 사라지는데, 탭을 닫으면 유지된다」.
 * Stop 은 행을 지우고 나가므로 멀쩡했고, 탭 닫기만 남았다.
 *
 * ⚠️ 관전 **점**은 2026-09-27 에 이미 15초로 고쳤다. 이건 **라이더 본체**(레지스트리) 쪽이고
 * 따로였다. 하나를 고쳤다고 다른 하나가 고쳐지지 않는다.
 */

const SILENT = PEER_LIVE_RIDE_STALE_MS;

const packet = (over: Partial<PeerMotionPacket> = {}): PeerMotionPacket =>
  ({
    uid: "peer1",
    publicationId: "pub1",
    distM: 10,
    speedMps: 5,
    phase: "live",
    serverAtMs: 1_000,
    ...over,
  }) as PeerMotionPacket;

/**
 * 라이더 수를 센다.
 *
 * ⚠️ `buildRenderFeatures(null)` 로 세면 안 된다 — 경로가 없으면 **살아 있는 동행도 0** 이
 * 나와 아래 판정이 전부 공짜로 통과한다. 첫 판에서 M0 가 이걸 잡았다.
 */
const countOf = (r: PeerMotionRegistry): number => r.getEntityCount();

describe("M0 — 계측이 실제로 라이더를 센다", () => {
  it("넣으면 1, 안 넣으면 0 — 항상 0이면 아래 판정이 전부 공짜로 통과한다", () => {
    const r = new PeerMotionRegistry();
    assert.equal(countOf(r), 0);
    r.ingest(packet(), "peer1", 0);
    assert.equal(countOf(r), 1, "라이더를 세지 못하면 「사라졌다」를 판정할 수 없다");
  });
});

describe("탭을 닫으면 사라진다", () => {
  it("같은 행만 계속 배달되면 15초 뒤 사라진다", () => {
    const r = new PeerMotionRegistry();
    let t = 0;
    r.ingest(packet({ serverAtMs: 1_000, distM: 10 }), "peer1", t);
    assert.equal(countOf(r), 1);

    // 탭이 닫혔다 — 송신 시각이 멈춘 채 같은 행이 계속 배달된다.
    for (t = 500; t <= SILENT; t += 500) {
      r.ingest(packet({ serverAtMs: 1_000, distM: 10 }), "peer1", t);
      r.pruneInactive(t);
    }
    assert.equal(countOf(r), 1, `${SILENT}ms 안에는 남아 있어야 한다 — 순간 끊김에 깜빡이면 안 된다`);

    t = SILENT + 1_000;
    r.ingest(packet({ serverAtMs: 1_000, distM: 10 }), "peer1", t);
    r.pruneInactive(t);
    assert.equal(countOf(r), 0, "탭을 닫았는데 라이더가 남았다");
  });

  it("사라진 뒤 같은 낡은 행이 다시 와도 되살아나지 않는다", () => {
    /*
     * 지우기만 하면 다음 배달에 **다시 태어난다.** 그러면 15초마다 나타났다 사라지는
     * 깜빡임이 된다 — 처음 구현에서 실제로 이 함정을 염두에 두고 ingest 에서 막았다.
     */
    const r = new PeerMotionRegistry();
    r.ingest(packet({ serverAtMs: 1_000 }), "peer1", 0);
    const t = SILENT + 1_000;
    r.ingest(packet({ serverAtMs: 1_000 }), "peer1", t);
    assert.equal(countOf(r), 0);

    for (let k = 1; k <= 5; k += 1) {
      r.ingest(packet({ serverAtMs: 1_000 }), "peer1", t + k * 1_000);
      assert.equal(countOf(r), 0, `낡은 행 재배달 ${k}회째에 라이더가 되살아났다`);
    }
  });

  it("다시 접속하면(송신 시각이 새로워지면) 곧바로 돌아온다", () => {
    const r = new PeerMotionRegistry();
    r.ingest(packet({ serverAtMs: 1_000 }), "peer1", 0);
    const t = SILENT + 1_000;
    r.ingest(packet({ serverAtMs: 1_000 }), "peer1", t);
    assert.equal(countOf(r), 0);

    r.ingest(packet({ serverAtMs: 99_000, distM: 12 }), "peer1", t + 100);
    assert.equal(countOf(r), 1, "돌아온 사람을 계속 막으면 재참여가 안 된다");
  });
});

describe("멈춰 있는 사람을 쫓아내지 않는다", () => {
  it("신호 대기로 거리가 그대로여도, 보내고 있으면 남는다", () => {
    /*
     * 「거리가 안 는다」로 판정하면 멈춘 사람을 지운다. 판정 근거는 **보내고 있는가**다.
     * 멈춰도 좌표는 계속 나가므로 송신 시각은 계속 바뀐다.
     */
    const r = new PeerMotionRegistry();
    let t = 0;
    for (let k = 0; k < 200; k += 1) {
      t = k * 200;
      r.ingest(packet({ serverAtMs: 1_000 + t, distM: 10 }), "peer1", t);
      r.pruneInactive(t);
    }
    assert.ok(t > SILENT * 2, "시험이 충분히 오래 돌지 않았다");
    assert.equal(countOf(r), 1, "멈춰 있을 뿐인 동행을 지웠다");
  });
});

describe("송신 시각을 읽을 수 없으면 내용으로 판정한다", () => {
  /*
   * 종전에는 판정 자체를 하지 않아 **영영 안 지워졌다.** chief 보고(2026-09-28):
   * 브라우저를 강제 종료하면 개설자 라이더가 1분 넘게 남았다.
   * 「모르니까 그냥 둔다」는 유령을 만든다.
   */
  it("내용이 그대로면 결국 사라진다 — 다만 더 오래 기다린다", () => {
    const r = new PeerMotionRegistry();
    r.ingest(packet({ serverAtMs: 0, distM: 10 }), "peer1", 0);
    assert.equal(countOf(r), 1);

    // 15초(송신 시각이 있을 때의 기준)에는 아직 남아 있어야 한다 —
    // 멈춰 있을 뿐인 동행을 쫓아내면 안 된다.
    r.ingest(packet({ serverAtMs: 0, distM: 10 }), "peer1", SILENT + 1_000);
    r.pruneInactive(SILENT + 1_000);
    assert.equal(countOf(r), 1, "판정 근거가 약할 때는 더 기다려야 한다");

    const long = 50_000;
    r.ingest(packet({ serverAtMs: 0, distM: 10 }), "peer1", long);
    r.pruneInactive(long);
    assert.equal(countOf(r), 0, "영영 안 지우면 유령이 된다");
  });

  it("내용이 바뀌면 살아 있는 것으로 본다", () => {
    const r = new PeerMotionRegistry();
    let t = 0;
    for (let k = 0; k < 120; k += 1) {
      t = k * 500;
      r.ingest(packet({ serverAtMs: 0, distM: 10 + k * 0.5 }), "peer1", t);
      r.pruneInactive(t);
    }
    assert.ok(t > 50_000, "시험이 충분히 오래 돌지 않았다");
    assert.equal(countOf(r), 1, "계속 움직이는 동행을 지웠다");
  });
});
