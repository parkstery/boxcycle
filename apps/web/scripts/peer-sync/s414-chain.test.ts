/**
 * S4-14 C0·C2 — 동일 rAF 구조 · DOM transform 파서. 픽셀 군집이 아니다.
 *
 *   cd apps/web && npm run test:s414-chain
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  beginPeerChainCapture,
  endPeerChainCapture,
  notePeerChainFromMapTick,
  parseTransformTranslatePx,
  resetPeerChainCaptureForTests,
} from "../../src/lib/peerMotion/peerChainCapture.ts";
import { registerPeerSyncDistanceSamplers } from "../../src/lib/peerMotion/peerSyncDistanceSamplers.ts";
import { resetPeerMotionRegistry } from "../../src/lib/peerMotion/PeerMotionRegistry.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");

describe("S4-14 체인 계측", () => {
  it("C2: translate px 를 파싱하고 % 앵커는 버린다", () => {
    const a = parseTransformTranslatePx("translate(-50%, -100%) translate(640px, 360px)");
    assert.deepEqual(a, { x: 640, y: 360 });
    const b = parseTransformTranslatePx("translate3d(12px, 34px, 0px)");
    assert.deepEqual(b, { x: 12, y: 34 });
    const c = parseTransformTranslatePx("matrix(1, 0, 0, 1, 100, 200)");
    assert.deepEqual(c, { x: 100, y: 200 });
  });

  it("C2: 계측 모듈은 픽셀 군집·canvas 를 쓰지 않는다", () => {
    const src = readFileSync(resolve(WEB, "src/lib/peerMotion/peerChainCapture.ts"), "utf8");
    assert.equal(src.includes("getImageData"), false);
    assert.equal(src.includes("centroid"), false);
    assert.equal(src.includes("extract-marker-pixels"), false);
    assert.match(src, /parseTransformTranslatePx/);
  });

  it("C0: 한 번의 note 가 ①~⑦ 을 같은 perfNowMs 로 묶는다", () => {
    resetPeerChainCaptureForTests();
    resetPeerMotionRegistry();
    registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM: () => 12.5,
      sampleAppliedSpeedKmh: () => 5,
    });
    const self = { style: { transform: "translate(100px, 200px)" } } as unknown as HTMLElement;
    const map = {
      getCenter: () => ({ lng: 127.1, lat: 37.5 }),
      getBearing: () => 90,
      getPitch: () => 80,
      getZoom: () => 21,
    };
    beginPeerChainCapture("c0");
    notePeerChainFromMapTick({
      perfNowMs: 1234.5,
      map,
      selfEl: self,
      peerEls: new Map(),
    });
    const dump = endPeerChainCapture();
    assert.equal(dump.clockCanonical, "performance.now");
    assert.equal(dump.sameRaf, true);
    assert.equal(dump.pixelAnalysis, false);
    assert.equal(dump.lngLatSource, "render-setLngLat");
    assert.equal(dump.frames.length, 1);
    const f = dump.frames[0]!;
    assert.equal(f.perfNowMs, 1234.5);
    assert.equal(f.localDistM, 12.5);
    assert.equal(f.camLng, 127.1);
    assert.equal(f.camBearing, 90);
    assert.deepEqual(f.selfAnchor, { x: 100, y: 200 });
    assert.equal(f.frameSeq, 1);
    resetPeerChainCaptureForTests();
    resetPeerMotionRegistry();
    registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM: null,
      sampleAppliedSpeedKmh: null,
    });
  });

  it("C0: MapView 틱이 카메라·마커 다음에 체인을 읽는다", () => {
    const src = readFileSync(resolve(WEB, "src/components/map/MapView.tsx"), "utf8");
    const cam = src.lastIndexOf("tickRideCameraFollow(map");
    const markers = src.lastIndexOf("syncPeerDomMarkers(map, fc.features");
    const chain = src.lastIndexOf("notePeerChainFromMapTick");
    assert.ok(cam > 0 && markers > cam && chain > markers);
  });
});
