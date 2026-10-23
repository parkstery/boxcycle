import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { getDistanceMeters } from "../../src/lib/geo/geo.ts";
import { resolveEntryLocationFlightMs } from "../../src/lib/map/mapBootCenter.ts";
const source=ts.createSourceFile("MapView.tsx",readFileSync("src/components/map/MapView.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function effect(deps){
 let found;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==="useEffect"&&n.arguments[1]?.getText(source).replaceAll(" ","")===deps)found=n.arguments[0];ts.forEachChild(n,visit);}
 visit(source);assert.ok(found,deps);
 return ts.transpileModule("export default ("+found.getText(source)+")",{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("export default ", "").replace(/;\s*$/,"");
}
const updateEffect=effect("[bootFlyTarget]");
const flyEffect=effect("[mapLoaded,bootFlyHold,bootFlyTarget]");
const fixture = `
import React,{useEffect,useRef,useState} from "react";import mapboxgl from "mapbox-gl";import "mapbox-gl/dist/mapbox-gl.css";import {createRoot} from "react-dom/client";
import {EntryLocationDialog} from "/src/components/auth/EntryLocationDialog.tsx";
import {useEntryLocation} from "/src/hooks/useEntryLocation.ts";
import {apply3DState} from "/src/components/map/rideCameraFollow.ts";
import {getDistanceMeters} from "/src/lib/geo/geo.ts";
import {resolveEntryLocationFlightMs} from "/src/lib/map/mapBootCenter.ts";
function App(){
 const e=useEntryLocation(true);
 const mapRef=useRef(null),bootFlyTargetRef=useRef(null),bootFlyMovedRef=useRef(false),bootFlyBypassZoomGuardRef=useRef(false);
 const [mapLoaded,setLoaded]=useState(false);
 const bootFlyTarget=e.target,bootFlyHold=e.phase!=="ready";
 const getReducedMotionSnapshot=()=>false;
 const suppressCameraFollowUntilRef=useRef(0);
 const BOOT_GLOBE_ZOOM=0.6,BOOT_GLOBE_PAUSE_MS=600,BOOT_GLOBE_FLY_MS=3500;
 useEffect(()=>{const map=new mapboxgl.Map({container:"map",style:{version:8,sources:{},layers:[{id:"bg",type:"background",paint:{"background-color":"#223344"}}]},center:[12.4905,41.8902],zoom:15});
 mapRef.current=map;window.initialCamera={center:map.getCenter().toArray(),zoom:map.getZoom()};bootFlyTargetRef.current={center:[12.4905,41.8902],zoom:15};
 map.on("movestart",()=>{window.flight={started:performance.now(),samples:[]};});
 map.on("move",()=>{if(window.flight)window.flight.samples.push({ms:performance.now()-window.flight.started,center:map.getCenter().toArray(),zoom:map.getZoom()});});
 map.on("moveend",()=>{if(window.flight)window.flight.elapsedMs=performance.now()-window.flight.started;});
 map.on("load",()=>setLoaded(true));map.on("moveend",()=>{window.camera={center:map.getCenter().toArray(),zoom:map.getZoom()};});
 return()=>map.remove();},[]);
 useEffect(()=>{window.state=e;});
 useEffect(${updateEffect},[bootFlyTarget]);
 useEffect(${flyEffect},[mapLoaded,bootFlyHold,bootFlyTarget]);
 useEffect(()=>{if(mapLoaded)apply3DState(mapRef.current,false,"buildings","terrain");},[mapLoaded]);
 return React.createElement(EntryLocationDialog,{phase:e.phase,permission:e.permission,onChooseCurrent:e.chooseCurrent,onChooseRome:e.chooseRome,onPosition:e.acceptPosition});
}
createRoot(document.getElementById("root")).render(React.createElement(App));`;
test("first control directly requests browser location", {timeout:60000}, async()=>{
 const server=await createServer({server:{host:"127.0.0.1",port:0},plugins:[{name:"entry-test",resolveId(id){if(id==="/fixture.js")return "\0entry-fixture";},load(id){if(id==="\0entry-fixture")return fixture;},configureServer(s){s.middlewares.use(async(req,res,next)=>{

 if(req.url!=="/fixture")return next();
 res.setHeader("Content-Type","text/html");res.end(await s.transformIndexHtml("/fixture",'<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="map" style="position:fixed;inset:0"></div><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'));
 });}}]});
 let browser;try{
 await server.listen();const base="http://127.0.0.1:"+server.httpServer.address().port;
 browser=await chromium.launch({channel:process.env.ENTRY_LOCATION_TEST_BROWSER ?? "msedge",headless:true});
 const context=await browser.newContext({viewport:{width:667,height:300},permissions:["geolocation"],geolocation:{longitude:126.978,latitude:37.5665}});
 const page=await context.newPage();page.on("pageerror",e=>console.log("pageerror",e.message));
 await page.addInitScript(()=>{Object.defineProperty(navigator,"permissions",{value:{query:()=>Promise.resolve({state:"prompt"})},configurable:true});});
 await page.goto(base+"/fixture");await page.waitForFunction(()=>window.state?.phase==="choice");
 assert.equal(await page.getByText("위치 공유를 허용하시겠어요?").count(),0);
 const control=page.getByRole("button",{name:"내 위치",exact:true});await control.waitFor();
 assert.equal(await control.innerText(),"내 위치");
 assert.equal(await page.evaluate(()=>window.state.target),null);
 assert.deepEqual(await page.evaluate(()=>window.initialCamera),{center:[12.4905,41.8902],zoom:15});

 for(const width of [740,667]){
  await page.setViewportSize({width,height:300});
  const rect=await control.boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=300);
 }

 const dir=resolve(process.env.RTW_ENTRY_LOCATION_EVIDENCE_DIR || "test-results/entry-location-dom");mkdirSync(dir,{recursive:true});
 await page.screenshot({path:resolve(dir,"12-rome-initial-667x300.png")});
 await page.waitForTimeout(1000);
 await control.click();await page.waitForFunction(()=>window.state?.phase==="ready",{},{timeout:10000});
 assert.deepEqual(await page.evaluate(()=>window.state.target.center),[126.978,37.5665]);
 await page.waitForFunction(()=>window.camera&&Math.abs(window.camera.center[0]-126.978)<0.0001&&Math.abs(window.camera.center[1]-37.5665)<0.0001&&Math.abs(window.camera.zoom-15)<0.01,{},{timeout:12000});
 const flight=await page.evaluate(()=>window.flight);
 const requestedMs=resolveEntryLocationFlightMs(getDistanceMeters([12.4905,41.8902],[126.978,37.5665]));
 assert.ok(requestedMs<=5000, `requested ${requestedMs}`);
 assert.ok(flight.elapsedMs>=requestedMs-300&&flight.elapsedMs<=5400,JSON.stringify({requestedMs,elapsedMs:flight.elapsedMs}));
 assert.ok(flight.samples.length>=5,"intermediate camera samples");
 const minimumZoom=Math.min(...flight.samples.map(s=>s.zoom));
 assert.ok(minimumZoom<6,"long distance flight must zoom out high");
 const low=flight.samples.findIndex(s=>s.zoom===minimumZoom);
 assert.ok(low>0&&low<flight.samples.length-1,"ascent then descent");
 assert.ok(flight.samples.slice(0,low).some(s=>s.zoom>minimumZoom+1));
 assert.ok(flight.samples.slice(low+1).some(s=>s.zoom>minimumZoom+1));
 assert.ok(flight.samples.some(s=>s.center[0]>20&&s.center[0]<120),"intermediate longitude");
 const metrics={requestedMs,elapsedMs:flight.elapsedMs,minimumZoom,sampleCount:flight.samples.length,initial:await page.evaluate(()=>window.initialCamera),final:await page.evaluate(()=>window.camera),samples:flight.samples};
 writeFileSync(resolve(dir,"15-entry-flight-metrics.json"),JSON.stringify(metrics,null,2));
 console.log(JSON.stringify({requestedMs,elapsedMs:flight.elapsedMs,minimumZoom,sampleCount:flight.samples.length,final:metrics.final}));
await context.close();
 const legacy=await browser.newContext();const lp=await legacy.newPage();
 await lp.addInitScript(()=>{window.calls=0;Object.defineProperty(window,"HTMLGeolocationElement",{value:undefined,configurable:true});Object.defineProperty(navigator,"permissions",{value:{query:()=>Promise.resolve({state:"prompt"})},configurable:true});Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition:(ok)=>{window.calls++;ok({coords:{longitude:126.978,latitude:37.5665}});}},configurable:true});});
 await lp.goto(base+"/fixture");await lp.getByRole("button",{name:"내 위치"}).click();await lp.waitForFunction(()=>window.state?.phase==="ready");
 assert.equal(await lp.evaluate(()=>window.calls),1);assert.deepEqual(await lp.evaluate(()=>window.state.target.center),[126.978,37.5665]);await legacy.close();
 const retry=await browser.newContext({viewport:{width:667,height:300}});const rp=await retry.newPage();
 await rp.addInitScript(()=>{window.calls=0;Object.defineProperty(navigator,"permissions",{value:{query:()=>Promise.resolve({state:"granted"})},configurable:true});Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition:(ok,fail)=>{window.calls++;if(window.calls===1)fail({code:2});else ok({coords:{longitude:126.978,latitude:37.5665}});}},configurable:true});});
 await rp.goto(base+"/fixture");await rp.waitForFunction(()=>window.state?.phase==="choice"&&Boolean(window.state.notice));
 assert.equal(await rp.evaluate(()=>window.state.target),null);
 assert.equal(await rp.getByRole("button",{name:"내 위치",exact:true}).count(),1);
 await rp.getByRole("button",{name:"내 위치",exact:true}).click();
 await rp.waitForFunction(()=>window.state?.phase==="ready"&&window.camera&&Math.abs(window.camera.center[0]-126.978)<0.0001&&Math.abs(window.camera.zoom-15)<0.01,{},{timeout:12000});
 assert.equal(await rp.evaluate(()=>window.calls),2);assert.equal(await rp.evaluate(()=>window.state.notice),null);
 assert.deepEqual(await rp.evaluate(()=>window.state.target.center),[126.978,37.5665]);await retry.close();
 const blocked=await browser.newContext({viewport:{width:667,height:300}});const bp=await blocked.newPage();
 await bp.addInitScript(()=>{window.locationAllowed=false;window.calls=0;Object.defineProperty(navigator,"permissions",{value:{query:()=>Promise.resolve({state:"denied"})},configurable:true});Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition:(ok,fail)=>{window.calls++;if(window.locationAllowed)ok({coords:{longitude:126.978,latitude:37.5665}});else fail({code:1});}},configurable:true});});
 await bp.goto(base+"/fixture");await bp.waitForFunction(()=>window.state?.phase==="choice"&&window.state.permission==="denied");
 for(const width of [667,740,844]){
  await bp.setViewportSize({width,height:300});
  assert.equal(await bp.getByRole("dialog").getByRole("button").count(),2);
  assert.equal(await bp.locator("geolocation").count(),0);
  const first=bp.getByRole("button",{name:"내 위치",exact:true});
  assert.equal(await first.innerText(),"내 위치");
  const r=await first.boundingBox();assert.ok(r&&r.height>=44&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=300);
 }
 await bp.getByRole("button",{name:"내 위치",exact:true}).click();
 await bp.waitForFunction(()=>window.calls===1&&window.state?.phase==="choice");
 assert.equal(await bp.getByRole("dialog").getByRole("button").count(),2);
 await bp.evaluate(()=>{window.locationAllowed=true;});
 await bp.getByRole("button",{name:"내 위치",exact:true}).click();
 await bp.waitForFunction(()=>window.state?.phase==="ready"&&window.camera&&Math.abs(window.camera.center[0]-126.978)<0.0001&&Math.abs(window.camera.zoom-15)<0.01,{},{timeout:12000});
 assert.equal(await bp.evaluate(()=>window.calls),2);await blocked.close();

 const early=await browser.newContext({viewport:{width:740,height:300}});const ep=await early.newPage();
 await ep.addInitScript(()=>{Object.defineProperty(navigator,"permissions",{value:{query:()=>Promise.resolve({state:"granted"})},configurable:true});Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition:(ok)=>ok({coords:{longitude:126.978,latitude:37.5665}})},configurable:true});});
 await ep.goto(base+"/fixture");
 await ep.waitForFunction(()=>window.state?.phase==="ready"&&window.camera&&Math.abs(window.camera.center[0]-126.978)<0.0001&&Math.abs(window.camera.zoom-15)<0.01,{},{timeout:12000});
 assert.deepEqual(await ep.evaluate(()=>window.state.target.center),[126.978,37.5665]);await early.close();



 }finally{await browser?.close();await server.close();}
});
