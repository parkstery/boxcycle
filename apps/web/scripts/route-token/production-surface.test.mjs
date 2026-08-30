import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const prodIndex = path.join(repoRoot, "functions/lib/index.js");
const harnessIndex = path.join(repoRoot, "functions/lib/index.harness.js");
const prodSource = path.join(repoRoot, "functions/src/index.ts");

describe("production functions surface", () => {
  it("lib/index.js — routeTokenHarnessControl 미포함", () => {
    const body = readFileSync(prodIndex, "utf8");
    assert.equal(body.includes("routeTokenHarnessControl"), false);
  });

  it("lib/index.harness.js — routeTokenHarnessControl 포함", () => {
    const body = readFileSync(harnessIndex, "utf8");
    assert.equal(body.includes("routeTokenHarnessControl"), true);
  });

  it("src/index.ts — routeTokenHarnessControl export 없음", () => {
    const body = readFileSync(prodSource, "utf8");
    assert.equal(/export\s*\{[^}]*routeTokenHarnessControl/.test(body), false);
    assert.equal(body.includes('from "./routeTokenHarnessControl'), false);
  });
});
