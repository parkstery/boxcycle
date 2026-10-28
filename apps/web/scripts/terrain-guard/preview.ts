/** Offline WebGL verification: synthetic DEM, production guard and 3D application. */
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apply3DState } from '../../src/components/map/rideCameraFollow';
import { RideTerrainGuard, readRideTerrainHealth } from '../../src/components/map/rideTerrainGuard';
import { easeMapNorthUpAfterRideEnd, rideEndOverviewZoom } from '../../src/lib/map/rideEndNorthUp';
const map=new mapboxgl.Map({container:'map',accessToken:'pk.offline-fixture',center:[127,37],zoom:18,pitch:65,bearing:35,
  attributionControl:false,style:{version:8,sources:{
    'test-dem':{type:'raster-dem',tiles:[`${location.origin}/fixture-dem/{z}/{x}/{y}.png`],tileSize:512,maxzoom:14},
    composite:{type:'vector',tiles:[`${location.origin}/fixture-vector/{z}/{x}/{y}.pbf`],maxzoom:14},
    road:{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[126.99,36.99],[127,37],[127.01,37.01]]}}},
  },layers:[{id:'background',type:'background',paint:{'background-color':'#c9dfc9'}},
    {id:'road',type:'line',source:'road',paint:{'line-color':'#f04444','line-width':6}}]}});
let fault=false,active=true,requested=true;
let guard=new RideTerrainGuard(performance.now());
let flat=true;
const rawQuery=map.queryTerrainElevation.bind(map);
const healthMap={getCenter:()=>map.getCenter(),getFreeCameraOptions:()=>map.getFreeCameraOptions(),
  queryTerrainElevation:(...args: Parameters<typeof map.queryTerrainElevation>)=>fault?null:rawQuery(...args)};
function apply(){
  apply3DState(map,requested,'buildings','test-dem',{flatFallback:flat,preserveCamera:true});
  document.getElementById('status')!.textContent=!requested?'2D':flat?'자동 2D':'3D';
}
map.on('load',()=>{
  apply();
  const timer=setInterval(()=>{
    if(!active||!requested)return;
    const next=guard.update(performance.now(),readRideTerrainHealth(healthMap,[127,37],flat));
    if(next!==flat){flat=next;apply();}
  },250);
  const api={
    snapshot:()=>({flat,requested,altitude:map.getFreeCameraOptions().position?.toAltitude(),raw:rawQuery([127,37],{exaggerated:false}),shown:rawQuery([127,37],{exaggerated:true}),terrain:map.getTerrain(),pitch:map.getPitch(),bearing:map.getBearing(),center:map.getCenter(),zoom:map.getZoom(),buildings:!!map.getLayer('buildings')}),
    fault:(value:boolean)=>{fault=value;},
    off:()=>{requested=false;flat=false;apply();},
    end:()=>{active=false;requested=false;flat=false;apply();easeMapNorthUpAfterRideEnd(map,{durationMs:0,pitch:0,zoom:rideEndOverviewZoom(map)});},
    reload:()=>{apply();},
    on:()=>{requested=true;guard=new RideTerrainGuard(performance.now());flat=true;apply();},
    dispose:()=>{clearInterval(timer);map.remove();},
  };
  (window as unknown as {terrainDemo:typeof api}).terrainDemo=api;
});
