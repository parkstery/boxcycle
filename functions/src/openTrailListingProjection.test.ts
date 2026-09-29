/**
 * openTrailListing 서브컬렉션 트리거 라우팅 계약.
 *
 * 무엇을 막는가 — livePublicationRides 가 ~1Hz 로 갱신되는데 update 마다
 * `recomputeOpenTrailListing` 을 돌리면 Trail·집계·listing 읽기/쓰기가 라이더 수×초당
 * 증폭된다. create/delete 만 즉시 재계산하고, heartbeat update 는
 * throttled `trails.lastActivityAt` 경로에 맡긴다.
 *
 * 실행: `tsc && node --test lib/openTrailListingProjection.test.js`
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { isSubcollectionCreateOrDelete } from "./openTrailListingProjection.js";

const SRC = path.resolve(__dirname, "../src");

function snap(exists: boolean): DocumentSnapshot {
  return { exists } as DocumentSnapshot;
}

describe("isSubcollectionCreateOrDelete — listing 즉시 재계산 여부", () => {
  it("생성·삭제는 즉시 재계산한다", () => {
    assert.equal(isSubcollectionCreateOrDelete(undefined, snap(true)), true);
    assert.equal(isSubcollectionCreateOrDelete(snap(false), snap(true)), true);
    assert.equal(isSubcollectionCreateOrDelete(snap(true), undefined), true);
    assert.equal(isSubcollectionCreateOrDelete(snap(true), snap(false)), true);
  });

  it("존재→존재 update(하트비트)는 스킵한다", () => {
    assert.equal(isSubcollectionCreateOrDelete(snap(true), snap(true)), false);
  });

  it("비존재→비존재는 스킵한다", () => {
    assert.equal(isSubcollectionCreateOrDelete(undefined, undefined), false);
    assert.equal(isSubcollectionCreateOrDelete(snap(false), snap(false)), false);
  });
});

describe("livePublicationRides 트리거가 동일 판정을 쓴다", () => {
  it("소스에서 create/delete 게이트를 호출한다 — 구현 문장 복제가 아님", () => {
    const src = fs.readFileSync(path.join(SRC, "openTrailListingProjection.ts"), "utf8");
    const marker = "export const openTrailListingOnLiveCourseRideWritten";
    const start = src.indexOf(marker);
    assert.ok(start >= 0, "live ride 트리거 export 가 있어야 한다");
    const liveHandler = src.slice(start);
    assert.match(
      liveHandler,
      /if\s*\(\s*!isSubcollectionCreateOrDelete\s*\(/,
      "live ride 핸들러가 멤버와 같은 create/delete 판정을 건너뛰면 1Hz 증폭이 되살아난다",
    );
    assert.doesNotMatch(
      liveHandler,
      /had\s*!==\s*has|before\?\.exists[\s\S]{0,80}after\?\.exists/,
      "판정 본문을 핸들러에 다시 쓰면 정책 출처가 둘로 갈라진다",
    );
  });
});
