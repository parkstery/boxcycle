/**
 * 1번 카메라(내려다보기)에서도 내 이름표가 보인다 (2026-10-09 Chief, 10-08 「숨김」 대체).
 * 내 점 아래·파란 알약 — 동행 이름표(점 옆·글자만)와 구분.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(fileURLToPath(new URL("../../src/components/map/MapView.css", import.meta.url)), "utf8");

/** `selector {` 로 시작하는 규칙 본문들 — 선택자에 flat·live 가 함께 든 것 */
function flatLiveRules(): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
    const sel = m[1];
    if (sel.includes("glb-nametag-host--flat") && sel.includes("glb-nametag-host--live")) out.push(m[2]);
  }
  return out;
}

test("내려다보는 화면에서 내 이름표를 숨기지 않는다", () => {
  const rules = flatLiveRules();
  assert.ok(rules.length > 0, "flat·live 규칙을 찾지 못함 — 선택자가 바뀌었으면 이 시험을 따라 고칠 것");
  for (const body of rules) {
    assert.doesNotMatch(body, /visibility:\s*hidden|display:\s*none|opacity:\s*0[;\s]/);
  }
});

test("내 이름표는 점 아래로 내려가고 배경을 채운다", () => {
  const body = flatLiveRules().join("\n");
  assert.match(body, /transform:\s*translateY\(calc\(100% \+/);
  assert.match(body, /background:\s*#1d4ed8/);
});
