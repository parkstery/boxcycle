import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

test('actual interval hook keeps execution, UI clock, batched config, owner and final sample consistent', { timeout: 90000 }, async t => {
  const server = await createServer({ cacheDir: `${process.env.TEMP || '/tmp'}/vite-interval-hook-${process.pid}`, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const base = `http://127.0.0.1:${server.httpServer.address().port}/scripts/ride-interval/interval-workout-hook-fixture.html`;
    async function open(query = '') {
      const page = await browser.newPage();
      await page.goto(base + query);
      await page.waitForFunction(() => window.intervalHookProbe);
      return page;
    }
    async function tick(page, elapsedMs, activeSec) {
      await page.evaluate(patch => window.intervalHookProbe.patch(patch), { elapsedMs, activeSec });
      await page.waitForFunction(ms => window.intervalHookProbe.state.elapsedMs === ms, elapsedMs);
      await page.evaluate(() => window.intervalHookProbe.sample());
    }
    async function start(page) {
      await page.evaluate(() => window.intervalHookProbe.patch({ status: 'running' }));
      await page.waitForFunction(() => window.intervalHookProbe.view !== null);
    }
    await t.test('pause and resume preserve one execution and finish includes final unsampled step', async () => {
      const page = await open();
      try {
        await start(page); await tick(page, 5000, 5);
        await page.evaluate(() => window.intervalHookProbe.patch({ status: 'paused' }));
        await page.waitForFunction(() => window.intervalHookProbe.state.status === 'paused');
        await page.evaluate(() => window.intervalHookProbe.sample());
        await page.evaluate(() => window.intervalHookProbe.patch({ status: 'running' }));
        await page.waitForFunction(() => window.intervalHookProbe.state.status === 'running');
        await tick(page, 10000, 10);
        await page.evaluate(() => window.intervalHookProbe.patch({ elapsedMs: 12000, activeSec: 12 }));
        await page.waitForFunction(() => window.intervalHookProbe.state.elapsedMs === 12000);
        const records = await page.evaluate(() => window.intervalHookProbe.finish());
        assert.equal(records.length, 1); assert.equal(records[0].elapsedSec, 12);
        assert.equal(records[0].activeSec, 12); assert.equal(records[0].phaseSeconds.work, 10);
        assert.equal(records[0].phaseSeconds.recovery, 2);
      } finally { await page.close(); }
    });
    await t.test('config, intensity and enabling in one event retain all selected values', async () => {
      const page = await open();
      try {
        const next = { highSec: 15, lowSec: 5, repeats: 2, warmupSec: 0, cooldownSec: 0, rounds: 1, roundRestSec: 0 };
        await page.evaluate(next => window.intervalHookProbe.batch(next, 'vigorous', true), next);
        await page.waitForFunction(() => window.intervalHookProbe.config.highSec === 15 && window.intervalHookProbe.selectedIntensity === 'vigorous' && window.intervalHookProbe.enabled);
        await start(page); await tick(page, 20000, 20);
        const records = await page.evaluate(() => window.intervalHookProbe.finish());
        assert.equal(records.length, 1); assert.equal(records[0].intensity, 'vigorous');
        assert.equal(records[0].config.highSec, 15); assert.equal(records[0].plannedSec, 40);
      } finally { await page.close(); }
    });
    await t.test('owner switch clears previous execution and disables interval', async () => {
      const page = await open();
      try {
        await start(page); await tick(page, 5000, 5);
        await page.evaluate(() => window.intervalHookProbe.patch({ ownerUid: 'interval-hook-b' }));
        await page.waitForFunction(() => window.intervalHookProbe.state.ownerUid === 'interval-hook-b' && !window.intervalHookProbe.enabled);
        assert.deepEqual(await page.evaluate(() => window.intervalHookProbe.finish()), []);
      } finally { await page.close(); }
    });
    await t.test('changing intensity restarts UI and execution at the same Ride time', async () => {
      const page = await open();
      try {
        await start(page); await tick(page, 5000, 5);
        await page.evaluate(() => window.intervalHookProbe.intensity('light'));
        await page.waitForFunction(() => window.intervalHookProbe.selectedIntensity === 'light');
        assert.equal(await page.evaluate(() => window.intervalHookProbe.view.elapsedMs), 0);
        await tick(page, 25000, 25);
        const records = await page.evaluate(() => window.intervalHookProbe.finish());
        assert.equal(records.length, 2); assert.equal(records[0].status, 'reconfigured');
        assert.equal(records[0].elapsedSec, 5); assert.equal(records[1].status, 'completed');
        assert.equal(records[1].startElapsedSec, 5); assert.equal(records[1].elapsedSec, 20);
        assert.equal(records[1].intensity, 'light');
      } finally { await page.close(); }
    });
    await t.test('StrictMode initial running mount does not retain phantom zero-second execution', async () => {
      const page = await open('?running=1');
      try {
        await tick(page, 5000, 5);
        const records = await page.evaluate(() => window.intervalHookProbe.finish());
        assert.equal(records.length, 1); assert.equal(records[0].elapsedSec, 5);
      } finally { await page.close(); }
    });
  } finally {
    await browser?.close();
    await server.close();
  }
});
