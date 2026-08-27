import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cadenceChipView,
  isRideInputReady,
  resolveRideInputReadiness,
  rideInputBlockedReason,
  type CadenceHudState,
  type RideInputReadinessInput,
} from "../../src/lib/cadenceSensorUi.ts";

function hud(over: Partial<CadenceHudState> = {}): CadenceHudState {
  return { capable: true, uiState: "idle", crankRpm: null, ...over };
}

function readiness(over: Partial<RideInputReadinessInput> = {}): RideInputReadinessInput {
  return {
    mode: "manual",
    manualChosen: false,
    uiState: "idle",
    cadenceSampleSeen: false,
    ...over,
  };
}

describe("HUD 센서 칩 표시", () => {
  it("미연결: 흰 LED + CAD", () => {
    const v = cadenceChipView(hud(), false);
    assert.equal(v.led, "white");
    assert.equal(v.text, "CAD");
    assert.equal(v.pulsing, false);
  });

  it("검색·연결 중: 흰 LED pulse, 텍스트 폭은 CAD 로 유지", () => {
    const v = cadenceChipView(hud({ uiState: "connecting" }), false);
    assert.equal(v.led, "white");
    assert.equal(v.pulsing, true);
    assert.equal(v.text, "CAD");
  });

  it("연결됨·주행 전: 초록 LED + CAD (RPM 을 앞세우지 않는다)", () => {
    const v = cadenceChipView(hud({ uiState: "connected", crankRpm: 72 }), false);
    assert.equal(v.led, "green");
    assert.equal(v.text, "CAD");
  });

  it("연결됨·주행 중 최초 샘플 전: 초록 LED + '-- rpm'", () => {
    const v = cadenceChipView(hud({ uiState: "connected", crankRpm: null }), true);
    assert.equal(v.led, "green");
    assert.equal(v.text, "-- rpm");
  });

  it("연결됨·주행 중 페달 정지: 초록 LED + '0 rpm'", () => {
    const v = cadenceChipView(hud({ uiState: "connected", crankRpm: 0 }), true);
    assert.equal(v.led, "green");
    assert.equal(v.text, "0 rpm");
  });

  it("연결됨·주행 중 페달링: 반올림한 N rpm", () => {
    assert.equal(cadenceChipView(hud({ uiState: "connected", crankRpm: 71.6 }), true).text, "72 rpm");
  });

  it("주행 중 단절/오류: 흰 LED + '-- rpm'", () => {
    for (const uiState of ["disconnected", "error"] as const) {
      const v = cadenceChipView(hud({ uiState, crankRpm: 60 }), true);
      assert.equal(v.led, "white", uiState);
      assert.equal(v.text, "-- rpm", uiState);
    }
  });

  it("Web Bluetooth 미지원: 흰 LED + CAD", () => {
    const v = cadenceChipView(hud({ capable: false }), true);
    assert.equal(v.led, "white");
    assert.equal(v.text, "CAD");
  });

  it("LED 는 초록·흰색 두 값만 쓴다", () => {
    const cases: CadenceHudState[] = [
      hud(),
      hud({ capable: false }),
      hud({ uiState: "connecting" }),
      hud({ uiState: "connected", crankRpm: 90 }),
      hud({ uiState: "disconnected" }),
      hud({ uiState: "error" }),
    ];
    for (const c of cases) {
      for (const riding of [false, true]) {
        assert.ok(["green", "white"].includes(cadenceChipView(c, riding).led));
      }
    }
  });

  it("칩 텍스트에 장치명이 들어가지 않는다", () => {
    for (const riding of [false, true]) {
      const v = cadenceChipView(hud({ uiState: "connected", crankRpm: 72 }), riding);
      assert.ok(!/CYCPLUS/i.test(v.text));
      assert.ok(!/CYCPLUS/i.test(v.ariaLabel));
    }
  });

  it("접근성 이름에 연결 상태와 RPM 이 포함된다", () => {
    assert.equal(
      cadenceChipView(hud({ uiState: "connected", crankRpm: 72 }), true).ariaLabel,
      "케이던스 센서: 연결됨, 72 rpm",
    );
    assert.equal(cadenceChipView(hud(), false).ariaLabel, "케이던스 센서: 연결 안 됨");
    assert.equal(
      cadenceChipView(hud({ uiState: "connected", crankRpm: 0 }), true).ariaLabel,
      "케이던스 센서: 연결됨, 페달 정지",
    );
    assert.equal(
      cadenceChipView(hud({ uiState: "disconnected" }), true).ariaLabel,
      "케이던스 센서: 연결 끊김",
    );
  });
});

describe("주행 입력 준비 게이트", () => {
  it("기본 manual 값만으로는 준비 완료가 아니다", () => {
    const r = resolveRideInputReadiness(readiness());
    assert.equal(r, "choice-required");
    assert.equal(isRideInputReady(r), false);
    assert.equal(
      rideInputBlockedReason(r),
      "센서를 연결해 페달을 확인하거나 체험 속도를 선택하세요.",
    );
  });

  it("명시적 「체험 속도로 준비」 후 Go 가능", () => {
    const r = resolveRideInputReadiness(readiness({ manualChosen: true }));
    assert.equal(r, "manual-ready");
    assert.equal(isRideInputReady(r), true);
    assert.equal(rideInputBlockedReason(r), null);
  });

  it("cadence 는 connected 만으로 부족하다 — 유효 샘플이 있어야 준비 완료", () => {
    const awaiting = resolveRideInputReadiness(
      readiness({ mode: "cadence", uiState: "connected", cadenceSampleSeen: false }),
    );
    assert.equal(awaiting, "cadence-awaiting-sample");
    assert.equal(isRideInputReady(awaiting), false);
    assert.equal(rideInputBlockedReason(awaiting), "페달을 돌려 센서를 확인하세요.");

    const ready = resolveRideInputReadiness(
      readiness({ mode: "cadence", uiState: "connected", cadenceSampleSeen: true }),
    );
    assert.equal(ready, "cadence-ready");
    assert.equal(isRideInputReady(ready), true);
  });

  it("chooser 진행 중은 준비 완료가 아니다", () => {
    const r = resolveRideInputReadiness(readiness({ mode: "cadence", uiState: "connecting" }));
    assert.equal(r, "cadence-connecting");
    assert.equal(isRideInputReady(r), false);
  });

  it("Go 전에 단절되면 준비 완료가 풀린다", () => {
    for (const uiState of ["disconnected", "error", "idle"] as const) {
      const r = resolveRideInputReadiness(
        readiness({ mode: "cadence", uiState, cadenceSampleSeen: true }),
      );
      assert.equal(r, "choice-required", uiState);
      assert.equal(isRideInputReady(r), false, uiState);
    }
  });

  it("페달을 멈춰 0rpm 이 돼도 준비 완료는 유지된다", () => {
    // 0rpm 은 crankRpm !== null 이므로 호출 측이 cadenceSampleSeen 을 유지한다.
    const r = resolveRideInputReadiness(
      readiness({ mode: "cadence", uiState: "connected", cadenceSampleSeen: true }),
    );
    assert.equal(r, "cadence-ready");
  });
});
