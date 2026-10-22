// 실제 MapView/Mapbox 엔진, 서버 쓰기 없는 통합 시험용 진입점.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapView } from '../../src/components/map/MapView';
import type { LngLat } from '../../src/lib/geo/geo';
import { circleLineString } from '../../src/lib/route/distanceAutoRoute';
import type { RouteProfile } from '../../src/services/mapboxDirections';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/boxcycle-theme.css';

export function Runtime() {
  const [start, setStart] = useState<LngLat | null>(null);
  const [end, setEnd] = useState<LngLat | null>(null);
  const [waypoints, setWaypoints] = useState<LngLat[]>([]);
  const [direction, setDirection] = useState(false);
  const [picks, setPicks] = useState(0);
  const [menu, setMenu] = useState(false);
  const [circle, setCircle] = useState<ReturnType<typeof circleLineString> | null>(null);
  const armedProfile = useRef<RouteProfile>('cycling');
  const [requestedProfile, setRequestedProfile] = useState<RouteProfile | null>(null);
  return <>
    <MapView accessToken="pk.fixture" routeElevationProfile={{values:[],sampledCoords:[],loading:false,error:null,quotaExceeded:false,routeSig:''}}
      routeGeometry={null} startLngLat={start} endLngLat={end} routeWaypoints={waypoints} liveLngLat={null}
      mapStyle="mapbox://styles/mapbox/outdoors-v12" mapZoom={15} initialCenter={[127,37]} initialZoom={15}
      followMode="free" enable3D={false} onMapZoom={()=>{}} routeProfile="cycling" onRouteProfile={()=>{}}
      coverageOverlayMode="off" autoRouteMapPick={direction?'direction':null}
      distanceTargetCircle={circle}
      onPreviewDistanceAutoRouteCircle={({start,targetKm})=>setCircle(circleLineString(start,targetKm*1000))}
      onClearDistanceAutoRouteCircle={()=>setCircle(null)}
      onArmDirectionPick={({profile})=>{armedProfile.current=profile;setDirection(true);return {ok:true};}}
      onAutoRouteMapPick={async()=>{setRequestedProfile(armedProfile.current);setPicks(n=>n+1);return {status:'found',message:'검수 경로'};}}
      onSelectPoint={(kind,point)=>{if(kind==='start')setStart(point);else if(kind==='end')setEnd(point);else setWaypoints(v=>[...v,point]);}}
    />
    <button style={{position:'absolute',right:0,bottom:0,zIndex:50}} onClick={()=>setMenu(v=>!v)}>검수 메뉴</button>
    <button style={{position:'absolute',right:0,top:0,zIndex:50}} onClick={()=>setDirection(true)}>방향 선택 준비</button>
    {menu&&<div role="dialog" aria-label="메뉴" style={{position:'absolute',right:0,top:0,zIndex:50,background:'white'}}><button onClick={()=>setMenu(false)}>메뉴 닫기</button></div>}
    <output id="runtime-state" style={{position:'absolute',bottom:0,left:0,pointerEvents:'none'}}>{JSON.stringify({start,end,waypoints,picks,requestedProfile})}</output>
  </>;
}
createRoot(document.getElementById('root')!).render(<Runtime/>);
