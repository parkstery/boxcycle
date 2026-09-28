/**
 * Fixture tests for poll-pr5.mjs (RTW-AUTO-PROBE-20260910-01).
 * No live GitHub; no product side effects.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  applyStop,
  acquireLock,
  bootstrapSeedCommentIds,
  pollOnceWithComments,
  selectNextCandidate,
  tryAcquirePollerLock,
  releasePollerLock,
  defaultState,
} from "./poll-pr5.mjs";

function comment(id, body, createdAt = "2026-09-10T00:00:00Z") {
  return {
    id,
    created_at: createdAt,
    html_url: `https://example.test/${id}`,
    user: { login: "parkstery" },
    body,
  };
}

const INSTR = (id) =>
  `## INSTRUCTION — ${id}\n\nActor: Codex supervisor\nRecipient: test\n`;
const STOP = (id) =>
  `## STOP — ${id}\n\nActor: Codex supervisor\nAuthority: test\n`;

describe("poll-pr5 STOP vs busy lock", () => {
  it("STOP is selected even when older instruction exists", () => {
    const next = selectNextCandidate([
      {
        kind: "INSTRUCTION",
        instructionId: "WORK-1",
        commentId: "1",
        createdAt: "2026-09-10T01:00:00Z",
      },
      {
        kind: "STOP",
        instructionId: "STOP-1",
        commentId: "2",
        createdAt: "2026-09-10T02:00:00Z",
      },
    ]);
    assert.equal(next.kind, "STOP");
  });

  it("STOP applies while work lock held — releases lock and records cancel", () => {
    const state = defaultState();
    acquireLock(state, {
      kind: "INSTRUCTION",
      instructionId: "WORK-1",
      commentId: "10",
    });
    markProcessedLocal(state, "10", "WORK-1");
    assert.ok(state.lock);

    const wakes = [];
    const result = pollOnceWithComments(
      state,
      [comment("11", STOP("STOP-1"), "2026-09-10T02:00:00Z")],
      { emit: (p) => wakes.push(p) },
    );
    assert.equal(result.woke, true);
    assert.equal(result.next.kind, "STOP");
    assert.equal(state.stopped, true);
    assert.equal(state.lock, null);
    assert.equal(state.cancelledByStop.cancelledInstructionId, "WORK-1");
    assert.equal(wakes.length, 1);
    assert.equal(wakes[0].kind, "STOP");
  });

  it("active lock + new STOP fixture cancels without needing lock free", () => {
    const state = defaultState();
    acquireLock(state, {
      kind: "INSTRUCTION",
      instructionId: "WORK-A",
      commentId: "1",
    });
    const cancelled = applyStop(state, {
      kind: "STOP",
      instructionId: "STOP-X",
      commentId: "9",
    });
    assert.equal(cancelled.cancelledInstructionId, "WORK-A");
    assert.equal(state.lock, null);
    assert.equal(state.stopped, true);
  });
});

describe("poll-pr5 bootstrap seed", () => {
  it("does not seed unacked actionable instructions by default", () => {
    const ids = bootstrapSeedCommentIds([
      comment("1", "## ACK — FOO\n\nok\n"),
      comment("2", INSTR("NEW-1"), "2026-09-10T03:00:00Z"),
      comment("3", STOP("STOP-NEW"), "2026-09-10T03:01:00Z"),
    ]);
    assert.deepEqual(ids, ["1"]);
  });

  it("seeds actionable only at/before explicit seedBeforeIso", () => {
    const ids = bootstrapSeedCommentIds(
      [
        comment("2", INSTR("OLD-1"), "2026-09-10T01:00:00Z"),
        comment("3", INSTR("NEW-1"), "2026-09-10T03:00:00Z"),
      ],
      { seedBeforeIso: "2026-09-10T02:00:00Z" },
    );
    assert.deepEqual(ids, ["2"]);
  });
});

describe("poll-pr5 instructionId dedupe", () => {
  it("second comment with same instructionId does not emit second wake", () => {
    const state = defaultState();
    const wakes = [];
    const r1 = pollOnceWithComments(
      state,
      [comment("1", INSTR("SAME-ID"), "2026-09-10T01:00:00Z")],
      { emit: (p) => wakes.push(p) },
    );
    assert.equal(r1.woke, true);
    assert.equal(wakes.length, 1);

    const r2 = pollOnceWithComments(
      state,
      [
        comment("1", INSTR("SAME-ID"), "2026-09-10T01:00:00Z"),
        comment("2", INSTR("SAME-ID"), "2026-09-10T01:05:00Z"),
      ],
      { emit: (p) => wakes.push(p) },
    );
    assert.equal(r2.woke, false);
    assert.equal(wakes.length, 1);
    assert.ok(state.processedCommentIds.includes("2"));
  });

  it("already-locked same instructionId does not re-emit wake", () => {
    const state = defaultState();
    acquireLock(state, {
      kind: "INSTRUCTION",
      instructionId: "L1",
      commentId: "1",
    });
    const wakes = [];
    const r = pollOnceWithComments(
      state,
      [comment("1", INSTR("L1"), "2026-09-10T01:00:00Z")],
      { emit: (p) => wakes.push(p) },
    );
    assert.equal(r.reason, "already");
    assert.equal(r.woke, false);
    assert.equal(wakes.length, 0);
  });
});

function markProcessedLocal(state, commentId, instructionId) {
  state.processedCommentIds = [
    ...new Set([...(state.processedCommentIds || []), String(commentId)]),
  ];
  state.processedInstructionIds = [
    ...new Set([...(state.processedInstructionIds || []), instructionId]),
  ];
}

describe("poll-pr5 exclusive poller lockfile", () => {
  it("second acquire fails while first holds lock", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr5-lock-"));
    const lockPath = path.join(dir, "poller.lock");
    const a = tryAcquirePollerLock(lockPath);
    assert.equal(a.ok, true);
    const b = tryAcquirePollerLock(lockPath);
    assert.equal(b.ok, false);
    releasePollerLock(lockPath);
    const c = tryAcquirePollerLock(lockPath);
    assert.equal(c.ok, true);
    releasePollerLock(lockPath);
  });
});

describe("duplicate event isolation fixture", () => {
  it("delivering same PROBE comment twice yields one wake", () => {
    const state = defaultState();
    const wakes = [];
    const batch = [
      comment("5612322269", INSTR("RTW-AUTO-PROBE-20260910-01"), "2026-09-10T03:33:00Z"),
    ];
    const r1 = pollOnceWithComments(state, batch, { emit: (p) => wakes.push(p) });
    const r2 = pollOnceWithComments(state, batch, { emit: (p) => wakes.push(p) });
    assert.equal(r1.woke, true);
    assert.equal(r2.woke, false);
    assert.equal(wakes.length, 1);
    assert.equal(wakes[0].instructionId, "RTW-AUTO-PROBE-20260910-01");
  });
});
