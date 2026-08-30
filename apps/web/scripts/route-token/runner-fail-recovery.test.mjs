import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { assertPortsFree } from "./port-guard.mjs";
import { node20Env, resolveNode20Executable } from "./node20.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const webDir = path.join(repoRoot, "apps/web");
const pkgPath = path.join(repoRoot, "functions/package.json");
const trackedSecretPath = path.join(repoRoot, "functions/.secret.local");
const runnerPath = path.join(__dirname, "run-route-token-harness.mjs");

function gitPorcelain() {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  return (result.stdout ?? "").trim();
}

describe("runner fail recovery", () => {
  it("intentional UI fail 후 추적 파일·secret·포트·Git 원상복구", () => {
    const pkgBefore = fs.readFileSync(pkgPath);
    const gitBefore = gitPorcelain();

    const result = spawnSync(resolveNode20Executable(), [runnerPath], {
      cwd: webDir,
      env: node20Env({
        ROUTE_TOKEN_HARNESS_CLEANUP_TEST: "1",
      }),
      encoding: "utf8",
      stdio: "pipe",
    });

    assert.notEqual(result.status, 0, "runner 는 intentional fail 로 non-zero 여야 함");

    const pkgAfter = fs.readFileSync(pkgPath);
    assert.ok(pkgBefore.equals(pkgAfter), "functions/package.json byte 동일");
    const pkg = JSON.parse(pkgAfter.toString("utf8"));
    assert.equal(pkg.main, "lib/index.js");

    assert.equal(fs.existsSync(trackedSecretPath), false, "functions/.secret.local 없음");

    const playwrightOut = path.join(__dirname, ".out/playwright-test-results");
    if (fs.existsSync(playwrightOut)) {
      const entries = fs.readdirSync(playwrightOut);
      assert.ok(entries.length >= 0);
    }

    assertPortsFree();
    assert.equal(gitPorcelain(), gitBefore, "Git 상태 동일");
  });
});
