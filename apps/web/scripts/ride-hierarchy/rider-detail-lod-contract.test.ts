import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  RIDER_POSE_ANIMATION_MIN_ZOOM,
  shouldAnimateRiderPose,
} from "../../src/lib/rider/riderDetailLod.ts";

/**
 * 라이더 상세도 LOD 계약 (2026-09-27).
 *
 * 무엇을 막는가 — 이 판정이 사라지면 **점으로만 보이는 줌에서도** 다리 IK 를 매 프레임
 * 다시 푼다. 화면은 똑같아 보이므로 아무도 알아채지 못한다(실측: 렌더 비용의 40~46%).
 * 반대로 기준을 너무 올리면 **60m 에서 페달이 멈춘 것처럼** 보인다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

/** 산문이 아니라 코드를 본다. */
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
    .join("\n");

/** 카메라 4단계의 **실측** 줌 (20260924 지시01 수행결과). */
const MEASURED_ZOOM = { aerial5: 23.7, aerial60: 20.1, aerial200: 18.4 };

describe("라이더 자세 LOD — 점에서는 풀지 않는다", () => {
  it("가까운 두 단계(5m·60m)에서는 자세를 계산한다", () => {
    assert.equal(shouldAnimateRiderPose(MEASURED_ZOOM.aerial5), true, "5m 는 형태가 다 보인다");
    assert.equal(
      shouldAnimateRiderPose(MEASURED_ZOOM.aerial60),
      true,
      "60m 에서 멈추면 페달이 멎은 것처럼 보인다",
    );
  });

  it("점으로 보이는 단계(200m·전체)에서는 건너뛴다", () => {
    assert.equal(shouldAnimateRiderPose(MEASURED_ZOOM.aerial200), false, "200m 는 점이다");
    assert.equal(shouldAnimateRiderPose(12), false, "전체 경로 보기는 더 멀다");
  });

  it("기준이 실측 줌 **사이**에 있다 — 한쪽으로 넘어가면 의미가 바뀐다", () => {
    assert.ok(
      RIDER_POSE_ANIMATION_MIN_ZOOM > MEASURED_ZOOM.aerial200,
      "기준이 200m 아래로 내려가면 아끼는 것이 없어진다",
    );
    assert.ok(
      RIDER_POSE_ANIMATION_MIN_ZOOM <= MEASURED_ZOOM.aerial60,
      "기준이 60m 위로 올라가면 60m 에서 페달이 멈춘다",
    );
  });

  it("줌을 모르면 계산한다 — 모를 때 건너뛰면 라이더가 조용히 멈춘다", () => {
    assert.equal(shouldAnimateRiderPose(null), true);
    assert.equal(shouldAnimateRiderPose(undefined), true);
    assert.equal(shouldAnimateRiderPose(Number.NaN), true);
  });
});

describe("제품이 그 판정을 실제로 쓴다", () => {
  const layer = codeOnly(read("src/lib/map/riderPreservedLayer.ts"));

  it("렌더가 LOD 판정을 불러 자세 계산을 가린다", () => {
    assert.match(layer, /shouldAnimateRiderPose\(/, "판정을 호출해야 한다");
    assert.match(
      layer,
      /if \(animatePose\)[^\n]*setPhase/,
      "자세 계산이 판정 뒤에 있어야 한다 — 아니면 LOD 가 아무 일도 하지 않는다",
    );
  });
});

describe("동행 — 안 그릴 땐 표시용 계산을 하지 않는다", () => {
  const mapView = codeOnly(read("src/components/map/MapView.tsx"));
  const drive = codeOnly(read("src/lib/peerMotion/peerRidersDrive.ts"));

  it("게이트가 계산 **앞**에 있다", () => {
    /*
     * 종전에는 `showPeerSprites ? peerFc : EMPTY` 로 **결과만 버렸다.**
     * 계산은 그대로 돌았다 — 게이트가 뒤에 있으면 아끼는 것이 없다.
     */
    assert.match(
      mapView,
      /buildFeatures: showPeerSprites/,
      "표시 여부를 계산 함수에 넘겨야 한다",
    );
    assert.doesNotMatch(
      mapView,
      /showPeerSprites \? peerFc : EMPTY_GEOJSON_FC/,
      "결과만 버리는 옛 방식으로 돌아가면 안 된다",
    );
  });

  it("위치 적분은 건너뛰지 않는다 — 멈추면 다시 켤 때 제자리로 뛴다", () => {
    const at = drive.indexOf("buildFeatures === false");
    assert.ok(at > 0, "표시용 계산을 건너뛰는 분기가 있어야 한다");
    const before = drive.slice(0, at);
    assert.match(before, /registry\.step\(/, "위치 적분이 그 분기보다 **먼저** 와야 한다");
  });
});
