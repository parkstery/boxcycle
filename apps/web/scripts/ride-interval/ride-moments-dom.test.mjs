import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const fixture = `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useRideInterval} from '/src/hooks/useRideInterval.ts';
import {useRideMoments} from '/src/hooks/useRideMoments.ts';
import {MapHud} from '/src/components/maphud/MapHud.tsx';
const no=()=>{};
const initial={status:'running',elapsedMs:0,routeMeters:5000,traveledMeters:0,waypointMeters:[],interval:null,newRoadKm:null,ended:null};
function App(){
 const [input,setInput]=useState(initial);
 const [useProgram,setProgram]=useState(false);
 const program=useRideInterval(input.status,input.elapsedMs,true,{warmupSec:0,highSec:5,lowSec:5,repeats:1,cooldownSec:0});
 const actual=useProgram?{...input,interval:program.view,intervalRunKey:program.runKey}:input;
 const event=useRideMoments(actual,false);
 useEffect(()=>{window.probe={patch:patch=>setInput(old=>({...old,...patch})),program:on=>setProgram(on),apply:program.onConfig,enable:program.onEnabled,event,runKey:program.runKey};});
 return React.createElement(React.Fragment,null,
   React.createElement('output',{id:'moment'},event?.kind??''),
   React.createElement(MapHud,{visible:true,stage:input.status==='idle'?'idle-map':input.status==='paused'?'paused':'riding',menuOpen:false,onOpenMenu:no,account:null,onOpenUserInfo:no,userInfoOpen:false,coachData:null,coachLineEnabled:false,metrics:null,onClearPins:no,routeError:null,onResumeFromPause:no,onEndFromPause:no,onModifyFromPause:no,rideInterval:actual.interval,rideMoments:{...actual,soundEnabled:false}}));
}
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));
`;

test('actual React hooks and MapHud handle StrictMode, transitions, stops and interval restarts', { timeout: 60000 }, async () => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'ride-moments-lifecycle-fixture', enforce: 'pre',
    resolveId(id) { if (id === '/moments-probe.js') return '\0moments-probe'; },
    load(id) { if (id === '\0moments-probe') return fixture; },
    configureServer(s) { s.middlewares.use(async (req, res, next) => {
      if (req.url !== '/moments-probe') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(await s.transformIndexHtml('/moments-probe', '<html><body><div id="root"></div><script type="module" src="/moments-probe.js"></script></body></html>'));
    }); },
  }] });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/moments-probe`);
    await page.waitForFunction(() => window.probe?.event?.kind === 'start');
    await page.clock.runFor(2500);
    await page.waitForFunction(() => document.querySelector('#moment').textContent === '');
    const view = (phase, remainingSec, nextLabel = '다음 · 운동 5초') => ({ phase, step: phase === 'work' ? 1 : 0, label: phase, remainingSec, repeat: 1, totalRepeats: 1, round: 1, totalRounds: 1, nextLabel });
    await page.evaluate(interval => window.probe.patch({ elapsedMs: 1000, interval, intervalRunKey: 'r1' }), view('warmup', 10));
    await page.waitForFunction(() => window.probe.event?.kind === 'intervalStart');
    await page.clock.runFor(2500);
    await page.evaluate(interval => window.probe.patch({ elapsedMs: 2000, interval }), view('warmup', 3));
    await page.waitForFunction(() => window.probe.event?.kind === 'intervalWarn');
    await page.evaluate(interval => window.probe.patch({ elapsedMs: 2500, interval }), view('work', 5));
    await page.waitForFunction(() => window.probe.event?.kind === 'intervalHigh');
    await page.evaluate(() => window.probe.patch({ status: 'paused' }));
    await page.waitForFunction(() => window.probe.event === null);
    await page.evaluate(() => window.probe.patch({ status: 'running', interval: null }));
    await page.evaluate(interval => window.probe.patch({ elapsedMs: 3000, interval, intervalRunKey: 'r2' }), view('warmup', 3));
    await page.waitForFunction(() => window.probe.event?.kind === 'intervalWarn');
    await page.evaluate(() => window.probe.patch({ status: 'idle', ended: { reason: 'stop', sessionKm: 1 } }));
    await page.waitForFunction(() => window.probe.event?.kind === 'stop');
    await page.evaluate(() => window.probe.patch({ elapsedMs: 3001 }));
    assert.equal(await page.locator('#moment').textContent(), 'stop');
    await page.clock.runFor(2500);
    await page.waitForFunction(() => window.probe.event === null);
    await page.evaluate(() => { window.probe.patch({ status: 'running', elapsedMs: 0, traveledMeters: 0, ended: null, interval: null }); window.probe.program(true); });
    await page.waitForFunction(() => window.probe.event?.kind === 'intervalStart');
    await page.clock.runFor(2500);
    await page.evaluate(() => window.probe.patch({ elapsedMs: 11000 }));
    await page.waitForFunction(() => window.probe.event === null);
    const before = await page.evaluate(() => window.probe.runKey);
    await page.evaluate(() => window.probe.apply({ warmupSec: 5, highSec: 5, lowSec: 5, repeats: 1, cooldownSec: 0 }));
    await page.waitForFunction(oldKey => window.probe.runKey !== oldKey, before);
    await page.waitForFunction(() => document.querySelector('.hud-coach--moment')?.getAttribute('data-moment') === 'intervalStart');
    await page.clock.runFor(2500);
    await page.evaluate(() => window.probe.patch({ elapsedMs: 13000 }));
    await page.waitForFunction(() => document.querySelector('.hud-coach--moment')?.getAttribute('data-moment') === 'intervalWarn');
    await page.evaluate(() => window.probe.apply({ warmupSec: 10, highSec: 5, lowSec: 5, repeats: 1, cooldownSec: 0 }));
    await page.waitForFunction(() => document.querySelector('.hud-coach--moment')?.getAttribute('data-moment') === 'intervalStart');
    await page.evaluate(() => window.probe.enable(false));
    await page.waitForFunction(() => !document.querySelector('.hud-coach--moment'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
