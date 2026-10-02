import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  resolveActiveLiveRideTrailIdsListenerEnabled,
  resolveOpenTrailsListenerEnabled,
  resolveWorldLivePublicationRideOverlayEnabled,
} from "../../src/features/map-overlays/listenerScopePolicy.ts";

/**
 * 주행 중 nonessential Firestore listener 게이트 — 순수 함수 런타임 계약.
 *
 * 무엇을 막는가 — listing / project-wide CG / multi-Trail world overlay 가 주행 중에도
 * 켜져 있으면 현재 Trail peer 허브와 무관한 구독이 계속 열려 read fanout 이 커진다.
 * React/Firebase 없이 상태 전이별 true/false 를 직접 실행한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/** App 과 동일: running | paused → ride session active */
function isRideSessionActive(rideStatus: "idle" | "running" | "paused" | "ended"): boolean {
  return rideStatus === "running" || rideStatus === "paused";
}

const READY = {
  configured: true,
  hasUser: true,
  pageVisible: true,
  trailheadSessionActive: true,
  debugIsolationOn: false,
  publicationPresenceWorldMapEnabled: false,
} as const;

describe("resolveOpenTrailsListenerEnabled", () => {
  it("idle Trailhead → true", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("idle"),
        menuOpen: false,
      }),
      true,
    );
  });

  it("active ride + menu closed → false", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("running"),
        menuOpen: false,
      }),
      false,
    );
  });

  it("active ride + menu open → true", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("running"),
        menuOpen: true,
      }),
      true,
    );
  });

  it("paused + menu closed → false", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("paused"),
        menuOpen: false,
      }),
      false,
    );
  });

  it("ride ended → true (재취득)", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("ended"),
        menuOpen: false,
      }),
      true,
    );
  });

  it("not configured / not authenticated / no trailhead → false", () => {
    const base = {
      ...READY,
      isRideSessionActive: false,
      menuOpen: false,
    };
    assert.equal(resolveOpenTrailsListenerEnabled({ ...base, configured: false }), false);
    assert.equal(resolveOpenTrailsListenerEnabled({ ...base, hasUser: false }), false);
    assert.equal(
      resolveOpenTrailsListenerEnabled({ ...base, trailheadSessionActive: false }),
      false,
    );
  });
});

describe("resolveActiveLiveRideTrailIdsListenerEnabled", () => {
  it("idle Trailhead → true", () => {
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("idle"),
      }),
      true,
    );
  });

  it("active ride (menu irrelevant) → false", () => {
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("running"),
      }),
      false,
    );
  });

  it("paused → false", () => {
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("paused"),
      }),
      false,
    );
  });

  it("ride ended → true", () => {
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("ended"),
      }),
      true,
    );
  });

  it("page hidden / not configured / not authenticated → false", () => {
    const base = { ...READY, isRideSessionActive: false };
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({ ...base, pageVisible: false }),
      false,
    );
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({ ...base, configured: false }),
      false,
    );
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({ ...base, hasUser: false }),
      false,
    );
  });
});

describe("resolveWorldLivePublicationRideOverlayEnabled", () => {
  it("idle Trailhead → true", () => {
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("idle"),
      }),
      true,
    );
  });

  it("active ride → false", () => {
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("running"),
      }),
      false,
    );
  });

  it("paused → false", () => {
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("paused"),
      }),
      false,
    );
  });

  it("ride ended → true", () => {
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        ...READY,
        isRideSessionActive: isRideSessionActive("ended"),
      }),
      true,
    );
  });

  it("page hidden / not configured / not authenticated / debugIsolation / presence map → false", () => {
    const base = { ...READY, isRideSessionActive: false };
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({ ...base, pageVisible: false }),
      false,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({ ...base, configured: false }),
      false,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({ ...base, hasUser: false }),
      false,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({ ...base, debugIsolationOn: true }),
      false,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        ...base,
        publicationPresenceWorldMapEnabled: true,
      }),
      false,
    );
  });
});

describe("배선 (최소)", () => {
  it("App·overlay 가 listenerScopePolicy 게이트를 호출한다", () => {
    const app = codeOnly(read("src/App.tsx"));
    const overlays = codeOnly(read("src/features/map-overlays/useAppMapOverlays.ts"));
    assert.match(app, /from\s+["'].*listenerScopePolicy["']/);
    assert.match(app, /resolveOpenTrailsListenerEnabled\(/);
    assert.match(overlays, /from\s+["'].*listenerScopePolicy["']/);
    assert.match(overlays, /resolveActiveLiveRideTrailIdsListenerEnabled\(/);
    assert.match(overlays, /resolveWorldLivePublicationRideOverlayEligible\(/);
    assert.match(overlays, /useVisibilityListenGrace\(/);
  });
});
