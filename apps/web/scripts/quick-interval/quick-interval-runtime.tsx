// 실제 useDistanceAutoRoute·useQuickIntervalRide·MapView·「INT」→인터벌 운동 창 「간편 인터벌」 통합. e2e에서 경로 API·prewarm만 대체한다.
// ?history=1 이면 마지막 주행 종료점이 있고, 없으면 출발 위치 클릭 안내로 간다.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from 'firebase/auth';
import { MapView } from '../../src/components/map/MapView';
import { QuickIntervalStatus } from '../../src/components/ride/QuickIntervalStatus';
import { RideIntervalSettingsSheet } from '../../src/components/ride/RideIntervalSettingsSheet';
import { useDistanceAutoRoute } from '../../src/hooks/useDistanceAutoRoute';
import { useQuickIntervalRide } from '../../src/hooks/useQuickIntervalRide';
import { resolveQuickIntervalTargetKm } from '../../src/lib/ride/quickIntervalRoute';
import { DEFAULT_RIDE_INTERVAL_CONFIG, getRideIntervalTotalSec, type RideIntervalConfig } from '../../src/lib/ride/rideInterval';
import type { LineStringGeometry, LngLat } from '../../src/lib/geo/geo';
import type { RouteProfile } from '../../src/services/mapboxDirections';
import { bindRouteTokenUser, setSubscribedRouteTokenBalance } from '../../src/lib/account/routeTokenSpendBridge';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/boxcycle-theme.css';

const user = { uid: 'fixture-quick-interval', getIdToken: async () => '' } as User;
const LAST_RIDE_END: LngLat = [127.02, 37.5];
const noop = () => {};

export function Runtime() {
  useEffect(() => { bindRouteTokenUser(user.uid); setSubscribedRouteTokenBalance(user.uid, 100); return () => bindRouteTokenUser(null); }, []);
  const params = new URLSearchParams(location.search);
  const hasHistory = params.get('history') === '1';
  const [start, setStart] = useState<LngLat | null>(null);
  const [end, setEnd] = useState<LngLat | null>(null);
  const [profile, setProfile] = useState<RouteProfile>('cycling');
  const [geometry, setGeometry] = useState<LineStringGeometry | null>(null);
  const [applied, setApplied] = useState(0);
  const [starts, setStarts] = useState(0);
  const [intervalOn, setIntervalOn] = useState(false);
  const [intervalSheetOpen, setIntervalSheetOpen] = useState(false);
  const [intervalConfig, setIntervalConfig] = useState<RideIntervalConfig>(DEFAULT_RIDE_INTERVAL_CONFIG);
  const auto = useDistanceAutoRoute({
    user, functionsRegion: 'asia-northeast3', rideLocked: false, routeTokenInsufficient: false,
    onClearRouteArtifacts: () => {},
    onApplyRoute: r => { setStart(r.start); setEnd(r.end); setProfile(r.profile); setGeometry(r.geometry); setApplied(n => n + 1); },
  });
  const targetKm = resolveQuickIntervalTargetKm(getRideIntervalTotalSec(intervalConfig));
  const quick = useQuickIntervalRide({
    intervalTotalSec: getRideIntervalTotalSec(intervalConfig),
    blockedReason: { rideLocked: false, routeTokenInsufficient: false, signedOut: false, historyLoading: false },
    onBeforeStart: noop,
    lastRideEnd: hasHistory ? LAST_RIDE_END : null,
    autoRouteStep: auto.step,
    prepareStart: (anchor, km) => {
      setStart(anchor); setEnd(null); setGeometry(null); setProfile('cycling');
      const armed = auto.armDirectionPick({ start: anchor, profile: 'cycling', targetKm: km });
      return armed.ok ? { ok: true, profile: 'cycling' } : { ok: false, message: armed.message };
    },
    armStartPick: auto.armStartPick,
    searchTowardPoint: auto.searchTowardPoint,
    disarm: auto.disarm,
    onFound: () => setIntervalOn(true),
  });
  return <>
    <MapView accessToken="pk.fixture" routeElevationProfile={{ values: [], sampledCoords: [], loading: false, error: null, quotaExceeded: false, routeSig: '' }}
      canStartRide={Boolean(geometry)} onStartRide={() => setStarts(n => n + 1)}
      routeGeometry={geometry} startLngLat={start} endLngLat={end} routeWaypoints={[]} liveLngLat={null}
      mapStyle="mapbox://styles/mapbox/outdoors-v12" mapZoom={13} initialCenter={LAST_RIDE_END} initialZoom={13}
      followMode="free" enable3D={false} onMapZoom={() => {}} routeProfile={profile} onRouteProfile={setProfile}
      coverageOverlayMode="off"
      autoRouteSessionActive={auto.sessionActive} autoRouteTargetKm={auto.targetKm} autoRouteStatusMessage={auto.statusMessage}
      autoRouteMapPick={auto.mapPickMode} distanceTargetCircle={auto.circleGeometry}
      onPreviewDistanceAutoRouteCircle={auto.previewCircleAt} onClearDistanceAutoRouteCircle={auto.clearCirclePreview}
      onSuspendAutoRoutePopupPick={auto.suspendPopupPick} onRetryDistanceAutoRoute={auto.retryDirection}
      onArmDirectionPick={input => { const result = auto.armDirectionPick(input); if (result.ok) { setStart(input.start); setProfile(input.profile); } return result; }}
      onAutoRouteMapPick={auto.handleMapPick}
      onClearRoute={() => { setStart(null); setEnd(null); setGeometry(null); auto.disarm(); }}
      onSelectPoint={() => {}}
    />
    <QuickIntervalStatus message={quick.message} failed={quick.phase === 'failed'} onDismiss={quick.cancel} />
    {/* RouteDock 「INT」 자리 — 같은 접근성 이름으로 인터벌 운동 창을 연다(10-30 Chief: 메뉴 행 제거). */}
    <button type="button" aria-label="인터벌 운동 설정" style={{ position: 'absolute', left: 12, bottom: 24, zIndex: 5 }} onClick={() => setIntervalSheetOpen(true)}>INT</button>
    {/* App 과 같은 연결: 창을 닫고 막 적용한 총 시간으로 시작한다. */}
    <RideIntervalSettingsSheet open={intervalSheetOpen} config={intervalConfig} restartOnApply={false} enabled={intervalOn} onEnabled={setIntervalOn}
      onApply={(config) => { setIntervalConfig(config); return true; }} onClose={() => setIntervalSheetOpen(false)}
      onQuickIntervalRide={(sec) => { setIntervalSheetOpen(false); quick.start(sec); }} quickIntervalDisabledReason={quick.disabledReason} />
    <output id="quick-runtime-state" style={{ position: 'absolute', bottom: 0, left: 0, pointerEvents: 'none', fontSize: 9 }}>
      {JSON.stringify({ start, end, applied, starts, intervalOn, targetKm, phase: quick.phase, step: auto.step, mode: auto.mapPickMode })}
    </output>
  </>;
}
createRoot(document.getElementById('root')!).render(<Runtime />);
