import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createServer } = require('vite');
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../..', import.meta.url));

test('real IndexedDB survives reload, isolates uid/environment, tolerates storage failure and clears on deletion', { timeout: 90000 }, async () => {
  const script = `
    import {roadCacheFor} from '/src/lib/conquest/repo/conquestRoadCache.ts';
    import {clearFirebaseAuthIndexedDb} from '/src/lib/identity/guestAccountReset.ts';
    window.cacheApi={a:roadCacheFor('production','A'),b:roadCacheFor('production','B'),emulator:roadCacheFor('emulator','A'),clear:clearFirebaseAuthIndexedDb};
  `;
  const server = await createServer({ root, configFile: false, logLevel: 'error',
    cacheDir: `${process.env.TEMP || '/tmp'}/vite-conquest-cache-${process.pid}`,
    server: { host: '127.0.0.1', port: 0 }, plugins: [{
      name: 'conquest-cache-fixture',
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url === '/cache-fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
        if (req.url !== '/cache-fixture') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<html><script type="module" src="/cache-fixture.js"></script></html>');
      }); },
    }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/cache-fixture`);
    await page.waitForFunction(() => window.cacheApi);
    await page.evaluate(() => window.cacheApi.a.writeCache({ uid: 'A', token: { schema: 1, epoch: 'first', version: 1 }, chunks: [], traces: [] }));
    await page.reload();
    await page.waitForFunction(() => window.cacheApi);
    const restored = await page.evaluate(async () => ({
      a: await window.cacheApi.a.readCache(), b: await window.cacheApi.b.readCache(), emulator: await window.cacheApi.emulator.readCache(),
    }));
    assert.equal(restored.a.token.version, 1);
    assert.equal(restored.a.token.epoch, 'first');
    assert.equal(restored.b, null);
    assert.equal(restored.emulator, null);
    await page.evaluate(async () => {
      Object.defineProperty(indexedDB, 'databases', { configurable: true, value: undefined });
      try { await window.cacheApi.clear(); }
      finally { delete indexedDB.databases; }
    });
    assert.equal(await page.evaluate(() => window.cacheApi.a.readCache()), null, 'successful account reset/deletion erases owned road cache');
    const failed = await page.evaluate(async () => {
      const actual = window.indexedDB;
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new DOMException('storage unavailable', 'QuotaExceededError'); } } });
      try {
        await window.cacheApi.a.writeCache({ uid: 'A', token: { schema: 1, epoch: 'quota', version: 1 }, chunks: [], traces: [] });
        return await window.cacheApi.a.readCache();
      } finally { Object.defineProperty(window, 'indexedDB', { configurable: true, value: actual }); }
    });
    assert.equal(failed, null, 'storage failure becomes a miss without breaking server data');
  } finally { await browser?.close(); await server.close(); }
});
