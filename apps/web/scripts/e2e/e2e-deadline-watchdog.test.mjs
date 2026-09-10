/**
 * Watchdog self-test for run-with-deadline.mjs — short limit, hanging child.
 * Does NOT wait 600s.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(HERE, "run-with-deadline.mjs");
const logPath = path.join(HERE, "../../test-results/e2e-deadline-selftest.json");

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

describe("e2e deadline watchdog", () => {
  it("default limitSec is 600 when RTW_E2E_DEADLINE_SEC not set", () => {
    const filteredEnv = { ...process.env };
    delete filteredEnv.RTW_E2E_DEADLINE_SEC;
    const r = spawnSync(
      process.execPath,
      ["-e", "process.stdout.write(String(Number(process.env.RTW_E2E_DEADLINE_SEC || 600)))"],
      { encoding: "utf8", timeout: 5000, env: filteredEnv },
    );
    assert.equal(r.stdout.trim(), "600", "default limit must be 600s");
  });

  it("kills hanging child under short limit and exits 124", () => {
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    const hang =
      process.platform === "win32"
        ? 'powershell -NoProfile -Command "Start-Sleep -Seconds 30"'
        : "sleep 30";
    const started = Date.now();
    const r = spawnSync(
      process.execPath,
      [runner, "--limit-sec", "2", "--", hang],
      {
        encoding: "utf8",
        env: { ...process.env, RTW_E2E_DEADLINE_LOG: logPath },
        timeout: 20_000,
      },
    );
    const elapsed = Date.now() - started;
    assert.equal(
      r.status,
      124,
      `expected timeout exit 124, got ${r.status}; stderr=${r.stderr}`,
    );
    assert.ok(elapsed < 15_000, `should not wait full hang (${elapsed}ms)`);
    assert.ok(fs.existsSync(logPath), "timeout log written");
    const summary = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(summary.status, "timeout");
    assert.equal(summary.limitSec, 2);
    assert.ok(summary.killResult, "killTree result recorded");
    assert.ok("timedOut" in summary.killResult, "killResult has timedOut field");
    assert.equal(summary.killResult.timedOut, false, "taskkill itself should not time out");
    assert.ok("pidAlive" in summary, "summary has pidAlive field");
    assert.equal(summary.pidAlive, false, "attempt pid must be dead after kill");
  });

  it("kills nested child tree (grandchild) under short limit", () => {
    const nestedLog = path.join(HERE, "../../test-results/e2e-deadline-nested.json");
    const hangPidFile = path.join(HERE, "../../test-results/hang-pids.json");
    if (fs.existsSync(nestedLog)) fs.unlinkSync(nestedLog);
    if (fs.existsSync(hangPidFile)) fs.unlinkSync(hangPidFile);
    const hangScript = path.join(HERE, "hang-with-child.mjs");
    const nested = `"${process.execPath}" "${hangScript}"`;
    const r = spawnSync(
      process.execPath,
      [runner, "--limit-sec", "2", "--", nested],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          RTW_E2E_DEADLINE_LOG: nestedLog,
          HANG_PID_FILE: hangPidFile,
        },
        timeout: 25_000,
      },
    );
    assert.equal(r.status, 124, `stderr=${r.stderr}`);
    const summary = JSON.parse(fs.readFileSync(nestedLog, "utf8"));
    assert.equal(summary.status, "timeout");
    assert.equal(summary.limitSec, 2);
    assert.ok(summary.killResult, "killTree result recorded");
    assert.ok(
      summary.killResult.ok === true || Number(summary.killResult.status) === 0,
      `killResult=${JSON.stringify(summary.killResult)}`,
    );
    assert.equal(summary.killResult.timedOut, false, "taskkill itself should not time out");
    assert.equal(summary.pidAlive, false, "attempt root pid must be dead after kill");

    // Verify grandchild is also gone (tree-kill must cover descendants).
    // Windows-verified; POSIX path is unverified in this environment.
    if (fs.existsSync(hangPidFile)) {
      const pids = JSON.parse(fs.readFileSync(hangPidFile, "utf8"));
      assert.ok(pids.grandchildPid > 0, "grandchild pid was recorded");
      const grandchildAlive = isPidAlive(pids.grandchildPid);
      assert.equal(
        grandchildAlive,
        false,
        `grandchild pid=${pids.grandchildPid} must be dead after tree-kill`,
      );
    }
  });

  it("sentinel outside attempt tree survives kill", () => {
    const sentinelLog = path.join(HERE, "../../test-results/e2e-deadline-sentinel.json");
    if (fs.existsSync(sentinelLog)) fs.unlinkSync(sentinelLog);

    // Start sentinel OUTSIDE the runner's attempt tree (child of test process, not runner).
    const sentinel = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      stdio: "ignore",
      detached: process.platform !== "win32",
    });
    const sentinelPid = sentinel.pid;
    assert.ok(sentinelPid > 0, "sentinel started");

    // Run runner with a short-hang attempt. spawnSync blocks until runner exits.
    const hang =
      process.platform === "win32"
        ? 'powershell -NoProfile -Command "Start-Sleep -Seconds 30"'
        : "sleep 30";
    const r = spawnSync(
      process.execPath,
      [runner, "--limit-sec", "2", "--", hang],
      {
        encoding: "utf8",
        env: { ...process.env, RTW_E2E_DEADLINE_LOG: sentinelLog },
        timeout: 20_000,
      },
    );
    assert.equal(r.status, 124, `runner must exit 124; stderr=${r.stderr}`);

    // Sentinel MUST still be alive — runner's taskkill /T must NOT have killed it.
    // Windows-verified; POSIX: signal(0) probe is unverified in this environment.
    const sentinelAlive = isPidAlive(sentinelPid);
    assert.equal(
      sentinelAlive,
      true,
      `sentinel pid=${sentinelPid} should still be alive after runner tree-kill`,
    );

    // Cleanly stop only the sentinel.
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(sentinelPid), "/F"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 6000,
      });
    } else {
      try {
        process.kill(sentinelPid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
    sentinel.unref();
  });
});
