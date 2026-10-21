import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sensorChipSlot } from "../../src/lib/route/sensorChipSlot.ts";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";

const source = (file: string) => readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");
const dock = source("components/route-dock/RouteDock.tsx");
const bar = source("components/ride/RideControlBar.tsx");
const app = source("App.tsx");
describe("센서 단일 위치 — 독립 주행바", () => {
  for (const stage of ["idle", "setup", "ready-to-start", "riding", "paused"] as RideUiStage[]) {
    it(stage + ": 주소 패널 접힘과 관계없이 동일한 센서", () => {
      for (const expanded of [false, true]) assert.equal(sensorChipSlot({stage, expanded, hasCadence:true}), "ride-control-bar");
      assert.equal(sensorChipSlot({stage, expanded:true, hasCadence:false}), "none");
    });
  }
  for (const stage of ["gate", "gate-nickname", "summary"] as RideUiStage[]) {
    it(stage + ": 센서 및 주행 조작 숨김", () => {
      for (const expanded of [false, true]) assert.equal(sensorChipSlot({stage, expanded, hasCadence:true}), "none");
    });
  }
  it("주소 패널은 센서·주행 버튼을 소유하지 않는다", () => {
    assert.doesNotMatch(dock, /CadenceHudChip|onStartRide|onPauseRide|onEndRide|sensorChipSlot/);
    assert.match(dock, /stops\.length === 0/);
    assert.match(dock, /aria-label="경로 보기"/);
  });
  it("주행바가 실제 판정과 센서를 사용하고 App이 기존 준비 조건에 연결한다", () => {
    assert.match(bar, /sensorChipSlot\(\{/);
    assert.match(bar, /<CadenceHudChip/);
    assert.match(bar, /aria-label="주행 제어"/);
    assert.match(app, /<RideControlBar/);
    assert.match(app, /canStartRide=\{canStartRideWithInput\}/);
    assert.match(app, /cadence=\{cadenceHud\}/);
    assert.doesNotMatch(source("components/maphud/MapHud.tsx"), /<CadenceHudChip/);
  });
  it("시작·일시정지·종료·재개 연결과 준비·주행별 노출이 보존된다", () => {
    for (const method of ["onStartRide", "onPauseRide", "onResumeRide", "onEndRide"]) assert.ok(bar.includes("props." + method));
    assert.match(bar, /ready \|\| paused \?/);
    assert.match(bar, /riding \?/);
    assert.match(bar, /active \?/);
    assert.match(bar, /disabled=\{ready && startDisabled\}/);
    assert.match(bar, /stage === "summary"/);
  });
  it("이어달리기·처음부터·포기를 새 보조 표면에서 보존한다", () => {
    assert.match(bar, /resumeRatio != null && resumeOpen/);
    assert.match(bar, /props\.onStartRide\(restartFromZero\)/);
    assert.match(bar, /props\.onAbandonResume\?\.\(\)/);
    assert.match(bar, /처음부터/);
  });
  it("주소·입문·미니맵 스택은 남고 주행바는 스택 밖이다", () => {
    const start=app.indexOf("<MapBottomLeftStack>"), end=app.indexOf("</MapBottomLeftStack>", start);
    assert.ok(start >= 0 && end > start);
    const stack=app.slice(start,end);
    assert.match(stack, /\{routeDockPanel\}/);
    assert.doesNotMatch(stack, /rideControlPanel|nextRideCard/);
    assert.match(app, /\{rideControlPanel\}/);
    assert.match(app, /\{nextRideCard\}/);
  });
});
