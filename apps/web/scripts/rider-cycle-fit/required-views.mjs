/**
 * 라이더–사이클 피팅 **필수 렌더 세트 정본**(단일 진실).
 *
 * 시각 보고 지시(2026-07-30)의 §2 를 코드로 고정한다. 렌더 스크립트(render-all.py)와
 * 검증기(verify-renders.mjs)가 **같은 이 파일**을 읽어, "구운 것"과 "요구된 것"이 어긋날 수
 * 없게 만든다. 뷰를 추가·삭제하려면 여기만 고친다.
 *
 * 카메라 좌표는 Blender(m): x 전방, y 좌우(+y=오른쪽), z 상. loc=카메라, look=주시점.
 *
 * ── 프레이밍 규칙(지시 반영) ──
 * · 전신 패널은 머리·양 바퀴·양손·양발이 모두 들어와야 한다.
 *   실측 씬 bbox(본체) x -1.03~0.91, z 0~1.45 → 폭 1.94m·높이 1.45m.
 *   50mm 렌즈 수직화각 27° 기준 필요 거리 ≈ 2.9m, 여유 포함 **3.3m**. 주시점 z=0.72(씬 중심).
 * · 확대 패널은 판정 대상 접점이 **화면 중앙**에 와야 한다. look 은 실측 앵커 좌표를 쓴다.
 *   페달축은 위상마다 움직이므로 위상별 확대는 pedalAxle 을 런타임에 참조한다(anchor 필드).
 */

/** 전신 프레이밍 상수 — 머리·양 바퀴가 잘리지 않는 최소 거리. */
export const FULL_DIST = 3.3;
export const FULL_LOOK = [0, 0, 0.72];

/** 실측 앵커(Blender m). render-all.py 가 위상별 값으로 덮어쓸 수 있다. */
export const ANCHORS = {
  saddle: [-0.226, 0.0, 0.9655],
  hoodL: [0.5343, -0.189, 0.8786],
  hoodR: [0.5343, 0.189, 0.8786],
  kneeL: [0.0237, -0.0779, 0.5673],
  // crank 0° 기준 페달축(정적 확대용)
  pedalAxleL: [0.0, -0.074, 0.098],
  pedalAxleR: [0.0, 0.074, 0.443],
};

/**
 * 확대 카메라 거리 — 접점이 화면 중앙에 크게 잡히도록.
 *
 * 발–페달 확대는 **페달축이 아니라 발 메시 중심**(anchor "footCenterL/R")을 겨냥한다.
 * 발은 페달축보다 뒤(발목쪽)로 크게 뻗어(실측 x폭 247mm), 페달축을 중앙에 두면 발이
 * 프레임 밖으로 잘린다 — 그 상태로는 "발이 렌더에 없다"고 오판하게 된다(2026-07-30).
 * 발 중심 주시 + dist 0.60 이면 발 정점 432/432 가 u0.19~0.79 · v0.25~0.75 에 들어온다.
 */
/**
 * 일반 확대 거리. 0.62m 는 발 확대에서 클리핑을 유발한 0.6m 와 인접하므로,
 * 안장·손·무릎 확대도 안전 마진을 두고 0.95m 로 올린다(대상이 작아 배율은 충분).
 */
const CU_DIST = 0.95;
/**
 * 발 확대 거리 — **0.6m 는 쓰지 말 것**.
 * 실측(2026-07-30): 발 중심을 정확히 겨냥해도(화면좌표 0.500,0.500) dist 0.6 에서는
 * 렌더 형광 픽셀이 **0개**다. 발 자체가 247mm 크기라 카메라가 발 부피 안으로 들어가
 * 앞면이 클리핑된다. 거리별 형광 픽셀: 0.6→0, 1.0→4699, 1.6→5470, 2.4→2621, 3.3→1431.
 * 1.6m 가 최대 검출이지만 1.15m 가 접점 판정에 필요한 배율과 안전 마진의 균형점이다.
 */
const FOOT_CU_DIST = 1.15;

/** 정적 자세(Static Fit) 7방향 — §2. 전부 전신 프레이밍. */
export const STATIC_VIEWS = [
  { id: "SIDE_L", label: "좌측면", loc: [0, -FULL_DIST, 0.72], look: FULL_LOOK },
  { id: "SIDE_R", label: "우측면", loc: [0, FULL_DIST, 0.72], look: FULL_LOOK },
  { id: "FRONT", label: "정면", loc: [FULL_DIST, 0, 0.85], look: FULL_LOOK },
  { id: "REAR", label: "후면", loc: [-FULL_DIST, 0, 0.85], look: FULL_LOOK },
  { id: "TOP", label: "상단", loc: [0, 0, FULL_DIST], look: [0, 0, 0.4] },
  { id: "Q_FRONT", label: "전방 3/4 사선", loc: [2.4, -2.4, 1.25], look: FULL_LOOK },
  { id: "Q_REAR", label: "후방 3/4 사선", loc: [-2.4, -2.4, 1.25], look: FULL_LOOK },
];

/** Stage 2 스케일 판정용 Rider Only 전신. 결합 전신과 카메라를 그대로 공유한다. */
export const RIDER_ONLY_VIEWS = [
  STATIC_VIEWS.find((v) => v.id === "SIDE_L"),
  STATIC_VIEWS.find((v) => v.id === "FRONT"),
  STATIC_VIEWS.find((v) => v.id === "REAR"),
  STATIC_VIEWS.find((v) => v.id === "Q_FRONT"),
];

/**
 * 정적 접점 확대 — §2. anchor 로 지정한 앵커가 화면 정중앙에 온다.
 * dir 은 앵커에서 카메라로 향하는 방향(정규화 전). 거리는 CU_DIST.
 */
export const STATIC_CLOSEUPS = [
  { id: "CU_SADDLE", label: "안장–골반 접점", anchor: "saddle", dir: [-0.55, -1, 0.35] },
  { id: "CU_HAND_L", label: "좌손–후드 접점", anchor: "hoodL", dir: [0.5, -1, 0.35] },
  { id: "CU_HAND_R", label: "우손–후드 접점", anchor: "hoodR", dir: [0.5, 1, 0.35] },
  { id: "CU_FOOT_L", label: "좌발–페달 접점", anchor: "footCenterL", dir: [0.35, -1, 0.28], dist: FOOT_CU_DIST },
  { id: "CU_FOOT_R", label: "우발–페달 접점", anchor: "footCenterR", dir: [0.35, 1, 0.28], dist: FOOT_CU_DIST },
  { id: "CU_KNEE_FRONT", label: "정면 무릎–프레임 간격", anchor: "kneeL", dir: [1, -0.12, 0.12] },
  /**
   * ⚠ 안장 접점은 **불투명 카메라 뷰로 판정할 수 없다** — 뷰를 추가하지 마라(2026-07-31 F2 실측).
   *
   * F2 에서 하방 시선 뷰(dir z 음수, dist 0.55·1.05 두 차례)를 추가해 봤으나 **둘 다 실패**했다.
   * 이유는 각도나 거리 문제가 아니다: 좌골이 안장 표면보다 163mm **아래**에 있어 안장이
   * 엉덩이 메시 **내부에 파묻혀** 있다. 물체가 다른 물체 안에 있으면 바깥 어느 방향에서도
   * 보이지 않는다. `CU_SADDLE`(위 사선)이 안 보이는 것도 같은 이유이며, 카메라를 바꿔서
   * 해결되는 종류의 문제가 아니다.
   *
   * 판정 경로는 **반투명 표식 렌더**뿐이다 — `render-saddle-evidence.py` 가 굽는
   * SADDLE_{LEFT,RIGHT,REAR}_{NORMAL,MARKED} 6장. 라이더를 반투명으로 만들고 좌골(적)·
   * 안장 표면(녹)·HIP(황)·오차 벡터(청록)를 표식으로 얹으므로 관통 상태 그대로 읽힌다.
   * 안장 접점을 봐야 하면 `run-saddle-gate.mjs` 경로를 쓰고, 이 목록은 건드리지 않는다.
   */
];

/** 페달링 필수 위상 — §2. key 는 ik-joints-v2.json 의 phases 키. */
export const PEDAL_PHASES = [
  { key: "0.000", deg: 0 },
  { key: "0.250", deg: 90 },
  { key: "0.500", deg: 180 },
  { key: "0.750", deg: 270 },
];

/**
 * 각 위상마다 찍어야 하는 뷰 — §2.
 * anchor 가 있으면 해당 위상의 실제 페달축을 중앙에 두고 확대한다.
 */
export const PHASE_VIEWS = [
  { id: "FULL", label: "전신 측면", loc: [0, -FULL_DIST, 0.72], look: FULL_LOOK },
  { id: "FOOT_L", label: "좌발–페달 확대", anchor: "footCenterL", dir: [0.35, -1, 0.28], dist: FOOT_CU_DIST },
  { id: "FOOT_R", label: "우발–페달 확대", anchor: "footCenterR", dir: [0.35, 1, 0.28], dist: FOOT_CU_DIST },
  // 크랭크와 다리가 같은 위상인지 = BB 를 중심에 두고 크랭크암·허벅지를 한 화면에.
  { id: "CRANKSYNC", label: "크랭크–다리 위상 일치", anchor: "bb", dir: [-0.8, -1.0, 0.28], dist: 1.15 },
];

/** 확대 카메라 기본 거리(뷰가 dist 를 지정하지 않으면 이 값). */
export const CLOSEUP_DIST = CU_DIST;

/** 필수 파일명 전체 목록(확장자 제외). 렌더·검증이 공유. */
export function requiredImageIds() {
  const ids = [];
  for (const v of RIDER_ONLY_VIEWS) ids.push(`RIDER_ONLY_${v.id}`);
  for (const v of STATIC_VIEWS) ids.push(`STATIC_${v.id}`);
  for (const c of STATIC_CLOSEUPS) ids.push(`STATIC_${c.id}`);
  for (const p of PEDAL_PHASES) {
    for (const v of PHASE_VIEWS) ids.push(`PHASE_${p.deg}_${v.id}`);
  }
  return ids;
}

/** 종합판(§3) 파일명 — 두 장 모두 필수. */
export const CONTACT_SHEETS = [
  "contact-sheet-rider-only.png",
  "contact-sheet-static.png",
  "contact-sheet-pedal.png",
];

/** 품질 하한(§5) — 이보다 작으면 렌더 실패로 간주. */
export const QUALITY = {
  minBytes: 20000,       // 빈/단색 이미지 배제
  minWidth: 800,
  minHeight: 600,
  minDistinctRatio: 0.02, // 픽셀 다양성 하한(단색 화면 배제)
};
