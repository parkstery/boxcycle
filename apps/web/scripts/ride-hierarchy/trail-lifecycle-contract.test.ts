import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Trail 수명주기 계약 — **주행을 끝내는 것과 Trail 을 닫는 것은 다른 일이다.**
 *
 * 무엇을 막는가 (2026-09-27) — 종전에는 주행 종료 시 **개설자일 때만** Trail 을
 * `status: "closed"` 로 바꿨다. 되돌리는 코드가 없어서 개설자는 자기 Trail 에 영원히
 * 못 돌아갔다. 증상이 잘 안 보인다 — 참여자로 시험하면 멀쩡하기 때문이다.
 *
 * 그 「닫기」는 일관성도 없었다. Trail 이 닫히는 경우가 앱 전체에서 그 한 곳뿐이라,
 * 참여자만 남아 있다가 전부 나간 Trail 은 열린 채 남았다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

/** 산문·주석에 걸려 통과하지 않도록 코드만 본다. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");
}

describe("Trail 수명주기 — 주행 종료가 Trail 을 닫지 않는다", () => {
  const app = codeOnly(read("src/App.tsx"));

  it("주행 종료 경로가 Trail 을 닫지 않는다", () => {
    assert.doesNotMatch(
      app,
      /closeTrailInstance\s*\(/,
      "주행 종료에 Trail 닫기를 다시 묶으면 개설자가 자기 Trail 에 못 돌아간다(2026-09-27 수정)",
    );
  });

  it("대신 목록을 다시 계산한다 — 아무도 없으면 목록에서 빠진다", () => {
    assert.match(
      app,
      /refreshOpenTrailListingFromTrail\s*\(/,
      "목록을 갱신하지 않으면 빈 Trail 이 목록에 남는다(유령 목록)",
    );
  });

  it("개설자와 참여자를 갈라 다루지 않는다", () => {
    /*
     * 비대칭이 결함의 실체였다. 「내가 개설자인가」로 종료 동작을 가르면 같은 함정이 돌아온다.
     * 목록에 남길지는 **지금 달리는 사람이 있는가**로만 정한다.
     */
    assert.doesNotMatch(
      app,
      /wasHostTrail/,
      "주행 종료를 개설자 여부로 가르지 않는다",
    );
    assert.doesNotMatch(
      app,
      /hostTrailIdRef/,
      "읽지 않는 상태값을 되살리지 않는다 — 쓰기만 하는 ref 는 다음 사람을 속인다",
    );
  });
});

describe("Trail 수명주기 — 닫힌 Trail 은 되돌릴 수 없다는 사실을 잊지 않는다", () => {
  const repo = codeOnly(read("src/lib/trail/repo/firestoreTrailInstance.ts"));

  it("Trail 을 다시 여는 코드는 없다 — 그래서 닫기는 신중해야 한다", () => {
    /*
     * 이 시험은 「다시 열기를 만들지 마라」가 아니다. 만들면 이 시험을 고치면 된다.
     * 지금 없다는 사실을 **눈에 보이게** 두는 것이 목적이다 — 없다는 걸 모르는 채
     * 닫기를 다시 붙이는 것이 이번 결함이었다.
     */
    assert.doesNotMatch(repo, /reopenTrailInstance/, "다시 열기가 생겼다면 이 계약을 갱신하라");
    assert.match(repo, /status: "closed"/, "닫기 자체는 남아 있다(명시적 종료용)");
  });
});
