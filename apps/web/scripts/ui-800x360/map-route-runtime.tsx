// 실제 MapView/Mapbox 엔진, 서버 쓰기 없는 통합 시험용 진입점.
import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapView } from '../../src/components/map/MapView';
import { useRideStartPulseKey } from '../../src/hooks/useRideStartPulseKey';
import type { LngLat } from '../../src/lib/geo/geo';
import { circleLineString } from '../../src/lib/route/distanceAutoRoute';
import type { RouteProfile } from '../../src/services/mapboxDirections';
import { RouteClearBlockedDialog } from '../../src/components/ride/RouteClearBlockedDialog';
import { isRouteClearBlockedByRide } from '../../src/lib/route/routeClearGuard';
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
  const [inputReady, setInputReady] = useState(false);
  const [starts, setStarts] = useState(0);
  // 지시93 — ?riding=1 이면 주행 중: 「경로 삭제」는 경로를 지우지 않고 안내 창만 띄운다(앱 App.handleClearPins 와 같은 가드).
  const [rideStatus, setRideStatus] = useState(new URLSearchParams(location.search).get('riding') === '1' ? 'running' : 'idle');
  const [clearBlockedOpen, setClearBlockedOpen] = useState(false);
  const [endRideCalls, setEndRideCalls] = useState(0);
  const blocked = isRouteClearBlockedByRide(rideStatus);
  // 앱처럼 출발·도착이 정해질 때마다 새 경로 token, 입력 준비까지 되면 펄스 번호가 오른다.
  const routeToken = useMemo(() => (start && end ? {} : null), [start, end]);
  const rideStartPulseKey = useRideStartPulseKey(routeToken, Boolean(start && end && inputReady));
  return <>
    <MapView accessToken="pk.fixture" routeElevationProfile={{values:[],sampledCoords:[],loading:false,error:null,quotaExceeded:false,routeSig:''}}
      canStartRide={Boolean(start && end && inputReady)} rideStartPulseKey={rideStartPulseKey} onStartRide={()=>setStarts(n=>n+1)}
      routeGeometry={null} startLngLat={start} endLngLat={end} routeWaypoints={waypoints} liveLngLat={null}
      mapStyle="mapbox://styles/mapbox/outdoors-v12" mapZoom={15} initialCenter={[127,37]} initialZoom={15}
      followMode="free" enable3D={false} onMapZoom={()=>{}} routeProfile="cycling" onRouteProfile={()=>{}}
      coverageOverlayMode="off" autoRouteMapPick={direction?'direction':null}
      distanceTargetCircle={circle}
      onPreviewDistanceAutoRouteCircle={({start,targetKm})=>setCircle(circleLineString(start,targetKm*1000))}
      onClearDistanceAutoRouteCircle={()=>setCircle(null)}
      canClearRouteNow={()=>!blocked}
      onClearRoute={()=>{if(blocked){setClearBlockedOpen(true);return;}setStart(null);setEnd(null);setWaypoints([]);}}
      onArmDirectionPick={({profile})=>{armedProfile.current=profile;setDirection(true);return {ok:true};}}
      onAutoRouteMapPick={async()=>{setRequestedProfile(armedProfile.current);setPicks(n=>n+1);return {status:'found',message:'검수 경로'};}}
      onSelectPoint={(kind,point,slot)=>{if(kind==='start')setStart(point);else if(kind==='end')setEnd(point);else setWaypoints(v=>slot != null && slot < v.length?v.map((p,i)=>i===slot?point:p):[...v,point]);}}
    />
    <button style={{position:'absolute',right:0,bottom:0,zIndex:50}} onClick={()=>setMenu(v=>!v)}>검수 메뉴</button>
    <button style={{position:'absolute',right:0,top:0,zIndex:50}} onClick={()=>setDirection(true)}>방향 선택 준비</button>
    <button style={{position:'absolute',left:0,top:0,zIndex:50}} onClick={()=>setInputReady(v=>!v)}>검수 입력 준비</button>
    {menu&&<div role="dialog" aria-label="메뉴" style={{position:'absolute',right:0,top:0,zIndex:50,background:'white'}}><button onClick={()=>setMenu(false)}>메뉴 닫기</button></div>}
    <RouteClearBlockedDialog open={clearBlockedOpen && blocked} onContinue={()=>setClearBlockedOpen(false)}
      onEndRide={()=>{setClearBlockedOpen(false);setEndRideCalls(n=>n+1);setRideStatus('idle');}} />
    <output id="runtime-state" style={{position:'absolute',bottom:0,left:0,pointerEvents:'none'}}>{JSON.stringify({start,end,waypoints,picks,requestedProfile,starts,rideStatus,endRideCalls,clearBlockedOpen:clearBlockedOpen && blocked})}</output>
  </>;
}
createRoot(document.getElementById('root')!).render(<Runtime/>);
