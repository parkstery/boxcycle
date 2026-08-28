import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRANK_STALL_MS,
  createCscCadenceTracker,
  parseCscCrankSample,
  u16Delta,
} from "../../src/lib/bleCscCadence.ts";
import {
  CADENCE_SPEED_MAX_KMH,
  cadenceRpmToVirtualSpeedKmh,
  resolveRideTargetSpeedKmh,
} from "../../src/lib/cadenceRideInput.ts";

const FLAG_WHEEL = 0x01;
const FLAG_CRANK = 0x02;

function view(bytes: number[]): DataView {
  const u8 = Uint8Array.from(bytes);
  return new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
}

function u16le(n: number): [number, number] {
  return [n & 0xff, (n >> 8) & 0xff];
}

/** flags=0x02 — 크랭크 전용 4바이트 */
function crankOnlyPacket(revs: number, time1024: number): DataView {
  return view([FLAG_CRANK, ...u16le(revs), ...u16le(time1024)]);
}

/** flags=0x03 — 휠 6바이트 뒤에 크랭크 4바이트 */
function wheelAndCrankPacket(
  wheelRevs: number,
  wheelTime: number,
  revs: number,
  time1024: number,
): DataView {
  return view([
    FLAG_WHEEL | FLAG_CRANK,
    wheelRevs & 0xff,
    (wheelRevs >> 8) & 0xff,
    (wheelRevs >> 16) & 0xff,
    (wheelRevs >> 24) & 0xff,
    ...u16le(wheelTime),
    ...u16le(revs),
    ...u16le(time1024),
  ]);
}

describe("CSC 패킷 파서", () => {
  it("크랭크 전용 패킷을 읽는다", () => {
    assert.deepEqual(parseCscCrankSample(crankOnlyPacket(1234, 5678)), {
      revs: 1234,
      time1024: 5678,
    });
  });

  it("휠+크랭크 패킷에서 크랭크 오프셋(1+6)을 건너뛴다", () => {
    assert.deepEqual(parseCscCrankSample(wheelAndCrankPacket(0x11223344, 999, 77, 4096)), {
      revs: 77,
      time1024: 4096,
    });
  });

  it("크랭크 플래그가 없으면 null(휠 전용 센서)", () => {
    assert.equal(parseCscCrankSample(view([FLAG_WHEEL, 1, 0, 0, 0, 0, 0])), null);
  });

  it("크랭크 플래그가 있어도 길이가 모자라면 null", () => {
    assert.equal(parseCscCrankSample(view([FLAG_CRANK, 1, 0])), null);
  });

  it("휠 필드가 잘린 패킷은 null", () => {
    assert.equal(parseCscCrankSample(view([FLAG_WHEEL | FLAG_CRANK, 1, 0, 0])), null);
  });

  it("빈 패킷은 null", () => {
    assert.equal(parseCscCrankSample(view([])), null);
  });

  it("uint16 delta 는 wrap 을 넘어 증가분을 준다", () => {
    assert.equal(u16Delta(3, 65535), 4);
    assert.equal(u16Delta(200, 64800), 936);
  });
});

describe("케이던스 트래커", () => {
  it("첫 패킷만으로는 rpm 을 만들지 않는다(null 유지)", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    assert.equal(t.ingest(crankOnlyPacket(10, 1024), 1000), null);
  });

  it("1회전/1초 = 60rpm", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(10, 1024), 1000);
    const rpm = t.ingest(crankOnlyPacket(11, 2048), 2000);
    assert.ok(rpm != null && Math.abs(rpm - 60) < 1e-6, `rpm=${rpm}`);
  });

  it("2회전/1.5초 = 80rpm", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(10, 1024), 1000);
    const rpm = t.ingest(crankOnlyPacket(12, 1024 + 1536), 2500);
    assert.ok(rpm != null && Math.abs(rpm - 80) < 1e-6, `rpm=${rpm}`);
  });

  it("회전수·이벤트시간 uint16 rollover 를 넘어 계산한다", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(65534, 64800), 1000);
    const rpm = t.ingest(crankOnlyPacket(1, 200), 1900);
    // dRev=3, dTime=936/1024s → 196.9rpm
    assert.ok(rpm != null && Math.abs(rpm - 196.923) < 0.01, `rpm=${rpm}`);
  });

  it("회전수 증가가 없는 패킷은 rpm 을 바꾸지 않는다", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(10, 1024), 1000);
    const rpm = t.ingest(crankOnlyPacket(11, 2048), 2000);
    assert.equal(t.ingest(crankOnlyPacket(11, 2048), 3000), rpm);
  });

  it("분해능 미만(dt<0.08s)과 비정상 고 rpm 은 버린다", () => {
    const tooFast = createCscCadenceTracker();
    tooFast.reset(0);
    tooFast.ingest(crankOnlyPacket(10, 1024), 1000);
    // dRev=10, dt=100/1024s → 약 6144rpm → 거부
    assert.equal(tooFast.ingest(crankOnlyPacket(20, 1124), 1100), null);

    const tooShort = createCscCadenceTracker();
    tooShort.reset(0);
    tooShort.ingest(crankOnlyPacket(10, 1024), 1000);
    // dt=50/1024s ≈ 0.049s → 분해능 미만
    assert.equal(tooShort.ingest(crankOnlyPacket(11, 1074), 1050), null);
  });

  it("유효 샘플 전에는 stall 폴링이 0 이 아니라 null 을 유지한다", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    assert.equal(t.pollStall(100_000), null);
  });

  it("페달을 멈추면 stall 시간 뒤 0rpm 으로 확정한다", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(10, 1024), 1000);
    t.ingest(crankOnlyPacket(11, 2048), 2000);
    assert.equal(t.pollStall(2000 + CRANK_STALL_MS), 60);
    assert.equal(t.pollStall(2000 + CRANK_STALL_MS + 1), 0);
  });

  it("정지 후 다시 페달링하면 재기준점을 잡고 새 rpm 을 낸다", () => {
    const t = createCscCadenceTracker();
    t.reset(0);
    t.ingest(crankOnlyPacket(10, 1024), 1000);
    t.ingest(crankOnlyPacket(11, 2048), 2000);
    t.pollStall(9000);
    assert.equal(t.rpm, 0);
    assert.equal(t.ingest(crankOnlyPacket(12, 30_000), 10_000), 0);
    const rpm = t.ingest(crankOnlyPacket(13, 30_000 + 1024), 11_000);
    assert.ok(rpm != null && Math.abs(rpm - 60) < 1e-6, `rpm=${rpm}`);
  });
});

describe("케이던스 → 가상 속도", () => {
  it("deadzone 미만은 0km/h", () => {
    assert.equal(cadenceRpmToVirtualSpeedKmh(0), 0);
    assert.equal(cadenceRpmToVirtualSpeedKmh(7.9), 0);
  });

  it("null·NaN 은 0km/h", () => {
    assert.equal(cadenceRpmToVirtualSpeedKmh(null), 0);
    assert.equal(cadenceRpmToVirtualSpeedKmh(undefined), 0);
    assert.equal(cadenceRpmToVirtualSpeedKmh(Number.NaN), 0);
  });

  it("고정 가상 기어비 0.32 를 적용한다", () => {
    assert.ok(Math.abs(cadenceRpmToVirtualSpeedKmh(40) - 12.8) < 1e-9);
    assert.ok(Math.abs(cadenceRpmToVirtualSpeedKmh(60) - 19.2) < 1e-9);
    assert.ok(Math.abs(cadenceRpmToVirtualSpeedKmh(80) - 25.6) < 1e-9);
  });

  it("상한 30km/h 를 넘지 않는다", () => {
    assert.equal(cadenceRpmToVirtualSpeedKmh(94), CADENCE_SPEED_MAX_KMH);
    assert.equal(cadenceRpmToVirtualSpeedKmh(200), CADENCE_SPEED_MAX_KMH);
  });
});

describe("목표 속도 결정", () => {
  it("manual 모드는 슬라이더 값을 클램프해 쓴다", () => {
    assert.equal(
      resolveRideTargetSpeedKmh({
        mode: "manual",
        manualSpeedKmh: 22,
        crankRpm: null,
        sensorConnected: false,
      }),
      22,
    );
    assert.equal(
      resolveRideTargetSpeedKmh({
        mode: "manual",
        manualSpeedKmh: 999,
        crankRpm: null,
        sensorConnected: false,
      }),
      50,
    );
  });

  it("cadence 모드에서 페달을 돌리면 케이던스 속도로 달린다", () => {
    assert.ok(
      Math.abs(
        resolveRideTargetSpeedKmh({
          mode: "cadence",
          manualSpeedKmh: 40,
          crankRpm: 60,
          sensorConnected: true,
        }) - 19.2,
      ) < 1e-9,
    );
  });

  it("연결된 정지 상태(0rpm)는 manual 속도로 fallback 하지 않는다", () => {
    assert.equal(
      resolveRideTargetSpeedKmh({
        mode: "cadence",
        manualSpeedKmh: 40,
        crankRpm: 0,
        sensorConnected: true,
      }),
      0,
    );
  });

  it("아직 샘플이 없어도(null) manual 속도로 fallback 하지 않는다", () => {
    assert.equal(
      resolveRideTargetSpeedKmh({
        mode: "cadence",
        manualSpeedKmh: 40,
        crankRpm: null,
        sensorConnected: true,
      }),
      0,
    );
  });

  it("연결이 끊기면 마지막 rpm 이 남아 있어도 목표 속도는 0", () => {
    assert.equal(
      resolveRideTargetSpeedKmh({
        mode: "cadence",
        manualSpeedKmh: 40,
        crankRpm: 90,
        sensorConnected: false,
      }),
      0,
    );
  });
});
