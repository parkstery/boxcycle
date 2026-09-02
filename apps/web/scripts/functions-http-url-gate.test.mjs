import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const allowedFile = path.join(webSrc, "lib", "functionsEmulatorUrl.ts");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("functions HTTP URL gate", () => {
  it("cloudfunctions.net 은 functionsEmulatorUrl.ts 에만 등장한다", () => {
    const hits = [];
    for (const file of walk(webSrc)) {
      if (path.resolve(file) === path.resolve(allowedFile)) continue;
      const body = readFileSync(file, "utf8");
      if (body.includes("cloudfunctions.net")) hits.push(path.relative(webSrc, file));
    }
    assert.deepEqual(
      hits,
      [],
      `cloudfunctions.net 하드코딩 금지 — functionsHttpUrl() 사용: ${hits.join(", ")}`,
    );
  });

  it("functionsEmulatorUrl.ts — functionsHttpUrl export", () => {
    const body = readFileSync(allowedFile, "utf8");
    assert.match(body, /export function functionsHttpUrl/);
    assert.match(body, /requireFunctionsEmulatorHostWhenEmulatorMode/);
    assert.match(body, /VITE_FUNCTIONS_EMULATOR_HOST 가 없습니다/);
  });
});
