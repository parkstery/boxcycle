/**
 * 표시 시계 회귀. test:quick 의 ride 묶음(jitter 폴더)에 들어간다.
 *
 *   cd apps/web
 *   node --test scripts/jitter/raf-beat-replay.test.mjs
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  IRREGULAR_SCENARIOS,
  SPEED_CV_MAX,
  loadReplayApi,
  mixedFrameDts,
  replayIrregularReport,
  replayMatrix,
  replayPhaseLag,
} from "./raf-beat-replay.mjs";

/** Date.now() 와 performance.timeOrigin + now 가 같은 epoch 축인지. 수 ms. */
const EPOCH_SKEW_MS = 20;

describe("표시 시계 epoch", () => {
  it("performance.timeOrigin + now 와 Date.now() 차이가 수 ms 이내", () => {
    const epoch = performance.timeOrigin + performance.now();
    const wall = Date.now();
    const skew = Math.abs(epoch - wall);
    assert.ok(
      skew <= EPOCH_SKEW_MS,
      `epoch skew ${skew}ms (timeOrigin+now ${epoch}, Date.now ${wall})`,
    );
  });
});

describe("rAF 비트 재생", () => {
  /** @type {Awaited<ReturnType<typeof loadReplayApi>> | null} */
  let session = null;

  before(async () => {
    session = await loadReplayApi();
  });

  after(async () => {
    await session?.close();
  });

  it("같은 epoch 만 재사용하고, 예전 8ms 창 안의 다른 시각은 전진한다", () => {
    const api = session.api;
    api.resetServerOffset();
    api.setServerOffset(0);
    api.resetCommonDisplayClock();
    const t = 5_000_000.25;
    const first = api.ensureFrameDisplayRenderTimeMs(t);
    const again = api.ensureFrameDisplayRenderTimeMs(t);
    assert.equal(again, first);
    const later = api.ensureFrameDisplayRenderTimeMs(t + 6.9);
    assert.ok(later > first + 5, `6.9ms 뒤 시계가 유지됨 first=${first} later=${later}`);
    api.resetServerOffset();
    api.resetCommonDisplayClock();
  });

  it("인자를 생략하면 Date.now() 축을 쓴다", () => {
    const api = session.api;
    api.resetServerOffset();
    api.setServerOffset(0);
    api.resetCommonDisplayClock();
    const wall = Date.now();
    const render = api.ensureFrameDisplayRenderTimeMs();
    assert.ok(Math.abs(render - wall) <= EPOCH_SKEW_MS, `render ${render} wall ${wall}`);
    api.resetServerOffset();
    api.resetCommonDisplayClock();
  });

  it("단독 주행에서 한 틱 뒤짐은 catch-up 이 아니다", () => {
    const api = session.api;
    api.resetServerOffset();
    api.setServerOffset(0);
    api.resetCommonDisplayClock();
    api.setCompanionDisplayActive(false);
    api.ensureFrameDisplayRenderTimeMs(10_000);
    assert.equal(api.companionDisplayDelayMs(), 0);
    assert.equal(api.isDisplayRenderCatchingUp(10_006.9), false);
    api.resetServerOffset();
    api.resetCommonDisplayClock();
  });

  it("동행을 끄면 지연 0 이어도 모드 전환 catch-up 은 유지된다", () => {
    const api = session.api;
    api.resetServerOffset();
    api.setServerOffset(0);
    api.resetCommonDisplayClock();
    api.setCompanionDisplayActive(true);
    assert.equal(api.companionDisplayDelayMs(), 600);
    api.ensureFrameDisplayRenderTimeMs(20_000);
    api.ensureFrameDisplayRenderTimeMs(20_016.7);
    api.setCompanionDisplayActive(false);
    assert.equal(api.companionDisplayDelayMs(), 0);
    api.ensureFrameDisplayRenderTimeMs(20_033.4);
    assert.equal(api.isDisplayRenderCatchingUp(20_033.4), true);
    api.resetServerOffset();
    api.resetCommonDisplayClock();
  });

  it("60/120/144/165 Hz × 버퍼 있음·없음 — 절대 역행 0, 카메라 대비 역행 0, speedCv 상한", () => {
    const runs = replayMatrix(session.api);
    assert.equal(runs.length, 8);
    for (const run of runs) {
      const label = `${run.hz}Hz buffer=${run.withBuffer}`;
      assert.equal(run.self.reverse, 0, `${label} self ${run.self.reverse}`);
      assert.equal(run.along.reverse, 0, `${label} pacer ${run.along.reverse}`);
      assert.equal(run.gap.reverse, 0, `${label} gap ${run.gap.reverse}`);
      assert.equal(run.camRel.reverse, 0, `${label} camera ${run.camRel.reverse}`);
      assert.equal(run.renderHoldFrames, 0, `${label} hold ${run.renderHoldFrames}`);
      assert.equal(run.catchingUpFrames, 0, `${label} catchingUp ${run.catchingUpFrames}`);
      assert.ok(run.self.speedCv != null && run.self.speedCv <= SPEED_CV_MAX, `${label} self cv ${run.self.speedCv}`);
      assert.ok(run.along.speedCv != null && run.along.speedCv <= SPEED_CV_MAX, `${label} pacer cv ${run.along.speedCv}`);
    }
  });

  it("불규칙 간격 — 위상 보정 전 speedCv 가 크고, 보정 후 본인·페이서·동행은 0.05 이하, 역행 0", () => {
    const rows = replayIrregularReport(session.api);
    assert.equal(rows.length, IRREGULAR_SCENARIOS.length);
    for (const row of rows) {
      const label = row.id;
      assert.equal(row.sameLoop.renderHoldFrames, 0, `${label} hold`);
      assert.equal(row.sameLoop.catchingUpFrames, 0, `${label} catch`);
      assert.equal(row.sameLoop.self.reverse, 0, `${label} same self rev`);
      assert.ok(
        row.before.self.speedCv != null && row.before.self.speedCv > SPEED_CV_MAX,
        `${label} before self cv ${row.before.self.speedCv}`,
      );
      assert.equal(row.before.self.reverse, 0, `${label} before self rev`);
      assert.equal(row.before.along.reverse, 0, `${label} before pacer rev`);
      assert.equal(row.after.self.reverse, 0, `${label} after self rev`);
      assert.equal(row.after.along.reverse, 0, `${label} after pacer rev`);
      assert.ok(
        row.after.self.speedCv != null && row.after.self.speedCv <= SPEED_CV_MAX,
        `${label} after self cv ${row.after.self.speedCv}`,
      );
      assert.ok(
        row.after.along.speedCv != null && row.after.along.speedCv <= SPEED_CV_MAX,
        `${label} after pacer cv ${row.after.along.speedCv}`,
      );
      assert.ok(
        row.peerBefore.speedCv != null && row.peerBefore.speedCv > SPEED_CV_MAX,
        `${label} peer before cv ${row.peerBefore.speedCv}`,
      );
      assert.equal(row.peerBefore.reverse, 0, `${label} peer before rev`);
      assert.equal(row.peerAfter.reverse, 0, `${label} peer after rev`);
      assert.ok(
        row.peerAfter.speedCv != null && row.peerAfter.speedCv <= SPEED_CV_MAX,
        `${label} peer after cv ${row.peerAfter.speedCv}`,
      );
    }
  });

  it("간격이 일정하면 적분보다 먼저 읽어도 speedCv 가 상한 이하다", () => {
    const dts = mixedFrameDts(1000 / 60, 1000 / 60, 1);
    const lagged = replayPhaseLag(session.api, dts, false);
    assert.equal(lagged.self.reverse, 0);
    assert.ok(lagged.self.speedCv != null && lagged.self.speedCv <= SPEED_CV_MAX, `cv ${lagged.self.speedCv}`);
  });
});
