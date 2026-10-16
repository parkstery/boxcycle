import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDevTools, extractQueryKeys } from "../../../../scripts/check-dev-tools.mjs";

const NOW = new Date(2026, 9, 17);
const FIX = "dev-tools.json 에 등록하거나 지운다";

function passing() {
  return {
    world: {
      debugFiles: ["apps/web/src/lib/debug/synth-probe.ts"],
      queryKeys: ["synthlab", "synthtrail"],
      scripts: [
        "apps/web/scripts/synth/uncalled-tool.mjs",
        "scripts/synth-called-tool.mjs",
      ],
      calledScripts: ["scripts/synth-called-tool.mjs"],
      gitTrackedOut: [],
    },
    registry: {
      tools: [
        {
          id: "synth-probe",
          kind: "module",
          path: "apps/web/src/lib/debug/synth-probe.ts",
          class: "permanent",
          purpose: "합성",
          enable: "dev",
          bundle: "synth",
          added: "2026-10-17",
        },
        {
          id: "q-synthlab",
          kind: "query",
          key: "synthlab",
          class: "permanent",
          purpose: "합성",
          enable: "?synthlab=1",
          bundle: "synth",
          added: "2026-10-17",
        },
        {
          id: "q-synthtrail",
          kind: "query",
          key: "synthtrail",
          class: "product",
          purpose: "합성",
          enable: "?synthtrail=",
          bundle: "synth",
          added: "2026-10-17",
        },
        {
          id: "uncalled-tool",
          kind: "script",
          path: "apps/web/scripts/synth/uncalled-tool.mjs",
          class: "permanent",
          purpose: "합성",
          enable: "node uncalled-tool.mjs",
          bundle: "synth",
          added: "2026-10-17",
        },
      ],
    },
  };
}

function run(mutate) {
  const sample = passing();
  mutate(sample.world, sample.registry);
  return evaluateDevTools(sample.world, sample.registry, NOW);
}

describe("check-dev-tools 6조건", () => {
  it("1 debug 미등록은 실패, 등록하면 통과", () => {
    const bad = run((world, registry) => {
      world.debugFiles.push("apps/web/src/lib/debug/synth-missing.ts");
      registry.tools = registry.tools.filter((entry) => entry.kind !== "module");
    });
    assert.ok(bad.failures.some((line) => line.startsWith("FAIL debug 미등록") && line.includes(FIX)));
    const good = run(() => {});
    assert.deepEqual(good.failures, []);
  });

  it("2 query 미등록은 실패, 등록하면 통과", () => {
    const bad = run((world) => {
      world.queryKeys.push("synth-new");
    });
    assert.ok(bad.failures.some((line) => line.includes("FAIL query 미등록 synth-new") && line.includes(FIX)));
    const good = run(() => {});
    assert.deepEqual(good.failures, []);
  });

  it("3 안 불리는 스크립트 미등록은 실패, 등록하거나 불리면 통과", () => {
    const bad = run((_world, registry) => {
      registry.tools = registry.tools.filter((entry) => entry.kind !== "script");
    });
    assert.ok(bad.failures.some((line) => line.includes("FAIL script 미등록") && line.includes("uncalled-tool.mjs") && line.includes(FIX)));
    const registered = run(() => {});
    assert.deepEqual(registered.failures, []);
    const called = run((world, registry) => {
      registry.tools = registry.tools.filter((entry) => entry.kind !== "script");
      world.calledScripts.push("apps/web/scripts/synth/uncalled-tool.mjs");
    });
    assert.deepEqual(called.failures, []);
  });

  it("4 git 이 .out 을 추적하면 실패, 없으면 통과", () => {
    const bad = run((world) => {
      world.gitTrackedOut.push("document/ops/synth/.out/shot.png");
    });
    assert.ok(bad.failures.some((line) => line.includes("FAIL git 이 .out 을 추적") && line.includes(FIX)));
    const good = run(() => {});
    assert.deepEqual(good.failures, []);
  });

  it("5 없는 파일·키를 가리키면 실패, 있으면 통과", () => {
    const bad = run((_world, registry) => {
      registry.tools.push({
        id: "gone",
        kind: "module",
        path: "apps/web/src/lib/debug/synth-gone.ts",
        class: "permanent",
      });
    });
    assert.ok(bad.failures.some((line) => line.includes("FAIL 등록부 낡음 module gone") && line.includes(FIX)));
    const good = run(() => {});
    assert.deepEqual(good.failures, []);
  });

  it("6 temporary 만료 30일 초과는 실패, 30일 이내는 경고, 만료 전은 통과", () => {
    const expired = run((_world, registry) => {
      registry.tools.push({
        id: "old",
        kind: "query",
        key: "synthlab",
        class: "temporary",
        expires: "2026-09-16",
      });
    });
    assert.ok(expired.failures.some((line) => line.includes("FAIL temporary 만료 후 31일(30일 초과) id=old") && line.includes(FIX)));

    const warn = run((_world, registry) => {
      registry.tools.push({
        id: "recent",
        kind: "query",
        key: "synthtrail",
        class: "temporary",
        expires: "2026-09-17",
      });
    });
    assert.deepEqual(warn.failures, []);
    assert.equal(warn.warnings.length, 1);
    assert.ok(warn.warnings[0].startsWith("WARN temporary 만료 후 30일(30일 이내) id=recent"));
    assert.ok(!warn.warnings[0].includes("FAIL"));

    const fresh = run((_world, registry) => {
      registry.tools.push({
        id: "later",
        kind: "query",
        key: "synthlab",
        class: "temporary",
        expires: "2026-11-17",
      });
    });
    assert.deepEqual(fresh.failures, []);
    assert.deepEqual(fresh.warnings, []);
  });
});

describe("쿼리 키 수집", () => {
  it(".get 문자열과 QUERY_KEY 상수, QUERY_KEYS 배열을 모은다", () => {
    const source = `
      const TRAIL_QUERY_KEYS = ["trail", "room"] as const;
      export const MAP_CUT_QUERY_KEY = "mapcut";
      params.get(key);
      new URLSearchParams(search).get("perflab") === "1";
    `;
    assert.deepEqual(extractQueryKeys(source), ["mapcut", "perflab", "room", "trail"]);
  });
});
