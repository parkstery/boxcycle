/**
 * 공개 경로 요약 목록(G2) — 투영 규칙·트리거 등록·쓰기 생략 계약.
 * 실행: `tsc && node --test lib/publicationListing.test.js`
 * 쿼리(국가·화면 범위)·Rules 는 에뮬레이터 시험: `npm run test:publication-listings:emulator`
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import {
  buildPublicationListing,
  listingFieldsEqual,
  publicationWriteAffectsListing,
} from "./publicationListingCore.js";
import { publicationListingOnPublicationWritten } from "./publicationListingProjection.js";
import { syncPublicationListing } from "./publicationListingStore.js";

const SEOUL: [number, number] = [126.978, 37.5665];
const PARIS: [number, number] = [2.3522, 48.8566];

function pub(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    routeId: "r1",
    publicTitle: "한강 한 바퀴",
    status: "published",
    geometryCoordsJson: JSON.stringify([SEOUL, [127.0, 37.55], [127.01, 37.58]]),
    snapshotProfile: "cycling",
    snapshotDistanceMeters: 4200,
    snapshotDurationSec: 900,
    applicantUid: "u1",
    routeFingerprint: "f".repeat(64),
    ...over,
  };
}

/** collection(name).doc(id) 의 get·set·delete 만 흉내 낸다. */
function fakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  const writes: string[] = [];
  const db = {
    collection: (c: string) => ({
      doc: (id: string) => {
        const key = `${c}/${id}`;
        return {
          get: async () => ({ exists: store.has(key), data: () => store.get(key) }),
          set: async (v: Record<string, unknown>) => {
            writes.push(`set ${key}`);
            store.set(key, v);
          },
          delete: async () => {
            writes.push(`delete ${key}`);
            store.delete(key);
          },
        };
      },
    }),
  };
  return { db: db as unknown as Firestore, store, writes };
}

describe("publicationListing 투영", () => {
  it("출발점으로 지역을 판정하고 좌표 전체는 싣지 않는다", () => {
    const row = buildPublicationListing("p1", pub(), resolveGeoRegion)!;
    assert.equal(row.geoCountry, "KR");
    assert.equal(row.geoAdmin1, "KR-11");
    assert.equal(row.geoContinent, "AS");
    assert.equal(row.geoQuadkey.length, 16);
    assert.deepEqual(row.startLngLat, SEOUL);
    assert.deepEqual(row.bbox, [126.978, 37.55, 127.01, 37.58]);
    assert.equal("geometryCoordsJson" in row, false);
    assert.equal("routeFingerprint" in row, false);
    const paris = buildPublicationListing("p2", pub({ geometryCoordsJson: JSON.stringify([PARIS, [2.36, 48.86]]) }), resolveGeoRegion)!;
    assert.equal(paris.geoCountry, "FR");
    assert.equal(paris.geoAdmin1, "FR-IDF");
    assert.equal(paris.geoContinent, "EU");
  });

  it("공개가 아니거나 제목·좌표가 없으면 목록에 두지 않는다", () => {
    assert.equal(buildPublicationListing("p", pub({ status: "archived" }), resolveGeoRegion), null);
    assert.equal(buildPublicationListing("p", pub({ publicTitle: "  " }), resolveGeoRegion), null);
    assert.equal(buildPublicationListing("p", pub({ geometryCoordsJson: "[[1,2]]" }), resolveGeoRegion), null);
    assert.equal(buildPublicationListing("p", pub({ geometryCoordsJson: "[[999,2],[1,2]]" }), resolveGeoRegion), null);
    assert.equal(buildPublicationListing("p", pub({ geometryCoordsJson: "not json" }), resolveGeoRegion), null);
    assert.equal(buildPublicationListing("p", undefined, resolveGeoRegion), null);
  });

  it("바다 한가운데 출발은 국가 없이 목록에 둔다(전세계 범위)", () => {
    const row = buildPublicationListing(
      "p",
      pub({ geometryCoordsJson: JSON.stringify([[-150, 0], [-150.01, 0.01]]) }),
      resolveGeoRegion,
    )!;
    assert.equal(row.geoCountry, null);
    assert.equal(row.geoQuadkey.length, 16);
  });

  it("탈퇴한 등록자는 익명으로 투영된다", () => {
    const row = buildPublicationListing("p", pub({ applicantUid: "", publisherDeleted: true }), resolveGeoRegion)!;
    assert.equal(row.applicantUid, "");
    assert.equal(row.publisherDeleted, true);
  });
});

describe("publicationListing 트리거 판정", () => {
  it("동행 켜기(presenceEnabled·updatedAt)만 바뀐 쓰기는 건너뛴다", () => {
    const before = pub({ updatedAt: 1 });
    assert.equal(publicationWriteAffectsListing(before, { ...before, presenceEnabled: true, updatedAt: 2 }), false);
  });
  it("공개 상태·제목·등록자 변경, 생성·삭제는 재계산한다", () => {
    const before = pub();
    assert.equal(publicationWriteAffectsListing(before, { ...before, status: "archived" }), true);
    assert.equal(publicationWriteAffectsListing(before, { ...before, publicTitle: "새 이름" }), true);
    assert.equal(publicationWriteAffectsListing(before, { ...before, applicantUid: "", publisherDeleted: true }), true);
    assert.equal(publicationWriteAffectsListing(undefined, before), true);
    assert.equal(publicationWriteAffectsListing(before, undefined), true);
  });
  it("routePublications 문서 쓰기에 등록된다", () => {
    const ep = (publicationListingOnPublicationWritten as unknown as {
      __endpoint?: { eventTrigger?: { eventType?: string; eventFilterPathPatterns?: { document?: string } } };
    }).__endpoint;
    assert.equal(ep?.eventTrigger?.eventType, "google.cloud.firestore.document.v1.written");
    assert.equal(ep?.eventTrigger?.eventFilterPathPatterns?.document, "routePublications/{publicationId}");
  });
});

describe("publicationListing 쓰기", () => {
  it("만들고, 같으면 다시 쓰지 않고, 비공개 전환 시 지운다", async () => {
    const { db, store, writes } = fakeDb();
    assert.equal(await syncPublicationListing(db, "p1", pub(), resolveGeoRegion), "upserted");
    const saved = store.get("publicationListings/p1")!;
    assert.equal(saved.geoCountry, "KR");
    assert.ok(saved.createdAt, "createdAt 이 있어야 최근순 쿼리에 잡힌다");
    assert.equal(listingFieldsEqual(buildPublicationListing("p1", pub(), resolveGeoRegion)!, saved), true);
    assert.equal(await syncPublicationListing(db, "p1", pub(), resolveGeoRegion), "unchanged");
    assert.equal(await syncPublicationListing(db, "p1", pub({ status: "archived" }), resolveGeoRegion), "removed");
    assert.equal(store.has("publicationListings/p1"), false);
    assert.equal(await syncPublicationListing(db, "p1", undefined, resolveGeoRegion), "absent");
    assert.deepEqual(writes, ["set publicationListings/p1", "delete publicationListings/p1"]);
  });
  it("dry-run(apply=false)은 쓰지 않고 같은 결과를 낸다", async () => {
    const { db, writes } = fakeDb();
    assert.equal(await syncPublicationListing(db, "p1", pub(), resolveGeoRegion, { apply: false }), "upserted");
    assert.deepEqual(writes, []);
  });
});
