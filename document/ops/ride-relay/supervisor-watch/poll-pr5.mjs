#!/usr/bin/env node
/**
 * PR #5 Codex supervisor instruction poller (local IDE wake).
 *
 * Fixes from RTW-AUTO-PROBE-20260910-01:
 * - STOP bypasses busy work lock and cancels current work
 * - Bootstrap seeds only non-actionable / already-handled comments (not unacked INSTRUCTION/STOP)
 * - instructionId + commentId dedupe; already-locked same ID does not re-emit wake
 * - Exclusive lockfile for single poller instance
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.PR5_WATCH_REPO || "parkstery/boxcycle";
const PR = process.env.PR5_WATCH_PR || "5";
const STATE_PATH =
  process.env.PR5_WATCH_STATE || path.join(HERE, "runtime", "state.json");
const LOCK_PATH =
  process.env.PR5_WATCH_LOCK || path.join(HERE, "runtime", "poller.lock");
const INTERVAL_SEC = Math.min(
  600,
  Math.max(30, Number(process.env.PR5_WATCH_INTERVAL_SEC || 120) || 120),
);
const ONCE = process.env.PR5_WATCH_ONCE === "1";
/** Optional ISO; when set, bootstrap also seeds actionable comments created at/before this time. */
const SEED_BEFORE_ISO = process.env.PR5_WATCH_SEED_BEFORE_ISO || null;

const ALLOWED_AUTHORS = new Set(["parkstery"]);
const ACTIONABLE =
  /^##\s+(INSTRUCTION|STOP|REVIEW-CHECKPOINT)\s+[—-]\s+(\S+)/m;
const IGNORE_PREFIXES = [
  "## ACK —",
  "## SUBMISSION —",
  "## FINAL SUBMISSION —",
  "## PROGRESS —",
  "## READY —",
  "## HANDOVER —",
  "## NOTE —",
];

export function ensureRuntimeDir(statePath = STATE_PATH) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
}

export function defaultState() {
  return {
    version: 2,
    pr: Number(PR),
    repo: REPO,
    processedCommentIds: [],
    processedInstructionIds: [],
    current: null,
    lock: null,
    cancelledByStop: null,
    stopped: false,
    lastPollAt: null,
    lastError: null,
    bootstrapped: false,
  };
}

export function loadState(statePath = STATE_PATH) {
  ensureRuntimeDir(statePath);
  if (!fs.existsSync(statePath)) return defaultState();
  return { ...defaultState(), ...JSON.parse(fs.readFileSync(statePath, "utf8")) };
}

export function saveState(state, statePath = STATE_PATH) {
  ensureRuntimeDir(statePath);
  const tmp = `${statePath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, statePath);
}

export function firstLine(body) {
  return (
    String(body || "")
      .split(/\r?\n/)
      .find((l) => l.trim().length > 0) || ""
  );
}

export function isIgnored(body) {
  const fl = firstLine(body);
  return IGNORE_PREFIXES.some((p) => fl.startsWith(p));
}

export function parseActionable(body) {
  if (isIgnored(body)) return null;
  const m = String(body || "").match(ACTIONABLE);
  if (!m) return null;
  const kind = m[1];
  const instructionId = m[2];
  const actorOk = /Actor:\s*Codex supervisor/i.test(body);
  if (!actorOk) return null;
  return { kind, instructionId };
}

/** STOP always wins; does not require clearing work lock first. */
export function selectNextCandidate(candidates) {
  const sorted = [...candidates].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
  const stop = sorted.find((x) => x.kind === "STOP");
  return stop || sorted[0] || null;
}

/**
 * Acquire work lock. STOP callers should use applyStop() instead.
 * Same instructionId already locked → already=true (no second wake).
 */
export function acquireLock(state, item) {
  if (state.processedInstructionIds?.includes(item.instructionId)) {
    return { ok: false, reason: "instruction-done", lock: state.lock };
  }
  if (state.lock && state.lock.instructionId !== item.instructionId) {
    return { ok: false, reason: "busy", lock: state.lock };
  }
  if (state.lock && state.lock.instructionId === item.instructionId) {
    return { ok: true, already: true, lock: state.lock };
  }
  const executionId = `pr5-${item.instructionId}-${item.commentId}`;
  state.lock = {
    executionId,
    instructionId: item.instructionId,
    commentId: item.commentId,
    kind: item.kind,
    acquiredAt: new Date().toISOString(),
  };
  state.current = {
    instructionId: item.instructionId,
    commentId: item.commentId,
    kind: item.kind,
    status: "received",
    executionId,
    startedAt: state.lock.acquiredAt,
  };
  return { ok: true, already: false, lock: state.lock };
}

export function applyStop(state, stopItem) {
  const prev = state.lock;
  state.stopped = true;
  state.cancelledByStop = {
    stopId: stopItem.instructionId,
    stopCommentId: stopItem.commentId,
    cancelledExecutionId: prev?.executionId ?? null,
    cancelledInstructionId: prev?.instructionId ?? null,
    at: new Date().toISOString(),
  };
  if (state.current) {
    state.current.status = "stopped";
  } else {
    state.current = {
      instructionId: stopItem.instructionId,
      commentId: stopItem.commentId,
      kind: "STOP",
      status: "stopped",
      executionId: `pr5-${stopItem.instructionId}-${stopItem.commentId}`,
      startedAt: state.cancelledByStop.at,
    };
  }
  // Release work lock so STOP is never blocked by busy work.
  state.lock = null;
  return state.cancelledByStop;
}

export function markProcessed(state, commentId, instructionId) {
  const comments = new Set(state.processedCommentIds || []);
  comments.add(String(commentId));
  state.processedCommentIds = [...comments];
  if (instructionId) {
    const ids = new Set(state.processedInstructionIds || []);
    ids.add(instructionId);
    state.processedInstructionIds = [...ids];
  }
}

/**
 * Bootstrap seed: mark ignored/history comments only.
 * Actionable INSTRUCTION/STOP are NOT seeded unless created_at <= seedBeforeIso.
 */
export function bootstrapSeedCommentIds(comments, { seedBeforeIso = null } = {}) {
  const ids = [];
  for (const c of comments) {
    const author = c.user?.login || "";
    if (!ALLOWED_AUTHORS.has(author)) continue;
    const body = c.body || "";
    if (isIgnored(body)) {
      ids.push(String(c.id));
      continue;
    }
    const actionable = parseActionable(body);
    if (!actionable) continue;
    if (
      seedBeforeIso &&
      c.created_at &&
      String(c.created_at) <= String(seedBeforeIso)
    ) {
      ids.push(String(c.id));
    }
  }
  return ids;
}

export function tryAcquirePollerLock(lockPath = LOCK_PATH) {
  ensureRuntimeDir(lockPath);
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(
      fd,
      `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`,
    );
    fs.closeSync(fd);
    return { ok: true };
  } catch (e) {
    if (e && e.code === "EEXIST") {
      let stale = false;
      try {
        const raw = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        if (raw?.pid && raw.pid !== process.pid) {
          try {
            process.kill(raw.pid, 0);
          } catch {
            stale = true;
          }
        }
      } catch {
        stale = true;
      }
      if (stale) {
        fs.unlinkSync(lockPath);
        return tryAcquirePollerLock(lockPath);
      }
      return { ok: false, reason: "another-poller" };
    }
    throw e;
  }
}

export function releasePollerLock(lockPath = LOCK_PATH) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function ghJson(args) {
  const r = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim() || `gh exit ${r.status}`;
    throw new Error(err);
  }
  return JSON.parse(r.stdout || "[]");
}

function emitWake(payload) {
  const line = `AGENT_LOOP_WAKE_pr5_supervisor ${JSON.stringify(payload)}`;
  process.stdout.write(`${line}\n`);
}

/** Pure poll step for fixtures / production. */
export function pollOnceWithComments(state, comments, { emit = emitWake } = {}) {
  state.lastPollAt = new Date().toISOString();
  state.lastError = null;

  if (state.stopped) {
    return { woke: false, reason: "stopped", state };
  }

  const processed = new Set(state.processedCommentIds || []);
  const doneInstr = new Set(state.processedInstructionIds || []);
  const candidates = [];
  for (const c of comments) {
    const id = String(c.id);
    if (processed.has(id)) continue;
    const author = c.user?.login || "";
    if (!ALLOWED_AUTHORS.has(author)) continue;
    const parsed = parseActionable(c.body || "");
    if (!parsed) continue;
    if (doneInstr.has(parsed.instructionId) && parsed.kind !== "STOP") {
      // New comment, same instruction ID already handled → swallow without wake
      markProcessed(state, id, parsed.instructionId);
      continue;
    }
    candidates.push({
      commentId: id,
      createdAt: c.created_at,
      author,
      kind: parsed.kind,
      instructionId: parsed.instructionId,
      url: c.html_url,
    });
  }

  const next = selectNextCandidate(candidates);
  if (!next) {
    return { woke: false, reason: "none", state };
  }

  if (next.kind === "STOP") {
    const cancelled = applyStop(state, next);
    markProcessed(state, next.commentId, next.instructionId);
    emit({
      prompt:
        "PR #5 STOP received — cancel current work lock; do not start new implement work until resume INSTRUCTION.",
      kind: "STOP",
      instructionId: next.instructionId,
      commentId: next.commentId,
      author: next.author,
      url: next.url,
      receivePath: "automatic-poll",
      cancelled,
    });
    return { woke: true, next, reason: "stop", state };
  }

  const lock = acquireLock(state, next);
  if (!lock.ok) {
    return { woke: false, reason: lock.reason, next, state };
  }
  if (lock.already) {
    // Same instruction already running — mark comment processed, no second wake
    markProcessed(state, next.commentId, next.instructionId);
    return { woke: false, reason: "already", next, state };
  }

  markProcessed(state, next.commentId, next.instructionId);
  emit({
    prompt:
      "PR #5 supervisor watch wake: read the new actionable comment, ACK if INSTRUCTION, honor STOP immediately, do not re-run processed IDs.",
    kind: next.kind,
    instructionId: next.instructionId,
    commentId: next.commentId,
    author: next.author,
    url: next.url,
    executionId: lock.lock.executionId,
    receivePath: "automatic-poll",
  });
  return { woke: true, next, executionId: lock.lock.executionId, state };
}

function pollOnceLive() {
  const state = loadState();
  let comments;
  try {
    comments = ghJson([
      "api",
      `repos/${REPO}/issues/${PR}/comments?per_page=100`,
      "--paginate",
    ]);
  } catch (e) {
    state.lastError = String(e?.message || e);
    saveState(state);
    process.stdout.write(`pr5-watch: poll error: ${state.lastError}\n`);
    return { woke: false, reason: "error" };
  }
  const result = pollOnceWithComments(state, comments);
  saveState(result.state);
  if (result.woke) {
    process.stdout.write(
      `pr5-watch: wake kind=${result.next.kind} id=${result.next.instructionId} comment=${result.next.commentId}\n`,
    );
  } else {
    process.stdout.write(
      `pr5-watch: ok reason=${result.reason} lastPoll=${result.state.lastPollAt} processed=${(result.state.processedCommentIds || []).length}\n`,
    );
  }
  return result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const lock = tryAcquirePollerLock();
  if (!lock.ok) {
    process.stdout.write(
      `pr5-watch: abort another poller holds ${LOCK_PATH}\n`,
    );
    process.exit(3);
  }
  const release = () => releasePollerLock();
  process.on("exit", release);
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    release();
    process.exit(143);
  });

  process.stdout.write(
    `pr5-watch: start repo=${REPO} pr=${PR} interval=${INTERVAL_SEC}s once=${ONCE} state=${STATE_PATH}\n`,
  );

  const state = loadState();
  if (!state.bootstrapped) {
    try {
      const comments = ghJson([
        "api",
        `repos/${REPO}/issues/${PR}/comments?per_page=100`,
        "--paginate",
      ]);
      const ids = bootstrapSeedCommentIds(comments, {
        seedBeforeIso: SEED_BEFORE_ISO,
      });
      state.processedCommentIds = Array.from(
        new Set([...(state.processedCommentIds || []), ...ids]),
      );
      state.bootstrapped = true;
      state.bootstrappedAt = new Date().toISOString();
      state.stopped = false;
      saveState(state);
      process.stdout.write(
        `pr5-watch: bootstrap seeded ${ids.length} non-actionable/historical ids (actionable unacked preserved)\n`,
      );
    } catch (e) {
      process.stdout.write(`pr5-watch: bootstrap failed: ${e}\n`);
    }
  }

  for (;;) {
    pollOnceLive();
    if (ONCE) break;
    await sleep(INTERVAL_SEC * 1000);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((e) => {
    console.error(e);
    releasePollerLock();
    process.exit(1);
  });
}
