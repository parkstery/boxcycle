import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { createServer } = require("vite");
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = `
import React,{useState,useEffect} from "react";
import {createRoot} from "react-dom/client";
import {useRecentRoadDisplay} from "/src/hooks/useRecentRoadDisplay.ts";
import {MapViewSheet} from "/src/components/map/MapViewSheet.tsx";
const route={type:"LineString",coordinates:[[127,37.5],[127,37.502]]};
function App(){
 const [input,setInput]=useState({uid:"a",active:false,persisted:null,cellIds:[],route,traveled:120,from:0,ended:null});
 const [mode,setMode]=useState("all");
 const display=useRecentRoadDisplay(input);
 useEffect(()=>{window.api={setInput:(patch)=>setInput(s=>({...s,...patch})),result:display.onResult,timeout:display.onTimeout};window.shown=display.geometry;window.mode=mode;});
 const noop=()=>{};
 return React.createElement(MapViewSheet,{open:true,onClose:noop,
 coverageOverlayMode:"off",onCoverageOverlayMode:noop,enable3D:false,onEnable3D:noop,
 rideActive:input.active,rideCameraDistanceM:50,onRideCameraDistanceM:noop,
 conquestDisplayMode:mode,conquestHasRecentGeometry:display.geometry.length>0,onConquestDisplayMode:setMode,onShowAllConquest:noop});
}
createRoot(document.getElementById("root")).render(React.createElement(React.StrictMode,null,React.createElement(App)));
`;
test("actual React hook and map sheet retain end-of-ride roads at phone landscape sizes", { timeout: 60000 }, async () => {
  const server = await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0 }, plugins: [{
    name: "recent-road-test", enforce: "pre",
    resolveId(id) { if (id === "/recent-fixture.js") return "\0recent-fixture"; },
    load(id) { if (id === "\0recent-fixture") return fixture; },
    configureServer(s) { s.middlewares.use(async (req,res,next) => {
      if (req.url !== "/recent-fixture") return next();
      res.setHeader("Content-Type","text/html");
      res.end(await s.transformIndexHtml("/recent-fixture", '<html><body><div id="root"></div><script type="module" src="/recent-fixture.js"></script></body></html>'));
    }); },
  }] });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: "msedge", headless: true });
    for (const width of [667,844]) {
      const page = await browser.newPage({ viewport: { width, height: 390 } });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/recent-fixture`);
      await page.waitForFunction(() => window.api);
      const recent = page.getByRole("button", { name: "신규 도로만", exact: true });
      assert.equal(await recent.isEnabled(), false);
      await page.evaluate(() => window.api.setInput({ active: true }));
      await page.waitForFunction(() => window.shown.length > 0);
      await page.evaluate(() => window.api.setInput({ active: false, route: null, traveled: 0, ended: { recordId: "r1", endedAtIso: new Date().toISOString(), sessionPathLngLat: [[127,37.5],[127,37.502]] } }));
      await page.waitForFunction(() => window.shown.length > 0);
      await recent.click();
      await page.waitForFunction(() => window.mode === "recent");
      await page.evaluate(() => window.api.result("r1", { status: "positive", newMeters: 70 }));
      await page.evaluate(() => window.api.setInput({ ended: null, persisted: null }));
      await page.waitForFunction(() => window.shown.length > 0);
      assert.equal(await recent.isEnabled(), true);
      await page.evaluate(() => window.api.setInput({ uid: "b" }));
      await page.waitForFunction(() => window.shown.length === 0);
      assert.equal(await recent.isEnabled(), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser?.close(); await server.close(); }
});
