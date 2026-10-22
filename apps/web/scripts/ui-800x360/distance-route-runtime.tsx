// 실제 hook/bridge/MapView 통합. e2e에서 경로 API·prewarm만 대체한다.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from 'firebase/auth';
import { MapView } from '../../src/components/map/MapView';
import { useDistanceAutoRoute } from '../../src/hooks/useDistanceAutoRoute';
import type { LineStringGeometry, LngLat } from '../../src/lib/geo/geo';
import type { RouteProfile } from '../../src/services/mapboxDirections';
import {bindRouteTokenUser,setSubscribedRouteTokenBalance} from '../../src/lib/account/routeTokenSpendBridge';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/boxcycle-theme.css';

const user = {uid:'fixture-distance-route',getIdToken:async()=>''} as User;
export function Runtime() {
  useEffect(()=>{bindRouteTokenUser(user.uid);setSubscribedRouteTokenBalance(user.uid,100);return()=>bindRouteTokenUser(null);},[]);
  const [start,setStart]=useState<LngLat|null>(null);
  const [end,setEnd]=useState<LngLat|null>(null);
  const [profile,setProfile]=useState<RouteProfile>('cycling');
  const [geometry,setGeometry]=useState<LineStringGeometry|null>(null);
  const [applied,setApplied]=useState(0);
  const [starts,setStarts]=useState(0);
  const [open,setOpen]=useState<{lngLat:LngLat;requestId:number}|null>(null);
  const auto=useDistanceAutoRoute({user,functionsRegion:'asia-northeast3',rideLocked:false,routeTokenInsufficient:false,
    onClearRouteArtifacts:()=>{},onApplyRoute:r=>{setStart(r.start);setEnd(r.end);setProfile(r.profile);setGeometry(r.geometry);setApplied(n=>n+1);}});
  return <>
    <MapView accessToken="pk.fixture" routeElevationProfile={{values:[],sampledCoords:[],loading:false,error:null,quotaExceeded:false,routeSig:''}}
      canStartRide={Boolean(geometry)} onStartRide={()=>setStarts(n=>n+1)}
      routeGeometry={geometry} startLngLat={start} endLngLat={end} routeWaypoints={[]} liveLngLat={null}
      mapStyle="mapbox://styles/mapbox/outdoors-v12" mapZoom={15} initialCenter={[127,37]} initialZoom={15}
      followMode="free" enable3D={false} onMapZoom={()=>{}} routeProfile={profile} onRouteProfile={setProfile}
      coverageOverlayMode="off" openRoutePickRequest={open}
      autoRouteSessionActive={auto.sessionActive} autoRouteTargetKm={auto.targetKm} autoRouteStatusMessage={auto.statusMessage}
      autoRouteMapPick={auto.mapPickMode} distanceTargetCircle={auto.circleGeometry}
      onPreviewDistanceAutoRouteCircle={auto.previewCircleAt} onClearDistanceAutoRouteCircle={auto.clearCirclePreview}
      onSuspendAutoRoutePopupPick={auto.suspendPopupPick} onRetryDistanceAutoRoute={auto.retryDirection}
      onArmDirectionPick={input=>{const result=auto.armDirectionPick(input);if(result.ok){setStart(input.start);setProfile(input.profile);}return result;}}
      onAutoRouteMapPick={auto.handleMapPick}
      onClearRoute={()=>{setStart(null);setEnd(null);setGeometry(null);auto.disarm();}}
      onSelectPoint={(kind,point)=>{if(kind==='start')setStart(point);else if(kind==='end')setEnd(point);}}
    />
    <button style={{position:'absolute',right:0,top:0,zIndex:50}} onClick={()=>{
      const point:LngLat=[127,37];setStart(point);setEnd(null);setGeometry(null);
      auto.armDirectionPick({start:point,profile:'cycling',targetKm:3});
      setOpen({lngLat:point,requestId:Date.now()});
    }}>여기에서 계속</button>
    <button style={{position:'absolute',left:0,top:0,zIndex:50}} onClick={()=>setOpen({lngLat:start??[127,37],requestId:Date.now()})}>검수 경로창 열기</button>
    <output id="distance-runtime-state" style={{position:'absolute',bottom:0,left:0,pointerEvents:'none'}}>{JSON.stringify({start,end,profile,applied,starts,step:auto.step,mode:auto.mapPickMode})}</output>
  </>;
}
createRoot(document.getElementById('root')!).render(<Runtime/>);
