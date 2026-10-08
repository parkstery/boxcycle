/**
 * 체중·강도 기기 간 동기화 판정 계약.
 * 실행: npm run test:calorie-profile
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideCalorieSync } from "../../src/lib/ride/calorieProfileSync.ts";

const EMPTY = { weightKg: null, intensityId: null } as const;
const A = { weightKg: 70, intensityId: "moderate" } as const;
const B = { weightKg: 62.5, intensityId: "hard" } as const;

describe("decideCalorieSync", () => {
  it("S1 새 기기 — 서버 값을 이 기기에 반영한다", () => {
    assert.deepEqual(decideCalorieSync({ kind: "present", profile: A }, EMPTY), {
      kind: "applyLocal",
      profile: A,
    });
  });

  it("S2 서버와 이 기기가 다르면 서버가 이긴다", () => {
    assert.deepEqual(decideCalorieSync({ kind: "present", profile: B }, A), { kind: "applyLocal", profile: B });
  });

  it("S3 같으면 아무것도 안 한다(내가 방금 쓴 값의 메아리)", () => {
    assert.deepEqual(decideCalorieSync({ kind: "present", profile: { ...A } }, A), { kind: "none" });
  });

  it("S4 서버에 없고 이 기기에만 있으면 한 번 올린다(기존 사용자 이전)", () => {
    assert.deepEqual(decideCalorieSync({ kind: "missing" }, A), { kind: "upload", profile: A });
    const partial = { weightKg: 80, intensityId: null };
    assert.deepEqual(decideCalorieSync({ kind: "missing" }, partial), { kind: "upload", profile: partial });
  });

  it("S5 서버도 이 기기도 비었으면 빈 문서를 만들지 않는다", () => {
    assert.deepEqual(decideCalorieSync({ kind: "missing" }, EMPTY), { kind: "none" });
  });

  it("S6 캐시만 본 단계(pending)에서는 낡은 로컬 값을 올리지 않는다", () => {
    assert.deepEqual(decideCalorieSync({ kind: "pending" }, A), { kind: "none" });
  });

  it("S7 다른 기기에서 지운 값(null)도 이 기기에 반영한다", () => {
    assert.deepEqual(decideCalorieSync({ kind: "present", profile: EMPTY }, A), {
      kind: "applyLocal",
      profile: EMPTY,
    });
  });
});
