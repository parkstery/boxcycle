/**
 * 3F-C-R1 §2 세션 6클릭 재현 테스트
 *
 * 사용자 실측 데이터(2026-09-02, driving, 목표 1.0 km, Start [127.0351, 37.5047])로
 * reach-offer 알고리즘 계약을 검증한다.
 * - 기존 실패 6건 중 5건이 found(offered/exact/detoured)로 전환
 * - clickSnapM > 250m 없음 → 유일한 실패 없음
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertSession6ClickExpectations,
  printSession6ReplayTable,
  replaySession6Click,
  SESSION_6_TARGET_METERS,
  type Session6ClickRow,
} from "./reach-offer-replay-core.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const session6Clicks = JSON.parse(
  readFileSync(join(__dirname, "fixtures/reach-offer-session-6.json"), "utf8"),
) as Session6ClickRow[];

describe("3F-C-R1 §2 세션 6클릭 재현 — reach-offer", () => {
  it("fixture 개수 6개, 목표 거리 1000m", () => {
    assert.equal(session6Clicks.length, 6);
    assert.equal(SESSION_6_TARGET_METERS, 1000);
  });

  it("mock outcome 분포: offered 2개(#1·#6), exact 1개(#2), failed 3개(#3·#4·#5)", () => {
    // 5A-R2 §1 로 계약이 바뀌었다 — `road < D` 는 우회로 채우지 않고 안내·실패한다.
    // #3·#4·#5 는 road 851·732·861m < D 1000m 라 전부 실패로 옮겨 갔다.
    const outcomes = session6Clicks.map((c) => c.expectedOutcome);
    assert.equal(outcomes.filter((o) => o === "offered").length, 2);
    assert.equal(outcomes.filter((o) => o === "exact").length, 1);
    assert.equal(outcomes.filter((o) => o === "detoured").length, 0, "우회가 살아 있다");
    assert.equal(outcomes.filter((o) => o === "failed").length, 3);
  });

  it("offered 클릭 중 road > D+150는 Stage 0 direct clip (provider 1회)", () => {
    const D = SESSION_6_TARGET_METERS;
    const directOffered = session6Clicks.filter(
      (c) => c.expectedOutcome === "offered" && c.directRoadMeters > D + 150,
    );
    assert.ok(directOffered.length >= 2, "road>D+150 offered 최소 2개");
    for (const click of directOffered) {
      assert.equal(click.maxAttemptedCalls, 1, `${click.id}: road>D+150 → provider 1회`);
    }
  });

  it("detoured 클릭은 directRoadMeters < D 확인", () => {
    const D = SESSION_6_TARGET_METERS;
    for (const click of session6Clicks.filter((c) => c.expectedOutcome === "detoured")) {
      assert.ok(
        click.directRoadMeters < D,
        `${click.id}: directRoadMeters ${click.directRoadMeters} should be < ${D}`,
      );
    }
  });

  it("exact 클릭(#2)은 directRoadMeters ∈ [D, D+150] 확인", () => {
    const D = SESSION_6_TARGET_METERS;
    for (const click of session6Clicks.filter((c) => c.expectedOutcome === "exact")) {
      assert.ok(
        click.directRoadMeters >= D && click.directRoadMeters <= D + 150,
        `${click.id}: directRoadMeters ${click.directRoadMeters} should be in [${D}, ${D + 150}]`,
      );
    }
  });

  const allRows: Array<{
    click: Session6ClickRow;
    searched: Awaited<ReturnType<typeof replaySession6Click>>;
  }> = [];

  for (const click of session6Clicks) {
    it(`${click.id} — outcome·호출 수 계약`, async () => {
      const searched = await replaySession6Click(click);
      allRows.push({ click, searched });
      assertSession6ClickExpectations(click, searched);
    });
  }

  it("replay 표 출력 (모든 클릭 완료 후)", async () => {
    // 이미 위에서 replay 완료됨; rows가 채워졌을 때만 출력
    if (allRows.length === session6Clicks.length) {
      printSession6ReplayTable(allRows);
    }
    // 일부가 비어있어도 테스트는 통과 (직렬 실행 보장 없음)
    assert.ok(true);
  });
});
