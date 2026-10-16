import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetPerfLabForTests } from "../src/lib/debug/perfLab.ts";
import {
  noteRiderJitterFrame,
  readRiderJitterStats,
  resetRiderJitterProbe,
  summarizeRiderJitter,
} from "../src/lib/debug/riderJitterProbe.ts";

const originalWindow = (globalThis as { window?: Window }).window;

function useSearch(search: string): void {
  (globalThis as { window?: Window }).window = { location: { search } } as Window;
  resetPerfLabForTests();
  resetRiderJitterProbe();
}

afterEach(() => {
  resetPerfLabForTests();
  resetRiderJitterProbe();
  if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
  else (globalThis as { window?: Window }).window = originalWindow;
});

describe("떨림 지수 계산", () => {
  it("후퇴 프레임·최대 후퇴·속도 변동계수·본인 대비 표준편차", () => {
    const stats = summarizeRiderJitter(
      [
        {
          id: "live-self",
          kind: "self",
          samples: [
            { t: 0, distM: 0 },
            { t: 100, distM: 1 },
            { t: 200, distM: 2 },
            { t: 300, distM: 3 },
          ],
        },
        {
          id: "pacer-a",
          kind: "pacer",
          samples: [
            { t: 0, distM: 0 },
            { t: 100, distM: 1 },
            { t: 200, distM: 0.5 },
            { t: 300, distM: 2 },
          ],
        },
      ],
      300,
      10_000,
    );
    const self = stats.find((row) => row.id === "live-self");
    const pacer = stats.find((row) => row.id === "pacer-a");
    assert.ok(self);
    assert.equal(self.reverseFrames, 0);
    assert.equal(self.maxReverseM, 0);
    assert.equal(self.relStdM, 0);
    assert.ok(pacer);
    assert.equal(pacer.frames, 4);
    assert.equal(pacer.reverseFrames, 1);
    assert.equal(pacer.maxReverseM, 0.5);
    const speeds = [10, -5, 15];
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length;
    assert.ok(pacer.speedCv != null);
    assert.ok(Math.abs(pacer.speedCv - Math.sqrt(variance) / mean) < 1e-9);
    const rels = [0, 0, -1.5, -1];
    const relMean = rels.reduce((a, b) => a + b, 0) / rels.length;
    const relVar = rels.reduce((a, s) => a + (s - relMean) ** 2, 0) / rels.length;
    assert.ok(pacer.relStdM != null);
    assert.ok(Math.abs(pacer.relStdM - Math.sqrt(relVar)) < 1e-9);
  });

  it("0.1 mm 이하 후퇴는 역행으로 세지 않고, 창 밖은 뺀다", () => {
    const stats = summarizeRiderJitter(
      [
        {
          id: "live-self",
          kind: "self",
          samples: [
            { t: 0, distM: 0 },
            { t: 100, distM: 1 - 1e-6 },
            { t: 20_000, distM: 0 },
          ],
        },
      ],
      1_000,
      10_000,
    );
    assert.equal(stats.length, 1);
    assert.equal(stats[0]!.frames, 2);
    assert.equal(stats[0]!.reverseFrames, 0);
  });
});

describe("떨림 계측 가드", () => {
  it("쿼리가 없으면 기록하지 않고 performance.now 를 부르지 않는다", () => {
    useSearch("");
    const orig = performance.now.bind(performance);
    let calls = 0;
    performance.now = () => {
      calls += 1;
      return orig();
    };
    try {
      noteRiderJitterFrame(
        10,
        1,
        [{ properties: { id: "peer", displayDistM: 2 } }],
        [{ properties: { id: "pacer-a", pathDistM: 3 } }],
      );
      assert.equal(calls, 0);
      assert.equal(readRiderJitterStats(10).length, 0);
    } finally {
      performance.now = orig;
    }
  });

  it("perflab 이면 본인·페이서·동행을 10 s 창에 남긴다", () => {
    useSearch("?perflab=1");
    noteRiderJitterFrame(
      1_000,
      10,
      [{ properties: { id: "peer-1", displayDistM: 12 } }],
      [{ properties: { id: "pacer-a", pathDistM: 11 } }],
    );
    noteRiderJitterFrame(
      1_100,
      11,
      [{ properties: { id: "peer-1", displayDistM: 10 } }],
      [{ properties: { id: "pacer-a", pathDistM: 12 } }],
    );
    const rows = readRiderJitterStats(1_100);
    assert.equal(rows.length, 3);
    const peer = rows.find((row) => row.id === "peer-1");
    assert.ok(peer);
    assert.equal(peer.kind, "peer");
    assert.equal(peer.reverseFrames, 1);
    assert.equal(peer.maxReverseM, 2);
    const self = rows.find((row) => row.kind === "self");
    assert.ok(self);
    assert.equal(self.relStdM, 0);
  });
});
