import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPublicationListMeta,
  publicationDestinationFromTitle,
  publicationDisplayTitle,
} from "../../src/lib/publicationDisplay.ts";

describe("publicationDisplay", () => {
  it("제목에서 · 뒤 목적지를 추출한다", () => {
    assert.equal(publicationDestinationFromTitle("Basic 1 · 서울 남산공원길"), "서울 남산공원길");
    assert.equal(publicationDestinationFromTitle("단일 제목"), null);
  });

  it("목록 메타는 프로필·거리·목적지만 — 도착 ETA 없음", () => {
    const meta = formatPublicationListMeta({
      title: "Basic 1 · 서울 남산공원길",
      profile: "cycling",
      distanceMeters: 414,
    });
    assert.match(meta, /자전거 · 0\.41 km · 서울 남산공원길/);
    assert.doesNotMatch(meta, /도착|%/);
  });

  it("displayTitle 은 Publication title 을 그대로 쓴다", () => {
    assert.equal(publicationDisplayTitle({ title: "  퍼블릭 A  " }), "퍼블릭 A");
  });
});
