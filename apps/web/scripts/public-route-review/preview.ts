// Local inspection only: no Firebase/authentication, storage writes, or ride records.
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apply3DState, tickRideCameraFollow } from '../../src/components/map/rideCameraFollow';
import { resetRideCameraTerrain } from '../../src/components/map/rideCameraTerrain';
import { readRideTerrainHealth } from '../../src/components/map/rideTerrainGuard';
import { getPointOnRouteByDistance, lineStringLengthMeters, type LngLat } from '../../src/lib/geo/geo';
const id=new URLSearchParams(location.search).get('id')??'richmond';
const base='/@fs/C:/20.HDev/boxcycle/document/ops/20261119-public-route-candidates/';
const data=await (await fetch(base+'evidence/'+id+'-directions.json')).json();
const geometry=data.response.routes[0].geometry;
const length=lineStringLengthMeters(geometry);
mapboxgl.accessToken=import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/satellite-streets-v12',
 center:geometry.coordinates[0],zoom:16,maxPitch:85,maxZoom:24,fadeDuration:0});
const errors:string[]=[];map.on('error',e=>errors.push(String(e.error?.message??'map error')));
await new Promise<void>(r=>map.once('load',()=>r()));
apply3DState(map,true,'review-buildings','review-dem',{preserveCamera:true});
map.addSource('candidate-route',{type:'geojson',data:{type:'Feature',properties:{},geometry}});
map.addLayer({id:'candidate-route',type:'line',source:'candidate-route',paint:{'line-color':'#ff285e','line-width':5}});
const el=document.createElement('div');el.textContent='●';
const marker=new mapboxgl.Marker({element:el}).setLngLat(geometry.coordinates[0]).addTo(map);
function smooth(){return {center:null,bearingPrimary:null,bearing:null,pitch:null,zoom:null,lastTs:null};}
let state=smooth(),prev={current:null as LngLat|null},rider=geometry.coordinates[0] as LngLat,slot:2|3=2;
function tick(){tickRideCameraFollow(map,rider,{activeQuickCamera:slot,followMode:slot===2?'forward':'backward',mapZoom:19,
 rideCameraDistanceM:slot===2?9.4:11,routeGeometry:geometry,prevLiveRef:prev,smooth:state,suppressUntilMs:0,nowMs:performance.now()});}
function snap(){
 const p=map.project(rider),pos=map.getFreeCameraOptions().position!,cam=pos.toLngLat(),ground=map.queryTerrainElevation(cam,{exaggerated:false});
 const gl=map.getCanvas().getContext('webgl2');
 return {id,slot,rider,rawElevation:map.queryTerrainElevation(rider,{exaggerated:false}),health:readRideTerrainHealth(map,rider,false),
  terrain:map.getTerrain(),cameraClearance:ground==null?null:pos.toAltitude()-ground*1.3,riderPixel:[p.x,p.y],
  inFrame:p.x>=0&&p.x<=800&&p.y>=0&&p.y<=360,tilesLoaded:map.areTilesLoaded(),contextLost:gl?.isContextLost(),
  viewport:[map.getCanvas().clientWidth,map.getCanvas().clientHeight],canvas:[map.getCanvas().width,map.getCanvas().height],errors:[...errors]};
}
async function settle(){
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const start=performance.now();
 while(!map.areTilesLoaded()&&performance.now()-start<12000)await new Promise(r=>setTimeout(r,150));
 return map.areTilesLoaded();
}
const api={map,data,geometry,length,settle,snapshot:snap,tick,
 async at(fraction:number,camera:2|3=2){
  slot=camera;rider=getPointOnRouteByDistance(geometry,length*fraction)!;marker.setLngLat(rider);
  resetRideCameraTerrain(map);state=smooth();prev={current:null};
  map.jumpTo({center:rider,zoom:18,pitch:55});await settle();tick();await settle();tick();
  const s=snap();document.querySelector('#status')!.textContent=`${data.design.name} · ${(length/1000).toFixed(3)}km · ${(fraction*100).toFixed(0)}% · QC${slot} · ${s.health}`;
  return s;
 }, overview(){const c=geometry.coordinates;const b=new mapboxgl.LngLatBounds(c[0],c[0]);c.forEach((p:LngLat)=>b.extend(p));map.fitBounds(b,{padding:35,duration:0,pitch:50});}
};
(window as unknown as {routeReview:typeof api}).routeReview=api;
document.querySelector('#status')!.textContent=data.design.name+' — ready';
