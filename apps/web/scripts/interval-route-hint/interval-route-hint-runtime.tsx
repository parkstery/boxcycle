// 경로 거리 부족 안내 — 실제 useRideInterval·useIntervalRouteHint·IntervalRouteHint·IntervalRouteConfirm·인터벌 운동 창 통합.
// 지도·경로 탐색은 뺐다: 「경로 N km」 버튼이 경로 적용을 대신한다. 주행 시작 판정은 App.handleStartRide 와 같은 함수 호출이다
// (App 쪽 연결은 scripts/interval-route-hint/interval-route-distance.test.ts 의 소스 계약이 지킨다).
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntervalRouteConfirm } from '../../src/components/ride/IntervalRouteConfirm';
import { IntervalRouteHint } from '../../src/components/ride/IntervalRouteHint';
import { RideIntervalSettingsSheet } from '../../src/components/ride/RideIntervalSettingsSheet';
import { useIntervalRouteHint } from '../../src/hooks/useIntervalRouteHint';
import { useRideInterval } from '../../src/hooks/useRideInterval';
import { getRideIntervalTotalSec, RIDE_INTERVAL_PRESETS } from '../../src/lib/ride/rideInterval';
import { intervalRouteHintRouteKey, resolveIntervalRouteShortfall } from '../../src/lib/route/intervalRouteDistance';
import type { LineStringGeometry } from '../../src/lib/geo/geo';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/boxcycle-theme.css';

const PRESET_15 = RIDE_INTERVAL_PRESETS.find((p) => p.id === '15min')!.config;
const routeOf = (km: number): LineStringGeometry => ({ type: 'LineString', coordinates: [[127, 37.5], [127 + km / 100, 37.5]] });
const bar: React.CSSProperties = { position: 'absolute', left: 12, top: 12, zIndex: 5, display: 'flex', gap: 8 };

export function Runtime() {
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const interval = useRideInterval(status, 0, false, PRESET_15);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [route, setRoute] = useState<{ geometry: LineStringGeometry; meters: number } | null>(null);
  const [quickSearching, setQuickSearching] = useState(false);
  const [confirmation, setConfirmation] = useState<{ key: string; speedKmh: number } | null>(null);
  const intervalSec = getRideIntervalTotalSec(interval.config);
  const meters = route?.meters ?? 0;
  const hint = useIntervalRouteHint({
    idle: status === 'idle',
    intervalEnabled: interval.enabled,
    intervalSec,
    intervalKey: interval.runKey,
    routeKey: intervalRouteHintRouteKey(route?.geometry, meters),
    remainingMeters: meters,
    quickSearching,
    deferred: sheetOpen || confirmation !== null,
  });
  const start = (acceptedKey?: string) => {
    if (!route || status !== 'idle') return;
    const shortfall = resolveIntervalRouteShortfall({ remainingMeters: meters, intervalSec });
    if (interval.enabled && shortfall.short) {
      const key = JSON.stringify([route.meters, shortfall.basisKmh, interval.config]);
      if (acceptedKey !== key) { setConfirmation({ key, speedKmh: shortfall.basisKmh }); return; }
    }
    setStatus('running');
  };
  const applyRoute = (km: number) => setRoute({ geometry: routeOf(km), meters: km * 1000 });
  return <div style={{ position: 'absolute', inset: 0, background: '#dfe8dc' }}>
    <div style={bar}>
      <button type="button" onClick={() => applyRoute(4)}>경로 4 km</button>
      <button type="button" onClick={() => applyRoute(7)}>경로 7 km</button>
      <button type="button" onClick={() => setRoute(null)}>경로 지우기</button>
      <button type="button" aria-label="인터벌 운동 설정" onClick={() => setSheetOpen(true)}>INT</button>
      <button type="button" onClick={() => start()}>주행 시작</button>
      {/* 간편 인터벌 흉내: 탐색 중에 경로가 적용되고, 끝나면서 인터벌이 켜진다(App 의 onFound 순서). */}
      <button type="button" onClick={() => setQuickSearching(true)}>간편 탐색 시작</button>
      <button type="button" onClick={() => { applyRoute(4); setQuickSearching(false); interval.onEnabled(true); }}>간편 경로 적용</button>
    </div>
    <RideIntervalSettingsSheet open={sheetOpen} config={interval.config} restartOnApply={false} enabled={interval.enabled} onEnabled={interval.onEnabled}
      onApply={interval.onConfig} onClose={() => setSheetOpen(false)} />
    <IntervalRouteConfirm open={confirmation !== null} speedKmh={confirmation?.speedKmh ?? 20} onCancel={() => setConfirmation(null)}
      onConfirm={() => { const pending = confirmation; setConfirmation(null); if (pending) start(pending.key); }} />
    <IntervalRouteHint open={hint.open} variant={hint.variant} intervalSec={intervalSec} minKm={hint.minKm} routeKm={hint.routeKm} basisKmh={hint.basisKmh} onClose={hint.dismiss} />
    <output id="hint-runtime-state" style={{ position: 'absolute', bottom: 0, left: 0, pointerEvents: 'none', fontSize: 9 }}>
      {JSON.stringify({ status, intervalOn: interval.enabled, intervalSec, meters, hintOpen: hint.open, variant: hint.variant })}
    </output>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Runtime />);
