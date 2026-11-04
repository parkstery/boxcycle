/**
 * openTrailListing 서브컬렉션 트리거 — create/delete 전용 등록 계약.
 *
 * `onDocumentWritten` + exists 게이트는 update 마다 CF 가 깨워진다(콜드스타트·과금).
 * members·livePublicationRides 는 Created/Deleted 만 등록하고, 진행 중 freshness 는
 * throttled `openTrailListingOnTrailWritten` 에 맡긴다.
 *
 * 실행: `tsc && node --test lib/openTrailListingProjection.test.js`
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  openTrailListingOnLiveCourseRideCreated,
  openTrailListingOnLiveCourseRideDeleted,
  openTrailListingOnMemberCreated,
  openTrailListingOnMemberDeleted,
  openTrailListingOnTrailWritten,
} from "./openTrailListingProjection.js";
import {
  OPEN_TRAIL_LISTING_STALE_MS,
  TRAIL_PRESENCE_STALE_MS,
  trailWriteAffectsListing,
} from "./openTrailListingCore.js";

const SRC = path.resolve(__dirname, "../src");
const CREATED = "google.cloud.firestore.document.v1.created";
const DELETED = "google.cloud.firestore.document.v1.deleted";
const WRITTEN = "google.cloud.firestore.document.v1.written";

type EndpointLike = {
  __endpoint?: {
    eventTrigger?: {
      eventType?: string;
      eventFilterPathPatterns?: { document?: string };
    };
  };
  run?: (event: unknown) => Promise<unknown>;
};

function asEndpoint(fn: unknown): EndpointLike {
  return fn as EndpointLike;
}

function eventTypeOf(fn: EndpointLike): string {
  const t = fn.__endpoint?.eventTrigger?.eventType;
  assert.ok(t, "Cloud Function __endpoint.eventTrigger.eventType 이 있어야 한다");
  return t;
}

function documentPatternOf(fn: EndpointLike): string {
  const p = fn.__endpoint?.eventTrigger?.eventFilterPathPatterns?.document;
  assert.ok(p, "document path pattern 이 등록되어야 한다");
  return p;
}

describe("Firestore event registration — members·live rides", () => {
  it("member create/delete 는 Created·Deleted 만, Written 이 아니다", () => {
    assert.equal(eventTypeOf(asEndpoint(openTrailListingOnMemberCreated)), CREATED);
    assert.equal(eventTypeOf(asEndpoint(openTrailListingOnMemberDeleted)), DELETED);
    assert.equal(
      documentPatternOf(asEndpoint(openTrailListingOnMemberCreated)),
      "trails/{trailId}/members/{userId}",
    );
    assert.equal(
      documentPatternOf(asEndpoint(openTrailListingOnMemberDeleted)),
      "trails/{trailId}/members/{userId}",
    );
  });

  it("livePublicationRides create/delete 는 Created·Deleted 만, Written 이 아니다", () => {
    assert.equal(eventTypeOf(asEndpoint(openTrailListingOnLiveCourseRideCreated)), CREATED);
    assert.equal(eventTypeOf(asEndpoint(openTrailListingOnLiveCourseRideDeleted)), DELETED);
    assert.equal(
      documentPatternOf(asEndpoint(openTrailListingOnLiveCourseRideCreated)),
      "trails/{trailId}/livePublicationRides/{uid}",
    );
    assert.equal(
      documentPatternOf(asEndpoint(openTrailListingOnLiveCourseRideDeleted)),
      "trails/{trailId}/livePublicationRides/{uid}",
    );
  });

  it("trail listing 은 Written 유지 (lastActivityAt throttled path)", () => {
    assert.equal(eventTypeOf(asEndpoint(openTrailListingOnTrailWritten)), WRITTEN);
    assert.equal(documentPatternOf(asEndpoint(openTrailListingOnTrailWritten)), "trails/{trailId}");
  });
});

describe("소스 — 서브컬렉션에 onDocumentWritten 미등록", () => {
  it("members·live 경로는 Created/Deleted export 만 존재한다", () => {
    const src = fs.readFileSync(path.join(SRC, "openTrailListingProjection.ts"), "utf8");
    assert.doesNotMatch(src, /openTrailListingOnMemberWritten/);
    assert.doesNotMatch(src, /openTrailListingOnLiveCourseRideWritten/);
    assert.match(src, /export const openTrailListingOnMemberCreated = onDocumentCreated/);
    assert.match(src, /export const openTrailListingOnMemberDeleted = onDocumentDeleted/);
    assert.match(src, /export const openTrailListingOnLiveCourseRideCreated = onDocumentCreated/);
    assert.match(src, /export const openTrailListingOnLiveCourseRideDeleted = onDocumentDeleted/);
    assert.doesNotMatch(
      src,
      /onDocumentWritten[\s\S]{0,160}members/,
      "members/live 에 Written 트리거가 남으면 update 마다 CF 가 호출된다",
    );
    assert.doesNotMatch(src, /onDocumentWritten[\s\S]{0,160}livePublicationRides/);
  });
});

describe("handler invocation — default trail guard", () => {
  it("trailId default 이면 recompute 없이 즉시 return 한다", async () => {
    const handlers = [
      openTrailListingOnMemberCreated,
      openTrailListingOnMemberDeleted,
      openTrailListingOnLiveCourseRideCreated,
      openTrailListingOnLiveCourseRideDeleted,
    ];
    for (const raw of handlers) {
      const fn = asEndpoint(raw);
      assert.equal(typeof fn.run, "function");
      await fn.run!({ params: { trailId: "default", userId: "u", uid: "u" } });
    }
  });
});

describe("index exports — 새 함수명", () => {
  it("MemberWritten·LiveCourseRideWritten export 가 제거되었다", () => {
    const indexSrc = fs.readFileSync(path.join(SRC, "index.ts"), "utf8");
    assert.doesNotMatch(indexSrc, /openTrailListingOnMemberWritten/);
    assert.doesNotMatch(indexSrc, /openTrailListingOnLiveCourseRideWritten/);
    assert.match(indexSrc, /openTrailListingOnMemberCreated/);
    assert.match(indexSrc, /openTrailListingOnMemberDeleted/);
    assert.match(indexSrc, /openTrailListingOnLiveCourseRideCreated/);
    assert.match(indexSrc, /openTrailListingOnLiveCourseRideDeleted/);
  });
});

describe("비용 L9 — Trail 쓰기가 목록을 바꾸는가", () => {
  const open = { status: "open", visibility: "open", publicationId: "p1", hostUid: "h" };
  const priv = { status: "open", visibility: "private", publicationId: null, hostUid: "h" };

  it("비공개 Trail 활동 시각 갱신은 재계산하지 않는다", () => {
    assert.equal(trailWriteAffectsListing("t", priv, { ...priv, lastActivityAt: 1 }), false);
  });

  it("공개 Trail 은 재계산한다", () => {
    assert.equal(trailWriteAffectsListing("t", open, { ...open, lastActivityAt: 1 }), true);
  });

  it("공개↔비공개 전환·생성·삭제는 재계산한다", () => {
    assert.equal(trailWriteAffectsListing("t", priv, open), true);
    assert.equal(trailWriteAffectsListing("t", open, priv), true);
    assert.equal(trailWriteAffectsListing("t", undefined, priv), true);
    assert.equal(trailWriteAffectsListing("t", priv, undefined), true);
  });

  it("sweeper 기준이 앱 갱신 간격 110초보다 길다 — 짧으면 달리는 Trail 이 목록에서 사라진다", () => {
    assert.ok(OPEN_TRAIL_LISTING_STALE_MS > 110_000);
    assert.equal(OPEN_TRAIL_LISTING_STALE_MS, TRAIL_PRESENCE_STALE_MS);
  });
});
