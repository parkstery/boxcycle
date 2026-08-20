/**
 * S4-13 B0 — 제품에 「속도가 0 까지 램프 감속」하는 live 경로가 있는지.
 * 슬라이더 최솟값 5 · 일시정지는 phase 전이 · 완료도 phase 전이.
 *
 *   cd apps/web && npm run test:s413-reach
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SESSION_SPEED_MIN_KMH,
  clampSessionSpeedKmh,
} from "../../src/lib/sessionSpeedKmh.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");
const SRC = resolve(WEB, "src");

describe("S4-13 B0 램프 0 감속 도달 가능성", () => {
  it("슬라이더 목표는 5 km/h 미만을 허용하지 않는다", () => {
    assert.equal(SESSION_SPEED_MIN_KMH, 5);
    assert.equal(clampSessionSpeedKmh(0), 5);
    assert.equal(clampSessionSpeedKmh(4), 5);
    assert.equal(clampSessionSpeedKmh(5), 5);
  });

  it("SessionSpeedControl 입력 min 이 SESSION_SPEED_MIN_KMH 다", () => {
    const src = readFileSync(resolve(SRC, "components/route-dock/SessionSpeedControl.tsx"), "utf8");
    assert.match(src, /min=\{SESSION_SPEED_MIN_KMH\}/);
  });

  it("running 중 램프 목표는 speedRef(슬라이더) 뿐이라 0 으로 수렴하지 않는다", () => {
    const src = readFileSync(resolve(SRC, "hooks/useVirtualRideSession.ts"), "utf8");
    assert.match(src, /stepRideSpeedKmh\(appliedSpeedRef\.current, speedRef\.current, deltaMs\)/);
    assert.match(src, /speedRef\.current = options\.speedKmh/);
  });

  it("일시정지는 램프 없이 appliedSpeed 를 0 으로 끊고 rAF 를 멈춘다", () => {
    const src = readFileSync(resolve(SRC, "hooks/useVirtualRideSession.ts"), "utf8");
    assert.match(src, /if \(status !== "running"\)/);
    assert.match(src, /appliedSpeedRef\.current = 0/);
  });

  it("paused 스냅샷은 speedMps=0 · ridePhase=paused 다", () => {
    const snap = readFileSync(resolve(SRC, "lib/liveLocationSnapshot.ts"), "utf8");
    assert.match(snap, /input\.routeRidePhase === "paused"\s*\n\s*\? 0/);
    const app = readFileSync(resolve(SRC, "App.tsx"), "utf8");
    assert.match(app, /routeRidePhase: rideStatus === "paused" \? "paused" : "live"/);
  });

  it("integrator 는 paused·completed 를 예측 없이 newest.distM 홀드한다", () => {
    const src = readFileSync(resolve(SRC, "lib/peerMotion/integrator.ts"), "utf8");
    assert.match(src, /if \(entity\.phase === "paused" \|\| entity\.phase === "completed"\)/);
    assert.match(src, /mode: "paused"/);
  });

  it("S4-12 에서 속도 변화만 있는 P2·P4 의 역행은 0 이다", () => {
    const j = JSON.parse(readFileSync(resolve(RELAY, "S412-combos.json"), "utf8"));
    const row = j.combos.find(
      (c) => c.eM === 0.3 && c.tauAbs === 0.25 && c.tauLeadRatio === 0 && c.delayMs === 0,
    );
    assert.ok(row);
    const p2 = row.perProfile.find((p) => p.id === "P2-accel-0-20");
    const p4 = row.perProfile.find((p) => p.id === "P4-5-12-x3");
    assert.equal(p2.maxRetrogradeM, 0);
    assert.equal(p4.maxRetrogradeM, 0);
    const rowB = j.combos.find(
      (c) => c.eM === 0.3 && c.tauAbs === 0.3 && c.tauLeadRatio === 0 && c.delayMs === 0,
    );
    const p2b = rowB.perProfile.find((p) => p.id === "P2-accel-0-20");
    const p4b = rowB.perProfile.find((p) => p.id === "P4-5-12-x3");
    assert.equal(p2b.maxRetrogradeM, 0);
    assert.equal(p4b.maxRetrogradeM, 0);
  });
});
