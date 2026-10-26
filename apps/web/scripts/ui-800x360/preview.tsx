/** Real UI components with in-memory state only. No authentication or ride writes. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import { MapHud } from '../../src/components/maphud/MapHud';
import { RideControlBar } from '../../src/components/ride/RideControlBar';
import { useRideStartPulseKey } from '../../src/hooks/useRideStartPulseKey';
import { MapBottomLeftStack } from '../../src/features/map-overlays/MapBottomLeftStack';
import { RouteMinimap } from '../../src/features/map-overlays/RouteMinimap';
import { RouteDock } from '../../src/components/route-dock/RouteDock';
import { RideSummarySheet } from '../../src/components/ride/RideSummarySheet';
import { NextRideCard } from '../../src/components/ride/NextRideCard';
import type { NextRideView } from '../../src/lib/ride/nextRideTarget';
import type { SavedRoute } from '../../src/lib/route/repo/firestoreSavedRoutes';
import type { LineStringGeometry } from '../../src/lib/geo/geo';
import { RideSettingsSheet } from '../../src/components/ride/RideSettingsSheet';
import { CadenceSensorSheet } from '../../src/components/sensor/CadenceSensorSheet';
import { MapViewSheet } from '../../src/components/map/MapViewSheet';
import { ProfileEditSheet } from '../../src/components/ProfileEditSheet';
import type { User } from 'firebase/auth';
import type { RideInputMode } from '../../src/lib/sensor/cadenceRideInput';
import type { BleCrankRpmUiState, RideInputReadiness } from '../../src/lib/sensor/cadenceSensorUi';
import type { CoverageOverlayMode } from '../../src/lib/activity/coverageOverlayMode';
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
import type { Camera1Mode } from '../../src/lib/camera/camera1Mode';
import type { StoredRideSession } from '../../src/lib/ride/rideSessionsStorage';
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
const summaryVariant = params.get('variant');
const result: RideEndResult = {
  recordId:'ui-preview', endedAtIso:'2026-10-20T08:00:00Z', sessionDistanceMeters:1200,
  elapsedSec:420, avgSpeedKmh:18, caloriesEstimate:null, savedRouteId:null,
  routeName:'남산공원길', hasRoute:true, previousProgressRatio:0.2, progressRatio:0.44,
  routeCompleted:false, anchorLngLat:[126.98,37.55], anchorPlaceLabel:'남산공원길',
  profile:'cycling', routeDistanceMeters:5000,
  rideSaveStatus: summaryVariant === 'saving' ? 'pending' : 'success',
  savedRouteProgressStatus: summaryVariant === 'progress-fail' ? 'failed' : 'n/a',
};

const nextRideGeometry: LineStringGeometry = {
  type: 'LineString',
  coordinates: [[127.0, 37.5], [127.01, 37.5], [127.02, 37.5]],
};
const nextRideRoute: SavedRoute = {
  id: 'preview-route-a',
  name: long ? '대한민국 서울특별시 용산구 남산공원길 아주 긴 경로 이름 테스트' : '남산 순환로',
  profile: 'cycling',
  startLngLat: [127.0, 37.5],
  endLngLat: [127.02, 37.5],
  waypoints: [],
  geometry: nextRideGeometry,
  distanceMeters: 2200,
  durationSec: 480,
  createdAtIso: '2026-10-01T00:00:00.000Z',
  updatedAtIso: '2026-10-06T00:00:00.000Z',
  completed: 0,
  completedAtIso: null,
  expiresAtIso: null,
  lastRideId: 'preview-ride-1',
  lastProgressRatio: 0.2,
};
const nextRideSession: StoredRideSession = {
  id: 'preview-ride-1',
  endedAt: '2026-10-22T07:30:00.000Z',
  elapsedSec: 420,
  distanceMeters: 440,
  avgSpeedKmh: 18,
  caloriesEstimate: 0,
  routeDistanceMeters: 2200,
  routeDurationSec: 480,
  userRouteId: nextRideRoute.id,
  routeName: nextRideRoute.name,
  completionRatio: 0.2,
  sessionEndLngLat: [127.004, 37.5],
  sessionEndPlaceLabel: long ? '대한민국 서울특별시 용산구 남산공원길 126' : '남산공원 입구',
  endPlaceLabel: '전망대',
};
const nextRideResumeView: NextRideView = {
  target: {
    kind: 'resume_route',
    rideId: nextRideSession.id,
    routeId: nextRideRoute.id,
    progressRatio: 0.2,
    anchorLngLat: [127.004, 37.5],
  },
  ride: nextRideSession,
  route: nextRideRoute,
};
const nextRideExtendView: NextRideView = {
  target: {
    kind: 'extend_from_ride',
    rideId: nextRideSession.id,
    anchorLngLat: [127.004, 37.5],
  },
  ride: nextRideSession,
  route: null,
};
const previewRideSessions: StoredRideSession[] = [
  {
    id: 'preview-ride-1',
    endedAt: '2026-10-22T07:30:00.000Z',
    elapsedSec: 1680,
    distanceMeters: 4200,
    avgSpeedKmh: 18.2,
    caloriesEstimate: 312,
    routeDistanceMeters: 5000,
    routeDurationSec: 2100,
    routeName: '남산 순환로',
    completionRatio: 0.84,
    startPlaceLabel: '남산 입구',
    endPlaceLabel: '전망대',
  },
  {
    id: 'preview-ride-2',
    endedAt: '2026-10-20T12:00:00.000Z',
    elapsedSec: 900,
    distanceMeters: 2800,
    avgSpeedKmh: 16.5,
    caloriesEstimate: null,
    routeDistanceMeters: 2800,
    routeDurationSec: 900,
    routeName: '한강 북단',
    completionRatio: 1,
    startPlaceLabel: '망원',
    endPlaceLabel: '망원',
  },
  {
    id: 'preview-ride-3',
    endedAt: '2026-10-18T18:45:00.000Z',
    elapsedSec: 540,
    distanceMeters: 1500,
    avgSpeedKmh: 14.1,
    caloriesEstimate: 98,
    routeDistanceMeters: 3200,
    routeDurationSec: 1200,
    routeName: '단구동 저녁 루프',
    completionRatio: 0.47,
    startPlaceLabel: '단구동',
    endPlaceLabel: '단구동',
  },
];

const stops: RouteDockStop[] = [
  {id:'start',kind:'start',label:long?'대한민국 서울특별시 용산구 남산공원길 126 아주 긴 출발 주소':'남산공원 입구',loading:false,lngLat:[126.98,37.55]},
  ...([0,1,2] as const).slice(0, Math.max(0, Math.min(3, Number(params.get('waypoints')) || 0))).map((i): RouteDockStop => ({
    id:`wp-${i}`,kind:'waypoint',waypointIndex:i,label:`경유지 ${i+1} · 남산 산책길`,loading:false,lngLat:[126.981+i*.001,37.552+i*.001],
  })),
  {id:'end',kind:'end',label:long?'대한민국 강원특별자치도 원주시 아주 긴 이름의 목적지':'남산 순환로 전망대',loading:false,lngLat:[126.99,37.56]},
];

const isNextRidePreview = initial === 'nextride-resume' || initial === 'nextride-extend';

const BATCH4_PROFILE_STATES = new Set(['profile', 'profile-guest', 'profile-locked']);
const BATCH4_SENSOR_STATES = new Set([
  'sensor',
  'sensor-connected',
  'sensor-disconnected',
  'sensor-riding-manual',
  'sensor-unsupported',
]);
const isBatch4Fixture =
  BATCH4_PROFILE_STATES.has(initial) ||
  BATCH4_SENSOR_STATES.has(initial) ||
  initial === 'settings' ||
  initial === 'map';

function resolveInitialPanel(state: string): string {
  if (state === 'glance-summary') return 'summary';
  if (state === 'nextride-resume' || state === 'nextride-extend') return 'idle';
  if (BATCH4_PROFILE_STATES.has(state)) return 'profile';
  if (BATCH4_SENSOR_STATES.has(state)) return 'sensor';
  if (state === 'settings' || state === 'map') return state;
  return state;
}

function makeProfileUser(state: string): User {
  const guest = state === 'profile-guest';
  return {
    uid: guest ? 'preview-guest' : 'preview-member',
    isAnonymous: guest,
    displayName: guest ? null : 'Ridingman12',
  } as User;
}

function profileNicknameLockMs(state: string): number | null {
  if (state !== 'profile-locked') return null;
  return Date.now() - 86400000 * 5;
}

type SensorSheetMemory = {
  capable: boolean;
  uiState: BleCrankRpmUiState;
  crankRpm: number | null;
  mode: RideInputMode;
  readiness: RideInputReadiness;
  riding: boolean;
  deviceLabel: string | null;
  errorMessage: string | null;
};

function sensorSheetMemoryForState(state: string): SensorSheetMemory {
  switch (state) {
    case 'sensor-connected':
      return {
        capable: true,
        uiState: 'connected',
        crankRpm: 82,
        mode: 'cadence',
        readiness: 'cadence-ready',
        riding: false,
        deviceLabel: 'Wahoo CADENCE',
        errorMessage: null,
      };
    case 'sensor-disconnected':
      return {
        capable: true,
        uiState: 'disconnected',
        crankRpm: null,
        mode: 'cadence',
        readiness: 'choice-required',
        riding: false,
        deviceLabel: 'Wahoo CADENCE',
        errorMessage: '연결이 끊어졌습니다.',
      };
    case 'sensor-riding-manual':
      return {
        capable: true,
        uiState: 'idle',
        crankRpm: null,
        mode: 'manual',
        readiness: 'manual-ready',
        riding: true,
        deviceLabel: null,
        errorMessage: null,
      };
    case 'sensor-unsupported':
      return {
        capable: false,
        uiState: 'idle',
        crankRpm: null,
        mode: 'manual',
        readiness: 'choice-required',
        riding: false,
        deviceLabel: null,
        errorMessage: null,
      };
    default:
      return {
        capable: true,
        uiState: 'idle',
        crankRpm: null,
        mode: 'manual',
        readiness: 'choice-required',
        riding: false,
        deviceLabel: null,
        errorMessage: null,
      };
  }
}

function Preview() {
  const glanceStage: RideUiStage =
    initial === 'glance-riding' ? 'riding' : initial === 'glance-summary' ? 'idle' : 'ready-to-start';
  const batch4RidingMap = initial === 'map' && params.has('riding');
  const [stage,setStage] = useState<RideUiStage>(
    glanceCapture
      ? glanceStage
      : isNextRidePreview
        ? 'idle'
        : initial === 'sensor-riding-manual' || batch4RidingMap
          ? 'riding'
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
  const [camera,setCamera] = useState<1|2|3|4|5|6>(1);
  const [flatCameraMode,setFlatCameraMode] = useState<Camera1Mode>('aerial500');
  const [routeSetupToken,setRouteSetupToken] = useState<object>({});
  const [panel,setPanel] = useState(resolveInitialPanel(initial));
  const rideStartPulseKey = useRideStartPulseKey(routeSetupToken, stage==='ready-to-start' && panel!=='summary' && !params.has('loading') && !params.has('blocked'));
  const [nextRideHidden, setNextRideHidden] = useState(false);
  const [nextRideCalls, setNextRideCalls] = useState({
    resume: 0,
    extend: 0,
    map: 0,
    dismiss: 0,
  });
  const bumpNextRideCall = (key: keyof typeof nextRideCalls) => {
    setNextRideCalls((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };
  // variant=no-calorie: 체중·체력을 아직 넣지 않은 사용자
  const batch4CalorieSeed = (isBatch4Fixture || BATCH4_PROFILE_STATES.has(initial) || initial === 'settings') && summaryVariant !== 'no-calorie';
  const [manual,setManual] = useState(false);
  const [speed,setSpeed] = useState(18);
  const [weight,setWeight] = useState<number|null>(batch4CalorieSeed ? 64 : null);
  const [intensity,setIntensity] = useState<CalorieIntensityId|null>(batch4CalorieSeed ? 'moderate' : null);
  const [conquest,setConquest] = useState<ConquestDisplayMode>('all');
  const [coverage,setCoverage] = useState<CoverageOverlayMode>('off');
  const [enable3D,setEnable3D] = useState(false);
  const [mapRecentGeometry,setMapRecentGeometry] = useState(false);
  const [rideCameraDistanceM,setRideCameraDistanceM] = useState(40);
  const [rideTtsEnabled,setRideTtsEnabled] = useState(true);
  const [rideBgmEnabled,setRideBgmEnabled] = useState(true);
  const [rideCoachingBanner,setRideCoachingBanner] = useState(true);
  const [pacerEnabled,setPacerEnabled] = useState(true);
  const [settingsProfileNavCalls,setSettingsProfileNavCalls] = useState(0);
  const [sensorCalls,setSensorCalls] = useState({ connect: 0, disconnect: 0, manual: 0, cadence: 0 });
  const bumpSensorCall = (key: keyof typeof sensorCalls) => {
    setSensorCalls((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };
  const [profilePersistCalls,setProfilePersistCalls] = useState({ nickname: 0, weight: 0, intensity: 0 });
  const [sensorSheet,setSensorSheet] = useState<SensorSheetMemory>(() => sensorSheetMemoryForState(initial));
  const sensorPreset = initial !== 'sensor';
  const sensorReadiness: RideInputReadiness =
    initial === 'sensor'
      ? manual
        ? 'manual-ready'
        : 'choice-required'
      : sensorSheet.readiness;
  const sensorMode: RideInputMode =
    initial === 'sensor' ? (manual ? 'manual' : sensorSheet.mode) : sensorSheet.mode;
  const sensorRiding = sensorSheet.riding;
  const sensorCapable = sensorSheet.capable;
  const sensorUiState = sensorSheet.uiState;
  const sensorCrankRpm =
    sensorSheet.uiState === 'connected' ? sensorSheet.crankRpm : sensorPreset ? sensorSheet.crankRpm : null;
  const [menuReveal,setMenuReveal] = useState<number|null>(null);
  const [mapReveal,setMapReveal] = useState<number|null>(null);
  const modalOpen=['menu','map','account','settings','sensor','profile','routes','summary','intro','location'].includes(panel);
  const profileUser = makeProfileUser(BATCH4_PROFILE_STATES.has(initial) ? initial : 'profile');
  const profileNicknameChangedAtMs = profileNicknameLockMs(initial);
  const active = stage==='riding'||stage==='paused';
  const hasRoute = stage!=='idle'&&stage!=='setup';
  const dockSensorUi: BleCrankRpmUiState =
    sensorPreset && panel === 'sensor'
      ? sensorSheet.uiState
      : active
        ? 'connected'
        : 'idle';
  const dockCrankRpm =
    sensorPreset && panel === 'sensor' && sensorSheet.uiState === 'connected'
      ? sensorSheet.crankRpm
      : active
        ? 72
        : null;
  const sensorState = { capable: sensorCapable, uiState: dockSensorUi, crankRpm: dockCrankRpm };
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
    <MapBottomLeftStack>
    <RouteDock key={hasRoute?'route':'empty'} stage={stage} stops={hasRoute?stops:stage==='setup'?[stops[0]]:[]} routeLoading={params.has('loading')}
      onRemoveStop={noop} onFocusStop={noop} onSwapEndpoints={noop}
      cadence={{state:sensorState,open:panel==='sensor',onOpen:()=>setPanel('sensor')}} />
    <RouteMinimap active={active} routeGeometry={{type:'LineString',coordinates:[[126.98,37.55],[126.982,37.553],[126.986,37.552],[126.99,37.56]]}} liveLngLat={[126.982,37.553]} mapboxAccessToken="" traveledMeters={420} routeMeters={2020} />
    </MapBottomLeftStack>
    <RideControlBar stage={panel==='summary'?'summary':stage} routeLoading={params.has('loading')}
      routeSetupToken={routeSetupToken} startPulseKey={rideStartPulseKey}
      canStartRide={!params.has('blocked')} onStartRide={()=>setStage('riding')} onPauseRide={()=>setStage('paused')} onResumeRide={()=>setStage('riding')} onModifyFromPause={()=>setStage('setup')}
      onEndRide={()=>{setPanel(params.has('short')?'ready':'summary');setStage(params.has('short')?'ready-to-start':'idle');}} resumeRatio={params.has('resume')?0.4:null}
      cadence={{state:sensorState,open:panel==='sensor',onOpen:()=>setPanel('sensor')}} />
    {params.has('short') ? <button type="button" style={{position:'absolute',left:'45%',bottom:4,zIndex:9}} onClick={()=>setRouteSetupToken({})}>검수용 새 경로 확정</button> : null}
    <MapHud stage={stage} onOpenMenu={()=>setPanel('menu')} menuOpen={panel==='menu'}
      account={glanceCapture?{initial:'R',isGuest:false,label:'Ridingman12',mileageKm:178}:{initial:'G',isGuest:true,label:long?'아주긴닉네임라이더테스트':'게스트 라이더',mileageKm:null}}
      onOpenUserInfo={()=>setPanel('account')} userInfoOpen={panel==='account'} onOpenMapView={()=>setPanel('map')} mapViewOpen={panel==='map'}
      coachData={active?{tip:'Relax and find your rhythm',resistance:'Resistance 3',intensity:'MODERATE',action:'PEDAL',tipId:'tip_26'}:null} coachLineEnabled={active}
      cadenceRpm={glanceRiding?82:null}
      metrics={hasRoute?active?{mode:'ride',elapsed:glanceRiding?'00:13':'24:08',distanceKm:glanceRiding?'0.07':'4.20',cumulativeKm:glanceRiding?'0.07':long?'1234.56':'4.20',avgKmh:glanceRiding?'19.8':'18.6',speedKmh:glanceRiding?37:24,routeTotalKm:glanceRiding?'2.02':long?'9999.99':'10.00'}:{mode:'route-preview',distanceKm:long?'1234.56':'2.02',elevation:{status:'ready',startM:46,endM:30}}:null}
      conquestLiveMeters={active?420:null} onClearPins={noop} routeError={params.has('error')?'경로를 찾지 못했습니다. 다른 지점을 선택해 주세요.':null}
      onResumeFromPause={()=>setStage('riding')} onEndFromPause={()=>setPanel('summary')} onModifyFromPause={()=>setStage('setup')}
      quickCamera={active&&!glanceRiding?{active:camera,camera1Mode:flatCameraMode,onSelect:setCamera,onSelectFlat:(mode)=>{setFlatCameraMode(mode);setCamera(1);}}:null} mapControls={{styleLabel:'위성',styleAriaLabel:'맵 스타일 위성, 클릭 시 야외',onToggleStyle:noop,onZoomOut:noop,onZoomIn:noop,zoomOutDisabled:false,zoomInDisabled:false}}
      leaderboardGlanceChip={glanceView?<LeaderboardGlanceChip {...glanceView} />:undefined}
      leaderboardGlancePanel={glanceView && initial!=='glance-summary'?<LeaderboardGlancePanel {...glanceView} />:undefined} />
    <RideSummarySheet open={panel==='summary'||initial==='glance-summary'} result={result} arrivalCompleted={false} elapsedLabel="07:00" avgKmh="18" caloriesEstimate={null}
      story={initial==='glance-summary'?{headline:'첫 라이딩을 마치셨어요. 시작이 가장 어려운 법이에요.',detail:undefined}:{headline:'오늘도 나만의 길을 이었습니다.',detail:'남산공원길에서 1.2km를 달렸습니다.'}}
      adhocSaveAvailable={initial!=='glance-summary' && summaryVariant !== 'closed'}
      onGuestLinkGoogle={initial==='glance-summary' || summaryVariant === 'guest-full' ? noop : undefined}
      onOpenCalorieSettings={summaryVariant === 'guest-full' ? noop : undefined}
      maxNameLength={80}
      suggestedName="서울 남산공원길" onSaveAdhoc={()=>setPanel('ready')} onDismissAdhoc={noop} onClose={()=>setPanel('ready')}
      rankChange={summaryRank} onOpenLeaderboard={noop} />
    {initial === 'nextride-resume' ? (
      <div
        id="batch3-next-ride-fixture"
        data-resume-calls={String(nextRideCalls.resume)}
        data-extend-calls={String(nextRideCalls.extend)}
        data-map-calls={String(nextRideCalls.map)}
        data-dismiss-calls={String(nextRideCalls.dismiss)}
      >
        {!nextRideHidden ? (
          <NextRideCard
            view={nextRideResumeView}
            onResume={() => bumpNextRideCall('resume')}
            onExtend={() => bumpNextRideCall('extend')}
            onShowOnMap={() => bumpNextRideCall('map')}
            onDismiss={() => {
              bumpNextRideCall('dismiss');
              setNextRideHidden(true);
            }}
          />
        ) : null}
      </div>
    ) : null}
    {initial === 'nextride-extend' ? (
      <div
        id="batch3-next-ride-fixture"
        data-resume-calls={String(nextRideCalls.resume)}
        data-extend-calls={String(nextRideCalls.extend)}
        data-map-calls={String(nextRideCalls.map)}
        data-dismiss-calls={String(nextRideCalls.dismiss)}
      >
        {!nextRideHidden ? (
          <NextRideCard
            view={nextRideExtendView}
            onResume={() => bumpNextRideCall('resume')}
            onExtend={() => bumpNextRideCall('extend')}
            onShowOnMap={() => bumpNextRideCall('map')}
            onDismiss={() => {
              bumpNextRideCall('dismiss');
              setNextRideHidden(true);
            }}
          />
        ) : null}
      </div>
    ) : null}
    <RideSettingsSheet open={panel==='settings'} onClose={()=>setPanel('ready')}
      rideTtsEnabled={rideTtsEnabled} onRideTtsEnabled={setRideTtsEnabled}
      rideBgmEnabled={rideBgmEnabled} onRideBgmEnabled={setRideBgmEnabled}
      rideCoachingBanner={rideCoachingBanner} onRideCoachingBanner={setRideCoachingBanner}
      pacerEnabled={pacerEnabled} onPacerEnabled={setPacerEnabled}
      rideBgmCatalogConfigured rideElevationProfileLoading={false}
      calorieWeightKg={weight} calorieIntensityId={intensity}
      onEditProfile={() => {
        setSettingsProfileNavCalls((n) => n + 1);
        setPanel('profile');
      }} />
    <ProfileEditSheet
      open={panel==='profile'}
      onClose={() => setPanel(initial === 'settings' ? 'settings' : 'ready')}
      user={profileUser}
      weightKg={weight}
      intensityId={intensity}
      nicknameChangedAtMs={profileNicknameChangedAtMs}
      onChangeNickname={async () => {
        setProfilePersistCalls((prev) => ({ ...prev, nickname: prev.nickname + 1 }));
      }}
      onWeightKg={(raw) => {
        const parsed = raw.trim() === '' ? null : Number(raw);
        setWeight(parsed != null && Number.isFinite(parsed) ? parsed : null);
        setProfilePersistCalls((prev) => ({ ...prev, weight: prev.weight + 1 }));
        return true;
      }}
      onIntensityId={(id) => {
        setIntensity(id);
        setProfilePersistCalls((prev) => ({ ...prev, intensity: prev.intensity + 1 }));
        return true;
      }}
    />
    <UserInfoSheet open={panel==='account'} onClose={()=>setPanel('ready')} user={null}
      recentSessions={params.has('historyPreview')?previewRideSessions:[]}
      isGuest tier="anonymous" subscriptionStatus="none" isPaid={false} busy={false}
      conquest={params.has('loading')?null:params.has('historyPreview')?{totalMeters:12400,totalCells:42}:{totalMeters:0,totalCells:0}}
      mileage={params.has('historyPreview')?{totalMeters:8500,totalSec:3120,rideCount:3}:{totalMeters:0,totalSec:0,rideCount:0}}
      onServiceExit={noop} onLinkGoogle={noop} />
    <CadenceSensorSheet
      open={panel==='sensor'}
      onClose={()=>setPanel('ready')}
      capable={sensorCapable}
      uiState={sensorUiState}
      deviceLabel={sensorSheet.deviceLabel}
      crankRpm={sensorCrankRpm}
      errorMessage={sensorSheet.errorMessage}
      mode={sensorMode}
      readiness={sensorReadiness}
      riding={sensorRiding}
      manualSpeedKmh={speed}
      onManualSpeedKmh={setSpeed}
      onConnect={() => {
        bumpSensorCall('connect');
        setSensorSheet((prev) => ({ ...prev, uiState: 'connecting' }));
      }}
      onDisconnect={() => {
        bumpSensorCall('disconnect');
        setSensorSheet((prev) => ({
          ...prev,
          uiState: 'disconnected',
          crankRpm: null,
          errorMessage: '연결이 끊어졌습니다.',
        }));
      }}
      onChooseManual={() => {
        bumpSensorCall('manual');
        setManual(true);
        setSensorSheet((prev) => ({ ...prev, mode: 'manual', readiness: 'manual-ready' }));
      }}
      onChooseCadence={() => {
        bumpSensorCall('cadence');
        setManual(false);
        setSensorSheet((prev) => ({
          ...prev,
          mode: 'cadence',
          uiState: 'connected',
          crankRpm: 82,
          readiness: 'cadence-ready',
        }));
      }}
    />
    <MapViewSheet open={panel==='map'} revealProgress={mapReveal} onClose={()=>setPanel('ready')}
      coverageOverlayMode={coverage} onCoverageOverlayMode={setCoverage}
      enable3D={enable3D} onEnable3D={setEnable3D}
      rideActive={active} rideCameraDistanceM={rideCameraDistanceM} onRideCameraDistanceM={setRideCameraDistanceM}
      conquestDisplayMode={conquest} conquestHasRecentGeometry={mapRecentGeometry}
      onConquestDisplayMode={setConquest} onShowAllConquest={() => setMapRecentGeometry(true)} />
    {panel==='routes'?<OfficialCourseListModal segment="intro" onClose={()=>setPanel('ready')} basicSharedHubs={getBasicSharedHubSummaries()} basicActiveHubCourseId={null}
      basicStartLoading={false} basicStartHubJoined={false} routeLoading={false} sessionIdle officialCourseCatalogAvailable publishedPublicCourses={[]}
      publishedPublicCoursesLoading={false} publishedPublicCoursesError={null} signedIn onEnterBasicHub={()=>setPanel('ready')} onLeaveBasicHub={noop}/>:null}
    <MenuPanel open={panel==='menu'} revealProgress={menuReveal} onClose={()=>setPanel('ready')}>
      <RideRoutePanel routeSummary="" routeLoading={false} basicSharedHubs={getBasicSharedHubSummaries()} basicActiveHubCourseId={null}
        basicStartLoading={false} basicStartHubJoined={false} officialCourseCatalogAvailable publishedPublicCourses={getBasicSharedHubSummaries()}
        publishedPublicCoursesLoading={false} publishedPublicCoursesError={null} authGuest signedIn onEnterBasicHub={()=>setPanel('ready')} onLeaveBasicHub={noop}
        savedRoutes={[]} savedRoutesLoading={false} onLoadSavedRoute={noop} onRenameSavedRoute={noop} onDeleteSavedRoute={noop}
        arrivalToastVisible={false} adhocSaveAvailable={false} onSaveAdhocAsUserRoute={noop} onDismissAdhocSave={noop}
        rideTtsEnabled onRideTtsEnabled={noop} rideBgmEnabled onRideBgmEnabled={noop} rideCoachingBanner onRideCoachingBanner={noop}
        pacerEnabled onPacerEnabled={noop} rideElevationProfileLoading={false} rideBgmCatalogConfigured
        onOpenSettings={()=>setPanel('settings')} onOpenPlaceSearch={noop} onOpenLeaderboard={noop}
        leaderboardMenuAside={<>이번 주 <b>2</b>위</>} />
    </MenuPanel>
    {panel==='intro'?<AppIntroScreen onStartGuest={()=>setPanel('location')} onLogin={()=>setPanel('location')}/>:null}
    {panel==='location'?<EntryLocationDialog phase="choice" permission="prompt" onChooseRome={()=>setPanel('ready')} onChooseCurrent={()=>setPanel('ready')} onPosition={noop}/>:null}
    {isBatch4Fixture ? (
      <div
        id="batch4-fixture"
        aria-hidden="true"
        data-ui-stage={stage}
        data-manual-speed-kmh={String(speed)}
        data-sensor-connect-calls={String(sensorCalls.connect)}
        data-sensor-disconnect-calls={String(sensorCalls.disconnect)}
        data-sensor-manual-calls={String(sensorCalls.manual)}
        data-sensor-cadence-calls={String(sensorCalls.cadence)}
        data-settings-profile-nav-calls={String(settingsProfileNavCalls)}
        data-ride-tts={rideTtsEnabled ? '1' : '0'}
        data-ride-bgm={rideBgmEnabled ? '1' : '0'}
        data-ride-coaching={rideCoachingBanner ? '1' : '0'}
        data-pacer={pacerEnabled ? '1' : '0'}
        data-weight-kg={weight == null ? '' : String(weight)}
        data-intensity-id={intensity ?? ''}
        data-profile-nickname-calls={String(profilePersistCalls.nickname)}
        data-profile-weight-calls={String(profilePersistCalls.weight)}
        data-profile-intensity-calls={String(profilePersistCalls.intensity)}
        data-map-enable3d={enable3D ? '1' : '0'}
        data-map-coverage={coverage}
        data-map-conquest={conquest}
        data-map-recent={mapRecentGeometry ? '1' : '0'}
        data-map-camera-m={String(rideCameraDistanceM)}
      />
    ) : null}
  </main>;
}

export { Preview };

createRoot(document.getElementById('root')!).render(<Preview/>);
