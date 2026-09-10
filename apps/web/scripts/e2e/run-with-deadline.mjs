#!/usr/bin/env node
/**
 * Outer hard-deadline wrapper for Playwright / emulator e2e attempts.
 *
 * Instruction RTW-PLAYWRIGHT-LIMIT-20260910-01:
 * - Wall-clock limit for one attempt (default 600s) includes server boot + browser wait + retries.
 * - Do not reset the budget by restarting the same attempt.
 * - On timeout: kill only this attempt's process tree; preserve logs; nonzero exit.
 *
 * Usage:
 *   node scripts/e2e/run-with-deadline.mjs [--limit-sec N] -- <command...>
 * Env:
 *   RTW_E2E_DEADLINE_SEC  default 600
 *   RTW_E2E_DEADLINE_LOG  optional path for timeout summary JSON
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  let limitSec = Number(process.env.RTW_E2E_DEADLINE_SEC || 600);
  const cmd = [];
  let seenSep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!seenSep && a === "--") {
      seenSep = true;
      continue;
    }
    if (!seenSep && (a === "--limit-sec" || a === "--limit")) {
      limitSec = Number(argv[++i]);
      continue;
    }
    if (!seenSep && a.startsWith("--limit-sec=")) {
      limitSec = Number(a.slice("--limit-sec=".length));
      continue;
    }
    if (seenSep) {
      cmd.push(a);
    }
  }
  // Compat: no `--` → entire argv is the command (no flags)
  if (!seenSep) {
    return {
      limitSec: Number(process.env.RTW_E2E_DEADLINE_SEC || 600),
      cmd: argv.slice(),
    };
  }
  return { limitSec, cmd };
}

function killTree(pid) {
  if (!pid || pid <= 0) return { ok: false, reason: "no-pid" };
  try {
    if (process.platform === "win32") {
      // timeout:6000 — prevent a hung taskkill from stalling the whole wrapper (Windows-verified).
      const r = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 6000,
      });
      return {
        ok: r.status === 0,
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        timedOut: r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM",
      };
    }
    // POSIX: kill process group (detached spawn). Cleanup verification is
    // Windows-verified in this test environment; POSIX path is unverified here.
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        return { ok: false, reason: "sigterm-failed" };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

// Windows-verified; POSIX: signal(0) probe is unverified in this environment.
function isPidAlive(pid) {
  if (!pid || pid <= 0) return false;
  if (process.platform === "win32") {
    const r = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    return r.stdout?.includes(String(pid)) ?? false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (info) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(info);
    };
    const timer = setTimeout(() => {
      finish({ timedOut: true, code: null, signal: null });
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      finish({ timedOut: false, code, signal });
    });
  });
}

const raw = process.argv.slice(2);
const { limitSec, cmd } = parseArgs(raw);
if (!cmd.length || !Number.isFinite(limitSec) || limitSec <= 0) {
  console.error(
    "Usage: node scripts/e2e/run-with-deadline.mjs [--limit-sec N] -- <command...>",
  );
  process.exit(2);
}

const startedAt = new Date();
const limitMs = Math.round(limitSec * 1000);
const commandLine = cmd.join(" ");

console.error(
  `[e2e-deadline] start limitSec=${limitSec} cmd=${commandLine} at=${startedAt.toISOString()}`,
);

// One shell string so nested quoted Playwright args survive (Windows npm scripts).
// POSIX: detached + new process group so -pid SIGTERM cleans descendants.
const child = spawn(commandLine, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: true,
  windowsHide: true,
  detached: process.platform !== "win32",
});

let settled = false;
let timedOut = false;

const timer = setTimeout(() => {
  timedOut = true;
  const endedAt = new Date();
  const elapsedMs = endedAt.getTime() - startedAt.getTime();
  console.error(
    `[e2e-deadline] TIMEOUT after ${elapsedMs}ms (limit ${limitMs}ms) — killing attempt pid=${child.pid}`,
  );
  const killResult = killTree(child.pid);
  console.error(`[e2e-deadline] killTree result=${JSON.stringify(killResult)}`);
  // Bounded cleanup: do not hang forever if child ignores signals.
  // Summary is written after waitForExit so pidAlive reflects post-kill state.
  waitForExit(child, 5000).then((info) => {
    // Windows-verified: assert attempt PID gone after tree-kill.
    // POSIX: signal(0) probe is unverified in this environment.
    const pidAlive = isPidAlive(child.pid);
    console.error(`[e2e-deadline] pidAlive=${pidAlive} after kill`);
    const summary = {
      status: "timeout",
      limitSec,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      elapsedMs,
      command: commandLine,
      pid: child.pid ?? null,
      killResult,
      pidAlive,
    };
    const logPath =
      process.env.RTW_E2E_DEADLINE_LOG ||
      path.join(HERE, "../../test-results/e2e-deadline-timeout.json");
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.writeFileSync(logPath, `${JSON.stringify(summary, null, 2)}\n`);
      console.error(`[e2e-deadline] wrote ${logPath}`);
    } catch (e) {
      console.error(`[e2e-deadline] log write failed: ${e}`);
    }
    if (info.timedOut) {
      console.error(`[e2e-deadline] child still alive after 5s — escalate SIGKILL/taskkill`);
      if (process.platform === "win32") {
        killTree(child.pid);
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          try {
            process.kill(child.pid, "SIGKILL");
          } catch {
            /* ignore */
          }
        }
      }
      waitForExit(child, 3000).then(() => process.exit(124));
    } else {
      process.exit(124);
    }
  });
}, limitMs);

child.on("exit", (code, signal) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  const endedAt = new Date();
  const elapsedMs = endedAt.getTime() - startedAt.getTime();
  if (timedOut) {
    console.error(
      `[e2e-deadline] child exited after timeout code=${code} signal=${signal} elapsedMs=${elapsedMs}`,
    );
    // exit handled by timeout path
    return;
  }
  console.error(
    `[e2e-deadline] done exit=${code ?? "null"} signal=${signal ?? "null"} elapsedMs=${elapsedMs}`,
  );
  process.exit(code ?? (signal ? 1 : 0));
});

child.on("error", (err) => {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.error(`[e2e-deadline] spawn error: ${err}`);
  process.exit(1);
});
