import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import ts from 'typescript';

const source = ts.createSourceFile('App.tsx', readFileSync('src/App.tsx','utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let target;
function visit(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(source) === 'lastRideEntryTarget') target = n.initializer.getText(source);
  ts.forEachChild(n, visit);
}
visit(source);
assert.ok(target);
const mapSource=ts.createSourceFile('MapView.tsx',readFileSync('src/components/map/MapView.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function mapEffect(deps){
 let fn;
 function find(n){if(ts.isCallExpression(n)&&n.expression.getText(mapSource)==='useEffect'&&n.arguments[1]?.getText(mapSource).replaceAll(' ','')===deps)fn=n.arguments[0];ts.forEachChild(n,find);}
 find(mapSource);assert.ok(fn,deps);
 return ts.transpileModule(`export default (${fn.getText(mapSource)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,alwaysStrict:false}}).outputText.replace('export default ','').replace(/;\s*$/,'');
}
const fixture = `
import React,{useEffect,useMemo,useState,useRef} from 'react';
import mapboxgl from 'mapbox-gl';
import {createRoot} from 'react-dom/client';
import {useRecentRideSessions} from '/src/hooks/useRecentRideSessions.ts';
import {useEntryLocation} from '/src/hooks/useEntryLocation.ts';
import {resolveNextRideView} from '/src/lib/ride/nextRideTarget.ts';
import {MAP_FALLBACK_ZOOM} from '/src/lib/map/mapBootCenter.ts';
function App(){
 const [user,setUser]=useState({uid:'a',isAnonymous:false});
 const {recentSessions,recentSessionsLoading,setRecentSessions}=useRecentRideSessions({configured:true,user,trailId:'test',profile:'driving'});
 const lastRideEntryTarget=${target};
 const entryLocationEnabled=!!user;
 const state=useEntryLocation(entryLocationEnabled && !recentSessionsLoading,lastRideEntryTarget);
 const mapRef=useRef(null),bootFlyTargetRef=useRef(null),bootFlyMovedRef=useRef(false),bootFlyBypassZoomGuardRef=useRef(false),suppressCameraFollowUntilRef=useRef(0);
 const [mapLoaded,setMapLoaded]=useState(false);
 const bootFlyTarget=state.target,bootFlyHold=state.phase!=='ready';
 const getReducedMotionSnapshot=()=>true;
 useEffect(()=>{
  const map=new mapboxgl.Map({container:'map',accessToken:'pk.offline-fixture',center:[128.6,35.87],zoom:15,style:{version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#ddd'}}]}});
  mapRef.current=map;bootFlyMovedRef.current=false;
  map.on('load',()=>setMapLoaded(true));
  return()=>{map.remove();setMapLoaded(false);};
 },[]);
 useEffect(${mapEffect('[bootFlyTarget]')},[bootFlyTarget]);
 useEffect(${mapEffect('[mapLoaded,bootFlyHold,bootFlyTarget]')},[mapLoaded,bootFlyHold,bootFlyTarget]);
 useEffect(()=>{window.entry={state,loading:recentSessionsLoading,setRecentSessions,setUser,map:mapRef.current};});
 return React.createElement('div',{id:'map',style:{width:'699px',height:'273px'}},state.phase);
}
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));
`;
assert.equal(ts.createSourceFile('fixture.js',fixture,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS).parseDiagnostics.length,0);
const ride = (id, end, at='2026-10-27T12:00:00Z') => ({id,endedAt:at,elapsedSec:300,distanceMeters:1200,avgSpeedKmh:14,caloriesEstimate:null,routeDistanceMeters:1200,routeDurationSec:300,sessionEndLngLat:end});
test('actual history and entry hooks prefer latest endpoint without geolocation, once per account entry', {timeout:60000}, async()=>{
 const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
  name:'last-ride-entry',enforce:'pre',
  resolveId(id){if(id==='/last-entry.js')return '\0last-entry';if(id.endsWith('/repo/firestoreRides'))return '\0history-mock';},
  load(id){if(id==='\0last-entry')return fixture;if(id==='\0history-mock')return `export function loadRecentRideSessionsFromFirestore(){return new Promise(resolve=>{window.historyReads=(window.historyReads||0)+1;window.resolveHistory=resolve;});} export async function backfillRideSessionsToFirestore(){}`;},
  configureServer(s){s.middlewares.use(async(req,res,next)=>{
   if(req.url!=='/last-entry')return next();
   res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/last-entry','<html><body><div id="root"></div><script type="module" src="/last-entry.js"></script></body></html>'));
  });},
 }]});
 let browser;
 try {
  await server.listen();
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [permission,local,rows] of [
   ['denied',[ride('old',[128.6,35.87],'2026-10-26T12:00:00Z')],[ride('osaka',[135.456,34.662])]],
   ['granted',[],[ride('osaka',[135.456,34.662])]],
   ['denied',[],[ride('invalid',[999,34.662])]],
  ]) {
   const page=await browser.newPage({viewport:{width:699,height:273}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://api.mapbox.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
   await page.route('https://events.mapbox.com/**',r=>r.fulfill({status:204}));
   await page.addInitScript(({permission,local})=>{
    localStorage.setItem('boxcycle_web_ride_sessions_v1',JSON.stringify(local));
    window.geoCalls=0;
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:()=>{window.geoCalls++;return Promise.resolve({state:permission});}}});
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:()=>{window.geoCalls++;}}});
   },{permission,local});
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/last-entry`);
   await page.waitForFunction(()=>window.entry?.loading && window.historyReads>=2);
   assert.equal(await page.evaluate(()=>window.geoCalls),0);
   await page.evaluate(rows=>window.resolveHistory(rows),rows);
   if(rows[0].id==='invalid') {
    await page.waitForFunction(()=>window.entry?.state.phase==='choice');
    assert.equal(await page.evaluate(()=>window.entry.state.target),null);
    assert.equal(await page.evaluate(()=>window.geoCalls),1);
    assert.deepEqual(errors,[]);await page.close();continue;
   }
   await page.waitForFunction(()=>window.entry?.state.phase==='ready');
   assert.deepEqual(await page.evaluate(()=>window.entry.state.target.center),[135.456,34.662]);
   await page.waitForFunction(()=>Math.abs(window.entry.map.getCenter().lng-135.456)<1e-6 && Math.abs(window.entry.map.getCenter().lat-34.662)<1e-6);
   assert.equal(await page.evaluate(()=>window.geoCalls),0);
   // 새 주행 기록이 생겨도 초기 진입 목적지를 다시 덮지 않는다.
   await page.evaluate(rows=>window.entry.setRecentSessions(rows),[ride('later',[127,37])]);
   await page.waitForFunction(()=>window.entry.state.target.center[0]===135.456);
   // 다른 계정의 서버 응답을 기다리는 동안 이전 계정의 목적지는 해제한다.
   const reads=await page.evaluate(()=>window.historyReads);
   await page.evaluate(()=>window.entry.setUser({uid:'b',isAnonymous:false}));
   await page.waitForFunction(n=>window.historyReads>n && window.entry.state.target===null,reads);
   await page.evaluate(rows=>window.resolveHistory(rows),[ride('b',[139.7,35.6],'2026-10-28T12:00:00Z')]);
   await page.waitForFunction(()=>window.entry?.state.phase==='ready');
   assert.deepEqual(await page.evaluate(()=>window.entry.state.target.center),[139.7,35.6]);
   assert.equal(await page.evaluate(()=>window.geoCalls),0);
   assert.deepEqual(errors,[]);
   await page.close();
  }
 } finally {await browser?.close();await server.close();}
});
