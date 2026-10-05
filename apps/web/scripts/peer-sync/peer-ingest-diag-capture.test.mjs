/**
 * peerIngestDiag capture 행동 시험 — lastCompletedCapture · 40ms capture 간격 · 카운터 보존.
 *
 * fake timers: 60fps/120fps 20s 두 UID, live 덮어쓰기 후에도 download Blob JSON 이
 * 완료 capture 와 동일하며 시간 범위가 끝까지 남는지 확인.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "../..");

async function withDiag(run) {
  const server = await createServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const g = globalThis;
    const hadWindow = Object.prototype.hasOwnProperty.call(g, "window");
    const prevWindow = g.window;
    g.window = g.window ?? g;
    let lastBlobText = null;
    g.document =
      g.document ??
      ({
        createElement: () => ({ click() {}, set href(_v) {}, set download(_v) {} }),
      });
    g.URL = g.URL ?? {};
    g.URL.createObjectURL = (_blob) => "blob:test";
    g.URL.revokeObjectURL = () => {};
    g.Blob = class {
      constructor(parts) {
        lastBlobText = Array.isArray(parts) ? String(parts[0] ?? "") : String(parts ?? "");
        this._text = lastBlobText;
        this.size = lastBlobText.length;
      }
    };

    const mod = await server.ssrLoadModule("/src/lib/debug/peerIngestDiag.ts");
    mod.installPeerIngestDiag();
    const api = g.window.__rtwPeerIngestDiag;
    const reset = () => {
      if (typeof mod.resetPeerIngestDiagForTests === "function") mod.resetPeerIngestDiagForTests();
      else api?.reset();
      lastBlobText = null;
    };
    reset();
    await run({
      ...mod,
      ...api,
      reset,
      notePeerIngestDiag: mod.notePeerIngestDiag,
      notePeerFrameDiag: mod.notePeerFrameDiag,
      getLastBlobText: () => lastBlobText,
    });

    if (hadWindow) g.window = prevWindow;
    else delete g.window;
  } finally {
    await server.close();
  }
}

function installFakeClock() {
  const realNow = Date.now.bind(Date);
  let fake = 1_700_000_000_000;
  Date.now = () => fake;
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => {
    const id = { fn, at: fake + (ms ?? 0) };
    timers.push(id);
    return id;
  };
  globalThis.clearTimeout = (id) => {
    const i = timers.indexOf(id);
    if (i >= 0) timers.splice(i, 1);
  };
  return {
    get fake() {
      return fake;
    },
    set fake(v) {
      fake = v;
    },
    advance(ms) {
      fake += ms;
    },
    fireDue() {
      const due = timers.filter((t) => t.at <= fake);
      for (const t of due) {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
        t.fn();
      }
    },
    restore() {
      Date.now = realNow;
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    },
  };
}

test("clampCaptureSec bounds 1..20", async () => {
  await withDiag(async (mod) => {
    assert.equal(mod.clampCaptureSec(20), 20);
    assert.equal(mod.clampCaptureSec(99), 20);
    assert.equal(mod.clampCaptureSec(0), 1);
    assert.equal(mod.clampCaptureSec(Number.NaN), 20);
    assert.equal(mod.PEER_INGEST_DIAG_CAPTURE.frameCap, 500);
    assert.equal(mod.PEER_INGEST_DIAG_CAPTURE.ingestCap, 200);
    assert.equal(mod.PEER_INGEST_DIAG_CAPTURE.minFrameIntervalMs, 40);
    assert.ok(
      mod.PEER_INGEST_DIAG_CAPTURE.frameCap > mod.PEER_INGEST_DIAG_CAPTURE.ringMaxLegacy,
    );
  });
});

test("frameCap covers 20s at minFrameInterval (global 500 = two UIDs headroom)", () => {
  const maxSec = 20;
  const minIntervalMs = 40;
  const frameCap = 500;
  const neededOneUid = Math.ceil((maxSec * 1000) / minIntervalMs); // 500
  assert.equal(neededOneUid, 500);
  assert.ok(
    frameCap >= neededOneUid,
    `frameCap ${frameCap} must cover ${neededOneUid} samples for one UID over ${maxSec}s`,
  );
  // 두 UID 합은 이론상 1000 > 500 → 전역 상한으로 drop 가능. 문서·시험이 의미를 명시.
  assert.ok(
    neededOneUid * 2 > frameCap,
    "two-UID full 25Hz exceeds global 500 — per-UID interval still ~40ms until cap drops",
  );
});

test("60fps 20s single-UID reaches end at ~40ms capture spacing", async () => {
  await withDiag(async (mod) => {
    const clock = installFakeClock();
    try {
      const durationSec = 20;
      const pending = mod.capture(durationSec);
      const stepMs = 1000 / 60;
      const t0 = clock.fake;
      const end = t0 + durationSec * 1000;

      while (clock.fake <= end) {
        mod.notePeerFrameDiag({
          atMs: clock.fake,
          uid: "solo",
          peerRawDistM: 50 + (clock.fake - t0) * 0.001,
          serverTimeline: true,
        });
        clock.advance(stepMs);
      }
      clock.fireDue();
      const finished = await pending;
      const frames = finished.frames.filter((f) => f.uid === "solo");
      assert.equal(finished.capture.status, "done");
      // 60fps×40ms 게이트 → 약 3프레임마다 저장(~50ms) ≈ 400표본/20s (구버그면 1개만)
      assert.ok(
        frames.length >= 350 && frames.length <= 500,
        `expected ~400@60fps/40ms gate, got ${frames.length}`,
      );
      const withDt = frames.filter((f) => f.dtMs != null);
      const medianDt = [...withDt.map((f) => f.dtMs)].sort((a, b) => a - b)[
        Math.floor(withDt.length / 2)
      ];
      assert.ok(medianDt < 40, `dtMs median ~16ms, got ${medianDt}`);
      for (let i = 1; i < frames.length; i++) {
        assert.ok(frames[i].atMs - frames[i - 1].atMs >= 39.5);
      }
      const span = frames[frames.length - 1].atMs - frames[0].atMs;
      assert.ok(span >= durationSec * 1000 - 80, `span ${span}`);
      assert.ok(
        frames[frames.length - 1].atMs >= end - 50,
        "last sample must sit at capture end",
      );
    } finally {
      clock.restore();
      mod.reset();
    }
  });
});

test("60fps 20s two-UID: per-UID ~40ms; global 500 drops early; end retained", async () => {
  await withDiag(async (mod) => {
    const clock = installFakeClock();
    try {
      const durationSec = 20;
      const pending = mod.capture(durationSec);
      const stepMs = 1000 / 60;
      const uids = ["uidA", "uidB"];
      const t0 = clock.fake;
      const end = t0 + durationSec * 1000;

      while (clock.fake <= end) {
        for (const uid of uids) {
          mod.notePeerFrameDiag({
            atMs: clock.fake,
            uid,
            peerRawDistM: 50 + (clock.fake - t0) * 0.001,
            serverTimeline: true,
          });
        }
        clock.advance(stepMs);
      }
      clock.fireDue();
      const finished = await pending;

      assert.equal(finished.capture.status, "done");
      // 두 UID×~20Hz×20s ≈ 800 > 500 → 전역 cap drop (per-UID 상한 아님)
      assert.ok(
        finished.frameCount <= mod.PEER_INGEST_DIAG_CAPTURE.frameCap,
        `got ${finished.frameCount}`,
      );
      assert.ok(
        finished.capture.droppedFrameForCap > 0,
        "two UIDs over 20s must exceed global 500 and drop early samples",
      );
      assert.equal(finished.frameCount, mod.PEER_INGEST_DIAG_CAPTURE.frameCap);

      for (const uid of uids) {
        const frames = finished.frames.filter((f) => f.uid === uid);
        assert.ok(frames.length >= 200, `${uid} kept ~half of cap, got ${frames.length}`);
        for (let i = 1; i < frames.length; i++) {
          assert.ok(frames[i].atMs - frames[i - 1].atMs >= 39.5);
        }
        // 시간 범위는 창 *끝*까지 남는다(앞쪽만 drop)
        assert.ok(
          frames[frames.length - 1].atMs >= end - 80,
          `${uid} last atMs must reach capture end`,
        );
        const dts = frames.map((f) => f.dtMs).filter((d) => d != null);
        const medianDt = [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)];
        assert.ok(medianDt < 40, `${uid} dtMs is real frame dt, got ${medianDt}`);
      }
    } finally {
      clock.restore();
      mod.reset();
    }
  });
});

test("120fps still samples ~25Hz per UID via lastCaptured interval", async () => {
  await withDiag(async (mod) => {
    const clock = installFakeClock();
    try {
      const pending = mod.capture(2);
      const stepMs = 1000 / 120;
      const t0 = clock.fake;
      const end = t0 + 2000;
      while (clock.fake <= end) {
        mod.notePeerFrameDiag({
          atMs: clock.fake,
          uid: "u120",
          peerRawDistM: 10,
          serverTimeline: true,
        });
        clock.advance(stepMs);
      }
      clock.fireDue();
      const finished = await pending;
      const frames = finished.frames.filter((f) => f.uid === "u120");
      // 2s / 40ms = 50 (+1)
      assert.ok(frames.length >= 45 && frames.length <= 55, `got ${frames.length}`);
      for (let i = 1; i < frames.length; i++) {
        assert.ok(frames[i].atMs - frames[i - 1].atMs >= 39.5);
      }
      const dts = frames.map((f) => f.dtMs).filter((d) => d != null);
      const med = [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)];
      assert.ok(med < 20, `120fps dtMs median should be ~8ms, got ${med}`);
    } finally {
      clock.restore();
      mod.reset();
    }
  });
});

test("lastCompletedCapture survives live overwrite; counters frozen; Blob JSON matches", async () => {
  await withDiag(async (mod) => {
    const clock = installFakeClock();
    try {
      const pending = mod.capture(1);
      assert.equal(mod.status().status, "running");

      for (let i = 0; i < 30; i++) {
        clock.advance(50);
        mod.notePeerIngestDiag({
          atMs: clock.fake,
          uid: "u1",
          publicationId: "pub1",
          source: "rtdb",
          tSrvQuality: "capture",
          tSrv: clock.fake - 600,
          distM: 100 + i * 0.1,
          speedMps: 1.39,
          serverTimeline: true,
        });
        mod.notePeerFrameDiag({
          atMs: clock.fake,
          uid: "u1",
          peerRawDistM: 100 + i * 0.08,
          serverTimeline: true,
        });
      }

      const mid = mod.export({ captureOnly: true });
      assert.ok(mid.frameCount >= 5, `expected capture frames, got ${mid.frameCount}`);
      const capturedFrames = mid.frameCount;
      const capturedIngest = mid.ingestCount;
      const capturedMaxJump = { ...mid.maxJumpByUid };
      const capturedFs = mid.fsPickCount;
      const capturedEst = mid.estimatedCount;
      const capturedCapCnt = mid.captureCount;

      clock.advance(1000);
      clock.fireDue();
      const finished = await pending;
      assert.equal(finished.capture.status, "done");
      assert.equal(finished.frameCount, capturedFrames);
      assert.deepEqual(finished.maxJumpByUid, capturedMaxJump);

      // live 로 카운터·maxJump 를 크게 늘림
      for (let i = 0; i < 400; i++) {
        clock.advance(20);
        mod.notePeerFrameDiag({
          atMs: clock.fake,
          uid: "u1",
          peerRawDistM: 200 + i * 0.5,
          serverTimeline: true,
        });
        if (i % 10 === 0) {
          mod.notePeerIngestDiag({
            atMs: clock.fake,
            uid: "u1",
            publicationId: "pub1",
            source: "fs",
            tSrvQuality: "estimated",
            tSrv: null,
            distM: 200,
            speedMps: 1,
            serverTimeline: false,
          });
        }
      }

      const afterLive = mod.export();
      assert.equal(afterLive.capture.payloadSource, "last-completed");
      assert.equal(afterLive.frameCount, capturedFrames);
      assert.equal(afterLive.ingestCount, capturedIngest);
      assert.equal(afterLive.fsPickCount, capturedFs);
      assert.equal(afterLive.estimatedCount, capturedEst);
      assert.equal(afterLive.captureCount, capturedCapCnt);
      assert.deepEqual(afterLive.maxJumpByUid, capturedMaxJump);
      assert.ok(afterLive.liveCounters, "liveCounters must be present on completed export");
      assert.ok(
        afterLive.liveCounters.fsPickCount > capturedFs ||
          afterLive.liveCounters.estimatedCount > capturedEst,
        "liveCounters should reflect post-capture activity",
      );
      assert.ok(
        (afterLive.liveCounters.maxJumpByUid.u1 ?? 0) >
          (capturedMaxJump.u1 ?? 0),
        "live maxJump must not overwrite capture maxJump",
      );

      const liveOnly = mod.export({ liveRingOnly: true });
      assert.ok(liveOnly.frameCount <= mod.PEER_INGEST_DIAG_CAPTURE.ringMaxLegacy);
      assert.notEqual(liveOnly.frameCount, capturedFrames);

      const dl = mod.download();
      assert.equal(dl.ok, true);
      assert.equal(dl.payloadSource, "last-completed");
      const blobText = mod.getLastBlobText();
      assert.ok(blobText && blobText.length > 100, "Blob must contain JSON text");
      const blobJson = JSON.parse(blobText);
      assert.equal(blobJson.frameCount, capturedFrames);
      assert.equal(blobJson.ingestCount, capturedIngest);
      assert.deepEqual(blobJson.maxJumpByUid, capturedMaxJump);
      assert.equal(blobJson.capture.payloadSource, "last-completed");
      assert.equal(blobJson.frames.length, capturedFrames);

      // 반복 capture
      const pending2 = mod.capture(1);
      clock.advance(50);
      mod.notePeerFrameDiag({
        atMs: clock.fake,
        uid: "u2",
        peerRawDistM: 1,
        serverTimeline: true,
      });
      clock.advance(1000);
      clock.fireDue();
      const finished2 = await pending2;
      assert.equal(finished2.capture.status, "done");
      assert.ok(finished2.frameCount >= 1);
      assert.equal(mod.export().frameCount, finished2.frameCount);
    } finally {
      clock.restore();
      mod.reset();
    }
  });
});
