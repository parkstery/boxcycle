import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { RideTerrainGuard, readRideTerrainHealth, TERRAIN_GUARD_INTERVAL_MS } from '../../src/components/map/rideTerrainGuard.ts';
import { easeMapNorthUpAfterRideEnd,rideEndOverviewZoom,shouldEaseNorthUpOnRideActiveChange,RIDE_END_NORTH_UP_DURATION_MS } from '../../src/lib/map/rideEndNorthUp.ts';
const ts=createRequire(import.meta.url)('typescript');
function effect(file,match,context){
  const source=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let fn;
  const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0].getText(source).includes(match))fn=node.arguments[0];ts.forEachChild(node,visit);};visit(source);assert.ok(fn,match);
  return runInNewContext(ts.transpileModule(`(${fn.getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
}
const mapFile='../../src/components/map/MapView.tsx';
function fakeMap(){
  let terrain={exaggeration:1.3},hasBuildings=true,altitude=132;
  const element={dataset:{}};
  const map={
    getTerrain:()=>terrain,setTerrain:v=>{terrain=v;},
    getLayer:()=>hasBuildings?{}:null,removeLayer:()=>{hasBuildings=false;},
    getCenter:()=>({lng:127,lat:37}),getZoom:()=>18,
    transform:{cameraToCenterDistance:409.5},
    getFreeCameraOptions:()=>({position:{toLngLat:()=>({lng:127,lat:37}),toAltitude:()=>altitude}}),
    queryTerrainElevation:()=>100,getContainer:()=>element,
    setAltitude:v=>{altitude=v;},
    stop:()=>{},easeTo:next=>{map.lastEase=next;},
  };return map;
}
test('production MapView effect observes, restores, flattens and disposes without retrying user off',()=>{
  const map=fakeMap();let now=0,tick,cleared=false;const changes=[];
  const context={mapRef:{current:map},mapLoaded:true,enable3D:true,rideActive:true,
    terrainFallbackRef:{current:false},onTerrainFallbackChangeRef:{current:v=>changes.push(v)},
    liveLngLatRef:{current:[127,37]},performance:{now:()=>now},document:{hidden:false},
    RideTerrainGuard,readRideTerrainHealth,TERRAIN_GUARD_INTERVAL_MS,BUILDING_LAYER_ID:'buildings',TERRAIN_SOURCE_ID:'dem',
    apply3DState:(m,_enabled,_buildings,_dem,opts)=>{m.setTerrain({exaggeration:opts.flatFallback?0:1.3});map.setAltitude(opts.flatFallback?2:132);},
    window:{setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{cleared=true;}},
  };
  const cleanup=effect(mapFile,'const guard = new RideTerrainGuard',context)();
  assert.equal(map.getTerrain().exaggeration,0);assert.equal(map.getContainer().dataset.terrainView,'auto-2d');
  for(now=250;now<=4000;now+=250)tick();
  assert.equal(map.getTerrain().exaggeration,1.3);
  map.queryTerrainElevation=()=>null;
  for(;now<=6000;now+=250)tick();
  assert.equal(map.getTerrain().exaggeration,0);
  cleanup();assert.equal(cleared,true);
  const count=changes.length;tick();assert.equal(changes.length,count);
  context.enable3D=false;
  effect(mapFile,'const guard = new RideTerrainGuard',context)();
  assert.equal(context.terrainFallbackRef.current,false);
  assert.equal(changes.at(-1),false);assert.equal(map.getContainer().dataset.terrainView,undefined);
});
test('production ride-end effect removes terrain/buildings, keeps center and uses 1000m north-up overview',()=>{
  const map=fakeMap();const ref=current=>({current});
  const context={prevRideActiveForNorthUpRef:ref(true),rideActive:false,mapRef:ref(map),mapLoaded:true,prefersReducedMotion:true,
    shouldEaseNorthUpOnRideActiveChange,RIDE_END_NORTH_UP_DURATION_MS,easeMapNorthUpAfterRideEnd,rideEndOverviewZoom,
    holdCameraAfterRideEndRef:ref(false),rideEndHeldRouteRef:ref(null),routeGeometryRef:ref(null),suppressCameraFollowUntilRef:ref(0),performance:{now:()=>0},
    cameraSmoothRef:ref({}),mapZoomRef:ref(18),terrainFallbackRef:ref(true),BUILDING_LAYER_ID:'buildings',onMapZoomRef:ref(()=>{}),
    window:{setTimeout:()=>1,clearTimeout:()=>{}},
  };
  effect(mapFile,'const was = prevRideActiveForNorthUpRef.current',context)();
  assert.equal(map.getTerrain(),null);assert.equal(map.getLayer(),null);
  assert.equal(map.lastEase.pitch,0);assert.equal(map.lastEase.bearing,0);
  assert.equal(map.lastEase.zoom,rideEndOverviewZoom(map));assert.ok(map.lastEase.zoom<18);
  assert.equal(context.mapZoomRef.current,map.lastEase.zoom);
  assert.equal(map.lastEase.center.lng,127);assert.equal(map.lastEase.center.lat,37);
});
test('production App end resets requested 3D; pause preserves it',()=>{
  for(const status of ['idle','paused']){
    const values=[];const context={rideStatus:status,rideCameraRestoreRef:{current:{follow:'free',zoom:18}},
      setEnable3D:v=>values.push(['3d',v]),setTerrainFallback:v=>values.push(['fallback',v]),setFollowMode:()=>{},setMapZoom:()=>{},setActiveQuickCamera:()=>{},
      camera1StyleBeforeEnterRef:{current:null},camera1UserToggledStyleRef:{current:false},
    };
    effect('../../src/App.tsx','if (rideStatus === "idle" && rideCameraRestoreRef.current)',context)();
    assert.deepEqual(values,status==='idle'?[['3d',false],['fallback',false]]:[]);
  }
});
