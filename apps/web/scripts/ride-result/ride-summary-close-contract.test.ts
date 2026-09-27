import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * 주행 결과 시트를 **닫는 길**의 계약 (2026-09-27).
 *
 * 무엇을 막는가 — 종전에는 「저장 안 함」이 저장 행만 없애고 **시트를 닫지 않았다.**
 * 누른 사람은 「아무 일도 안 일어났다」고 느낀다. 에러도 로그도 없다.
 * 자동 시험도 여기서 닫히기를 기다리다 죽었고, 그게 동행 e2e 가 한 달 넘게 red 였던
 * 원인 중 하나였다.
 *
 * 지금 규칙 — **닫는 버튼은 상태마다 정확히 하나다.**
 *   · 저장할 것이 있으면 → 「저장 안 함」이 닫는다
 *   · 저장할 것이 없으면 → 「닫기」가 닫는다
 *   · 배경(scrim)은 언제나 닫는다
 *
 * 둘을 같이 두면 「저장 안 함」과 「닫기」가 무엇이 다른지 읽는 사람이 알 수 없다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.resolve(__dirname, "../../src/components/ride/RideSummarySheet.tsx"),
  "utf8",
);

/** 산문이 아니라 **코드**를 본다 — 주석에 걸려 통과하면 설명을 지워야 통과하는 게이트가 된다. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

describe("주행 결과 시트 — 「저장 안 함」은 닫기까지 한다", () => {
  it("「저장 안 함」이 닫기를 부른다", () => {
    const at = code.indexOf("저장 안 함");
    assert.ok(at > 0, "「저장 안 함」 버튼이 있어야 한다");
    // 그 버튼의 onClick 안에서 dismiss 와 close 를 **둘 다** 한다.
    const block = code.slice(Math.max(0, at - 600), at);
    assert.match(
      block,
      /onDismissAdhoc\(\)/,
      "ad-hoc 저장 행을 치우는 호출이 있어야 한다",
    );
    assert.match(
      block,
      /requestClose\(\)/,
      "닫지 않으면 누른 사람이 「아무 일도 안 일어났다」고 느낀다",
    );
  });

  it("저장할 것이 있으면 「닫기」 버튼을 따로 두지 않는다", () => {
    /*
     * 중복을 막는 것이 목적이다. 둘이 같이 보이면 차이를 설명할 수 없다.
     */
    assert.match(
      code,
      /adhocSaveAvailable \? null : \(/,
      "저장 행이 있을 때는 헤더 「닫기」를 렌더하지 않아야 한다",
    );
  });

  it("저장할 것이 없을 때는 닫을 길이 남아 있다", () => {
    // 저장 행이 없으면 「저장 안 함」도 없다 — 그때 닫을 것이 없으면 갇힌다.
    assert.match(code, /className="ride-summary__close"/, "「닫기」 버튼 자체는 남아야 한다");
  });

  it("배경(scrim)은 언제나 닫는다 — 마지막 탈출구", () => {
    /*
     * e2e 헬퍼들이 「닫기가 안 보이면 배경을 누른다」로 되어 있다. 이 탈출구가 사라지면
     * 그 스펙들이 한꺼번에 죽는다.
     */
    const at = code.indexOf("ride-summary__scrim");
    assert.ok(at > 0, "scrim 이 있어야 한다");
    const block = code.slice(at, at + 300);
    assert.match(block, /onClick=\{requestClose\}/, "배경을 누르면 닫혀야 한다");
  });
});
