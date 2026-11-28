import assert from "node:assert/strict";
import test from "node:test";
import { PeerMotionRegistry } from "../../src/lib/peerMotion/PeerMotionRegistry.ts";
import { NearbyThumbDetector, type NearbyThumbSample } from "../../src/lib/ride/nearbyThumbs.ts";
import { publishOvertakeDisplayFrame, subscribeOvertakeFrames } from "../../src/lib/riderPrototype/overtakeThumbsRuntime.ts";

const sample = (gapM: number, extra: Partial<NearbyThumbSample> = {}): NearbyThumbSample =>
  ({ id: "peer", label: "동행", gapM, relativeSpeedMps: 1, headingDeltaDeg: 0, fresh: true, ...extra });

/** gap(ms) 함수를 100ms 간격으로 흘려 제안 시각을 모은다. */
function run(gapAt: (ms: number) => number | null, untilMs: number, extra: (ms: number) => Partial<NearbyThumbSample> = () => ({})) {
  const detector = new NearbyThumbDetector();
  const offers: number[] = [];
  for (let ms = 0; ms <= untilMs; ms += 100) {
    const gap = gapAt(ms);
    if (detector.update(gap == null ? [] : [sample(gap, extra(ms))], ms)) offers.push(ms);
  }
  return offers;
}

test("뒤에서 다가와 10m 안에 0.5초 머물면 한 번 제안하고 최대 30초 표시", () => {
  const detector = new NearbyThumbDetector();
  let candidate = null; let at = -1;
  for (let ms = 0; ms <= 20000; ms += 100) {
    const next = detector.update([sample(-30 + ms / 1000 * 2)], ms); // 상대 2m/s 로 접근
    if (next) { assert.equal(candidate, null, "한 번만"); candidate = next; at = ms; }
  }
  assert.equal(candidate?.id, "peer");
  // 10m 진입은 10s 지만, 상대가 내 옆(3m 뒤)에 오는 13.5s 에 제안한다(뒤에 있으면 화면에 안 보인다).
  assert.ok(at >= 13500 && at <= 13600, `옆에 왔을 때 제안: ${at}`);
  assert.equal(candidate!.expiresAtMs, at + 30000);
});

test("Chief 11-28 화면: 7↔5km/h 천천히 추월할 때 나란한 순간에도 버튼이 남아 있고, 지나가 12m 밖 2초 뒤 숨는다", () => {
  const detector = new NearbyThumbDetector();
  const rel = 2 / 3.6; // 0.56 m/s
  let offeredAt = -1; let nearAtSideBySide: boolean | null = null; let hiddenAt = -1;
  for (let ms = 0; ms <= 80000; ms += 100) {
    const gap = -20 + (ms / 1000) * rel;
    if (detector.update([sample(gap)], ms)) offeredAt = ms;
    if (offeredAt >= 0 && nearAtSideBySide == null && gap >= 0) nearAtSideBySide = detector.isStillNear("peer", ms);
    if (offeredAt >= 0 && hiddenAt < 0 && !detector.isStillNear("peer", ms)) hiddenAt = ms;
  }
  assert.ok(offeredAt > 0, "10m 진입 후 제안");
  assert.equal(nearAtSideBySide, true, "나란한 순간(gap 0)에도 표시 유지");
  const passedOutAt = (12 + 20) / rel * 1000; // gap 이 +12m 를 넘는 시각
  assert.ok(hiddenAt >= passedOutAt + 2000 - 100 && hiddenAt <= passedOutAt + 2200, `12m 밖 2초 뒤 숨김: ${hiddenAt} vs ${passedOutAt}`);
});

test("FS 톱니로 잠깐(2초 미만) 12m 를 넘어도 표시는 유지", () => {
  const detector = new NearbyThumbDetector();
  for (let ms = 0; ms <= 600; ms += 100) detector.update([sample(4)], ms);
  for (let ms = 700; ms <= 2400; ms += 100) detector.update([sample(14)], ms);
  assert.equal(detector.isStillNear("peer", 2400), true);
  for (let ms = 2500; ms <= 3000; ms += 100) detector.update([sample(14)], ms);
  assert.equal(detector.isStillNear("peer", 3000), false);
});

test("뒤에서 다가오는 중(3m보다 뒤)에는 제안하지 않고, 옆에 오면 제안한다", () => {
  assert.deepEqual(run(() => -6, 30000), [], "6m 뒤에 계속 머물면 없음");
  assert.deepEqual(run((ms) => (ms < 5000 ? -6 : -2.5), 30000), [5000]);
});

test("엄지척은 추월당하는 쪽만: 내가 따라잡는(동행이 느린) 경우·같은 속도는 제안하지 않는다", () => {
  assert.deepEqual(run((ms) => 30 - ms / 1000 * 2, 30000, () => ({ relativeSpeedMps: -0.56 })), []);
  assert.deepEqual(run(() => 2, 30000, () => ({ relativeSpeedMps: 0 })), []);
  assert.deepEqual(run(() => 2, 30000, () => ({ relativeSpeedMps: 0.15 })), [], "0.2 m/s 미만 차이는 같은 속도로 본다");
});

test("나란히 달리다 범위 안에서 동행이 빨라지면 그때 한 번 제안", () => {
  assert.deepEqual(run(() => 2, 30000, (ms) => ({ relativeSpeedMps: ms < 10000 ? 0 : 0.56 })), [10000]);
});

test("Chief 11-28 화면: 7↔5km/h 천천히 추월당할 때 나란한 순간에도 버튼이 남아 있고, 지나가 12m 밖 2초 뒤 숨는다", () => {
  const detector = new NearbyThumbDetector();
  const rel = 2 / 3.6;
  let offeredAt = -1; let nearAtSideBySide: boolean | null = null; let hiddenAt = -1;
  for (let ms = 0; ms <= 80000; ms += 100) {
    const gap = -20 + (ms / 1000) * rel;
    if (detector.update([sample(gap, { relativeSpeedMps: rel })], ms)) offeredAt = ms;
    if (offeredAt >= 0 && nearAtSideBySide == null && gap >= 0) nearAtSideBySide = detector.isStillNear("peer", ms);
    if (offeredAt >= 0 && hiddenAt < 0 && !detector.isStillNear("peer", ms)) hiddenAt = ms;
  }
  assert.ok(offeredAt > 0, "10m 진입 후 제안");
  assert.equal(nearAtSideBySide, true, "나란한 순간(gap 0)에도 표시 유지");
  const passedOutAt = (12 + 20) / rel * 1000;
  assert.ok(hiddenAt >= passedOutAt + 1900 && hiddenAt <= passedOutAt + 2200, `12m 밖 2초 뒤 숨김: ${hiddenAt} vs ${passedOutAt}`);
});

test("FS 톱니로 잠깐(2초 미만) 12m 를 넘어도 표시는 유지", () => {
  const detector = new NearbyThumbDetector();
  for (let ms = 0; ms <= 600; ms += 100) detector.update([sample(4)], ms);
  for (let ms = 700; ms <= 2600; ms += 100) detector.update([sample(14)], ms);
  assert.equal(detector.isStillNear("peer", 2600), true);
  for (let ms = 2700; ms <= 3000; ms += 100) detector.update([sample(14)], ms);
  assert.equal(detector.isStillNear("peer", 3000), false);
});

test("처음부터 나란히 있으면 0.5초 뒤 한 번 제안하고, 2분 동안 붙어 있어도 다시 띄우지 않는다", () => {
  assert.deepEqual(run((ms) => Math.sin(ms / 700) * 3, 120000), [500]);
});

test("0.5초 안에 스쳐 나간 진입은 제안하지 않는다", () => {
  // 10m 경계 안에 0.3초만 있다가 12m 밖으로
  const offers = run((ms) => (ms >= 1000 && ms < 1300 ? 9 : 20), 5000);
  assert.deepEqual(offers, []);
});

test("10m 경계 흔들림(9~11.5m)은 재진입으로 세지 않는다", () => {
  assert.deepEqual(run((ms) => 10.25 + Math.sin(ms / 150) * 1.25, 120000).length, 1);
});

test("12m 밖으로 멀어졌다 다시 오면: 30초 안이면 버리고, 30초 뒤면 다시 제안", () => {
  const gap = (ms: number) => {
    if (ms < 5000) return 2;          // 0.5s 에 제안
    if (ms < 15000) return 40;        // 멀어짐
    if (ms < 25000) return 3;         // 15s 재진입: 쿨다운 중 → 소진
    if (ms < 40000) return 40;
    return 3;                          // 40s 재진입: 쿨다운 끝 → 제안
  };
  assert.deepEqual(run(gap, 60000), [500, 40500]);
});

test("12m 밖으로 10초 미만 튀어나간 것(FS 톱니 표시)은 멀어진 것으로 세지 않는다", () => {
  // 0.5s 제안 뒤 40s 마다 9초씩 15m 로 튐 — 쿨다운이 지나도 재제안 없음
  assert.deepEqual(run((ms) => (ms > 5000 && ms % 40000 < 9000 ? 15 : 4), 200000), [500]);
  // 11초씩 밖에 머물면 실제로 떠난 것 → 쿨다운 뒤 돌아올 때마다 재제안
  assert.deepEqual(run((ms) => (ms > 5000 && ms % 40000 < 11000 ? 15 : 4), 90000), [500, 51500]);
});

test("목록에서 잠시 빠졌다 돌아와도 쿨다운은 유지된다", () => {
  assert.deepEqual(run((ms) => (ms >= 3000 && ms < 3500 ? null : 2), 20000), [500]);
});

test("낡은 수신·반대 방향은 범위 밖", () => {
  assert.deepEqual(run(() => 2, 10000, () => ({ fresh: false })), []);
  assert.deepEqual(run(() => 2, 10000, () => ({ headingDeltaDeg: 170 })), []);
  assert.deepEqual(run(() => Number.NaN, 10000), []);
});

test("여러 명이 같은 순간 들어오면 입력 순서와 상관없이 가장 가까운 한 명", () => {
  for (const reverse of [false, true]) {
    const detector = new NearbyThumbDetector();
    let found: string | undefined;
    for (let ms = 0; ms <= 2000 && !found; ms += 100) {
      const list = [sample(6, { id: "far", label: "먼" }), sample(-2, { id: "near", label: "가까운" })];
      found = detector.update(reverse ? list.reverse() : list, ms)?.id;
    }
    assert.equal(found, "near");
  }
});

test("실제 Registry·표시 프레임 경로: 0.2/4/12초 패킷, 5↔6km/h 저상대속에서도 한 번 제안", (t) => {
  t.mock.method(console, "debug", () => {});
  t.mock.method(console, "log", () => {});
  const geometry = { type: "LineString" as const, coordinates: [[127, 37], [127.05, 37]] as [number, number][] };
  [200, 4000, 12000].forEach((interval, index) => {
    const base = 1_000_000 + index * 10_000_000; // 런타임 100ms 스로틀이 시나리오끼리 섞이지 않게
    t.mock.timers.enable({ apis: ["Date"], now: base });
    const registry = new PeerMotionRegistry();
    const detector = new NearbyThumbDetector();
    const offers: number[] = [];
    const stop = subscribeOvertakeFrames((frame) => {
      const peer = frame.peers[0];
      if (detector.update([{ id: peer.id, label: peer.label, gapM: peer.distanceM - frame.selfDistanceM, relativeSpeedMps: peer.speedMps - frame.selfSpeedMps, headingDeltaDeg: 0, fresh: peer.fresh }], frame.nowMs)) offers.push(frame.nowMs - base);
    });
    for (let ms = 0; ms <= 200_000; ms += 33) {
      const now = base + ms;
      // 동행 6km/h 가 20m 뒤에서 출발해 5km/h 인 나를 지나 앞으로 멀어진다.
      if (ms % interval < 33) registry.ingest({ uid: "peer", publicationId: "same", distM: 80 + ms / 1000 * (6 / 3.6), speedMps: 6 / 3.6, phase: "live", serverAtMs: now }, "동행", now);
      registry.step(0.033, geometry, now);
      const features = registry.buildRenderFeatures(geometry, 0);
      publishOvertakeDisplayFrame(100 + ms / 1000 * (5 / 3.6), { speedMps: 5 / 3.6, bearingDeg: 90 },
        features.map((f) => ({ properties: { id: f.id, label: f.label, displayDistM: f.displayDistM, speedMps: f.speedMps, hdg: 90 } })),
        (uid) => registry.getOvertakeEvidence(uid, now));
      t.mock.timers.tick(33);
    }
    stop();
    t.mock.timers.reset();
    assert.equal(offers.length, 1, `${interval}ms 패킷 제안 ${JSON.stringify(offers)}`);
  });
});
