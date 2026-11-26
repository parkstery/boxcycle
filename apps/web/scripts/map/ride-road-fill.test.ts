import assert from "node:assert/strict";
import { test } from "node:test";
import { pairFillPolygons, type XY } from "../../src/lib/map/rideRoadFill.ts";

const area = (rings: XY[][]) => rings.reduce((sum, r) => {
  let a = 0;
  for (let i = 1; i < r.length; i++) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1];
  return sum + Math.abs(a) / 2;
}, 0);

test("마주 보는 일방통행 두 줄 사이를 빈틈없이 메운다 — 서원대로 간격 9~22m", () => {
  for (const gap of [9, 13.3, 22]) {
    const rings = pairFillPolygons([{ pts: [[0, -200], [0, 200]] }, { pts: [[gap, 200], [gap, -200]] }]);
    // 두 줄이 서로를 메우므로 겹친다. 400m × 간격의 면적을 대부분 덮는다.
    assert.ok(area(rings) >= 400 * gap * 0.9, `${gap}m ${area(rings)}`);
    for (const r of rings) for (const [x] of r) assert.ok(x >= -1e-6 && x <= gap + 1e-6, "두 줄 바깥으로 나가지 않는다");
  }
});

test("같은 방향·혼자인 일방통행·30m 넘게 떨어진 줄·교차하는 길은 메우지 않는다", () => {
  assert.equal(pairFillPolygons([{ pts: [[0, -200], [0, 200]] }, { pts: [[12, -200], [12, 200]] }]).length, 0, "같은 방향");
  assert.equal(pairFillPolygons([{ pts: [[0, -200], [0, 200]] }]).length, 0, "혼자");
  assert.equal(pairFillPolygons([{ pts: [[0, -200], [0, 200]] }, { pts: [[35, 200], [35, -200]] }]).length, 0, "35m");
  assert.equal(pairFillPolygons([{ pts: [[0, -200], [0, 200]] }, { pts: [[200, 5], [-200, 5]] }]).length, 0, "교차");
});

test("짝이 끝나는 곳에서 멈추고 건너뛰지 않는다", () => {
  const rings = pairFillPolygons([{ pts: [[0, -200], [0, 200]] }, { pts: [[13, 50], [13, -50]] }]);
  for (const r of rings) for (const [, y] of r) assert.ok(y >= -56 && y <= 56, `y ${y}`);
  assert.ok(rings.length > 0);
});
