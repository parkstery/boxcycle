/**
 * Chief 계약(지시80·81): EntryLocationDialog 와 idle 후속 카드(다음 주행·첫 주행 표면)는 동시에 뜨지 않는다.
 * 후속 카드 공통 게이트는 `entryLocation.phase === "ready"` 만 허용 — idle/checking/choice/locating 전부 차단.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const APP = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const APP_CODE = codeOnly(APP);

function sliceConst(name: string): string {
  const re = new RegExp(`const ${name} =`);
  const at = APP_CODE.search(re);
  assert.ok(at >= 0, `App.tsx 에 const ${name} 가 없다`);
  const tail = APP_CODE.slice(at);
  const end = tail.search(/\n {2}const [a-zA-Z]/);
  return end >= 0 ? tail.slice(0, end) : tail.slice(0, 800);
}

describe("지시80·81 · entryLocation ready 와 idle 후속 카드", () => {
  it("entryLocationPrompt 는 checking·choice·locating 만 막는다(다른 게이트용)", () => {
    const block = sliceConst("entryLocationPrompt");
    assert.match(block, /entryLocation\.phase === "checking"/);
    assert.match(block, /entryLocation\.phase === "choice"/);
    assert.match(block, /entryLocation\.phase === "locating"/);
  });

  it("단일 idleFollowUpCardsEligible 게이트는 ready 를 직접 요구하고 !entryLocationPrompt 에 의존하지 않는다", () => {
    const gate = sliceConst("idleFollowUpCardsEligible");
    assert.match(gate, /entryLocation\.phase === "ready"/);
    assert.doesNotMatch(
      gate,
      /!entryLocationPrompt/,
      "idle phase 한 프레임 노출을 막으려면 prompt 부정이 아니라 ready 를 직접 요구해야 한다",
    );
    assert.match(gate, /stage === "idle"/);
    assert.match(gate, /!needsGuestEntry/);
  });

  it("resume 후보가 있어도 ready 가 아니면 nextRideCardVisible 이 false 구조다", () => {
    const next = sliceConst("nextRideCardVisible");
    assert.match(next, /idleFollowUpCardsEligible/);
    assert.match(next, /nextRideView/);
    assert.doesNotMatch(
      next,
      /nextRideCardVisible = Boolean\([\s\S]*user &&[\s\S]*nextRideView/,
      "nextRideCardVisible 이 공통 게이트 없이 user·nextRideView 만으로 정의되면 위치 prompt 와 겹친다",
    );
  });

  it("후보 없는 최초 idle 은 firstRideIntroVisible 만 게이트를 쓰고 nextRideView 가 없을 때만", () => {
    const first = sliceConst("firstRideIntroVisible");
    assert.match(first, /idleFollowUpCardsEligible/);
    assert.match(first, /!nextRideView/);
    const next = sliceConst("nextRideCardVisible");
    assert.match(next, /nextRideView/);
  });

  it("prompt 와 후속 카드 동시 노출 불가 — 후속 게이트는 ready 만 허용해 non-ready phase 를 전부 막는다", () => {
    const gate = sliceConst("idleFollowUpCardsEligible");
    assert.match(gate, /entryLocation\.phase === "ready"/);
    const prompt = sliceConst("entryLocationPrompt");
    assert.match(prompt, /entryLocation\.phase === "checking"/);
    assert.match(prompt, /entryLocation\.phase === "choice"/);
    assert.match(prompt, /entryLocation\.phase === "locating"/);
    assert.doesNotMatch(
      gate,
      /entryLocation\.phase === "idle"/,
      "게이트가 idle 을 허용하는 조건이면 Chief 계약을 깬다",
    );
  });
});
