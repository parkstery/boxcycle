// 동행 HUD 빈 문장 계약 — 「지금 N명 주행」과 「다른 라이더 없음」이 동시에 뜨면 안 된다.
// Firebase·브라우저 없이 순수 함수만 검증한다. 최소 재현: aggregate N≥2 인데
// Trail 접속자 dedup 으로 coursePeerNames 가 빈 배열.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasOtherLiveRidePeer,
  shouldShowCompanionEmptyCopy,
} from "../../src/lib/peerHud.ts";

describe("hasOtherLiveRidePeer", () => {
  it("나 말고 live ride 행이 있으면 true", () => {
    assert.equal(
      hasOtherLiveRidePeer([{ uid: "self" }, { uid: "peer" }], "self"),
      true,
    );
  });

  it("나만 있으면 false", () => {
    assert.equal(hasOtherLiveRidePeer([{ uid: "self" }], "self"), false);
  });
});

describe("shouldShowCompanionEmptyCopy — 세 상태", () => {
  it("동행 없음 → 「다른 라이더 없음」", () => {
    assert.equal(shouldShowCompanionEmptyCopy(0, false), true);
  });

  it("동행 있고 전원이 접속 블록에 이미 표시 → 빈 문장 없음", () => {
    // 같은 Trail 2인 주행: 이름은 Trail dedup 으로 [], live 행에는 상대가 있다
    const hasOther = hasOtherLiveRidePeer(
      [{ uid: "self" }, { uid: "peer" }],
      "self",
    );
    assert.equal(hasOther, true);
    assert.equal(shouldShowCompanionEmptyCopy(0, hasOther), false);
  });

  it("접속 블록에 없는 이름 있음 → 빈 문장 없음(목록 쪽)", () => {
    assert.equal(shouldShowCompanionEmptyCopy(1, true), false);
    assert.equal(shouldShowCompanionEmptyCopy(1, false), false);
  });
});

describe("버그 최소 재현 · aggregate N≥2 + 빈 이름 목록", () => {
  it("지금 2명 주행인데 coursePeerNames=[] 이면 빈 문장을 쓰지 않는다", () => {
    const aggregateRiderCount = 2;
    const coursePeerNames: string[] = [];
    const hasOther = hasOtherLiveRidePeer(
      [{ uid: "guest-vLPhVx" }, { uid: "guest-HmXaWe" }],
      "guest-vLPhVx",
    );
    assert.ok(aggregateRiderCount >= 2);
    assert.equal(coursePeerNames.length, 0);
    assert.equal(hasOther, true);
    assert.equal(
      shouldShowCompanionEmptyCopy(coursePeerNames.length, hasOther),
      false,
    );
  });
});
