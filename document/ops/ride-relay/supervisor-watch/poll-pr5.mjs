#!/usr/bin/env node
/**
 * PR #5 Codex supervisor instruction poller (local IDE wake).
 *
 * - Reads issue comments via `gh` (no secrets in repo/comments).
 * - Does NOT execute comment bodies as shell.
 * - Emits AGENT_LOOP_WAKE_pr5_supervisor when a new actionable instruction appears.
 * - Persists processed comment IDs + single-run lock under runtime/.
 *
 * Env:
 *   PR5_WATCH_REPO   default parkstery/boxcycle
 *   PR5_WATCH_PR     default 5
 *   PR5_WATCH_STATE  default <this-dir>/runtime/state.json
 *   PR5_WATCH_ONCE   if "1", poll once and exit (no sleep loop)
 *   PR5_WATCH_INTERVAL_SEC  default 120 (≤600 per resume instruction)
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
const INTERVAL_SEC = Math.min(
  600,
  Math.max(30, Number(process.env.PR5_WATCH_INTERVAL_SEC || 120) || 120),
);
const ONCE = process.env.PR5_WATCH_ONCE === "1";

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

function ensureRuntimeDir() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
}

function loadState() {
  ensureRuntimeDir();
  if (!fs.existsSync(STATE_PATH)) {
    return {
      version: 1,
      pr: Number(PR),
      repo: REPO,
      processedCommentIds: [],
      current: null, // { instructionId, commentId, status, executionId, startedAt }
      lock: null, // { executionId, instructionId, commentId, acquiredAt }
      stopped: false,
      lastPollAt: null,
      lastError: null,
    };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  ensureRuntimeDir();
  const tmp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, STATE_PATH);
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

function firstLine(body) {
  return String(body || "")
    .split(/\r?\n/)
    .find((l) => l.trim().length > 0) || "";
}

function isIgnored(body) {
  const fl = firstLine(body);
  return IGNORE_PREFIXES.some((p) => fl.startsWith(p));
}

function parseActionable(body) {
  if (isIgnored(body)) return null;
  const m = String(body || "").match(ACTIONABLE);
  if (!m) return null;
  const kind = m[1];
  const instructionId = m[2];
  // Shared parkstery account: require Codex supervisor actor line on INSTRUCTION/STOP/CHECKPOINT
  const actorOk =
    /Actor:\s*Codex supervisor/i.test(body) ||
    (kind === "REVIEW-CHECKPOINT" && /Actor:\s*Codex supervisor/i.test(body));
  if (!actorOk) return null;
  return { kind, instructionId };
}

function acquireLock(state, item) {
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

function emitWake(payload) {
  // Sentinel for Cursor monitored-shell notify_on_output
  const line = `AGENT_LOOP_WAKE_pr5_supervisor ${JSON.stringify(payload)}`;
  process.stdout.write(`${line}\n`);
}

function pollOnce() {
  const state = loadState();
  state.lastPollAt = new Date().toISOString();
  state.lastError = null;

  if (state.stopped) {
    saveState(state);
    process.stdout.write(
      `pr5-watch: stopped=true (no wake). state=${STATE_PATH}\n`,
    );
    return { woke: false, reason: "stopped" };
  }

  let comments;
  try {
    comments = ghJson([
      "api",
      `repos/${REPO}/issues/${PR}/comments?per_page=100`,
      "--paginate",
    ]);
  } catch (e) {
    state.lastError = String(e && e.message ? e.message : e);
    saveState(state);
    process.stdout.write(`pr5-watch: poll error: ${state.lastError}\n`);
    return { woke: false, reason: "error" };
  }

  const processed = new Set(state.processedCommentIds || []);
  const candidates = [];
  for (const c of comments) {
    const id = String(c.id);
    if (processed.has(id)) continue;
    const author = c.user && c.user.login ? c.user.login : "";
    if (!ALLOWED_AUTHORS.has(author)) continue;
    const parsed = parseActionable(c.body || "");
    if (!parsed) continue;
    candidates.push({
      commentId: id,
      createdAt: c.created_at,
      author,
      kind: parsed.kind,
      instructionId: parsed.instructionId,
      url: c.html_url,
    });
  }

  // Chronological: oldest unprocessed first; STOP always preferred if present
  candidates.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const stop = candidates.find((x) => x.kind === "STOP");
  const next = stop || candidates[0];
  if (!next) {
    saveState(state);
    process.stdout.write(
      `pr5-watch: ok no-new lastPoll=${state.lastPollAt} processed=${processed.size}\n`,
    );
    return { woke: false, reason: "none" };
  }

  const lock = acquireLock(state, next);
  if (!lock.ok) {
    saveState(state);
    process.stdout.write(
      `pr5-watch: busy lock=${lock.lock.executionId} deferred=${next.instructionId}\n`,
    );
    return { woke: false, reason: "busy" };
  }

  if (next.kind === "STOP") {
    state.stopped = true;
    state.current.status = "stopped";
  }

  // Mark received so restart won't re-fire the same comment; runner advances status.
  if (!processed.has(next.commentId)) {
    state.processedCommentIds = [...processed, next.commentId];
  }
  saveState(state);

  const payload = {
    prompt:
      "PR #5 supervisor watch wake: read the new actionable comment, ACK if INSTRUCTION, honor STOP immediately, do not re-run processed IDs. State file under document/ops/ride-relay/supervisor-watch/runtime/state.json.",
    repo: REPO,
    pr: Number(PR),
    kind: next.kind,
    instructionId: next.instructionId,
    commentId: next.commentId,
    author: next.author,
    url: next.url,
    executionId: lock.lock.executionId,
    receivePath: "automatic-poll",
    statePath: STATE_PATH,
  };
  emitWake(payload);
  process.stdout.write(
    `pr5-watch: wake kind=${next.kind} id=${next.instructionId} comment=${next.commentId}\n`,
  );
  return { woke: true, next, executionId: lock.lock.executionId };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  process.stdout.write(
    `pr5-watch: start repo=${REPO} pr=${PR} interval=${INTERVAL_SEC}s once=${ONCE} state=${STATE_PATH}\n`,
  );
  // Seed: mark already-known historical instructions as processed so first boot
  // does not re-wake on -01..-05 / STOP / RESUME already ACKed in this session.
  const state = loadState();
  if (!state.bootstrapped) {
    try {
      const comments = ghJson([
        "api",
        `repos/${REPO}/issues/${PR}/comments?per_page=100`,
        "--paginate",
      ]);
      const ids = [];
      for (const c of comments) {
        const author = c.user && c.user.login ? c.user.login : "";
        if (!ALLOWED_AUTHORS.has(author)) continue;
        if (parseActionable(c.body || "") || isIgnored(c.body || "")) {
          ids.push(String(c.id));
        }
      }
      state.processedCommentIds = Array.from(
        new Set([...(state.processedCommentIds || []), ...ids]),
      );
      state.bootstrapped = true;
      state.bootstrappedAt = new Date().toISOString();
      // Active resume instruction already manually ACK'd — keep lock free for PROBE
      state.lock = null;
      state.current = {
        instructionId: "RTW-RESUME-20260910-01",
        commentId: "5612115646",
        kind: "INSTRUCTION",
        status: "running",
        executionId: "cursor-ide-grok-resume-20260910-01",
        startedAt: "2026-09-10T03:18:00Z",
      };
      state.stopped = false;
      saveState(state);
      process.stdout.write(
        `pr5-watch: bootstrap marked ${ids.length} historical comments processed\n`,
      );
    } catch (e) {
      process.stdout.write(`pr5-watch: bootstrap failed: ${e}\n`);
    }
  }

  for (;;) {
    pollOnce();
    if (ONCE) break;
    await sleep(INTERVAL_SEC * 1000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
