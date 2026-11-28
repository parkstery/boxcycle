import assert from "node:assert/strict";
import test from "node:test";
import { RiderPassingMotion, type PassingRider } from "../../src/lib/riderPrototype/riderPassingMotion.ts";
import type { RiderGlbModelSpec } from "../../src/lib/riderPrototype/iso2dMarker.ts";

function rider(uid: string, distanceM: number, speedMps: number, headingDeg = 90): PassingRider {
  return { uid, distanceM, speedMps, headingDeg, fresh: true };
}
function simulate(fps: number, reverseOrder = false) {
  const motion = new RiderPassingMotion();
  const rows: { t: number; gap: number; offset: number; angle: number; otherOffset: number }[] = [];
  for (let frame = 0; frame <= fps * 14; frame++) {
    const t = frame / fps;
    const riders = [rider("fast", 7 * t, 7), rider("slow", 16 + 5 * t, 5)];
    const out = motion.update(reverseOrder ? riders.reverse() : riders, frame ? 1 / fps : 0);
    const fast = out.get("fast")!;
    rows.push({ t, gap: 16 - 2 * t, offset: fast.offsetM, angle: fast.headingOffsetDeg, otherOffset: out.get("slow")!.offsetM });
  }
  return rows;
}

test("빠른 라이더는 왼쪽으로 비껴서고 몸이 나란할 때 최소 어깨 간격을 유지한다", () => {
  const rows = simulate(60);
  assert.ok(rows.filter((r) => Math.abs(r.gap) <= 1.5).every((r) => r.offset - r.otherOffset <= -0.85));
  assert.ok(rows.filter((r) => Math.abs(r.gap) <= 0.5).every((r) => Math.abs(r.offset + 1) < 0.01));
  assert.equal(rows[0].offset, 0);
  assert.ok(Math.abs(rows.at(-1)!.offset) < 0.01);
  assert.ok(rows.some((r) => r.angle < 0));
  assert.ok(rows.some((r) => r.angle > 0));
});

test("15·30·60FPS 위치와 두 클라이언트의 self/peer 순서가 같고 횡속도 상한을 지킨다", () => {
  const reference = simulate(60);
  for (const fps of [15, 30, 60]) {
    const a = simulate(fps), b = simulate(fps, true);
    assert.deepEqual(a, b);
    for (let i = 1; i < a.length; i++) {
      assert.ok(Math.abs(a[i].offset - a[i - 1].offset) <= (7 * 0.07) / fps + 1e-9);
      assert.ok(Math.abs(a[i].offset - reference[Math.round(a[i].t * 60)].offset) < 0.05);
    }
  }
});

test("동일 속도 첫 겹침은 UID로 결정적인 차선에 배치하고 정지 중 옆미끄럼이 없다", () => {
  const motion = new RiderPassingMotion();
  const first = motion.update([rider("a", 10, 5), rider("b", 10, 5)], 0);
  assert.equal(first.get("a")!.offsetM, 0);
  assert.equal(first.get("b")!.offsetM, -1);
  const stopped = motion.update([rider("a", 10, 0), rider("b", 10, 0)], 0.5);
  assert.equal(stopped.get("b")!.offsetM, -1);
  const resumed = motion.update([rider("b", 11, 5), rider("a", 11, 5)], 1 / 30);
  assert.equal(resumed.get("b")!.offsetM, -1);
});

test("역방향·낡은 동행은 추월 대상으로 삼지 않고 이탈 상태를 정리한다", () => {
  const motion = new RiderPassingMotion();
  const out = motion.update([rider("self", 10, 7), rider("opposite", 11, 5, 270),
    { ...rider("stale", 12, 5), fresh: false }], 0.1);
  assert.equal(out.get("self")!.offsetM, 0);
  motion.update([], 0.1);
  assert.equal(motion.update([rider("self", 100, 7)], 0).get("self")!.offsetM, 0);
});

test("세 명 동시 통과에서도 UID 정렬에 상관없이 어깨 차선을 분리한다", () => {
  const riders = [rider("z-slow", 10, 5), rider("a-middle", 10, 6), rider("b-fast", 10, 7)];
  const one = new RiderPassingMotion().update(riders, 0);
  const two = new RiderPassingMotion().update([...riders].reverse(), 0);
  for (const r of riders) assert.deepEqual(one.get(r.uid), two.get(r.uid));
  assert.equal(one.get("z-slow")!.offsetM, 0);
  assert.equal(one.get("a-middle")!.offsetM, -1);
  assert.equal(one.get("b-fast")!.offsetM, -2);
});

test("추월 중 소스 신선도가 잠시 꺼져도 중앙으로 복귀하지 않는다", () => {
  const motion = new RiderPassingMotion();
  motion.update([rider("fast", 10, 7), rider("slow", 10.5, 5)], 0);
  const stale = motion.update([rider("fast", 10, 7), { ...rider("slow", 10.5, 5), fresh: false }], 0.5);
  assert.equal(stale.get("fast")!.offsetM, -1);
  const fresh = motion.update([rider("fast", 10.5, 7), rider("slow", 11, 5)], 1 / 30);
  assert.equal(fresh.get("fast")!.offsetM, -1);
});

test("두 화면에서 self/peer 역할을 바꿔도 같은 UID는 같은 위치이며 이름표도 같이 이동한다", () => {
  const at: [number, number] = [127, 37];
  const specsA: RiderGlbModelSpec[] = [
    { id: "live-self", kind: "self", lngLat: at, bearingDeg: 90, speedMps: 7 },
    { id: "slow", kind: "peer", lngLat: at, bearingDeg: 90, speedMps: 5 },
  ];
  const specsB: RiderGlbModelSpec[] = [
    { id: "live-self", kind: "self", lngLat: at, bearingDeg: 90, speedMps: 5 },
    { id: "fast", kind: "peer", lngLat: at, bearingDeg: 90, speedMps: 7 },
  ];
  const sourceA = [{ geometry: { coordinates: at }, properties: { id: "slow", displayDistM: 10.5, speedMps: 5, hdg: 90, phaseRev: 0 } }];
  const sourceB = [{ geometry: { coordinates: at }, properties: { id: "fast", displayDistM: 10, speedMps: 7, hdg: 90, phaseRev: 0 } }];
  const markersA = sourceA.map((f) => ({ ...f, geometry: { ...f.geometry } }));
  const markersB = sourceB.map((f) => ({ ...f, geometry: { ...f.geometry } }));
  new RiderPassingMotion().apply(specsA, "fast", 10, sourceA, () => true, 0, markersA);
  new RiderPassingMotion().apply(specsB, "slow", 10.5, sourceB, () => true, 0, markersB);
  assert.deepEqual(specsA[0].lngLat, specsB[1].lngLat);
  assert.deepEqual(specsA[1].lngLat, specsB[0].lngLat);
  assert.deepEqual(markersB[0].geometry.coordinates, specsB[1].lngLat);
  assert.deepEqual(sourceB[0].geometry.coordinates, at, "source motion geometry must stay untouched");
  assert.equal(specsA[0].speedMps, 7);
  assert.ok(specsA[0].lngLat[1] > at[1], "eastbound passing left must move north");
});

test("출발 정지 뒤 속도가 역전되어도 두 라이더가 같은 왼쪽 상한으로 몰리지 않는다", () => {
  for (const fps of [15, 30, 60]) {
    const motion = new RiderPassingMotion();
    const first = motion.update([rider("self", 10, 0), rider("peer", 10.5, 5)], 0);
    assert.equal(first.get("peer")!.offsetM, -1);
    let result = first;
    // 11-28: 옆이격이 감쇠 스프링이라 중앙 복귀 끝이 부드럽게 감속해 약 0.1초 늦다(8초 → 9초까지 관찰).
    for (let frame = 1; frame <= fps * 9; frame++) {
      const t = frame / fps;
      result = motion.update([rider("self", 10 + 6 * t, 6), rider("peer", 10.5 + 5 * t, 5)], 1 / fps);
      if (Math.abs(0.5 - t) <= 1.5) {
        assert.ok(Math.abs(result.get("self")!.offsetM - result.get("peer")!.offsetM) >= 0.85,
          `${fps}fps t=${t}: self=${result.get("self")!.offsetM}, peer=${result.get("peer")!.offsetM}`);
      }
    }
    assert.ok(Math.abs(result.get("self")!.offsetM) < 0.01);
    assert.ok(Math.abs(result.get("peer")!.offsetM) < 0.01);
  }
});

test("급한 속도 역전 후 같은 속도가 되어도 서로의 차선을 쫓는 순환이 없다", () => {
  const motion = new RiderPassingMotion();
  motion.update([rider("a", 10, 0), rider("b", 10.5, 5)], 0);
  motion.update([rider("a", 10.1, 6), rider("b", 10.6, 5)], 1 / 60);
  for (let frame = 0; frame < 300; frame++) {
    const result = motion.update([rider("a", 10.1 + frame / 12, 5), rider("b", 10.6 + frame / 12, 5)], 1 / 60);
    assert.ok(Math.abs(result.get("a")!.offsetM - result.get("b")!.offsetM) >= 0.85);
  }
});

test("11-28 엄지척 방향: 두 화면에서 상대가 보이는 쪽이 서로 반대이고 실제 비켜간 쪽과 일치한다", async () => {
  const { lateralSideOfPeer, publishRiderLateralOffsets } = await import("../../src/lib/riderPrototype/overtakeThumbsRuntime.ts");
  const at: [number, number] = [127, 37];
  const screenA = new RiderPassingMotion(); // A = 빠른 추월자(fast) 화면
  const screenB = new RiderPassingMotion(); // B = 추월당하는(slow) 화면
  let checked = 0;
  for (let frame = 0; frame <= 30 * 8; frame++) {
    const t = frame / 30, dt = frame ? 1 / 30 : 0, now = 1_000_000 + frame * 33;
    const fastD = 7 * t, slowD = 12 + 5 * t;
    const feature = (id: string, d: number, v: number) => [{ geometry: { coordinates: at }, properties: { id, displayDistM: d, speedMps: v, hdg: 90, phaseRev: 0 } }];
    screenA.apply([{ id: "live-self", kind: "self", lngLat: at, bearingDeg: 90, speedMps: 7 }, { id: "slow", kind: "peer", lngLat: at, bearingDeg: 90, speedMps: 5 }],
      "fast", fastD, feature("slow", slowD, 5), () => true, dt, []);
    const sideOnA = lateralSideOfPeer("slow", Date.now());
    screenB.apply([{ id: "live-self", kind: "self", lngLat: at, bearingDeg: 90, speedMps: 5 }, { id: "fast", kind: "peer", lngLat: at, bearingDeg: 90, speedMps: 7 }],
      "slow", slowD, feature("fast", fastD, 7), () => true, dt, []);
    const sideOnB = lateralSideOfPeer("fast", Date.now());
    if (Math.abs(fastD - slowD) < 3 && sideOnA && sideOnB) {
      assert.equal(sideOnB, "left", "추월당한 사람에게 추월자는 왼쪽(빠른 쪽이 왼쪽으로 비켜감)");
      assert.equal(sideOnA, "right", "추월자에게 엄지척한 사람은 오른쪽");
      checked++;
    }
    void now;
  }
  assert.ok(checked > 10, `나란한 구간에서 방향 판정 ${checked}회`);
  // 반대로 추월자가 오른쪽에 있으면 오른쪽(손도 오른손 클립)으로 향한다.
  publishRiderLateralOffsets(0, new Map([["peer", 1.2]]), 5000);
  assert.equal(lateralSideOfPeer("peer", 5100), "right");
  publishRiderLateralOffsets(0.4, new Map([["peer", -0.8]]), 5000);
  assert.equal(lateralSideOfPeer("peer", 5100), "left");
  assert.equal(lateralSideOfPeer("peer", 6500), null, "1초 넘게 낡은 옆 위치는 쓰지 않는다");
  publishRiderLateralOffsets(0, new Map([["peer", 0.1]]), 7000);
  assert.equal(lateralSideOfPeer("peer", 7000), null, "옆 간격 0.3m 미만은 판정하지 않는다(기본값 사용)");
});

test("11-28 툭툭·각도 요동: 20/30ms 섞인 PC 프레임에서도 진입·진출부 몸 방향이 뒤집히지 않는다", () => {
  // 전례(261017 앞뒤 떨림)와 같은 재생 조건: 고른 60Hz 에서는 안 보이고 20/30ms 섞이면 드러난다.
  // 배포본(e33fa0fe, 최대감속 제어)은 20/30ms 에서 추월 한 번에 방향 꺾임이 26회 뒤집혔다.
  for (const pattern of [[1000 / 60], [1000 / 30], [20, 30], [16.7, 33.3]]) {
    const motion = new RiderPassingMotion();
    let t = 0, frame = 0, flips = 0, maxStep = 0, moved = 0;
    let prev: { h: number; dh: number } | null = null;
    while (t < 60) {
      const dt = frame ? pattern[frame % pattern.length] / 1000 : 0; t += dt; frame++;
      const out = motion.update([rider("fast", 7 / 3.6 * t, 7 / 3.6), rider("slow", 20 + 5 / 3.6 * t, 5 / 3.6)], dt).get("fast")!;
      moved = Math.max(moved, Math.abs(out.offsetM));
      if (prev) {
        const dh = out.headingOffsetDeg - prev.h;
        maxStep = Math.max(maxStep, Math.abs(dh));
        if (Math.abs(dh) > 0.05 && Math.abs(prev.dh) > 0.05 && Math.sign(dh) !== Math.sign(prev.dh)) flips++;
        prev = { h: out.headingOffsetDeg, dh: Math.abs(dh) > 0.05 ? dh : prev.dh };
      } else prev = { h: out.headingOffsetDeg, dh: 0 };
    }
    const label = pattern.map((v) => v.toFixed(1)).join("/");
    assert.ok(moved > 0.9, `${label}ms 실제로 비켜간다`);
    // 진입(밖으로)·진출(안으로) 각각 한 번씩 「늘다→줄다」 방향 전환은 정상(최대 4회).
    assert.ok(flips <= 4, `${label}ms 방향 꺾임 뒤집힘 ${flips}회`);
    assert.ok(maxStep <= 1.2, `${label}ms 프레임당 방향 꺾임 ${maxStep.toFixed(2)}°`);
  }
});

test("11-28 진입·진출 좌우 흔들림: 속도가 1초마다 출렁여도 한 번의 추월에서 「나갔다 들어옴」 한 번뿐이다", () => {
  // Chief 3차 제보(툭툭은 사라졌고 진입·진출부 좌우 흔들림 남음). 목표 차선이 순간 속도 차로 정해져
  // 1초마다 ±0.4~0.75m/s 출렁이는 속도(센서·경사)에 경계가 앞뒤로 움직였다.
  // 수정 전(스프링 2차)은 같은 조건에서 좌우 전환 3~8회였다.
  const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const [fastKmh, slowKmh] of [[26, 21], [25, 23]]) for (const amp of [0.8, 1.5]) for (const seed of [1, 2, 3, 4]) {
    const r = rng(seed); const motion = new RiderPassingMotion();
    let t = 0, frame = 0, fastD = 0, slowD = 15, fastV = fastKmh / 3.6, slowV = slowKmh / 3.6, sinceStep = 0, sincePacket = 0, packetV = slowV;
    let sign = 0, turns = 0, moved = 0;
    while (t < 70) {
      const dt = frame++ % 2 ? 0.03 : 0.02; t += dt; sinceStep += dt; sincePacket += dt;
      if (sinceStep >= 1) { sinceStep = 0; fastV = fastKmh / 3.6 + (r() - 0.5) * amp; slowV = slowKmh / 3.6 + (r() - 0.5) * amp; }
      if (sincePacket >= 0.2) { sincePacket = 0; packetV = slowV; }
      fastD += fastV * dt; slowD += slowV * dt;
      const out = motion.update([rider("fast", fastD, fastV), rider("slow", slowD, packetV)], dt).get("fast")!;
      moved = Math.max(moved, -out.offsetM);
      if (Math.abs(out.headingOffsetDeg) > 0.3) {
        if (sign && Math.sign(out.headingOffsetDeg) !== sign) turns++;
        sign = Math.sign(out.headingOffsetDeg);
      }
    }
    const label = `${fastKmh}/${slowKmh}km/h ±${amp / 2}m/s seed${seed}`;
    assert.ok(moved > 0.9, `${label} 실제로 비켜간다`);
    assert.ok(turns <= 1, `${label} 좌우 전환 ${turns}회`);
  }
});
