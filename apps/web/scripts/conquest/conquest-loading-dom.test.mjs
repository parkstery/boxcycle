import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createServer } = require('vite');
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));

// Only the repository boundary is replaced. The actual hook and React effects run.
const repoFixture = `
const subs=new Map(), pending=[], calls=[];
window.repo={calls,summary:(uid,value,fromCache=false)=>subs.get(uid)?.(value,fromCache),settle:(uid,marker)=>{
 for(const item of pending.filter(x=>x.uid===uid&&!x.done).slice(0,2)){item.done=true;item.resolve(item.kind==='cells'?new Map([[marker,'2026-11-19']]):[{id:marker,geometry:{type:'LineString',coordinates:[[127,37],[127,37.001]]},newMeters:10}]);}
}};
export function subscribeConquestSummary(uid,cb){subs.set(uid,cb);return()=>{if(subs.get(uid)===cb)subs.delete(uid);};}
export function subscribeRecentNewRoad(){return()=>{};}
function load(uid,kind){calls.push({uid,kind});return new Promise(resolve=>pending.push({uid,kind,resolve}));}
export function loadConquestCellDays(uid){return load(uid,'cells');}
export function loadConquestTraces(uid){return load(uid,'traces');}
export async function loadConquestRoadData(uid){const [cellDays,traces]=await Promise.all([load(uid,'cells'),load(uid,'traces')]);return {cellDays,traces};}
`;
const hookFixture = `
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useConquest} from '/src/hooks/useConquest.ts';
function Fixture(){const [uid,setUid]=useState('A'),[configured,setConfigured]=useState(true);
 const value=useConquest(uid?{uid}:null,configured);
 useEffect(()=>{window.hook={setUid,setConfigured};window.value=value;});
 return null;}
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
`;

test('actual useConquest waits for summary, shares pending reads and rejects stale account/revision results', { timeout: 90000 }, async () => {
  const server = await createServer({ root, configFile: false, logLevel: 'error',
    cacheDir: `${process.env.TEMP || '/tmp'}/vite-conquest-${process.pid}`,
    server: { host: '127.0.0.1', port: 0 }, plugins: [{
      name: 'conquest-repository-fixture', enforce: 'pre',
      resolveId(id, importer) {
        if (id === '/conquest-fixture.js') return '\0conquest-fixture';
        if (importer?.replaceAll('\\', '/').endsWith('/src/hooks/useConquest.ts') && id.includes('repo/firestoreConquest')) return '\0conquest-repo';
      },
      load(id) {
        if (id === '\0conquest-fixture') return hookFixture;
        if (id === '\0conquest-repo') return repoFixture;
      },
      configureServer(s) { s.middlewares.use(async (req, res, next) => {
        if (req.url !== '/conquest-fixture') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await s.transformIndexHtml('/conquest-fixture', '<html><div id="root"></div><script type="module" src="/conquest-fixture.js"></script></html>'));
      }); },
    }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/conquest-fixture`);
    await page.waitForFunction(() => window.hook);
    assert.deepEqual(await page.evaluate(() => window.repo.calls), [], 'no full reads while summary is unknown');
    await page.evaluate(() => window.repo.summary('A', null, true));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await page.evaluate(() => window.repo.calls), [], 'empty local cache is not a server-confirmed missing summary');
    await page.evaluate(() => window.repo.summary('A', { totalMeters: 100, totalCells: 1 }));
    await page.waitForFunction(() => window.repo.calls.length === 2);
    await page.evaluate(() => window.hook.setConfigured(false));
    await page.waitForFunction(() => window.value.cellIds === null && window.value.summary === null);
    await page.evaluate(() => window.hook.setConfigured(true));
    await page.waitForFunction(() => window.value.summary?.totalMeters === 100);
    assert.equal(await page.evaluate(() => window.repo.calls.length), 2, 'reconnecting the same pending revision shares both reads');
    await page.evaluate(() => window.repo.settle('A', 'A-first'));
    await page.waitForFunction(() => window.value.cellIds?.[0] === 'A-first');

    await page.evaluate(() => window.repo.summary('A', { totalMeters: 200, totalCells: 2 }));
    await page.waitForFunction(() => window.repo.calls.length === 4);
    await page.evaluate(() => window.repo.summary('A', { totalMeters: 300, totalCells: 3 }));
    await page.waitForFunction(() => window.repo.calls.length === 6);
    await page.evaluate(() => window.repo.settle('A', 'A-old-revision'));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await page.evaluate(() => window.value.cellIds), ['A-first'], 'late revision cannot overwrite the active revision');
    await page.evaluate(() => window.repo.settle('A', 'A-current'));
    await page.waitForFunction(() => window.value.cellIds?.[0] === 'A-current');
    await page.evaluate(() => window.repo.summary('A', { totalMeters: 400, totalCells: 4 }));
    await page.waitForFunction(() => window.repo.calls.length === 8);
    await page.evaluate(() => window.hook.setUid('B'));
    await page.waitForFunction(() => window.value.cellIds === null && window.value.traces === null);
    await page.evaluate(() => window.repo.settle('A', 'A-late'));
    assert.equal(await page.evaluate(() => window.value.cellIds), null, 'late A results never appear in B');
    assert.equal(await page.evaluate(() => window.repo.calls.length), 8, 'B waits for its own summary');
    await page.evaluate(() => window.repo.summary('B', null));
    await page.waitForFunction(() => window.repo.calls.length === 10);
    await page.evaluate(() => window.repo.settle('B', 'B-orphan'));
    await page.waitForFunction(() => window.value.traces?.[0]?.id === 'B-orphan');
    assert.deepEqual(await page.evaluate(() => window.value.cellIds), ['B-orphan'], 'missing summary still restores orphan data');
    await page.evaluate(() => window.repo.summary('B', { totalMeters: 0, totalCells: 0, roadSync: { schema: 1, epoch: 'before-reset', version: 1 } }));
    await page.waitForFunction(() => window.repo.calls.length === 12);
    await page.evaluate(() => window.repo.settle('B', 'B-before-reset'));
    await page.waitForFunction(() => window.value.cellIds?.[0] === 'B-before-reset');
    await page.evaluate(() => window.repo.summary('B', { totalMeters: 0, totalCells: 0, roadSync: { schema: 1, epoch: 'after-reset', version: 1 } }));
    await page.waitForFunction(() => window.repo.calls.length === 14);
    await page.evaluate(() => window.repo.settle('B', 'B-after-reset'));
    await page.waitForFunction(() => window.value.cellIds?.[0] === 'B-after-reset');
    assert.deepEqual(await page.evaluate(() => window.value.traces.map(t => t.id)), ['B-after-reset'], 'epoch change reloads even when totals and version are identical');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
