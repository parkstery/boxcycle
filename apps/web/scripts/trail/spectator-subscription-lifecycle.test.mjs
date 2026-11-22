import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Actual hook and subscription hub; only the underlying Firestore listener is replaced.
const fixture = `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTrailLivePublicationRideSpectatorOverlay } from '/src/hooks/useTrailLivePublicationRideSpectatorOverlay.ts';
import { resetTrailLivePublicationRidesSubscriptionHubForTests } from '/src/lib/trail/repo/livePublicationRidesSubscriptionHub.ts';
const subscriptions = [];
resetTrailLivePublicationRidesSubscriptionHubForTests((trailId, onRows, onError, uid) => {
  const subscription = { trailId, uid, open: true, onError };
  subscriptions.push(subscription);
  onRows([]);
  return () => { subscription.open = false; };
});
const excludePeerIds = new Set();
const root = createRoot(document.getElementById('root'));
function Probe() {
  const [options, setOptions] = useState({ user: { uid: 'viewer-a' }, trailId: 'trail-a', enabled: true, revision: 0 });
  const view = useTrailLivePublicationRideSpectatorOverlay({ ...options, trailLabel: 'Trail', mapZoom: 12, excludePeerIds });
  useEffect(() => {
    window.spectatorProbe = {
      patch: patch => setOptions(previous => ({ ...previous, ...patch, revision: previous.revision + 1 })),
      snapshot: () => ({
        revision: options.revision, opens: subscriptions.length,
        closes: subscriptions.filter(row => !row.open).length,
        active: subscriptions.filter(row => row.open).map(({ trailId, uid }) => ({ trailId, uid })),
        error: view.error,
      }),
      fail: () => subscriptions.find(row => row.open)?.onError({ message: 'fixture listener error' }),
      unmount: () => root.unmount(),
    };
  });
  return null;
}
root.render(React.createElement(Probe));
`;

test('spectator backup survives same-UID auth refresh and releases only on subscription identity changes', { timeout: 60000 }, async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: `${process.env.TEMP || '/tmp'}/vite-spectator-lifecycle-${process.pid}`,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'spectator-lifecycle-test',
      resolveId(id) { return id === 'virtual:spectator-lifecycle' ? '\0spectator-lifecycle' : null; },
      load(id) { return id === '\0spectator-lifecycle' ? fixture : null; },
      configureServer(vite) {
        vite.middlewares.use('/__spectator-lifecycle', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end('<div id="root"></div><script type="module" src="/@id/virtual:spectator-lifecycle"></script>');
        });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const externalRequests = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto(`${origin}/__spectator-lifecycle`);
    await page.waitForFunction(() => window.spectatorProbe?.snapshot().opens === 1);
    const snapshot = () => page.evaluate(() => window.spectatorProbe.snapshot());
    async function patch(value) {
      const revision = (await snapshot()).revision;
      await page.evaluate(value => window.spectatorProbe.patch(value), value);
      await page.waitForFunction(revision => window.spectatorProbe.snapshot().revision > revision, revision);
    }

    await patch({ user: { uid: 'viewer-a' } });
    assert.equal((await snapshot()).opens, 1, 'same UID must not incur another initial query');
    assert.equal((await snapshot()).closes, 0, 'same UID must keep the backup listener available');
    await page.evaluate(() => window.spectatorProbe.fail());
    await page.waitForFunction(() => window.spectatorProbe.snapshot().error === 'fixture listener error');

    await patch({ trailId: 'trail-b' });
    assert.deepEqual((await snapshot()).active, [{ trailId: 'trail-b', uid: 'viewer-a' }]);
    assert.equal((await snapshot()).opens, 2);
    assert.equal((await snapshot()).closes, 1);
    await patch({ user: { uid: 'viewer-b' } });
    assert.deepEqual((await snapshot()).active, [{ trailId: 'trail-b', uid: 'viewer-b' }]);
    assert.equal((await snapshot()).opens, 3);
    assert.equal((await snapshot()).closes, 2);

    await patch({ enabled: false });
    assert.equal((await snapshot()).active.length, 0);
    await patch({ enabled: true });
    assert.equal((await snapshot()).opens, 4);
    await patch({ user: null });
    assert.equal((await snapshot()).active.length, 0, 'logout must release the previous viewer');
    await patch({ user: { uid: 'viewer-c' } });
    assert.equal((await snapshot()).opens, 5);
    await page.evaluate(() => window.spectatorProbe.unmount());
    assert.equal((await snapshot()).closes, 5, 'unmount must release the final listener');
    assert.deepEqual(externalRequests, [], 'the fixture must not request production services');
  } finally {
    await browser?.close();
    await server.close();
  }
});
