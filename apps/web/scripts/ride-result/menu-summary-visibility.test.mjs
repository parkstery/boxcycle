import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const ts = createRequire(import.meta.url)('typescript');
const source = ts.createSourceFile('App.tsx', readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'edgePanelHandlesVisible') expression = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(expression);
const base = {
  authInitialized: true, user: {}, summaryVisible: false, summarySheetVisible: true,
  showAppIntro: false, entryLocationPrompt: false, needsGuestEntry: false, needsAuthCard: false,
  needsNicknameCard: false, placeSearchOpen: false, userInfoSheetOpen: false, rideSettingsSheetOpen: false,
  rideIntervalSettingsOpen: false, cadenceSensorSheetOpen: false, publicRouteRequestModalRoute: null, profileEditOpen: false,
};
test('메뉴는 실제 결과창이 닫혔으면 내부 플래그가 남아도 보인다', () => {
  assert.equal(runInNewContext(expression, base), true);
  assert.equal(runInNewContext(expression, {...base, summaryVisible: true}), false);
  assert.equal(runInNewContext(expression, {...base, placeSearchOpen: true}), false);
});
