import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
const ts = createRequire(import.meta.url)("typescript");

test("production rider render skips pose and draw with riders cut and preserves normal rendering otherwise", () => {
  const text = readFileSync(new URL("../../src/lib/map/riderPreservedLayer.ts", import.meta.url), "utf8");
  const source = ts.createSourceFile("layer.ts", text, ts.ScriptTarget.Latest, true);
  let method;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === "render") method = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(method);
  let cut = true, draws = 0;
  const observations = [];
  const context = {
    isMapCutKeyActive: key => { assert.equal(key, "riders"); return cut; },
    isPerfLabEnabled: () => true,
    noteRenderingDiagnostic: (...args) => observations.push(args),
    installRiderRenderCostProbe: () => {},
    shouldAnimateRiderPose: () => false,
    isRiderSwayDisabledByQuery: () => false,
    performance: { now: () => 0 },
    measureRiderRenderFrame: (_count, run) => { draws++; run(); },
    // The sentinel proves normal rendering reaches the draw path. Cut must not touch it.
  };
  const render = runInNewContext(ts.transpileModule(`({${method.getText(source)}}).render`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const layer = { map: { getZoom: () => 18, getTerrain: () => null }, rig: {}, specs: [{}],
    renderer: { resetState: () => { throw Error("draw-path"); } }, lod2State: "ready" };
  render.call(layer, {}, []);
  assert.equal(draws, 0);
  assert.equal(observations.at(-1)[1], "skipped-by-mapcut");
  cut = false;
  assert.throws(() => render.call(layer, {}, []), /draw-path/);
  assert.equal(draws, 1);
  assert.equal(observations.at(-1)[1], "enabled");
});
