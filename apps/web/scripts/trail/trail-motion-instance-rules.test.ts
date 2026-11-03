import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { TRAIL_MOTION_INSTANCES } from "../../src/lib/trail/trailMotionInstance.ts";

/**
 * Trail 동행 서버 이름표 ↔ Firestore 보안 규칙 계약 (00-plan §5.1 P1).
 *
 * 무엇을 막는가 — 앱 목록에 이름을 더하고 Rules 를 잊으면 Trail 생성이 **조용히 거부**된다
 * (주행 시작은 되는 것처럼 보이고 Trail 만 안 생긴다). 반대로 Rules 를 넓히기만 하면
 * 클라이언트가 임의 값을 적을 수 있다. 그래서 규칙 파일에서 허용 목록을 **읽어와** 대조한다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES = fs.readFileSync(path.resolve(__dirname, "../../../../firestore.rules"), "utf8");

function trailBlock(): string {
  const start = RULES.indexOf("match /trails/{trailId} {");
  assert.ok(start >= 0, "trails 규칙 블록을 찾지 못했다 — 규칙 경로가 바뀌었으면 이 시험도 따라 고쳐라");
  const end = RULES.indexOf("allow delete", start);
  return RULES.slice(start, end);
}

describe("Trail motionInstance 이름표 계약", () => {
  it("Rules 허용 목록 == 앱 목록", () => {
    const m = /data\.motionInstance in \[([^\]]*)\]/.exec(RULES);
    assert.ok(m, "trailMotionInstanceValid 의 허용 목록을 찾지 못했다");
    const ruleList = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
    assert.deepEqual(ruleList, [...TRAIL_MOTION_INSTANCES].sort());
  });

  it("허용 목록은 주소가 아니라 이름이다", () => {
    for (const name of TRAIL_MOTION_INSTANCES) assert.match(name, /^[a-z0-9-]+$/);
  });

  it("생성 규칙이 이름표를 검사하고, 수정 규칙이 변경을 막는다", () => {
    const block = trailBlock();
    const create = block.slice(block.indexOf("allow create"), block.indexOf("allow update"));
    const update = block.slice(block.indexOf("allow update"));
    assert.match(create, /trailMotionInstanceValid\(request\.resource\.data\)/);
    assert.match(
      update,
      /request\.resource\.data\.get\('motionInstance', null\) == resource\.data\.get\('motionInstance', null\)/,
    );
  });
});
