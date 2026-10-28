/**
 * 묶음5 — 실제 `buildPickPopup` 최소 하네스 (지시65).
 * MapView `route-pick-dock` / `map-view__pick-popup` 마크업과 동일한 닫기·호스트 구조.
 */
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/components/map/MapView.css';
import '../../src/components/map/RoutePickPopup.css';
import { buildPickPopup, type PickPopupAutoRouteUi } from '../../src/components/map/mapPopupElements';
import {
  bindRouteTokenUser,
  setSubscribedRouteTokenBalance,
} from '../../src/lib/account/routeTokenSpendBridge';
import {
  getDistanceAutoRouteMapBridge,
  registerDistanceAutoRouteMapBridge,
  type DistanceAutoRouteMapBridge,
} from '../../src/lib/map/distanceAutoRouteMapBridge';
import { MAX_ROUTE_WAYPOINTS } from '../../src/lib/geo/routeWaypoints';
import type { LngLat } from '../../src/lib/geo/geo';
import type { RouteProfile } from '../../src/services/mapboxDirections';

const FIXTURE_UID = 'batch5-fixture-user';
const LNG_LAT: LngLat = [126.98, 37.55];

type FixtureState =
  | 'location'
  | 'distance'
  | 'no-start'
  | 'token-empty'
  | 'searching'
  | 'failed'
  | 'ready-start'
  | 'waypoints-max';

function readState(): FixtureState {
  const raw = new URLSearchParams(location.search).get('state') ?? 'location';
  const allowed: FixtureState[] = [
    'location',
    'distance',
    'no-start',
    'token-empty',
    'searching',
    'failed',
    'ready-start',
    'waypoints-max',
  ];
  return (allowed.includes(raw as FixtureState) ? raw : 'location') as FixtureState;
}

function mountDocked(mapView: HTMLElement, pickContent: HTMLElement, onClose: () => void) {
  const layer = document.createElement('div');
  layer.className = 'map-view__pick-dock-layer';
  const panel = document.createElement('div');
  panel.className = 'map-view__pick-dock-panel';
  panel.style.left = '12px';
  panel.style.top = '12px';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'map-view__pick-dock-close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', onClose);
  panel.append(closeBtn, pickContent);
  layer.append(panel);
  mapView.append(layer);
}

function mountFloatingPopup(mapView: HTMLElement, pickContent: HTMLElement, onClose: () => void) {
  const shell = document.createElement('div');
  shell.className = 'map-view__pick-popup mapboxgl-popup';
  shell.style.position = 'absolute';
  shell.style.left = '12px';
  shell.style.top = '12px';
  shell.style.maxWidth = 'min(228px, calc(100vw - 1.5rem))';
  const surface = document.createElement('div');
  surface.className = 'mapboxgl-popup-content';
  surface.style.position = 'relative';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mapboxgl-popup-close-button';
  closeBtn.setAttribute('aria-label', '팝업 닫기');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', onClose);
  surface.append(closeBtn, pickContent);
  shell.append(surface);
  mapView.append(shell);
}

function bumpDataset(host: HTMLElement, key: string, delta = 1) {
  const attr = `data-${key}`;
  const prev = Number.parseInt(host.getAttribute(attr) ?? '0', 10);
  host.setAttribute(attr, String(prev + delta));
}

function setDataset(host: HTMLElement, key: string, value: string) {
  host.setAttribute(`data-${key}`, value);
}

function init() {
  const host = document.getElementById('batch5-fixture');
  if (!host) throw new Error('batch5-fixture root missing');

  const state = readState();
  setDataset(host, 'ui-state', state);
  setDataset(host, 'select-point-calls', '0');
  setDataset(host, 'route-profile-calls', '0');
  setDataset(host, 'close-calls', '0');
  setDataset(host, 'start-ride-calls', '0');
  setDataset(host, 'clear-route-calls', '0');
  setDataset(host, 'arm-direction-calls', '0');
  setDataset(host, 'preview-circle-calls', '0');
  setDataset(host, 'waypoint-count', '0');

  const initialHasStart = state !== 'no-start';
  const initialHasEnd =
    state === 'location' ||
    state === 'token-empty' ||
    state === 'ready-start' ||
    state === 'waypoints-max';
  const initialHasRoute = state === 'token-empty' || state === 'ready-start';
  const initialRoutePickView: 'location' | 'distance' =
    state === 'distance' || state === 'searching' || state === 'failed' ? 'distance' : 'location';
  const waypointCount = state === 'waypoints-max' ? MAX_ROUTE_WAYPOINTS : 0;
  setDataset(host, 'waypoint-count', String(waypointCount));

  let tokenBlocked = state === 'token-empty';
  let liveWaypointCount = waypointCount;
  let lastProfile: RouteProfile = 'cycling';

  bindRouteTokenUser(FIXTURE_UID);
  setSubscribedRouteTokenBalance(
    FIXTURE_UID,
    state === 'token-empty' ? 0 : 8,
  );

  const bridge: DistanceAutoRouteMapBridge = {
    sessionActive: state === 'searching' || state === 'failed',
    targetKm: 5,
    statusMessage: state === 'failed' ? '검수용 실패 메시지' : null,
    distanceDirectionMode:
      state === 'distance' || state === 'searching' || state === 'failed',
    setDistanceDirectionMode: (enabled) => {
      bridge.distanceDirectionMode = enabled;
      setDataset(host, 'distance-direction-mode', enabled ? '1' : '0');
    },
    suspendPopupPick: () => {},
    releasePickArm: () => {},
    disarm: () => {
      setDataset(host, 'bridge-disarm', '1');
    },
    getArmedStart: () => (initialHasStart ? LNG_LAT : null),
  };
  registerDistanceAutoRouteMapBridge(bridge);

  const ac = new AbortController();
  let autoRouteUi: PickPopupAutoRouteUi | null = null;

  const mapView = document.createElement('div');
  mapView.className = 'map-view';
  mapView.style.cssText =
    'position:relative;min-height:100vh;box-sizing:border-box;background:#e8edf5;';

  const pickContent = buildPickPopup({
    lngLat: LNG_LAT,
    initialStart: initialHasStart ? LNG_LAT : null,
    initialHasStart,
    initialHasEnd,
    initialHasRoute,
    initialRoutePickView,
    routeProfile: 'cycling',
    autoRouteSessionActive: bridge.sessionActive,
    autoRouteTargetKm: bridge.targetKm,
    autoRouteStatusMessage: bridge.statusMessage,
    getWaypointCount: () => liveWaypointCount,
    accessToken: state === 'no-start' ? '' : 'pk.batch5-fixture',
    signal: ac.signal,
    onSelectPoint: (kind) => {
      bumpDataset(host, 'select-point-calls');
      setDataset(host, 'last-select-kind', kind);
      if (kind === 'waypoint') {
        liveWaypointCount = Math.min(MAX_ROUTE_WAYPOINTS, liveWaypointCount + 1);
        setDataset(host, 'waypoint-count', String(liveWaypointCount));
      }
    },
    onRouteProfile: (profile) => {
      bumpDataset(host, 'route-profile-calls');
      lastProfile = profile;
      setDataset(host, 'last-profile', profile);
    },
    onSetRouteProfileOnly: () => {},
    onArmDirectionPick: () => {
      bumpDataset(host, 'arm-direction-calls');
      if (tokenBlocked) {
        return { ok: false, message: 'Route Token이 부족합니다.' };
      }
      return { ok: true };
    },
    onPreviewDistanceAutoRouteCircle: () => {
      bumpDataset(host, 'preview-circle-calls');
    },
    onRegisterAutoRouteUi: (ui) => {
      autoRouteUi = ui;

    },
    getRouteTokenInsufficient: () => tokenBlocked,
    onClearRoute: () => {
      bumpDataset(host, 'clear-route-calls');
    },
    onStartRide: () => bumpDataset(host, 'start-ride-calls'),
    getCanStartRide: () => state === 'ready-start',
    closePopup: () => {
      bumpDataset(host, 'close-calls');
      ac.abort();
      mapView.replaceChildren();
    },
  });

  const onClose = () => {
    bumpDataset(host, 'close-calls');
    ac.abort();
    mapView.replaceChildren();
  };

  if (initialHasStart) {
    mountDocked(mapView, pickContent, onClose);
  } else {
    mountFloatingPopup(mapView, pickContent, onClose);
  }

  host.replaceChildren(mapView);
  host.className = 'map-view-shell';
  host.id = 'batch5-fixture';

  Object.defineProperty(host, 'setTokenBlocked', {
    value: (blocked: boolean) => {
      tokenBlocked = blocked;
      setDataset(host, 'token-blocked', blocked ? '1' : '0');
      autoRouteUi?.syncRideStart();
    },
    enumerable: false,
  });

  Object.defineProperty(host, 'getBridge', {
    value: () => getDistanceAutoRouteMapBridge(),
    enumerable: false,
  });

  queueMicrotask(() => {
    if (state === 'searching') autoRouteUi?.setInlinePhase('searching', '목표 거리에 맞는 도로 경로를 찾는 중입니다…');
    if (state === 'failed') autoRouteUi?.setInlinePhase('failed', '경로를 찾지 못했습니다.');
  });
  setDataset(host, 'last-profile', lastProfile);
  setDataset(host, 'fixture-ready', '1');
  console.log('fixture-ready');
}

init();
