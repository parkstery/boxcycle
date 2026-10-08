import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pacerDir = path.join(webRoot, "src/lib/ride/pacer");
const peerDir = path.join(webRoot, "src/lib/peerMotion");

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  const bareRe = /\bimport\s+["']([^"']+)["']/g;
  const dynRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [fromRe, bareRe, dynRe]) {
    for (const match of source.matchAll(re)) {
      if (match[1]) specs.push(match[1]);
    }
  }
  return specs;
}

function forbiddenImport(spec: string): string | null {
  const norm = spec.replaceAll("\\", "/");
  if (norm === "react" || norm.startsWith("react/") || norm.includes("/react")) return "react";
  if (norm.includes("firebase")) return "firebase";
  if (norm.includes("peerMotion")) return "peerMotion";
  if (norm === "trail" || norm.includes("/trail")) return "trail";
  return null;
}

describe("pacer isolation", () => {
  it("겨누는 디렉터리가 비어 있지 않다", () => {
    const pacerFiles = walkFiles(pacerDir).filter((f) => f.endsWith(".ts"));
    const peerFiles = walkFiles(peerDir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    assert.ok(pacerFiles.length > 0, "src/lib/ride/pacer 파일이 없다");
    assert.ok(peerFiles.length > 0, "src/lib/peerMotion 파일이 없다");
  });

  it("pacer 모듈 import 에 firebase·peerMotion·trail·react 가 없다", () => {
    const files = walkFiles(pacerDir).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const specs = importSpecifiers(readFileSync(file, "utf8"));
      for (const spec of specs) {
        const hit = forbiddenImport(spec);
        assert.equal(hit, null, `${path.relative(webRoot, file)} imports ${spec} (${hit})`);
      }
    }
  });

  it("peerMotion 소스에 pacer 문자열이 없다", () => {
    const files = walkFiles(peerDir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("pacer"), false, path.relative(webRoot, file));
    }
  });
});
