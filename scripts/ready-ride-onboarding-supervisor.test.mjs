import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real repository subscription callback through SDK boundary stubs.
const file = new URL('../apps/web/src/lib/account/repo/firestoreRouteToken.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test('pre-grant Auth metadata stays unknown; actual zero still blocks and grant becomes visible', () => {
  let snapshot;
  const balances = [];
  const bridge = [];
  const exports = {};
  const require = (name) => {
    if (name === 'firebase/firestore') return {
      doc: () => ({}),
      onSnapshot: (_doc, callback) => { snapshot = callback; return () => {}; },
    };
    if (name.endsWith('/firebase/app')) return { getFirebaseFirestore: () => ({}) };
    if (name.endsWith('/firebase/functionsEmulatorUrl')) return {};
    if (name.endsWith('/debug/visibilityReadMeters')) return { trackVisibilityListener: (_name, unsub) => unsub };
    if (name.endsWith('/routeTokenSpendBridge')) return {
      bindRouteTokenUser: () => {},
      setSubscribedRouteTokenBalance: (_uid, balance) => bridge.push(balance),
    };
    throw new Error(`Unexpected import: ${name}`);
  };
  // No import.meta-dependent HTTP method is invoked in this callback test.
  new Function('require', 'exports', compiled.replaceAll('import.meta.env', '({})'))(require, exports);
  const unsub = exports.subscribeRouteTokenBalance('demo-test', b => balances.push(b));
  for (const data of [{ isAnonymous: true }, { routeTokenBalance: 0 }, { routeTokenBalance: 10 }]) {
    snapshot({ exists: () => true, data: () => data });
  }
  assert.deepEqual(balances, [null, 0, 10]);
  assert.deepEqual(bridge, [null, 0, 10]);
  unsub();
});
