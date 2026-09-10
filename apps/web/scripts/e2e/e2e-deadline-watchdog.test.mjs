/**
 * Watchdog self-test for run-with-deadline.mjs — short limit, hanging child.
 * Does NOT wait 600s.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(HERE, "run-with-deadline.mjs");
const logPath = path.join(HERE, "../../test-results/e2e-deadline-selftest.json");

describe("e2e deadline watchdog", () => {
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
    assert.equal(r.status, 124, `expected timeout exit 124, got ${r.status}; stderr=${r.stderr}`);
    assert.ok(elapsed < 15_000, `should not wait full hang (${elapsed}ms)`);
    assert.ok(fs.existsSync(logPath), "timeout log written");
    const summary = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(summary.status, "timeout");
    assert.equal(summary.limitSec, 2);
  });
});
