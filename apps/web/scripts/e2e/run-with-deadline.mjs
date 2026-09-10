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
import { spawn } from "node:child_process";
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
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          try {
            process.kill(pid, "SIGKILL");
          } catch {
            /* ignore */
          }
        }
      }, 2000).unref?.();
    }
  } catch {
    /* ignore */
  }
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

const child = spawn(cmd[0], cmd.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: true,
  windowsHide: true,
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
  const summary = {
    status: "timeout",
    limitSec,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    elapsedMs,
    command: commandLine,
    pid: child.pid ?? null,
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
  killTree(child.pid);
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
    process.exit(124);
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
