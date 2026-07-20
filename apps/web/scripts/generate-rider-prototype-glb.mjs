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
const outFile = path.join(outDir, "rider-lowpoly.glb");

/**
 * LiveOnSoft Cycle Rider v1.0 색상 — 설계서 Material Spec(5슬롯).
 * Jersey #2563EB · Bib #1E293B · Helmet White · Bike Matte Black · Glass Smoke Black · Skin Neutral.
 */
const COL = {
  // Bike — Matte Black (프레임/바퀴/핸들 통일 톤)
  tire: 0x141417,
  rim: 0x2a2a30,
  frame: 0x1a1a1d,
  frameDark: 0x101013,
  bar: 0x0d0d10,
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

const WHEEL_R = 0.26;
/**
 * 휠베이스 — 레퍼런스 로드바이크 비율. 뒷바퀴는 **안장(엉덩이) 바로 아래**:
 * 뒷허브가 BB 뒤 0.30(체인스테이 실제 비율), 멀리 떨어뜨리지 말 것.
 */
const REAR_X = -0.34;
const FRONT_X = 0.48;
const HUB_Y = WHEEL_R;

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
 * 700C 로드 휠 — 설계서: 25C(얇은 타이어), 스포크 16개, Matte Black.
 * XY 평면 원(축 Z), 허브 y=바닥+반경.
 */
function wheel(hubX) {
  const g = new THREE.Group();
  // 25C 얇은 타이어
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R, WHEEL_R * 0.075, 12, 40),
    mat(COL.tire, 1, { roughness: 0.85 }),
  );
  tire.position.set(hubX, HUB_Y, 0);
  // 딥림(로드 휠 특유의 두꺼운 림)
  const rimR = WHEEL_R * 0.86;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rimR, WHEEL_R * 0.05, 10, 40),
    mat(COL.rim, 1, { metalness: 0.4, roughness: 0.4 }),
  );
  rim.position.set(hubX, HUB_Y, 0);
  g.add(tire, rim);

  const spokeMat = mat(0x3a3a42, 1, { metalness: 0.6, roughness: 0.35 });
  const spokeR = rimR;
  // 스포크 16개 (설계서)
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0028, 0.0028, spokeR, 5),
      spokeMat,
    );
    spoke.position.set(hubX, HUB_Y + (Math.sin(angle) * spokeR) / 2, (Math.cos(angle) * spokeR) / 2);
    spoke.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, Math.sin(angle), Math.cos(angle)).normalize(),
    );
    g.add(spoke);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.055, 12),
    mat(COL.frame, 1, { metalness: 0.5, roughness: 0.35 }),
  );
  hub.position.set(hubX, HUB_Y, 0);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);

  // 디스크 브레이크 로터
  const disc = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 5, 20), mat(COL.rim, 1, { metalness: 0.6, roughness: 0.3 }));
  disc.position.set(hubX, HUB_Y, 0.032);
  g.add(disc);

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

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.62, 28),
  mat(COL.shadow, 0.26),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, 0.015, 0);
root.add(shadow);

root.add(wheel(REAR_X));
root.add(wheel(FRONT_X));

/**
 * 실제 로드바이크 다이아몬드 프레임. bb(크랭크축)는 IK 기준이라 고정.
 * 지오메트리(BB 기준): 시트튜브 후경 ~73°, 헤드튜브 전경 ~73°, 탑튜브 거의 수평.
 * 뒷삼각(체인스테이+시트스테이)이 뒷바퀴를, 포크가 앞바퀴를 잡는다.
 */
const rear = [REAR_X, HUB_Y, 0]; // 뒷허브
const front = [FRONT_X, HUB_Y, 0]; // 앞허브
const bb = [-0.04, 0.4, 0]; // 크랭크축(BB) — 변경 금지
// 시트튜브 상단(안장 클램프) — BB에서 후상방. 안장이 골반(y0.8) 바로 아래 오도록 낮춤.
const seatTop = [-0.15, 0.66, 0];
// 헤드튜브: 앞쪽, 탑튜브·다운튜브가 만나는 짧은 튜브(상단/하단). 안장과 비슷한 높이(탑튜브 수평).
// 앞바퀴가 안으로 들어왔으므로 하단을 올려 타이어와 간섭 방지.
const headTop = [0.38, 0.67, 0];
const headBot = [0.45, 0.56, 0];
// 스템·드롭바 — 헤드튜브 위. 후드(브레이크레버)를 손이 잡는다. 몸에 맞게 당김.
const stemEnd = [0.42, 0.7, 0];
const barHood = [0.5, 0.7, 0]; // 드롭바 후드(손 위치)

// 프레임 튜브는 얇아 radial 낮춰도 무방(파일 크기↓). blob cap도 이 radial 따름.
const frameOpts = { metalness: 0.55, roughness: 0.32, radial: 10 };
// 다운튜브: BB → 헤드튜브 하단 (가장 굵음)
root.add(tube(bb, headBot, 0.026, COL.frame, frameOpts));
// 시트튜브: BB → 시트튜브 상단
root.add(tube(bb, seatTop, 0.023, COL.frame, frameOpts));
// 탑튜브: 시트튜브 상단 → 헤드튜브 상단 (거의 수평)
root.add(tube(seatTop, headTop, 0.022, COL.frameDark, frameOpts));
// 헤드튜브: 상단→하단 (짧고 굵음)
root.add(tube(headTop, headBot, 0.026, COL.frameDark, frameOpts));
// 체인스테이: BB → 뒷허브 (좌우 2개)
for (const dz of [0.03, -0.03]) {
  root.add(tube([bb[0], bb[1], bb[2] + dz], [rear[0], rear[1], rear[2] + dz], 0.015, COL.frameDark, frameOpts));
}
// 시트스테이: 시트튜브 상단 → 뒷허브 (좌우 2개)
for (const dz of [0.03, -0.03]) {
  root.add(tube([seatTop[0], seatTop[1], seatTop[2] + dz], [rear[0], rear[1], rear[2] + dz], 0.013, COL.frame, frameOpts));
}
// 앞포크: 헤드튜브 하단 → 앞허브 (좌우 2개, 살짝 전경)
for (const dz of [0.03, -0.03]) {
  root.add(tube([headBot[0], headBot[1], headBot[2] + dz], [front[0], front[1], front[2] + dz], 0.014, COL.frameDark, frameOpts));
}

/** 물통 — 다운튜브에 붙여 세움 */
const dtMid = [(bb[0] + headBot[0]) / 2, (bb[1] + headBot[1]) / 2 + 0.04, 0];
const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.085, 12), mat(COL.gold));
bottle.position.set(dtMid[0], dtMid[1], dtMid[2]);
bottle.rotation.z = -0.5;
root.add(bottle);

/** 안장 — 시트튜브 상단에 시트포스트로 올림. 뒤로 살짝 긴 로드 새들 */
root.add(tube(seatTop, [seatTop[0] - 0.01, seatTop[1] + 0.05, 0], 0.011, COL.bar, frameOpts));
const saddle = blob(0.05, COL.frameDark, [2.4, 0.32, 0.95], { segments: 16, ...frameOpts });
saddle.position.set(seatTop[0] - 0.03, seatTop[1] + 0.075, 0);
saddle.rotation.z = -0.06;
root.add(saddle);

/** 스템 — 헤드튜브 상단 → 스템 끝(핸들 클램프) */
root.add(tube(headTop, stemEnd, 0.014, COL.bar, frameOpts));

/**
 * 드롭바 — 로드바이크 굽은 핸들바. 중앙(스템)에서 좌우로 뻗은 뒤 앞→아래로 감기는 드롭.
 * 손은 후드(brakehood, barHood 근처)를 잡는다. 좌우 대칭.
 */
function dropBar() {
  const g = new THREE.Group();
  const cz = 0.0;
  const barR = 0.014;
  // 탑바: 스템끝에서 좌우로
  g.add(tube([stemEnd[0], stemEnd[1], cz - 0.12], [stemEnd[0], stemEnd[1], cz + 0.12], barR, COL.bar, frameOpts));
  // 좌우 후드로 앞으로 뻗음 + 드롭(아래로 감김)
  for (const dz of [0.12, -0.12]) {
    // 탑바 끝 → 후드(앞·약간 아래)
    g.add(tube([stemEnd[0], stemEnd[1], cz + dz], [barHood[0], barHood[1], cz + dz], barR, COL.bar, frameOpts));
    // 후드 → 드롭(아래로 감기는 곡선 근사: 2세그먼트)
    g.add(tube([barHood[0], barHood[1], cz + dz], [barHood[0] + 0.04, barHood[1] - 0.08, cz + dz], barR, COL.bar, frameOpts));
    g.add(tube([barHood[0] + 0.04, barHood[1] - 0.08, cz + dz], [barHood[0] - 0.01, barHood[1] - 0.14, cz + dz], barR, COL.bar, frameOpts));
    // 브레이크 후드(손 얹는 곳) 살짝 볼륨
    const hood = blob(0.022, COL.bar, [1.6, 1.0, 1.0], { segments: 10, ...frameOpts });
    hood.position.set(barHood[0] + 0.01, barHood[1] + 0.005, cz + dz);
    g.add(hood);
  }
  return g;
}
root.add(dropBar());

/** ⚠️ pelvis 는 riderGlbPedalPose.ts PELVIS 와 동기 — 다리 IK 기준이므로 변경 금지 */
const pelvis = [-0.12, 0.8, 0];
/** 에어로 자세 — 상체 전경사(수평 대비 ~32°). 직립(0.02,1.02)은 산책 자세로 보였음. */
const shoulder = [0.14, 0.96, 0];
/** 머리를 낮추고 앞으로 — 전방 주시. */
const headC = [0.28, 1.07, 0];

/** Mapbox nodeOverride — Z축 회전(페달) */
function crankAssembly() {
  const crank = new THREE.Group();
  crank.name = "crank";
  crank.position.set(bb[0], bb[1], bb[2]);
  const armLen = 0.14;
  crank.add(tube([0, 0, 0], [0, armLen, 0], 0.012, COL.frameDark, frameOpts));
  crank.add(tube([0, 0, 0], [0, -armLen, 0], 0.012, COL.frameDark, frameOpts));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, armLen, 0, 0, 0, 0, frameOpts));
  crank.add(box(0.07, 0.02, 0.05, COL.rim, 0, -armLen, 0, 0, 0, 0, frameOpts));
  return crank;
}
root.add(crankAssembly());

/**
 * 허벅지·정강이 — hip/knee pivot (riderGlbPedalPose.ts 상수와 동기, 좌표 변경 금지).
 * 메시는 테이퍼 튜브 — 허벅지: 엉덩이(굵음)→무릎(가늘음), 종아리: 무릎→발목(가장 가늘),
 * 실측 레퍼런스의 근육진 허벅지 실루엣 반영. 관절 구체로 무릎을 매끄럽게 잇는다.
 */
function legAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const hipZ = 0.068 * sign;
  const leg = new THREE.Group();
  leg.name = `leg_${side}`;
  leg.position.set(pelvis[0] + 0.02, pelvis[1] - 0.08, hipZ);

  const knee = [0.04, -0.208, -0.022 * sign];
  // 허벅지: 상단 0.062(허벅지 볼륨) → 무릎 0.044. 저지 아닌 빕숏(short)색.
  leg.add(taperTube([0, 0, 0], knee, 0.062, 0.044, COL.short, { radial: 18 }));
  // 대퇴사두 볼륨 — 허벅지 앞면 살짝 부풀림
  const thighBulge = blob(0.05, COL.short, [1.1, 1.35, 0.95], { segments: 16 });
  thighBulge.position.set(knee[0] * 0.42 + 0.012, knee[1] * 0.42, knee[2] * 0.42);
  leg.add(thighBulge);

  const kneeJoint = blob(0.043, COL.skin, [1.0, 0.95, 1.0], { segments: 14 });
  kneeJoint.position.set(knee[0], knee[1], knee[2]);
  leg.add(kneeJoint);

  const shin = new THREE.Group();
  shin.name = `leg_${side}_shin`;
  shin.position.set(knee[0], knee[1], knee[2]);
  const ankle = [0.065, -0.22, 0.012 * sign];
  // 종아리: 무릎쪽 0.044(장딴지) → 발목 0.026. 맨살(skin).
  shin.add(taperTube([0, 0, 0], ankle, 0.044, 0.026, COL.skin, { radial: 16 }));
  // 장딴지 볼륨 — 종아리 상단 뒤쪽
  const calf = blob(0.036, COL.skin, [1.0, 1.4, 0.9], { segments: 14 });
  calf.position.set(ankle[0] * 0.32 - 0.01, ankle[1] * 0.32, ankle[2] * 0.32);
  shin.add(calf);
  // 발목
  const ankleJoint = blob(0.026, COL.skin, [1, 1, 1], { segments: 12 });
  ankleJoint.position.set(ankle[0], ankle[1], ankle[2]);
  shin.add(ankleJoint);
  // 사이클링 슈즈 — 앞코 낮고 뒤꿈치 있는 형태(단순 box보다 실루엣 좋게 테이퍼)
  shin.add(shoeAssembly(ankle));
  leg.add(shin);
  return leg;
}

/** 사이클링 슈즈 — 발등(shoe색)+밑창(밝은색). 발끝이 앞으로 살짝 뾰족 */
function shoeAssembly(ankle) {
  const g = new THREE.Group();
  const fx = ankle[0] + 0.02;
  const fy = ankle[1] - 0.016;
  const fz = ankle[2];
  // 발등: 뒤(발목) 낮고 앞(발끝) 길게 — 얇은 타원체
  const upper = blob(0.055, COL.shoe, [1.7, 0.5, 0.82], { segments: 16 });
  upper.position.set(fx, fy, fz);
  g.add(upper);
  // 발끝 테이퍼
  const toe = blob(0.03, COL.shoe, [1.4, 0.5, 0.75], { segments: 12 });
  toe.position.set(fx + 0.05, fy - 0.004, fz);
  g.add(toe);
  // 밑창
  const sole = box(0.13, 0.012, 0.05, 0xf1f5f9, fx + 0.006, fy - 0.028, fz);
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
root.add(hipCover);
root.add(legAssembly("l"));
root.add(legAssembly("r"));

/**
 * 팔 — 어깨(삼각근, 굵음)→팔꿈치(상완)→손(전완, 맨살). 테이퍼로 근육 실루엣.
 * 반팔 저지 → 상완 상부만 저지색, 팔꿈치 아래는 맨살.
 */
function armAssembly(side) {
  const sign = side === "l" ? 1 : -1;
  const upperColor = side === "l" ? COL.jersey : COL.jerseyDark;
  // 어깨 관절을 몸통 어깨 볼륨에 살짝 파묻어 연결 끊김 제거
  const shoulderPt = [shoulder[0] - 0.01, shoulder[1] - 0.005, 0.095 * sign];
  // 손: 드롭바 후드(barHood)를 쥔다. 좌우로 살짝 벌어짐(dz).
  const handPt = [barHood[0] - 0.005, barHood[1] + 0.015, 0.11 * sign];
  /**
   * ⚠ 팔꿈치는 어깨→손 직선보다 **아래**(하향 굽힘)가 자연스러운 라이딩 자세.
   * 이전 값(0.36, 0.855)은 직선 위(chord y≈0.80)라 팔이 위로 꺾여 보였음 — 금지.
   */
  const elbow = [0.33, 0.79, 0.105 * sign];
  // 반팔 소매 끝(상완 중간) — 어깨→팔꿈치 중간
  const sleeve = [0.23, 0.875, 0.1 * sign];

  const g = new THREE.Group();
  // 상완 저지 소매: 어깨(0.045)→소매끝(0.036)
  g.add(taperTube(shoulderPt, sleeve, 0.045, 0.036, upperColor, { ...jerseyOpts, radial: 14 }));
  // 상완 맨살: 소매끝→팔꿈치(0.032)
  g.add(taperTube(sleeve, elbow, 0.035, 0.03, COL.skin, { radial: 14, capStart: false }));
  // 전완: 팔꿈치(0.03)→손목(0.022), 살짝 가늘게
  g.add(taperTube(elbow, handPt, 0.03, 0.022, COL.skin, { radial: 14, capStart: false }));

  const elbowJoint = blob(0.03, COL.skin, [1, 1, 1], { segments: 12 });
  elbowJoint.position.set(elbow[0], elbow[1], elbow[2]);
  g.add(elbowJoint);

  // 손 — Fingerless 장갑(설계서). 손등은 검은 장갑, 후드를 쥔 주먹 형태.
  const hand = blob(0.03, COL.shoe, [1.0, 1.15, 0.95], { segments: 12 });
  hand.position.set(handPt[0], handPt[1], handPt[2]);
  g.add(hand);

  /** 자식들은 절대좌표 — torso(pivot=pelvis) 로컬로 상대화 */
  g.position.set(-pelvis[0], -pelvis[1], -pelvis[2]);
  return g;
}
torso.add(armAssembly("l"));
torso.add(armAssembly("r"));

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

  // 물방울 쉘 — 프로파일 링 로프트
  {
    const ringPts = HELMET_RINGS.map(([x, zHalf, yTop, yBot]) => {
      const pts = [];
      for (let i = 0; i <= HELMET_RING_SEG; i++) {
        const ang = (Math.PI * i) / HELMET_RING_SEG;
        const z = -Math.cos(ang) * zHalf;
        const yArch = yBot + (yTop - yBot) * Math.sin(ang);
        pts.push(new THREE.Vector3(ox + x, oy + yArch, oz + z));
      }
      return pts;
    });
    const pos = [];
    for (let r = 0; r < ringPts.length - 1; r++) {
      const a = ringPts[r], b = ringPts[r + 1];
      for (let i = 0; i < HELMET_RING_SEG; i++) {
        const p0 = a[i], p1 = a[i + 1], p2 = b[i], p3 = b[i + 1];
        pos.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z);
        pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const shell = new THREE.Mesh(geo, mat(COL.helmetShell, 1, shellOpts));
    shell.material.side = THREE.DoubleSide;
    g.add(shell);
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
root.add(torso);

const exporter = new GLTFExporter();
const data = await exporter.parseAsync(root, { binary: true });
if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
  throw new Error("GLTFExporter returned unexpected data");
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));
console.info(`[gen:rider-glb] wrote ${outFile} (${fs.statSync(outFile).size} bytes)`);
