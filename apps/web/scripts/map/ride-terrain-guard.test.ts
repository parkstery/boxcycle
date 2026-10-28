import assert from 'node:assert/strict';
import test from 'node:test';
import { RideTerrainGuard, readRideTerrainHealth } from '../../src/components/map/rideTerrainGuard.ts';

function advance(guard: RideTerrainGuard, from: number, to: number, health: 'ready'|'missing'|'camera-obstructed') {
  for(let t=from;t<=to;t+=250) guard.update(t,health);
}
test('stable DEM restores 3D, transient gaps do not flatten; sustained gaps do',()=>{
  const guard=new RideTerrainGuard(0);
  advance(guard,0,3750,'ready'); assert.equal(guard.flat,true);
  guard.update(4000,'ready'); assert.equal(guard.flat,false);
  advance(guard,5000,5500,'missing'); assert.equal(guard.flat,false);
  guard.update(5750,'ready'); assert.equal(guard.flat,false);
  advance(guard,6000,6750,'camera-obstructed'); assert.equal(guard.flat,true);
  advance(guard,7000,10500,'ready'); assert.equal(guard.flat,true);
  guard.update(10750,'ready'); assert.equal(guard.flat,false);
});
test('alternating failures never accumulate into recovery',()=>{
  const guard=new RideTerrainGuard(0);
  for(let t=0;t<15000;t+=250) guard.update(t,t%1000===0?'missing':'ready');
  assert.equal(guard.flat,true);
});
test('sleep/background gaps cannot count as continuous recovery',()=>{
  const guard=new RideTerrainGuard(0);
  advance(guard,0,2500,'ready');
  guard.update(60000,'ready'); assert.equal(guard.flat,true);
  advance(guard,60250,62500,'ready'); assert.equal(guard.flat,false);
});
function fakeMap(raw=100, flat=false) {
  const queries: unknown[]=[];
  return {queries,
    getCenter:()=>({lng:0,lat:0}),
    getFreeCameraOptions:()=>({position:{toLngLat:()=>({lng:0,lat:-0.0001}),toAltitude:()=>flat?2:raw*1.3+2}}),
    queryTerrainElevation:(_p: unknown,options: unknown)=>{queries.push(options);return raw;},
  };
}
for(const raw of [0,-5,100,3500]) test(`raw ${raw}m is valid in flat and 3D`,()=>{
  for(const flat of [false,true]) {
    const map=fakeMap(raw,flat);
    assert.equal(readRideTerrainHealth(map as never,[0,0],flat),'ready');
    assert.ok(map.queries.length<=5);
    assert.ok(map.queries.every(q=>(q as {exaggerated:boolean}).exaggerated===false));
  }
});
test('missing, NaN and exceptions remain flat rather than manufacturing elevation',()=>{
  const map=fakeMap();
  for(const value of [null,undefined,NaN,Infinity]) {
    map.queryTerrainElevation=()=>value as number;
    assert.equal(readRideTerrainHealth(map as never,[0,0],true),'missing');
  }
  map.queryTerrainElevation=()=>{throw Error('tile unavailable');};
  assert.equal(readRideTerrainHealth(map as never,[0,0],true),'missing');
  assert.equal(readRideTerrainHealth(fakeMap() as never,null,true),'missing');
  assert.equal(readRideTerrainHealth(fakeMap() as never,[NaN,37],true),'missing');
});
test('camera below real terrain is detected, including prospective recovery in flat mode',()=>{
  const map=fakeMap(100);
  map.getFreeCameraOptions=()=>({position:{toLngLat:()=>({lng:0,lat:0}),toAltitude:()=>120}});
  assert.equal(readRideTerrainHealth(map as never,[0,0],false),'camera-obstructed');
  const flat=fakeMap(100,true);
  flat.queryTerrainElevation=(p: unknown)=> (p as {lat:number}).lat<0?110:100;
  assert.equal(readRideTerrainHealth(flat as never,[0,0],true),'camera-obstructed');
});
test('hill between camera and rider is detected even when endpoints are safe',()=>{
  const map=fakeMap(100);
  map.queryTerrainElevation=(p: unknown)=> Math.abs((p as {lat:number}).lat+0.000067)<1e-8?120:100;
  assert.equal(readRideTerrainHealth(map as never,[0,0],false),'camera-obstructed');
});
