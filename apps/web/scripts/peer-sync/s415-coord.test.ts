/**
 * S4-15 D0·D1 — 동일 rAF · 렌더가 쓴 lngLat (재계산 아님).
 *
 *   cd apps/web && npm run test:s415-coord
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  beginPeerChainCapture,
  endPeerChainCapture,
  noteMapboxRender,
  notePeerChainFromMapTick,
  resetPeerChainCaptureForTests,
} from "../../src/lib/peerMotion/peerChainCapture.ts";
import { registerPeerSyncDistanceSamplers } from "../../src/lib/peerMotion/peerSyncDistanceSamplers.ts";
import { resetPeerMotionRegistry } from "../../src/lib/peerMotion/PeerMotionRegistry.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");

describe("S4-15 좌표 변환 계측", () => {
  it("D1: 계측 모듈은 경로 거리→좌표 함수를 다시 호출하지 않는다", () => {
    const src = readFileSync(resolve(WEB, "src/lib/peerMotion/peerChainCapture.ts"), "utf8");
    assert.equal(/\bgetPointOnRouteByDistance\s*\(/.test(src), false);
    assert.equal(src.includes('from "../geo"') || src.includes('from "./geo"'), false);
    assert.match(src, /lngLatSource: "render-setLngLat"/);
  });

  it("D1: MapView 는 그 프레임 fc.features 와 sampled 를 넘긴다", () => {
    const src = readFileSync(resolve(WEB, "src/components/map/MapView.tsx"), "utf8");
    assert.match(src, /selfLngLat:\s*sampled/);
    assert.match(src, /peerFeatures:\s*fc\.features/);
    const markers = src.lastIndexOf("syncPeerDomMarkers(map, fc.features");
    const chain = src.lastIndexOf("notePeerChainFromMapTick");
    assert.ok(markers > 0 && chain > markers);
  });

  it("D0: ①~⑦ 이 같은 perfNowMs 로 묶이고 project 는 넘긴 lngLat 을 쓴다", () => {
    resetPeerChainCaptureForTests();
    resetPeerMotionRegistry();
    registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM: () => 12.5,
      sampleAppliedSpeedKmh: () => 5,
    });
    const self = { style: { transform: "translate(100px, 200px)" } } as unknown as HTMLElement;
    const peerEl = { style: { transform: "translate(140px, 200px)" } } as unknown as HTMLElement;
    const projected: Array<{ lng: number; lat: number }> = [];
    const map = {
      getCenter: () => ({ lng: 127.1, lat: 37.5 }),
      getBearing: () => 90,
      getPitch: () => 80,
      getZoom: () => 21,
      project: (ll: { lng: number; lat: number }) => {
        projected.push(ll);
        return { x: ll.lng * 10, y: ll.lat * 10 };
      },
    };
    beginPeerChainCapture("d0");
    noteMapboxRender(1200);
    notePeerChainFromMapTick({
      perfNowMs: 1234.5,
      map,
      selfEl: self,
      peerEls: new Map([["u1", peerEl]]),
      selfLngLat: [127.2, 37.6],
      peerFeatures: [
        {
          geometry: { coordinates: [127.3, 37.7] },
          properties: { id: "u1" },
        },
      ],
    });
    const dump = endPeerChainCapture();
    assert.equal(dump.clockCanonical, "performance.now");
    assert.equal(dump.sameRaf, true);
    assert.equal(dump.lngLatSource, "render-setLngLat");
    assert.equal(dump.tickKind, "requestAnimationFrame");
    assert.equal(dump.frames.length, 1);
    const f = dump.frames[0]!;
    assert.equal(f.perfNowMs, 1234.5);
    assert.equal(f.localDistM, 12.5);
    assert.equal(f.localSpeedKmh, 5);
    assert.equal(f.selfLng, 127.2);
    assert.equal(f.selfLat, 37.6);
    assert.equal(f.selfProjX, 1272);
    assert.equal(f.selfProjY, 376);
    assert.equal(f.mapRenderPerfMs, 1200);
    assert.equal(f.rafMinusRenderMs, 34.5);
    assert.equal(f.peers.length, 0);
    assert.equal(projected.length, 1);
    assert.deepEqual(projected[0], { lng: 127.2, lat: 37.6 });
    resetPeerChainCaptureForTests();
    registerPeerSyncDistanceSamplers({
      sampleVirtualDistanceM: null,
      sampleAppliedSpeedKmh: null,
    });
  });

  it("D6: MapView 가 map.on(render) 시각을 남긴다", () => {
    const src = readFileSync(resolve(WEB, "src/components/map/MapView.tsx"), "utf8");
    assert.match(src, /noteMapboxRender\(performance\.now\(\)\)/);
    assert.match(src, /map\.on\("render", onRender\)/);
  });
});
