/**
 * F1 · serverRideId 연결 — 로컬 UUID와 Firestore doc ID 매핑
 * 
 * 팀장 요구: "Add new tests for local↔serverRideId linking after save,
 * matching real loadRecentRideSessionsFromFirestore shape (serverRideId: d.id)"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeRecentRideSessions,
  type StoredRideSession,
} from "../../src/lib/rideSessionsStorage.ts";

function session(id: string, endedAt: string, extra: Partial<StoredRideSession> = {}) {
  return {
    id,
    endedAt,
    elapsedSec: 600,
    distanceMeters: 3000,
    avgSpeedKmh: 18,
    caloriesEstimate: 100,
    routeDistanceMeters: 3000,
    routeDurationSec: 600,
    ...extra,
  } as StoredRideSession;
}

describe("F1 · ID-link after save — local UUID ↔ server doc ID", () => {
  it("로컬 끝 → 저장 → 서버 목록 재fetch → 한 행 (서버 ID = local serverRideId)", () => {
    // Before save: 로컬만
    const localId = "local-uuid-123";
    const localSession = session(localId, "2026-09-07T08:00:00.000Z");
    
    // After save: serverRideId 업데이트
    const serverDocId = "firestore-doc-abc";
    const updatedLocal = { ...localSession, serverRideId: serverDocId };
    
    // Server re-fetch: loadRecentRideSessionsFromFirestore가 { id: d.id, serverRideId: d.id, ... } 형태로 반환
    const serverSession = session(serverDocId, "2026-09-07T08:00:00.000Z", {
      serverRideId: serverDocId,
      endPlaceLabel: "논현로98길", // 서버 역지오코딩
    });
    
    // Merge: 로컬 (id=local-uuid, serverRideId=firestore-doc) + 서버 (id=firestore-doc, serverRideId=firestore-doc)
    const merged = mergeRecentRideSessions([serverSession], [updatedLocal]);
    
    assert.equal(merged.length, 1, "한 주행만 (dedup by serverRideId)");
    assert.equal(merged[0]?.id, serverDocId, "서버 판이 정본 (id = doc ID)");
    assert.equal(merged[0]?.serverRideId, serverDocId, "serverRideId 일치");
    assert.equal(merged[0]?.endPlaceLabel, "논현로98길", "서버 후처리 반영");
  });

  it("로컬 in-flight (serverRideId 없음) → 서버에 아직 없음 → 별도 행", () => {
    const localInFlight = session("local-uuid-456", "2026-09-07T08:01:00.000Z");
    const olderServerSession = session("server-doc-old", "2026-09-07T07:50:00.000Z", {
      serverRideId: "server-doc-old",
    });
    
    const merged = mergeRecentRideSessions([olderServerSession], [localInFlight]);
    
    assert.equal(merged.length, 2, "2개 행: 로컬 in-flight + 서버 old");
    assert.equal(merged[0]?.id, "local-uuid-456", "최신(로컬 in-flight)이 맨 앞");
    assert.equal(merged[1]?.id, "server-doc-old", "서버 old 뒤에");
  });

  it("다중 주행 — 각각 독립적인 serverRideId로 dedup", () => {
    const ride1Local = session("local-a", "2026-09-07T08:00:00.000Z", { serverRideId: "server-1" });
    const ride2Local = session("local-b", "2026-09-07T08:05:00.000Z", { serverRideId: "server-2" });
    const ride3InFlight = session("local-c", "2026-09-07T08:10:00.000Z"); // no serverRideId yet
    
    const ride1Server = session("server-1", "2026-09-07T08:00:00.000Z", { 
      serverRideId: "server-1",
      endPlaceLabel: "강남대로",
    });
    const ride2Server = session("server-2", "2026-09-07T08:05:00.000Z", { 
      serverRideId: "server-2",
      endPlaceLabel: "테헤란로",
    });
    
    const merged = mergeRecentRideSessions(
      [ride1Server, ride2Server],
      [ride3InFlight, ride2Local, ride1Local],
    );
    
    assert.equal(merged.length, 3, "3개 행: ride3(in-flight) + ride2(dedup) + ride1(dedup)");
    assert.equal(merged[0]?.id, "local-c", "최신 in-flight가 맨 앞");
    assert.equal(merged[1]?.id, "server-2", "ride2 서버판");
    assert.equal(merged[2]?.id, "server-1", "ride1 서버판");
  });

  it("로컬 serverRideId 설정 전후 — 설정 전에는 별도, 설정 후 dedup", () => {
    const localBefore = session("local-xyz", "2026-09-07T08:00:00.000Z");
    const serverSession = session("server-doc-123", "2026-09-07T08:00:00.000Z", {
      serverRideId: "server-doc-123",
      endPlaceLabel: "역삼동",
    });
    
    // 설정 전: 별도 행
    const mergedBefore = mergeRecentRideSessions([serverSession], [localBefore]);
    assert.equal(mergedBefore.length, 2, "설정 전: 2개 행 (별도)");
    
    // 설정 후
    const localAfter = { ...localBefore, serverRideId: "server-doc-123" };
    const mergedAfter = mergeRecentRideSessions([serverSession], [localAfter]);
    
    assert.equal(mergedAfter.length, 1, "설정 후: 1개 행 (dedup)");
    assert.equal(mergedAfter[0]?.id, "server-doc-123", "서버판이 정본");
    assert.equal(mergedAfter[0]?.endPlaceLabel, "역삼동", "서버 역지오코딩");
  });

  it("loadRecentRideSessionsFromFirestore 형태 — id와 serverRideId 동일", () => {
    // loadRecentRideSessionsFromFirestore는 { id: d.id, serverRideId: d.id, ... } 반환
    const serverFetchedSession = session("firestore-doc-abc", "2026-09-07T08:00:00.000Z", {
      serverRideId: "firestore-doc-abc", // explicit
      endPlaceLabel: "서초대로",
    });
    
    const localLinkedSession = session("local-uuid-999", "2026-09-07T08:00:00.000Z", {
      serverRideId: "firestore-doc-abc", // 저장 후 연결됨
    });
    
    const merged = mergeRecentRideSessions([serverFetchedSession], [localLinkedSession]);
    
    assert.equal(merged.length, 1, "한 주행 (dedup by serverRideId)");
    assert.equal(merged[0]?.id, "firestore-doc-abc", "서버 doc ID");
    assert.equal(merged[0]?.serverRideId, "firestore-doc-abc", "serverRideId explicit");
  });
});
