/** Real UI components with in-memory state only. No authentication or ride writes. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/tokens.css';
import '../../src/index.css';
import '../../src/boxcycle-theme.css';
import { MapHud } from '../../src/components/maphud/MapHud';
import { RideSettingsSheet } from '../../src/components/ride/RideSettingsSheet';
import { MenuPanel } from '../../src/components/MenuPanel';
import { RideRoutePanel } from '../../src/components/ride/RideRoutePanel';
import { TrailHubPanel } from '../../src/components/trail/TrailHubPanel';
import { getBasicSharedHubSummaries } from '../../src/lib/route/repo/firestoreCourses';
import type { PublishedPublicCourseSummary } from '../../src/lib/route/repo/firestoreCourses';
import type { SavedRoute } from '../../src/lib/route/repo/firestoreSavedRoutes';
import { validateSavedRouteName } from '../../src/lib/route/repo/firestoreSavedRoutes';
import type { TrailInstance } from '../../src/lib/trail/trailTypes';
import { DEFAULT_TRAIL_ID } from '../../src/lib/trail/trailId';
import type { CalorieIntensityId } from '../../src/lib/ride/caloriesEstimate';
import './preview.css';

/*
 * 묶음 1(MENU + 경로 목록) 메모리 전용 프리뷰 — 실제 제품 컴포넌트·CSS를 임포트한다.
 * 인증·Firestore·운영 쓰기는 없다. 상태는 전부 이 파일의 useState 에서 굴린다.
 *
 * URL 파라미터:
 *   (없음)      시안 06·07 의 대표 상태(데이터 있는 메뉴·목록)
 *   ?empty      빈 상태 — 입문·퍼블릭·내 경로·Trail 전부 없음
 *   ?long       긴 이름 상태 — 경로·Trail 이름이 40자·긴 지명에 가까움
 *   ?loading    목록 불러오는 중 상태
 */

const noop = () => {};
const LONG_ROUTE_NAME = '대한민국 서울특별시 용산구 남산공원길 126 아주 긴 경로 이름 테스트';
const LONG_TRAIL_REGION = '대한민국 강원특별자치도 원주시 아주 긴 목적지 지명 표기 테스트';

type SavedRouteOverwrite = Partial<SavedRoute> & { id: string; name: string };

function savedRoute(over: SavedRouteOverwrite): SavedRoute {
  const base: SavedRoute = {
    id: over.id,
    name: over.name,
    profile: 'cycling',
    startLngLat: [126.978, 37.55],
    endLngLat: [126.995, 37.561],
    waypoints: [],
    geometry: { type: 'LineString', coordinates: [[126.978, 37.55], [126.995, 37.561]] },
    distanceMeters: 2020,
    durationSec: 420,
    createdAtIso: '2026-10-19T08:00:00Z',
    updatedAtIso: '2026-10-21T09:30:00Z',
    completed: 0,
    completedAtIso: null,
    expiresAtIso: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastRideId: null,
    lastProgressRatio: 0,
  };
  return { ...base, ...over };
}

type PublicationOverwrite = Partial<PublishedPublicCourseSummary> & { id: string; title: string };

function publicPublication(over: PublicationOverwrite): PublishedPublicCourseSummary {
  const base: PublishedPublicCourseSummary = {
    id: over.id,
    title: over.title,
    profile: 'cycling',
    distanceMeters: 2020,
    durationSec: 420,
    routeId: over.id,
    publicationId: over.id,
    sourceSavedRouteId: null,
    applicantUid: 'harness-uid',
    publisherNickname: null,
    publishedAtMs: Date.parse('2026-10-21T09:00:00Z') + Number(over.id.replace(/\D/g, '') || 0),
  };
  return { ...base, ...over };
}

type TrailOverwrite = Partial<TrailInstance> & { id: string; regionLabel: string };

function openTrail(over: TrailOverwrite): TrailInstance {
  const now = Date.now();
  const base: TrailInstance = {
    id: over.id,
    hostUid: 'harness-host',
    displayNumber: 12,
    publicationId: 'pub-harness',
    regionLabel: over.regionLabel,
    distanceKm: 2.0,
    visibility: 'open',
    status: 'open',
    createdAtMs: now - 60 * 60 * 1000,
    lastActivityAtMs: now - 30 * 1000,
    liveRiderCount: 2,
  };
  return { ...base, ...over };
}

const DEFAULT_PUBLICATIONS = [
  { id: 'p1', title: '서울 남산공원길', distanceMeters: 2020 },
  { id: 'p2', title: '암스테르담 폰델파크', distanceMeters: 5000 },
  { id: 'p3', title: '파리 퐁뇌프', distanceMeters: 450 },
  { id: 'p4', title: '뉴욕 센트럴파크', distanceMeters: 3200 },
].map((c) => publicPublication({ id: c.id, title: c.title, distanceMeters: c.distanceMeters }));

const LONG_PUBLICATIONS = [
  { id: 'p1', title: '암스테르담 폰델파크 반대 방향 아주 긴 이름의 퍼블릭 코스 표기 테스트', distanceMeters: 2020 },
  { id: 'p2', title: '서울 남산공원길', distanceMeters: 500 },
  { id: 'p3', title: '파리 퐁뇌프', distanceMeters: 450 },
  { id: 'p4', title: '뉴욕 센트럴파크', distanceMeters: 3200 },
].map((c) => publicPublication({ id: c.id, title: c.title, distanceMeters: c.distanceMeters }));

const DEFAULT_SAVED_ROUTES = [
  savedRoute({ id: 's1', name: '서울 남산공원길', completed: 1, completedAtIso: '2026-10-19T08:30:00Z', expiresAtIso: null, lastProgressRatio: 1 }),
  savedRoute({ id: 's2', name: '한강 이어달리기', distanceMeters: 410, lastProgressRatio: 0.43 }),
  savedRoute({ id: 's3', name: '대기 남산 둘레길', distanceMeters: 5000 }),
  savedRoute({ id: 's4', name: '곧 만료 대기길', distanceMeters: 320, expiresAtIso: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString() }),
  savedRoute({ id: 's5', name: '공개된 폰델파크', completed: 1, completedAtIso: '2026-10-18T21:00:00Z', expiresAtIso: null, distanceMeters: 2200 }),
  savedRoute({ id: 's6', name: '부산 해운대', distanceMeters: 1800, profile: 'driving' }),
];

const LONG_SAVED_ROUTES = [
  savedRoute({ id: 's1', name: LONG_ROUTE_NAME, distanceMeters: 2020 }),
  savedRoute({ id: 's2', name: '한강 이어달리기', distanceMeters: 410, lastProgressRatio: 0.43 }),
  savedRoute({ id: 's3', name: '대기 남산 둘레길', distanceMeters: 5000 }),
];

const DEFAULT_OPEN_TRAILS = [
  openTrail({ id: 't1', regionLabel: 'Vondelpark 한 바퀴', distanceKm: 2.0, liveRiderCount: 2, createdAtMs: Date.now() - 2 * 60 * 60 * 1000 }),
  openTrail({ id: 't2', regionLabel: '남산 순환로', distanceKm: 5.4, liveRiderCount: 1, createdAtMs: Date.now() - 60 * 60 * 1000 }),
];

const LONG_OPEN_TRAILS = [
  openTrail({ id: 't1', regionLabel: 'Vondelpark 한 바퀴', distanceKm: 2.0, liveRiderCount: 2, createdAtMs: Date.now() - 2 * 60 * 60 * 1000 }),
  openTrail({ id: 't2', regionLabel: LONG_TRAIL_REGION, distanceKm: 5.4, liveRiderCount: 1 }),
];

export function Preview() {
  const params = new URLSearchParams(window.location.search);
  const empty = params.has('empty');
  const long = params.has('long');
  const loading = params.has('loading');

  const basicSharedHubs = empty ? [] : getBasicSharedHubSummaries();
  const publishedPublications = empty ? [] : long ? LONG_PUBLICATIONS : DEFAULT_PUBLICATIONS;
  const openTrails = empty ? [] : long ? LONG_OPEN_TRAILS : DEFAULT_OPEN_TRAILS;
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(
    empty ? [] : long ? LONG_SAVED_ROUTES : DEFAULT_SAVED_ROUTES,
  );
  const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
  const [activeResumeRouteId, setActiveResumeRouteId] = useState<string | null>(
    empty || loading ? null : 's2',
  );
  const [menuOpen, setMenuOpen] = useState(params.get('state') === 'menu');
  const [lastAction, setLastAction] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rideTtsEnabled, setRideTtsEnabled] = useState(true);
  const [rideBgmEnabled, setRideBgmEnabled] = useState(true);
  const [rideCoachingBanner, setRideCoachingBanner] = useState(false);
  const [pacerEnabled, setPacerEnabled] = useState(false);
  const [calorieWeightKg, setCalorieWeightKg] = useState<number | null>(null);
  const [calorieIntensityId, setCalorieIntensityId] = useState<CalorieIntensityId | null>(null);

  return (
    <main className="audit-world">
      <svg className="audit-map" viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
        <rect width="800" height="360" fill="#2E3A2F" />
        <ellipse cx="560" cy="200" rx="260" ry="120" fill="#35503C" />
        <path d="M-20 320 C 160 270, 300 300, 460 240 S 700 190, 820 210" stroke="#3E6B8A" strokeWidth="24" strokeOpacity="0.7" fill="none" />
        <path d="M-10 110 C 200 90, 420 140, 810 80" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="480" cy="250" r="8" fill="#1E9A55" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="audit-map-attribution">검수용 지도 배경 · 실제 제품 컴포넌트 · 서버 기록 없음</div>
      <MapHud
        stage="ready-to-start"
        onOpenMenu={() => setMenuOpen(true)}
        menuOpen={menuOpen}
        account={{ initial: 'R', isGuest: false, label: 'Ridingman12', mileageKm: 178 }}
        onOpenUserInfo={noop}
        userInfoOpen={false}
        onOpenMapView={noop}
        mapViewOpen={false}
        coachData={null}
        coachLineEnabled={false}
        metrics={null}
        onClearPins={noop}
        routeError={null}
        onResumeFromPause={noop}
        onEndFromPause={noop}
        onModifyFromPause={noop}
        mapControls={{
          styleLabel: '위성',
          styleAriaLabel: '맵 스타일 위성, 클릭 시 야외',
          onToggleStyle: noop,
          onZoomOut: noop,
          onZoomIn: noop,
          zoomOutDisabled: false,
          zoomInDisabled: false,
        }}
      />
      <RideSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rideTtsEnabled={rideTtsEnabled}
        onRideTtsEnabled={setRideTtsEnabled}
        rideBgmEnabled={rideBgmEnabled}
        onRideBgmEnabled={setRideBgmEnabled}
        rideCoachingBanner={rideCoachingBanner}
        onRideCoachingBanner={setRideCoachingBanner}
        pacerEnabled={pacerEnabled}
        onPacerEnabled={setPacerEnabled}
        rideBgmCatalogConfigured
        rideElevationProfileLoading={false}
        calorieWeightKg={calorieWeightKg}
        onCalorieWeightKg={(raw) => setCalorieWeightKg(Number(raw) || null)}
        calorieIntensityId={calorieIntensityId}
        onCalorieIntensityId={setCalorieIntensityId}
      />
      <MenuPanel
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
      >
        <RideRoutePanel
          onOpenSettings={() => { setMenuOpen(false); setSettingsOpen(true); }}
          onOpenPlaceSearch={() => setLastAction('지명 검색')}
          onOpenLeaderboard={() => setLastAction('순위')}
          leaderboardMenuAside={
            <span>
              이번 주 <b>3</b>위
            </span>
          }
          routeSummary=""
          routeLoading={false}
          basicSharedHubs={basicSharedHubs}
          basicActiveHubCourseId={activePublicationId}
          basicStartLoading={false}
          basicStartHubJoined={false}
          officialCourseCatalogAvailable
          publishedPublicCourses={publishedPublications}
          publishedPublicCoursesLoading={loading}
          publishedPublicCoursesError={null}
          authGuest
          signedIn
          onEnterBasicHub={(publicationId) => {
            setActivePublicationId(publicationId);
            setMenuOpen(false);
          }}
          onLeaveBasicHub={noop}
          savedRoutes={savedRoutes}
          savedRoutesLoading={loading}
          onLoadSavedRoute={() => { setLastAction('열기'); setMenuOpen(false); }}
          onResumeSavedRoute={() => { setLastAction('이어 달리기'); setMenuOpen(false); }}
          activeResumeRouteId={activeResumeRouteId}
          onRenameSavedRoute={(route, newName) => {
            const validated = validateSavedRouteName(newName);
            setSavedRoutes((prev) =>
              prev.map((r) => (r.id === route.id ? { ...r, name: validated } : r)),
            );
          }}
          onDeleteSavedRoute={(route) => {
            setSavedRoutes((prev) => prev.filter((r) => r.id !== route.id));
            if (route.id === activeResumeRouteId) setActiveResumeRouteId(null);
          }}
          arrivalToastVisible={false}
          adhocSaveAvailable={false}
          onSaveAdhocAsUserRoute={noop}
          onDismissAdhocSave={noop}
          pendingPublicRouteIds={new Set()}
          publishedPublicSavedRouteIds={empty ? new Set() : long ? new Set() : new Set(['s5'])}
          publishedPublicRouteFingerprints={new Set()}
          rideTtsEnabled={false}
          onRideTtsEnabled={noop}
          rideBgmEnabled={false}
          onRideBgmEnabled={noop}
          rideCoachingBanner={false}
          onRideCoachingBanner={noop}
          pacerEnabled={false}
          onPacerEnabled={noop}
          rideElevationProfileLoading={false}
          rideBgmCatalogConfigured
        />
        <TrailHubPanel
          user={null}
          activeTrailId={DEFAULT_TRAIL_ID}
          currentTrail={null}
          openTrails={openTrails}
          openTrailsLoading={loading}
          openTrailsError={null}
          onJoinTrail={(id) => setLastAction(`합류 ${id}`)}
          onSetVisibility={noop}
        />
      </MenuPanel>
      {lastAction ? <output aria-label="검증 결과">{lastAction}</output> : null}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
