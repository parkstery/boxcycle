import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVED_PURGE_MS,
  CLOSED_TO_ARCHIVED_MS,
  OPEN_QUIET_TO_CLOSED_MS,
  resolveArchivedAtMs,
  resolveClosedAtMs,
  scanAllPages,
  shouldCloseQuietOpenTrail,
} from "./trailLifecycleCore.js";

/**
 * Trail 수명주기 판정 계약.
 *
 * 무엇을 막는가 — 이 판정이 틀리면 **에러가 나지 않는다.** Trail 이 조용히 쌓이거나,
 * 반대로 달리려던 사람이 조용히 쫓겨난다. 둘 다 화면에는 아무 표시가 없다.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

/** 테스트용 — Firestore Timestamp 대신 숫자를 그대로 읽는다. */
const ts = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

describe("아무도 없는 열린 Trail 을 닫는 기준", () => {
  it("24시간 넘게 조용하면 닫는다", () => {
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: NOW - 25 * HOUR }, ts, NOW), true);
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: NOW - 131 * DAY }, ts, NOW), true);
  });

  it("방금까지 달리던 Trail 은 닫지 않는다", () => {
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: NOW }, ts, NOW), false);
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: NOW - 30_000 }, ts, NOW), false);
  });

  it("쉬었다 돌아오려는 사람을 쫓아내지 않는다 — 23시간은 아직 살아 있다", () => {
    /*
     * 닫힌 Trail 은 **다시 열 수 없다.** 기준을 짧게 줄이면 2026-09-27 에 고친
     * 「개설자가 자기 Trail 에서 쫓겨나는」 증상이 그대로 돌아온다.
     */
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: NOW - 23 * HOUR }, ts, NOW), false);
    assert.ok(
      OPEN_QUIET_TO_CLOSED_MS >= 12 * HOUR,
      "기준을 반나절 아래로 줄이면 사람을 쫓아낸다",
    );
  });

  it("lastActivityAt 이 없으면 createdAt 으로 본다", () => {
    assert.equal(shouldCloseQuietOpenTrail({ createdAt: NOW - 2 * DAY }, ts, NOW), true);
    assert.equal(shouldCloseQuietOpenTrail({ createdAt: NOW - HOUR }, ts, NOW), false);
  });

  it("날짜를 읽을 수 없으면 닫지 않는다", () => {
    // 모르는 것을 지우지 않는다. 그런 문서는 점검 스크립트가 따로 센다.
    assert.equal(shouldCloseQuietOpenTrail({}, ts, NOW), false);
    assert.equal(shouldCloseQuietOpenTrail({ lastActivityAt: "어제" }, ts, NOW), false);
  });

  it("하위 문서가 남아 있어도 판정에 영향을 주지 않는다", () => {
    /*
     * 실측(2026-09-27) — 131일 조용한 Trail 에 `livePublicationRides`·`members` 가 남아
     * 있었다. 탭을 그냥 닫으면 그렇게 된다. 그것을 「사람이 있다」로 읽으면
     * **가장 치워야 할 것이 영영 안 치워진다.** 판정은 시각 하나로만 한다.
     */
    const withJunk = { lastActivityAt: NOW - 131 * DAY, liveRiderCount: 3 };
    assert.equal(shouldCloseQuietOpenTrail(withJunk, ts, NOW), true);
  });
});

describe("다음 두 단계가 보는 시각 — 정리기와 점검이 같은 것을 본다", () => {
  it("보관 단계: closedAt → lastActivityAt → createdAt 순", () => {
    assert.equal(resolveClosedAtMs({ closedAt: 1, lastActivityAt: 2, createdAt: 3 }, ts), 1);
    assert.equal(resolveClosedAtMs({ lastActivityAt: 2, createdAt: 3 }, ts), 2);
    assert.equal(resolveClosedAtMs({ createdAt: 3 }, ts), 3);
  });

  it("삭제 단계: archivedAt → closedAt → lastActivityAt 순", () => {
    assert.equal(resolveArchivedAtMs({ archivedAt: 1, closedAt: 2, lastActivityAt: 3 }, ts), 1);
    assert.equal(resolveArchivedAtMs({ closedAt: 2, lastActivityAt: 3 }, ts), 2);
    assert.equal(resolveArchivedAtMs({ lastActivityAt: 3 }, ts), 3);
  });

  it("셋 다 없으면 null — 정리기는 그 문서를 영원히 건너뛴다", () => {
    // 이 사실을 시험으로 적어 둔다. 모르면 「왜 안 줄지」를 영영 못 찾는다.
    assert.equal(resolveClosedAtMs({}, ts), null);
    assert.equal(resolveArchivedAtMs({}, ts), null);
  });
});

describe("세 단계가 한 방향으로만 흐른다", () => {
  it("닫힘 → 보관 → 삭제 순서가 뒤집히지 않는다", () => {
    /*
     * 보관 대기가 삭제 대기보다 길면 Trail 이 보관을 건너뛰고 지워질 수 있다.
     * 숫자를 손댈 때 이 관계를 깨지 않게 잡아 둔다.
     */
    assert.ok(OPEN_QUIET_TO_CLOSED_MS > 0);
    assert.ok(CLOSED_TO_ARCHIVED_MS > 0);
    assert.ok(
      ARCHIVED_PURGE_MS > CLOSED_TO_ARCHIVED_MS,
      "삭제까지의 기간이 보관까지보다 짧으면 단계가 뒤집힌다",
    );
  });

  it("Trail 은 최소 이틀은 살아 있다 — 되돌릴 수 없는 삭제이므로", () => {
    const totalMs = OPEN_QUIET_TO_CLOSED_MS + CLOSED_TO_ARCHIVED_MS + ARCHIVED_PURGE_MS;
    assert.ok(
      totalMs >= 2 * DAY,
      "조용해진 뒤 삭제까지 최소 이틀 — 판단을 되돌릴 시간을 남긴다",
    );
  });
});

describe("단계 문서를 끝까지 훑는다(2026-10-09)", () => {
  // 250건, 기한 지난 것은 뒤쪽 150건 — 종전처럼 앞 100건만 보면 하나도 못 지운다.
  const docs = Array.from({ length: 250 }, (_, i) => ({ id: `t${String(i).padStart(3, "0")}`, overdue: i >= 100 }));
  const fetchPage = (pageSize: number) => async (after: { id: string } | null) => {
    const start = after ? docs.findIndex((d) => d.id === after.id) + 1 : 0;
    return docs.slice(start, start + pageSize);
  };

  it("페이지를 넘겨 뒤쪽의 기한 지난 문서까지 모두 처리한다", async () => {
    const purged: string[] = [];
    const r = await scanAllPages(fetchPage(100), 100, async (d) => {
      if (d.overdue) purged.push(d.id);
    }, () => false);
    assert.equal(r.visited, 250);
    assert.equal(r.stopped, false);
    assert.equal(purged.length, 150);
  });

  it("마지막 페이지가 꽉 차도(정확히 배수) 빈 페이지 한 번으로 끝난다", async () => {
    const r = await scanAllPages(fetchPage(125), 125, async () => {}, () => false);
    assert.equal(r.visited, 250);
  });

  it("시간 예산이 다하면 멈추고 멈췄다고 알린다", async () => {
    let n = 0;
    const r = await scanAllPages(fetchPage(100), 100, async () => {
      n += 1;
    }, () => n >= 30);
    assert.equal(r.visited, 30);
    assert.equal(r.stopped, true);
  });
});
