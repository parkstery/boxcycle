import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("../../src/components/auth/AppIntroScreen.css", import.meta.url)),
  "utf8",
);

test("Chief 고정 — 인트로 Spinatlas 심벌은 반대 방향으로 3회 돌고 멈춘다", () => {
  assert.match(
    css,
    /\.app-intro__brand-svg\s*\{[^}]*animation:\s*spinatlas-mark-turn\s+3\.3s\s+cubic-bezier\(0\.22,\s*0\.61,\s*0\.36,\s*1\)\s+both;/s,
  );
  assert.match(
    css,
    /@keyframes\s+spinatlas-mark-turn\s*\{\s*from\s*\{\s*transform:\s*rotate\(1080deg\);\s*\}\s*to\s*\{\s*transform:\s*rotate\(0deg\);\s*\}\s*\}/s,
  );
});

test("모션 감소 설정에서는 인트로 심벌 회전을 끈다", () => {
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.app-intro__brand-svg\s*\{\s*animation:\s*none;\s*\}/,
  );
});
