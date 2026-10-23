import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sensorChipSlot } from "../../src/lib/route/sensorChipSlot.ts";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";

const source = (file: string) => readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");
const dock = source("components/route-dock/RouteDock.tsx");
const bar = source("components/ride/RideControlBar.tsx");
const app = source("App.tsx");

describe("센서 단일 위치 — dock / 주행바 / HUD", () => {
  for (const stage of ["idle", "setup", "ready-to-start", "riding", "paused"] as RideUiStage[]) {
    it(stage + ": 접힘과 관계없이 센서 접근이 하나다", () => {
      const expected = stage === "setup" || stage === "ready-to-start" ? "route-dock" : "ride-control-bar";
      for (const expanded of [false,true]) {
        assert.equal(sensorChipSlot({stage,expanded,hasCadence:true}),expected);
        assert.equal(sensorChipSlot({stage,expanded,hasCadence:false}),"none");
      }
    });
  }
  for (const stage of ["gate", "gate-nickname", "summary"] as RideUiStage[]) {
    it(stage + ": 센서 및 주행 조작 숨김", () => {
      assert.equal(sensorChipSlot({ stage, expanded: true, hasCadence: true }), "none");
    });
  }
  it("RouteDock 이 센서 칩을 sensorChipSlot 로 판정한다", () => {
    assert.match(dock, /sensorChipSlot\(\{/);
    assert.match(dock, /<CadenceHudChip/);
    assert.doesNotMatch(dock, /onStartRide|onPauseRide|onEndRide/);
  });
  it("주행바가 idle 센서·주행 조작을 사용한다", () => {
    assert.match(bar, /sensorChipSlot\(\{/);
    assert.match(bar, /<CadenceHudChip/);
    assert.match(bar, /aria-label="주행 제어"/);
    assert.match(app, /<RideControlBar/);
    assert.match(app, /canStartRide=\{canStartRideWithInput\}/);
    assert.match(app, /cadence=\{cadenceHud\}/);
    assert.doesNotMatch(source("components/maphud/MapHud.tsx"), /<CadenceHudChip/);
  });
  it("시작·일시정지·종료·재개 연결과 준비·주행별 노출이 보존된다", () => {
    for (const method of ["onStartRide", "onPauseRide", "onResumeRide", "onEndRide"]) {
      assert.ok(bar.includes("props." + method));
    }
    assert.match(bar, /aria-label=\{paused \? "재개" : "주행 시작"\}/);
    assert.match(bar, /aria-label="일시정지"/);
    assert.match(bar, /aria-label="주행 종료"/);
    assert.match(bar, /riding \?/);
    assert.match(bar, /disabled=\{ready && startDisabled\}/);
    assert.match(bar, /stage === "summary"/);
  });
  it("이어달리기·처음부터·포기를 보존한다", () => {
    assert.match(bar, /resumeRatio != null && resumeOpen/);
    assert.match(bar, /props\.onStartRide\(restartFromZero\)/);
    assert.match(bar, /props\.onAbandonResume\?\.\(\)/);
    assert.match(bar, /처음부터/);
  });
  it("주소·미니맵 스택 밖에 주행 조작을 둔다", () => {
    const start=app.indexOf("<MapBottomLeftStack>"), end=app.indexOf("</MapBottomLeftStack>",start);
    assert.ok(start>=0 && end>start);
    const stack=app.slice(start,end);
    assert.match(stack,/\{routeDockPanel\}/);
    assert.doesNotMatch(stack,/rideControlPanel|nextRideCard/);
    assert.match(app,/\{rideControlPanel\}/);
    assert.match(app,/\{nextRideCard\}/);
  });
});
