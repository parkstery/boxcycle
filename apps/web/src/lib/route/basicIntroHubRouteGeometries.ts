// 자동 생성 — 직접 수정하지 말 것. `node scripts/gen-basic-intro-routes.mjs` 로 재생성한다.
//
// 입문(Basic) 실도로 경로 SoT. Mapbox Directions `cycling` / `overview=full` / GeoJSON 응답을
// 그대로 고정한 seed 이며, runtime 에서 Directions 를 호출하지 않는다.
// `firestoreCourses.ts` 의 `BASIC_COURSES`·`BASIC_SHARED_HUB_IDS` 가 이 파일에서 파생된다.
// 증거: document/archive/260816-입문-실도로-경로-증거/

/** seed 리비전 — geometry 가 바뀌면 올린다(Firestore 재시드 판단에 쓰임). */
export const BASIC_INTRO_HUB_ROUTE_REVISION = 3;

/** 입문 경로 상한 — 좌표 재계산 길이 기준(m) */
export const BASIC_INTRO_MAX_DISTANCE_METERS = 500;

export type BasicIntroHubRouteSeed = {
  id: string;
  order: number;
  title: string;
  description: string;
  profile: "cycling";
  distanceMeters: number;
  durationSec: number;
  roadNames: string[];
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  coordinates: [number, number][];
};

export const BASIC_INTRO_SEOUL_NAMSAN_ROUTE: BasicIntroHubRouteSeed = {
  id: "basic-intro-seoul-namsan",
  order: 1,
  title: "Basic 1 · 서울 남산공원길",
  description: "남산 북사면을 감아 도는 남산공원길 구간. 완만한 곡선으로 조향·카메라에 적응하는 입문 경로.",
  profile: "cycling",
  /** Directions 응답 distance (m) */
  distanceMeters: 414,
  /** Directions 응답 duration (s) */
  durationSec: 120,
  /** 도로 근거 — Directions steps 의 도로명 */
  roadNames: ["남산공원길"],
  bounds: {
    minLng: 126.984975,
    minLat: 37.548219,
    maxLng: 126.988622,
    maxLat: 37.549777,
  },
  coordinates: [
    [126.988622, 37.5486],
    [126.98856, 37.548576],
    [126.988486, 37.548536],
    [126.988395, 37.548517],
    [126.988304, 37.548481],
    [126.988215, 37.54846],
    [126.988168, 37.548391],
    [126.988083, 37.548346],
    [126.988036, 37.548332],
    [126.987979, 37.5483],
    [126.98791, 37.548285],
    [126.987805, 37.548264],
    [126.987663, 37.54826],
    [126.987533, 37.548259],
    [126.987456, 37.548283],
    [126.987431, 37.548291],
    [126.987386, 37.548304],
    [126.987287, 37.54827],
    [126.98717, 37.548241],
    [126.987102, 37.548226],
    [126.987025, 37.548219],
    [126.986948, 37.548224],
    [126.986897, 37.548232],
    [126.986856, 37.54825],
    [126.986811, 37.548286],
    [126.986772, 37.548329],
    [126.986724, 37.548399],
    [126.986552, 37.548703],
    [126.986491, 37.548811],
    [126.986461, 37.548854],
    [126.986428, 37.54888],
    [126.986402, 37.548897],
    [126.986298, 37.548961],
    [126.986018, 37.549137],
    [126.985633, 37.549397],
    [126.9855, 37.549493],
    [126.985423, 37.549534],
    [126.985242, 37.549635],
    [126.985183, 37.549659],
    [126.985078, 37.549709],
    [126.985013, 37.549751],
    [126.984975, 37.549777],
  ],
};

export const BASIC_INTRO_PARIS_PONT_NEUF_ROUTE: BasicIntroHubRouteSeed = {
  id: "basic-intro-paris-pont-neuf",
  order: 2,
  title: "Basic 2 · 파리 퐁뇌프",
  description: "센 강 좌안 Rue de Nevers 에서 퐁뇌프를 건너 시테섬 Quai des Orfèvres 로 이어지는 입문 경로.",
  profile: "cycling",
  /** Directions 응답 distance (m) */
  distanceMeters: 448,
  /** Directions 응답 duration (s) */
  durationSec: 124,
  /** 도로 근거 — Directions steps 의 도로명 */
  roadNames: ["Rue de Nevers", "Pont Neuf", "Quai des Orfèvres"],
  bounds: {
    minLng: 2.33996,
    minLat: 48.854744,
    maxLng: 2.343945,
    maxLat: 48.856861,
  },
  coordinates: [
    [2.33996, 48.856046],
    [2.340059, 48.856083],
    [2.340122, 48.856107],
    [2.340401, 48.856131],
    [2.340462, 48.856165],
    [2.340533, 48.856214],
    [2.340546, 48.856223],
    [2.340578, 48.856248],
    [2.340668, 48.85634],
    [2.340996, 48.856739],
    [2.341005, 48.85675],
    [2.341082, 48.856773],
    [2.34117, 48.856806],
    [2.341228, 48.856833],
    [2.341281, 48.856861],
    [2.341322, 48.856837],
    [2.341361, 48.856808],
    [2.341702, 48.856505],
    [2.342492, 48.855792],
    [2.342698, 48.855612],
    [2.3429, 48.855441],
    [2.343105, 48.855265],
    [2.343149, 48.855226],
    [2.343383, 48.855024],
    [2.343456, 48.854981],
    [2.343783, 48.854818],
    [2.343864, 48.854778],
    [2.343945, 48.854744],
  ],
};

export const BASIC_INTRO_NYC_CENTRAL_PARK_ROUTE: BasicIntroHubRouteSeed = {
  id: "basic-intro-nyc-central-park",
  order: 3,
  title: "Basic 3 · 뉴욕 센트럴파크",
  description: "센트럴파크 순환로 West Drive 남행 구간. 차량이 통제된 공원 순환로를 따라 달리는 입문 경로.",
  profile: "cycling",
  /** Directions 응답 distance (m) */
  distanceMeters: 453,
  /** Directions 응답 duration (s) */
  durationSec: 80,
  /** 도로 근거 — Directions steps 의 도로명 */
  roadNames: ["West Drive"],
  bounds: {
    minLng: -73.972581,
    minLat: 40.778609,
    maxLng: -73.969396,
    maxLat: 40.781748,
  },
  coordinates: [
    [-73.969408, 40.781748],
    [-73.969399, 40.781666],
    [-73.969396, 40.78159],
    [-73.9694, 40.781519],
    [-73.969407, 40.781463],
    [-73.969418, 40.781402],
    [-73.969439, 40.781325],
    [-73.969466, 40.781254],
    [-73.969497, 40.781188],
    [-73.969538, 40.781124],
    [-73.969594, 40.781046],
    [-73.969655, 40.780971],
    [-73.969716, 40.780903],
    [-73.96985, 40.780773],
    [-73.969902, 40.780728],
    [-73.969994, 40.780659],
    [-73.970078, 40.780604],
    [-73.970313, 40.780456],
    [-73.97089, 40.780071],
    [-73.971068, 40.77994],
    [-73.971205, 40.779836],
    [-73.971308, 40.779748],
    [-73.971352, 40.779707],
    [-73.971404, 40.77966],
    [-73.971503, 40.779565],
    [-73.971596, 40.779468],
    [-73.971695, 40.77936],
    [-73.971893, 40.779143],
    [-73.971979, 40.779056],
    [-73.972067, 40.778973],
    [-73.972163, 40.778886],
    [-73.972267, 40.778804],
    [-73.97237, 40.778733],
    [-73.972439, 40.778691],
    [-73.972513, 40.778647],
    [-73.972581, 40.778609],
  ],
};

export const BASIC_INTRO_HUB_ROUTE_SEEDS: readonly BasicIntroHubRouteSeed[] = [
  BASIC_INTRO_SEOUL_NAMSAN_ROUTE,
  BASIC_INTRO_PARIS_PONT_NEUF_ROUTE,
  BASIC_INTRO_NYC_CENTRAL_PARK_ROUTE,
];
