/** Real UI components with in-memory state only. No authentication or ride writes. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import { MapHud } from '../../src/components/maphud/MapHud';
import { RideControlBar } from '../../src/components/ride/RideControlBar';
import { RouteDock } from '../../src/components/route-dock/RouteDock';
import { RideSummarySheet } from '../../src/components/ride/RideSummarySheet';
import { RideSettingsSheet } from '../../src/components/ride/RideSettingsSheet';
import { CadenceSensorSheet } from '../../src/components/sensor/CadenceSensorSheet';
import { MapViewSheet } from '../../src/components/map/MapViewSheet';
import { AppIntroScreen } from '../../src/components/auth/AppIntroScreen';
import { EntryLocationDialog } from '../../src/components/auth/EntryLocationDialog';
import { OfficialCourseListModal } from '../../src/components/ride/OfficialCourseListModal';
import { RideRoutePanel } from '../../src/components/ride/RideRoutePanel';
import { MenuPanel } from '../../src/components/MenuPanel';
import { UserInfoSheet } from '../../src/components/UserInfoSheet';
import { EdgePanelHandle } from '../../src/components/ui/EdgePanelHandle';
import type { CalorieIntensityId } from '../../src/lib/ride/caloriesEstimate';
import type { ConquestDisplayMode } from '../../src/components/map/routeConquestLayers';
import { getBasicSharedHubSummaries } from '../../src/lib/route/repo/firestoreCourses';
import type { RideUiStage } from '../../src/hooks/useRideUiStage';
import type { RouteDockStop } from '../../src/components/route-dock/useRouteDockStops';
import type { RideEndResult } from '../../src/lib/ride/rideEndResult';
import type { LeaderboardResponse } from '../../src/services/leaderboardApi';
import { LeaderboardGlanceChip, LeaderboardGlancePanel } from '../../src/components/leaderboard/LeaderboardGlance';
import { buildGlanceLiveRows } from '../../src/components/leaderboard/leaderboardGlanceSnapshot';
import '../../src/components/leaderboard/LeaderboardGlance.css';
import '../../src/boxcycle-theme.css';
import './preview.css';

const params = new URLSearchParams(location.search);
const initial = params.get('state') ?? 'ready';
const long = params.has('long');
const glanceCapture = initial.startsWith('glance-');
const noop = () => {};
const mockLeaderboard: LeaderboardResponse = {
  generatedAt: '2026-10-23T03:00:00.000Z',
  board: 'distance',
  period: 'week',
  scope: 'world',
  periodStartKst: '2026-10-19',
  rule: { sensorOnly: true },
  top: [
    { rank: 1, nickname: 'geum', valueKm: 17.1, uses: null, liveTrailId: 't1', isMe: false },
    { rank: 2, nickname: 'Ridingman12', valueKm: 16.6, uses: null, liveTrailId: null, isMe: true },
    { rank: 3, nickname: '한강라이더', valueKm: 12.4, uses: null, liveTrailId: null, isMe: false },
    { rank: 4, nickname: '새벽페달', valueKm: 9.8, uses: null, liveTrailId: 't2', isMe: false },
    { rank: 5, nickname: '원주토박이', valueKm: 8.7, uses: null, liveTrailId: null, isMe: false },
    { rank: 6, nickname: '달빛라이딩', valueKm: 6.3, uses: null, liveTrailId: null, isMe: false },
  ],
  me: {
    status: 'ranked',
    rank: 2,
    valueKm: 16.6,
    gapToNextKm: 0.5,
    projectedRank: null,
    uses: null,
    around: [],
  },
};
const result: RideEndResult = {
  recordId:'ui-preview', endedAtIso:'2026-10-20T08:00:00Z', sessionDistanceMeters:1200,
  elapsedSec:420, avgSpeedKmh:18, caloriesEstimate:null, savedRouteId:null,
  routeName:'남산공원길', hasRoute:true, previousProgressRatio:0.2, progressRatio:0.44,
  routeCompleted:false, anchorLngLat:[126.98,37.55], anchorPlaceLabel:'남산공원길',
  profile:'cycling', routeDistanceMeters:5000, rideSaveStatus:'success',
  savedRouteProgressStatus:'n/a',
};
const stops: RouteDockStop[] = [
  {id:'start',kind:'start',label:long?'대한민국 서울특별시 용산구 남산공원길 126 아주 긴 출발 주소':'남산공원 입구',loading:false,lngLat:[126.98,37.55]},
  ...([0,1,2] as const).slice(0, Math.max(0, Math.min(3, Number(params.get('waypoints')) || 0))).map((i): RouteDockStop => ({
    id:`wp-${i}`,kind:'waypoint',waypointIndex:i,label:`경유지 ${i+1} · 남산 산책길`,loading:false,lngLat:[126.981+i*.001,37.552+i*.001],
  })),
  {id:'end',kind:'end',label:long?'대한민국 강원특별자치도 원주시 아주 긴 이름의 목적지':'남산 순환로 전망대',loading:false,lngLat:[126.99,37.56]},
];

function Preview() {
  const glanceStage: RideUiStage =
    initial === 'glance-riding' ? 'riding' : initial === 'glance-summary' ? 'idle' : 'ready-to-start';
  const [stage,setStage] = useState<RideUiStage>(
    glanceCapture
      ? glanceStage
      : initial==='riding'
        ? 'riding'
        : initial==='paused'
          ? 'paused'
          : initial==='idle'
            ? 'idle'
            : initial==='setup'
              ? 'setup'
              : 'ready-to-start',
  );
  const [routeSetupToken,setRouteSetupToken] = useState<object>({});
  const [panel,setPanel] = useState(initial === 'glance-summary' ? 'summary' : initial);
  const [manual,setManual] = useState(false);
  const [speed,setSpeed] = useState(18);
  const [weight,setWeight] = useState<number|null>(null);
  const [intensity,setIntensity] = useState<CalorieIntensityId|null>(null);
  const [conquest,setConquest] = useState<ConquestDisplayMode>('all');
  const [menuReveal,setMenuReveal] = useState<number|null>(null);
  const [mapReveal,setMapReveal] = useState<number|null>(null);
  const modalOpen=['menu','map','account','settings','sensor','routes','summary','intro','location'].includes(panel);
  const active = stage==='riding'||stage==='paused';
  const hasRoute = stage!=='idle'&&stage!=='setup';
  const sensorState = {capable:true,uiState:active?'connected' as const:'idle' as const,crankRpm:active?72:null};
  const glanceLiveRows = buildGlanceLiveRows(mockLeaderboard);
  const glanceRiding = initial === 'glance-riding';
  const glanceView = glanceCapture
    ? {
        mode: glanceRiding ? ('riding' as const) : ('map' as const),
        isGuest: false,
        panelOpen: true,
        onTogglePanel: noop,
        onOpenFullLeaderboard: noop,
        mapData: mockLeaderboard,
        rideSnapshot: mockLeaderboard,
        liveRows: glanceLiveRows,
        myBaseKm: 9.43,
        addedKm: glanceRiding ? 0.07 : 0,
        pedalQualified: true,
      }
    : null;
  const summaryRank =
    initial === 'glance-summary'
      ? {
          kind: 'member-change' as const,
          beforeRank: 3,
          afterRank: 2,
          delta: 1,
          gapToFirstKm: 0.5,
        }
      : null;
  return <main className="audit-world" data-ui-stage={stage}>
    <svg className="audit-map" viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id="blocks" width="85" height="65" patternUnits="userSpaceOnUse"><rect width="85" height="65" fill="#d9e2dc"/><rect x="8" y="8" width="62" height="44" rx="5" fill="#a4bbad"/><path d="M0 62H85M80 0V65" stroke="#faf7e9" strokeWidth="8"/></pattern></defs>
      <rect width="800" height="360" fill="url(#blocks)"/><path d="M280 380Q300 220 500 180T850 -20" fill="none" stroke="#8ab9cd" strokeWidth="62"/>
      <path d="M260 310L350 245L480 270L590 200L560 115L660 65" fill="none" stroke="#e54b47" strokeWidth="5"/>
      <circle cx="480" cy="270" r="9" fill="#2563eb" stroke="white" strokeWidth="3"/>
    </svg>
    <div className="audit-map-attribution">검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음</div>
    <EdgePanelHandle edge="left" open={modalOpen} panelId="menu-panel" label="메뉴 열기"
      onOpen={()=>setPanel('menu')} onClose={()=>setPanel('ready')} onDragProgress={setMenuReveal}/>
    <EdgePanelHandle edge="right" open={modalOpen} panelId="map-view-sheet" label="맵 뷰 열기"
      onOpen={()=>setPanel('map')} onClose={()=>setPanel('ready')} onDragProgress={setMapReveal}/>
    <RouteDock key={hasRoute?'route':'empty'} stage={stage} stops={hasRoute?stops:stage==='setup'?[stops[0]]:[]} routeLoading={params.has('loading')}
      onRemoveStop={noop} onFocusStop={noop} onSwapEndpoints={noop} />
    <RideControlBar stage={panel==='summary'?'summary':stage} profile="cycling" routeLoading={params.has('loading')}
      routeSetupToken={routeSetupToken}
      canStartRide={!params.has('blocked')} onStartRide={()=>setStage('riding')} onPauseRide={()=>setStage('paused')} onResumeRide={()=>setStage('riding')}
      onEndRide={()=>{setPanel(params.has('short')?'ready':'summary');setStage(params.has('short')?'ready-to-start':'idle');}} resumeRatio={params.has('resume')?0.4:null}
      cadence={{state:sensorState,open:panel==='sensor',onOpen:()=>setPanel('sensor')}} />
    {params.has('short') ? <button type="button" style={{position:'absolute',left:'45%',bottom:4,zIndex:9}} onClick={()=>setRouteSetupToken({})}>검수용 새 경로 확정</button> : null}
    <MapHud stage={stage} onOpenMenu={()=>setPanel('menu')} menuOpen={panel==='menu'}
      account={glanceCapture?{initial:'R',isGuest:false,label:'Ridingman12',mileageKm:178}:{initial:'G',isGuest:true,label:long?'아주긴닉네임라이더테스트':'게스트 라이더',mileageKm:null}}
      onOpenUserInfo={()=>setPanel('account')} userInfoOpen={panel==='account'} onOpenMapView={()=>setPanel('map')} mapViewOpen={panel==='map'}
      coachData={null} coachLineEnabled={false} metrics={hasRoute?active?{mode:'ride',elapsed:glanceRiding?'00:13':'24:08',distanceKm:glanceRiding?'0.07':'4.20',cumulativeKm:glanceRiding?'0.07':long?'1234.56':'4.20',avgKmh:glanceRiding?'19.8':'18.6',speedKmh:glanceRiding?37:24,routeTotalKm:glanceRiding?'2.02':long?'9999.99':'10.00'}:{mode:'route-preview',elapsed:'00:00',distanceKm:long?'1234.56':'5.00',avgKmh:'0',speedKmh:0}:null}
      conquestLiveMeters={active?420:null} onClearPins={noop} routeError={params.has('error')?'경로를 찾지 못했습니다. 다른 지점을 선택해 주세요.':null}
      onResumeFromPause={()=>setStage('riding')} onEndFromPause={()=>setPanel('summary')} onModifyFromPause={()=>setStage('setup')}
      quickCamera={active&&!glanceRiding?{active:1,onSelect:noop}:null} mapControls={{styleLabel:'위성',styleAriaLabel:'맵 스타일 위성, 클릭 시 야외',onToggleStyle:noop,onZoomOut:noop,onZoomIn:noop,zoomOutDisabled:false,zoomInDisabled:false}}
      leaderboardGlanceChip={glanceView?<LeaderboardGlanceChip {...glanceView} />:undefined}
      leaderboardGlancePanel={glanceView && initial!=='glance-summary'?<LeaderboardGlancePanel {...glanceView} />:undefined} />
    <RideSummarySheet open={panel==='summary'||initial==='glance-summary'} result={result} arrivalCompleted={false} elapsedLabel="07:00" avgKmh="18" caloriesEstimate={null}
      story={initial==='glance-summary'?{headline:'첫 라이딩을 마치셨어요. 시작이 가장 어려운 법이에요.',detail:undefined}:{headline:'오늘도 나만의 길을 이었습니다.',detail:'남산공원길에서 1.2km를 달렸습니다.'}} adhocSaveAvailable={initial!=='glance-summary'} maxNameLength={80}
      suggestedName="서울 남산공원길" onSaveAdhoc={()=>setPanel('ready')} onDismissAdhoc={noop} onClose={()=>setPanel('ready')}
      rankChange={summaryRank} onOpenLeaderboard={noop} />
    <RideSettingsSheet open={panel==='settings'} onClose={()=>setPanel('ready')} rideTtsEnabled rideBgmEnabled rideCoachingBanner pacerEnabled
      onRideTtsEnabled={noop} onRideBgmEnabled={noop} onRideCoachingBanner={noop} onPacerEnabled={noop} rideBgmCatalogConfigured rideElevationProfileLoading={false}
      calorieWeightKg={weight} onCalorieWeightKg={raw=>setWeight(Number(raw)||null)} calorieIntensityId={intensity} onCalorieIntensityId={setIntensity}/>
    <UserInfoSheet open={panel==='account'} onClose={()=>setPanel('ready')} user={null} recentSessions={[]}
      isGuest tier="anonymous" subscriptionStatus="none" isPaid={false} busy={false}
      conquest={params.has('loading')?null:{totalMeters:0,totalCells:0}} mileage={{totalMeters:0,totalSec:0,rideCount:0}}
      onServiceExit={noop} onLinkGoogle={noop} />
    <CadenceSensorSheet open={panel==='sensor'} onClose={()=>setPanel('ready')} capable uiState="idle" deviceLabel={null} crankRpm={null} errorMessage={null}
      mode="manual" readiness={manual?'manual-ready':'choice-required'} riding={false} manualSpeedKmh={speed} onManualSpeedKmh={setSpeed}
      onConnect={noop} onDisconnect={noop} onChooseManual={()=>setManual(true)} onChooseCadence={()=>setManual(false)} />
    <MapViewSheet open={panel==='map'} revealProgress={mapReveal} onClose={()=>setPanel('ready')}
      coverageOverlayMode="off" onCoverageOverlayMode={noop} enable3D={false} onEnable3D={noop}
      rideActive={active} rideCameraDistanceM={60} onRideCameraDistanceM={noop}
      conquestDisplayMode={conquest} conquestHasRecentGeometry={false} onConquestDisplayMode={setConquest} onShowAllConquest={noop} />
    {panel==='routes'?<OfficialCourseListModal segment="intro" onClose={()=>setPanel('ready')} basicSharedHubs={getBasicSharedHubSummaries()} basicActiveHubCourseId={null}
      basicStartLoading={false} basicStartHubJoined={false} routeLoading={false} sessionIdle officialCourseCatalogAvailable publishedPublicCourses={[]}
      publishedPublicCoursesLoading={false} publishedPublicCoursesError={null} signedIn onEnterBasicHub={()=>setPanel('ready')} onLeaveBasicHub={noop}/>:null}
    <MenuPanel open={panel==='menu'} revealProgress={menuReveal} onClose={()=>setPanel('ready')} onOpenSettings={()=>setPanel('settings')} onOpenPlaceSearch={noop}>
      <RideRoutePanel routeSummary="" routeLoading={false} basicSharedHubs={getBasicSharedHubSummaries()} basicActiveHubCourseId={null}
        basicStartLoading={false} basicStartHubJoined={false} officialCourseCatalogAvailable publishedPublicCourses={getBasicSharedHubSummaries()}
        publishedPublicCoursesLoading={false} publishedPublicCoursesError={null} authGuest signedIn onEnterBasicHub={()=>setPanel('ready')} onLeaveBasicHub={noop}
        savedRoutes={[]} savedRoutesLoading={false} onLoadSavedRoute={noop} onRenameSavedRoute={noop} onDeleteSavedRoute={noop}
        arrivalToastVisible={false} adhocSaveAvailable={false} onSaveAdhocAsUserRoute={noop} onDismissAdhocSave={noop}
        rideTtsEnabled onRideTtsEnabled={noop} rideBgmEnabled onRideBgmEnabled={noop} rideCoachingBanner onRideCoachingBanner={noop}
        pacerEnabled onPacerEnabled={noop} rideElevationProfileLoading={false} rideBgmCatalogConfigured />
    </MenuPanel>
    {panel==='intro'?<AppIntroScreen onStartGuest={()=>setPanel('location')} onLogin={()=>setPanel('location')}/>:null}
    {panel==='location'?<EntryLocationDialog phase="choice" permission="prompt" onChooseRome={()=>setPanel('ready')} onChooseCurrent={()=>setPanel('ready')} onPosition={noop}/>:null}
  </main>;
}

export { Preview };

createRoot(document.getElementById('root')!).render(<Preview/>);
