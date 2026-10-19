import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const source = ts.createSourceFile('App.tsx', fs.readFileSync(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration;
function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === 'handleServiceExit') declaration = n; ts.forEachChild(n, visit); }
visit(source);
assert.ok(declaration, 'actual App end-use handler must exist');
const javascript = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

for (const isAnonymous of [true, false]) {
  test(`${isAnonymous ? 'Guest' : 'Google'} end use preserves Firebase identity and cleans presence`, async () => {
    const events = [];
    const asyncEvent = name => async () => { events.push(name); };
    const context = vm.createContext({
      user: { uid: 'fixture-user', isAnonymous }, rideStatus: 'running', trailId: 'fixture-trail',
      setError: value => { if (value) events.push(`error:${value}`); }, setBusy: () => {},
      setRideStatus: () => {}, resetRide: () => events.push('resetRide'),
      deleteTrailPresence: asyncEvent('trail'), deleteGlobalLivePresence: asyncEvent('global'),
      BASIC_SHARED_HUB_IDS: ['p1'], deletePublicationSessionMember: asyncEvent('publication'),
      setBasicActiveHubCourseId: () => {}, reloadRecentSessionsFromLocalStorage: () => {},
      completeFirebaseSignOut: asyncEvent('signOut'),
      endAppUse: () => events.push('endAppUse'),
      setIntroDismissed: value => events.push(`introDismissed:${value}`),
      setEntryRequested: value => events.push(`entryRequested:${value}`),
      resetGuestAccount: async () => { events.push('deleteAccount'); return { deletedAuth: true }; },
      setUserSignedOutSessionFlag: () => {}, location: { reload: () => events.push('reload') },
    });
    await vm.runInContext(`${javascript}\nhandleServiceExit()`, context);
    assert.equal(events.filter(e => e === 'endAppUse').length, 1, events.join(','));
    assert.equal(events.filter(e => e === 'signOut').length, 0, events.join(','));
    assert.ok(!events.includes('deleteAccount'), 'logout must preserve account');
    assert.ok(!events.includes('reload'), 'logout must not reload');
    assert.ok(events.includes('trail') && events.includes('global') && events.includes('publication'));
    assert.ok(!events.some(e => e.startsWith('error:')), events.join(','));
    assert.ok(events.includes('introDismissed:false'));
    assert.ok(events.includes('entryRequested:false'));
  });
}
