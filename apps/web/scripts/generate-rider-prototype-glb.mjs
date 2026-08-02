/**
 * 저폴리 자전거+라이더 GLB 프로토타입 생성.
 * 좌표: +X 진행(동), +Y 위, +Z 좌우(바퀴 축). 지면 y=0.
 * 실행: npm run gen:rider-glb (apps/web)
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// ⚠ 라이더 IK 앵커의 단일 진실 — geometry.json 파생(riderRig). 하드코딩 복제 금지.
// 3D 앵커(좌우 z 포함): HIP_L/R·SHOULDER_L/R·HOOD_L/R. Static Fit 회전은 rest(-Y)에서 IK 로.
import {
  PELVIS_ROOT as RIG_PELVIS_ROOT,
  SADDLE_CONTACT as RIG_SADDLE,
  HIP_L as RIG_HIP_L,
  HIP_R as RIG_HIP_R,
  SHOULDER_L as RIG_SHOULDER_L,
  SHOULDER_R as RIG_SHOULDER_R,
  SHOULDER as RIG_SHOULDER_C,
  HOOD_L as RIG_HOOD_L,
  HOOD_R as RIG_HOOD_R,
  HEAD_C as RIG_HEAD_C,
  NECK_BASE as RIG_NECK_BASE,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  PEDAL_HALF_Z,
  BB_SPINDLE_HALF,
  PEDAL_AXLE_OFFSET,
  SADDLE_CONTACT,
  SEAT_TOP as RIG_SEAT_TOP,
  HEAD_TOP as RIG_HEAD_TOP,
  HEAD_BOT as RIG_HEAD_BOT,
  SEAT_TUBE_ANGLE_DEG,
  SEAT_TUBE_LENGTH_MM,
} from "../src/lib/riderPrototype/riderRig.geometry.mjs";
// Static Fit 초기 포즈(rest→IK 방향 회전)를 GLB 노드에 직접 구워 프리뷰 정지자세로 쓴다.
// (주행 시엔 feature-state 가 위상별로 덮어쓴다.)
import { resolveGlbPedalPose } from "../src/lib/riderGlbPedalPose.pose.mjs";

globalThis.window = globalThis;
globalThis.FileReader = class FileReaderPoly {
  result = null;
  onload = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    const finish = (buf) => {
      this.result = buf;
      this.onloadend?.({ target: this });
      this.onload?.({ target: this });
    };
    try {
      if (blob instanceof ArrayBuffer) {
        queueMicrotask(() => finish(buf));
        return;
      }
      if (ArrayBuffer.isView(blob)) {
        queueMicrotask(() => finish(blob.buffer));
        return;
      }
      if (typeof blob?.arrayBuffer === "function") {
        void blob.arrayBuffer().then(finish);
        return;
      }
      this.onerror?.(new Error("unsupported blob"));
    } catch (e) {
      this.onerror?.(e);
    }
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "rider", "prototype");
// RTW_GLB_OUT 로 출력 경로 오버라이드 가능(cycle-only·후보 산출 등, 제품 GLB 보호).
const outFile = process.env.RTW_GLB_OUT
  ? path.resolve(process.env.RTW_GLB_OUT)
  : path.join(outDir, "rider-lowpoly.glb");

/**
 * LiveOnSoft Cycle Rider v1.0 색상 — 설계서 Material Spec(5슬롯).
 * Jersey #2563EB · Bib #1E293B · Helmet White · Bike Matte Black · Glass Smoke Black · Skin Neutral.
 */
const COL = {
  // Bike — 프레임 오렌지(RIDEWORLD #FF8C00), 컴포넌트(바퀴/핸들/안장)는 블랙 유지
  tire: 0x141417,
  rim: 0x2a2a30,
  frame: 0xff8c00, // 프레임 메인 오렌지
  frameDark: 0xd97406, // 프레임 그늘(탑튜브·헤드튜브 등) — 오렌지 셰이드
  bar: 0x0d0d10, // 드롭바·스템·안장은 블랙
  spacer: 0x3d4148, // 헤드셋 스페이서/컵 — 스템과 구분되는 실버-그레이(눈에 식별)
  bottle: 0xe8ecf0, // 물통 몸체 — 흰색(반투명 회색기)
  bottleCap: 0x2563eb, // 물통 캡 — 팀 컬러 블루
  cage: 0x14141a, // 보틀 케이지 — 블랙
  // Jersey — 블루 #2563EB, 그늘용 다크
  jersey: 0x2563eb,
  jerseyDark: 0x1d4ed8,
  // Skin — 중립 톤(기존 노랑기 제거)
  skin: 0xe8b98f,
  skinDark: 0xd9a878,
  // Helmet — White
  helmetShell: 0xf1f5f9,
  helmetVisor: 0x334155,
  helmetStripe: 0x2563eb, // 헬멧 악센트도 브랜드 블루
  // Bib — 다크 네이비 #1E293B
  short: 0x1e293b,
  shadow: 0x000000,
  gold: 0x2563eb, // 물통 등 악센트 블루
  shoe: 0x111114, // Shoes Black
  sunglass: 0x18181b, // Glass Smoke Black
};

// ══════════════════════════════════════════════════════════════════════════
// RTW Road Geometry (Phase 1 확정, SSoT=src/lib/riderPrototype/geometry.json).
// 좌표계: m, 지면 y=0, +x 진행. 원본 mm(BB원점)에서 변환: x=mm/1000, y=(mm+bbHeight)/1000.
// 700x28C 실측(wheelRadius 342.5mm), BB드롭 72mm → BB가 허브보다 아래(정상 로드).
// ══════════════════════════════════════════════════════════════════════════
const WHEEL_R = 0.3225; // 700×28C 실측 반경(322.5mm, 직경 645mm) — 이전 342.5에서 -20mm
const HUB_Y = WHEEL_R; // 허브 y = 반경(지면 접촉). 바퀴 축소분만큼 허브도 내려가 지면 유지.
const REAR_X = -0.4036; // 뒷허브 x (체인스테이 410mm 결과)
const FRONT_X = 0.5903; // 앞허브 x (프론트센터 590mm)

/** 재질 캐시 — 동일 (색·roughness·metalness·opacity) 조합은 1개 인스턴스 재사용(파일 크기↓) */
const _matCache = new Map();
function mat(color, opacity = 1, opts = {}) {
  const roughness = opts.roughness ?? 0.85;
  const metalness = opts.metalness ?? 0;
  const key = `${color}|${roughness}|${metalness}|${opacity}`;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent: opacity < 1,
      opacity,
      // 인체·저지의 은은한 명암 연속성 — flatShading 금지(각짐)
      flatShading: false,
    });
    _matCache.set(key, m);
  }
  return m;
}

/** Y축 실린더를 from→to 방향으로 배치 */
function tube(from, to, radius, color, opts = {}) {
  return taperTube(from, to, radius, radius, color, opts);
}

/**
 * 테이퍼 튜브 — from(반경 rFrom)→to(반경 rTo). 근육·프레임 볼륨의 핵심 레버.
 * capped 옵션이면 양끝을 반구로 덮어 관절 연결이 매끄럽다(원기둥 끊김 제거).
 */
function taperTube(from, to, rFrom, rTo, color, opts = {}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-4) return new THREE.Group();
  const radial = opts.radial ?? 18;
  const g = new THREE.Group();
  const m = mat(color, opts.opacity ?? 1, opts);
  const geo = new THREE.CylinderGeometry(rTo, rFrom, len, radial, 1, false);
  geo.translate(0, len / 2, 0);
  const shaft = new THREE.Mesh(geo, m);
  g.add(shaft);
  const capSeg = Math.max(8, radial - 4);
  if (opts.capStart !== false) {
    const capA = new THREE.Mesh(new THREE.SphereGeometry(rFrom, capSeg, Math.max(6, capSeg >> 1)), m);
    g.add(capA);
  }
  if (opts.capEnd !== false) {
    const capB = new THREE.Mesh(new THREE.SphereGeometry(rTo, capSeg, Math.max(6, capSeg >> 1)), m);
    capB.position.y = len;
    g.add(capB);
  }
  g.position.copy(a);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return g;
}

/**
 * Lathe 회전체 — [ [y, r], ... ] 프로파일(로컬 y축 중심 회전). 몸통·헬멧 등
 * 연속 곡면 실루엣용. profile은 아래→위로 정렬, r은 해당 높이의 반경.
 */
function lathe(profile, color, opts = {}) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(1e-4, r), y));
  const geo = new THREE.LatheGeometry(pts, opts.segments ?? 24);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, opts.opacity ?? 1, opts));
}

/** 부드러운 타원체 — scale로 방향별 볼륨. 근육·어깨·엉덩이 볼륨 채움용 */
function blob(r, color, scale, opts = {}) {
  const seg = opts.segments ?? 16;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), mat(color, opts.opacity ?? 1, opts));
  if (scale) m.scale.set(...scale);
  return m;
}

/**
 * 700×28C 슬림 로드 휠. 휠은 XY 평면(회전축 = Z, 좌우). 허브 y = 반경(지면 접촉).
 * ⚠ 스포크는 반드시 휠 평면(z≈0) 안에서 허브 플랜지 → 림 니플로 직선 연결.
 *   3D 구면 방사(성게) 금지 — 정면/후면에선 스포크가 거의 안 보여야 한다.
 */
const TIRE_SECTION_R = 0.014; // 타이어 단면 반경 14mm → 폭 28mm (700×28C)
const RIM_SECTION_R = 0.008; // 림 단면 반경 8mm → 로드 알루미늄/카본 림 비례
const RIM_R = WHEEL_R * 0.86; // 림(니플) 반경
const HUB_FLANGE_R = 0.021; // 허브 플랜지 반경 — 스포크 시작점
const SPOKE_COUNT = 24; // 로드 표준 스포크 수
function wheel(hubX) {
  const g = new THREE.Group();
  // 타이어(28C) — 얇은 토러스. 회전축 Z(TorusGeometry는 기본 XY평면 → 축 Z, 그대로 OK).
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R - TIRE_SECTION_R, TIRE_SECTION_R, 12, 44),
    mat(COL.tire, 1, { roughness: 0.85 }),
  );
  tire.position.set(hubX, HUB_Y, 0);
  // 림 — 타이어 안쪽, 슬림한 단면.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_R, RIM_SECTION_R, 10, 44),
    mat(COL.rim, 1, { metalness: 0.45, roughness: 0.4 }),
  );
  rim.position.set(hubX, HUB_Y, 0);
  g.add(tire, rim);

  // ── 스포크 — 휠 평면(z=0) 안에서만. 허브 플랜지(반경 HUB_FLANGE_R) → 림 니플(반경 RIM_R).
  //    각 스포크는 XY 평면의 한 반경선. z 성분 0 → 정면에서 거의 선으로만 보인다(성게 아님).
  const spokeMat = mat(0x8890a0, 1, { metalness: 0.7, roughness: 0.3 });
  const spokeLen = RIM_R - HUB_FLANGE_R;
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const a = (Math.PI * 2 * i) / SPOKE_COUNT;
    const dirX = Math.cos(a), dirY = Math.sin(a); // 휠 평면 내 반경 방향
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0016, 0.0016, spokeLen, 4),
      spokeMat,
    );
    // 플랜지에서 살짝 좌우 오프셋(실제 스포크 lacing) — 아주 작게(±3mm)만.
    const zOff = (i % 2 === 0 ? 1 : -1) * 0.003;
    const midR = (HUB_FLANGE_R + RIM_R) / 2;
    spoke.position.set(hubX + dirX * midR, HUB_Y + dirY * midR, zOff);
    // 스포크 축(Y) → 반경 방향(dirX, dirY, 0)으로 회전. z=0 평면 유지.
    spoke.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dirX, dirY, 0),
    );
    g.add(spoke);
  }

  // 허브 — 회전축 Z 방향 짧은 원통.
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_FLANGE_R, HUB_FLANGE_R, 0.045, 14),
    mat(COL.rim, 1, { metalness: 0.5, roughness: 0.35 }),
  );
  hub.position.set(hubX, HUB_Y, 0);
  hub.rotation.x = Math.PI / 2; // 축을 Z로
  g.add(hub);

  return g;
}

function box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 1, opts));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

const root = new THREE.Group();
root.name = "RiderBike";

/**
 * Phase 2: 라이더 IK 재정렬 완료 → 기본 포함. env RTW_RIDER=0 이면 자전거만(지오메트리 검토용).
 * 라이더 좌표는 riderRig(geometry.json 파생)에서 온다 — 자전거가 바뀌면 자세가 자동 재계산.
 */
const INCLUDE_RIDER = process.env.RTW_RIDER !== "0";

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.62, 28),
  mat(COL.shadow, 0.26),
);
shadow.name = "groundShadow"; // AABB 검증에서 제외되는 지면 원판(라이더 전고 아님)
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, 0.015, 0);
root.add(shadow);

root.add(wheel(REAR_X));
root.add(wheel(FRONT_X));

/**
 * RTW Road Geometry (Phase 1 확정, geometry.json coords → m·지면원점 변환).
 * 시트튜브 73.5° ∥ 헤드튜브 73°(평행), 다운튜브 43.6°(전체의 결과), 탑튜브 수평.
 * 뒷삼각(체인스테이+시트스테이)이 뒷바퀴를, 포크가 앞바퀴를 잡는다.
 */
const rear = [REAR_X, HUB_Y, 0]; // 뒷허브 [-0.4036, 0.3425]
const front = [FRONT_X, HUB_Y, 0]; // 앞허브 [0.5903, 0.3425]
const bb = [0.0, 0.2705, 0]; // 크랭크축(BB) — 지면에서 bbHeight 270.5mm, 허브보다 아래(BB드롭 72mm)
// 시트튜브 상단(안장 클램프 기준점) — geometry.json coords.seatTop 파생(riderRig). 하드코딩 금지.
// F4-2 이후 **메시로는 그리지 않는다**(시트튜브가 junction 에서 끝나므로). seatTubeLength 560 의
// 기준점으로서 SSoT 에 남아 있고 junction 파생에 쓰인다. 좌표 자체는 불변이다.
const seatTop = [...RIG_SEAT_TOP, 0];
void seatTop; // 메시 미사용 — SSoT 대조·디버깅용으로 보존
// 헤드튜브: 상단 → 하단(다운튜브·포크 접합). geometry.json coords.headTop/headBot 파생(riderRig).
// 탑튜브는 헤드튜브 옆에 용접될 뿐.
const headTop = [...RIG_HEAD_TOP, 0];
const headBot = [...RIG_HEAD_BOT, 0];
// 시트튜브 접합점 — 탑튜브·시트스테이가 붙는 지점이자 **시트튜브의 끝**이다.
// 여기서부터 위는 전부 노출 시트포스트다(F4-2, 2026-07-31 사용자 지시).
//   F1 에서는 시트튜브를 seatTop(560mm)까지 그리고 junction 위를 시트포스트로 "겹쳐" 표현했으나,
//   실제 로드바이크는 시트튜브가 접합부에서 끝나고 그 위는 전부 시트포스트다. 사용자가
//   "시트튜브 길이는 연결부위까지, 그 이후는 모두 시트포스트"로 확정했다.
// SEAT_TUBE_SHORTENING 은 감리 확정값(변경 금지) — 시트튜브를 seatTubeLength 에서 얼마나
// 줄여 junction 을 잡는가. (F1~F3 의 SEATPOST_EXPOSED 와 같은 수치이나 의미가 바뀌었다:
//  과거 "노출 시트포스트 길이" → 현재 "시트튜브 단축량". 실제 노출 시트포스트는 이보다 길다.)
const SEAT_TUBE_SHORTENING = 150; // mm
const _seatTubeJunctionLenM = (SEAT_TUBE_LENGTH_MM - SEAT_TUBE_SHORTENING) / 1000;
const _seatTubeAngleRad = (SEAT_TUBE_ANGLE_DEG * Math.PI) / 180;
// 시트튜브 축(BB→seatTop) 방향의 단위벡터를 따라 BB에서 위 길이만큼 이동.
const seatTubeJunction = [
  bb[0] - _seatTubeJunctionLenM * Math.cos(_seatTubeAngleRad),
  bb[1] + _seatTubeJunctionLenM * Math.sin(_seatTubeAngleRad),
  0,
];
// 시트포스트 상단 — 시트튜브 축(73.5°)의 **연장선** 위에서 안장과 같은 높이가 되는 지점(F4-3).
//   시트포스트는 시트튜브에 꽂히는 부품이므로 축이 같아야 한다. 과거처럼 seatTop→saddle 로
//   이으면 saddle 이 setback 만큼 뒤로 물린 점이라 6.47° 어긋난 채 꺾여 보였다.
//   안장의 setback 은 시트포스트 각도가 아니라 **안장 레일 오프셋**으로 표현한다
//   (시트포스트 상단이 안장보다 saddleSetback 만큼 앞에 서고, 안장이 뒤로 물린다).
const _postRiseM = SADDLE_CONTACT[1] - seatTubeJunction[1]; // 안장 높이까지의 수직 상승
const _postLenM = _postRiseM / Math.sin(_seatTubeAngleRad);
const seatPostTop = [
  seatTubeJunction[0] - _postLenM * Math.cos(_seatTubeAngleRad),
  seatTubeJunction[1] + _postLenM * Math.sin(_seatTubeAngleRad),
  0,
];

// ── Cockpit Assembly (조립 계층: HeadTube → Headset → Stem → Handlebar) ──
//    steering axis = 헤드튜브 축(headBot→headTop) = 포크와 동일 축. 콕핏 전체가 이 축에 속한다.
//    탑튜브는 headTop 에 용접만 될 뿐 스템을 지지하지 않는다(부모-자식 아님).
const _v = (a, b) => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
const _norm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const _addv = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s, p[2] + v[2] * s];
const STEER_UP = _norm(_v(headBot, headTop)); // 헤드튜브 위 방향(steering axis)
// ── 스페이서 스택: 설계값=메쉬길이 정확히 일치. 엔듀런스(편안) 자세 → 35mm(50mm 미만).
const SPACER_STACK = 0.035; // 헤드셋 스페이서 스택 35mm — 메쉬 원통 실길이와 정확히 일치
const STEM_CLAMP_H = 0.040; // 스템 클램프 몸통(스티어러 무는 부분) 높이 40mm
const STEM_LENGTH = 0.105; // 105mm (현대 로드 100~110 중간)
const STEM_ANGLE = 6 * Math.PI / 180; // stemAngle +6° (수평 전방 기준 약간 상승 — 완성차 기본)
const BAR_HALF = 0.210; // handlebarWidth 420mm / 2
const BAR_REACH = 0.080; // handlebarReach
const BAR_DROP = 0.128; // handlebarDrop
// 계층: HeadTube Top → (스페이서 35mm) → Stem Bottom → (스템 클램프 40mm) → Stem Top → 스템암 앞으로.
const headTubeTop = headTop; // 헤드튜브 상단(steering axis 하단 기준점)
const spacerTop = _addv(headTubeTop, STEER_UP, SPACER_STACK); // 스페이서 상단 = 스템 하단
const stemBottom = spacerTop;
const stemTop = _addv(stemBottom, STEER_UP, STEM_CLAMP_H); // 스템 클램프 상단
const stemMid = _addv(stemBottom, STEER_UP, STEM_CLAMP_H * 0.5); // 스템암 시작(클램프 중간)
// 스템 암: 스템 클램프 중간에서 +6° 상승하며 앞으로 → 핸들바 클램프.
const stemDir = [Math.cos(STEM_ANGLE), Math.sin(STEM_ANGLE), 0];
const stemEnd = _addv(stemMid, stemDir, STEM_LENGTH); // 핸들바 클램프
const barHood = _addv(stemEnd, stemDir, BAR_REACH * 0.6); // 드롭바 후드(손 위치) — 클램프 앞

// ── 다이아몬드 프레임 튜브 배선 (도면 두께 비율: 다운튜브 최대 → 탑/시트 중간 → 스테이 최소).
//    프레임 메인 삼각(다운·시트·탑·헤드)은 중앙 평면(z=0) 단일 튜브. 스테이·포크만 좌우 2개.
const frameOpts = { metalness: 0.55, roughness: 0.32, radial: 12 };
// 튜브 반경(도면 상대 두께). 다운튜브가 가장 굵고, 스테이가 가장 얇다.
const R_DOWN = 0.028, R_SEAT = 0.024, R_TOP = 0.022, R_HEAD = 0.026;
const R_CHAINSTAY = 0.014, R_SEATSTAY = 0.012, R_FORK = 0.015;

// 메인 삼각 — 프레임 오렌지. cap 으로 접합부를 둥글게 이어 튜브 끊김 제거.
// 다운튜브: BB → 헤드튜브 하단 (가장 굵음)
root.add(tube(bb, headBot, R_DOWN, COL.frame, frameOpts));
// 시트튜브: BB → 접합점(junction). **여기서 끝난다** — 그 위는 전부 시트포스트다(F4-2).
root.add(tube(bb, seatTubeJunction, R_SEAT, COL.frame, frameOpts));
// 탑튜브: 시트튜브 접합점(junction) → 헤드튜브 상단. 시트튜브 최상단이 아니라 중간에 붙는다.
root.add(tube(seatTubeJunction, headTop, R_TOP, COL.frame, frameOpts));
// 헤드튜브: 상단 → 하단 (128mm, 헤드각 73°)
root.add(tube(headTop, headBot, R_HEAD, COL.frame, frameOpts));

// 뒷삼각 — 체인스테이/시트스테이 좌우 2개 (뒷허브를 감싼다). 그늘색.
const STAY_DZ = 0.028;
for (const dz of [STAY_DZ, -STAY_DZ]) {
  // 체인스테이: BB → 뒷허브
  root.add(tube([bb[0], bb[1], dz], [rear[0], rear[1], dz], R_CHAINSTAY, COL.frameDark, frameOpts));
  // 시트스테이: 시트튜브 접합점(junction) → 뒷허브. 탑튜브와 같은 점에서 만난다.
  root.add(tube([seatTubeJunction[0], seatTubeJunction[1], dz], [rear[0], rear[1], dz], R_SEATSTAY, COL.frameDark, frameOpts));
}

// 앞포크 — 헤드튜브 하단 → 앞허브 좌우 2개 (도면처럼 앞으로 뻗어 앞바퀴를 잡음). 그늘색.
const FORK_DZ = 0.026;
for (const dz of [FORK_DZ, -FORK_DZ]) {
  root.add(tube([headBot[0], headBot[1], dz], [front[0], front[1], dz], R_FORK, COL.frameDark, frameOpts));
}

/**
 * 물통 + 보틀 케이지 — 다운튜브에 평행 장착(저폴리). 케이지에 끼워진 형태.
 * 물통: 원통 몸체(위로 가늘어짐) + 둥근 어깨 + 캡. 케이지: U자 프레임 2개.
 */
function waterBottleAssembly() {
  const g = new THREE.Group();
  g.name = "waterBottle";
  const _n = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  const _a = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s, p[2] + v[2] * s];
  const dtDir = _n([headBot[0] - bb[0], headBot[1] - bb[1], 0]); // 다운튜브 방향(축)
  const perpUp = _n([dtDir[1], -dtDir[0], 0]); // 다운튜브 바깥(위앞) 수직
  const up = perpUp[1] > 0 ? perpUp : [-perpUp[0], -perpUp[1], 0];
  const dtMid = [(bb[0] + headBot[0]) / 2, (bb[1] + headBot[1]) / 2, 0];
  const bottleR = 0.026;
  const off = 0.028 + bottleR + 0.003; // 다운튜브 반경 + 물통 반경 + 간격
  const bottleBottom = _a(dtMid, up, off);
  const bodyLen = 0.10;
  const shoulderAt = _a(bottleBottom, dtDir, bodyLen);
  // 몸체 — 아래 굵고 위로 살짝 가늘어짐(테이퍼). 흰색. capEnd 제거(어깨 blob이 덮음).
  g.add(taperTube(bottleBottom, shoulderAt, bottleR, bottleR * 0.86, COL.bottle, { radial: 8, roughness: 0.5, capEnd: false }));
  // 둥근 어깨 — 몸체 상단을 덮는 반구 느낌(저폴리).
  const shoulder = blob(bottleR * 0.86, COL.bottle, [1.0, 0.7, 1.0], { segments: 8, roughness: 0.5 });
  shoulder.position.set(shoulderAt[0], shoulderAt[1], shoulderAt[2]);
  g.add(shoulder);
  // 캡(노즐) — 어깨 위 짧고 가는 실린더. 팀 컬러.
  const capBot = _a(shoulderAt, dtDir, 0.004);
  const capTop = _a(capBot, dtDir, 0.022);
  g.add(taperTube(capBot, capTop, bottleR * 0.42, bottleR * 0.32, COL.bottleCap, { radial: 8, roughness: 0.6, capStart: false }));

  // ── 보틀 케이지 — 저폴리. 측면 실루엣이 명확한 C자 프레임 2개(좌우, z 대칭).
  //    각 C자는 물통 바깥면(반경 cageOut)을 따라 바닥→앞→상단으로 감싸는 폴리라인.
  //    물통을 관통하지 않도록 항상 bottleR 바깥에만 그린다. z는 살짝 안쪽(물통 옆).
  const cageR = 0.0034;
  // 저폴리: 캡(반구) 제거 + radial 4 → 케이지 폴리곤 최소화(요구 100~300 유지).
  const cageOpts = { radial: 4, metalness: 0.3, roughness: 0.5, capStart: false, capEnd: false };
  const cageOut = bottleR + 0.005; // 물통 바깥 반경(케이지가 지나는 거리)
  // 케이지 C자 프로파일: 축방향 t(0=바닥,1=상단), up방향 반경계수 f(다운튜브쪽 -1 ~ 앞 +1).
  //  바닥(뒤에서 앞으로 감싸 올림) → 앞면 세로로 상승 → 상단 후크.
  // 저폴리: 4점(3세그먼트) — 바닥받침 → 앞면 상승 → 상단 후크.
  const profile = [
    [0.02, -0.9], // 바닥(다운튜브 쪽 아래)
    [0.2, 1.0], // 앞 하단(바깥)
    [0.86, 1.0], // 앞 상단(바깥)
    [0.96, 0.35], // 상단 후크
  ];
  for (const zc of [0.014, -0.014]) { // 좌우 C자 2개
    const pts = profile.map(([t, f]) => {
      const axisPt = _a(bottleBottom, dtDir, bodyLen * t);
      return _a(axisPt, up, cageOut * f);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      g.add(tube([pts[i][0], pts[i][1], zc], [pts[i + 1][0], pts[i + 1][1], zc], cageR, COL.cage, cageOpts));
    }
  }
  // 좌우 C자를 잇는 가로 밴드 2개(앞면) — 케이지 강성·고정 표현.
  for (const t of [0.3, 0.82]) {
    const axisPt = _a(bottleBottom, dtDir, bodyLen * t);
    const front = _a(axisPt, up, cageOut);
    g.add(tube([front[0], front[1], 0.014], [front[0], front[1], -0.014], cageR, COL.cage, cageOpts));
  }
  return g;
}
root.add(waterBottleAssembly());

/** 안장·시트포스트 — 시트튜브 접합점(junction)에서 시트튜브 축을 그대로 연장(F4-2·F4-3). */
// 안장 = geometry.json 파생(SADDLE_CONTACT). 하드코딩 금지 — saddleHeight/각도/setback 에서 재파생.
const saddlePos = [SADDLE_CONTACT[0], SADDLE_CONTACT[1], 0]; // ≈[-0.226, 0.9655] (saddleHeight 725·setback 20)
// 시트포스트는 junction → seatPostTop 으로 **시트튜브와 완전히 평행**(동일 축, 73.5°)하다.
// 안장은 그 상단에서 setback 만큼 뒤에 놓인다(레일 오프셋) — 안장 좌표는 SSoT 그대로다.
root.add(tube(seatTubeJunction, seatPostTop, 0.011, COL.bar, frameOpts));
const saddle = blob(0.05, COL.bar, [2.4, 0.32, 0.95], { segments: 16, ...frameOpts });
saddle.position.set(saddlePos[0], saddlePos[1], 0);
saddle.rotation.z = -0.06;
root.add(saddle);

/**
 * Cockpit Assembly — 조립 계층 HeadTube → Headset → Stem → Handlebar.
 * 전체가 steering axis(포크와 동일 축)에 속한다. 탑튜브와는 부모-자식 관계 없음.
 * (Mapbox 조향 노드로 쓰려면 이 그룹을 headTop 피벗으로 회전시키면 된다.)
 */
function cockpitAssembly() {
  const g = new THREE.Group();
  g.name = "cockpit";
  const barR = 0.013;
  const spacerOpts = { metalness: 0.62, roughness: 0.38, radial: 16 };
  // ── 1) 헤드셋 스페이서 스택 — 캡 없는 순수 원통. 실메쉬 길이 = headTubeTop→spacerTop = 정확히 35mm.
  //    색은 **프레임 색으로 통일**한다(F4-1, 2026-07-31 사용자 지시). 과거 COL.spacer(실버-그레이)를
  //    쓰던 시절엔 헤드튜브 상단 바로 위 35mm 가 "페인트가 벗겨진 회색 띠"로 보였다.
  //    스템·핸들바(블랙)는 그대로 두므로 헤드셋과 스템의 구분은 색이 아니라 굵기(0.024 vs 0.020)가 맡는다.
  //    capStart/capEnd:false 로 반구캡 제거 → 끝이 깔끔하고 축길이가 설계값과 정확히 일치.
  const spacerMesh = tube(headTubeTop, spacerTop, 0.024, COL.frame, { ...spacerOpts, capStart: false, capEnd: false });
  spacerMesh.name = "headsetSpacer"; // 감사용 — 실메쉬 길이 검증(캡 없어 shaft=총길이=35mm)
  g.add(spacerMesh);
  // ── 2) 스템 클램프(스티어러 무는 세로 몸통) — 스페이서 위(stemBottom) → stemTop, 40mm. 블랙.
  g.add(tube(stemBottom, stemTop, 0.020, COL.bar, frameOpts));
  // ── 2b) 스템 암 — 클램프 중간(stemMid)에서 +6° 상승하며 앞으로 → 핸들바 클램프(stemEnd).
  g.add(tube(stemMid, stemEnd, 0.016, COL.bar, frameOpts));
  // 핸들바 클램프 볼륨(핸들바를 무는 앞부분).
  const clampV = blob(0.022, COL.bar, [0.9, 1.3, 1.3], { segments: 12, ...frameOpts });
  clampV.position.set(stemEnd[0], stemEnd[1], 0);
  g.add(clampV);
  // 3) 핸들바(드롭바) — 실제 로드 드롭바 프로파일(측면): 탑바(좌우) → 후드로 앞 → 리치 커브로
  //    앞·아래 반원 → 드롭 끝은 뒤·아래를 향한다. 부드러운 다세그먼트 폴리라인.
  const cx = stemEnd[0], cy = stemEnd[1]; // 클램프 중심
  // 탑바 — 클램프에서 좌우로 (z 대칭). 살짝 뒤로 스윕(back sweep) 없이 직선.
  g.add(tube([cx, cy, -BAR_HALF], [cx, cy, BAR_HALF], barR, COL.bar, frameOpts));
  // 측면 프로파일 폴리라인(로컬 x=앞, y=위). 클램프(0,0) 기준.
  //  후드까지 앞으로 → 반원 드롭(앞아래 최전방 → 아래 → 뒤아래 드롭끝).
  const reach = BAR_REACH, drop = BAR_DROP;
  const profile2d = [
    [0.0, 0.0], // 탑바(클램프)
    [reach * 0.75, -0.010], // 후드 접합(앞·약간 아래)
    [reach * 1.00, -drop * 0.28], // 리치 최전방(후드 앞)
    [reach * 0.95, -drop * 0.62], // 커브 앞아래
    [reach * 0.62, -drop * 0.92], // 커브 아래
    [reach * 0.28, -drop * 1.00], // 드롭 끝(뒤·아래를 향함)
  ];
  const hoodIdx = 1; // 후드 볼륨 위치
  for (const dz of [BAR_HALF, -BAR_HALF]) {
    for (let i = 0; i < profile2d.length - 1; i++) {
      const a = [cx + profile2d[i][0], cy + profile2d[i][1], dz];
      const b = [cx + profile2d[i + 1][0], cy + profile2d[i + 1][1], dz];
      g.add(tube(a, b, barR, COL.bar, frameOpts));
    }
    // 브레이크 후드(손 얹는 곳) 볼륨 — 후드 접합점 위
    const hp = profile2d[hoodIdx];
    const hood = blob(0.020, COL.bar, [1.7, 1.0, 1.0], { segments: 10, ...frameOpts });
    hood.position.set(cx + hp[0] + 0.006, cy + hp[1] + 0.010, dz);
    g.add(hood);
  }
  return g;
}
root.add(cockpitAssembly());

/**
 * ⚠️ 라이더 앵커는 riderRig(geometry.json 파생)에서 온다 — 하드코딩 금지.
 * pelvisRoot=골반중심(몸통 root), shoulder=견봉 중앙(목·몸통 상단), headC=머리중심.
 * 좌우 팔·다리 root 는 HIP_L/R·SHOULDER_L/R(실제 z 폭). relaxed race, 등 전경사 ~42°.
 */
const pelvis = RIG_PELVIS_ROOT; // [x, y, 0] 골반 중심(몸통 하단)
const shoulder = [RIG_SHOULDER_C[0], RIG_SHOULDER_C[1], 0]; // 견봉 중앙
const headC = [RIG_HEAD_C[0], RIG_HEAD_C[1], 0];

/** Static Fit(crank 0°) 초기 포즈 — 각 노드에 구워 프리뷰 정지자세로. 주행 시 feature-state 로 덮임. */
const STATIC_POSE = resolveGlbPedalPose(0);
/** Mapbox model-rotation [pitch(x), roll(z), yaw(y)] deg → three 노드 rotation.set(x,y,z) rad. */
function bakeRotation(node, rotDeg) {
  const [px, rz, yy] = rotDeg;
  node.rotation.set((px * Math.PI) / 180, (yy * Math.PI) / 180, (rz * Math.PI) / 180);
}

/** Mapbox nodeOverride — Z축 회전(페달) */
function crankAssembly() {
  const crank = new THREE.Group();
  crank.name = "crank";
  crank.position.set(bb[0], bb[1], bb[2]);
  const armLen = 0.1725; // crankLength 172.5mm (geometry.json)
  // BB 구조: 크랭크 간 거리는 '스핀들'이 만든다(물리적 진실). 크랭크암은 스핀들 끝(BB 밖으로
  // 드러난 z=±spindleHalf)에서 시작해 회전반경만큼 뻗고, 페달은 크랭크 끝에서 소폭 추가 오프셋.
  //   spindleHalf(58) + pedalAxle(16) = pedalOffset(74) = 페달 최종 z. Q-factor = 2·74 = 148mm.
  const sh = BB_SPINDLE_HALF; // 0.058 — 크랭크가 시작하는 좌우 z (BB 밖)
  const pz = PEDAL_HALF_Z; // 0.074 — 페달 최종 z (pedalWorld 규약과 일치)
  const axle = PEDAL_AXLE_OFFSET; // 0.016 — 크랭크 끝→페달축(부수)
  // 1) 스핀들 — BB 를 관통해 좌우 크랭크를 연결(크랭크 간 거리의 근본). z:-sh↔+sh.
  crank.add(tube([0, 0, -sh], [0, 0, +sh], 0.016, COL.rim, frameOpts));
  // 2) 좌우 크랭크암 — 스핀들 끝(z=±sh, BB 밖으로 드러남)에서 회전반경만큼. 왼쪽 +y, 오른쪽 -y.
  crank.add(tube([0, 0, +sh], [0, armLen, +sh], 0.012, COL.bar, frameOpts));
  crank.add(tube([0, 0, -sh], [0, -armLen, -sh], 0.012, COL.bar, frameOpts));
  // 3) 페달축 — 크랭크 끝에서 바깥으로 소폭(sh→pz).
  crank.add(tube([0, armLen, +sh], [0, armLen, +pz], 0.010, COL.bar, frameOpts));
  crank.add(tube([0, -armLen, -sh], [0, -armLen, -pz], 0.010, COL.bar, frameOpts));
  // 4) 페달 — 페달축 끝(z=±pz). **명명 노드**: 앱이 `−crankRotationDeg` 를 걸어
  //    부모 crank 회전을 상쇄하고 페달면을 항상 수평으로 유지한다(실제 스핀들 베어링).
  //    ⚠ 노드 원점이 스핀들이어야 상쇄가 성립한다 — box() 가 position 을 노드
  //    translation 으로 쓰고 정점은 원점 기준이라 이미 충족된다. 정점에 오프셋을
  //    굽지 마라(그러면 제자리에서 돌지 않고 궤도가 틀어진다).
  const pedalL = box(0.07, 0.02, 0.05, COL.rim, 0, armLen, +pz, 0, 0, 0, frameOpts);
  pedalL.name = "pedal_l";
  crank.add(pedalL);
  const pedalR = box(0.07, 0.02, 0.05, COL.rim, 0, -armLen, -pz, 0, 0, 0, frameOpts);
  pedalR.name = "pedal_r";
  crank.add(pedalR);
  // 라이더 있으면 Static Fit(crank 0°) 각을 굽고, 없으면 수평(3시)로 두어 페달이 지면에 안 닿게.
  // 주행 시엔 Mapbox feature-state 가 절대각으로 덮어쓴다.
  if (INCLUDE_RIDER) bakeRotation(crank, [0, STATIC_POSE.crankRotationDeg, 0]);
  else crank.rotation.z = Math.PI / 2;
  return crank;
}
root.add(crankAssembly());

/**
 * 허벅지·정강이 — rest pose = 두 뼈 모두 **-Y(수직 아래)**. 3D IK(riderIk.mjs)가 rest 를
 * 계산된 뼈 방향으로 돌리는 3D 오일러 회전(feature-state)을 건다. pole vector 로 무릎이 아래·전방.
 * ⚠ 반드시 지킬 것(안 지키면 발이 페달에서 벗어남):
 *   - leg.position = 실제 고관절 HIP_L/HIP_R (좌우 z=±PELVIS_HALF_Z) — IK root 와 동일.
 *   - knee(shin pivot) = [0, -THIGH_LEN, 0]  ·  발바닥(페달 접촉) = shin 로컬 [0, -SHIN_LEN, 0]
 *   - pivot 체인은 로컬 -Y 직선(z=0). 좌우 벌림은 leg.position 의 z + IK 3D 회전이 만든다.
 * Static Fit 초기 회전을 구워 프리뷰 정지자세로 쓴다(주행 시 feature-state 가 덮음).
 */
function legAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const hip = side === "l" ? RIG_HIP_L : RIG_HIP_R;
  const leg = new THREE.Group();
  leg.name = `leg_${side}`;
  leg.position.set(hip[0], hip[1], hip[2]);
  bakeRotation(leg, side === "l" ? STATIC_POSE.legLRotationDeg : STATIC_POSE.legRRotationDeg);

  // 무릎 = 수직 아래 THIGH_LEN, z=0 (IK pivot). 좌우 벌림은 3D 회전이 만든다.
  const knee = [0, -THIGH_LEN, 0];
  // 허벅지: 상단 0.062(허벅지 볼륨) → 무릎 0.044. 빕숏(short)색.
  leg.add(taperTube([0, 0, 0], knee, 0.062, 0.044, COL.short, { radial: 18 }));
  // 대퇴사두 볼륨 — 허벅지 앞면 살짝 부풀림(앞=+X)
  const thighBulge = blob(0.05, COL.short, [1.1, 1.35, 0.95], { segments: 16 });
  thighBulge.position.set(0.02, knee[1] * 0.42, 0);
  leg.add(thighBulge);

  const kneeJoint = blob(0.043, COL.skin, [1.0, 0.95, 1.0], { segments: 14 });
  kneeJoint.position.set(knee[0], knee[1], knee[2]);
  leg.add(kneeJoint);

  const shin = new THREE.Group();
  shin.name = `leg_${side}_shin`;
  shin.position.set(knee[0], knee[1], knee[2]);
  bakeRotation(shin, side === "l" ? STATIC_POSE.legLShinRotationDeg : STATIC_POSE.legRShinRotationDeg);
  // 발바닥(페달 접촉점) = 수직 아래 SHIN_LEN, z=0 (IK target). 발목은 그보다 살짝 위.
  const foot = [0, -SHIN_LEN, 0]; // 클릿=페달 접촉(IK target)
  const ankle = [0, -SHIN_LEN + 0.05, 0]; // 발목 관절(발등 시작)
  // 종아리: 무릎쪽 0.044(장딴지) → 발목 0.026. 맨살(skin).
  shin.add(taperTube([0, 0, 0], ankle, 0.044, 0.026, COL.skin, { radial: 16 }));
  // 장딴지 볼륨 — 종아리 상단 뒤쪽(뒤=-X)
  const calf = blob(0.036, COL.skin, [1.0, 1.4, 0.9], { segments: 14 });
  calf.position.set(-0.01, ankle[1] * 0.32, 0);
  shin.add(calf);
  // 발목
  const ankleJoint = blob(0.026, COL.skin, [1, 1, 1], { segments: 12 });
  ankleJoint.position.set(ankle[0], ankle[1], ankle[2]);
  shin.add(ankleJoint);
  // 사이클링 슈즈 — 발바닥(foot=페달 접촉)을 기준으로 앞으로 뻗는 신발.
  shin.add(shoeAssembly(foot));
  leg.add(shin);
  return leg;
}

/**
 * 사이클링 슈즈 — 발등(shoe색)+밑창(밝은색). foot=페달 접촉점(IK target)을 밑창이 지나도록.
 * 발등은 접촉점 위·앞으로, 밑창은 접촉점 높이(발끝이 앞으로 살짝 뾰족).
 */
function shoeAssembly(foot) {
  const g = new THREE.Group();
  const fx = foot[0] + 0.02;
  const fy = foot[1] + 0.026; // 발등은 접촉점보다 위
  const fz = foot[2];
  // 발등: 뒤(발목) 낮고 앞(발끝) 길게 — 얇은 타원체
  const upper = blob(0.055, COL.shoe, [1.7, 0.5, 0.82], { segments: 16 });
  upper.position.set(fx, fy, fz);
  g.add(upper);
  // 발끝 테이퍼
  const toe = blob(0.03, COL.shoe, [1.4, 0.5, 0.75], { segments: 12 });
  toe.position.set(fx + 0.05, fy - 0.004, fz);
  g.add(toe);
  // 밑창 — 페달 접촉점(foot) 높이를 지난다
  const sole = box(0.13, 0.012, 0.05, 0xf1f5f9, fx + 0.006, foot[1], fz);
  g.add(sole);
  return g;
}

/** 저지(천) — 프레임 금속과 달리 부드러운 광 */
const jerseyOpts = { roughness: 0.7 };

/**
 * torso — 상체 전체(몸통·팔·머리·헬멧)를 하나의 이름 있는 노드로 묶어
 * Mapbox nodeOverride 로 페달링 스웨이(로컬 X축 롤)를 건다. pivot = pelvis.
 * 다리(leg_*)·crank·hipCover 는 밖(정적 기준) — riderGlbPedalPose.ts 와 동기.
 */
const torso = new THREE.Group();
torso.name = "torso";
torso.position.set(pelvis[0], pelvis[1], pelvis[2]);
/** 절대좌표 → torso 로컬(pelvis 기준) */
const rel = (p) => [p[0] - pelvis[0], p[1] - pelvis[1], p[2] - pelvis[2]];

/**
 * 상체(몸통) — 에어로 로드 자세. torso 로컬: 원점=pelvis, +X(전진)로 눕고 +Y 상승.
 * 등은 앞뒤로 납작(에어로), 좌우로 어깨 넓고 허리 좁은 역삼각형.
 * 핵심 척추 라인은 가는 테이퍼 튜브, 볼륨은 앞뒤로 눌린(z납작) blob 로 덧입힌다.
 * 몸통 로컬은 전경사축(척추방향)을 따라 배치하기 위해, 골반→어깨 방향벡터 기준으로 blob 를 놓는다.
 */
const shoulderL = rel(shoulder); // [0.26, 0.16, 0]
/**
 * 몸통 — 골반→어깨를 잇는 하나의 매끄러운 lathe 회전체(계단·뭉침 제거).
 * 프로파일: [축길이 t(0=골반, 1=어깨선), 반경]. 골반 넓음→허리 좁음→등 중간→어깨 넓음.
 * lathe 는 로컬 y축 중심 회전체이므로, 만든 뒤 몸통 방향(pelvis→shoulder)으로 정렬·전경사 적용.
 * 단면을 앞뒤로 납작하게(z-scale 축소) → 에어로 등판.
 */
const torsoAxisLen = Math.hypot(shoulderL[0], shoulderL[1]); // 골반→어깨 거리
const torsoProfile = [
  [0.0,  0.052], // 골반 하단(빕숏 경계)
  [0.10, 0.082], // 골반/엉치
  [0.28, 0.07],  // 허리(잘록)
  [0.5,  0.084], // 명치·등 중앙
  [0.72, 0.10],  // 흉곽 상부
  [0.9,  0.11],  // 어깨선(가장 넓음)
  [1.0,  0.075], // 어깨 상단 마감
].map(([t, r]) => [t * torsoAxisLen, r]);
const torsoMesh = lathe(torsoProfile, COL.jersey, { segments: 40, ...jerseyOpts });
// lathe 축(+y)을 몸통 방향(pelvis→shoulder)에 정렬. 단면은 원형 유지(각짐 방지).
const torsoDir = new THREE.Vector3(shoulderL[0], shoulderL[1], shoulderL[2]).normalize();
torsoMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), torsoDir);
torso.add(torsoMesh);

// 어깨 캡 — 목/팔이 붙는 어깨 상단을 좌우로 살짝 넓힌 볼륨(팔 연결 매끄럽게)
const shoulderCap = blob(0.088, COL.jersey, [1.0, 0.85, 1.5], { segments: 18, ...jerseyOpts });
shoulderCap.position.set(...shoulderL);
torso.add(shoulderCap);

/** 등 골드 스트라이프 — 척추 라인을 따라 */
const stripe = box(0.016, 0.34, 0.024, COL.gold, shoulderL[0] * 0.5 + 0.03, shoulderL[1] * 0.5 + 0.02, 0, 0, 0, -0.62);
torso.add(stripe);
/**
 * 골반 덮개(빕숏) — 상체를 앞으로 눕히면 몸통 튜브 하단이 힙에서 들려
 * 다리가 몸에서 분리돼 보인다(07-07 1차 시도 롤백 원인). 양쪽 고관절(z±0.068)을
 * 덮는 타원구로 상체·허벅지를 시각적으로 잇는다. 다리 IK 는 무관(정적 메시).
 */
const hipCover = new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 14), mat(COL.short));
hipCover.position.set(pelvis[0], pelvis[1] - 0.045, 0);
hipCover.scale.set(1.0, 0.85, 1.25);
if (INCLUDE_RIDER) {
  root.add(hipCover);
  root.add(legAssembly("l"));
  root.add(legAssembly("r"));
}

/**
 * 팔 — Hand@Hood 3D 2-Bone IK 계층 노드. rest = 두 뼈 모두 **-Y(수직 아래)**.
 * riderIk 가 arm_l/arm_r(상완)·arm_l_fore/arm_r_fore(전완)에 3D 오일러 회전을 걸어 손끝을
 * HOOD_L/HOOD_R 에 고정하고, pole vector 로 팔꿈치를 어깨 아래·바깥으로 벌린다.
 * ⚠ 반드시 지킬 것(안 지키면 손이 후드에서 벗어남):
 *   - arm.position = 실제 어깨 SHOULDER_L/SHOULDER_R (좌우 z=±SHOULDER_HALF_Z) — IK root 와 동일.
 *   - elbow(fore pivot) = [0, -UPPER_ARM_LEN, 0]  ·  손끝(후드) = fore 로컬 [0, -FOREARM_LEN, 0]
 *   - pivot 체인은 로컬 -Y 직선(z=0). 좌우 벌림은 arm.position 의 z + IK 3D 회전이 만든다.
 * 반팔 저지 → 상완 상부만 저지색, 팔꿈치 아래는 맨살.
 */
function armAssembly(side) {
  const upperColor = side === "l" ? COL.jersey : COL.jerseyDark;
  const shoulderPt = side === "l" ? RIG_SHOULDER_L : RIG_SHOULDER_R;

  const arm = new THREE.Group();
  arm.name = `arm_${side}`;
  arm.position.set(shoulderPt[0], shoulderPt[1], shoulderPt[2]);
  bakeRotation(arm, side === "l" ? STATIC_POSE.armLRotationDeg : STATIC_POSE.armRRotationDeg);

  // ⚠ IK pivot 체인(팔꿈치·손끝)은 로컬 -Y 직선(z=0). 좌우 벌림은 3D 회전이 만든다.
  const elbow = [0, -UPPER_ARM_LEN, 0];
  const sleeve = [0, -UPPER_ARM_LEN * 0.5, 0]; // 반팔 소매 끝(상완 중간)
  // 상완 저지 소매: 어깨(0.045)→소매끝(0.036)
  arm.add(taperTube([0, 0, 0], sleeve, 0.045, 0.036, upperColor, { ...jerseyOpts, radial: 14 }));
  // 상완 맨살: 소매끝→팔꿈치(0.03)
  arm.add(taperTube(sleeve, elbow, 0.035, 0.03, COL.skin, { radial: 14, capStart: false }));

  const elbowJoint = blob(0.03, COL.skin, [1, 1, 1], { segments: 12 });
  elbowJoint.position.set(elbow[0], elbow[1], elbow[2]);
  arm.add(elbowJoint);

  const fore = new THREE.Group();
  fore.name = `arm_${side}_fore`;
  fore.position.set(elbow[0], elbow[1], elbow[2]);
  bakeRotation(fore, side === "l" ? STATIC_POSE.armLForeRotationDeg : STATIC_POSE.armRForeRotationDeg);
  // 손끝(후드 접촉점) = 수직 아래 FOREARM_LEN, z=0 (IK target). 손목은 그보다 살짝 위.
  const hand = [0, -FOREARM_LEN, 0];
  const wrist = [0, -FOREARM_LEN + 0.03, 0];
  // 전완: 팔꿈치(0.03)→손목(0.022)
  fore.add(taperTube([0, 0, 0], wrist, 0.03, 0.022, COL.skin, { radial: 14, capStart: false }));
  // 손 — Fingerless 장갑. 후드를 쥔 주먹.
  const handBlob = blob(0.03, COL.shoe, [1.0, 1.15, 0.95], { segments: 12 });
  handBlob.position.set(hand[0], hand[1], hand[2]);
  fore.add(handBlob);
  arm.add(fore);

  return arm;
}
/**
 * ⚠ 팔은 torso 자식이 아니라 root 직속 — torso 스웨이(X롤)와 arm IK(Z회전)의 이중 적용을 피한다.
 * 스웨이에 따른 어깨 미세 이동은 armPose(swayX)가 IK 어깨 앵커에 이미 반영한다.
 */
if (INCLUDE_RIDER) {
  root.add(armAssembly("l"));
  root.add(armAssembly("r"));
}

// 목 — 어깨에서 머리로, 전경사라 앞으로 비스듬. (머리보다 먼저 그려 머리에 가리게)
torso.add(taperTube(rel([shoulder[0] - 0.02, shoulder[1] + 0.02, 0]), rel([headC[0] - 0.05, headC[1] - 0.07, 0]), 0.05, 0.04, COL.skin, { radial: 14 }));
// 머리 — 설계서 7.5head 비율(1head≈0.142, 반경 ≈0.071). 얼굴만 노출, 뒤·위는 헬멧이 덮음.
const head = blob(0.071, COL.skin, [1.06, 1.14, 0.98], { segments: 20 });
head.position.set(...rel(headC));
torso.add(head);

/**
 * 로드 사이클 헬멧 — 레퍼런스(LOW POLY AERO VENT) 정합 (2026-07-21 승인 프리뷰 이식).
 * ★ 사이클 헬멧: 머리 **위쪽에 얹힌 얕은 껍질**. 귀·뺨 안 덮음(하단이 관자놀이 위에서 끝).
 * 세로로 얇음(투구 아님), 앞뒤로 낮고 긴 물방울. 세로 벤트 5줄(TOP-DOWN). 뒤통수 챙 절대 금지.
 * 프로파일 로프트(단면 링 앞→뒤). 머리 중심(headC) 로컬 기준으로 배치 후 pelvis 상대화.
 */
const HELMET_RING_SEG = 12;
/** [x(앞뒤), zHalf(좌우 반폭), yTop(정수리), yBottom(하단-관자놀이 위)] — 머리중심 로컬 */
const HELMET_RINGS = [
  [0.072, 0.052, 0.045, 0.03],
  [0.05, 0.072, 0.072, 0.025],
  [0.022, 0.082, 0.09, 0.015],
  [-0.008, 0.086, 0.098, 0.01],
  [-0.04, 0.086, 0.1, 0.008],
  [-0.072, 0.082, 0.096, 0.01],
  [-0.104, 0.073, 0.085, 0.015],
  [-0.135, 0.06, 0.068, 0.022],
  [-0.162, 0.043, 0.048, 0.03],
  [-0.183, 0.025, 0.028, 0.02],
];
function helmetInterpAt(x) {
  for (let i = 0; i < HELMET_RINGS.length - 1; i++) {
    const [x0, z0, yt0] = HELMET_RINGS[i], [x1, z1, yt1] = HELMET_RINGS[i + 1];
    if (x <= x0 && x >= x1) {
      const f = (x - x1) / (x0 - x1);
      return { yTop: yt1 + (yt0 - yt1) * f, zHalf: z1 + (z0 - z1) * f };
    }
  }
  return { yTop: 0.03, zHalf: 0.05 };
}
function helmetAssembly() {
  const g = new THREE.Group();
  g.name = "helmet";
  // 헬멧 로컬 오프셋(프리뷰 helmet.position) — 머리 위에 얹고 앞단이 눈썹 위
  const ox = headC[0] + 0.024, oy = headC[1] - 0.002, oz = headC[2];
  const shellOpts = { roughness: 0.8, metalness: 0.0 };

  /**
   * 물방울 쉘 — 프로파일 링 로프트.
   * ⚠ Mapbox model 레이어는 primitive에 **indices(인덱스 버퍼)와 UV(TEXCOORD_0)를 요구**한다.
   * non-indexed geometry면 "Cannot read properties of undefined (reading 'count')"로
   * 모델 전체 렌더 실패(2026-07-21). → 정점 격자 + 인덱스 삼각형으로 구성.
   */
  {
    const nRings = HELMET_RINGS.length;
    const cols = HELMET_RING_SEG + 1;
    const pos = [];
    const uv = [];
    // 정점 격자: 링(r) × 아치둘레(i)
    for (let r = 0; r < nRings; r++) {
      const [x, zHalf, yTop, yBot] = HELMET_RINGS[r];
      for (let i = 0; i < cols; i++) {
        const ang = (Math.PI * i) / HELMET_RING_SEG;
        const z = -Math.cos(ang) * zHalf;
        const yArch = yBot + (yTop - yBot) * Math.sin(ang);
        pos.push(ox + x, oy + yArch, oz + z);
        uv.push(r / (nRings - 1), i / HELMET_RING_SEG);
      }
    }
    const idx = [];
    for (let r = 0; r < nRings - 1; r++) {
      for (let i = 0; i < HELMET_RING_SEG; i++) {
        const a = r * cols + i, b = a + 1, c = (r + 1) * cols + i, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // DoubleSide 전용 material(캐시 공유 금지). 얇은 쉘 안쪽도 보이게.
    const shellMat = new THREE.MeshStandardMaterial({
      color: COL.helmetShell, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide,
    });
    g.add(new THREE.Mesh(geo, shellMat));
  }

  // 세로 벤트 5줄 — 앞→뒤 검은 골
  const YBOT = 0.015;
  for (const zf of [-0.58, -0.29, 0, 0.29, 0.58]) {
    const edge = Math.abs(zf);
    const yFac = Math.sin(Math.acos(-zf));
    const ventXs = [-0.005, -0.035, -0.065, -0.095, -0.13];
    for (let s = 0; s < ventXs.length - 1; s++) {
      const xa = ventXs[s], xb = ventXs[s + 1];
      const ia = helmetInterpAt(xa), ib = helmetInterpAt(xb);
      const yA = YBOT + (ia.yTop - YBOT) * yFac - 0.006;
      const yB = YBOT + (ib.yTop - YBOT) * yFac - 0.006;
      g.add(tube(
        [ox + xa, oy + yA, oz + zf * ia.zHalf],
        [ox + xb, oy + yB, oz + zf * ib.zHalf],
        0.0072 - edge * 0.002, COL.helmetVisor, { radial: 5, roughness: 0.7 },
      ));
    }
  }

  /** 자식들은 절대좌표 — torso(pivot=pelvis) 로컬로 상대화 */
  g.position.set(-pelvis[0], -pelvis[1], -pelvis[2]);
  return g;
}
torso.add(helmetAssembly());

/**
 * 선글라스 — 레퍼런스 정합 가로 SHIELD (2026-07-21 승인 프리뷰 이식).
 * 눈 위치의 가로로 넓은 얇은 렌즈. 중앙 렌즈 + 좌우 wing(랩어라운드) + 상단 프레임 + 브릿지 + 관자.
 * frame색은 sunglass보다 약간 어두운데 저폴리라 sunglass로 통일.
 */
function sunglassesAssembly() {
  const g = new THREE.Group();
  const lensOpts = { roughness: 0.2, metalness: 0.3 };
  const gx = headC[0] + 0.072; // 얼굴 표면 바로 앞
  const gy = headC[1] + 0.006; // 눈 높이(헬멧 앞단 바로 아래)
  const gz = headC[2];
  // 중앙 렌즈 — 눈 부위만(축소: 폭 0.05, 세로 0.019)
  g.add(box(0.018, 0.019, 0.05, COL.sunglass, gx, gy, gz, 0, 0, 0, lensOpts));
  // 좌우 렌즈 wing — 바깥으로 뒤로 꺾여(랩어라운드), 간격 축소
  for (const side of [1, -1]) {
    g.add(box(0.016, 0.018, 0.024, COL.sunglass, gx - 0.006, gy, gz + side * 0.036, 0, side * -0.5, 0, lensOpts));
  }
  // 상단 프레임(가로 얇은 테)
  g.add(box(0.01, 0.005, 0.062, COL.sunglass, gx + 0.002, gy + 0.012, gz, 0, 0, 0, { roughness: 0.5 }));
  // 브릿지(코)
  g.add(box(0.012, 0.006, 0.01, COL.sunglass, gx + 0.003, gy - 0.002, gz, 0, 0, 0, { roughness: 0.5 }));
  // 관자(temple)
  for (const side of [1, -1]) {
    g.add(tube([gx - 0.01, gy + 0.005, gz + side * 0.042], [gx - 0.05, gy + 0.014, gz + side * 0.045], 0.0035, COL.sunglass, { radial: 6 }));
  }
  g.position.set(-pelvis[0], -pelvis[1], -pelvis[2]);
  return g;
}
torso.add(sunglassesAssembly());

// 목→어깨 저지 칼라(승모근에서 목으로) — 어깨 볼륨과 목을 잇는 테이퍼
torso.add(taperTube(rel(shoulder), rel([headC[0] - 0.04, headC[1] - 0.06, 0]), 0.07, 0.048, COL.jersey, { ...jerseyOpts, radial: 16, capEnd: false }));
if (INCLUDE_RIDER) root.add(torso);

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
  throw new Error("GLTFExporter returned unexpected data");
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));
console.info(`[gen:rider-glb] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);
