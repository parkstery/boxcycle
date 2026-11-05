/**
 * 공개 경로 요약 목록(G2) — 에뮬레이터 쿼리·Rules 시험.
 *
 * 지키는 것(계획 §5 G2 완료 조건): 국가 범위 쿼리, 화면(타일 앞부분) 범위 쿼리, 최근순 목록,
 * 공개 읽기·클라이언트 쓰기 거부, 비공개 전환 시 목록에서 빠짐.
 * 에뮬레이터는 복합 색인을 요구하지 않는다 — 색인 정의는 firestore.indexes.json 에서 따로 확인한다.
 *
 * 실행 (functions): npm run test:publication-listings:emulator
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { geoQuadkeyAt } from "./geoRegion/geoRegionCore.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { PUBLICATION_LISTINGS_COLLECTION, ROUTE_PUBLICATIONS_COLLECTION } from "./publicationListingCore.js";
import { recomputePublicationListing } from "./publicationListingStore.js";
import { OPEN_TRAIL_LISTINGS_COLLECTION, recomputeOpenTrailListing } from "./openTrailListingCore.js";

const PROJECT_ID = "boxcycle-dc2df";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (!/^(127\.0\.0\.1|localhost):/.test(FS_HOST)) {
  throw new Error(`FIRESTORE_EMULATOR_HOST missing/non-local (${FS_HOST || "unset"}) — refuse live Firebase.`);
}

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

type Seed = { id: string; start: [number, number]; createdMs: number; status?: string };
const SEEDS: Seed[] = [
  { id: "seoul-a", start: [126.978, 37.5665], createdMs: 1_000 },
  { id: "seoul-b", start: [127.05, 37.52], createdMs: 3_000 },
  { id: "busan", start: [129.075, 35.18], createdMs: 2_000 },
  { id: "paris", start: [2.3522, 48.8566], createdMs: 4_000 },
  { id: "seoul-archived", start: [126.99, 37.57], createdMs: 5_000, status: "archived" },
];

async function seed(s: Seed): Promise<void> {
  await db.collection(ROUTE_PUBLICATIONS_COLLECTION).doc(s.id).set({
    routeId: `r-${s.id}`,
    publicTitle: s.id,
    status: s.status ?? "published",
    geometryCoordsJson: JSON.stringify([s.start, [s.start[0] + 0.01, s.start[1] + 0.01]]),
    snapshotProfile: "cycling",
    snapshotDistanceMeters: 1500,
    snapshotDurationSec: 300,
    applicantUid: "u1",
    routeFingerprint: "f".repeat(64),
    createdAt: Timestamp.fromMillis(s.createdMs),
  });
  await recomputePublicationListing(db, s.id, resolveGeoRegion);
}

const listings = () => db.collection(PUBLICATION_LISTINGS_COLLECTION);
const ids = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map((d) => d.id);

describe("publicationListings 에뮬레이터", () => {
  before(async () => {
    for (const s of SEEDS) await seed(s);
  });
  after(async () => {
    await fetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
      method: "DELETE",
    });
  });

  it("공개 Publication 만 목록에 있고 최근순으로 읽힌다", async () => {
    const snap = await listings().orderBy("createdAt", "desc").limit(80).get();
    assert.deepEqual(ids(snap), ["paris", "seoul-b", "busan", "seoul-a"]);
    assert.equal(snap.docs[0]!.get("geometryCoordsJson"), undefined);
  });

  it("국가·행정구역·대륙 범위 쿼리", async () => {
    const kr = await listings().where("geoCountry", "==", "KR").orderBy("createdAt", "desc").get();
    assert.deepEqual(ids(kr), ["seoul-b", "busan", "seoul-a"]);
    const seoul = await listings().where("geoAdmin1", "==", "KR-11").orderBy("createdAt", "desc").get();
    assert.deepEqual(ids(seoul), ["seoul-b", "seoul-a"]);
    const eu = await listings().where("geoContinent", "==", "EU").orderBy("createdAt", "desc").get();
    assert.deepEqual(ids(eu), ["paris"]);
  });

  it("화면 범위 — 타일 앞부분 일치 쿼리", async () => {
    // 서울 시청이 속한 z10 타일 = 앞 10글자. 서울 두 곳은 들고 부산·파리는 빠진다.
    const prefix = geoQuadkeyAt([126.978, 37.5665]).slice(0, 10);
    const snap = await listings()
      .where("geoQuadkey", ">=", prefix)
      .where("geoQuadkey", "<", `${prefix}~`)
      .get();
    assert.deepEqual(ids(snap).sort(), ["seoul-a", "seoul-b"]);
  });

  it("비공개 전환·원본 삭제 시 목록에서 빠진다", async () => {
    await db.collection(ROUTE_PUBLICATIONS_COLLECTION).doc("busan").update({ status: "archived" });
    assert.equal(await recomputePublicationListing(db, "busan", resolveGeoRegion), "removed");
    await db.collection(ROUTE_PUBLICATIONS_COLLECTION).doc("seoul-a").delete();
    assert.equal(await recomputePublicationListing(db, "seoul-a", resolveGeoRegion), "removed");
    const kr = await listings().where("geoCountry", "==", "KR").get();
    assert.deepEqual(ids(kr), ["seoul-b"]);
  });

  it("G4: 달리는 공개 Trail 목록에 그 Publication 의 지역이 복사된다", async () => {
    const trail = db.collection("trails").doc("trail-paris");
    await trail.set({
      hostUid: "h1",
      displayNumber: 7,
      status: "open",
      visibility: "open",
      publicationId: "paris",
      createdAt: Timestamp.now(),
    });
    // 2026-11-05 Chief D6: 대기(members 만)는 목록 인원에 들지 않는다 — 주행 중(live ride)이 있어야 목록에 오른다.
    await trail.collection("members").doc("h1").set({ lastSeenAt: Timestamp.now() });
    assert.equal(await recomputeOpenTrailListing("trail-paris"), "removed", "대기만 있으면 목록에 없다");
    await trail.collection("livePublicationRides").doc("h1").set({ lastSeenAt: Timestamp.now(), publicationId: "paris", progressRatio: 0 });
    assert.equal(await recomputeOpenTrailListing("trail-paris"), "upserted");
    const row = (await db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).doc("trail-paris").get()).data()!;
    assert.equal(row.geoCountry, "FR");
    assert.equal(row.geoAdmin1, "FR-IDF");
    assert.equal(row.geoContinent, "EU");
    assert.equal(row.geoSourcePublicationId, "paris");
    assert.equal(row.riderCount, 1);
    const fr = await db.collection(OPEN_TRAIL_LISTINGS_COLLECTION).where("geoCountry", "==", "FR").get();
    assert.deepEqual(ids(fr), ["trail-paris"]);
  });

  it("Rules: 로그인 없이 읽기 허용, 클라이언트 쓰기 거부", async () => {
    const base = `http://${FS_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${PUBLICATION_LISTINGS_COLLECTION}`;
    const read = await fetch(`${base}/paris`);
    assert.equal(read.status, 200, await read.text());
    const write = await fetch(`${base}/forged`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { publicTitle: { stringValue: "x" } } }),
    });
    assert.equal(write.status, 403, await write.text());
    const del = await fetch(`${base}/paris`, { method: "DELETE" });
    assert.equal(del.status, 403, await del.text());
  });
});
